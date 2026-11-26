-- RLS integration tests for NAVAL. Runs against a local throwaway PostgreSQL
-- with all repository migrations applied. No production data is touched.
\set ON_ERROR_STOP on

begin;

create schema if not exists rls_test;
grant usage on schema rls_test to anon, authenticated;

create table rls_test.ctx (test_date date primary key);
insert into rls_test.ctx values (current_date + 5);
grant select on rls_test.ctx to anon, authenticated;

create or replace function rls_test.actor(p_user uuid)
returns void language sql as $$
    select set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true)
$$;

create or replace function rls_test.expect_visible(
    p_label text, p_table regclass, p_user uuid, p_expected bigint
)
returns void language plpgsql as $$
declare
    v_count bigint;
begin
    perform rls_test.actor(p_user);
    execute format('select count(*) from %s', p_table::text) into v_count;
    if v_count <> p_expected then
        raise exception 'FALHOU %: esperava % linha(s), vi %', p_label, p_expected, v_count;
    end if;
    raise notice 'OK % (%)', p_label, v_count;
end;
$$;

create or replace function rls_test.expect_blocked(
    p_label text, p_sql text, p_user uuid, p_expected_state text default '42501'
)
returns void language plpgsql as $$
declare
    v_blocked boolean := false;
    v_state text;
    v_message text;
begin
    perform rls_test.actor(p_user);
    begin
        execute p_sql;
    exception when others then
        v_blocked := true;
        v_state := sqlstate;
        v_message := sqlerrm;
    end;
    if not v_blocked then
        raise exception 'FALHOU %: operação permitida', p_label;
    end if;
    if p_expected_state <> 'ANY' and v_state <> p_expected_state then
        raise exception 'FALHOU %: esperava SQLSTATE %, vi % (%)', p_label, p_expected_state, v_state, v_message;
    end if;
    raise notice 'OK % (bloqueado: %)', p_label, v_state;
end;
$$;

create or replace function rls_test.expect_untouched(
    p_label text, p_sql text, p_user uuid
)
returns void language plpgsql as $$
declare
    v_affected bigint;
begin
    perform rls_test.actor(p_user);
    execute p_sql;
    get diagnostics v_affected = row_count;
    if v_affected <> 0 then
        raise exception 'FALHOU %: afetou % linha(s), esperava 0', p_label, v_affected;
    end if;
    raise notice 'OK % (0 linhas)', p_label;
end;
$$;

-- ---------------------------------------------------------------------------
-- Fabricated data (superuser creates rows in both tenants).
-- ---------------------------------------------------------------------------

insert into auth.users (id, email) values
    ('11111111-1111-4111-8111-111111111111', 'owner-a@example.test'),
    ('22222222-2222-4222-8222-222222222222', 'owner-b@example.test');

insert into public.barbershops
    (id, user_id, barber_name, name, slug, phone, sells_products)
values
    ('aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
     'Ana', 'Naval A', 'naval-a', '+55 85 99999-1234', true),
    ('bbbbbbbb-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222',
     'Bruno', 'Naval B', 'naval-b', '+55 85 98888-4321', true);

insert into public.services (id, profile_id, name, price, duration) values
    ('cccccccc-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'Corte A', 50, 30),
    ('cccccccc-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000002', 'Corte B', 60, 30),
    ('cccccccc-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000001', 'Extra A', 70, 30);

insert into public.barbershop_working_hours
    (profile_id, day_of_week, period_index, opens_at, closes_at)
select p.id, d.day_of_week, 0, '08:00'::time, '18:00'::time
  from public.barbershops p
 cross join generate_series(0, 6) as d(day_of_week);

insert into public.customers (id, profile_id, name, phone) values
    ('eeeeeeee-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'Cliente A', '+55 85 99999-1234'),
    ('eeeeeeee-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000002', 'Cliente B', '+55 85 98888-4321');

insert into public.appointments
    (id, profile_id, service_id, customer_name, customer_phone, starts_at, ends_at, status)
select 'ffffffff-0000-4000-8000-000000000001'::uuid,
       'aaaaaaaa-0000-4000-8000-000000000001'::uuid,
       'cccccccc-0000-4000-8000-000000000001'::uuid,
       'Cliente A', '+55 85 99999-1234',
       (c.test_date + time '13:00') at time zone 'America/Fortaleza',
       (c.test_date + time '13:30') at time zone 'America/Fortaleza',
       'confirmed'
  from rls_test.ctx c
union all
select 'ffffffff-0000-4000-8000-000000000002'::uuid,
       'bbbbbbbb-0000-4000-8000-000000000002'::uuid,
       'cccccccc-0000-4000-8000-000000000002'::uuid,
       'Cliente B', '+55 85 98888-4321',
       (c.test_date + time '14:00') at time zone 'America/Fortaleza',
       (c.test_date + time '14:30') at time zone 'America/Fortaleza',
       'confirmed'
  from rls_test.ctx c;

insert into public.expense_categories (id, profile_id, name) values
    ('99999999-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'Material A'),
    ('99999999-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000002', 'Material B');

insert into public.expenses
    (id, profile_id, category_id, description, amount, spent_at, source_type)
values
    ('88888888-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
     '99999999-0000-4000-8000-000000000001', 'Papelaria A', 20, now(), 'manual'),
    ('88888888-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000002',
     '99999999-0000-4000-8000-000000000002', 'Papelaria B', 30, now(), 'manual');

insert into public.payments
    (id, profile_id, appointment_id, amount, paid_at, method, source_type)
values
    ('77777777-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
     'ffffffff-0000-4000-8000-000000000001', 100, now(), 'pix', 'manual'),
    ('77777777-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000002',
     'ffffffff-0000-4000-8000-000000000002', 200, now(), 'pix', 'manual');

insert into public.payment_refunds
    (id, profile_id, payment_id, amount, refunded_at, reason)
values
    ('66666666-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
     '77777777-0000-4000-8000-000000000001', 10, now(), 'cancelamento A'),
    ('66666666-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000002',
     '77777777-0000-4000-8000-000000000002', 20, now(), 'cancelamento B');

insert into public.products (id, profile_id, name, price, cost, sku) values
    ('dddddddd-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'Shampoo A', 50, 20, 'A-1'),
    ('dddddddd-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000002', 'Shampoo B', 60, 25, 'B-1');

insert into public.sales
    (id, profile_id, created_by, sold_at, payment_method, total_amount)
values
    ('55555555-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
     '11111111-1111-4111-8111-111111111111', now(), 'pix', 100),
    ('55555555-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000002',
     '22222222-2222-4222-8222-222222222222', now(), 'pix', 120);

insert into public.sale_items (profile_id, sale_id, product_id, quantity, unit_price, unit_cost) values
    ('aaaaaaaa-0000-4000-8000-000000000001', '55555555-0000-4000-8000-000000000001',
     'dddddddd-0000-4000-8000-000000000001', 2, 50, 20),
    ('bbbbbbbb-0000-4000-8000-000000000002', '55555555-0000-4000-8000-000000000002',
     'dddddddd-0000-4000-8000-000000000002', 2, 60, 25);

insert into public.inventory_movements
    (id, profile_id, product_id, movement_type, direction, quantity, reason, created_by)
values
    ('44444444-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
     'dddddddd-0000-4000-8000-000000000001', 'entry', 1, 10, 'entrada A', '11111111-1111-4111-8111-111111111111'),
    ('44444444-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000002',
     'dddddddd-0000-4000-8000-000000000002', 'entry', 1, 10, 'entrada B', '22222222-2222-4222-8222-222222222222');

-- ---------------------------------------------------------------------------
-- SELECT policies: each tenant sees only its own rows; anon sees none except
-- the explicit public policies (services and working hours).
-- ---------------------------------------------------------------------------

set local role authenticated;

select rls_test.expect_visible('barbershops / A', 'public.barbershops', '11111111-1111-4111-8111-111111111111', 1);
select rls_test.expect_visible('barbershops / B', 'public.barbershops', '22222222-2222-4222-8222-222222222222', 1);
select rls_test.expect_visible('services / A', 'public.services', '11111111-1111-4111-8111-111111111111', 2);
select rls_test.expect_visible('services / B', 'public.services', '22222222-2222-4222-8222-222222222222', 1);
-- Public read policy also covers authenticated users: working hours are
-- intentionally visible to every caller for the booking page.
select rls_test.expect_visible('working hours / A (public)', 'public.barbershop_working_hours', '11111111-1111-4111-8111-111111111111', 14);
select rls_test.expect_visible('working hours / B (public)', 'public.barbershop_working_hours', '22222222-2222-4222-8222-222222222222', 14);
select rls_test.expect_visible('customers / A', 'public.customers', '11111111-1111-4111-8111-111111111111', 1);
select rls_test.expect_visible('customers / B', 'public.customers', '22222222-2222-4222-8222-222222222222', 1);
select rls_test.expect_visible('appointments / A', 'public.appointments', '11111111-1111-4111-8111-111111111111', 1);
select rls_test.expect_visible('appointments / B', 'public.appointments', '22222222-2222-4222-8222-222222222222', 1);
select rls_test.expect_visible('expense categories / A', 'public.expense_categories', '11111111-1111-4111-8111-111111111111', 1);
select rls_test.expect_visible('expense categories / B', 'public.expense_categories', '22222222-2222-4222-8222-222222222222', 1);
select rls_test.expect_visible('expenses / A', 'public.expenses', '11111111-1111-4111-8111-111111111111', 1);
select rls_test.expect_visible('expenses / B', 'public.expenses', '22222222-2222-4222-8222-222222222222', 1);
select rls_test.expect_visible('payments / A', 'public.payments', '11111111-1111-4111-8111-111111111111', 1);
select rls_test.expect_visible('payments / B', 'public.payments', '22222222-2222-4222-8222-222222222222', 1);
select rls_test.expect_visible('refunds / A', 'public.payment_refunds', '11111111-1111-4111-8111-111111111111', 1);
select rls_test.expect_visible('refunds / B', 'public.payment_refunds', '22222222-2222-4222-8222-222222222222', 1);
select rls_test.expect_visible('products / A', 'public.products', '11111111-1111-4111-8111-111111111111', 1);
select rls_test.expect_visible('products / B', 'public.products', '22222222-2222-4222-8222-222222222222', 1);
select rls_test.expect_visible('sales / A', 'public.sales', '11111111-1111-4111-8111-111111111111', 1);
select rls_test.expect_visible('sales / B', 'public.sales', '22222222-2222-4222-8222-222222222222', 1);
select rls_test.expect_visible('sale items / A', 'public.sale_items', '11111111-1111-4111-8111-111111111111', 1);
select rls_test.expect_visible('sale items / B', 'public.sale_items', '22222222-2222-4222-8222-222222222222', 1);
select rls_test.expect_visible('movements / A', 'public.inventory_movements', '11111111-1111-4111-8111-111111111111', 1);
select rls_test.expect_visible('movements / B', 'public.inventory_movements', '22222222-2222-4222-8222-222222222222', 1);

-- ---------------------------------------------------------------------------
-- INSERT policies with check: a client cannot attribute a row to another shop.
-- ---------------------------------------------------------------------------

select rls_test.expect_blocked(
    'barbershops insert / user_id spoofed',
    $$insert into public.barbershops (user_id, barber_name, name, slug, phone)
      values ('22222222-2222-4222-8222-222222222222', 'X', 'X', 'spoof-x', '99999999999')$$,
    '11111111-1111-4111-8111-111111111111', '42501');

select rls_test.expect_blocked(
    'services insert / other tenant',
    $$insert into public.services (profile_id, name, price, duration)
      values ('bbbbbbbb-0000-4000-8000-000000000002', 'Invasor', 10, 30)$$,
    '11111111-1111-4111-8111-111111111111', '42501');

select rls_test.expect_blocked(
    'working hours insert / other tenant',
    $$insert into public.barbershop_working_hours (profile_id, day_of_week, opens_at, closes_at)
      values ('bbbbbbbb-0000-4000-8000-000000000002', 2, '08:00', '12:00')$$,
    '11111111-1111-4111-8111-111111111111', '42501');

select rls_test.expect_blocked(
    'customers insert / other tenant',
    $$insert into public.customers (profile_id, name, phone)
      values ('bbbbbbbb-0000-4000-8000-000000000002', 'Invasor', '+55 85 97777-1234')$$,
    '11111111-1111-4111-8111-111111111111', '42501');

select rls_test.expect_blocked(
    'appointments insert / other tenant',
    $$insert into public.appointments
        (profile_id, service_id, customer_name, customer_phone, starts_at, ends_at, status)
      values ('bbbbbbbb-0000-4000-8000-000000000002',
              'cccccccc-0000-4000-8000-000000000002', 'Invasor', '+55 85 96666-1234',
              '2030-06-11T13:00:00Z', '2030-06-11T13:30:00Z', 'confirmed')$$,
    '11111111-1111-4111-8111-111111111111', '42501');

select rls_test.expect_blocked(
    'expense categories insert / other tenant',
    $$insert into public.expense_categories (profile_id, name)
      values ('bbbbbbbb-0000-4000-8000-000000000002', 'Invasor')$$,
    '11111111-1111-4111-8111-111111111111', '42501');

select rls_test.expect_blocked(
    'expenses insert / other tenant',
    $$insert into public.expenses (profile_id, description, amount, spent_at)
      values ('bbbbbbbb-0000-4000-8000-000000000002', 'Invasor', 10, now())$$,
    '11111111-1111-4111-8111-111111111111', '42501');

select rls_test.expect_blocked(
    'payments insert / other tenant',
    $$insert into public.payments (profile_id, amount, paid_at, method)
      values ('bbbbbbbb-0000-4000-8000-000000000002', 10, now(), 'pix')$$,
    '11111111-1111-4111-8111-111111111111', '42501');

-- The BEFORE trigger reads payments under RLS, so actor A cannot even see
-- payment B; the insert is rejected (23503) before the refunds WITH CHECK.
-- This is defense in depth, not a gap in the refunds policy.
select rls_test.expect_blocked(
    'refunds insert / other tenant (RLS no trigger)',
    $$insert into public.payment_refunds (profile_id, payment_id, amount, refunded_at, reason)
      values ('bbbbbbbb-0000-4000-8000-000000000002',
              '77777777-0000-4000-8000-000000000002', 5, now(), 'invasor')$$,
    '11111111-1111-4111-8111-111111111111', 'ANY');

do $$
declare v_before bigint; v_after bigint;
begin
    perform rls_test.actor('11111111-1111-4111-8111-111111111111');
    select count(*) into v_before from public.payment_refunds;
    insert into public.payment_refunds (profile_id, payment_id, amount, refunded_at, reason)
      values ('aaaaaaaa-0000-4000-8000-000000000001',
              '77777777-0000-4000-8000-000000000001', 5, now(), 'estorno próprio');
    select count(*) into v_after from public.payment_refunds;
    if v_after <> v_before + 1 then
        raise exception 'FALHOU estorno próprio: % -> %', v_before, v_after;
    end if;
    raise notice 'OK estorno próprio permitido (RLS WITH CHECK)';
end $$;

-- ---------------------------------------------------------------------------
-- UPDATE/DELETE policies: cross-tenant writes silently affect zero rows.
-- ---------------------------------------------------------------------------

select rls_test.expect_untouched(
    'barbershops update / other tenant',
    $$update public.barbershops set name = 'Hackeado' where id = 'bbbbbbbb-0000-4000-8000-000000000002'$$,
    '11111111-1111-4111-8111-111111111111');

select rls_test.expect_untouched(
    'services update / other tenant',
    $$update public.services set name = 'Hackeado' where id = 'cccccccc-0000-4000-8000-000000000002'$$,
    '11111111-1111-4111-8111-111111111111');

select rls_test.expect_untouched(
    'services delete / other tenant',
    $$delete from public.services where id = 'cccccccc-0000-4000-8000-000000000002'$$,
    '11111111-1111-4111-8111-111111111111');

select rls_test.expect_untouched(
    'working hours update / other tenant',
    $$update public.barbershop_working_hours set opens_at = '00:01'
       where profile_id = 'bbbbbbbb-0000-4000-8000-000000000002'$$,
    '11111111-1111-4111-8111-111111111111');

select rls_test.expect_untouched(
    'customers update / other tenant',
    $$update public.customers set name = 'Hackeado' where id = 'eeeeeeee-0000-4000-8000-000000000002'$$,
    '11111111-1111-4111-8111-111111111111');

select rls_test.expect_untouched(
    'appointments update / other tenant',
    $$update public.appointments set status = 'cancelled' where id = 'ffffffff-0000-4000-8000-000000000002'$$,
    '11111111-1111-4111-8111-111111111111');

select rls_test.expect_untouched(
    'expense categories update / other tenant',
    $$update public.expense_categories set name = 'Hackeado' where id = '99999999-0000-4000-8000-000000000002'$$,
    '11111111-1111-4111-8111-111111111111');

select rls_test.expect_untouched(
    'expense categories delete / other tenant',
    $$delete from public.expense_categories where id = '99999999-0000-4000-8000-000000000002'$$,
    '11111111-1111-4111-8111-111111111111');

select rls_test.expect_untouched(
    'expenses update / other tenant',
    $$update public.expenses set amount = 1 where id = '88888888-0000-4000-8000-000000000002'$$,
    '11111111-1111-4111-8111-111111111111');

-- Own rows can be updated (positive control).
do $$
declare v_affected bigint;
begin
    perform rls_test.actor('11111111-1111-4111-8111-111111111111');
    update public.services set name = 'Corte A editado'
     where id = 'cccccccc-0000-4000-8000-000000000001';
    get diagnostics v_affected = row_count;
    if v_affected <> 1 then
        raise exception 'FALHOU update próprio: afetou % linha(s)', v_affected;
    end if;
    raise notice 'OK update próprio (1 linha)';
end $$;

-- Append-only finance tables: no UPDATE/DELETE grants even for own tenant.
select rls_test.expect_blocked(
    'payments update / own tenant (append-only)',
    $$update public.payments set amount = 1 where id = '77777777-0000-4000-8000-000000000001'$$,
    '11111111-1111-4111-8111-111111111111');

select rls_test.expect_blocked(
    'payments delete / own tenant (append-only)',
    $$delete from public.payments where id = '77777777-0000-4000-8000-000000000001'$$,
    '11111111-1111-4111-8111-111111111111');

select rls_test.expect_blocked(
    'refunds update / own tenant (append-only)',
    $$update public.payment_refunds set amount = 1 where id = '66666666-0000-4000-8000-000000000001'$$,
    '11111111-1111-4111-8111-111111111111');

-- Writes to stock/sales tables are RPC-only, never direct table grants.
select rls_test.expect_blocked(
    'products direct insert',
    $$insert into public.products (profile_id, name, price)
      values ('aaaaaaaa-0000-4000-8000-000000000001', 'Invasor', 10)$$,
    '11111111-1111-4111-8111-111111111111');

select rls_test.expect_blocked(
    'sales direct insert',
    $$insert into public.sales (profile_id, sold_at, payment_method, total_amount)
      values ('aaaaaaaa-0000-4000-8000-000000000001', now(), 'pix', 10)$$,
    '11111111-1111-4111-8111-111111111111');

select rls_test.expect_blocked(
    'inventory movements direct insert',
    $$insert into public.inventory_movements
        (profile_id, product_id, movement_type, direction, quantity, reason)
      values ('aaaaaaaa-0000-4000-8000-000000000001',
              'dddddddd-0000-4000-8000-000000000001', 'adjustment', 1, 1, 'invasor')$$,
    '11111111-1111-4111-8111-111111111111');

-- ---------------------------------------------------------------------------
-- SECURITY DEFINER RPCs derive the tenant from auth.uid(), never from arguments.
-- ---------------------------------------------------------------------------

select rls_test.actor('11111111-1111-4111-8111-111111111111');
do $$
declare v_count bigint;
begin
    select count(*) into v_count from public.products_list_catalog();
    if v_count <> 1 then raise exception 'FALHOU products_list_catalog: %, esperava 1', v_count; end if;
    raise notice 'OK products_list_catalog isolado (%)', v_count;
end $$;

select rls_test.expect_blocked(
    'products_create_sale / other tenant product',
    $$select public.products_create_sale(
        jsonb_build_array(jsonb_build_object(
          'productId', 'dddddddd-0000-4000-8000-000000000002', 'quantity', 1)),
        'pix', now(), null, null)$$,
    '11111111-1111-4111-8111-111111111111', 'ANY');

select rls_test.expect_blocked(
    'products_record_movement / other tenant product',
    $$select public.products_record_movement(
        'dddddddd-0000-4000-8000-000000000002', 'entry', 1, 1::smallint, 'compra', null::text)$$,
    '11111111-1111-4111-8111-111111111111', 'ANY');

select rls_test.expect_blocked(
    'products_refund_sale / other tenant sale',
    $$select public.products_refund_sale(
        '55555555-0000-4000-8000-000000000002', now(), 'invasor')$$,
    '11111111-1111-4111-8111-111111111111', 'ANY');

select rls_test.expect_blocked(
    'finance_period_totals / other tenant',
    $$select public.finance_period_totals(
        'bbbbbbbb-0000-4000-8000-000000000002', now() - interval '1 day', now() + interval '1 day')$$,
    '11111111-1111-4111-8111-111111111111', 'ANY');

select rls_test.expect_blocked(
    'products_finance_period_totals / other tenant',
    $$select public.products_finance_period_totals(
        'bbbbbbbb-0000-4000-8000-000000000002', now() - interval '1 day', now() + interval '1 day')$$,
    '11111111-1111-4111-8111-111111111111', 'ANY');

-- Idempotent replay returns the original sale instead of a uniqueness error.
select rls_test.actor('11111111-1111-4111-8111-111111111111');
do $$
declare v_first jsonb; v_second jsonb; v_key uuid := gen_random_uuid();
begin
    select public.products_create_sale(
        jsonb_build_array(jsonb_build_object(
          'productId', 'dddddddd-0000-4000-8000-000000000001', 'quantity', 1)),
        'pix', now(), v_key::text, null) into v_first;
    select public.products_create_sale(
        jsonb_build_array(jsonb_build_object(
          'productId', 'dddddddd-0000-4000-8000-000000000001', 'quantity', 1)),
        'pix', now(), v_key::text, null) into v_second;
    if (v_first -> 'sale' ->> 'id') is distinct from (v_second -> 'sale' ->> 'id') then
        raise exception 'FALHOU replay de idempotência: % != %', v_first, v_second;
    end if;
    raise notice 'OK replay de idempotência (%)', v_first -> 'sale' ->> 'id';
end $$;

-- ---------------------------------------------------------------------------
-- anon: public reads and public booking only.
-- ---------------------------------------------------------------------------

set local role anon;
select set_config('request.jwt.claim.sub', '', true);

select rls_test.expect_visible('anon services (public)', 'public.services', null::uuid, 3);
select rls_test.expect_visible('anon working hours (public)', 'public.barbershop_working_hours', null::uuid, 14);
select rls_test.expect_blocked('anon barbershops (sem SELECT)',
    $$select count(*) from public.barbershops$$, null::uuid, '42501');
select rls_test.expect_blocked('anon appointments (sem SELECT)',
    $$select count(*) from public.appointments$$, null::uuid, '42501');
select rls_test.expect_blocked('anon customers (sem SELECT)',
    $$select count(*) from public.customers$$, null::uuid, '42501');
select rls_test.expect_blocked('anon products (sem SELECT)',
    $$select count(*) from public.products$$, null::uuid, '42501');
select rls_test.expect_blocked('anon payments (sem SELECT)',
    $$select count(*) from public.payments$$, null::uuid, '42501');
select rls_test.expect_blocked('anon sales (sem SELECT)',
    $$select count(*) from public.sales$$, null::uuid, '42501');

select rls_test.expect_blocked(
    'anon products_list_catalog',
    $$select public.products_list_catalog()$$, null::uuid);

select rls_test.expect_blocked(
    'anon finance_period_totals',
    $$select public.finance_period_totals(
        'aaaaaaaa-0000-4000-8000-000000000001', now() - interval '1 day', now() + interval '1 day')$$,
    null::uuid);

do $$
declare v_id uuid;
begin
    select id into v_id from public.get_public_barbershop('naval-b');
    if v_id is distinct from 'bbbbbbbb-0000-4000-8000-000000000002'::uuid then
        raise exception 'FALHOU get_public_barbershop: %', v_id;
    end if;
    raise notice 'OK get_public_barbershop por slug (%)', v_id;
end $$;

do $$
declare v_count bigint; v_date text;
begin
    select test_date::text into v_date from rls_test.ctx;
    select count(*) into v_count
      from public.get_public_busy_times('naval-b', v_date);
    if v_count <> 1 then raise exception 'FALHOU get_public_busy_times: %, esperava 1', v_count; end if;
    raise notice 'OK get_public_busy_times por slug (%)', v_count;
end $$;

-- Public INSERT: allowed for a valid future slot, rejected outside it.
insert into public.appointments
    (profile_id, service_id, customer_name, customer_phone, starts_at, ends_at, status)
select 'aaaaaaaa-0000-4000-8000-000000000001'::uuid,
       'cccccccc-0000-4000-8000-000000000001'::uuid,
       'Público', '+55 85 95555-1234',
       (c.test_date + interval '1 day' + time '13:00') at time zone 'America/Fortaleza',
       (c.test_date + interval '1 day' + time '13:30') at time zone 'America/Fortaleza',
       'confirmed'
  from rls_test.ctx c;
select 'OK anon pode criar agendamento publico' as resultado;

select rls_test.expect_blocked(
    'anon appointment insert / past date',
    $$insert into public.appointments
        (profile_id, service_id, customer_name, customer_phone, starts_at, ends_at, status)
      values ('aaaaaaaa-0000-4000-8000-000000000001',
              'cccccccc-0000-4000-8000-000000000001', 'Público', '+55 85 94444-1234',
              '2020-01-01T13:00:00Z', '2020-01-01T13:30:00Z', 'confirmed')$$,
    null::uuid, '42501');

set local role postgres;
-- Nothing is persisted: the whole suite is a transaction that is always
-- rolled back, so it can be rerun against the same local database.
rollback;

\echo 'TODOS OS TESTES DE RLS PASSARAM'
