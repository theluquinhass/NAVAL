-- Products, inventory ledger and product sales.
-- This file is prepared only; it has NOT been applied to any database by the agent.
--
-- Stock is always derived from public.inventory_movements. There is no editable
-- stock column. Writes are performed by SECURITY DEFINER RPC functions in
-- 202611250011_product_sales.sql so that tenant checks, row locks and the
-- payment/stock/sale transaction happen together in PostgreSQL.
--
-- Validate with fabricated data in a development database:
--   - two owners can only read/write their own products and movements
--   - an inactive product cannot appear in a new sale
--   - a product with movements cannot be deleted
--   - an adjustment with a negative direction requires a reason

create table public.products (
    id uuid primary key default gen_random_uuid(),
    profile_id uuid not null
        references public.barbershops(id) on delete cascade,
    name text not null check (length(btrim(name)) > 0 and length(name) <= 120),
    description text,
    price numeric(12,2) not null check (price > 0),
    cost numeric(12,2) check (cost >= 0),
    sku text check (sku is null or (length(btrim(sku)) > 0 and length(sku) <= 64)),
    is_active boolean not null default true,
    low_stock_threshold integer check (low_stock_threshold >= 0),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint products_profile_id_id_key unique (profile_id, id),
    constraint products_profile_sku_key unique (profile_id, sku)
);

create index if not exists products_profile_active_name_idx
    on public.products (profile_id, is_active, name);

create table public.sales (
    id uuid primary key default gen_random_uuid(),
    profile_id uuid not null
        references public.barbershops(id) on delete cascade,
    created_by uuid references auth.users(id),
    sold_at timestamptz not null,
    payment_method text not null check (length(btrim(payment_method)) > 0 and length(payment_method) <= 50),
    status text not null default 'completed'
        check (status in ('completed', 'partially_refunded', 'refunded')),
    total_amount numeric(12,2) not null check (total_amount > 0),
    idempotency_key text,
    created_at timestamptz not null default now(),
    constraint sales_profile_id_id_key unique (profile_id, id),
    constraint sales_profile_idempotency_key_key unique (profile_id, idempotency_key)
);

create index if not exists sales_profile_sold_at_idx
    on public.sales (profile_id, sold_at);

create table public.sale_items (
    id uuid primary key default gen_random_uuid(),
    profile_id uuid not null
        references public.barbershops(id) on delete cascade,
    sale_id uuid not null,
    product_id uuid not null,
    quantity integer not null check (quantity > 0),
    unit_price numeric(12,2) not null check (unit_price > 0),
    unit_cost numeric(12,2) not null default 0 check (unit_cost >= 0),
    subtotal numeric(12,2) generated always as (quantity * unit_price) stored,
    constraint sale_items_profile_id_id_key unique (profile_id, id),
    constraint sale_items_sale_fkey foreign key (profile_id, sale_id)
        references public.sales(profile_id, id) on delete cascade,
    constraint sale_items_product_fkey foreign key (profile_id, product_id)
        references public.products(profile_id, id) on delete restrict
);

create index if not exists sale_items_sale_id_idx
    on public.sale_items (sale_id);

do $migration$
begin
    if not exists (
        select 1
          from pg_constraint
         where conname = 'payment_refunds_profile_id_id_key'
           and conrelid = 'public.payment_refunds'::regclass
    ) then
        alter table public.payment_refunds
            add constraint payment_refunds_profile_id_id_key unique (profile_id, id);
    end if;
end;
$migration$;

create table public.inventory_movements (
    id uuid primary key default gen_random_uuid(),
    profile_id uuid not null
        references public.barbershops(id) on delete cascade,
    product_id uuid not null,
    movement_type text not null
        check (movement_type in ('entry', 'sale', 'return', 'adjustment')),
    direction smallint not null check (direction in (-1, 1)),
    quantity integer not null check (quantity > 0),
    reason text,
    note text,
    sale_id uuid,
    refund_id uuid,
    corrected_movement_id uuid,
    created_by uuid references auth.users(id),
    created_at timestamptz not null default now(),
    constraint inventory_movements_profile_id_id_key unique (profile_id, id),
    constraint inventory_movements_product_fkey foreign key (profile_id, product_id)
        references public.products(profile_id, id) on delete restrict,
    constraint inventory_movements_sale_fkey foreign key (profile_id, sale_id)
        references public.sales(profile_id, id) on delete restrict,
    constraint inventory_movements_refund_fkey foreign key (profile_id, refund_id)
        references public.payment_refunds(profile_id, id) on delete restrict,
    constraint inventory_movements_corrected_fkey foreign key (corrected_movement_id)
        references public.inventory_movements(id) on delete restrict
);

create index if not exists inventory_movements_product_created_at_idx
    on public.inventory_movements (product_id, created_at);

create or replace function public.products_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
    new.updated_at := pg_catalog.now();
    return new;
end;
$function$;

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
before update on public.products
for each row execute function public.products_set_updated_at();

create or replace function public.products_validate_movement()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
    if new.movement_type in ('entry', 'return') and new.direction <> 1 then
        raise exception 'Entrada e devolução devem somar ao estoque.'
            using errcode = '22023';
    end if;

    if new.movement_type = 'sale' and new.direction <> -1 then
        raise exception 'Baixa por venda deve subtrair do estoque.'
            using errcode = '22023';
    end if;

    if new.movement_type = 'adjustment' and (
        new.direction is null
        or new.direction not in (-1, 1)
        or new.reason is null
        or length(btrim(new.reason)) = 0
    ) then
        raise exception 'Ajuste de estoque exige direção e motivo.'
            using errcode = '22023';
    end if;

    return new;
end;
$function$;

drop trigger if exists inventory_movements_validate on public.inventory_movements;
create trigger inventory_movements_validate
before insert or update on public.inventory_movements
for each row execute function public.products_validate_movement();

create or replace function public.products_prevent_delete_with_history()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
    if exists (select 1 from public.inventory_movements where product_id = old.id)
       or exists (select 1 from public.sale_items where product_id = old.id) then
        raise exception 'Produto com histórico não pode ser excluído. Desative-o.'
            using errcode = '22023';
    end if;

    return old;
end;
$function$;

drop trigger if exists products_prevent_delete_with_history on public.products;
create trigger products_prevent_delete_with_history
before delete on public.products
for each row execute function public.products_prevent_delete_with_history();

revoke all on function public.products_set_updated_at()
    from public, anon, authenticated;
revoke all on function public.products_validate_movement()
    from public, anon, authenticated;
revoke all on function public.products_prevent_delete_with_history()
    from public, anon, authenticated;

alter table public.products enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.inventory_movements enable row level security;

revoke all on table public.products from public, anon, authenticated;
revoke all on table public.sales from public, anon, authenticated;
revoke all on table public.sale_items from public, anon, authenticated;
revoke all on table public.inventory_movements from public, anon, authenticated;

grant select on public.products to authenticated;
grant select on public.sales to authenticated;
grant select on public.sale_items to authenticated;
grant select on public.inventory_movements to authenticated;

drop policy if exists "Owners can read their products" on public.products;
create policy "Owners can read their products"
    on public.products for select to authenticated
    using (
        exists (
            select 1 from public.barbershops b
             where b.id = products.profile_id
               and b.user_id = (select auth.uid())
        )
    );

drop policy if exists "Owners can read their sales" on public.sales;
create policy "Owners can read their sales"
    on public.sales for select to authenticated
    using (
        exists (
            select 1 from public.barbershops b
             where b.id = sales.profile_id
               and b.user_id = (select auth.uid())
        )
    );

drop policy if exists "Owners can read their sale items" on public.sale_items;
create policy "Owners can read their sale items"
    on public.sale_items for select to authenticated
    using (
        exists (
            select 1 from public.barbershops b
             where b.id = sale_items.profile_id
               and b.user_id = (select auth.uid())
        )
    );

drop policy if exists "Owners can read their inventory movements" on public.inventory_movements;
create policy "Owners can read their inventory movements"
    on public.inventory_movements for select to authenticated
    using (
        exists (
            select 1 from public.barbershops b
             where b.id = inventory_movements.profile_id
               and b.user_id = (select auth.uid())
        )
    );
