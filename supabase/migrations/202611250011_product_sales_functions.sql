-- Payment source columns and transactional product-sale RPCs.
-- This file is prepared only; it has NOT been applied to any database by the agent.
--
-- The RPCs below are the only write path for products' stock and sales. Each one
-- derives the barbershop from auth.uid(), locks product rows before checking
-- stock, and performs sale/items/payment/stock movements in one transaction.
--
-- 202611250007_finance_tenant_trigger_fix.sql may or may not already be live.
-- The split validation functions are recreated idempotently and the old shared
-- trigger is rewired only when pg_trigger still references it. Nothing is
-- applied to a remote database by this repository change.

alter table public.payments
    add column if not exists source_type text not null default 'manual';

alter table public.payments
    add column if not exists sale_id uuid;

do $migration$
begin
    if not exists (
        select 1
          from pg_constraint
         where conname = 'payments_source_type_check'
           and conrelid = 'public.payments'::regclass
    ) then
        alter table public.payments
            add constraint payments_source_type_check
            check (source_type in ('manual', 'product_sale'));
    end if;

    if not exists (
        select 1
          from pg_constraint
         where conname = 'payments_profile_id_id_key'
           and conrelid = 'public.payments'::regclass
    ) then
        alter table public.payments
            add constraint payments_profile_id_id_key unique (profile_id, id);
    end if;

    if not exists (
        select 1
          from pg_constraint
         where conname = 'payments_sale_id_fkey'
           and conrelid = 'public.payments'::regclass
    ) then
        alter table public.payments
            add constraint payments_sale_id_fkey foreign key (sale_id)
            references public.sales(id) on delete restrict;
    end if;

    if not exists (
        select 1
          from pg_constraint
         where conname = 'payments_profile_sale_fkey'
           and conrelid = 'public.payments'::regclass
    ) then
        alter table public.payments
            add constraint payments_profile_sale_fkey foreign key (profile_id, sale_id)
            references public.sales(profile_id, id) on delete restrict;
    end if;
end;
$migration$;

create index if not exists payments_source_type_paid_at_idx
    on public.payments (profile_id, source_type, paid_at);

-- Idempotent form of the 007 fix. Rewiring happens only for the broken trigger.
create or replace function public.finance_validate_payment_link()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
    if new.appointment_id is not null
       and not exists (
            select 1
              from public.appointments a
             where a.id = new.appointment_id
               and a.profile_id = new.profile_id
       ) then
        raise exception 'Agendamento não pertence a esta barbearia.'
            using errcode = '22023';
    end if;

    return new;
end;
$function$;

create or replace function public.finance_validate_expense_link()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
    if new.category_id is not null
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

do $repair$
begin
    if exists (
        select 1
          from pg_trigger
         where tgrelid = 'public.payments'::regclass
           and tgname = 'payments_validate_tenant_link'
           and pg_catalog.pg_get_triggerdef(oid) ilike '%finance_validate_tenant_link%'
    ) then
        drop trigger if exists payments_validate_tenant_link on public.payments;
        create trigger payments_validate_tenant_link
            before insert or update on public.payments
            for each row execute function public.finance_validate_payment_link();
    end if;

    if exists (
        select 1
          from pg_trigger
         where tgrelid = 'public.expenses'::regclass
           and tgname = 'expenses_validate_tenant_link'
           and pg_catalog.pg_get_triggerdef(oid) ilike '%finance_validate_tenant_link%'
    ) then
        drop trigger if exists expenses_validate_tenant_link on public.expenses;
        create trigger expenses_validate_tenant_link
            before insert or update on public.expenses
            for each row execute function public.finance_validate_expense_link();
    end if;
end;
$repair$;

revoke all on function public.finance_validate_payment_link()
    from public, anon, authenticated;
revoke all on function public.finance_validate_expense_link()
    from public, anon, authenticated;

create or replace function public.finance_validate_payment_sale_link()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
    if new.sale_id is not null
       and not exists (
            select 1
              from public.sales s
             where s.id = new.sale_id
               and s.profile_id = new.profile_id
       ) then
        raise exception 'Venda não pertence a esta barbearia.'
            using errcode = '22023';
    end if;

    return new;
end;
$function$;

drop trigger if exists payments_validate_sale_link on public.payments;
create trigger payments_validate_sale_link
before insert or update on public.payments
for each row execute function public.finance_validate_payment_sale_link();

revoke all on function public.finance_validate_payment_sale_link()
    from public, anon, authenticated;

create or replace function public.products_authenticated_profile_id()
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
    v_profile_id uuid;
begin
    select b.id
      into v_profile_id
      from public.barbershops b
     where b.user_id = (select auth.uid());

    if v_profile_id is null then
        raise exception 'BARBERSHOP_NOT_FOUND' using errcode = 'P0002';
    end if;

    return v_profile_id;
end;
$function$;

revoke all on function public.products_authenticated_profile_id()
    from public, anon, authenticated;

-- Read model with stock derived from the ledger in one database round trip.
create or replace function public.products_list_catalog()
returns table (
    id uuid,
    name text,
    description text,
    price numeric(12,2),
    cost numeric(12,2),
    sku text,
    is_active boolean,
    low_stock_threshold integer,
    stock integer,
    created_at timestamptz,
    updated_at timestamptz
)
language sql
security definer
stable
set search_path = ''
as $function$
    select p.id,
           p.name,
           p.description,
           p.price,
           p.cost,
           p.sku,
           p.is_active,
           p.low_stock_threshold,
           coalesce(sum(m.direction * m.quantity), 0)::integer as stock,
           p.created_at,
           p.updated_at
      from public.products p
      left join public.inventory_movements m
        on m.profile_id = p.profile_id
       and m.product_id = p.id
     where p.profile_id = public.products_authenticated_profile_id()
     group by p.id
     order by p.name
$function$;

create or replace function public.products_create_product(
    p_name text,
    p_description text,
    p_price numeric,
    p_cost numeric,
    p_sku text,
    p_low_stock_threshold integer
)
returns public.products
language plpgsql
security definer
set search_path = ''
as $function$
declare
    v_profile_id uuid := public.products_authenticated_profile_id();
    v_sku text := nullif(upper(btrim(p_sku)), '');
    v_product public.products;
begin
    if p_name is null or length(btrim(p_name)) = 0 or length(p_name) > 120 then
        raise exception 'Informe o nome do produto.' using errcode = '22023';
    end if;
    if p_price is null or p_price <= 0 then
        raise exception 'Informe um preço maior que zero.' using errcode = '22023';
    end if;
    if p_cost is not null and p_cost < 0 then
        raise exception 'O custo não pode ser negativo.' using errcode = '22023';
    end if;
    if v_sku is not null and length(v_sku) > 64 then
        raise exception 'SKU muito longo.' using errcode = '22023';
    end if;
    if p_low_stock_threshold is not null and p_low_stock_threshold < 0 then
        raise exception 'Limite de estoque baixo inválido.' using errcode = '22023';
    end if;

    insert into public.products (
        profile_id, name, description, price, cost, sku, low_stock_threshold
    ) values (
        v_profile_id, btrim(p_name), nullif(btrim(p_description), ''), p_price,
        p_cost, v_sku, p_low_stock_threshold
    )
    returning * into v_product;

    return v_product;
end;
$function$;

create or replace function public.products_update_product(
    p_id uuid,
    p_name text,
    p_description text,
    p_price numeric,
    p_cost numeric,
    p_sku text,
    p_low_stock_threshold integer
)
returns public.products
language plpgsql
security definer
set search_path = ''
as $function$
declare
    v_profile_id uuid := public.products_authenticated_profile_id();
    v_sku text := nullif(upper(btrim(p_sku)), '');
    v_product public.products;
begin
    if p_name is null or length(btrim(p_name)) = 0 or length(p_name) > 120 then
        raise exception 'Informe o nome do produto.' using errcode = '22023';
    end if;
    if p_price is null or p_price <= 0 then
        raise exception 'Informe um preço maior que zero.' using errcode = '22023';
    end if;
    if p_cost is not null and p_cost < 0 then
        raise exception 'O custo não pode ser negativo.' using errcode = '22023';
    end if;
    if v_sku is not null and length(v_sku) > 64 then
        raise exception 'SKU muito longo.' using errcode = '22023';
    end if;
    if p_low_stock_threshold is not null and p_low_stock_threshold < 0 then
        raise exception 'Limite de estoque baixo inválido.' using errcode = '22023';
    end if;

    update public.products p
       set name = btrim(p_name),
           description = nullif(btrim(p_description), ''),
           price = p_price,
           cost = p_cost,
           sku = v_sku,
           low_stock_threshold = p_low_stock_threshold
     where p.id = p_id
       and p.profile_id = v_profile_id
    returning p.* into v_product;

    if v_product.id is null then
        raise exception 'PRODUCT_NOT_FOUND' using errcode = 'P0002';
    end if;

    return v_product;
end;
$function$;

create or replace function public.products_set_active(p_id uuid, p_is_active boolean)
returns public.products
language plpgsql
security definer
set search_path = ''
as $function$
declare
    v_profile_id uuid := public.products_authenticated_profile_id();
    v_product public.products;
begin
    update public.products p
       set is_active = p_is_active
     where p.id = p_id
       and p.profile_id = v_profile_id
    returning p.* into v_product;

    if v_product.id is null then
        raise exception 'PRODUCT_NOT_FOUND' using errcode = 'P0002';
    end if;

    return v_product;
end;
$function$;

create or replace function public.products_delete_product(p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
    v_profile_id uuid := public.products_authenticated_profile_id();
    v_deleted_id uuid;
begin
    delete from public.products
     where id = p_id
       and profile_id = v_profile_id
    returning id into v_deleted_id;

    if v_deleted_id is null then
        raise exception 'PRODUCT_NOT_FOUND' using errcode = 'P0002';
    end if;

    return v_deleted_id;
end;
$function$;

create or replace function public.products_record_movement(
    p_product_id uuid,
    p_movement_type text,
    p_quantity integer,
    p_direction smallint,
    p_reason text,
    p_note text
)
returns public.inventory_movements
language plpgsql
security definer
set search_path = ''
as $function$
declare
    v_profile_id uuid := public.products_authenticated_profile_id();
    v_direction smallint;
    v_product_id uuid;
    v_stock integer;
    v_movement public.inventory_movements;
begin
    if p_movement_type not in ('entry', 'adjustment') then
        raise exception 'Tipo de movimentação inválido.' using errcode = '22023';
    end if;
    if p_quantity is null or p_quantity <= 0 then
        raise exception 'A quantidade deve ser positiva.' using errcode = '22023';
    end if;

    if p_movement_type = 'entry' then
        v_direction := 1;
    else
        if p_direction not in (-1, 1) then
            raise exception 'Direção de ajuste inválida.' using errcode = '22023';
        end if;
        if p_reason is null or length(btrim(p_reason)) = 0 then
            raise exception 'Ajuste de estoque exige motivo.' using errcode = '22023';
        end if;
        v_direction := p_direction;
    end if;

    select p.id
      into v_product_id
      from public.products p
     where p.id = p_product_id
       and p.profile_id = v_profile_id
     for update;

    if v_product_id is null then
        raise exception 'PRODUCT_NOT_FOUND' using errcode = 'P0002';
    end if;

    if v_direction = -1 then
        select coalesce(sum(m.direction * m.quantity), 0)::integer
          into v_stock
          from public.inventory_movements m
         where m.profile_id = v_profile_id
           and m.product_id = v_product_id;

        if v_stock < p_quantity then
            raise exception 'ESTOQUE_INSUFICIENTE' using errcode = '22023';
        end if;
    end if;

    insert into public.inventory_movements (
        profile_id, product_id, movement_type, direction, quantity,
        reason, note, created_by
    ) values (
        v_profile_id, v_product_id, p_movement_type, v_direction, p_quantity,
        nullif(btrim(p_reason), ''), nullif(btrim(p_note), ''), auth.uid()
    )
    returning * into v_movement;

    return v_movement;
end;
$function$;

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
    if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
        raise exception 'SALE_ITEMS_INVALID' using errcode = '22023';
    end if;

    if p_idempotency_key is not null then
        select s.id, p.id
          into v_sale.id, v_payment_id
          from public.sales s
          left join public.payments p on p.sale_id = s.id
         where s.profile_id = v_profile_id
           and s.idempotency_key = p_idempotency_key
         limit 1;

        if v_sale.id is not null then
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
         where coalesce((
                   select sum(m.direction * m.quantity)
                     from public.inventory_movements m
                    where m.profile_id = v_profile_id
                      and m.product_id = i.product_id
               ), 0)::integer < i.quantity
    ) then
        raise exception 'ESTOQUE_INSUFICIENTE' using errcode = '22023';
    end if;

    select coalesce(sum(round(i.unit_price * i.quantity, 2)), 0)
      into v_total
      from pg_temp.naval_sale_items_input i;

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

create or replace function public.products_refund_sale(
    p_sale_id uuid,
    p_refunded_at timestamptz,
    p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
    v_profile_id uuid := public.products_authenticated_profile_id();
    v_sale public.sales;
    v_payment public.payments;
    v_refund public.payment_refunds;
    v_refunded_amount numeric(12,2);
    v_financially_refunded boolean := false;
    v_restored integer;
    v_result jsonb;
begin
    if p_reason is null or length(btrim(p_reason)) = 0 then
        raise exception 'Informe o motivo da devolução.' using errcode = '22023';
    end if;

    select s.*
      into v_sale
      from public.sales s
     where s.id = p_sale_id
       and s.profile_id = v_profile_id
       for update;

    if v_sale.id is null then
        raise exception 'PRODUCT_SALE_NOT_FOUND' using errcode = 'P0002';
    end if;

    select p.*
      into v_payment
      from public.payments p
     where p.sale_id = v_sale.id
       and p.profile_id = v_profile_id
       for update;

    if v_payment.id is null then
        raise exception 'PRODUCT_SALE_NOT_FOUND' using errcode = 'P0002';
    end if;

    select coalesce(sum(r.amount), 0), max(r.id)
      into v_refunded_amount, v_refund.id
      from public.payment_refunds r
     where r.payment_id = v_payment.id
       and r.profile_id = v_profile_id;

    if v_refunded_amount > v_payment.amount then
        raise exception 'REFUND_INVALID' using errcode = '22023';
    end if;

    if v_refunded_amount = v_payment.amount then
        select r.*
          into v_refund
          from public.payment_refunds r
         where r.payment_id = v_payment.id
           and r.profile_id = v_profile_id
         order by r.refunded_at desc, r.created_at desc
         limit 1;
    elsif v_refunded_amount > 0 then
        raise exception 'REFUND_INVALID' using errcode = '22023';
    else
        insert into public.payment_refunds (
            profile_id, payment_id, amount, refunded_at, reason
        ) values (
            v_profile_id, v_payment.id, v_payment.amount, p_refunded_at,
            btrim(p_reason)
        )
        returning * into v_refund;

        v_financially_refunded := true;
    end if;

    if exists (
        select 1
          from public.inventory_movements m
         where m.sale_id = v_sale.id
           and m.profile_id = v_profile_id
           and m.movement_type = 'return'
    ) then
        raise exception 'SALE_ALREADY_RETURNED' using errcode = '22023';
    end if;

    with restored as (
        insert into public.inventory_movements (
            profile_id, product_id, movement_type, direction, quantity,
            sale_id, refund_id, created_by, reason
        )
        select v_profile_id, si.product_id, 'return', 1, si.quantity,
               v_sale.id, v_refund.id, auth.uid(), btrim(p_reason)
          from public.sale_items si
         where si.sale_id = v_sale.id
           and si.profile_id = v_profile_id
        returning quantity
    )
    select coalesce(sum(quantity), 0)::integer into v_restored from restored;

    update public.sales s
       set status = 'refunded'
     where s.id = v_sale.id
       and s.profile_id = v_profile_id
    returning s.* into v_sale;

    select jsonb_build_object(
        'refund', to_jsonb(v_refund),
        'sale', to_jsonb(v_sale),
        'restoredQuantity', v_restored,
        'financiallyRefunded', v_financially_refunded
    ) into v_result;

    return v_result;
end;
$function$;

revoke all on function public.products_list_catalog()
    from public, anon, authenticated;

revoke all on function public.products_create_product(text, text, numeric, numeric, text, integer)
    from public, anon, authenticated;
revoke all on function public.products_update_product(uuid, text, text, numeric, numeric, text, integer)
    from public, anon, authenticated;
revoke all on function public.products_set_active(uuid, boolean)
    from public, anon, authenticated;
revoke all on function public.products_delete_product(uuid)
    from public, anon, authenticated;
revoke all on function public.products_record_movement(uuid, text, integer, smallint, text, text)
    from public, anon, authenticated;
revoke all on function public.products_create_sale(jsonb, text, timestamptz, text, text)
    from public, anon, authenticated;
revoke all on function public.products_refund_sale(uuid, timestamptz, text)
    from public, anon, authenticated;

grant execute on function public.products_list_catalog()
    to authenticated;
grant execute on function public.products_create_product(text, text, numeric, numeric, text, integer)
    to authenticated;
grant execute on function public.products_update_product(uuid, text, text, numeric, numeric, text, integer)
    to authenticated;
grant execute on function public.products_set_active(uuid, boolean)
    to authenticated;
grant execute on function public.products_delete_product(uuid)
    to authenticated;
grant execute on function public.products_record_movement(uuid, text, integer, smallint, text, text)
    to authenticated;
grant execute on function public.products_create_sale(jsonb, text, timestamptz, text, text)
    to authenticated;
grant execute on function public.products_refund_sale(uuid, timestamptz, text)
    to authenticated;
