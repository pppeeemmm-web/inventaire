-- Works recorded through the phone (field sessions) before 2026-11-08 carry no date at all:
-- no "Année", no production start / end. Their period is read from a date, so they show none
-- (Pem 2026-11-14, Inventory screenshot #2350–#2355: "they were recent, 2026 obviously … all
-- Marseille periods. Why are there discrepancies?").
--
-- Cause: the new / found choice (production start = session day) only arrived 2026-11-08;
-- before it, creating a work from a session wrote the day only into Historique
-- (« [2026/06/29] Session terrain »).
--
-- Fix (data, once): for each such work (no Année, no production dates, no dated creation line,
-- linked to at least one field session — 46 works, sessions 2026-05-31 → 2026-09-28):
--   1. "Année" = the year of its first field session (stored YYYY-01-01 = a year, not a day);
--   2. one « Historique de création » line: Travaillée, dated that day, linked to that session.
-- Every first-session day falls in the Marseille period (from 2024-06-13), so each work reads
-- Marseille from its date. Nothing else is touched; Oeuvres changes are versioned by trigger.

with first_session as (
  select distinct on ((i ->> 'oeuvre_id')::int)
         (i ->> 'oeuvre_id')::int as oeuvre_id,
         coalesce((ws.payload ->> 'session_day')::date, (ws.created_at at time zone 'Europe/Paris')::date) as day,
         ws.id as session_id
    from public.work_session ws,
         jsonb_array_elements(ws.payload -> 'items') i
   where (i ->> 'oeuvre_id') ~ '^\d+$'
   order by (i ->> 'oeuvre_id')::int,
            coalesce((ws.payload ->> 'session_day')::date, (ws.created_at at time zone 'Europe/Paris')::date)
),
targets as (
  select f.*
    from first_session f
    join public."Oeuvres" o on o."OeuvreID" = f.oeuvre_id
   where o."Année" is null
     and o.production_started_on is null
     and o.production_completed_on is null
     and not exists (select 1 from public.work_creation_step c where c.oeuvre_id = f.oeuvre_id and c.on_date is not null)
),
years as (
  update public."Oeuvres" o
     set "Année" = make_date(extract(year from t.day)::int, 1, 1)
    from targets t
   where o."OeuvreID" = t.oeuvre_id
  returning o."OeuvreID"
)
insert into public.work_creation_step (oeuvre_id, on_date, date_precision, kind, work_session_id)
select t.oeuvre_id, t.day, 'day', 'worked', t.session_id
  from targets t
  join years y on y."OeuvreID" = t.oeuvre_id;
