-- Unique public profile slugs.
-- This file is prepared only; it has NOT been applied to any database.
--
-- The profile editor normalizes slugs on the server and maps a 23505 error to a
-- friendly 409, but the unique constraint itself is not present in the
-- versioned migrations. Confirm the live schema before applying:
--
--   select conname, pg_get_constraintdef(oid)
--   from pg_constraint
--   where conrelid = 'public.barbershops'::regclass and contype = 'u';
--
-- Also confirm there are no fabricated duplicate slugs that would block the
-- index (resolve any rows first):
--
--   select slug, count(*)
--   from public.barbershops
--   group by slug
--   having count(*) > 1;
--
-- If an equivalent constraint already exists under another name, this index is
-- redundant but harmless. If one exists with this name, IF NOT EXISTS skips it.

create unique index if not exists barbershops_slug_key
    on public.barbershops (slug);
