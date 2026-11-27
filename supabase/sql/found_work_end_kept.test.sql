-- Test for found_work_end_kept.sql — run on a throwaway Postgres only, NEVER on live:
--   psql -v ON_ERROR_STOP=1 -f found_work_end_kept.test.sql   (from supabase/sql/)
-- Builds a minimal public."Oeuvres" with the columns the trigger reads, loads the proposed function and the live
-- trigger definition, then checks each case. Any failed check raises an error.
drop table if exists public."Oeuvres";
create table public."Oeuvres" (
  "OeuvreID" int primary key,
  "Catalogué" boolean, "NeedsPhotograph" boolean, "statusId" int, "Année" date, "Historique" text,
  production_origin text,
  production_started_on date, production_completed_on date,
  production_started_precision text, production_completed_precision text
);
\i found_work_end_kept.sql
create trigger trg_oeuvre_production_span
  before insert or update of "Catalogué", "NeedsPhotograph", "statusId", "Année", production_started_on,
    production_completed_on, production_started_precision, production_completed_precision on public."Oeuvres"
  for each row execute function public.oeuvre_production_span();

-- 1 found, end 1999 (year), catalogued, photo to take  ·  2 same, new work  ·  3 found with no end yet
-- 4 found, Prêt, end 1999  ·  5 new, Prêt, end 2025
insert into public."Oeuvres" values
  (1, true, true,  1, '1999-01-01', 'h', 'found', null, '1999-01-01', null, 'year'),
  (2, true, true,  1, '1999-01-01', 'h', 'new',   null, '1999-01-01', null, 'year'),
  (3, true, true,  1, '1999-01-01', 'h', 'found', null, null,         null, null),
  (4, true, false, 2, '1999-01-01', 'h', 'found', null, '1999-01-01', null, 'year'),
  (5, true, false, 2, '2025-01-01', 'h', 'new',   null, '2025-06-01', null, null);

-- Validate the photo of 1, 2, 3 (becomes Prêt).
update public."Oeuvres" set "NeedsPhotograph" = false where "OeuvreID" in (1, 2, 3);
-- New photo to take on 4 and 5 (leaves Prêt).
update public."Oeuvres" set "NeedsPhotograph" = true where "OeuvreID" in (4, 5);

do $$
declare r record; today date := (now() at time zone 'Europe/Paris')::date;
begin
  select * into r from public."Oeuvres" where "OeuvreID" = 1;
  assert r.production_completed_on = '1999-01-01' and r.production_completed_precision = 'year', 'found → Prêt keeps 1999';
  select * into r from public."Oeuvres" where "OeuvreID" = 2;
  assert r.production_completed_on = today and r.production_completed_precision is null, 'new → Prêt = today (unchanged rule)';
  select * into r from public."Oeuvres" where "OeuvreID" = 3;
  assert r.production_completed_on is null, 'found with no end → Prêt stays empty (never today)';
  select * into r from public."Oeuvres" where "OeuvreID" = 4;
  assert r.production_completed_on = '1999-01-01' and r."Historique" = 'h', 'found leaves Prêt: end and Historique kept';
  select * into r from public."Oeuvres" where "OeuvreID" = 5;
  assert r.production_completed_on is null and r."Historique" like 'h%Reprise en production%', 'new leaves Prêt: cleared + line (unchanged rule)';
  raise notice 'found_work_end_kept: 5/5 checks passed';
end $$;
