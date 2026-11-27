-- Stock entries are purchases: each entry creates an expense from product.cost.
-- This supersedes the earlier default where stock entries did not touch finance.
-- Prepared only; it has NOT been applied to any database by the agent.
--
-- Example: product cost 10.00 and an entry of 10 units creates one 100.00
-- expense, in the same transaction as the inventory movement.
--
-- Adjustments never create expenses. Entries require a positive product cost so
-- the purchase value is always known and snapshot in the expense note.

alter table public.expenses
    add column if not exists source_type text not null default 'manual';

alter table public.expenses
    add column if not exists inventory_movement_id uuid;

do $migration$
begin
    if not exists (
        select 1
          from pg_constraint
         where conname = 'expenses_source_type_check'
           and conrelid = 'public.expenses'::regclass
    ) then
        alter table public.expenses
            add constraint expenses_source_type_check
            check (source_type in ('manual', 'stock_entry'));
    end if;

    if not exists (
        select 1
          from pg_constraint
         where conname = 'expenses_profile_inventory_movement_fkey'
           and conrelid = 'public.expenses'::regclass
    ) then
        alter table public.expenses
            add constraint expenses_profile_inventory_movement_fkey
            foreign key (profile_id, inventory_movement_id)
            references public.inventory_movements(profile_id, id)
            on delete restrict;
    end if;

    if not exists (
        select 1
          from pg_constraint
         where conname = 'expenses_profile_inventory_movement_key'
           and conrelid = 'public.expenses'::regclass
    ) then
        alter table public.expenses
            add constraint expenses_profile_inventory_movement_key
            unique (profile_id, inventory_movement_id);
    end if;
end;
$migration$;

create index if not exists expenses_profile_source_spent_at_idx
    on public.expenses (profile_id, source_type, spent_at);

create or replace function public.finance_validate_stock_expense_link()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
    v_movement_type text;
begin
    if new.source_type = 'stock_entry' then
        if new.inventory_movement_id is null then
            raise exception 'Despesa de estoque exige movimentação vinculada.'
                using errcode = '22023';
        end if;

        select m.movement_type
          into v_movement_type
          from public.inventory_movements m
         where m.profile_id = new.profile_id
           and m.id = new.inventory_movement_id;

        if v_movement_type is distinct from 'entry' then
            raise exception 'A despesa de estoque só pode vincular uma entrada.'
                using errcode = '22023';
        end if;
    elsif new.inventory_movement_id is not null then
        raise exception 'Despesa manual não pode vincular movimentação de estoque.'
            using errcode = '22023';
    end if;

    return new;
end;
$function$;

drop trigger if exists expenses_validate_stock_expense_link on public.expenses;
create trigger expenses_validate_stock_expense_link
before insert or update on public.expenses
for each row execute function public.finance_validate_stock_expense_link();

-- Purchase expenses are snapshots of a stock event and must not be edited or
-- deleted as if they were manual finance entries.
create or replace function public.finance_protect_stock_expenses()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
    if old.source_type <> 'manual'
       or (tg_op = 'UPDATE' and new.source_type <> 'manual') then
        raise exception 'Despesa gerada por entrada de estoque não pode ser alterada.'
            using errcode = '22023';
    end if;

    if tg_op = 'DELETE' then
        return old;
    end if;
    return new;
end;
$function$;

drop trigger if exists expenses_protect_stock_expenses on public.expenses;
create trigger expenses_protect_stock_expenses
before update or delete on public.expenses
for each row execute function public.finance_protect_stock_expenses();

revoke all on function public.finance_validate_stock_expense_link()
    from public, anon, authenticated;
revoke all on function public.finance_protect_stock_expenses()
    from public, anon, authenticated;

create or replace function public.products_record_movement(
    p_product_id uuid,
    p_movement_type text,
    p_quantity integer,
    p_direction smallint,
    p_reason text,
    p_note text
)
returns public.inventory_movements
language plpgsql
security definer
set search_path = ''
as $function$
declare
    v_profile_id uuid := public.products_authenticated_profile_id();
    v_direction smallint;
    v_product public.products%rowtype;
    v_stock integer;
    v_movement public.inventory_movements;
    v_total numeric(12,2);
    v_description text;
    v_note text;
begin
    if p_movement_type not in ('entry', 'adjustment') then
        raise exception 'Tipo de movimentação inválido.' using errcode = '22023';
    end if;
    if p_quantity is null or p_quantity <= 0 then
        raise exception 'A quantidade deve ser positiva.' using errcode = '22023';
    end if;

    if p_movement_type = 'entry' then
        v_direction := 1;
    else
        if p_direction not in (-1, 1) then
            raise exception 'Direção de ajuste inválida.' using errcode = '22023';
        end if;
        if p_reason is null or length(btrim(p_reason)) = 0 then
            raise exception 'Ajuste de estoque exige motivo.' using errcode = '22023';
        end if;
        v_direction := p_direction;
    end if;

    select p.*
      into v_product
      from public.products p
     where p.id = p_product_id
       and p.profile_id = v_profile_id
       for update;

    if not found then
        raise exception 'PRODUCT_NOT_FOUND' using errcode = 'P0002';
    end if;

    if v_direction = -1 then
        select coalesce(sum(m.direction * m.quantity), 0)::integer
          into v_stock
          from public.inventory_movements m
         where m.profile_id = v_profile_id
           and m.product_id = v_product.id;

        if v_stock < p_quantity then
            raise exception 'ESTOQUE_INSUFICIENTE' using errcode = '22023';
        end if;
    end if;

    insert into public.inventory_movements (
        profile_id, product_id, movement_type, direction, quantity,
        reason, note, created_by
    ) values (
        v_profile_id, v_product.id, p_movement_type, v_direction, p_quantity,
        nullif(btrim(p_reason), ''), nullif(btrim(p_note), ''), auth.uid()
    )
    returning * into v_movement;

    if p_movement_type = 'entry' then
        if v_product.cost is null or v_product.cost <= 0 then
            raise exception 'PRODUCT_COST_REQUIRED' using errcode = '22023';
        end if;

        v_total := round(v_product.cost * p_quantity, 2);
        if v_total is null or v_total > 99999999.99 then
            raise exception 'STOCK_EXPENSE_INVALID' using errcode = '22023';
        end if;

        v_description := 'Compra de estoque: ' || v_product.name;
        v_note := 'Entrada de ' || p_quantity || ' un. x ' || v_product.cost::text || ' por un.';
        if nullif(btrim(p_note), '') is not null then
            v_note := v_note || ' ' || btrim(p_note);
        end if;
        v_note := left(v_note, 500);

        insert into public.expenses (
            profile_id, source_type, inventory_movement_id, description,
            amount, currency, spent_at, note, created_at, updated_at
        ) values (
            v_profile_id, 'stock_entry', v_movement.id, v_description,
            v_total, 'BRL', v_movement.created_at, v_note,
            v_movement.created_at, v_movement.created_at
        );
    end if;

    return v_movement;
end;
$function$;

revoke all on function public.products_record_movement(uuid, text, integer, smallint, text, text)
    from public, anon, authenticated;

grant execute on function public.products_record_movement(uuid, text, integer, smallint, text, text)
    to authenticated;
