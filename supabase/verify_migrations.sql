-- Read-only check of migration state.
--
-- This file never inserts, updates or deletes data.
--
-- Some Supabase projects (including the one validated for this repository) do
-- not have `supabase_migrations.schema_migrations`. The main query below
-- therefore compares the schema itself against exact markers left by each
-- migration. It works both when migration history exists and when it does not.
-- The history-based queries are kept commented at the end for projects that do
-- have that table.

with tables_ as (
    select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind in ('r', 'p')
),
columns_ as (
    select table_name, column_name
      from information_schema.columns
     where table_schema = 'public'
),
constraints_ as (
    select c.relname as tbl, con.conname, pg_get_constraintdef(con.oid) as def
      from pg_constraint con
      join pg_class c on c.oid = con.conrelid
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
),
indexes_ as (
    select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind = 'i'
),
policies_ as (
    select tablename, policyname
      from pg_policies
     where schemaname = 'public'
),
triggers_ as (
    select c.relname as tbl, t.tgname
      from pg_trigger t
      join pg_class c on c.oid = t.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and not t.tgisinternal
),
functions_ as (
    select p.proname,
           pg_get_function_identity_arguments(p.oid) as args,
           pg_get_functiondef(p.oid) as def
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in (
           'normalize_br_phone',
           'finance_validate_payment_link',
           'finance_validate_expense_link',
           'finance_validate_tenant_link',
           'replace_barbershop_working_hours',
           'products_record_movement',
           'products_create_product',
           'products_update_product',
           'products_delete_product',
           'products_set_active',
           'products_list_catalog',
           'products_create_sale',
           'products_refund_sale',
           'finance_period_totals',
           'products_finance_period_totals',
           'finance_validate_refund',
           'products_authenticated_profile_id',
           'get_public_busy_times'
       )
),
markers as (
    select
        -- 000000000000_baseline.sql
        (select count(*) from tables_
          where relname in ('barbershops', 'services')) = 2
            as m000000000000,

        -- 202611230001_scheduling.sql
        (select count(*) from policies_
          where tablename = 'appointments'
            and policyname in (
                'Owners can create confirmed appointments',
                'Public can create confirmed appointments'
            )) = 2
            as m202611230001,

        -- 202611240001_public_busy_times_by_slug.sql
        exists (
            select 1 from functions_
             where proname = 'get_public_busy_times'
               and args = 'p_slug text, p_date text'
        )
            as m202611240001,

        -- 202611250001_split_appointment_insert_policies.sql
        (select count(*) from policies_
          where tablename = 'appointments'
            and policyname in (
                'Owners can create confirmed appointments',
                'Public can create confirmed appointments'
            )) = 2
            as m202611250001,

        -- 202611250002_customers.sql
        (select count(*) from columns_
          where table_name = 'customers'
            and column_name = 'phone_normalized') = 1
        and exists (select 1 from functions_ where proname = 'normalize_br_phone')
        and (select count(*) from triggers_
              where tbl in ('customers', 'appointments')
                and tgname in ('customers_set_updated_at', 'appointments_attach_customer')) = 2
            as m202611250002,

        -- 202611250003_finance.sql
        (select count(*) from tables_
          where relname in (
              'expense_categories', 'expenses', 'payments', 'payment_refunds'
          )) = 4
            as m202611250003,

        -- 202611250004_performance_indexes.sql
        exists (select 1 from indexes_ where relname = 'barbershops_user_id_idx')
            as m202611250004,

        -- 202611250005_profile_slug_unique.sql
        exists (
            select 1 from constraints_
             where tbl = 'barbershops' and conname = 'barbershops_slug_key'
        )
            as m202611250005,

        -- 202611250006_barbershop_owner_update_policy.sql
        exists (
            select 1 from policies_
             where tablename = 'barbershops'
               and policyname = 'Owners can update their barbershop'
        )
            as m202611250006,

        -- 202611250007_finance_tenant_trigger_fix.sql
        exists (select 1 from functions_ where proname = 'finance_validate_payment_link')
        and exists (select 1 from functions_ where proname = 'finance_validate_expense_link')
        and not exists (select 1 from functions_ where proname = 'finance_validate_tenant_link')
        and (select count(*) from triggers_
              where tbl in ('payments', 'expenses')
                and tgname in ('payments_validate_tenant_link', 'expenses_validate_tenant_link')) = 2
            as m202611250007,

        -- 202611250008_barber_name.sql
        exists (
            select 1 from constraints_
             where tbl = 'barbershops' and conname = 'barbershops_barber_name_check'
        )
            as m202611250008,

        -- 202611250009_multiple_working_periods.sql
        exists (
            select 1 from columns_
             where table_name = 'barbershop_working_hours'
               and column_name = 'period_index'
        )
        and (select count(*) from constraints_
              where tbl = 'barbershop_working_hours'
                and conname in (
                    'barbershop_working_hours_profile_day_period_key',
                    'barbershop_working_hours_period_index_check',
                    'barbershop_working_hours_no_overlap_excl'
                )) = 3
        and exists (select 1 from functions_ where proname = 'replace_barbershop_working_hours')
            as m202611250009,

        -- 202611250010_products_inventory_sales.sql
        (select count(*) from tables_
          where relname in ('products', 'sales', 'sale_items', 'inventory_movements')) = 4
            as m202611250010,

        -- 202611250011_product_sales_functions.sql
        (select count(*) from columns_
          where table_name = 'payments'
            and column_name in ('source_type', 'sale_id')) = 2
        and (select count(*) from functions_
              where proname in (
                  'products_create_product',
                  'products_update_product',
                  'products_delete_product',
                  'products_set_active',
                  'products_list_catalog',
                  'products_create_sale',
                  'products_refund_sale'
              )) = 7
            as m202611250011,

        -- 202611250012_stock_entry_expenses.sql
        (select count(*) from columns_
          where table_name = 'expenses'
            and column_name in ('source_type', 'inventory_movement_id')) = 2
        and exists (
            select 1 from triggers_
             where tbl = 'expenses' and tgname = 'expenses_validate_stock_expense_link'
        )
        and exists (
            select 1 from functions_
             where proname = 'products_record_movement'
               and args like '%p_direction smallint%'
        )
            as m202611250012,

        -- 202611250013_barbershop_sells_products.sql
        exists (
            select 1 from columns_
             where table_name = 'barbershops' and column_name = 'sells_products'
        )
            as m202611250013,

        -- 202611250014_finance_safety.sql
        (select count(*) from columns_
          where column_name = 'idempotency_key'
            and table_name in ('payments', 'payment_refunds')) = 2
        and (select count(*) from functions_
              where proname in ('finance_period_totals', 'products_finance_period_totals')) = 2
        and exists (
            select 1 from functions_
             where proname = 'finance_validate_refund'
               and def ilike '%pg_advisory_xact_lock%'
               and def ilike '%product_sale%'
        )
            as m202611250014,

        -- 202611250015_product_safety.sql
        exists (
            select 1 from functions_
             where proname = 'products_authenticated_profile_id'
               and def ilike '%into strict%'
               and def ilike '%BARBERSHOP_AMBIGUOUS%'
        )
        and exists (
            select 1 from functions_
             where proname = 'products_create_sale'
               and def ilike '%pg_advisory_xact_lock%'
        )
        and exists (
            select 1 from constraints_
             where conname = 'inventory_movements_corrected_fkey'
        )
        and not exists (
            select 1 from constraints_ where conname = 'payments_sale_id_fkey'
        )
        and not exists (
            select 1 from functions_
             where proname = 'get_public_busy_times'
               and args like 'p_profile_id uuid%'
        )
            as m202611250015
),
expected(version, file_name, applied) as (
    select * from (values
        ('000000000000', '000000000000_baseline.sql', (select m000000000000 from markers)),
        ('202611230001', '202611230001_scheduling.sql', (select m202611230001 from markers)),
        ('202611240001', '202611240001_public_busy_times_by_slug.sql', (select m202611240001 from markers)),
        ('202611250001', '202611250001_split_appointment_insert_policies.sql', (select m202611250001 from markers)),
        ('202611250002', '202611250002_customers.sql', (select m202611250002 from markers)),
        ('202611250003', '202611250003_finance.sql', (select m202611250003 from markers)),
        ('202611250004', '202611250004_performance_indexes.sql', (select m202611250004 from markers)),
        ('202611250005', '202611250005_profile_slug_unique.sql', (select m202611250005 from markers)),
        ('202611250006', '202611250006_barbershop_owner_update_policy.sql', (select m202611250006 from markers)),
        ('202611250007', '202611250007_finance_tenant_trigger_fix.sql', (select m202611250007 from markers)),
        ('202611250008', '202611250008_barber_name.sql', (select m202611250008 from markers)),
        ('202611250009', '202611250009_multiple_working_periods.sql', (select m202611250009 from markers)),
        ('202611250010', '202611250010_products_inventory_sales.sql', (select m202611250010 from markers)),
        ('202611250011', '202611250011_product_sales_functions.sql', (select m202611250011 from markers)),
        ('202611250012', '202611250012_stock_entry_expenses.sql', (select m202611250012 from markers)),
        ('202611250013', '202611250013_barbershop_sells_products.sql', (select m202611250013 from markers)),
        ('202611250014', '202611250014_finance_safety.sql', (select m202611250014 from markers)),
        ('202611250015', '202611250015_product_safety.sql', (select m202611250015 from markers))
    ) as v(version, file_name, applied)
)
select
    version,
    file_name,
    case when applied then 'APLICADA' else 'PENDENTE' end as status
  from expected
 order by version;

-- Preflight for 202611250002_customers.sql: that migration is intentionally
-- fail-closed and compares exact constraint names, defaults and the generated
-- column expression. Run these read-only queries before applying it to a
-- database that was created outside this repository; if any value differs,
-- review the difference instead of forcing the migration.
--
-- select conname, pg_get_constraintdef(oid)
--   from pg_constraint
--  where conrelid = 'public.customers'::regclass
--    and conname in ('customers_name_check', 'customers_phone_check');
--
-- select column_name, column_default, generation_expression
--   from information_schema.columns
--  where table_schema = 'public' and table_name = 'customers'
--    and column_name in ('created_at', 'updated_at', 'phone_normalized');

-- Optional history-based checks. Uncomment only when
-- `supabase_migrations.schema_migrations` exists in the target database.
--
-- select e.version, e.file_name,
--        case when a.version is null then 'PENDENTE' else 'APLICADA' end as status,
--        a.applied_at
--   from expected e
--   left join supabase_migrations.schema_migrations a on a.version = e.version
--  order by e.version;
--
-- select version, applied_at
--   from supabase_migrations.schema_migrations
--  order by version;
--
-- select a.version, a.applied_at
--   from supabase_migrations.schema_migrations a
--   left join expected e on e.version = a.version
--  where e.version is null
--  order by a.version;
