-- Test for append_contact_notes.sql — throwaway Postgres only, NEVER live:
--   psql -v ON_ERROR_STOP=1 -f append_contact_notes.test.sql   (from supabase/sql/)
drop table if exists public."Contact" cascade;
create table public."Contact" ("ContactID" int primary key, "Notes" text, is_private boolean);
do $$ begin create role anon; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
create or replace function public.is_admin() returns boolean language sql as $$ select current_setting('t.admin') = '1' $$;
create or replace function public.is_team() returns boolean language sql as $$ select current_setting('t.team') = '1' $$;
insert into public."Contact" values (1, null, false), (2, E'Old note\n\n', false), (3, 'Secret', true);
\i append_contact_notes.sql

do $$
declare r jsonb;
begin
  perform set_config('t.admin', '0', true); perform set_config('t.team', '1', true);
  r := public.append_contact_notes(1, 'Lien partagé');
  assert r->>'ok' = 'true' and (select "Notes" from public."Contact" where "ContactID" = 1) = 'Lien partagé', 'empty notes: ' || r;
  r := public.append_contact_notes(2, 'Deuxième');
  assert (select "Notes" from public."Contact" where "ContactID" = 2) = E'Old note\n\n---\n[Share]\nDeuxième', 'appended: ' || r;
  r := public.append_contact_notes(2, 'Troisième');
  assert (select "Notes" from public."Contact" where "ContactID" = 2) = E'Old note\n\n---\n[Share]\nDeuxième\n\n---\n[Share]\nTroisième', 'second share kept: ' || r;
  r := public.append_contact_notes(3, 'X');
  assert r->>'refused' = 'not_found' and (select "Notes" from public."Contact" where "ContactID" = 3) = 'Secret', 'private for team: ' || r;
  r := public.append_contact_notes(99, 'X');
  assert r->>'refused' = 'not_found', 'missing card: ' || r;
  r := public.append_contact_notes(1, E'  \n');
  assert r->>'unchanged' = 'true', 'empty block: ' || r;
  perform set_config('t.admin', '1', true);
  r := public.append_contact_notes(3, 'Admin');
  assert r->>'ok' = 'true', 'admin on private card: ' || r;
  perform set_config('t.admin', '0', true); perform set_config('t.team', '0', true);
  r := public.append_contact_notes(1, 'X');
  assert r->>'refused' = 'forbidden', 'outsider: ' || r;
  assert not has_function_privilege('anon', 'public.append_contact_notes(int, text)', 'execute'), 'anon cannot call';
  assert has_function_privilege('authenticated', 'public.append_contact_notes(int, text)', 'execute'), 'authenticated can call';
  raise notice 'append_contact_notes: 10/10 checks passed';
end $$;
