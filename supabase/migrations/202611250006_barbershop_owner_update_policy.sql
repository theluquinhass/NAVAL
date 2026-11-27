-- Allow an authenticated owner to update their own barbershop profile.
-- This file is prepared only; it has NOT been applied to any database.
--
-- The profile editor runs with the authenticated user's JWT through
-- createUserClient(token), so RLS applies. Without an UPDATE policy Supabase
-- rejects the operation even though the backend filters by user_id.
--
-- Validate with two fabricated barbershops in a development database:
--   - authenticated as owner A, update A: succeeds
--   - authenticated as owner A, try to update B: affects zero rows
--   - authenticated as owner B, update B: succeeds
--
-- After applying, check in the Supabase SQL editor:
--
--   select polname, polcmd, pg_get_expr(polqual, polrelid)
--   from pg_policy
--   where polrelid = 'public.barbershops'::regclass;

grant select, update on public.barbershops to authenticated;

drop policy if exists "Owners can update their barbershop"
    on public.barbershops;

create policy "Owners can update their barbershop"
    on public.barbershops
    for update
    to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
