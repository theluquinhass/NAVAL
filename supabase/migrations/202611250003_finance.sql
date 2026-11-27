-- Finance: manually recorded payments, explicit refunds and expenses.
-- No gateway, no automatic settlement on cancellation, no historical backfill.
-- Tenant ownership is always derived from barbershops.user_id = auth.uid().

create table public.expense_categories (
    id uuid primary key default gen_random_uuid(),
    profile_id uuid not null
        references public.barbershops(id) on delete cascade,
    name text not null check (length(btrim(name)) > 0 and length(name) <= 80),
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (profile_id, name)
);

create table public.payments (
    id uuid primary key default gen_random_uuid(),
    profile_id uuid not null
        references public.barbershops(id) on delete cascade,
    appointment_id uuid,
    amount numeric(12,2) not null check (amount > 0),
    currency char(3) not null default 'BRL' check (currency = 'BRL'),
    paid_at timestamptz not null,
    method text not null check (length(btrim(method)) > 0),
    note text,
    created_at timestamptz not null default now(),
    foreign key (appointment_id)
        references public.appointments (id)
        on delete set null
);

create index if not exists payments_profile_paid_at_idx
    on public.payments (profile_id, paid_at);

create table public.payment_refunds (
    id uuid primary key default gen_random_uuid(),
    profile_id uuid not null
        references public.barbershops(id) on delete cascade,
    payment_id uuid not null,
    amount numeric(12,2) not null check (amount > 0),
    currency char(3) not null default 'BRL' check (currency = 'BRL'),
    refunded_at timestamptz not null,
    reason text,
    created_at timestamptz not null default now(),
    foreign key (payment_id)
        references public.payments (id)
        on delete cascade
);

create index if not exists payment_refunds_profile_refunded_at_idx
    on public.payment_refunds (profile_id, refunded_at);

create table public.expenses (
    id uuid primary key default gen_random_uuid(),
    profile_id uuid not null
        references public.barbershops(id) on delete cascade,
    category_id uuid,
    description text not null check (length(btrim(description)) > 0),
    amount numeric(12,2) not null check (amount > 0),
    currency char(3) not null default 'BRL' check (currency = 'BRL'),
    spent_at timestamptz not null,
    payment_method text,
    note text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    foreign key (category_id)
        references public.expense_categories (id)
        on delete set null
);

create index if not exists expenses_profile_spent_at_idx
    on public.expenses (profile_id, spent_at);

create or replace function public.finance_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
    new.updated_at := pg_catalog.now();
    return new;
end;
$function$;

drop trigger if exists expense_categories_set_updated_at on public.expense_categories;
create trigger expense_categories_set_updated_at
before update on public.expense_categories
for each row execute function public.finance_set_updated_at();

drop trigger if exists expenses_set_updated_at on public.expenses;
create trigger expenses_set_updated_at
before update on public.expenses
for each row execute function public.finance_set_updated_at();

revoke all on function public.finance_set_updated_at()
    from public, anon, authenticated;

-- Optional links must point to rows of the same barbershop.
create or replace function public.finance_validate_tenant_link()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
    if tg_table_name = 'payments'
       and new.appointment_id is not null
       and not exists (
           select 1
             from public.appointments a
            where a.id = new.appointment_id
              and a.profile_id = new.profile_id
       ) then
        raise exception 'Agendamento não pertence a esta barbearia.'
            using errcode = '22023';
    end if;

    if tg_table_name = 'expenses'
       and new.category_id is not null
       and not exists (
           select 1
             from public.expense_categories c
            where c.id = new.category_id
              and c.profile_id = new.profile_id
       ) then
        raise exception 'Categoria não pertence a esta barbearia.'
            using errcode = '22023';
    end if;

    return new;
end;
$function$;

drop trigger if exists payments_validate_tenant_link on public.payments;
create trigger payments_validate_tenant_link
before insert or update on public.payments
for each row execute function public.finance_validate_tenant_link();

drop trigger if exists expenses_validate_tenant_link on public.expenses;
create trigger expenses_validate_tenant_link
before insert or update on public.expenses
for each row execute function public.finance_validate_tenant_link();

revoke all on function public.finance_validate_tenant_link()
    from public, anon, authenticated;

-- Refunds are explicit events: they cannot predate the payment or exceed it.
create or replace function public.finance_validate_refund()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
    v_payment public.payments%rowtype;
    v_already_refunded numeric(12,2);
begin
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

    select coalesce(pg_catalog.sum(r.amount), 0)
      into v_already_refunded
      from public.payment_refunds r
     where r.payment_id = new.payment_id
       and r.id is distinct from new.id;

    if v_already_refunded + new.amount > v_payment.amount then
        raise exception 'Estorno excede o valor do pagamento.'
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

alter table public.expense_categories enable row level security;
alter table public.payments enable row level security;
alter table public.payment_refunds enable row level security;
alter table public.expenses enable row level security;

revoke all on table public.expense_categories from public, anon, authenticated;
revoke all on table public.payments from public, anon, authenticated;
revoke all on table public.payment_refunds from public, anon, authenticated;
revoke all on table public.expenses from public, anon, authenticated;

grant select, insert, update, delete on public.expense_categories to authenticated;
grant select, insert on public.payments to authenticated;
grant select, insert on public.payment_refunds to authenticated;
grant select, insert, update on public.expenses to authenticated;

drop policy if exists "Owners can manage their expense categories" on public.expense_categories;
create policy "Owners can manage their expense categories"
    on public.expense_categories for all to authenticated
    using (
        exists (
            select 1 from public.barbershops b
             where b.id = expense_categories.profile_id
               and b.user_id = (select auth.uid())
        )
    )
    with check (
        exists (
            select 1 from public.barbershops b
             where b.id = expense_categories.profile_id
               and b.user_id = (select auth.uid())
        )
    );

drop policy if exists "Owners can read their payments" on public.payments;
create policy "Owners can read their payments"
    on public.payments for select to authenticated
    using (
        exists (
            select 1 from public.barbershops b
             where b.id = payments.profile_id
               and b.user_id = (select auth.uid())
        )
    );

drop policy if exists "Owners can record payments" on public.payments;
create policy "Owners can record payments"
    on public.payments for insert to authenticated
    with check (
        exists (
            select 1 from public.barbershops b
             where b.id = payments.profile_id
               and b.user_id = (select auth.uid())
        )
    );

drop policy if exists "Owners can read their refunds" on public.payment_refunds;
create policy "Owners can read their refunds"
    on public.payment_refunds for select to authenticated
    using (
        exists (
            select 1 from public.barbershops b
             where b.id = payment_refunds.profile_id
               and b.user_id = (select auth.uid())
        )
    );

drop policy if exists "Owners can record refunds" on public.payment_refunds;
create policy "Owners can record refunds"
    on public.payment_refunds for insert to authenticated
    with check (
        exists (
            select 1 from public.barbershops b
             where b.id = payment_refunds.profile_id
               and b.user_id = (select auth.uid())
        )
    );

drop policy if exists "Owners can read their expenses" on public.expenses;
create policy "Owners can read their expenses"
    on public.expenses for select to authenticated
    using (
        exists (
            select 1 from public.barbershops b
             where b.id = expenses.profile_id
               and b.user_id = (select auth.uid())
        )
    );

drop policy if exists "Owners can record expenses" on public.expenses;
create policy "Owners can record expenses"
    on public.expenses for insert to authenticated
    with check (
        exists (
            select 1 from public.barbershops b
             where b.id = expenses.profile_id
               and b.user_id = (select auth.uid())
        )
    );

drop policy if exists "Owners can update their expenses" on public.expenses;
create policy "Owners can update their expenses"
    on public.expenses for update to authenticated
    using (
        exists (
            select 1 from public.barbershops b
             where b.id = expenses.profile_id
               and b.user_id = (select auth.uid())
        )
    )
    with check (
        exists (
            select 1 from public.barbershops b
             where b.id = expenses.profile_id
               and b.user_id = (select auth.uid())
        )
    );
