-- Add the barber's name used in the dashboard greeting.
-- This file is prepared only; it has NOT been applied to any database by the agent.
--
-- Existing profiles are backfilled with the barbershop name so the greeting keeps
-- working until the owner edits the profile. Validate with fabricated data in a
-- development database:
--   - an existing profile gets a non-empty barber_name after this migration
--   - updating barber_name through PUT /profile changes only the owner's profile
--   - a barber_name longer than 120 characters is rejected by the check constraint

alter table public.barbershops
    add column if not exists barber_name text;

update public.barbershops
   set barber_name = coalesce(nullif(btrim(name), ''), 'Barbeiro')
 where barber_name is null or length(btrim(barber_name)) = 0;

alter table public.barbershops
    alter column barber_name set not null;

do $$
begin
    if not exists (
        select 1
          from pg_constraint
         where conname = 'barbershops_barber_name_check'
           and conrelid = 'public.barbershops'::regclass
    ) then
        alter table public.barbershops
            add constraint barbershops_barber_name_check
            check (length(btrim(barber_name)) > 0 and length(barber_name) <= 120);
    end if;
end $$;
