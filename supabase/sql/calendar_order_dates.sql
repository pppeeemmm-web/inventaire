-- Calendar: order dates pushed to the user's calendar (Pem 2026-11-18: GO), like exhibitions today.
-- One calendar event per order date: out / back (deposit, loan, Confié), delivery (sale), end of the 14-day return.
-- APPLIED LIVE 2026-11-18 (Pem: « Apply both »), migration calendar_order_dates. 0 rows, 0 accounts connected that day.
-- After applying: `npm run gen:types`, flip ORDER_CALENDAR_LIVE in lib/calendar/sync-order.ts.

begin;

alter table public.calendar_event_link
  add column if not exists work_order_id uuid references public.work_order(id) on delete cascade,
  add column if not exists date_key      text;

alter table public.calendar_event_link drop constraint if exists calendar_event_link_check;
alter table public.calendar_event_link add constraint calendar_event_link_check check (
     (suivi_process_id is not null and suivi_etape_id is null and work_order_id is null)
  or (suivi_process_id is null and suivi_etape_id is not null and work_order_id is null)
  or (suivi_process_id is null and suivi_etape_id is null and work_order_id is not null
      and date_key in ('start', 'end', 'delivery', 'return_end'))
);

create unique index if not exists calendar_event_link_order_uniq
  on public.calendar_event_link (calendar_account_id, work_order_id, date_key) where work_order_id is not null;

commit;
