-- Baseline for the two tables that existed before this repository started
-- versioning migrations: public.barbershops and public.services.
--
-- This block only creates the tables when they are missing. On a database that
-- already has them it is a no-op: existing columns, policies and data are kept.
-- Later migrations (0008/0013/etc.) add columns to pre-existing tables.

do $baseline$
begin
    if to_regclass('public.barbershops') is null then
        create table public.barbershops (
            id uuid primary key default gen_random_uuid(),
            user_id uuid not null unique
                references auth.users(id) on delete cascade,
            barber_name text not null check (length(btrim(barber_name)) > 0 and length(barber_name) <= 120),
            name text not null check (length(btrim(name)) > 0 and length(name) <= 120),
            slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
            phone text not null check (length(btrim(phone)) > 0 and length(phone) <= 40),
            sells_products boolean not null default false,
            created_at timestamptz not null default now(),
            updated_at timestamptz not null default now()
        );

        alter table public.barbershops enable row level security;

        grant select, insert, update on public.barbershops to authenticated;

        create policy "Owners can read their barbershop"
            on public.barbershops for select to authenticated
            using (auth.uid() = user_id);

        create policy "Owners can insert their barbershop"
            on public.barbershops for insert to authenticated
            with check (auth.uid() = user_id);

        create policy "Owners can update their barbershop"
            on public.barbershops for update to authenticated
            using (auth.uid() = user_id)
            with check (auth.uid() = user_id);
    end if;

    if to_regclass('public.services') is null then
        create table public.services (
            id uuid primary key default gen_random_uuid(),
            profile_id uuid not null
                references public.barbershops(id) on delete cascade,
            name text not null check (length(btrim(name)) > 0 and length(name) <= 120),
            description text,
            price numeric(12,2) not null check (price > 0),
            duration integer not null check (duration > 0),
            created_at timestamptz not null default now(),
            updated_at timestamptz not null default now()
        );

        create index if not exists services_profile_name_idx
            on public.services (profile_id, name);

        alter table public.services enable row level security;

        grant select on public.services to anon, authenticated;
        grant insert, update, delete on public.services to authenticated;

        -- The public SELECT policy is created by 202611230001_scheduling.sql.
        create policy "Owners can read their services"
            on public.services for select to authenticated
            using (exists (
                select 1 from public.barbershops b
                 where b.id = services.profile_id
                   and b.user_id = (select auth.uid())
            ));

        create policy "Owners can insert their services"
            on public.services for insert to authenticated
            with check (exists (
                select 1 from public.barbershops b
                 where b.id = services.profile_id
                   and b.user_id = (select auth.uid())
            ));

        create policy "Owners can update their services"
            on public.services for update to authenticated
            using (exists (
                select 1 from public.barbershops b
                 where b.id = services.profile_id
                   and b.user_id = (select auth.uid())
            ))
            with check (exists (
                select 1 from public.barbershops b
                 where b.id = services.profile_id
                   and b.user_id = (select auth.uid())
            ));

        create policy "Owners can delete their services"
            on public.services for delete to authenticated
            using (exists (
                select 1 from public.barbershops b
                 where b.id = services.profile_id
                   and b.user_id = (select auth.uid())
            ));
    end if;
end;
$baseline$;
