-- Customer records and appointment association.
-- Keep transaction control out of this file; the Supabase migration runner
-- must apply each migration as one transaction.

create or replace function public.normalize_br_phone(p_phone text)
returns text
language plpgsql
immutable
parallel safe
set search_path = ''
as $function$
declare
    v_digits text;
begin
    if p_phone is null then
        return null;
    end if;

    v_digits := pg_catalog.regexp_replace(p_phone, '[^0-9]', '', 'g');

    if pg_catalog.length(v_digits) in (12, 13)
       and pg_catalog.left(v_digits, 2) = '55' then
        v_digits := pg_catalog.substr(v_digits, 3);
    end if;

    if pg_catalog.length(v_digits) not in (10, 11) then
        return null;
    end if;

    return v_digits;
end;
$function$;

create table if not exists public.customers (
    id uuid primary key default gen_random_uuid(),
    profile_id uuid not null
        references public.barbershops(id) on delete cascade,
    name text not null check (length(btrim(name)) > 0),
    phone text not null check (length(btrim(phone)) > 0),
    phone_normalized text generated always as (
        public.normalize_br_phone(phone)
    ) stored,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    unique (id, profile_id),
    unique (profile_id, phone_normalized)
);

-- CREATE TABLE IF NOT EXISTS does not validate an existing relation.
do $migration$
declare
    v_table oid := to_regclass('public.customers');
    v_id smallint;
    v_profile_id smallint;
    v_phone_normalized smallint;
    v_generated_expression text;
begin
    if v_table is null then
        raise exception 'public.customers não foi criada.';
    end if;

    if exists (
        select 1
          from (
              values
                  ('id', 'uuid', true, 'NEVER', 'gen_random_uuid()'),
                  ('profile_id', 'uuid', true, 'NEVER', null::text),
                  ('name', 'text', true, 'NEVER', null::text),
                  ('phone', 'text', true, 'NEVER', null::text),
                  ('phone_normalized', 'text', false, 'ALWAYS', null::text),
                  ('created_at', 'timestamp with time zone', true, 'NEVER', 'now()'),
                  ('updated_at', 'timestamp with time zone', true, 'NEVER', 'now()')
          ) expected(column_name, data_type, not_null, generated, column_default)
          left join information_schema.columns actual
            on actual.table_schema = 'public'
           and actual.table_name = 'customers'
           and actual.column_name = expected.column_name
         where actual.column_name is null
            or actual.data_type <> expected.data_type
            or (actual.is_nullable = 'NO') <> expected.not_null
            or actual.is_generated <> expected.generated
            or regexp_replace(
                   coalesce(actual.column_default, ''),
                   '[[:space:]]',
                   '',
                   'g'
               ) <> coalesce(expected.column_default, '')
    ) then
        raise exception
            'public.customers possui colunas, tipos, nulabilidade, geração ou defaults incompatíveis.';
    end if;

    if exists (
        select 1
          from information_schema.columns actual
         where actual.table_schema = 'public'
           and actual.table_name = 'customers'
           and actual.column_name not in (
               'id', 'profile_id', 'name', 'phone', 'phone_normalized',
               'created_at', 'updated_at'
           )
    ) then
        raise exception
            'public.customers possui colunas inesperadas. Revise a tabela antes da migration.';
    end if;

    select attnum into v_id
      from pg_attribute
     where attrelid = v_table and attname = 'id' and not attisdropped;
    select attnum into v_profile_id
      from pg_attribute
     where attrelid = v_table and attname = 'profile_id' and not attisdropped;
    select attnum into v_phone_normalized
      from pg_attribute
     where attrelid = v_table and attname = 'phone_normalized' and not attisdropped;

    select regexp_replace(pg_get_expr(d.adbin, d.adrelid), '[[:space:]" ]', '', 'g')
      into v_generated_expression
      from pg_attrdef d
     where d.adrelid = v_table
       and d.adnum = v_phone_normalized;

    if v_generated_expression not in (
        'normalize_br_phone(phone)',
        'public.normalize_br_phone(phone)'
    ) then
        raise exception
            'customers.phone_normalized deve ser gerada exatamente por normalize_br_phone(phone); expressão encontrada: %',
            coalesce(v_generated_expression, '<ausente>');
    end if;

    if not exists (
        select 1 from pg_constraint c
         where c.conrelid = v_table and c.contype = 'p'
           and c.conkey = array[v_id]::smallint[] and c.convalidated
    ) then
        raise exception 'public.customers precisa de PRIMARY KEY (id) validada.';
    end if;

    if not exists (
        select 1 from pg_constraint c
         where c.conrelid = v_table and c.contype = 'u'
           and c.conkey = array[v_id, v_profile_id]::smallint[]
           and c.convalidated
    ) then
        raise exception
            'public.customers precisa de UNIQUE (id, profile_id) validada para a FK composta.';
    end if;

    if not exists (
        select 1 from pg_constraint c
         where c.conrelid = v_table and c.contype = 'u'
           and c.conkey = array[v_profile_id, v_phone_normalized]::smallint[]
           and c.convalidated
    ) then
        raise exception
            'public.customers precisa de UNIQUE (profile_id, phone_normalized) validada.';
    end if;

    if not exists (
        select 1
          from pg_constraint c
         where c.conrelid = v_table
           and c.contype = 'f'
           and c.conkey = array[v_profile_id]::smallint[]
           and c.confrelid = 'public.barbershops'::regclass
           and c.confkey = array[
               (select a.attnum from pg_attribute a
                 where a.attrelid = 'public.barbershops'::regclass
                   and a.attname = 'id' and not a.attisdropped)
           ]::smallint[]
           and c.confdeltype = 'c'
           and c.convalidated
    ) then
        raise exception
            'public.customers precisa de FK validada profile_id -> barbershops.id ON DELETE CASCADE.';
    end if;

    if not exists (
        select 1 from pg_constraint c
         where c.conrelid = v_table and c.contype = 'c'
           and c.conname = 'customers_name_check'
           and lower(regexp_replace(
               pg_get_expr(c.conbin, c.conrelid),
               '[[:space:]()]',
               '',
               'g'
           )) = 'lengthbtrimname>0'
           and c.convalidated
    ) or not exists (
        select 1 from pg_constraint c
         where c.conrelid = v_table and c.contype = 'c'
           and c.conname = 'customers_phone_check'
           and lower(regexp_replace(
               pg_get_expr(c.conbin, c.conrelid),
               '[[:space:]()]',
               '',
               'g'
           )) = 'lengthbtrimphone>0'
           and c.convalidated
    ) then
        raise exception
            'public.customers precisa manter os checks validados de nome e telefone não vazios.';
    end if;
end;
$migration$;

alter table public.appointments
    add column if not exists customer_id uuid;

do $migration$
declare
    v_customer_id_attnum smallint;
    v_profile_id_attnum smallint;
    v_customer_id_customers_attnum smallint;
    v_profile_id_customers_attnum smallint;
begin
    select attnum into v_customer_id_attnum
      from pg_attribute
     where attrelid = 'public.appointments'::regclass
       and attname = 'customer_id' and not attisdropped
       and atttypid = 'uuid'::regtype and not attnotnull;

    if v_customer_id_attnum is null then
        raise exception 'appointments.customer_id precisa existir como UUID nullable.';
    end if;

    select attnum into v_profile_id_attnum
      from pg_attribute
     where attrelid = 'public.appointments'::regclass
       and attname = 'profile_id' and not attisdropped;
    select attnum into v_customer_id_customers_attnum
      from pg_attribute
     where attrelid = 'public.customers'::regclass
       and attname = 'id' and not attisdropped;
    select attnum into v_profile_id_customers_attnum
      from pg_attribute
     where attrelid = 'public.customers'::regclass
       and attname = 'profile_id' and not attisdropped;

    if exists (
        select 1
          from pg_constraint c
         where c.conrelid = 'public.appointments'::regclass
           and c.conname = 'appointments_customer_profile_fkey'
           and not (
               c.contype = 'f'
               and c.conkey = array[v_customer_id_attnum, v_profile_id_attnum]::smallint[]
               and c.confrelid = 'public.customers'::regclass
               and c.confkey = array[
                   v_customer_id_customers_attnum,
                   v_profile_id_customers_attnum
               ]::smallint[]
               and c.confdeltype = 'a'
               and c.convalidated
           )
    ) then
        raise exception
            'appointments_customer_profile_fkey existe com definição incompatível ou não validada.';
    end if;

    if not exists (
        select 1
          from pg_constraint c
         where c.conrelid = 'public.appointments'::regclass
           and c.conname = 'appointments_customer_profile_fkey'
           and c.contype = 'f'
           and c.conkey = array[v_customer_id_attnum, v_profile_id_attnum]::smallint[]
           and c.confrelid = 'public.customers'::regclass
           and c.confkey = array[
               v_customer_id_customers_attnum,
               v_profile_id_customers_attnum
           ]::smallint[]
           and c.confdeltype = 'a'
           and c.convalidated
    ) then
        alter table public.appointments
            add constraint appointments_customer_profile_fkey
            foreign key (customer_id, profile_id)
            references public.customers (id, profile_id)
            on delete no action;
    end if;
end;
$migration$;

create index if not exists customers_profile_name_idx
    on public.customers (profile_id, lower(name));
create index if not exists appointments_customer_id_idx
    on public.appointments (customer_id);

alter table public.customers enable row level security;

do $migration$
declare
    v_unexpected text;
begin
    select string_agg(
        format('%I (roles=%s, command=%s)', policyname, roles, cmd),
        ', ' order by policyname
    )
      into v_unexpected
      from pg_policies
     where schemaname = 'public'
       and tablename = 'customers'
       and roles && array['public', 'anon', 'authenticated']::name[]
       and policyname not in (
           'Owners can read their customers',
           'Owners can create their customers',
           'Owners can update their customers'
       );

    if v_unexpected is not null then
        raise exception
            'Políticas inesperadas em customers: %. Revise-as antes da migration.',
            v_unexpected;
    end if;
end;
$migration$;

revoke all on table public.customers from public, anon, authenticated;
revoke select (
    id, profile_id, name, phone, phone_normalized, created_at, updated_at
), insert (
    id, profile_id, name, phone, phone_normalized, created_at, updated_at
), update (
    id, profile_id, name, phone, phone_normalized, created_at, updated_at
), references (
    id, profile_id, name, phone, phone_normalized, created_at, updated_at
)
on table public.customers
from public, anon, authenticated;

grant select on table public.customers to authenticated;
grant insert (profile_id, name, phone)
    on public.customers to authenticated;
grant update (name, phone)
    on public.customers to authenticated;

drop policy if exists "Owners can read their customers" on public.customers;
create policy "Owners can read their customers"
    on public.customers for select to authenticated
    using (
        exists (
            select 1 from public.barbershops b
             where b.id = customers.profile_id
               and b.user_id = (select auth.uid())
        )
    );

drop policy if exists "Owners can create their customers" on public.customers;
create policy "Owners can create their customers"
    on public.customers for insert to authenticated
    with check (
        exists (
            select 1 from public.barbershops b
             where b.id = customers.profile_id
               and b.user_id = (select auth.uid())
        )
    );

drop policy if exists "Owners can update their customers" on public.customers;
create policy "Owners can update their customers"
    on public.customers for update to authenticated
    using (
        exists (
            select 1 from public.barbershops b
             where b.id = customers.profile_id
               and b.user_id = (select auth.uid())
        )
    )
    with check (
        exists (
            select 1 from public.barbershops b
             where b.id = customers.profile_id
               and b.user_id = (select auth.uid())
        )
    );

create or replace function public.set_customer_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
    new.updated_at := pg_catalog.now();
    return new;
end;
$function$;

drop trigger if exists customers_set_updated_at on public.customers;
create trigger customers_set_updated_at
before update on public.customers
for each row
execute function public.set_customer_updated_at();
revoke all on function public.set_customer_updated_at()
    from public, anon, authenticated;

create or replace function public.attach_appointment_customer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
    v_phone_normalized text;
    v_customer_id uuid;
begin
    new.customer_id := null;
    v_phone_normalized := public.normalize_br_phone(new.customer_phone);

    if v_phone_normalized is null then
        return new;
    end if;

    insert into public.customers (profile_id, name, phone)
    values (new.profile_id, new.customer_name, new.customer_phone)
    on conflict (profile_id, phone_normalized) do nothing
    returning id into v_customer_id;

    if v_customer_id is null then
        select c.id into v_customer_id
          from public.customers c
         where c.profile_id = new.profile_id
           and c.phone_normalized = v_phone_normalized;

        if v_customer_id is null then
            insert into public.customers (profile_id, name, phone)
            values (new.profile_id, new.customer_name, new.customer_phone)
            on conflict (profile_id, phone_normalized) do nothing
            returning id into v_customer_id;
        end if;
    end if;

    new.customer_id := v_customer_id;
    return new;
end;
$function$;

do $migration$
declare
    v_function_owner oid;
    v_table_owner oid;
    v_force_rls boolean;
    v_owner_bypass boolean;
    v_owner_super boolean;
begin
    select p.proowner into v_function_owner
      from pg_proc p
     where p.oid = 'public.attach_appointment_customer()'::regprocedure;
    select c.relowner, c.relforcerowsecurity
      into v_table_owner, v_force_rls
      from pg_class c
     where c.oid = 'public.customers'::regclass;
    select r.rolbypassrls, r.rolsuper
      into v_owner_bypass, v_owner_super
      from pg_roles r
     where r.oid = v_function_owner;

    if v_function_owner is null then
        raise exception 'Não foi possível determinar o proprietário da função attach_appointment_customer().';
    end if;
    if not has_table_privilege(v_function_owner, 'public.customers', 'INSERT')
       or not has_table_privilege(v_function_owner, 'public.customers', 'SELECT') then
        raise exception 'O proprietário da função precisa de INSERT e SELECT em public.customers.';
    end if;
    if not has_function_privilege(
        v_function_owner, 'public.normalize_br_phone(text)', 'EXECUTE'
    ) then
        raise exception 'O proprietário da função não pode executar normalize_br_phone(text).';
    end if;
    if not coalesce(v_owner_super, false)
       and not coalesce(v_owner_bypass, false)
       and not (v_function_owner = v_table_owner and not v_force_rls) then
        raise exception
            'O proprietário da função não pode ignorar RLS em customers. Exige superuser, BYPASSRLS ou propriedade sem FORCE RLS.';
    end if;
end;
$migration$;

do $migration$
begin
    if not has_function_privilege(
        current_user, 'public.attach_appointment_customer()', 'EXECUTE'
    ) then
        raise exception 'O papel efetivo da migration precisa de EXECUTE para criar o trigger.';
    end if;
end;
$migration$;

drop trigger if exists appointments_attach_customer on public.appointments;
create trigger appointments_attach_customer
before insert on public.appointments
for each row
execute function public.attach_appointment_customer();

-- Trigger já criado: agora a função fica inacessível pela API.
revoke all on function public.attach_appointment_customer()
    from public, anon, authenticated;

-- Verifica bypass de RLS e grants do papel efetivo antes de qualquer backfill.
do $migration$
declare
    v_role oid;
    v_role_bypass boolean;
    v_role_super boolean;
    v_table record;
begin
    select oid, rolbypassrls, rolsuper
      into v_role, v_role_bypass, v_role_super
      from pg_roles
     where rolname = current_user;
    if v_role is null then
        raise exception 'Não foi possível identificar o papel efetivo da migration.';
    end if;

    for v_table in
        select c.oid, c.relname, c.relowner, c.relforcerowsecurity
          from pg_class c
         where c.oid in (
             'public.appointments'::regclass,
             'public.customers'::regclass
         )
    loop
        if not coalesce(v_role_super, false)
           and not coalesce(v_role_bypass, false)
           and not (v_table.relowner = v_role and not v_table.relforcerowsecurity) then
            raise exception
                'Papel % não pode ignorar RLS em public.%. Exige superuser, BYPASSRLS ou propriedade sem FORCE RLS.',
                current_user, v_table.relname;
        end if;
    end loop;

    if not has_table_privilege(current_user, 'public.appointments', 'SELECT')
       or not has_table_privilege(current_user, 'public.appointments', 'UPDATE')
       or not has_table_privilege(current_user, 'public.customers', 'SELECT')
       or not has_table_privilege(current_user, 'public.customers', 'INSERT') then
        raise exception 'Papel % não tem privilégios suficientes para o backfill.', current_user;
    end if;
end;
$migration$;

with first_appointment as (
    select distinct on (
        a.profile_id, public.normalize_br_phone(a.customer_phone)
    )
        a.profile_id,
        a.customer_name as name,
        a.customer_phone as phone
    from public.appointments a
    where public.normalize_br_phone(a.customer_phone) is not null
    order by
        a.profile_id,
        public.normalize_br_phone(a.customer_phone),
        a.created_at asc,
        a.id asc
)
insert into public.customers (profile_id, name, phone)
select profile_id, name, phone
from first_appointment
on conflict (profile_id, phone_normalized) do nothing;

update public.appointments a
   set customer_id = c.id
  from public.customers c
 where a.customer_id is null
   and c.profile_id = a.profile_id
   and c.phone_normalized = public.normalize_br_phone(a.customer_phone)
   and public.normalize_br_phone(a.customer_phone) is not null;

comment on function public.attach_appointment_customer() is
'Associa clientes a novos agendamentos. SECURITY DEFINER restrita ao trigger.';
comment on column public.appointments.customer_id is
'Associação opcional a customers; customer_name e customer_phone são snapshots históricos.';
