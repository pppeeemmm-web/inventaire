-- Test for equipment.sql — throwaway Postgres only, NEVER live:
--   psql -v ON_ERROR_STOP=1 -f equipment.test.sql   (from supabase/sql/)
drop table if exists public.studio_task, public.document, public.stock_item, public.place cascade;
do $$ begin create role anon; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
create or replace function public.is_admin() returns boolean language sql as $$ select current_setting('t.admin', true) = '1' $$;
create or replace function public.is_team() returns boolean language sql as $$ select current_setting('t.team', true) = '1' $$;
create table public.place (id bigint generated always as identity primary key, kind text not null, name text, archived_at timestamptz);
create table public.stock_item (id bigint generated always as identity primary key, name text not null, category text, quantity numeric not null default 0,
  unit text not null default '', min_stock numeric not null default 0, supplier_id integer, cost_unit numeric, notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.document (id uuid primary key default gen_random_uuid(), name text);
create table public.studio_task (id bigint generated always as identity primary key, action text);
insert into public.place (kind, name) values ('zone', 'Coin broyage'), ('address', '1 rue X'), ('furniture', 'Étagère A');
insert into public.stock_item (name, quantity) values ('Calcite', 500);

\i equipment.sql

do $$
declare r jsonb; v_id bigint; ok boolean;
begin
  perform set_config('t.team', '1', true); perform set_config('t.admin', '0', true);
  r := public.save_stock_item('{"fields": {"name": "Molette en verre", "category": "Équipement", "quantity": 1, "place_id": 3, "condition": "bon", "acquired_on": "2015-01-01", "acquired_precision": "year"}}');
  assert r->>'ok' = 'true' and r->>'created' = 'true', 'create: ' || r;
  v_id := (r->'row'->>'id')::bigint;
  assert (select place_id from public.stock_item where id = v_id) = 3, 'placed';
  r := public.save_stock_item(jsonb_build_object('id', v_id, 'fields', jsonb_build_object('condition', 'a_reparer')));
  assert r->>'ok' = 'true' and (select condition from public.stock_item where id = v_id) = 'a_reparer', 'update: ' || r;
  r := public.save_stock_item(jsonb_build_object('id', v_id, 'fields', jsonb_build_object('condition', 'a_reparer')));
  assert r->>'unchanged' = 'true', 'unchanged: ' || r;
  r := public.save_stock_item(jsonb_build_object('id', v_id, 'read_updated_at', '2000-01-01T00:00:00Z', 'fields', jsonb_build_object('notes', 'x')));
  assert r->>'refused' = 'stale', 'stale: ' || r;
  r := public.save_stock_item(jsonb_build_object('id', v_id, 'fields', jsonb_build_object('place_id', 2)));
  assert r->>'refused' = 'bad_field' and r->>'detail' = 'place_id', 'an address is not a studio place: ' || r;
  r := public.save_stock_item(jsonb_build_object('id', v_id, 'fields', jsonb_build_object('quantity_hack', 1)));
  assert r->>'refused' = 'bad_field', 'unknown field: ' || r;
  r := public.save_stock_item('{"fields": {"name": "  "}}');
  assert r->>'refused' = 'bad_field', 'empty name: ' || r;
  r := public.save_stock_item('{"id": 999, "fields": {"notes": "x"}}');
  assert r->>'refused' = 'not_found', 'missing: ' || r;
  ok := false; begin update public.stock_item set condition = 'cassé' where id = v_id; exception when check_violation then ok := true; end;
  assert ok, 'condition list enforced';
  perform set_config('t.team', '0', true);
  r := public.save_stock_item('{"fields": {"name": "x"}}');
  assert r->>'refused' = 'forbidden', 'outsider: ' || r;
  assert not has_function_privilege('anon', 'public.save_stock_item(jsonb)', 'execute'), 'anon cannot call';
  assert exists (select 1 from information_schema.columns where table_name = 'document' and column_name = 'stock_item_id'), 'document link';
  assert exists (select 1 from information_schema.columns where table_name = 'studio_task' and column_name = 'stock_item_id'), 'task link';
  raise notice 'equipment: 13/13 checks passed';
end $$;
