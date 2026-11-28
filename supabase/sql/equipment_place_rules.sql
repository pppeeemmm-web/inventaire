-- Equipment place rules (Pem OK 2026-11-28, « Ok and ok »; flow review of the Équipement build).
-- 1. The Stock door accepts a place only inside the studio tree: a live place of kind studio / zone / furniture /
--    container whose chain of parents reaches a `studio`. A contact's floor (a `zone` under an `address`,
--    save_contact_places) is refused. Names at most 120 characters (the rule in the database, principle 1).
-- 2. A place holding Stock lines (`stock_item.place_id`) cannot be archived, like a place holding works.
-- Built from the live bodies (md5 guards below; save_stock_item = equipment.sql, place_never_deleted =
-- places_phase_b_switch.sql). Readers: Équipement (listEquipment walks the same tree), deletePlace (place_not_empty).
begin;

do $$
begin
  if md5(pg_get_functiondef('public.save_stock_item(jsonb)'::regprocedure)) <> '3c39f04efbc3408ad00d67b35e335f60' then
    raise exception 'save_stock_item changed live since 2026-11-28: rebuild this file from the live body';
  end if;
  if md5(pg_get_functiondef('public.place_never_deleted()'::regprocedure)) <> 'f5bc2d889ecc7926edfcf253ee383073' then
    raise exception 'place_never_deleted changed live since 2026-11-28: rebuild this file from the live body';
  end if;
end $$;

-- Helper, not a door: only the definer door calls it (principle 4).
create or replace function public.place_in_studio(p_id bigint)
returns boolean
language sql
stable
set search_path to ''
as $$
  with recursive up as (
    select pl.id, pl.parent_id, pl.kind, 0 as depth
      from public.place pl
     where pl.id = p_id and pl.archived_at is null and pl.kind in ('studio', 'zone', 'furniture', 'container')
    union all
    select q.id, q.parent_id, q.kind, up.depth + 1
      from public.place q join up on q.id = up.parent_id
     where up.kind <> 'studio' and up.depth < 20 and q.kind in ('studio', 'zone', 'furniture', 'container')
  )
  select exists (select 1 from up where up.kind = 'studio');
$$;
revoke all on function public.place_in_studio(bigint) from public, anon, authenticated;

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
  if not coalesce(public.is_admin() or public.is_team(), false) then  -- an unknown answer counts as « no »
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
  if v_f ? 'name' and length(btrim(v_f->>'name')) > 120 then
    return jsonb_build_object('refused', 'bad_field', 'detail', 'name');
  end if;
  if nullif(v_f->>'place_id', '') is not null and not public.place_in_studio((v_f->>'place_id')::bigint) then
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

create or replace function public.place_never_deleted()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
declare
  n_works int;
  n_kids  int;
  n_stock int;
begin
  if tg_op = 'DELETE' then
    raise exception 'place_never_deleted' using hint = 'Un lieu s''archive, il ne se supprime pas.';
  end if;
  if new.archived_at is not null and old.archived_at is null then
    select count(*) into n_works from "Oeuvres"
     where (place_id = new.id or home_place_id = new.id) and deleted_at is null;
    select count(*) into n_kids from place where parent_id = new.id and archived_at is null;
    select count(*) into n_stock from stock_item where place_id = new.id;
    if n_works > 0 or n_kids > 0 or n_stock > 0 then
      raise exception 'place_not_empty'
        using detail = format('%s works, %s places, %s stock lines inside', n_works, n_kids, n_stock),
              hint = 'Déplacer d''abord ce qui est dedans.';
    end if;
  end if;
  return coalesce(new, old);
end;
$function$;

commit;
