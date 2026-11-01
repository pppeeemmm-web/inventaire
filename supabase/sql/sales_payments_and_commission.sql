-- Money pipeline repair (S4, 2026-11-01). sale_order = source of truth for income.
--
-- Found in prod: `payments` never existed (postgres log "relation \"payments\" does not exist",
-- 2026-10-31) and commission_tracking.sql was never applied, so createSaleOrder (always sends
-- consignment_order_id) and addPayment / fetchPayments all failed.
--
-- Additive only. RLS mirrors consignment_order: team read/insert/update, admin delete.
-- No anon grant: payments are internal.
-- After applying: npm run gen:types

-- 1. Commission columns (was supabase/sql/commission_tracking.sql, never applied).
alter table public.consignment_order
  add column if not exists commission_pct numeric(5,2) default 0;

alter table public.sale_order
  add column if not exists consignment_order_id uuid references public.consignment_order(id) on delete set null,
  add column if not exists commission_amount numeric(10,2);

create index if not exists idx_sale_order_consignment on public.sale_order(consignment_order_id);

-- 2. Payments received against a sale order (deposit, balance, instalments).
create table if not exists public.payments (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.sale_order(id) on delete cascade,
  amount       numeric(12,2) not null check (amount > 0),
  payment_date date not null default ((now() at time zone 'Europe/Paris')::date),
  method       text,
  notes        text,
  created_at   timestamptz not null default now()
);

comment on table public.payments is
  'Money received for a sale_order. Sum per order = amount paid; Fiscal recettes read this by payment_date.';

create index if not exists idx_payments_order on public.payments(order_id);
create index if not exists idx_payments_date on public.payments(payment_date);

alter table public.payments enable row level security;

drop policy if exists payments_team_select on public.payments;
create policy payments_team_select on public.payments
  for select to authenticated using (public.is_team());

drop policy if exists payments_team_insert on public.payments;
create policy payments_team_insert on public.payments
  for insert to authenticated with check (public.is_team());

drop policy if exists payments_team_update on public.payments;
create policy payments_team_update on public.payments
  for update to authenticated using (public.is_team()) with check (public.is_team());

drop policy if exists payments_admin_delete on public.payments;
create policy payments_admin_delete on public.payments
  for delete to authenticated using (public.is_admin());

grant select, insert, update, delete on public.payments to authenticated;
-- Supabase default privileges hand new tables to anon too; payments are internal.
revoke all on public.payments from anon;
