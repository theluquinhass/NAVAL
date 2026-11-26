-- Product safety: deterministic tenant resolution, concurrent idempotency,
 -- monetary bounds, tenant-scoped foreign keys and missing indexes.
-- This file is prepared only; it has NOT been applied to any database by the
-- agent. It replaces definitions from 202611250010/011/012 without editing
-- those already-versioned files.
--
-- Validate with fabricated data in a development database:
--   - two simultaneous sales with the same key return the same sale
--   - a sale above 99,999,999.99 is rejected instead of overflowing numeric(12,2)
--   - deleting a barbershop cascades over generated stock expenses
--   - a movement cannot point to a correction in another tenant

-- ---------------------------------------------------------------------------
-- A user owns one barbershop (enforced by 0014). Resolve it deterministically
-- and mark the helper STABLE because it only reads.
-- ---------------------------------------------------------------------------

create or replace function public.products_authenticated_profile_id()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
    v_profile_id uuid;
begin
    select b.id
      into strict v_profile_id
      from public.barbershops b
     where b.user_id = (select auth.uid());

    return v_profile_id;
exception
    when no_data_found then
        raise exception 'BARBERSHOP_NOT_FOUND' using errcode = 'P0002';
    when too_many_rows then
        raise exception 'BARBERSHOP_AMBIGUOUS' using errcode = 'P0003';
end;
$function$;

revoke all on function public.products_authenticated_profile_id()
    from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Bound idempotency keys at the database as well as in Express.
-- ---------------------------------------------------------------------------

do $migration$
begin
    if not exists (
        select 1 from pg_constraint
         where conname = 'sales_idempotency_key_length_check'
           and conrelid = 'public.sales'::regclass
    ) then
        alter table public.sales
            add constraint sales_idempotency_key_length_check
            check (idempotency_key is null or length(idempotency_key) <= 64);
    end if;
end;
$migration$;

-- ---------------------------------------------------------------------------
-- Defense in depth for sale dates and monetary bounds. The RPC below checks
-- the same rules before doing any work.
-- ---------------------------------------------------------------------------

create or replace function public.products_validate_sale()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
    if new.sold_at < pg_catalog.now() - interval '5 years'
       or new.sold_at > pg_catalog.now() + interval '1 day' then
        raise exception 'SALE_DATE_INVALID' using errcode = '22023';
    end if;

    if new.total_amount > 99999999.99 then
        raise exception 'SALE_TOTAL_OVERFLOW' using errcode = '22023';
    end if;

    return new;
end;
$function$;

drop trigger if exists sales_validate_date_and_amount on public.sales;
create trigger sales_validate_date_and_amount
before insert or update on public.sales
for each row execute function public.products_validate_sale();

revoke all on function public.products_validate_sale()
    from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- sales: replay concurrent retries instead of returning a bare 23505.
-- The advisory lock is taken before the idempotency lookup, so a second
-- caller waits for the first transaction to commit and then reads its sale.
-- ---------------------------------------------------------------------------

create or replace function public.products_create_sale(
    p_items jsonb,
    p_payment_method text,
    p_sold_at timestamptz,
    p_idempotency_key text,
    p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
    v_profile_id uuid := public.products_authenticated_profile_id();
    v_item jsonb;
    v_item_count integer;
    v_sale public.sales;
    v_payment_id uuid;
    v_total numeric(12,2);
    v_result jsonb;
begin
    if p_payment_method is null or length(btrim(p_payment_method)) = 0
       or length(p_payment_method) > 50 then
        raise exception 'Informe a forma de pagamento.' using errcode = '22023';
    end if;
    if p_sold_at is null then
        raise exception 'Informe a data da venda.' using errcode = '22023';
    end if;
    if p_sold_at < pg_catalog.now() - interval '5 years'
       or p_sold_at > pg_catalog.now() + interval '1 day' then
        raise exception 'SALE_DATE_INVALID' using errcode = '22023';
    end if;
    if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
        raise exception 'SALE_ITEMS_INVALID' using errcode = '22023';
    end if;

    if p_idempotency_key is not null then
        perform pg_catalog.pg_advisory_xact_lock(
            pg_catalog.hashtextextended(v_profile_id::text || ':' || p_idempotency_key, 0::bigint)
        );

        select s.*
          into v_sale
          from public.sales s
         where s.profile_id = v_profile_id
           and s.idempotency_key = p_idempotency_key;

        if v_sale.id is not null then
            select p.id
              into v_payment_id
              from public.payments p
             where p.profile_id = v_profile_id
               and p.sale_id = v_sale.id
             order by p.created_at desc, p.id desc
             limit 1;

            select jsonb_build_object('sale', to_jsonb(s), 'paymentId', v_payment_id)
              into v_result
              from public.sales s
             where s.id = v_sale.id;
            return v_result;
        end if;
    end if;

    drop table if exists pg_temp.naval_sale_items_input;

    create temporary table pg_temp.naval_sale_items_input (
        product_id uuid not null,
        quantity integer not null,
        unit_price numeric(12,2) not null,
        unit_cost numeric(12,2) not null
    ) on commit drop;

    for v_item in select value from pg_catalog.jsonb_array_elements(p_items)
    loop
        if not (v_item ? 'productId')
           or jsonb_typeof(v_item -> 'productId') <> 'string'
           or (v_item ->> 'quantity') !~ '^[1-9][0-9]*$'
           or (v_item ->> 'quantity')::bigint > 100000 then
            raise exception 'SALE_ITEMS_INVALID' using errcode = '22023';
        end if;

        insert into pg_temp.naval_sale_items_input (product_id, quantity, unit_price, unit_cost)
        values ((v_item ->> 'productId')::uuid, (v_item ->> 'quantity')::integer, 0, 0);
    end loop;

    select count(*)
      into v_item_count
      from pg_temp.naval_sale_items_input;

    if v_item_count = 0 or v_item_count <> (
        select count(distinct product_id) from pg_temp.naval_sale_items_input
    ) then
        raise exception 'SALE_ITEMS_INVALID' using errcode = '22023';
    end if;

    if v_item_count <> (
        select count(*)
          from public.products p
         where p.profile_id = v_profile_id
           and p.id in (select product_id from pg_temp.naval_sale_items_input)
    ) then
        raise exception 'PRODUCT_NOT_FOUND' using errcode = 'P0002';
    end if;

    if exists (
        select 1
          from public.products p
          join pg_temp.naval_sale_items_input i on i.product_id = p.id
         where p.profile_id = v_profile_id
           and not p.is_active
    ) then
        raise exception 'PRODUCT_INACTIVE' using errcode = '22023';
    end if;

    perform 1
      from public.products p
     where p.profile_id = v_profile_id
       and p.id in (select product_id from pg_temp.naval_sale_items_input)
     order by p.id
       for update;

    update pg_temp.naval_sale_items_input i
       set unit_price = p.price,
           unit_cost = coalesce(p.cost, 0)
      from public.products p
     where p.id = i.product_id
       and p.profile_id = v_profile_id;

    if exists (
        select 1
          from pg_temp.naval_sale_items_input i
         where pg_catalog.round(i.unit_price * i.quantity, 2) > 99999999.99
    ) then
        raise exception 'SALE_TOTAL_OVERFLOW' using errcode = '22023';
    end if;

    if exists (
        select 1
          from pg_temp.naval_sale_items_input i
          where coalesce((
                    select sum(m.direction * m.quantity)
                      from public.inventory_movements m
                     where m.profile_id = v_profile_id
                       and m.product_id = i.product_id
                ), 0)::integer < i.quantity
    ) then
        raise exception 'ESTOQUE_INSUFICIENTE' using errcode = '22023';
    end if;

    select coalesce(sum(pg_catalog.round(i.unit_price * i.quantity, 2)), 0)
      into v_total
      from pg_temp.naval_sale_items_input i;

    if v_total > 99999999.99 then
        raise exception 'SALE_TOTAL_OVERFLOW' using errcode = '22023';
    end if;

    insert into public.sales (
        profile_id, created_by, sold_at, payment_method, total_amount, idempotency_key
    ) values (
        v_profile_id, auth.uid(), p_sold_at, btrim(p_payment_method), v_total, p_idempotency_key
    )
    returning * into v_sale;

    insert into public.sale_items (
        profile_id, sale_id, product_id, quantity, unit_price, unit_cost
    )
    select v_profile_id, v_sale.id, i.product_id, i.quantity, i.unit_price, i.unit_cost
      from pg_temp.naval_sale_items_input i;

    insert into public.payments (
        profile_id, sale_id, amount, paid_at, method, note, source_type
    ) values (
        v_profile_id, v_sale.id, v_total, p_sold_at, btrim(p_payment_method),
        nullif(btrim(p_note), ''), 'product_sale'
    )
    returning id into v_payment_id;

    insert into public.inventory_movements (
        profile_id, product_id, movement_type, direction, quantity, sale_id, created_by, note
    )
    select v_profile_id, i.product_id, 'sale', -1, i.quantity, v_sale.id, auth.uid(),
           'Baixa da venda ' || v_sale.id::text
      from pg_temp.naval_sale_items_input i;

    select jsonb_build_object('sale', to_jsonb(v_sale), 'paymentId', v_payment_id)
      into v_result;

    return v_result;
end;
$function$;

revoke all on function public.products_create_sale(jsonb, text, timestamptz, text, text)
    from public, anon, authenticated;
grant execute on function public.products_create_sale(jsonb, text, timestamptz, text, text)
    to authenticated;

-- ---------------------------------------------------------------------------
-- A generated stock expense is a snapshot. Block editing it, but let the
-- ON DELETE CASCADE from barbershops remove it (authenticated has no DELETE
-- grant on expenses anyway).
-- ---------------------------------------------------------------------------

create or replace function public.finance_protect_stock_expenses()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
    if old.source_type <> 'manual' or new.source_type <> 'manual' then
        raise exception 'Despesa gerada por entrada de estoque não pode ser alterada.'
            using errcode = '22023';
    end if;

    return new;
end;
$function$;

drop trigger if exists expenses_protect_stock_expenses on public.expenses;
create trigger expenses_protect_stock_expenses
before update on public.expenses
for each row execute function public.finance_protect_stock_expenses();

revoke all on function public.finance_protect_stock_expenses()
    from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Indexes used by existing queries and tenant-scoped foreign keys.
-- ---------------------------------------------------------------------------

create index if not exists inventory_movements_profile_sale_idx
    on public.inventory_movements (profile_id, sale_id);

do $migration$
begin
    if exists (
        select 1 from pg_constraint
         where conname = 'inventory_movements_corrected_fkey'
           and conrelid = 'public.inventory_movements'::regclass
    ) then
        alter table public.inventory_movements
            drop constraint inventory_movements_corrected_fkey;
    end if;

    if not exists (
        select 1 from pg_constraint
         where conname = 'inventory_movements_corrected_fkey'
           and conrelid = 'public.inventory_movements'::regclass
    ) then
        -- NOT VALID keeps existing rows untouched while enforcing new writes.
        alter table public.inventory_movements
            add constraint inventory_movements_corrected_fkey
            foreign key (profile_id, corrected_movement_id)
            references public.inventory_movements (profile_id, id)
            on delete restrict
            not valid;
    end if;

    if exists (
        select 1 from pg_constraint
         where conname = 'sales_created_by_fkey'
           and conrelid = 'public.sales'::regclass
    ) then
        alter table public.sales drop constraint sales_created_by_fkey;
        alter table public.sales
            add constraint sales_created_by_fkey
            foreign key (created_by) references auth.users(id) on delete set null;
    end if;

    if exists (
        select 1 from pg_constraint
         where conname = 'inventory_movements_created_by_fkey'
           and conrelid = 'public.inventory_movements'::regclass
    ) then
        alter table public.inventory_movements drop constraint inventory_movements_created_by_fkey;
        alter table public.inventory_movements
            add constraint inventory_movements_created_by_fkey
            foreign key (created_by) references auth.users(id) on delete set null;
    end if;
end;
$migration$;

-- ---------------------------------------------------------------------------
-- The redundant single-column FK is covered by the composite one. Removing
-- it also makes replay lookups deterministic thanks to 0014's unique key.
-- ---------------------------------------------------------------------------

alter table public.payments drop constraint if exists payments_sale_id_fkey;

-- ---------------------------------------------------------------------------
-- Migration 0009 removes constraints but a loose unique index with the same
-- columns may still exist on databases created outside this repository.
-- Drop only indexes not backed by a constraint, never the period-aware one.
-- ---------------------------------------------------------------------------

do $migration$
declare
    v_index record;
begin
    for v_index in
        select c.relname
          from pg_index i
          join pg_class c on c.oid = i.indexrelid
          join pg_class t on t.oid = i.indrelid
         where t.oid = 'public.barbershop_working_hours'::regclass
           and i.indisunique
           and i.indnkeyatts = 2
           and i.indkey::smallint[] = array[
                   (select attnum from pg_attribute
                     where attrelid = t.oid and attname = 'profile_id' and not attisdropped),
                   (select attnum from pg_attribute
                     where attrelid = t.oid and attname = 'day_of_week' and not attisdropped)
               ]::smallint[]
           and not exists (
                   select 1 from pg_constraint con where con.conindid = i.indexrelid
               )
    loop
        execute format('drop index if exists public.%I', v_index.relname);
    end loop;
end;
$migration$;

-- ---------------------------------------------------------------------------
-- Drop the old uuid overload: public booking resolves the tenant by slug,
-- never by a client-supplied profile id.
-- ---------------------------------------------------------------------------

drop function if exists public.get_public_busy_times(uuid, timestamptz, timestamptz);
