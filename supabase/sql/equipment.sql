-- Studio equipment — database part (docs/design/2026-11-28/Equipment.md step 2; Pem « Parallel 2-4 » 2026-11-28).
-- Applied on live 2026-11-28 on Pem's « apply equipment », after the throwaway test (equipment.test.sql, 13/13).
--
-- 1. stock_item: place_id (where it sits in the studio tree — place kinds studio / zone / furniture / container),
--    condition (bon · a_reparer · hors_service · prete), acquired_on (+ precision: a year is enough — « c. 2015 »),
--    photo_key (R2, same pipeline as other photos).
-- 2. document.stock_item_id (manual, invoice, warranty, safety sheet in the Vault) and studio_task.stock_item_id
--    (upkeep: recalibrate, sharpen…).
-- 3. save_stock_item(p): the one door for a Stock line — create or update, team only, all or nothing, stale-checked
--    on updated_at, only known fields, the place must be a studio place. The four browser writers of Stock move onto
--    it in the screens step (PhonePattern / Equipment step 3), not here.
-- No change to existing rows.

begin;

alter table public.stock_item add column if not exists place_id bigint references public.place(id) on delete set null;
alter table public.stock_item add column if not exists condition text;
alter table public.stock_item add column if not exists acquired_on date;
alter table public.stock_item add column if not exists acquired_precision text;
alter table public.stock_item add column if not exists photo_key text;
alter table public.stock_item drop constraint if exists stock_item_condition_ck;
alter table public.stock_item add constraint stock_item_condition_ck
  check (condition is null or condition in ('bon', 'a_reparer', 'hors_service', 'prete'));
alter table public.stock_item drop constraint if exists stock_item_acquired_precision_ck;
alter table public.stock_item add constraint stock_item_acquired_precision_ck
  check (acquired_precision is null or acquired_precision in ('day', 'month', 'year'));
create index if not exists stock_item_place_idx on public.stock_item (place_id) where place_id is not null;

alter table public.document add column if not exists stock_item_id bigint references public.stock_item(id) on delete set null;
create index if not exists document_stock_item_idx on public.document (stock_item_id) where stock_item_id is not null;
alter table public.studio_task add column if not exists stock_item_id bigint references public.stock_item(id) on delete set null;
create index if not exists studio_task_stock_item_idx on public.studio_task (stock_item_id) where stock_item_id is not null;

-- p = { id?: bigint (absent = create), read_updated_at?: timestamptz, fields: { name, category, quantity, unit, min_stock,
--       supplier_id, cost_unit, notes, place_id, condition, acquired_on, acquired_precision, photo_key } }
create or replace function public.save_stock_item(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  c_fields constant text[] := array['name', 'category', 'quantity', 'unit', 'min_stock', 'supplier_id', 'cost_unit', 'notes',
                                    'place_id', 'condition', 'acquired_on', 'acquired_precision', 'photo_key'];
  v_id bigint := nullif(p->>'id', '')::bigint;
  v_f jsonb := coalesce(p->'fields', '{}'::jsonb);
  v_old public.stock_item;
  v_new public.stock_item;
  k text;
  v_set text;
  v_cols text;
  v_vals text;
begin
  if not (public.is_admin() or public.is_team()) then
    return jsonb_build_object('refused', 'forbidden');
  end if;
  for k in select jsonb_object_keys(v_f) loop
    if not (k = any(c_fields)) then
      return jsonb_build_object('refused', 'bad_field', 'detail', k);
    end if;
  end loop;
  if v_f ? 'name' and nullif(btrim(v_f->>'name'), '') is null then
    return jsonb_build_object('refused', 'bad_field', 'detail', 'name');
  end if;
  if nullif(v_f->>'place_id', '') is not null and not exists (
       select 1 from public.place pl where pl.id = (v_f->>'place_id')::bigint and pl.archived_at is null
          and pl.kind in ('studio', 'zone', 'furniture', 'container')) then
    return jsonb_build_object('refused', 'bad_field', 'detail', 'place_id');
  end if;

  if v_id is null then
    if nullif(btrim(coalesce(v_f->>'name', '')), '') is null then
      return jsonb_build_object('refused', 'bad_field', 'detail', 'name');
    end if;
    select string_agg(format('%I', k2), ', '), string_agg(format('(jsonb_populate_record(null::public.stock_item, $1)).%I', k2), ', ')
      into v_cols, v_vals from jsonb_object_keys(v_f) k2;
    execute format('insert into public.stock_item (%s) values (%s) returning *', v_cols, v_vals) into v_new using v_f;
    return jsonb_build_object('ok', true, 'created', true, 'row', to_jsonb(v_new));
  end if;

  select * into v_old from public.stock_item where id = v_id for update;
  if not found then
    return jsonb_build_object('refused', 'not_found');
  end if;
  if p ? 'read_updated_at' and (p->>'read_updated_at')::timestamptz is distinct from v_old.updated_at then
    return jsonb_build_object('refused', 'stale', 'row', to_jsonb(v_old));
  end if;
  if v_f = '{}'::jsonb or to_jsonb(v_old) @> v_f then
    return jsonb_build_object('unchanged', true, 'row', to_jsonb(v_old));
  end if;
  v_new := jsonb_populate_record(v_old, v_f);
  select string_agg(format('%I = ($1).%I', k2, k2), ', ') into v_set from jsonb_object_keys(v_f) k2;
  execute format('update public.stock_item set %s, updated_at = now() where id = $2 returning *', v_set) into v_new using v_new, v_id;
  return jsonb_build_object('ok', true, 'row', to_jsonb(v_new));
end;
$$;
revoke execute on function public.save_stock_item(jsonb) from public, anon;
grant execute on function public.save_stock_item(jsonb) to authenticated;

commit;
