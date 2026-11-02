-- Cost per work (S6 / pic 10, owner GO 2026-11-02): an expense can be attributed to one or
-- more works, so each work shows what it cost (production, shipping, storage…) and its margin.
--
-- One row per (expense, work). `amount` = this work's part of the expense; null = split the
-- expense TTC evenly across all works linked to it. Cost category = `expense.category`.
--
-- Owner enters costs alone for now: read and write are admin-only (RLS `is_admin()`), and
-- the drawer shows the cost block to the admin only. Expenses themselves keep their team policy.
-- After applying: npm run gen:types

create table if not exists public.expense_oeuvre (
  expense_id bigint  not null references public.expense(id) on delete cascade,
  oeuvre_id  integer not null references public."Oeuvres"("OeuvreID") on delete cascade,
  amount     numeric(10,2) check (amount is null or amount >= 0),
  created_at timestamptz not null default now(),
  primary key (expense_id, oeuvre_id)
);

comment on table public.expense_oeuvre is
  'Expense attributed to a work (cost per work). amount null = expense TTC split evenly across its linked works. Admin-only.';

create index if not exists expense_oeuvre_oeuvre_idx on public.expense_oeuvre (oeuvre_id);

alter table public.expense_oeuvre enable row level security;

drop policy if exists expense_oeuvre_admin_all on public.expense_oeuvre;
create policy expense_oeuvre_admin_all on public.expense_oeuvre
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select, insert, update, delete on public.expense_oeuvre to authenticated;
-- Supabase default privileges hand new tables to anon too; costs are internal.
revoke all on public.expense_oeuvre from anon;
