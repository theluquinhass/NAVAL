-- Finance safety: idempotency, refund serialization, database-side period
-- totals and missing indexes. This file is prepared only; it has NOT been
-- applied to any database by the agent.
--
-- The aggregate RPCs make KPI totals exact even when a period has more rows
-- than the PostgREST single-response limit. The UI list queries stay unchanged.

-- ---------------------------------------------------------------------------
-- Idempotency for manually recorded payments and refunds.
-- ---------------------------------------------------------------------------

alter table public.payments
    add column if not exists idempotency_key text;

alter table public.payment_refunds
    add column if not exists idempotency_key text;

do $migration$
begin
    if not exists (
        select 1 from pg_constraint
         where conname = 'payments_idempotency_key_length_check'
           and conrelid = 'public.payments'::regclass
    ) then
        alter table public.payments
            add constraint payments_idempotency_key_length_check
            check (idempotency_key is null or length(idempotency_key) <= 64);
    end if;

    if not exists (
        select 1 from pg_constraint
         where conname = 'payment_refunds_idempotency_key_length_check'
           and conrelid = 'public.payment_refunds'::regclass
    ) then
        alter table public.payment_refunds
            add constraint payment_refunds_idempotency_key_length_check
            check (idempotency_key is null or length(idempotency_key) <= 64);
    end if;

    if not exists (
        select 1 from pg_constraint
         where conname = 'payments_profile_idempotency_key_key'
           and conrelid = 'public.payments'::regclass
    ) then
        alter table public.payments
            add constraint payments_profile_idempotency_key_key
            unique (profile_id, idempotency_key);
    end if;

    if not exists (
        select 1 from pg_constraint
         where conname = 'payment_refunds_profile_idempotency_key_key'
           and conrelid = 'public.payment_refunds'::regclass
    ) then
        alter table public.payment_refunds
            add constraint payment_refunds_profile_idempotency_key_key
            unique (profile_id, idempotency_key);
    end if;

    if not exists (
        select 1 from pg_constraint
         where conname = 'payments_profile_sale_key'
           and conrelid = 'public.payments'::regclass
    ) then
        alter table public.payments
            add constraint payments_profile_sale_key
            unique (profile_id, sale_id);
    end if;
end;
$migration$;

create index if not exists payment_refunds_profile_payment_idx
    on public.payment_refunds (profile_id, payment_id);

create index if not exists expenses_profile_category_idx
    on public.expenses (profile_id, category_id);

create unique index if not exists barbershops_user_id_key
    on public.barbershops (user_id);

-- ---------------------------------------------------------------------------
-- Serialize refunds for the same payment. Without this lock two concurrent
-- inserts can both read a zero balance and exceed the original payment.
-- ---------------------------------------------------------------------------

create or replace function public.finance_validate_refund()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
    v_payment public.payments%rowtype;
    v_already_refunded numeric(12,2);
begin
    perform pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(new.payment_id::text, 0::bigint)
    );

    select p.*
      into v_payment
      from public.payments p
     where p.id = new.payment_id
       and p.profile_id = new.profile_id;

    if not found then
        raise exception 'Pagamento não encontrado para este estabelecimento.'
            using errcode = '23503';
    end if;

    if new.refunded_at < v_payment.paid_at then
        raise exception 'Estorno não pode ser anterior ao pagamento.'
            using errcode = '22023';
    end if;

    if new.refunded_at > pg_catalog.now() + interval '1 day' then
        raise exception 'Estorno não pode ser feito no futuro.'
            using errcode = '22023';
    end if;

    select coalesce(pg_catalog.sum(r.amount), 0)
      into v_already_refunded
      from public.payment_refunds r
     where r.payment_id = new.payment_id
       and r.id is distinct from new.id;

    if v_already_refunded + new.amount > v_payment.amount then
        raise exception 'Estorno excede o valor do pagamento.'
            using errcode = '22023';
    end if;

    -- Product sales must be refunded through products_refund_sale(), which also
    -- restores stock. A partial manual refund would permanently block that RPC.
    if v_payment.source_type = 'product_sale'
       and v_already_refunded + new.amount <> v_payment.amount then
        raise exception 'Estorno parcial de venda de produto não é permitido; use a devolução de venda.'
            using errcode = '22023';
    end if;

    return new;
end;
$function$;

drop trigger if exists payment_refunds_validate on public.payment_refunds;
create trigger payment_refunds_validate
before insert or update on public.payment_refunds
for each row execute function public.finance_validate_refund();

revoke all on function public.finance_validate_refund()
    from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Reject dates that are too far in the past or in the future. The Express
-- validation applies the same window; this is defense in depth for direct
-- PostgREST writes.
-- ---------------------------------------------------------------------------

create or replace function public.finance_validate_business_date()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
    v_value timestamptz;
begin
    v_value := (pg_catalog.to_jsonb(new) ->> tg_argv[0])::timestamptz;

    if v_value is null then
        return new;
    end if;

    if v_value < pg_catalog.now() - interval '5 years'
       or v_value > pg_catalog.now() + interval '1 day' then
        raise exception 'Data fora da janela permitida.'
            using errcode = '22023';
    end if;

    return new;
end;
$function$;

drop trigger if exists payments_validate_date on public.payments;
create trigger payments_validate_date
before insert or update on public.payments
for each row execute function public.finance_validate_business_date('paid_at');

drop trigger if exists payment_refunds_validate_date on public.payment_refunds;
create trigger payment_refunds_validate_date
before insert or update on public.payment_refunds
for each row execute function public.finance_validate_business_date('refunded_at');

drop trigger if exists expenses_validate_date on public.expenses;
create trigger expenses_validate_date
before insert or update on public.expenses
for each row execute function public.finance_validate_business_date('spent_at');

revoke all on function public.finance_validate_business_date()
    from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Exact period totals, computed in cents inside PostgreSQL.
-- ---------------------------------------------------------------------------

create or replace function public.finance_period_totals(
    p_profile_id uuid,
    p_from timestamptz,
    p_to timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
    v_result jsonb;
begin
    if p_from is null or p_to is null or p_from >= p_to then
        raise exception 'PERIODO_INVALIDO' using errcode = '22023';
    end if;

    if not exists (
        select 1
          from public.barbershops b
         where b.id = p_profile_id
           and b.user_id = (select auth.uid())
    ) then
        raise exception 'BARBERSHOP_NOT_FOUND' using errcode = 'P0002';
    end if;

    select pg_catalog.jsonb_build_object(
        'revenue_cents', coalesce(pg_catalog.sum(pg_catalog.round(p.amount * 100))::bigint, 0),
        'payments_count', pg_catalog.count(*)::bigint
    )
      into v_result
      from public.payments p
     where p.profile_id = p_profile_id
       and p.paid_at >= p_from
       and p.paid_at < p_to;

    v_result := v_result || pg_catalog.jsonb_build_object(
        'refunds_cents', coalesce((
            select pg_catalog.sum(pg_catalog.round(r.amount * 100))::bigint
              from public.payment_refunds r
             where r.profile_id = p_profile_id
               and r.refunded_at >= p_from
               and r.refunded_at < p_to
        ), 0),
        'refunds_count', (
            select pg_catalog.count(*)::bigint
              from public.payment_refunds r
             where r.profile_id = p_profile_id
               and r.refunded_at >= p_from
               and r.refunded_at < p_to
        )
    );

    v_result := v_result || pg_catalog.jsonb_build_object(
        'expense_cents', coalesce((
            select pg_catalog.sum(pg_catalog.round(e.amount * 100))::bigint
              from public.expenses e
             where e.profile_id = p_profile_id
               and e.spent_at >= p_from
               and e.spent_at < p_to
        ), 0),
        'expenses_count', (
            select pg_catalog.count(*)::bigint
              from public.expenses e
             where e.profile_id = p_profile_id
               and e.spent_at >= p_from
               and e.spent_at < p_to
        )
    );

    return v_result;
end;
$function$;

create or replace function public.products_finance_period_totals(
    p_profile_id uuid,
    p_from timestamptz,
    p_to timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
    v_result jsonb;
begin
    if p_from is null or p_to is null or p_from >= p_to then
        raise exception 'PERIODO_INVALIDO' using errcode = '22023';
    end if;

    if not exists (
        select 1
          from public.barbershops b
         where b.id = p_profile_id
           and b.user_id = (select auth.uid())
    ) then
        raise exception 'BARBERSHOP_NOT_FOUND' using errcode = 'P0002';
    end if;

    v_result := pg_catalog.jsonb_build_object(
        'gross_revenue_cents', coalesce((
            select pg_catalog.sum(pg_catalog.round(p.amount * 100))::bigint
              from public.payments p
             where p.profile_id = p_profile_id
               and p.source_type = 'product_sale'
               and p.paid_at >= p_from
               and p.paid_at < p_to
        ), 0),
        'payments_count', (
            select pg_catalog.count(*)::bigint
              from public.payments p
             where p.profile_id = p_profile_id
               and p.source_type = 'product_sale'
               and p.paid_at >= p_from
               and p.paid_at < p_to
        )
    );

    v_result := v_result || pg_catalog.jsonb_build_object(
        'refunds_cents', coalesce((
            select pg_catalog.sum(pg_catalog.round(r.amount * 100))::bigint
              from public.payment_refunds r
             where r.profile_id = p_profile_id
               and r.refunded_at >= p_from
               and r.refunded_at < p_to
               and exists (
                   select 1
                     from public.payments p
                    where p.id = r.payment_id
                      and p.profile_id = p_profile_id
                      and p.source_type = 'product_sale'
               )
        ), 0),
        'refunds_count', (
            select pg_catalog.count(*)::bigint
              from public.payment_refunds r
             where r.profile_id = p_profile_id
               and r.refunded_at >= p_from
               and r.refunded_at < p_to
               and exists (
                   select 1
                     from public.payments p
                    where p.id = r.payment_id
                      and p.profile_id = p_profile_id
                      and p.source_type = 'product_sale'
               )
        )
    );

    v_result := v_result || pg_catalog.jsonb_build_object(
        'purchase_expenses_cents', coalesce((
            select pg_catalog.sum(pg_catalog.round(e.amount * 100))::bigint
              from public.expenses e
             where e.profile_id = p_profile_id
               and e.source_type = 'stock_entry'
               and e.spent_at >= p_from
               and e.spent_at < p_to
        ), 0),
        'purchases_count', (
            select pg_catalog.count(*)::bigint
              from public.expenses e
             where e.profile_id = p_profile_id
               and e.source_type = 'stock_entry'
               and e.spent_at >= p_from
               and e.spent_at < p_to
        ),
        'sales_count', (
            select pg_catalog.count(*)::bigint
              from public.sales s
             where s.profile_id = p_profile_id
               and s.sold_at >= p_from
               and s.sold_at < p_to
        )
    );

    return v_result;
end;
$function$;

revoke all on function public.finance_period_totals(uuid, timestamptz, timestamptz)
    from public, anon, authenticated;
grant execute on function public.finance_period_totals(uuid, timestamptz, timestamptz)
    to authenticated;

revoke all on function public.products_finance_period_totals(uuid, timestamptz, timestamptz)
    from public, anon, authenticated;
grant execute on function public.products_finance_period_totals(uuid, timestamptz, timestamptz)
    to authenticated;

-- ---------------------------------------------------------------------------
-- Read-only public helpers should be STABLE, not VOLATILE.
-- ---------------------------------------------------------------------------

create or replace function public.get_public_busy_times(
    p_profile_id uuid,
    p_from timestamptz,
    p_to timestamptz
)
returns table (starts_at timestamptz, ends_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
    select a.starts_at, a.ends_at
      from public.appointments a
     where a.profile_id = p_profile_id
       and a.status = 'confirmed'
       and a.starts_at < p_to
       and a.ends_at > p_from;
$$;

create or replace function public.get_public_barbershop(p_slug text)
returns table (id uuid, name text, slug text)
language sql
stable
security definer
set search_path = ''
as $$
    select b.id, b.name, b.slug
      from public.barbershops b
     where b.slug = p_slug
     limit 1;
$$;

revoke all on function public.get_public_busy_times(uuid, timestamptz, timestamptz) from public;
grant execute on function public.get_public_busy_times(uuid, timestamptz, timestamptz) to anon, authenticated;

revoke all on function public.get_public_barbershop(text) from public;
grant execute on function public.get_public_barbershop(text) to anon, authenticated;
