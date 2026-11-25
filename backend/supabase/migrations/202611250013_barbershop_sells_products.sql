-- Adds an explicit opt-in for the products module to barbershop profiles.
-- This file is prepared only; it has NOT been applied to any database by the agent.
--
-- Existing shops without products keep the module hidden. Shops that already
-- have catalog data keep access when the products migration is present.

alter table public.barbershops
    add column if not exists sells_products boolean not null default false;

do $migration$
begin
    if to_regclass('public.products') is not null then
        execute $sql$
            update public.barbershops b
               set sells_products = true
             where exists (
                 select 1
                   from public.products p
                  where p.profile_id = b.id
             )
        $sql$;
    end if;
end;
$migration$;
