-- Places — phase B: addresses -> places, the switch (design docs/design/2026-11-23/Places.md §4, §5, §7 steps 4–8;
-- plan docs/design/2026-11-23/Places_PhaseB_Plan.md, Pem's GO 2026-11-23, option B for versions).
-- Needs places_phase_a_shape.sql, places_phase_a_fixes.sql and places_phase_b_backfill.sql (functions) first.
--
-- One transaction, all or nothing. Lands together with the code that reads place_id (same push, within the minute).
--   1. pointers: Oeuvres.place_id, Oeuvres.home_place_id (empty), work_order.place_id, shipment.place_id
--   2. places_backfill_from_addresses(): one place per address line, links, Atelier inside the Principal
--   3. re-aim the pointers through place_address_map — the work's version / history / stage triggers are off for
--      this one update only (no 1,176 « migration » versions, Pem 2026-11-23), one system_log line instead
--   4. rules in the database: stage rule on place_id (rule 2; a place its holder is not linked to is flagged, never
--      refused or moved — rule 1, Pem 2026-11-23), one place filled for you (rule 3, on contact_place),
--      merge_contacts moves links, a place is never deleted (rule 5)
--   5. the reads contact_place_lines (one row per live link, with its building's line and the floor) and
--      oeuvre_place_unlinked (the flag), and the door save_contact_places (the contact editor's address tab, no
--      question asked — principle 2; floors / flats are child places of the building, Pem 2026-11-23)
--   6. the old pointers become read-only (contact_addresses, Oeuvres.localisation_address_id,
--      Oeuvres."LocalisationDetail", work_order.address_id, shipment.address_id); dropped one release later, own OK
--   7. places_check() and the counts below must all be 0, or the whole file rolls back
-- Owner OK needed before running live. Proof: Docker copy (scripts/stress/README.md).

begin;

-- 0. phase A must be there
do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'place' and column_name = 'root_id')
     or to_regclass('public.contact_place') is null
     or to_regprocedure('public.places_backfill_from_addresses()') is null then
    raise exception 'places phase A / backfill functions missing';
  end if;
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'Oeuvres' and column_name = 'place_id') then
    raise exception 'places phase B already applied';
  end if;
end $$;

-- 1. pointers ------------------------------------------------------------------------------------------------------
alter table public."Oeuvres"   add column place_id      bigint references public.place(id) on delete restrict;
alter table public."Oeuvres"   add column home_place_id bigint references public.place(id) on delete restrict;
alter table public.work_order  add column place_id      bigint references public.place(id) on delete restrict;
alter table public.shipment    add column place_id      bigint references public.place(id) on delete restrict;
comment on column public."Oeuvres".place_id      is 'Where the work is: the deepest place known (a box, or the address). The address = the place''s root. Places.md §3c.';
comment on column public."Oeuvres".home_place_id is 'Its usual place while it is out for a day; cleared when scanned back. Places.md §3c. Empty in phase B.';
comment on column public.work_order.place_id     is 'Where the order''s works go (a place linked to the party). Replaces address_id.';
comment on column public.shipment.place_id       is 'Where the shipment goes. Replaces address_id.';
create index oeuvres_place_id_idx      on public."Oeuvres" (place_id) where place_id is not null;
create index oeuvres_home_place_id_idx on public."Oeuvres" (home_place_id) where home_place_id is not null;
create index work_order_place_id_idx   on public.work_order (place_id) where place_id is not null;
create index shipment_place_id_idx     on public.shipment (place_id) where place_id is not null;

-- 2. addresses -> places + links -----------------------------------------------------------------------------------
select public.places_backfill_from_addresses();

-- 3. re-aim the pointers (option B: no version rows for this update) ---------------------------------------------------
alter table public."Oeuvres" disable trigger oeuvre_version_snap;
alter table public."Oeuvres" disable trigger trg_zz_oeuvre_history;
alter table public."Oeuvres" disable trigger trg_oeuvre_location_by_stage;

update public."Oeuvres" o set place_id = m.place_id
  from public.place_address_map m
 where m.address_id = o.localisation_address_id;

alter table public."Oeuvres" enable trigger oeuvre_version_snap;
alter table public."Oeuvres" enable trigger trg_zz_oeuvre_history;
alter table public."Oeuvres" enable trigger trg_oeuvre_location_by_stage;

update public.work_order w set place_id = m.place_id
  from public.place_address_map m where m.address_id = w.address_id;
update public.shipment s set place_id = m.place_id
  from public.place_address_map m where m.address_id = s.address_id;

insert into public.system_log (action, details, table_name, metadata)
select 'PLACES_PHASE_B',
       format('Places phase B: %s works re-aimed from address to place (no version rows; map kept in place_address_map), %s orders, %s shipments.',
              (select count(*) from public."Oeuvres" where place_id is not null),
              (select count(*) from public.work_order where place_id is not null),
              (select count(*) from public.shipment where place_id is not null)),
       'Oeuvres',
       jsonb_build_object('design', 'docs/design/2026-11-23/Places.md §7', 'map', 'place_address_map');

-- 4. rules in the database --------------------------------------------------------------------------------------------

-- Rules 1 + 2 (Places.md §4, Pem 2026-11-23). Replaces the address version of the same trigger.
--   1. a work at a place its holder is not linked to is NOT refused and NOT cleared: it is flagged (the read
--      oeuvre_place_unlinked, audit rule 9, the work card, the Overview). Custody moves only through orders.
--   2. Pem (13): on a stage change, the place linked to Pem with the stage's label (atelier / principal); a work
--      already inside that place's tree stays put; Pem's pick in the same write wins.
--   3. anyone else: no place and exactly one live linked place -> that place.
create or replace function public.oeuvre_location_by_stage()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  holder        int := new."LocalisationID";
  stage_new     text;
  stage_changed boolean;
  picked        boolean;
  want          bigint;
begin
  if holder is distinct from 13 then
    if new.place_id is null and holder is not null then
      select min(c.place_id) into want
        from contact_place c join place p on p.id = c.place_id
       where c.contact_id = holder and c.until is null and p.archived_at is null
      having count(distinct c.place_id) = 1;
      new.place_id := want;
    end if;
    return new;
  end if;

  stage_new := oeuvre_stage_key(new."statusId", new."Catalogué", new."NeedsPhotograph");
  if stage_new is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    stage_changed := true;
    picked := new.place_id is not null;
  else
    stage_changed := old."LocalisationID" is distinct from 13
      or stage_new is distinct from oeuvre_stage_key(old."statusId", old."Catalogué", old."NeedsPhotograph");
    picked := new.place_id is not null and new.place_id is distinct from old.place_id;
  end if;

  if (stage_changed and not picked) or new.place_id is null then
    select c.place_id into want
      from contact_place c join place p on p.id = c.place_id
     where c.contact_id = 13 and c.until is null and c.label ilike stage_new and p.archived_at is null
     order by c.position nulls last, c.id
     limit 1;
    if want is not null and (new.place_id is null or not exists (
      with recursive up as (
        select p.id, p.parent_id from place p where p.id = new.place_id
        union all
        select p.id, p.parent_id from place p join up on p.id = up.parent_id
      )
      select 1 from up where up.id = want
    )) then
      new.place_id := want;
    end if;
  end if;

  return new;
end;
$function$;

drop trigger trg_oeuvre_location_by_stage on public."Oeuvres";
create trigger trg_oeuvre_location_by_stage
  before insert or update of "statusId", "Catalogué", "NeedsPhotograph", "LocalisationID", place_id, fate
  on public."Oeuvres" for each row execute function public.oeuvre_location_by_stage();

-- Rule 3 on the link side (replaces contact_address_link_single on contact_addresses).
create or replace function public.contact_place_link_single()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  cid     int;
  only_id bigint;
begin
  foreach cid in array array[old.contact_id, new.contact_id] loop
    continue when cid is null or cid = 13;
    only_id := null;
    select min(c.place_id) into only_id
      from contact_place c join place p on p.id = c.place_id
     where c.contact_id = cid and c.until is null and p.archived_at is null
    having count(distinct c.place_id) = 1;
    if only_id is not null then
      update "Oeuvres" set place_id = only_id
       where "LocalisationID" = cid and place_id is null and deleted_at is null;
    end if;
  end loop;
  return null;
end;
$function$;
revoke all on function public.contact_place_link_single() from public, anon, authenticated;

create trigger trg_contact_place_link_single
  after insert or delete or update of contact_id, place_id, until on public.contact_place
  for each row execute function public.contact_place_link_single();

drop trigger trg_contact_address_link_single on public.contact_addresses;
drop function public.contact_address_link_single();

-- A person's place left with nothing in it once a link is gone (the card deleted → its links cascade, a merge, the
-- editor) is archived, so a deleted — maybe private — contact's street never shows up among the creation places.
-- Only `address` / `zone` places (never a studio or motif), only when nobody is linked any more (ended links count:
-- they are the history) and nothing points at it. The floor first, then its building.
create or replace function public.contact_place_orphan_archive()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  pid bigint;
begin
  foreach pid in array array[old.place_id, (select coalesce(q.root_id, q.id) from place q where q.id = old.place_id)] loop
    update place p set archived_at = now(), archived_by = auth.uid()
     where p.id = pid and p.archived_at is null and p.kind in ('address', 'zone')
       and not exists (select 1 from contact_place c where c.place_id = p.id)
       and not exists (select 1 from "Oeuvres" o where o.place_id = p.id or o.home_place_id = p.id)
       and not exists (select 1 from work_order w where w.place_id = p.id)
       and not exists (select 1 from shipment s where s.place_id = p.id)
       and not exists (select 1 from work_creation_step st where st.place_id = p.id)
       and not exists (select 1 from work_period wp where wp.default_place_id = p.id)
       and not exists (select 1 from place k where k.parent_id = p.id and k.archived_at is null);
  end loop;
  return null;
end;
$function$;
revoke all on function public.contact_place_orphan_archive() from public, anon, authenticated;

create trigger trg_contact_place_orphan_archive
  after delete on public.contact_place
  for each row execute function public.contact_place_orphan_archive();

-- Rule 5: a place is never deleted; archiving refused while works or live children are inside.
create or replace function public.place_never_deleted()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  n_works int;
  n_kids  int;
begin
  if tg_op = 'DELETE' then
    raise exception 'place_never_deleted' using hint = 'Un lieu s''archive, il ne se supprime pas.';
  end if;
  if new.archived_at is not null and old.archived_at is null then
    select count(*) into n_works from "Oeuvres"
     where (place_id = new.id or home_place_id = new.id) and deleted_at is null;
    select count(*) into n_kids from place where parent_id = new.id and archived_at is null;
    if n_works > 0 or n_kids > 0 then
      raise exception 'place_not_empty'
        using detail = format('%s works, %s places inside', n_works, n_kids),
              hint = 'Déplacer d''abord ce qui est dedans.';
    end if;
  end if;
  return coalesce(new, old);
end;
$function$;

create trigger trg_place_never_deleted
  before delete or update of archived_at on public.place
  for each row execute function public.place_never_deleted();

-- merge_contacts: links move to the kept card BEFORE the works change holder (so no work is flagged on the way); two live
-- links of the same place and role become one. The rest is the live body of 2026-11-23, unchanged.
create or replace function public.merge_contacts(p_keep integer, p_lose integer)
 returns integer
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_keep      public."Contact"%rowtype;
  v_lose      public."Contact"%rowtype;
  v_keep_j    jsonb;
  v_lose_j    jsonb;
  v_patch     jsonb := '{}'::jsonb;
  v_key       text;
  v_val       jsonb;
  v_set       text;
  v_lose_inv  integer;
  v_keep_inv  integer;
begin
  if p_keep is null or p_lose is null or p_keep = p_lose then
    raise exception 'merge_invalid';
  end if;
  if not public.is_admin() then
    raise exception 'merge_forbidden';
  end if;

  perform 1 from public."Contact" where "ContactID" in (p_keep, p_lose) order by "ContactID" for update;
  select * into v_keep from public."Contact" where "ContactID" = p_keep;
  select * into v_lose from public."Contact" where "ContactID" = p_lose;
  if v_keep."ContactID" is null or v_lose."ContactID" is null then
    raise exception 'merge_not_found';
  end if;

  if v_keep.auth_user_id is not null and v_lose.auth_user_id is not null
     and v_keep.auth_user_id <> v_lose.auth_user_id then
    raise exception 'merge_two_logins';
  end if;

  select count(*) into v_lose_inv from public.invoice where party_id = p_lose;
  if v_lose_inv > 0 then
    select count(*) into v_keep_inv from public.invoice where party_id = p_keep;
    raise exception '%', case when v_keep_inv > 0 then 'merge_both_invoiced' else 'merge_invoices' end;
  end if;

  v_keep_j := to_jsonb(v_keep);
  v_lose_j := to_jsonb(v_lose);
  for v_key, v_val in select key, value from jsonb_each(v_lose_j) loop
    continue when v_key in ('ContactID', 'auth_user_id', 'Website', 'Instagram', 'LinkedIn', 'Facebook', 'Twitter');
    if v_key in ('is_team_member', 'IsTeamMember', 'is_private') then
      if not coalesce((v_keep_j ->> v_key)::boolean, false) and coalesce((v_lose_j ->> v_key)::boolean, false) then
        v_patch := v_patch || jsonb_build_object(v_key, true);
      end if;
      continue;
    end if;
    continue when v_val = 'null'::jsonb or v_val = '""'::jsonb;
    if (v_keep_j -> v_key) = 'null'::jsonb or (v_keep_j -> v_key) = '""'::jsonb then
      v_patch := v_patch || jsonb_build_object(v_key, v_val);
    end if;
  end loop;

  if v_keep.auth_user_id is null and v_lose.auth_user_id is not null then
    update public."Contact" set auth_user_id = null where "ContactID" = p_lose;
    v_patch := v_patch || jsonb_build_object('auth_user_id', v_lose.auth_user_id);
  end if;

  if v_patch <> '{}'::jsonb then
    select string_agg(format('%1$I = r.%1$I', k), ', ') into v_set from jsonb_object_keys(v_patch) k;
    execute format(
      'update public."Contact" t set %s from jsonb_populate_record(null::public."Contact", $1) r where t."ContactID" = $2',
      v_set
    ) using v_patch, p_keep;
  end if;

  -- places: links first, so the works moved below are never flagged on the way (Places.md §4 rule 1)
  update public.place_address_map m set link_id = k.id
    from public.contact_place l, public.contact_place k
   where m.link_id = l.id and l.contact_id = p_lose and l.until is null
     and k.contact_id = p_keep and k.until is null and k.place_id = l.place_id and k.role = l.role;
  delete from public.contact_place l
   where l.contact_id = p_lose and l.until is null
     and exists (select 1 from public.contact_place k
                  where k.contact_id = p_keep and k.until is null and k.place_id = l.place_id and k.role = l.role);
  if exists (select 1 from public.contact_place where contact_id = p_keep and is_primary and until is null) then
    update public.contact_place set is_primary = false where contact_id = p_lose and is_primary;
  end if;
  update public.contact_place     set contact_id = p_keep where contact_id = p_lose;
  update public.contact_addresses set contact_id = p_keep where contact_id = p_lose;   -- read-only table, kept in step

  update public.work_order     set party_id        = p_keep where party_id        = p_lose;
  update public."Oeuvres"      set "ContactID"     = p_keep where "ContactID"     = p_lose;
  update public."Oeuvres"      set "LocalisationID"= p_keep where "LocalisationID"= p_lose;
  update public."Oeuvres"      set "AcheteurID"    = p_keep where "AcheteurID"    = p_lose;
  update public.suivi_process  set contact_id      = p_keep where contact_id      = p_lose;
  update public.document       set contact_id      = p_keep where contact_id      = p_lose;
  update public.expense        set contact_id      = p_keep where contact_id      = p_lose;
  update public.shipment       set to_contact_id   = p_keep where to_contact_id   = p_lose;
  update public.stock_item     set supplier_id     = p_keep where supplier_id     = p_lose;
  update public.supply_order   set supplier_id     = p_keep where supplier_id     = p_lose;
  update public.private_link   set contact_id      = p_keep where contact_id      = p_lose;
  update public.page_view      set team_contact_id = p_keep where team_contact_id = p_lose;

  delete from public.event_contact l
   where l.contact_id = p_lose
     and exists (select 1 from public.event_contact k
                  where k.contact_id = p_keep and k.process_id = l.process_id and k.role = l.role);
  update public.event_contact set contact_id = p_keep where contact_id = p_lose;

  delete from public.contact_emails l
   where l.contact_id = p_lose
     and (exists (select 1 from public.contact_emails k where k.contact_id = p_keep
                   and lower(btrim(k.email)) = lower(btrim(l.email)))
       or exists (select 1 from public.contact_emails e where e.contact_id = p_lose and e.id < l.id
                   and lower(btrim(e.email)) = lower(btrim(l.email))));
  update public.contact_emails set contact_id = p_keep where contact_id = p_lose;

  delete from public.contact_phones l
   where l.contact_id = p_lose
     and (exists (select 1 from public.contact_phones k where k.contact_id = p_keep
                   and regexp_replace(k.phone, '\D', '', 'g') = regexp_replace(l.phone, '\D', '', 'g'))
       or exists (select 1 from public.contact_phones e where e.contact_id = p_lose and e.id < l.id
                   and regexp_replace(e.phone, '\D', '', 'g') = regexp_replace(l.phone, '\D', '', 'g')));
  update public.contact_phones set contact_id = p_keep where contact_id = p_lose;

  delete from public.contact_websites l
   where l.contact_id = p_lose
     and (exists (select 1 from public.contact_websites k where k.contact_id = p_keep
                   and regexp_replace(regexp_replace(lower(btrim(k.url)), '^https?://', ''), '/$', '')
                     = regexp_replace(regexp_replace(lower(btrim(l.url)), '^https?://', ''), '/$', ''))
       or exists (select 1 from public.contact_websites e where e.contact_id = p_lose and e.id < l.id
                   and regexp_replace(regexp_replace(lower(btrim(e.url)), '^https?://', ''), '/$', '')
                     = regexp_replace(regexp_replace(lower(btrim(l.url)), '^https?://', ''), '/$', '')));
  update public.contact_websites set contact_id = p_keep where contact_id = p_lose;

  delete from public.contact_socials l
   where l.contact_id = p_lose
     and (exists (select 1 from public.contact_socials k where k.contact_id = p_keep
                   and lower(btrim(coalesce(k.platform, ''))) = lower(btrim(coalesce(l.platform, '')))
                   and lower(btrim(coalesce(k.handle, '')))   = lower(btrim(coalesce(l.handle, ''))))
       or exists (select 1 from public.contact_socials e where e.contact_id = p_lose and e.id < l.id
                   and lower(btrim(coalesce(e.platform, ''))) = lower(btrim(coalesce(l.platform, '')))
                   and lower(btrim(coalesce(e.handle, '')))   = lower(btrim(coalesce(l.handle, '')))));
  update public.contact_socials set contact_id = p_keep where contact_id = p_lose;

  update public.ai_job l
     set status = 'failed', error = format('merged into #%s', p_keep), done_at = now()
   where l.kind = 'card' and l.target_id = p_lose::text and l.status in ('waiting', 'running')
     and exists (select 1 from public.ai_job k
                  where k.kind = 'card' and k.target_id = p_keep::text and k.status in ('waiting', 'running'));
  update public.ai_job set target_id = p_keep::text where kind = 'card' and target_id = p_lose::text;

  update public.pending_changes set payload = jsonb_set(payload, '{contact_id}', to_jsonb(p_keep::text))
   where payload->>'contact_id' = p_lose::text;
  update public.pending_changes set payload = jsonb_set(payload, '{localisation_id}', to_jsonb(p_keep::text))
   where payload->>'localisation_id' = p_lose::text;
  update public.pending_changes set payload = jsonb_set(payload, '{acheteur_id}', to_jsonb(p_keep::text))
   where payload->>'acheteur_id' = p_lose::text;
  update public.pending_changes set baseline = jsonb_set(baseline, '{ContactID}', to_jsonb(p_keep))
   where baseline->>'ContactID' = p_lose::text;
  update public.pending_changes set baseline = jsonb_set(baseline, '{LocalisationID}', to_jsonb(p_keep))
   where baseline->>'LocalisationID' = p_lose::text;
  update public.pending_changes set baseline = jsonb_set(baseline, '{AcheteurID}', to_jsonb(p_keep))
   where baseline->>'AcheteurID' = p_lose::text;
  update public.oeuvre_versions set snapshot = jsonb_set(snapshot, '{ContactID}', to_jsonb(p_keep))
   where snapshot->>'ContactID' = p_lose::text;
  update public.oeuvre_versions set snapshot = jsonb_set(snapshot, '{LocalisationID}', to_jsonb(p_keep))
   where snapshot->>'LocalisationID' = p_lose::text;
  update public.oeuvre_versions set snapshot = jsonb_set(snapshot, '{AcheteurID}', to_jsonb(p_keep))
   where snapshot->>'AcheteurID' = p_lose::text;

  delete from public."Contact" where "ContactID" = p_lose;

  return p_keep;
end;
$function$;

-- 5. the reads and the door ------------------------------------------------------------------------------------------

-- One row per live person ↔ place link, with the address of the BUILDING (the root place: number + street +
-- postcode + town, Pem 2026-11-23) under the old column names, so the readers of the old address rows switch with one
-- join. A link to a floor / flat (a child place) shows the building's line and the floor's name as `complement`.
-- A read, not a store. « others » = how many other people are linked to the same building, any floor (a count, never
-- who) — an edited line changes the building for all of them.
create view public.contact_place_lines with (security_invoker = true) as
select c.id,
       c.contact_id,
       c.place_id,
       coalesce(p.root_id, p.id) as building_id,
       c.role,
       c.label,
       c.is_primary,
       c.position,
       c.since,
       b.address        as adresse,
       b.postcode       as code_postal,
       b.town           as ville,
       b.country        as pays,
       case when p.parent_id is not null then p.name end as complement,
       b.shipping_notes,
       b.latitude,
       b.longitude,
       p.parent_id,
       p.kind,
       p.name           as place_name,
       (select count(distinct o.contact_id) from public.contact_place o
          join public.place op on op.id = o.place_id
         where coalesce(op.root_id, op.id) = coalesce(p.root_id, p.id)
           and o.until is null and o.contact_id <> c.contact_id)::int as others
  from public.contact_place c
  join public.place p on p.id = c.place_id
  join public.place b on b.id = coalesce(p.root_id, p.id)
 where c.until is null;
grant select on public.contact_place_lines to authenticated;
revoke all on public.contact_place_lines from anon;

-- Works at a place their holder is not linked to (Pem 2026-11-23: flagged, never refused, never moved): the holder
-- has no live link to any place of the same building. Read by audit rule 9, the work card and the Overview count.
create view public.oeuvre_place_unlinked with (security_invoker = true) as
select o."OeuvreID" as oeuvre_id, o."LocalisationID" as holder_id, o.place_id
  from public."Oeuvres" o
  join public.place wp on wp.id = o.place_id
 where o.deleted_at is null
   and not exists (select 1 from public.contact_place c
                     join public.place lp on lp.id = c.place_id
                    where c.contact_id = o."LocalisationID" and c.until is null
                      and coalesce(lp.root_id, lp.id) = coalesce(wp.root_id, wp.id));
grant select on public.oeuvre_place_unlinked to authenticated;
revoke all on public.oeuvre_place_unlinked from anon;

-- The address tab of a contact card, as one write (principle 2). Runs as the caller: RLS team-only applies.
-- p_rows, in screen order: [{ link_id?, label, adresse, code_postal, ville, pays, complement, shipping_notes, is_primary? }]
-- No question is asked (Pem 2026-11-23, « just put the address »):
--   * the building = the full line (street + postcode + town). A new line that matches a known building with a
--     street is that building (shared); a line with no street is always its own place (same town ≠ same place).
--   * `complement` = the floor / flat: a child place of the building, found by name or made (« 3e étage »). People
--     link to the floor; with no floor they link to the building.
--   * editing the line of an existing link corrects the building for everyone linked to it.
--   * a link the form drops is ended (until = today) when anything of this person ever pointed at its place, else
--     removed; a place left with no link and nothing in it is archived. Works never move with a link: a work left at
--     a place its holder is no longer linked to is flagged (oeuvre_place_unlinked).
-- Answers { status: 'ok', changed: [...], ended: n, removed: n }; nothing changed = changed [].
create or replace function public.save_contact_places(p_contact integer, p_rows jsonb)
returns jsonb
language plpgsql
set search_path to 'public'
as $function$
declare
  r          jsonb;
  i          int := 0;
  lnk        contact_place%rowtype;
  cur        place%rowtype;
  bld        place%rowtype;
  b_id       bigint;
  target     bigint;
  kept       bigint[] := '{}';
  changed    text[] := '{}';
  n_ended    int := 0;
  n_removed  int := 0;
  primary_i  int;
  v_street   text;
  v_cp       text;
  v_town     text;
  v_country  text;
  v_floor    text;
  v_notes    text;
  v_label    text;
begin
  if not is_team() then
    raise exception 'forbidden';
  end if;
  if p_contact is null or not exists (select 1 from "Contact" where "ContactID" = p_contact) then
    raise exception 'contact_not_found';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'rows_invalid';
  end if;

  select min(o.ordinality - 1) into primary_i
    from jsonb_array_elements(p_rows) with ordinality o where coalesce((o.value->>'is_primary')::boolean, false);
  primary_i := coalesce(primary_i, 0);
  update contact_place set is_primary = false
   where contact_id = p_contact and is_primary and until is null
     and id is distinct from (p_rows -> primary_i ->> 'link_id')::bigint;   -- the primary that stays is not a change

  for r in select value from jsonb_array_elements(p_rows) loop
    v_street  := nullif(btrim(r->>'adresse'), '');
    v_cp      := nullif(btrim(r->>'code_postal'), '');
    v_town    := nullif(btrim(r->>'ville'), '');
    v_country := nullif(btrim(r->>'pays'), '');
    v_floor   := nullif(btrim(r->>'complement'), '');
    v_notes   := nullif(btrim(r->>'shipping_notes'), '');
    v_label   := nullif(btrim(r->>'label'), '');

    if (r->>'link_id') is not null then
      select * into lnk from contact_place
       where id = (r->>'link_id')::bigint and contact_id = p_contact and until is null;
      if not found then
        raise exception 'link_not_found';
      end if;
      select * into cur from place where id = lnk.place_id;
      b_id := coalesce(cur.root_id, cur.id);
      select * into bld from place where id = b_id;
      -- the line of the building, corrected for everyone linked to it
      if coalesce(bld.address, '') is distinct from coalesce(v_street, '')
         or coalesce(bld.postcode, '') is distinct from coalesce(v_cp, '')
         or coalesce(bld.town, '') is distinct from coalesce(v_town, '')
         or coalesce(bld.country, '') is distinct from coalesce(v_country, '')
         or coalesce(bld.shipping_notes, '') is distinct from coalesce(v_notes, '') then
        update place set address = v_street, postcode = v_cp, town = v_town, country = v_country, shipping_notes = v_notes,
                         latitude  = case when coalesce(address, '') = coalesce(v_street, '')
                                           and coalesce(town, '') = coalesce(v_town, '') then latitude end,
                         longitude = case when coalesce(address, '') = coalesce(v_street, '')
                                           and coalesce(town, '') = coalesce(v_town, '') then longitude end
         where id = b_id;
        changed := changed || format('place:%s', b_id);
      end if;
    else
      if v_street is null and v_cp is null and v_town is null and v_country is null then
        i := i + 1;
        continue;                                               -- an empty row is not a place
      end if;
      b_id := null;
      if v_street is not null then                               -- the same full line is the same building
        select p.id into b_id from place p
         where p.parent_id is null and p.archived_at is null and p.kind in ('address', 'venue')
           and lower(regexp_replace(btrim(coalesce(p.address, '')), '\s+', ' ', 'g'))
               = lower(regexp_replace(v_street, '\s+', ' ', 'g'))
           and lower(coalesce(p.postcode, '')) = lower(coalesce(v_cp, ''))
           and lower(coalesce(p.town, ''))     = lower(coalesce(v_town, ''))
         order by p.id limit 1;
      end if;
      if b_id is null then
        insert into place (name, kind, address, postcode, town, country, shipping_notes)
        values (coalesce(v_street, v_town, v_cp, v_country), 'address', v_street, v_cp, v_town, v_country, v_notes)
        returning id into b_id;
        changed := changed || format('place_new:%s', b_id);
      end if;
    end if;

    -- the floor / flat: a child place of the building, by name (Pem 2026-11-23: same building, other floor = other place)
    if v_floor is null then
      target := b_id;
    else
      select p.id into target from place p
       where p.parent_id = b_id and p.archived_at is null and lower(btrim(p.name)) = lower(v_floor)
       order by p.id limit 1;
      if target is null then
        insert into place (name, kind, parent_id) values (v_floor, 'zone', b_id) returning id into target;
        changed := changed || format('place_new:%s', target);
      end if;
    end if;

    if (r->>'link_id') is not null then
      if target <> lnk.place_id then
        -- works stay where they are (flagged if need be). A live link of this person to the target already there
        -- (same role) is kept and this one ends, instead of a duplicate.
        if exists (select 1 from contact_place d where d.contact_id = p_contact and d.place_id = target
                     and d.role = lnk.role and d.until is null and d.id <> lnk.id) then
          update contact_place set until = greatest(current_date, coalesce(since, current_date)), is_primary = false
           where id = lnk.id;
          select * into lnk from contact_place d where d.contact_id = p_contact and d.place_id = target
             and d.role = lnk.role and d.until is null;
        else
          update contact_place set place_id = target where id = lnk.id;
        end if;
        changed := changed || format('link_place:%s', lnk.id);
      end if;
      update contact_place
         set label = coalesce(v_label, label), position = i, is_primary = (i = primary_i)
       where id = lnk.id
         and (label is distinct from coalesce(v_label, label) or position is distinct from i
              or is_primary is distinct from (i = primary_i));
      if found then changed := changed || format('link:%s', lnk.id); end if;
      kept := kept || lnk.id;
    else
      select * into lnk from contact_place
       where contact_id = p_contact and place_id = target and role = 'other' and until is null;
      if found then
        update contact_place set label = coalesce(v_label, label), position = i, is_primary = (i = primary_i)
         where id = lnk.id;
      else
        insert into contact_place (contact_id, place_id, role, label, is_primary, position, since, created_by)
        values (p_contact, target, 'other', v_label, i = primary_i, i, current_date, auth.uid())
        returning * into lnk;
        changed := changed || format('link_new:%s', lnk.id);
      end if;
      kept := kept || lnk.id;
    end if;
    i := i + 1;
  end loop;

  -- links the form dropped: ended when anything of this person ever pointed at the place, else removed
  for lnk in
    select * from contact_place
     where contact_id = p_contact and until is null and not (id = any(kept))
       and role <> 'authorised'                                 -- not shown on the address tab
  loop
    if exists (select 1 from "Oeuvres" o where o."LocalisationID" = p_contact and o.place_id = lnk.place_id)
       or exists (select 1 from work_order w where w.party_id = p_contact and w.place_id = lnk.place_id)
       or exists (select 1 from shipment s where s.to_contact_id = p_contact and s.place_id = lnk.place_id)
       or exists (select 1 from place_address_map m where m.link_id = lnk.id) then
      update contact_place set until = greatest(current_date, coalesce(since, current_date)), is_primary = false
       where id = lnk.id;
      n_ended := n_ended + 1;
    else
      delete from contact_place where id = lnk.id;
      n_removed := n_removed + 1;
      -- a place nobody is linked to and nothing points at goes out of the lists (archived, never deleted)
      update place p set archived_at = now(), archived_by = auth.uid()
       where p.id in (lnk.place_id, (select coalesce(q.root_id, q.id) from place q where q.id = lnk.place_id))
         and p.archived_at is null
         and not exists (select 1 from contact_place c where c.place_id = p.id)
         and not exists (select 1 from "Oeuvres" o where o.place_id = p.id or o.home_place_id = p.id)
         and not exists (select 1 from work_order w where w.place_id = p.id)
         and not exists (select 1 from shipment s where s.place_id = p.id)
         and not exists (select 1 from work_creation_step st where st.place_id = p.id)
         and not exists (select 1 from work_period wp where wp.default_place_id = p.id)
         and not exists (select 1 from place k where k.parent_id = p.id and k.id <> lnk.place_id and k.archived_at is null)
         and not exists (select 1 from place_address_map m where m.place_id = p.id);
    end if;
  end loop;

  return jsonb_build_object('status', 'ok', 'changed', to_jsonb(changed), 'ended', n_ended, 'removed', n_removed);
end;
$function$;
revoke all on function public.save_contact_places(integer, jsonb) from public, anon;
grant execute on function public.save_contact_places(integer, jsonb) to authenticated;

-- 6. the old pointers are read-only (dropped one release later, own OK) -----------------------------------------------
create or replace function public.retired_columns_guard()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if tg_table_name = 'contact_addresses' then
    raise exception 'contact_addresses_read_only' using hint = 'Les adresses sont des lieux : contact_place / place.';
  elsif tg_table_name = 'Oeuvres' then
    if (new.localisation_address_id is not null
        and (tg_op = 'INSERT' or new.localisation_address_id is distinct from old.localisation_address_id))
       or (new."LocalisationDetail" is not null
        and (tg_op = 'INSERT' or new."LocalisationDetail" is distinct from old."LocalisationDetail")) then
      raise exception 'column_retired' using hint = 'Oeuvres.place_id remplace localisation_address_id / LocalisationDetail.';
    end if;
  elsif new.address_id is not null and (tg_op = 'INSERT' or new.address_id is distinct from old.address_id) then
    raise exception 'column_retired' using hint = 'place_id remplace address_id.';
  end if;
  return new;
end;
$function$;
revoke all on function public.retired_columns_guard() from public, anon, authenticated;

create trigger trg_contact_addresses_read_only
  before insert or update of label, adresse, code_postal, ville, pays, position, shipping_notes
  on public.contact_addresses for each row execute function public.retired_columns_guard();
create trigger trg_oeuvres_retired_columns
  before insert or update of localisation_address_id, "LocalisationDetail"
  on public."Oeuvres" for each row execute function public.retired_columns_guard();
create trigger trg_work_order_retired_columns
  before insert or update of address_id on public.work_order for each row execute function public.retired_columns_guard();
create trigger trg_shipment_retired_columns
  before insert or update of address_id on public.shipment for each row execute function public.retired_columns_guard();
revoke insert, update, delete on public.contact_addresses from anon, authenticated;

-- 7. checks — all 0 or nothing is kept ------------------------------------------------------------------------------
do $$
declare
  c jsonb := public.places_check();
  k text;
  n bigint;
begin
  for k, n in select key, value::bigint from jsonb_each_text(c) loop
    -- a work at a place its holder is not linked to is accepted and flagged (Pem 2026-11-23): said, not refused
    if k = 'works_whose_holder_is_not_linked_to_the_place_root' then
      if n <> 0 then raise notice 'flagged (oeuvre_place_unlinked): % works', n; end if;
      continue;
    end if;
    if n <> 0 then raise exception 'places_check failed: % = %', k, n; end if;
  end loop;
  select count(*) into n from public."Oeuvres" where localisation_address_id is not null and place_id is null;
  if n <> 0 then raise exception 'works with an address but no place: %', n; end if;
  select count(*) into n from public."Oeuvres" o join public.place_address_map m on m.address_id = o.localisation_address_id
   where o.place_id <> m.place_id;
  if n <> 0 then raise exception 'works on the wrong place: %', n; end if;
  select count(*) into n from public.work_order where address_id is not null and place_id is null;
  if n <> 0 then raise exception 'orders with an address but no place: %', n; end if;
  select count(*) into n from public.shipment where address_id is not null and place_id is null;
  if n <> 0 then raise exception 'shipments with an address but no place: %', n; end if;
  select count(*) into n from public.place where coalesce(btrim(name), '') = '';
  if n <> 0 then raise exception 'places without a name: %', n; end if;
end $$;

commit;
