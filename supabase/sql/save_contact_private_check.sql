-- save_contact: a private card is « not found » for a non-admin (TODO §1, flow review 2026-11-27; Pem « Launch three
-- batches to tackle the full list »). Built from the LIVE body (md5 de8d85eb…, read 2026-11-27 late — the repo copy
-- save_contact_fn.sql is older); one change: the « not found » test after the row lock also covers a private card
-- when the caller is not an admin — the same rule as archive_contact / set_contact_spheres / save_person_link.
-- Grants unchanged (create or replace keeps them). Test: save_contact_private_check.test.sql (throwaway only).
-- Applied only on Pem's own OK.

-- Guard: stop if live is no longer the body this was built from.
do $g$ begin
  if (select md5(prosrc) from pg_proc where oid = 'public.save_contact(jsonb)'::regprocedure) <> 'de8d85ebeab8c75e9b2ceba0b7aaa5f8' then
    raise exception 'save_contact changed on live since 2026-11-27 — rebuild this file from it';
  end if;
end $g$;

CREATE OR REPLACE FUNCTION public.save_contact(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  c_fields constant text[] := array[
    'NomInstitution', 'Nom', 'Prénom', 'Genre', 'Role', 'Type', 'TypeContact', 'Email',
    'IndicatifPays1', 'Téléphone1', 'IndicatifPays2', 'Téléphone2',
    'PersonneResponsable', 'RoleResponsable', 'Notes', 'Actif', 'PropriétaireOeuvre', 'born_on', 'born_precision', 'died_on', 'died_precision',
    'is_private', 'is_team_member', 'IsTeamMember'];
  c_admin constant text[] := array['is_private', 'is_team_member', 'IsTeamMember'];
  c_kinds constant jsonb := jsonb_build_object(
    'addresses', jsonb_build_object('t', 'contact_place_lines',
                   'c', jsonb_build_array('label', 'adresse', 'code_postal', 'ville', 'pays', 'complement',
                                          'shipping_notes', 'is_primary', 'position')),
    'emails',    jsonb_build_object('t', 'contact_emails',    'c', jsonb_build_array('email', 'label', 'is_primary')),
    'phones',    jsonb_build_object('t', 'contact_phones',    'c', jsonb_build_array('phone', 'country_code', 'label', 'is_primary')),
    'websites',  jsonb_build_object('t', 'contact_websites',  'c', jsonb_build_array('url', 'label')),
    'socials',   jsonb_build_object('t', 'contact_socials',   'c', jsonb_build_array('platform', 'handle')));

  v_admin boolean := public.is_admin();
  v_id int := nullif(p->>'id', '')::int;
  v_fields jsonb := coalesce(p->'fields', '{}'::jsonb);
  v_read jsonb := nullif(p->'read', 'null'::jsonb);
  v_lists jsonb := coalesce(nullif(p->'lists', 'null'::jsonb), '{}'::jsonb);
  v_read_lists jsonb := nullif(p->'read_lists', 'null'::jsonb);
  v_base text;

  v_old public."Contact";
  v_new public."Contact";
  v_oldj jsonb;
  v_write jsonb := '{}'::jsonb;
  v_changed text[] := '{}';
  v_kinds_changed text[] := '{}';
  k text;
  v_kind text;
  v_table text;
  v_cols text[];
  v_rows jsonb;
  v_stored jsonb;
  v_pi int;
  v_set text;
  v_ins_cols text;
  v_ins_vals text;
  v_places jsonb;
  v_email text;
  v_first_addr jsonb;
begin
  if not (v_admin or public.is_team()) then
    return jsonb_build_object('refused', 'forbidden');
  end if;

  for k in select jsonb_object_keys(v_fields) loop
    if not (k = any(c_fields)) then
      return jsonb_build_object('refused', 'bad_field', 'detail', k);
    end if;
  end loop;
  for k in select jsonb_object_keys(v_lists) loop
    if not (c_kinds ? k) then
      return jsonb_build_object('refused', 'bad_field', 'detail', k);
    end if;
  end loop;

  for v_kind in select unnest(array['emails', 'phones']) loop
    v_rows := v_lists->v_kind;
    if v_rows is not null and jsonb_array_length(v_rows) > 0 then
      select coalesce(min(i) filter (where (x->>'is_primary')::boolean), 1) into v_pi
        from jsonb_array_elements(v_rows) with ordinality t(x, i);
      select jsonb_agg(x || jsonb_build_object('is_primary', i = v_pi) order by i) into v_rows
        from jsonb_array_elements(v_rows) with ordinality t(x, i);
      v_lists := jsonb_set(v_lists, array[v_kind], v_rows);
    end if;
  end loop;

  if v_id is not null then
    select * into v_old from public."Contact" where "ContactID" = v_id for update;
    -- A private card is « not found » for anyone but an admin, as in archive_contact, set_contact_spheres,
    -- save_person_link (flow review 2026-11-27: this door had no such check).
    if not found or (coalesce(v_old.is_private, false) and not v_admin) then
      return jsonb_build_object('refused', 'not_found');
    end if;
    v_oldj := to_jsonb(v_old);
  else
    v_oldj := '{}'::jsonb;
  end if;

  for k in select jsonb_object_keys(v_fields) loop
    v_base := case when v_read ? k then v_read->>k else v_oldj->>k end;
    if nullif(v_fields->>k, '') is distinct from nullif(v_base, '') then
      if k = any(c_admin) and not v_admin
         and nullif(v_fields->>k, '') is distinct from coalesce(nullif(v_oldj->>k, ''), 'false') then
        return jsonb_build_object('refused', 'admin_only', 'detail', k);
      end if;
      if k = any(c_admin) and not v_admin then
        continue;
      end if;
      if v_id is not null and v_read ? k
         and nullif(v_oldj->>k, '') is distinct from nullif(v_read->>k, '') then
        return jsonb_build_object('refused', 'stale', 'detail', k, 'card', public._contact_card(v_id));
      end if;
      v_write := v_write || jsonb_build_object(k, v_fields->k);
      v_changed := v_changed || k;
    end if;
  end loop;

  for v_kind in select jsonb_object_keys(v_lists) loop
    v_table := c_kinds->v_kind->>'t';
    select array_agg(x) into v_cols from jsonb_array_elements_text(c_kinds->v_kind->'c') x;
    v_stored := case when v_id is null then '[]'::jsonb else public._contact_rows_stored(v_table, v_id) end;
    if public._contact_rows_norm(v_lists->v_kind, v_cols)
       is distinct from public._contact_rows_norm(coalesce(v_read_lists->v_kind, v_stored), v_cols) then
      if v_id is not null and v_read_lists ? v_kind
         and public._contact_rows_norm(v_stored, v_cols) is distinct from public._contact_rows_norm(v_read_lists->v_kind, v_cols) then
        return jsonb_build_object('refused', 'stale', 'detail', v_kind, 'card', public._contact_card(v_id));
      end if;
      v_kinds_changed := v_kinds_changed || v_kind;
    end if;
  end loop;

  if v_id is not null and v_write = '{}'::jsonb and cardinality(v_kinds_changed) = 0 then
    return jsonb_build_object('unchanged', true, 'card', public._contact_card(v_id));
  end if;

  begin
  if v_id is null then
    if v_write = '{}'::jsonb then
      insert into public."Contact" default values returning "ContactID" into v_id;
    else
      select string_agg(format('%I', k2), ', '),
             string_agg(format('(jsonb_populate_record(null::public."Contact", $1)).%I', k2), ', ')
        into v_ins_cols, v_ins_vals
        from jsonb_object_keys(v_write) k2;
      execute format('insert into public."Contact" (%s) values (%s) returning "ContactID"', v_ins_cols, v_ins_vals)
        into v_id using v_write;
    end if;
    v_kinds_changed := array(select jsonb_object_keys(v_lists));
  elsif v_write <> '{}'::jsonb then
    v_new := jsonb_populate_record(v_old, v_write);
    select string_agg(format('%I = ($1).%I', k2, k2), ', ') into v_set from jsonb_object_keys(v_write) k2;
    execute format('update public."Contact" set %s where "ContactID" = $2', v_set) using v_new, v_id;
  end if;

  if 'addresses' = any(v_kinds_changed) then
    v_places := public.save_contact_places(v_id, coalesce((
      select jsonb_agg(x - 'id' - 'contact_id' - 'position'
                       || case when nullif(x->>'id', '') is not null
                               then jsonb_build_object('link_id', (x->>'id')::bigint) else '{}'::jsonb end
                       order by i)
        from jsonb_array_elements(v_lists->'addresses') with ordinality t(x, i)), '[]'::jsonb));
    if jsonb_array_length(coalesce(v_places->'changed', '[]'::jsonb)) = 0
       and coalesce((v_places->>'ended')::int, 0) = 0 and coalesce((v_places->>'removed')::int, 0) = 0 then
      v_kinds_changed := array_remove(v_kinds_changed, 'addresses');
    end if;
  end if;
  foreach v_kind in array v_kinds_changed loop
    continue when v_kind = 'addresses';
    v_table := c_kinds->v_kind->>'t';
    select array_agg(x) into v_cols from jsonb_array_elements_text(c_kinds->v_kind->'c') x;
    perform public._contact_rows_write(v_table, v_id, v_cols, v_lists->v_kind);
  end loop;

  if v_lists ? 'emails' then
    select nullif(trim(e.email), '') into v_email from public.contact_emails e
     where e.contact_id = v_id order by e.is_primary desc nulls last, e.id limit 1;
    if v_email is not null or jsonb_array_length(v_lists->'emails') > 0 then
      update public."Contact" set "Email" = v_email
       where "ContactID" = v_id and "Email" is distinct from v_email;
    end if;
  end if;
  if v_lists ? 'addresses' then
    select to_jsonb(a) into v_first_addr from public.contact_place_lines a
     where a.contact_id = v_id order by a.position nulls last, a.id limit 1;
    update public."Contact" set
        "Adresse" = v_first_addr->>'adresse', "CodePostal" = v_first_addr->>'code_postal',
        "Ville" = v_first_addr->>'ville', "Pays" = v_first_addr->>'pays'
     where "ContactID" = v_id
       and ("Adresse", "CodePostal", "Ville", "Pays") is distinct from
           (v_first_addr->>'adresse', v_first_addr->>'code_postal', v_first_addr->>'ville', v_first_addr->>'pays');
  end if;

  exception when raise_exception then
    if sqlerrm = 'link_not_found' and nullif(p->>'id', '') is not null then
      return jsonb_build_object('refused', 'stale', 'detail', 'addresses', 'card', public._contact_card(v_id));
    end if;
    raise;
  end;

  if nullif(p->>'id', '') is not null and v_write = '{}'::jsonb and cardinality(v_kinds_changed) = 0 then
    return jsonb_build_object('unchanged', true, 'card', public._contact_card(v_id));
  end if;
  if not v_admin and nullif(p->>'id', '') is not null then
    insert into public.system_log (action, event_type, table_name, row_id, old_value, new_value, author_id, user_id)
    values ('Contact modifié', 'contact_team_change', 'Contact', v_id::text,
            coalesce((select jsonb_object_agg(u.fld, v_oldj->u.fld) from unnest(v_changed) as u(fld)), '{}'::jsonb),
            coalesce((select jsonb_object_agg(u.fld, v_write->u.fld) from unnest(v_changed) as u(fld)), '{}'::jsonb)
              || case when cardinality(v_kinds_changed) > 0 then jsonb_build_object('_lists', to_jsonb(v_kinds_changed)) else '{}'::jsonb end,
            auth.uid(), auth.uid());
  end if;
  return jsonb_build_object('ok', true, 'created', p->>'id' is null or p->>'id' = '',
    'changed', to_jsonb(v_changed || v_kinds_changed), 'card', public._contact_card(v_id));
end $function$;
