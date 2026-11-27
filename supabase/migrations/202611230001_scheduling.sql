create extension if not exists btree_gist;

create table if not exists public.barbershop_working_hours (
    id uuid primary key default gen_random_uuid(),
    profile_id uuid not null references public.barbershops(id) on delete cascade,
    day_of_week smallint not null check (day_of_week between 0 and 6),
    opens_at time not null,
    closes_at time not null,
    check (opens_at < closes_at),
    unique (profile_id, day_of_week)
);

create table if not exists public.appointments (
    id uuid primary key default gen_random_uuid(),
    profile_id uuid not null references public.barbershops(id) on delete cascade,
    service_id uuid not null references public.services(id) on delete restrict,
    customer_name text not null check (length(trim(customer_name)) > 0),
    customer_phone text not null check (length(trim(customer_phone)) > 0),
    starts_at timestamptz not null,
    ends_at timestamptz not null,
    status text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
    created_at timestamptz not null default now(),
    check (ends_at > starts_at),
    exclude using gist (
        profile_id with =,
        tstzrange(starts_at, ends_at, '[)') with &&
    ) where (status = 'confirmed')
);

create index if not exists appointments_profile_starts_at_idx
    on public.appointments (profile_id, starts_at);

alter table public.barbershop_working_hours enable row level security;
alter table public.appointments enable row level security;

grant select on public.services to anon, authenticated;
grant select on public.barbershop_working_hours to anon, authenticated;
grant insert on public.appointments to anon;
grant insert, select, update on public.appointments to authenticated;
grant insert, update, delete on public.barbershop_working_hours to authenticated;

create policy "Owners can manage their barbershop working hours"
    on public.barbershop_working_hours for all to authenticated
    using (exists (
        select 1 from public.barbershops b
        where b.id = profile_id and b.user_id = (select auth.uid())
    ))
    with check (exists (
        select 1 from public.barbershops b
        where b.id = profile_id and b.user_id = (select auth.uid())
    ));

create policy "Public can read working hours"
    on public.barbershop_working_hours for select to anon, authenticated
    using (true);

create policy "Owners can read their appointments"
    on public.appointments for select to authenticated
    using (exists (
        select 1 from public.barbershops b
        where b.id = profile_id and b.user_id = (select auth.uid())
    ));

create policy "Owners can update their appointments"
    on public.appointments for update to authenticated
    using (exists (
        select 1 from public.barbershops b
        where b.id = profile_id and b.user_id = (select auth.uid())
    ))
    with check (exists (
        select 1 from public.barbershops b
        where b.id = profile_id and b.user_id = (select auth.uid())
    ) and exists (
        select 1 from public.services s
        where s.id = appointments.service_id and s.profile_id = appointments.profile_id
    ));

create policy "Public can create confirmed appointments"
    on public.appointments for insert to anon, authenticated
    with check (
        status = 'confirmed'
        and starts_at > now()
        and exists (
            select 1 from public.services s
            where s.id = appointments.service_id
              and s.profile_id = appointments.profile_id
              and appointments.ends_at = appointments.starts_at + make_interval(mins => s.duration)
        )
        and exists (
            select 1 from public.barbershop_working_hours h
            where h.profile_id = appointments.profile_id
              and h.day_of_week = extract(dow from appointments.starts_at at time zone 'America/Fortaleza')::smallint
              and (appointments.starts_at at time zone 'America/Fortaleza')::time >= h.opens_at
              and (appointments.ends_at at time zone 'America/Fortaleza')::time <= h.closes_at
        )
    );

create policy "Public can read active services for booking"
    on public.services for select to anon
    using (true);

create or replace function public.get_public_busy_times(p_profile_id uuid, p_from timestamptz, p_to timestamptz)
returns table (starts_at timestamptz, ends_at timestamptz)
language sql
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

revoke all on function public.get_public_busy_times(uuid, timestamptz, timestamptz) from public;
grant execute on function public.get_public_busy_times(uuid, timestamptz, timestamptz) to anon, authenticated;

create or replace function public.get_public_barbershop(p_slug text)
returns table (id uuid, name text, slug text)
language sql
security definer
set search_path = ''
as $$
    select b.id, b.name, b.slug
    from public.barbershops b
    where b.slug = p_slug
    limit 1;
$$;

revoke all on function public.get_public_barbershop(text) from public;
grant execute on function public.get_public_barbershop(text) to anon, authenticated;
