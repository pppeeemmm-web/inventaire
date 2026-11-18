-- Two clicks at the same moment (two tabs, two people) — stress test 2026-11-18, B1 and B2
-- (docs/design/2026-11-18/StressTest.notes.md). The app checks then writes; two requests at once both
-- passed the check. These two triggers make the database refuse the second one.
-- APPLIED 2026-11-18 (migration order_race_guards), after the code was live (x-build-sha 6f43117), on Pem's
-- « Yes, after landing ». Tested on the local stress copy first.
--
-- 1. One open order per work and family (B1): a work's line can be active on one open sale / gift and on
--    one open consignment / loan / entrusted at most — the same rule as busyWorks() in orders-actions.ts.
--    A lock per work makes two inserts at once wait for each other; the second sees the first and is
--    refused with « ord_err_busy:#<work> » (createWorkOrder already shows that message and cancels its draft).
-- 2. Money in never goes above what the buyer owes (B2): price_final + shipping_charge (shipping is invoiced on
--    top). A payment on a sale locks its order row, adds what is already recorded and refuses the amount if the
--    total would pass it (« ord_err_overpaid »).
--    Two full « Encaisser » at once: the first is recorded, the second refused.
-- Existing rows are not checked; only new lines / payments (and lines put back to active).

create or replace function public.work_order_line_one_open()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  k text;
  fam text[];
begin
  if new.line_status is distinct from 'active' then
    return new;
  end if;
  select kind into k from work_order where id = new.order_id;
  fam := case when k in ('sale', 'gift') then array['sale', 'gift'] else array['consignment', 'loan', 'entrusted'] end;
  perform pg_advisory_xact_lock(hashtext('work_order_line'), new.oeuvre_id);
  if exists (
    select 1
      from work_order_work l
      join work_order o on o.id = l.order_id
     where l.oeuvre_id = new.oeuvre_id
       and l.line_status = 'active'
       and l.id is distinct from new.id
       and l.order_id <> new.order_id
       and o.kind = any (fam)
       and o.status not in ('closed', 'cancelled', 'delivered', 'handed_over')
  ) then
    raise exception 'ord_err_busy:#%', new.oeuvre_id using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists work_order_line_one_open on public.work_order_work;
create trigger work_order_line_one_open
  before insert or update of line_status, oeuvre_id, order_id on public.work_order_work
  for each row execute function public.work_order_line_one_open();

create or replace function public.payments_within_price()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  k text;
  price numeric;
  paid numeric;
begin
  -- The row lock makes two payments on one order wait for each other; the sum below then sees the first.
  select kind, price_final + coalesce(shipping_charge, 0) into k, price from work_order where id = new.work_order_id for update;
  if k is distinct from 'sale' or price is null then
    return new;
  end if;
  select coalesce(sum(amount), 0) into paid
    from payments
   where work_order_id = new.work_order_id and id is distinct from new.id;
  if paid + new.amount > price + 0.005 then
    raise exception 'ord_err_overpaid' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists payments_within_price on public.payments;
create trigger payments_within_price
  before insert or update of amount, work_order_id on public.payments
  for each row execute function public.payments_within_price();
