-- Fix the shared finance tenant-link trigger.
-- This file is prepared only; it has NOT been applied to any database by the agent.
--
-- The previous function referenced NEW.category_id for both payments and
-- expenses. On INSERT into public.payments that field does not exist, so
-- Postgres raised 42703 ("record new has no field category_id") before the
-- IF could short-circuit. Payment registration then returned 500.
--
-- Split the validation into one trigger function per table so each one only
-- touches fields that exist on its own row.
--
-- Validate with fabricated data in a development database:
--   - payment linked to an appointment of the same barbershop: succeeds
--   - payment linked to an appointment of another barbershop: fails with 22023
--   - expense linked to a category of the same barbershop: succeeds
--   - expense linked to a category of another barbershop: fails with 22023
--   - INSERT into payments no longer raises 42703

drop trigger if exists payments_validate_tenant_link on public.payments;
drop trigger if exists expenses_validate_tenant_link on public.expenses;
drop function if exists public.finance_validate_tenant_link();

create function public.finance_validate_payment_link()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
    if new.appointment_id is not null
       and not exists (
            select 1
              from public.appointments a
             where a.id = new.appointment_id
               and a.profile_id = new.profile_id
       ) then
        raise exception 'Agendamento não pertence a esta barbearia.'
            using errcode = '22023';
    end if;

    return new;
end;
$function$;

create function public.finance_validate_expense_link()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
    if new.category_id is not null
       and not exists (
            select 1
              from public.expense_categories c
             where c.id = new.category_id
               and c.profile_id = new.profile_id
       ) then
        raise exception 'Categoria não pertence a esta barbearia.'
            using errcode = '22023';
    end if;

    return new;
end;
$function$;

create trigger payments_validate_tenant_link
before insert or update on public.payments
for each row execute function public.finance_validate_payment_link();

create trigger expenses_validate_tenant_link
before insert or update on public.expenses
for each row execute function public.finance_validate_expense_link();

revoke all on function public.finance_validate_payment_link()
    from public, anon, authenticated;
revoke all on function public.finance_validate_expense_link()
    from public, anon, authenticated;
