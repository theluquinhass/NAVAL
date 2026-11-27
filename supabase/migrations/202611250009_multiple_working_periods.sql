-- Multiple daily attendance periods. Existing rows receive period_index = 0,
-- preserving each previously configured single interval.

do $migration$
begin
    if not exists (
        select 1
          from pg_attribute
         where attrelid = 'public.barbershop_working_hours'::regclass
           and attname = 'period_index'
           and not attisdropped
    ) then
        alter table public.barbershop_working_hours
            add column period_index smallint not null default 0;
    else
        if not exists (
            select 1
              from information_schema.columns
             where table_schema = 'public'
               and table_name = 'barbershop_working_hours'
               and column_name = 'period_index'
               and data_type = 'smallint'
               and is_nullable = 'NO'
               and column_default = '0'
        ) then
            raise exception
                'barbershop_working_hours.period_index existe com tipo, nulabilidade ou default incompatível.';
        end if;
    end if;
end;
$migration$;

do $migration$
declare
    v_table oid := 'public.barbershop_working_hours'::regclass;
    v_profile_id smallint;
    v_day_of_week smallint;
    v_period_index smallint;
    v_constraint record;
begin
    select attnum into v_profile_id from pg_attribute
     where attrelid = v_table and attname = 'profile_id' and not attisdropped;
    select attnum into v_day_of_week from pg_attribute
     where attrelid = v_table and attname = 'day_of_week' and not attisdropped;
    select attnum into v_period_index from pg_attribute
     where attrelid = v_table and attname = 'period_index' and not attisdropped;

    -- Remove the old one-row-per-day uniqueness constraint, whatever its name.
    for v_constraint in
        select conname
          from pg_constraint
         where conrelid = v_table
           and contype = 'u'
           and conkey = array[v_profile_id, v_day_of_week]::smallint[]
    loop
        execute format(
            'alter table public.barbershop_working_hours drop constraint %I',
            v_constraint.conname
        );
    end loop;

    if not exists (
        select 1 from pg_constraint
         where conrelid = v_table
           and contype = 'u'
           and conkey = array[v_profile_id, v_day_of_week, v_period_index]::smallint[]
           and convalidated
    ) then
        alter table public.barbershop_working_hours
            add constraint barbershop_working_hours_profile_day_period_key
            unique (profile_id, day_of_week, period_index);
    end if;

    if not exists (
        select 1 from pg_constraint
         where conrelid = v_table
           and conname = 'barbershop_working_hours_period_index_check'
    ) then
        alter table public.barbershop_working_hours
            add constraint barbershop_working_hours_period_index_check
            check (period_index >= 0);
    end if;

    -- GiST exclusion prevents overlapping periods even if a client bypasses
    -- the Express validator. A fixed date converts TIME values into a range;
    -- overnight periods are already rejected by the existing opens < closes check.
    if not exists (
        select 1 from pg_constraint
         where conrelid = v_table
           and conname = 'barbershop_working_hours_no_overlap_excl'
    ) then
        alter table public.barbershop_working_hours
            add constraint barbershop_working_hours_no_overlap_excl
            exclude using gist (
                profile_id with =,
                day_of_week with =,
                tsrange(
                    date '2000-01-01' + opens_at,
                    date '2000-01-01' + closes_at,
                    '[)'
                ) with &&
            );
    end if;
end;
$migration$;

-- Transactional replacement keeps a failed save from leaving partial hours.
-- SECURITY INVOKER means the caller remains subject to the existing RLS policy.
create or replace function public.replace_barbershop_working_hours(
    p_profile_id uuid,
    p_working_hours jsonb
)
returns setof public.barbershop_working_hours
language plpgsql
security invoker
set search_path = ''
as $function$
begin
    if auth.uid() is null then
        raise exception 'Autenticação obrigatória.' using errcode = '42501';
    end if;

    if pg_catalog.jsonb_typeof(p_working_hours) <> 'array' then
        raise exception 'Os períodos devem ser enviados como uma lista.' using errcode = '22023';
    end if;

    if not exists (
        select 1
          from public.barbershops b
         where b.id = p_profile_id
           and b.user_id = auth.uid()
    ) then
        raise exception 'Barbearia não encontrada ou sem autorização.' using errcode = '42501';
    end if;

    delete from public.barbershop_working_hours h
     where h.profile_id = p_profile_id;

    insert into public.barbershop_working_hours (
        profile_id, day_of_week, period_index, opens_at, closes_at
    )
    select
        p_profile_id,
        item.day_of_week,
        item.period_index,
        item.opens_at,
        item.closes_at
    from pg_catalog.jsonb_to_recordset(p_working_hours) as item(
        day_of_week smallint,
        period_index smallint,
        opens_at time,
        closes_at time
    );

    return query
    select h.*
      from public.barbershop_working_hours h
     where h.profile_id = p_profile_id
     order by h.day_of_week, h.period_index;
end;
$function$;

revoke all on function public.replace_barbershop_working_hours(uuid, jsonb)
    from public, anon;
grant execute on function public.replace_barbershop_working_hours(uuid, jsonb)
    to authenticated;

comment on function public.replace_barbershop_working_hours(uuid, jsonb) is
'Substitui os períodos semanais de uma barbearia em uma transação, sob as políticas RLS do usuário autenticado.';
