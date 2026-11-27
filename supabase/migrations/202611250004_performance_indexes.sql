-- Performance indexes identified by the request-path audit.
-- This file is prepared only; it has NOT been applied to any database.
--
-- Every authenticated request resolves the tenant with:
--   select id from public.barbershops where user_id = <authenticated user>
-- The same predicate is present in the barbershop RLS policies, but no
-- migration currently creates an index with user_id as the leading column.

create index if not exists barbershops_user_id_idx
    on public.barbershops (user_id);

-- Validation before applying (run on a development database with fabricated data):
--
--   explain (analyze, buffers)
--   select id from public.barbershops
--   where user_id = '00000000-0000-0000-0000-000000000000';
--
-- Expected after the index:
--   - Index Scan using barbershops_user_id_idx
--   - reduced "Buffers: shared hit/read" versus the previous Seq Scan
--
-- Isolation check with two fabricated barbershops:
--   - authenticate as owner A and confirm only A's barbershop id is returned
--   - authenticate as owner B and confirm only B's barbershop id is returned
--
-- Candidate only if EXPLAIN still reports a sequential scan on customers with
-- a realistic dataset (the current lower(name) index does not serve ilike '%term%'):
--
--   create extension if not exists pg_trgm;
--   create index if not exists customers_name_trgm_idx
--       on public.customers using gin (name gin_trgm_ops);
