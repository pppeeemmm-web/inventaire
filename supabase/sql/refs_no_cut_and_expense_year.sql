-- Two small fixes (Pem 2026-11-18, supplies form: « Order ref fix: Fix now », « Expense year fix: Yes, fix »).
-- Found by the supplies session. APPLIED 2026-11-18, migration refs_no_cut_and_expense_year.
--
-- 1. Order and invoice numbers no longer cut past 999 / 9999: lpad(seq, 3) turned seq 1000 into « 100 »
--    (V-2026-1000 → V-2026-100, a clash). Now the number keeps all its digits (greatest(width, length)).
--    Only the one expression changes in each function; the rest of the function text is kept as it is live.
-- 2. An expense typed by hand saved with no fiscal_year (the form never sets it, no trigger), and the list
--    filters on it, so it did not show. Now the year comes from the expense date when it is empty.
--    Live on 2026-11-18: 7 expenses, all with a year — nothing to backfill.

do $$
declare
  v_def text;
begin
  select pg_get_functiondef('public.work_order_before_write()'::regprocedure) into v_def;
  if position('lpad(new.ref_seq::text, 3, ''0'')' in v_def) = 0 then
    raise exception 'work_order_before_write: expected lpad not found';
  end if;
  execute replace(v_def, 'lpad(new.ref_seq::text, 3, ''0'')',
                  'lpad(new.ref_seq::text, greatest(3, length(new.ref_seq::text)), ''0'')');

  select pg_get_functiondef('public.invoice_before_write()'::regprocedure) into v_def;
  if position('lpad(new.series_seq::text, 4, ''0'')' in v_def) = 0 then
    raise exception 'invoice_before_write: expected lpad not found';
  end if;
  execute replace(v_def, 'lpad(new.series_seq::text, 4, ''0'')',
                  'lpad(new.series_seq::text, greatest(4, length(new.series_seq::text)), ''0'')');
end;
$$;

create or replace function public.expense_fiscal_year_default()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.fiscal_year is null then
    new.fiscal_year := extract(year from coalesce(new.date, (now() at time zone 'Europe/Paris')::date))::int;
  end if;
  return new;
end;
$$;

revoke execute on function public.expense_fiscal_year_default() from public, anon, authenticated;

drop trigger if exists trg_expense_fiscal_year_default on public.expense;
create trigger trg_expense_fiscal_year_default
  before insert or update of fiscal_year, date on public.expense
  for each row execute function public.expense_fiscal_year_default();
