-- Test for found_work_history_line.sql — throwaway Postgres only, NEVER live:
--   psql -v ON_ERROR_STOP=1 -f found_work_history_line.test.sql   (from supabase/sql/)
-- Minimal tables / stubs with the columns the trigger reads; loads the proposal (function + one-off), checks lines.
drop table if exists public."Oeuvres", public.condition_report cascade;
create table public."Oeuvres" (
  "OeuvreID" int primary key, "Historique" text, "Année" date, production_origin text,
  fate text, fate_on date, fate_precision text, "statusId" int, "ContactID" int, "LocalisationID" int, "AcheteurID" int
);
create table public.condition_report (id int, oeuvre_id int, kind text, examined_on date, event_on date, resolved_on date, updated_at timestamptz);
create or replace function public.oeuvre_contact_label(id int, short boolean default false) returns text
  language sql as $$ select 'Contact ' || id $$;

-- One-off rows first (the proposal's update runs when the file is loaded).
insert into public."Oeuvres" ("OeuvreID", "Historique", "Année", production_origin, "statusId", "ContactID") values
  (2410, '[2026/11/24] Atelier', '1999-01-01', 'found', 1, 13),
  (2411, '[2026/11/24] Atelier', '1999-01-01', 'found', 1, 13),
  (2412, '[2026/11/24] Atelier' || E'\n' || '[2026/11/25] note', '1999-01-01', 'found', 1, 13),
  (1, '[2026/01/01] Atelier', '1999-01-01', null, 1, 13),   -- becomes found, year known
  (2, '[2026/01/01] Atelier', null, 'new', 1, 13),           -- becomes found, no year
  (3, '[2026/01/01] Atelier', '2001-01-01', 'found', 1, 13), -- already found: no new line
  (4, '[2026/01/01] Atelier', null, 'new', 1, 13);           -- status change only (regression)

\i found_work_history_line.sql
create trigger trg_zz_oeuvre_history before update on public."Oeuvres" for each row execute function public.oeuvre_history();

update public."Oeuvres" set production_origin = 'found' where "OeuvreID" in (1, 2);
update public."Oeuvres" set "Année" = '2002-01-01' where "OeuvreID" = 3;
update public."Oeuvres" set "statusId" = 2 where "OeuvreID" = 4;
update public."Oeuvres" set production_origin = 'found' where "OeuvreID" = 1; -- again: no duplicate

do $$
declare h text; d text := to_char((now() at time zone 'Europe/Paris')::date, 'YYYY/MM/DD');
begin
  select "Historique" into h from public."Oeuvres" where "OeuvreID" = 2410;
  assert h = '[2026/11/24] Retrouvée — œuvre oubliée, jamais cataloguée (1999)', 'one-off #2410: ' || h;
  select "Historique" into h from public."Oeuvres" where "OeuvreID" = 2412;
  assert h = '[2026/11/24] Retrouvée — œuvre oubliée, jamais cataloguée (1999)' || E'\n' || '[2026/11/25] note', 'one-off keeps later lines: ' || h;
  select "Historique" into h from public."Oeuvres" where "OeuvreID" = 1;
  assert h = '[2026/01/01] Atelier' || E'\n' || '[' || d || '] Retrouvée — œuvre oubliée, jamais cataloguée (1999)', 'found, year: ' || h;
  select "Historique" into h from public."Oeuvres" where "OeuvreID" = 2;
  assert h = '[2026/01/01] Atelier' || E'\n' || '[' || d || '] Retrouvée — œuvre oubliée, jamais cataloguée', 'found, no year: ' || h;
  select "Historique" into h from public."Oeuvres" where "OeuvreID" = 3;
  assert h = '[2026/01/01] Atelier', 'already found, no line: ' || h;
  select "Historique" into h from public."Oeuvres" where "OeuvreID" = 4;
  assert h = '[2026/01/01] Atelier' || E'\n' || '[' || d || '] En production → Disponible', 'status line unchanged: ' || h;
  raise notice 'found_work_history_line: 6/6 checks passed';
end $$;
