-- Fail closed if the live database has an INSERT/ALL policy outside the
-- reviewed policy set. PostgreSQL combines permissive policies with OR, so
-- an unreviewed policy could otherwise keep a broader insert path open.
do $migration$
declare
    unexpected_policies text;
begin
    select string_agg(
        format('%I (roles=%s, command=%s)', policyname, roles, cmd),
        ', ' order by policyname
    )
      into unexpected_policies
      from pg_policies
     where schemaname = 'public'
       and tablename = 'appointments'
       and cmd in ('INSERT', 'ALL')
       and roles && array['public', 'anon', 'authenticated']::name[]
       and policyname not in (
           'Public can create confirmed appointments',
           'Owners can create confirmed appointments'
       );

    if unexpected_policies is not null then
        raise exception
            'Unexpected appointments INSERT/ALL policies found: %. Review the live policies and update this migration before applying it.',
            unexpected_policies;
    end if;
end;
$migration$;

drop policy if exists "Public can create confirmed appointments"
    on public.appointments;
drop policy if exists "Owners can create confirmed appointments"
    on public.appointments;

create policy "Public can create confirmed appointments"
    on public.appointments for insert to anon
    with check (
        status = 'confirmed'
        and starts_at > now()
        and exists (
            select 1
              from public.services s
             where s.id = appointments.service_id
               and s.profile_id = appointments.profile_id
               and appointments.ends_at = appointments.starts_at
                   + make_interval(mins => s.duration)
        )
        and exists (
            select 1
              from public.barbershop_working_hours h
             where h.profile_id = appointments.profile_id
               and h.day_of_week = extract(
                   dow from appointments.starts_at at time zone 'America/Fortaleza'
               )::smallint
               and (appointments.starts_at at time zone 'America/Fortaleza')::time >= h.opens_at
               and (appointments.ends_at at time zone 'America/Fortaleza')::time <= h.closes_at
        )
    );

create policy "Owners can create confirmed appointments"
    on public.appointments for insert to authenticated
    with check (
        status = 'confirmed'
        and starts_at > now()
        and exists (
            select 1
              from public.barbershops b
             where b.id = appointments.profile_id
               and b.user_id = (select auth.uid())
        )
        and exists (
            select 1
              from public.services s
             where s.id = appointments.service_id
               and s.profile_id = appointments.profile_id
               and appointments.ends_at = appointments.starts_at
                   + make_interval(mins => s.duration)
        )
        and exists (
            select 1
              from public.barbershop_working_hours h
             where h.profile_id = appointments.profile_id
               and h.day_of_week = extract(
                   dow from appointments.starts_at at time zone 'America/Fortaleza'
               )::smallint
               and (appointments.starts_at at time zone 'America/Fortaleza')::time >= h.opens_at
               and (appointments.ends_at at time zone 'America/Fortaleza')::time <= h.closes_at
        )
    );
