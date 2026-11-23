-- save_contact(p jsonb): the one door for a contact and its child rows, in ONE transaction (People.md §3, v1).
-- Pem GO 2026-11-23 (« GO v1 »). Called only by the server action `saveContact`
-- (app/atelier/(portal)/contacts/save-contact.ts); no browser file writes a contact table.
--
-- Input:
--   { id: int | null,                       -- null = create
--     fields: { <Contact column>: value },   -- only the columns below; '' is sent as null
--     read:   { <column>: value } | null,    -- the values the screen read (stale check); null = no check
--     lists:  { addresses|emails|phones|websites|socials: [ { id?, <cols> } ] },  -- a kind absent = untouched
--     read_lists: { <kind>: [rows as read] } | null }
-- Rules, in order (nothing is written until every check passed):
--   1. who asks: team or admin, else « forbidden »;
--   2. a key outside the allowed columns / kinds → « bad_field » (never dropped silently);
--   3. a field is written only when the screen changed it (fields ≠ read; without read: ≠ stored);
--      admin-only fields (is_private, is_team_member, IsTeamMember) changed by a non-admin → « admin_only »;
--   4. stale: a field the screen changed must still hold the value it read; a list the screen changed must
--      still be exactly the list it read → else « stale » with the fresh card, nothing written;
--   5. addresses (one isolated step — Places phase B swaps it for save_contact_places): an address the form
--      drops while a work / order / shipment still points at it → « address_in_use » with the counts.
--      Phase B (Pem 2026-11-23) drops this refusal: removing an address ends the person's link only, the works
--      keep their place and are flagged (`oeuvre_place_unlinked`) — the swap removes this check;
--   6. child rows by id: kept rows updated in place (ids never change), new rows inserted, dropped rows
--      deleted; one primary email and one primary phone (the first marked, else the first row);
--   7. legacy mirror columns written from the lists: Email (primary email), Adresse / CodePostal / Ville /
--      Pays (first address by position);
--   8. nothing changed → « unchanged » (never ok for nothing); else ok + the card as stored + what changed.
-- The Contact row is locked (FOR UPDATE) for the whole save: two saves of one card run one after the other.
--
-- Security: SECURITY DEFINER (the in-use counts must see every work / order / shipment), team / admin checked
-- inside; auth.uid() stays the caller, so the protect_admin_flags trigger still refuses a non-admin flag change.
-- search_path '', every name qualified. EXECUTE: save_contact → authenticated; the helpers → nobody but the owner.

create or replace function public._contact_rows_norm(p_rows jsonb, p_cols text[])
returns jsonb
language sql
immutable
set search_path = ''
as $$
  -- Rows reduced to id + the given columns, '' read as null, sorted by id (new rows last) — for comparing lists.
  select coalesce(jsonb_agg(r order by (r->>'id')::bigint nulls last, r::text), '[]'::jsonb)
  from (
    select (
      select jsonb_object_agg(c, coalesce(nullif(x->c, '""'::jsonb), 'null'::jsonb))
      from unnest(p_cols || array['id']) c
    ) r
    from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) x
  ) s
$$;

create or replace function public._contact_rows_stored(p_table text, p_contact int)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v jsonb;
begin
  execute format(
    'select coalesce(jsonb_agg(to_jsonb(t) order by %s t.id), ''[]''::jsonb) from public.%I t where t.contact_id = $1',
    case when p_table = 'contact_addresses' then 't.position nulls last,' else '' end, p_table)
  into v using p_contact;
  return v;
end $$;

create or replace function public._contact_rows_write(p_table text, p_contact int, p_cols text[], p_rows jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r jsonb;
  v_keep bigint[];
  v_set text;
  v_cols text;
  v_vals text;
  v_n int;
begin
  select coalesce(array_agg((x->>'id')::bigint) filter (where nullif(x->>'id', '') is not null), '{}')
    into v_keep from jsonb_array_elements(p_rows) x;
  execute format('delete from public.%I where contact_id = $1 and not (id = any($2))', p_table)
    using p_contact, v_keep;

  select string_agg(format('%I = (jsonb_populate_record(null::public.%I, $1)).%I', c, p_table, c), ', '),
         string_agg(format('%I', c), ', '),
         string_agg(format('(jsonb_populate_record(null::public.%I, $1)).%I', p_table, c), ', ')
    into v_set, v_cols, v_vals
    from unnest(p_cols) c;

  for r in select x from jsonb_array_elements(p_rows) x loop
    if nullif(r->>'id', '') is not null then
      execute format('update public.%I set %s where id = $2 and contact_id = $3', p_table, v_set)
        using r, (r->>'id')::bigint, p_contact;
      get diagnostics v_n = row_count;
      if v_n = 1 then continue; end if;
    end if;
    execute format('insert into public.%I (contact_id, %s) values ($3, %s)', p_table, v_cols, v_vals)
      using r, null::bigint, p_contact;
  end loop;
end $$;

create or replace function public._contact_card(p_id int)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'contact', (select to_jsonb(c) from public."Contact" c where c."ContactID" = p_id),
    'addresses', public._contact_rows_stored('contact_addresses', p_id),
    'emails', public._contact_rows_stored('contact_emails', p_id),
    'phones', public._contact_rows_stored('contact_phones', p_id),
    'websites', public._contact_rows_stored('contact_websites', p_id),
    'socials', public._contact_rows_stored('contact_socials', p_id)
  )
$$;

create or replace function public.save_contact(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_fields constant text[] := array[
    'NomInstitution', 'Nom', 'Prénom', 'Genre', 'Role', 'Type', 'TypeContact', 'Email',
    'IndicatifPays1', 'Téléphone1', 'IndicatifPays2', 'Téléphone2',
    'PersonneResponsable', 'RoleResponsable', 'Notes', 'Actif', 'PropriétaireOeuvre',
    'is_private', 'is_team_member', 'IsTeamMember'];
  c_admin constant text[] := array['is_private', 'is_team_member', 'IsTeamMember'];
  c_kinds constant jsonb := jsonb_build_object(
    'addresses', jsonb_build_object('t', 'contact_addresses',
                   'c', jsonb_build_array('label', 'adresse', 'code_postal', 'ville', 'pays', 'position', 'shipping_notes')),
    'emails',    jsonb_build_object('t', 'contact_emails',    'c', jsonb_build_array('email', 'label', 'is_primary')),
    'phones',    jsonb_build_object('t', 'contact_phones',    'c', jsonb_build_array('phone', 'country_code', 'label', 'is_primary')),
    'websites',  jsonb_build_object('t', 'contact_websites',  'c', jsonb_build_array('url', 'label')),
    'socials',   jsonb_build_object('t', 'contact_socials',   'c', jsonb_build_array('platform', 'handle')));

  v_admin boolean := public.is_admin();
  v_id int := nullif(p->>'id', '')::int;
  v_fields jsonb := coalesce(p->'fields', '{}'::jsonb);
  -- A JSON null sent for « no read copy » is SQL NULL here (else every field would compare against nothing).
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
  v_addr record;
  v_w int; v_o int; v_s int;
  v_email text;
  v_first_addr jsonb;
begin
  -- 1. Who asks.
  if not (v_admin or public.is_team()) then
    return jsonb_build_object('refused', 'forbidden');
  end if;

  -- 2. Only known columns and kinds.
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

  -- One primary email / phone: the first marked, else the first row.
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
    if not found then
      return jsonb_build_object('refused', 'not_found');
    end if;
    v_oldj := to_jsonb(v_old);
  else
    v_oldj := '{}'::jsonb;
  end if;

  -- 3. Which fields the screen changed (text compare, '' = null): against the value it read for that field when
  --    it sent one, else against what is stored (a partial « read » only guards the fields it names).
  for k in select jsonb_object_keys(v_fields) loop
    v_base := case when v_read ? k then v_read->>k else v_oldj->>k end;
    if nullif(v_fields->>k, '') is distinct from nullif(v_base, '') then
      if k = any(c_admin) and not v_admin
         and nullif(v_fields->>k, '') is distinct from coalesce(nullif(v_oldj->>k, ''), 'false') then
        return jsonb_build_object('refused', 'admin_only', 'detail', k);
      end if;
      if k = any(c_admin) and not v_admin then
        continue; -- a non-admin « change » that only matches what is stored is not a change
      end if;
      -- 4. Stale field: still the value the screen read?
      if v_id is not null and v_read ? k
         and nullif(v_oldj->>k, '') is distinct from nullif(v_read->>k, '') then
        return jsonb_build_object('refused', 'stale', 'detail', k, 'card', public._contact_card(v_id));
      end if;
      v_write := v_write || jsonb_build_object(k, v_fields->k);
      v_changed := v_changed || k;
    end if;
  end loop;

  -- 4b. Lists: changed when the form's list ≠ the list read (or stored); a changed list must still be the one read.
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

  -- 5. Addresses (isolated step): a dropped address still in use refuses the save.
  if v_id is not null and 'addresses' = any(v_kinds_changed) then
    for v_addr in
      select a.id, a.label, a.ville from public.contact_addresses a
       where a.contact_id = v_id
         and not exists (select 1 from jsonb_array_elements(v_lists->'addresses') x
                          where nullif(x->>'id', '')::bigint = a.id)
    loop
      select count(*) into v_w from public."Oeuvres" w where w.localisation_address_id = v_addr.id;
      select count(*) into v_o from public.work_order o where o.address_id = v_addr.id;
      select count(*) into v_s from public.shipment s where s.address_id = v_addr.id;
      if v_w + v_o + v_s > 0 then
        return jsonb_build_object('refused', 'address_in_use', 'detail', jsonb_build_object(
          'label', coalesce(nullif(v_addr.label, ''), nullif(v_addr.ville, ''), v_addr.id::text),
          'works', v_w, 'orders', v_o, 'shipments', v_s));
      end if;
    end loop;
  end if;

  -- 8a. Nothing to do.
  if v_id is not null and v_write = '{}'::jsonb and cardinality(v_kinds_changed) = 0 then
    return jsonb_build_object('unchanged', true, 'card', public._contact_card(v_id));
  end if;

  -- Write the Contact row.
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

  -- 6. Child rows by id (the address in-use check above already ran, before any write).
  foreach v_kind in array v_kinds_changed loop
    v_table := c_kinds->v_kind->>'t';
    select array_agg(x) into v_cols from jsonb_array_elements_text(c_kinds->v_kind->'c') x;
    perform public._contact_rows_write(v_table, v_id, v_cols, v_lists->v_kind);
  end loop;

  -- 7. Legacy mirror columns from the lists.
  if v_lists ? 'emails' then
    select nullif(trim(e.email), '') into v_email from public.contact_emails e
     where e.contact_id = v_id order by e.is_primary desc nulls last, e.id limit 1;
    if v_email is not null or jsonb_array_length(v_lists->'emails') > 0 then
      update public."Contact" set "Email" = v_email
       where "ContactID" = v_id and "Email" is distinct from v_email;
    end if;
  end if;
  if v_lists ? 'addresses' then
    select to_jsonb(a) into v_first_addr from public.contact_addresses a
     where a.contact_id = v_id order by a.position nulls last, a.id limit 1;
    update public."Contact" set
        "Adresse" = v_first_addr->>'adresse', "CodePostal" = v_first_addr->>'code_postal',
        "Ville" = v_first_addr->>'ville', "Pays" = v_first_addr->>'pays'
     where "ContactID" = v_id
       and ("Adresse", "CodePostal", "Ville", "Pays") is distinct from
           (v_first_addr->>'adresse', v_first_addr->>'code_postal', v_first_addr->>'ville', v_first_addr->>'pays');
  end if;

  -- 8b. The truth: the card as stored, and what changed.
  return jsonb_build_object('ok', true, 'created', p->>'id' is null or p->>'id' = '',
    'changed', to_jsonb(v_changed || v_kinds_changed), 'card', public._contact_card(v_id));
end $$;

revoke all on function public._contact_rows_norm(jsonb, text[]) from public, anon, authenticated;
revoke all on function public._contact_rows_stored(text, int) from public, anon, authenticated;
revoke all on function public._contact_rows_write(text, int, text[], jsonb) from public, anon, authenticated;
revoke all on function public._contact_card(int) from public, anon, authenticated;
revoke all on function public.save_contact(jsonb) from public, anon;
grant execute on function public.save_contact(jsonb) to authenticated;
