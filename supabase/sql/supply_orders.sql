-- Supplies: orders, receiving into stock, invoice files on every expense (TODO 11 + 11d).
-- Design + Pem's answers: docs/design/2026-11-18/Supplies_Orders.notes.md.
-- NOT APPLIED by the side session: the lead applies it on Pem's OK, then flips
-- SUPPLY_ORDERS_SQL_LIVE in lib/supply-orders.ts and runs `npm run gen:types`.
--
-- New: supply_order, supply_order_line, receive_supply_order().
-- Changed: document gets expense_id + supply_order_id (Pem: every expense can carry its invoice / ticket
--          file, a shop ticket with no order included).
-- Pem 2026-11-18 (via the lead): no stock history log and no undo of a receipt for now — a wrong figure is
-- fixed by Count, as today. Receiving switches the item's supplier to this order's (past orders keep theirs).
-- Touches no existing row. Re-runnable (if not exists / or replace / drop policy if exists).

-- ── 1. Orders ─────────────────────────────────────────────────────────────────────────────────
create table if not exists public.supply_order (
  id            bigint generated always as identity primary key,
  ref           text unique,                         -- A-2026-001 … A-2026-1000 … (no upper limit)
  ref_year      integer not null,
  ref_seq       integer not null,
  supplier_id   integer not null references public."Contact"("ContactID") on delete restrict,
  status        text not null default 'draft'
                  check (status in ('draft', 'ordered', 'received', 'cancelled')),
                -- ordered + some lines received = partly delivered; « Clore » = received with a shortfall
  ordered_at    date,
  received_at   date,                                -- date of the last receipt
  cancelled_at  date,
  expense_id    bigint references public.expense(id) on delete set null,   -- several orders may share one
  notes         text,
  created_by    uuid default auth.uid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint supply_order_ref_seq_unique unique (ref_year, ref_seq)
);

comment on table public.supply_order is
  'Supply orders (TODO 11): planned orders and walk-in purchases (born received). Not artwork orders (work_order).';

create index if not exists supply_order_supplier_idx on public.supply_order (supplier_id);
create index if not exists supply_order_open_idx     on public.supply_order (status) where status in ('draft', 'ordered');
create index if not exists supply_order_expense_idx  on public.supply_order (expense_id) where expense_id is not null;

create table if not exists public.supply_order_line (
  id             bigint generated always as identity primary key,
  order_id       bigint not null references public.supply_order(id) on delete cascade,
  stock_item_id  bigint not null references public.stock_item(id) on delete restrict,
  qty_ordered    numeric not null check (qty_ordered > 0),
  qty_received   numeric not null default 0 check (qty_received >= 0),  -- written only by receive_supply_order()
  unit_price_ht  numeric check (unit_price_ht is null or unit_price_ht >= 0),
  position       integer not null default 0,
  unique (order_id, stock_item_id)
);

create index if not exists supply_order_line_item_idx on public.supply_order_line (stock_item_id);

-- ── 2. Files on expenses and orders (Vault « Factures ») ──────────────────────────────────────
alter table public.document add column if not exists expense_id      bigint references public.expense(id) on delete set null;
alter table public.document add column if not exists supply_order_id bigint references public.supply_order(id) on delete set null;
create index if not exists document_expense_idx      on public.document (expense_id)      where expense_id is not null;
create index if not exists document_supply_order_idx on public.document (supply_order_id) where supply_order_id is not null;

-- ── 3. Ref, dates, guards ─────────────────────────────────────────────────────────────────────
create or replace function public.supply_order_before_write()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Europe/Paris')::date;
begin
  if tg_op = 'INSERT' then
    new.ref_year := coalesce(new.ref_year, extract(year from v_today)::int);
    -- One number per year, no gaps from parallel inserts. The number grows past 999 (no lpad cut).
    perform pg_advisory_xact_lock(hashtext('supply_order_ref'), new.ref_year);
    select coalesce(max(ref_seq), 0) + 1 into new.ref_seq from supply_order where ref_year = new.ref_year;
    new.ref := 'A-' || new.ref_year || '-' || lpad(new.ref_seq::text, greatest(3, length(new.ref_seq::text)), '0');
  else
    if new.ref is distinct from old.ref or new.ref_seq is distinct from old.ref_seq or new.ref_year is distinct from old.ref_year then
      raise exception 'supply_order_ref_locked' using errcode = '23514';
    end if;
    if new.status = 'cancelled' and old.status <> 'cancelled'
       and exists (select 1 from supply_order_line where order_id = new.id and qty_received > 0) then
      raise exception 'supply_order_cancel_received' using errcode = '23514',
        detail = 'Received stock stays counted; close the order (« Clore ») instead, or fix stock with Count.';
    end if;
    new.updated_at := now();
  end if;

  if tg_op = 'INSERT' or new.status is distinct from old.status then
    case new.status
      when 'ordered'   then new.ordered_at   := coalesce(new.ordered_at, v_today);
      when 'received'  then new.received_at  := coalesce(new.received_at, v_today);
      when 'cancelled' then new.cancelled_at := coalesce(new.cancelled_at, v_today);
      else null;
    end case;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_supply_order_before_write on public.supply_order;
create trigger trg_supply_order_before_write
  before insert or update on public.supply_order
  for each row execute function public.supply_order_before_write();

-- ── 4. Receive: adds to stock, price paid → unit cost, supplier → this order's ─────────────────
-- p_lines = [{"line_id": 12, "qty": 5}, …]. One transaction, rows locked, so no lost update if two people
-- touch stock. Security definer so qty_received stays out of the app's update grant; the is_team() check
-- stands in for RLS.
create or replace function public.receive_supply_order(p_order_id bigint, p_lines jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order  supply_order%rowtype;
  v_today  date := (now() at time zone 'Europe/Paris')::date;
  v_el     jsonb;
  v_line   supply_order_line%rowtype;
  v_qty    numeric;
  v_n      integer := 0;
begin
  if not is_team() then raise exception 'not_team' using errcode = '42501'; end if;
  select * into v_order from supply_order where id = p_order_id for update;
  if not found then raise exception 'supply_order_not_found' using errcode = 'P0002'; end if;
  if v_order.status not in ('draft', 'ordered') then
    raise exception 'supply_order_not_open' using errcode = '23514';
  end if;

  for v_el in select * from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) loop
    v_qty := (v_el->>'qty')::numeric;
    if v_qty is null or v_qty <= 0 then continue; end if;
    select * into v_line from supply_order_line
      where id = (v_el->>'line_id')::bigint and order_id = p_order_id for update;
    if not found then raise exception 'supply_order_line_not_found' using errcode = 'P0002'; end if;

    update stock_item
       set quantity    = quantity + v_qty,
           cost_unit   = coalesce(v_line.unit_price_ht, cost_unit),
           supplier_id = v_order.supplier_id,       -- Pem: switch to the latest supplier
           updated_at  = now()
     where id = v_line.stock_item_id;

    update supply_order_line set qty_received = qty_received + v_qty where id = v_line.id;
    v_n := v_n + 1;
  end loop;

  if v_n = 0 then raise exception 'supply_order_nothing_to_receive' using errcode = '23514'; end if;

  update supply_order
     set status      = case when exists (select 1 from supply_order_line
                                           where order_id = p_order_id and qty_received < qty_ordered)
                            then 'ordered' else 'received' end,
         ordered_at  = coalesce(ordered_at, v_today),
         received_at = v_today
   where id = p_order_id;
end;
$$;

-- ── 5. RLS + grants ───────────────────────────────────────────────────────────────────────────
alter table public.supply_order      enable row level security;
alter table public.supply_order_line enable row level security;

drop policy if exists supply_order_team_select on public.supply_order;
drop policy if exists supply_order_team_insert on public.supply_order;
drop policy if exists supply_order_team_update on public.supply_order;
drop policy if exists supply_order_draft_delete on public.supply_order;
create policy supply_order_team_select  on public.supply_order for select to authenticated using ((select is_team()));
create policy supply_order_team_insert  on public.supply_order for insert to authenticated with check ((select is_team()));
create policy supply_order_team_update  on public.supply_order for update to authenticated using ((select is_team())) with check ((select is_team()));
-- A draft can be thrown away; anything ordered is cancelled instead (keeps the trace).
create policy supply_order_draft_delete on public.supply_order for delete to authenticated using ((select is_team()) and status = 'draft');

drop policy if exists supply_order_line_team_select on public.supply_order_line;
drop policy if exists supply_order_line_team_insert on public.supply_order_line;
drop policy if exists supply_order_line_team_update on public.supply_order_line;
drop policy if exists supply_order_line_team_delete on public.supply_order_line;
create policy supply_order_line_team_select on public.supply_order_line for select to authenticated using ((select is_team()));
create policy supply_order_line_team_insert on public.supply_order_line for insert to authenticated with check ((select is_team()) and qty_received = 0);
create policy supply_order_line_team_update on public.supply_order_line for update to authenticated using ((select is_team())) with check ((select is_team()));
create policy supply_order_line_team_delete on public.supply_order_line for delete to authenticated using ((select is_team()) and qty_received = 0);

-- Supabase default privileges hand authenticated everything (incl. truncate): start from nothing.
revoke all on public.supply_order, public.supply_order_line from public, anon, authenticated;
grant select, insert, update, delete on public.supply_order to authenticated;
grant select, insert, delete on public.supply_order_line to authenticated;
grant update (stock_item_id, qty_ordered, unit_price_ht, position) on public.supply_order_line to authenticated;  -- not qty_received
grant all on public.supply_order, public.supply_order_line to service_role;

revoke execute on function public.supply_order_before_write() from public, anon, authenticated;
revoke execute on function public.receive_supply_order(bigint, jsonb) from public, anon;
grant  execute on function public.receive_supply_order(bigint, jsonb) to authenticated;

-- Check after applying:
--   select tablename, policyname, cmd from pg_policies where tablename in ('supply_order','supply_order_line');
--   select grantee, table_name, privilege_type from information_schema.role_table_grants
--    where table_name in ('supply_order','supply_order_line') and grantee in ('anon','authenticated');
--   select column_name from information_schema.columns where table_name = 'document' and column_name in ('expense_id','supply_order_id');
