-- People: spheres, birth / death dates, links between people (People.md §1, §3, §4b, §4c, §10 steps 4, 6, 7).
-- Pem GO 2026-11-23 (« run the job »). Run once; re-runnable (if not exists / or replace / on conflict).
--
-- A. Spheres: a fixed list `contact_sphere` (FR / EN labels) and `contact_tag` (contact × sphere). Seeded from the
--    three old single-value fields (Role, Type) — those columns stay for their readers until they move to tags.
-- B. `Contact.born_on` / `born_precision`, `died_on` / `died_precision`, written through `save_contact` (anyone in
--    the team, like every contact field).
-- C. Links between people and « interested in » are human links in the existing graph `tblrelations`
--    (contact nodes exist): kinds introduced · spouse · works_at · advises · works_with · interested_in, with the
--    author and, for an interest, where it came from (source_kind + source_ref). No new link table.
-- Doors (security definer, team only, all or nothing, the truth back): `set_contact_spheres`, `save_person_link`.
-- Reads: `person_links(contact_id)` (security invoker: RLS decides what the caller sees).
-- A team member's change through these doors writes one `system_log` row (event_type 'contact_team_change') for
-- Pem's Fil (People.md §3); an admin's own changes are not logged there.

-- ───────────────────────── A. Spheres ─────────────────────────
create table if not exists public.contact_sphere (
  id smallint generated always as identity primary key,
  key text not null unique,
  label_fr text not null,
  label_en text not null,
  position smallint not null default 0
);
comment on table public.contact_sphere is 'Fixed list of spheres a person belongs to (People.md §1). Written by SQL only.';

insert into public.contact_sphere (key, label_fr, label_en, position) values
  ('collector',    'Collectionneur', 'Collector',    10),
  ('gallery',      'Galerie',        'Gallery',      20),
  ('institution',  'Institution',    'Institution',  30),
  ('curator',      'Commissaire',    'Curator',      40),
  ('press',        'Presse',         'Press',        50),
  ('artist',       'Artiste',        'Artist',       60),
  ('thinker',      'Penseur',        'Thinker',      70),
  ('advisor',      'Conseil',        'Advisor',      80),
  ('collaborator', 'Collaborateur',  'Collaborator', 90),
  ('supplier',     'Fournisseur',    'Supplier',    100),
  ('maker',        'Fabricant',      'Maker',       110),
  ('friend',       'Ami',            'Friend',      120),
  ('family',       'Famille',        'Family',      130)
on conflict (key) do nothing;

create table if not exists public.contact_tag (
  contact_id integer not null references public."Contact"("ContactID") on delete cascade,
  sphere_id smallint not null references public.contact_sphere(id) on delete restrict,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  primary key (contact_id, sphere_id)
);
create index if not exists contact_tag_sphere_idx on public.contact_tag (sphere_id);
comment on table public.contact_tag is 'Person × sphere (People.md §1). Written only by set_contact_spheres / merge.';

alter table public.contact_sphere enable row level security;
alter table public.contact_tag enable row level security;

drop policy if exists "contact_sphere: team read" on public.contact_sphere;
create policy "contact_sphere: team read" on public.contact_sphere for select to authenticated using (public.is_team());

-- A tag on a private card is seen only by whoever may see the card (same rule as the card).
drop policy if exists "contact_tag: team read" on public.contact_tag;
create policy "contact_tag: team read" on public.contact_tag for select to authenticated
  using (public.is_team() and exists (select 1 from public."Contact" c where c."ContactID" = contact_id));

grant select on public.contact_sphere to authenticated;
grant select on public.contact_tag to authenticated;
revoke insert, update, delete on public.contact_tag from authenticated, anon;

-- Seed from the old fields (only cards with no tag yet, so a re-run never fights later edits).
insert into public.contact_tag (contact_id, sphere_id, created_by)
select distinct c."ContactID", s.id, null::uuid
from public."Contact" c
cross join lateral (values
  (case lower(trim(coalesce(c."Role", '')))
     when 'ami' then 'friend' when 'famille' then 'family' when 'magasin' then 'supplier'
     when 'institution' then 'institution' when 'artiste' then 'artist' when 'artiste - owner' then 'artist'
     when 'fabricant' then 'maker' when 'collaborateur' then 'collaborator' when 'galeriste' then 'gallery'
     when 'gallery' then 'gallery' when 'conseiller' then 'advisor' when 'supplier' then 'supplier'
     when 'collectionneur' then 'collector' end),
  (case lower(trim(coalesce(c."Type", '')))
     when 'fournisseur' then 'supplier' when 'artiste' then 'artist' end)
) v(k)
join public.contact_sphere s on s.key = v.k
where v.k is not null
  and not exists (select 1 from public.contact_tag t where t.contact_id = c."ContactID")
on conflict do nothing;

create or replace function public.set_contact_spheres(p_contact integer, p_keys text[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin boolean := public.is_admin();
  v_private boolean;
  v_before text[];
  v_after text[];
  v_bad text;
begin
  if not (v_admin or public.is_team()) then
    return jsonb_build_object('refused', 'forbidden');
  end if;
  select c.is_private into v_private from public."Contact" c where c."ContactID" = p_contact for update;
  if not found or (coalesce(v_private, false) and not v_admin) then
    return jsonb_build_object('refused', 'not_found');
  end if;
  select k into v_bad from unnest(coalesce(p_keys, '{}')) k
    where not exists (select 1 from public.contact_sphere s where s.key = k) limit 1;
  if v_bad is not null then
    return jsonb_build_object('refused', 'bad_field', 'detail', v_bad);
  end if;

  select coalesce(array_agg(s.key order by s.position), '{}') into v_before
    from public.contact_tag t join public.contact_sphere s on s.id = t.sphere_id where t.contact_id = p_contact;
  select coalesce(array_agg(distinct k), '{}') into v_after from unnest(coalesce(p_keys, '{}')) k;
  select coalesce(array_agg(s.key order by s.position), '{}') into v_after
    from public.contact_sphere s where s.key = any(v_after);

  if v_before = v_after then
    return jsonb_build_object('unchanged', true, 'spheres', to_jsonb(v_after));
  end if;

  delete from public.contact_tag t using public.contact_sphere s
    where t.contact_id = p_contact and s.id = t.sphere_id and not (s.key = any(v_after));
  insert into public.contact_tag (contact_id, sphere_id, created_by)
    select p_contact, s.id, auth.uid() from public.contact_sphere s where s.key = any(v_after)
    on conflict do nothing;

  if not v_admin then
    insert into public.system_log (action, event_type, table_name, row_id, old_value, new_value, author_id, user_id)
    values ('Sphères modifiées', 'contact_team_change', 'contact_tag', p_contact::text,
            jsonb_build_object('spheres', v_before), jsonb_build_object('spheres', v_after), auth.uid(), auth.uid());
  end if;
  return jsonb_build_object('ok', true, 'spheres', to_jsonb(v_after), 'changed', jsonb_build_array('spheres'));
end $$;

revoke all on function public.set_contact_spheres(integer, text[]) from public, anon;
grant execute on function public.set_contact_spheres(integer, text[]) to authenticated;

-- ───────────────────────── B. Birth / death ─────────────────────────
alter table public."Contact" add column if not exists born_on date;
alter table public."Contact" add column if not exists born_precision text;
alter table public."Contact" add column if not exists died_on date;
alter table public."Contact" add column if not exists died_precision text;
do $$ begin
  alter table public."Contact" add constraint contact_born_precision_chk check (born_precision is null or born_precision in ('day', 'month', 'year'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public."Contact" add constraint contact_died_precision_chk check (died_precision is null or died_precision in ('day', 'month', 'year'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public."Contact" add constraint contact_died_after_born_chk check (died_on is null or born_on is null or died_on >= born_on);
exception when duplicate_object then null; end $$;
comment on column public."Contact".died_on is 'A person who has died stays in the lists (People.md §3). Anyone in the team may record it; a team change reaches Pem''s Fil.';
-- The four fields join the door's allowed list: see the save_contact_fn.sql edit run with this file.

-- ───────────────────────── C. Links between people ─────────────────────────
alter table public.tblrelations add column if not exists created_by uuid;
alter table public.tblrelations add column if not exists source_kind text;
alter table public.tblrelations add column if not exists source_ref text;
do $$ begin
  alter table public.tblrelations add constraint tblrelations_source_kind_chk
    check (source_kind is null or source_kind in ('kit', 'visit', 'meeting', 'call', 'event', 'enquiry', 'said'));
exception when duplicate_object then null; end $$;
comment on column public.tblrelations.source_kind is 'For a human interested_in link: where the interest came from (People.md §4b).';

create or replace function public._contact_node(p_contact integer)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v uuid;
begin
  select n.node_id into v from public.nodes n where n.node_type = 'contact' and n.source_pk = p_contact::text;
  if v is null and exists (select 1 from public."Contact" c where c."ContactID" = p_contact) then
    insert into public.nodes (node_type, source_pk) values ('contact', p_contact::text)
      on conflict (node_type, source_pk) do nothing;
    select n.node_id into v from public.nodes n where n.node_type = 'contact' and n.source_pk = p_contact::text;
  end if;
  return v;
end $$;
revoke all on function public._contact_node(integer) from public, anon, authenticated;

create or replace function public._oeuvre_node(p_oeuvre integer)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select n.node_id from public.nodes n where n.node_type = 'oeuvre' and n.source_pk = p_oeuvre::text
$$;
revoke all on function public._oeuvre_node(integer) from public, anon, authenticated;

-- p: { op: 'add' | 'remove', from: contact id, to_contact: id | null, to_work: id | null, kind,
--      source_kind?, source_ref? }
create or replace function public.save_person_link(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_people constant text[] := array['introduced', 'spouse', 'works_at', 'advises', 'works_with'];
  v_admin boolean := public.is_admin();
  v_op text := p->>'op';
  v_kind text := p->>'kind';
  v_from int := nullif(p->>'from', '')::int;
  v_to_c int := nullif(p->>'to_contact', '')::int;
  v_to_w int := nullif(p->>'to_work', '')::int;
  v_skind text := nullif(p->>'source_kind', '');
  v_sref text := nullif(p->>'source_ref', '');
  v_src uuid;
  v_dst uuid;
  v_n int;
begin
  if not (v_admin or public.is_team()) then
    return jsonb_build_object('refused', 'forbidden');
  end if;
  if v_op not in ('add', 'remove') then
    return jsonb_build_object('refused', 'bad_field', 'detail', 'op');
  end if;
  if v_kind = 'interested_in' then
    if v_to_w is null or v_to_c is not null then return jsonb_build_object('refused', 'bad_field', 'detail', 'to_work'); end if;
    if v_op = 'add' and v_skind is null then return jsonb_build_object('refused', 'bad_field', 'detail', 'source_kind'); end if;
    if v_skind is not null and v_skind not in ('kit', 'visit', 'meeting', 'call', 'event', 'enquiry', 'said') then
      return jsonb_build_object('refused', 'bad_field', 'detail', 'source_kind');
    end if;
  elsif v_kind = any(c_people) then
    if v_to_c is null or v_to_w is not null then return jsonb_build_object('refused', 'bad_field', 'detail', 'to_contact'); end if;
    if v_to_c = v_from then return jsonb_build_object('refused', 'bad_field', 'detail', 'self'); end if;
  else
    return jsonb_build_object('refused', 'bad_field', 'detail', 'kind');
  end if;

  -- Both ends must exist and be visible to the caller (a private card only for an admin).
  if not exists (select 1 from public."Contact" c where c."ContactID" = v_from and (v_admin or not coalesce(c.is_private, false))) then
    return jsonb_build_object('refused', 'not_found', 'detail', 'from');
  end if;
  if v_to_c is not null and not exists (select 1 from public."Contact" c where c."ContactID" = v_to_c and (v_admin or not coalesce(c.is_private, false))) then
    return jsonb_build_object('refused', 'not_found', 'detail', 'to_contact');
  end if;
  if v_to_w is not null and not exists (select 1 from public."Oeuvres" o where o."OeuvreID" = v_to_w and o.deleted_at is null) then
    return jsonb_build_object('refused', 'not_found', 'detail', 'to_work');
  end if;

  v_src := public._contact_node(v_from);
  v_dst := case when v_to_w is not null then public._oeuvre_node(v_to_w) else public._contact_node(v_to_c) end;
  if v_src is null or v_dst is null then
    return jsonb_build_object('refused', 'not_found', 'detail', 'node');
  end if;

  if v_op = 'add' then
    insert into public.tblrelations (source_uid, target_uid, relation_type, created_by, source_kind, source_ref)
    values (v_src, v_dst, v_kind, auth.uid(), v_skind, v_sref)
    on conflict (source_uid, target_uid, relation_type)
      where source_uid is not null and target_uid is not null and relation_type is not null
      do nothing;
    get diagnostics v_n = row_count;
  else
    delete from public.tblrelations r
      where r.source_uid = v_src and r.target_uid = v_dst and r.relation_type = v_kind;
    get diagnostics v_n = row_count;
  end if;

  if v_n = 0 then
    return jsonb_build_object('unchanged', true);
  end if;
  if not v_admin then
    insert into public.system_log (action, event_type, table_name, row_id, old_value, new_value, author_id, user_id)
    values (case v_op when 'add' then 'Lien ajouté' else 'Lien retiré' end, 'contact_team_change', 'tblrelations',
            v_from::text, case v_op when 'remove' then p end, case v_op when 'add' then p end, auth.uid(), auth.uid());
  end if;
  return jsonb_build_object('ok', true, 'changed', jsonb_build_array('links'));
end $$;

revoke all on function public.save_person_link(jsonb) from public, anon;
grant execute on function public.save_person_link(jsonb) to authenticated;

-- One read for the person page: every human link touching this person, both directions, with the other end.
create or replace function public.person_links(p_contact integer)
returns table (
  kind text,
  outgoing boolean,
  other_contact_id integer,
  other_work_id integer,
  source_kind text,
  source_ref text,
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  with me as (
    select n.node_id from public.nodes n where n.node_type = 'contact' and n.source_pk = p_contact::text
  )
  select r.relation_type, true,
         case when n2.node_type = 'contact' then n2.source_pk::int end,
         case when n2.node_type = 'oeuvre' then n2.source_pk::int end,
         r.source_kind, r.source_ref, r.created_at
  from public.tblrelations r
  join me on r.source_uid = me.node_id
  join public.nodes n2 on n2.node_id = r.target_uid
  where r.relation_type in ('introduced', 'spouse', 'works_at', 'advises', 'works_with', 'interested_in')
  union all
  select r.relation_type, false, n1.source_pk::int, null::int, r.source_kind, r.source_ref, r.created_at
  from public.tblrelations r
  join me on r.target_uid = me.node_id
  join public.nodes n1 on n1.node_id = r.source_uid and n1.node_type = 'contact'
  where r.relation_type in ('introduced', 'spouse', 'works_at', 'advises', 'works_with')
  order by 7 desc
$$;
grant execute on function public.person_links(integer) to authenticated;

-- ───────────────────────── Doors that learn the new stores ─────────────────────────
-- The live `save_contact` / `merge_contacts` bodies are newer than their repo files (places work), so they are
-- patched in place here from their live text, guarded so a re-run changes nothing.

-- Merge: the lost card's human links move to the kept card's node (duplicates and self-links dropped);
-- whatever is left goes with the lost node.
create or replace function public._merge_person_links(p_keep integer, p_lose integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_keep uuid := public._contact_node(p_keep);
  v_lose uuid;
begin
  select n.node_id into v_lose from public.nodes n where n.node_type = 'contact' and n.source_pk = p_lose::text;
  if v_keep is null or v_lose is null then return; end if;
  update public.tblrelations r set source_uid = v_keep
   where r.source_uid = v_lose
     and r.relation_type in ('introduced', 'spouse', 'works_at', 'advises', 'works_with', 'interested_in')
     and r.target_uid <> v_keep
     and not exists (select 1 from public.tblrelations k
                      where k.source_uid = v_keep and k.target_uid = r.target_uid and k.relation_type = r.relation_type);
  update public.tblrelations r set target_uid = v_keep
   where r.target_uid = v_lose
     and r.relation_type in ('introduced', 'spouse', 'works_at', 'advises', 'works_with')
     and r.source_uid <> v_keep
     and not exists (select 1 from public.tblrelations k
                      where k.target_uid = v_keep and k.source_uid = r.source_uid and k.relation_type = r.relation_type);
end $$;
revoke all on function public._merge_person_links(integer, integer) from public, anon, authenticated;

do $patch$
declare
  v_def text;
  c_anchor constant text := E'  delete from public."Contact" where "ContactID" = p_lose;';
  c_add constant text := E'  -- People spheres and human links (people_spheres_dates_links.sql).\n'
    || E'  insert into public.contact_tag (contact_id, sphere_id, created_at, created_by)\n'
    || E'    select p_keep, t.sphere_id, t.created_at, t.created_by from public.contact_tag t where t.contact_id = p_lose\n'
    || E'    on conflict do nothing;\n'
    || E'  delete from public.contact_tag where contact_id = p_lose;\n'
    || E'  perform public._merge_person_links(p_keep, p_lose);\n\n';
begin
  v_def := pg_get_functiondef('public.merge_contacts(integer, integer)'::regprocedure);
  if position('_merge_person_links' in v_def) = 0 then
    if position(c_anchor in v_def) = 0 then raise exception 'merge_contacts: anchor not found, patch by hand'; end if;
    execute replace(v_def, c_anchor, c_add || c_anchor);
  end if;

  v_def := pg_get_functiondef('public.save_contact(jsonb)'::regprocedure);
  if position('''born_on''' in v_def) = 0 then
    -- The anchor must be the allowed-fields list only (never the admin-only list): exactly one occurrence.
    if (length(v_def) - length(replace(v_def, $a$'PropriétaireOeuvre',$a$, ''))) / length($a$'PropriétaireOeuvre',$a$) <> 1 then
      raise exception 'save_contact: field list anchor not unique, patch by hand';
    end if;
    execute replace(v_def,
      $a$'PropriétaireOeuvre',$a$,
      $a$'PropriétaireOeuvre', 'born_on', 'born_precision', 'died_on', 'died_precision',$a$);
  end if;
end
$patch$;
