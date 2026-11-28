-- Test for laboratoire.sql — throwaway Postgres only, NEVER live:
--   psql -v ON_ERROR_STOP=1 -f laboratoire.test.sql   (from supabase/sql/)
-- Stubs: concept, stock_item, journal_entry(+_link), auth.uid / is_admin / is_team read settings.
drop table if exists public.lab_assessment, public.recipe_step, public.recipe_ingredient, public.journal_entry_link,
  public.journal_entry, public.stock_item, public.concept cascade;
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql as $$ select nullif(current_setting('t.uid', true), '')::uuid $$;
create or replace function public.is_admin() returns boolean language sql as $$ select current_setting('t.admin', true) = '1' $$;
create or replace function public.is_team() returns boolean language sql as $$ select true $$;
do $$ begin create role anon; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
create table public.concept (id uuid primary key default gen_random_uuid(), titre text, parent_id uuid references public.concept(id),
  updated_at timestamptz not null default now());
create table public.stock_item (id bigint generated always as identity primary key, name text);
create table public.journal_entry (id bigint generated always as identity primary key, body text);
create table public.journal_entry_link (id bigint generated always as identity primary key, entry_id bigint, concept_id uuid);
insert into public.concept (id, titre) values
  ('6943645e-ff9b-46eb-96cc-69048b503699', 'Laboratoire'),
  ('0e8d1bac-39c1-470c-99c6-74865f478cb4', 'Oil'),
  ('a81d7d90-a2ca-4bf5-87cc-b677988cf4c2', 'Temperone'),
  ('11111111-1111-1111-1111-111111111111', 'Ordinary idea');
insert into public.stock_item (name) values ('Calcite'), ('Molette');
insert into public.journal_entry (body) values ('trial');

\i laboratoire.sql

do $$
declare r jsonb; v_rec uuid; ok boolean;
begin
  assert (select lab_role from public.concept where id = '6943645e-ff9b-46eb-96cc-69048b503699') = 'champ', 'field role';
  assert (select count(*) from public.concept where lab_role = 'conjecture') = 2, 'two conjectures';
  -- a recipe, written by an admin
  perform set_config('t.uid', 'aaaaaaaa-0000-0000-0000-000000000000', true); perform set_config('t.admin', '1', true);
  insert into public.concept (titre, lab_role, parent_id) values ('Budget de blancs', 'recette', '6943645e-ff9b-46eb-96cc-69048b503699') returning id into v_rec;
  r := public.save_recipe(jsonb_build_object('id', v_rec, 'version', 1,
        'ingredients', jsonb_build_array(jsonb_build_object('stock_item_id', 1, 'ratio_pct', 70), jsonb_build_object('label', 'Zirconium', 'ratio_pct', 5)),
        'steps', jsonb_build_array(jsonb_build_object('body', 'Broyer 10 min', 'equipment_stock_item_id', 2), jsonb_build_object('body', 'Repos', 'duration', '24 h')),
        'assessments', jsonb_build_array(jsonb_build_object('criterion', 'optical', 'source', 'literature', 'sign', 'ok', 'score', 4))));
  assert r->>'ok' = 'true', 'save: ' || r;
  assert (select count(*) from public.recipe_ingredient where recipe_id = v_rec) = 2, 'two ingredients';
  assert (select string_agg(body, '|' order by position) from public.recipe_step where recipe_id = v_rec) = 'Broyer 10 min|Repos', 'steps in order';
  -- stale
  r := public.save_recipe(jsonb_build_object('id', v_rec, 'read_updated_at', '2000-01-01T00:00:00Z', 'steps', '[]'::jsonb));
  assert r->>'refused' = 'stale', 'stale: ' || r;
  -- recipe-only kinds on a conjecture
  r := public.save_recipe(jsonb_build_object('id', '0e8d1bac-39c1-470c-99c6-74865f478cb4', 'steps', '[]'::jsonb));
  assert r->>'refused' = 'bad_field', 'steps on a conjecture: ' || r;
  -- an ordinary idea is not a recipe
  r := public.save_recipe(jsonb_build_object('id', '11111111-1111-1111-1111-111111111111', 'assessments', '[]'::jsonb));
  assert r->>'refused' = 'not_found', 'ordinary idea: ' || r;
  -- a team member: refused at the door and at the guards; ordinary ideas untouched
  perform set_config('t.uid', 'bbbbbbbb-0000-0000-0000-000000000000', true); perform set_config('t.admin', '0', true);
  r := public.save_recipe(jsonb_build_object('id', v_rec, 'steps', '[]'::jsonb));
  assert r->>'refused' = 'forbidden', 'team at the door: ' || r;
  ok := false; begin update public.concept set titre = 'x' where id = v_rec; exception when insufficient_privilege then ok := true; end;
  assert ok, 'team cannot edit a lab idea';
  ok := false; begin insert into public.concept (titre, parent_id) values ('sneak', '6943645e-ff9b-46eb-96cc-69048b503699'); exception when insufficient_privilege then ok := true; end;
  assert ok, 'team cannot add under the Laboratoire';
  ok := false; begin insert into public.journal_entry_link (entry_id, concept_id) values (1, v_rec); exception when insufficient_privilege then ok := true; end;
  assert ok, 'team cannot link a trial';
  update public.concept set titre = 'Ordinary, edited' where id = '11111111-1111-1111-1111-111111111111';
  assert (select titre from public.concept where id = '11111111-1111-1111-1111-111111111111') = 'Ordinary, edited', 'ordinary ideas unchanged';
  -- grants
  assert not has_table_privilege('authenticated', 'public.recipe_step', 'insert'), 'no direct writes';
  assert has_table_privilege('authenticated', 'public.recipe_step', 'select'), 'team reads';
  assert not has_function_privilege('anon', 'public.save_recipe(jsonb)', 'execute'), 'anon cannot call the door';
  raise notice 'laboratoire: 14/14 checks passed';
end $$;
