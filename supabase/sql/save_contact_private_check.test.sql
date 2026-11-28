-- Test for save_contact_private_check.sql — throwaway Postgres only, NEVER live:
--   psql -v ON_ERROR_STOP=1 -f save_contact_private_check.test.sql   (from supabase/sql/)
-- Stubs: a minimal Contact, system_log, is_admin / is_team read a setting, _contact_card. Lists are not exercised.
drop table if exists public."Contact", public.system_log cascade;
create table public."Contact" ("ContactID" serial primary key, "Nom" text, "Prénom" text, "Email" text, is_private boolean,
  is_team_member boolean, "IsTeamMember" boolean, "Adresse" text, "CodePostal" text, "Ville" text, "Pays" text);
create table public.system_log (id serial, action text, event_type text, table_name text, row_id text, old_value jsonb,
  new_value jsonb, author_id uuid, user_id uuid);
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql as $$ select null::uuid $$;
create or replace function public.is_admin() returns boolean language sql as $$ select current_setting('t.admin') = '1' $$;
create or replace function public.is_team() returns boolean language sql as $$ select true $$;
create or replace function public._contact_card(int) returns jsonb language sql as $$ select '{}'::jsonb $$;
insert into public."Contact" ("ContactID", "Nom", is_private) values (1, 'Privé', true), (2, 'Public', false);
select setval(pg_get_serial_sequence('public."Contact"', 'ContactID'), 2);

-- The guard compares against the live body, absent here: load only the function (everything from CREATE OR REPLACE).
\! sed -n '/^CREATE OR REPLACE FUNCTION/,$p' save_contact_private_check.sql > /tmp/scpc_body.sql
\i /tmp/scpc_body.sql

do $$
declare r jsonb;
begin
  perform set_config('t.admin', '0', true);
  r := public.save_contact('{"id": 1, "fields": {"Nom": "X"}}');
  assert r->>'refused' = 'not_found', 'team on private card: ' || r;
  r := public.save_contact('{"id": 1, "fields": {}}');
  assert r->>'refused' = 'not_found', 'team on private card, nothing changed (no leak): ' || r;
  r := public.save_contact('{"id": 2, "fields": {"Nom": "Public 2"}}');
  assert r->>'ok' = 'true' and (select "Nom" from public."Contact" where "ContactID" = 2) = 'Public 2', 'team on public card: ' || r;
  assert (select count(*) from public.system_log where row_id = '2') = 1, 'team change logged';
  r := public.save_contact('{"id": null, "fields": {"Nom": "Nouveau"}}');
  assert r->>'ok' = 'true', 'team creates: ' || r;
  perform set_config('t.admin', '1', true);
  r := public.save_contact('{"id": 1, "fields": {"Nom": "Privé 2"}}');
  assert r->>'ok' = 'true' and (select "Nom" from public."Contact" where "ContactID" = 1) = 'Privé 2', 'admin on private card: ' || r;
  raise notice 'save_contact_private_check: 6/6 checks passed';
end $$;
