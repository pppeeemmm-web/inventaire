-- Places — phase B, step 1: addresses -> places (design docs/design/2026-11-23/Places.md §7).
-- Needs places_phase_a_shape.sql first.
--
-- Defines two functions; calling them is the landing's job, in the same change that switches the
-- readers (Places.md §10). Until then this file changes no row.
--   select public.places_backfill_from_addresses();   -- writes place / contact_place / place_address_map
--   select public.places_check();                     -- read only; every count must be 0
--
-- Rules (Pem 2026-11-23):
--   * rows WITH a street: one place per identical line (street + postcode + city, spaces and case ignored);
--   * city-only and empty rows: one place each, never merged; empty ones described « adresse vide »;
--   * Pem (contact 13): « Principal » = the address; « Atelier » = a room inside it (kind studio), merged
--     into the one creation place named like a studio in the same town when there is exactly one;
--   * roles: Pem's Principal = home, Atelier = work; any other row = other (the role is asked later,
--     never guessed — People §4d). Primary = the row labelled « Principal », else the lowest position.
--   * nothing is deleted from contact_addresses; no pointer on Oeuvres / work_order / shipment moves here.
-- Re-runnable: rows already in place_address_map are skipped.
-- Owner OK needed before running live. Proof: Docker copy (scripts/stress/README.md).

create or replace function public.places_backfill_from_addresses()
returns jsonb
language plpgsql
set search_path to 'public'
as $$
declare
  g        record;
  a        record;
  pid      bigint;
  lid      bigint;
  prin     bigint;
  atel     bigint;
  studio   bigint;
  n_street int := 0;
  n_merged int := 0;
  n_single int := 0;
  n_links  int := 0;
  n_studio int := 0;
begin
  -- 1. rows with a street, one place per identical line
  for g in
    select s.k,
           array_agg(s.id order by s.id)                                   as ids,
           min(s.adresse)                                                  as adresse,
           min(s.code_postal)                                              as cp,
           min(s.ville)                                                    as ville,
           min(s.pays)                                                     as pays,
           string_agg(distinct nullif(btrim(s.shipping_notes), ''), E'\n') as notes,
           min(s.label) filter (where s.contact_id = 13)                   as pem_label
      from (select x.*,
                   lower(regexp_replace(btrim(x.adresse), '\s+', ' ', 'g')) || '|' ||
                   lower(btrim(coalesce(x.code_postal, ''))) || '|' ||
                   lower(btrim(coalesce(x.ville, '')))                     as k
              from contact_addresses x
             where coalesce(btrim(x.adresse), '') <> ''
               and not exists (select 1 from place_address_map m where m.address_id = x.id)) s
     group by s.k
  loop
    insert into place (name, kind, address, postcode, town, country, shipping_notes)
    values (coalesce(g.pem_label, btrim(g.adresse)), 'address', btrim(g.adresse),
            nullif(btrim(g.cp), ''), nullif(btrim(g.ville), ''), nullif(btrim(g.pays), ''), g.notes)
    returning id into pid;
    insert into place_address_map (address_id, place_id) select unnest(g.ids), pid;
    n_street := n_street + 1;
    if array_length(g.ids, 1) > 1 then n_merged := n_merged + 1; end if;
  end loop;

  -- 2. city-only and empty rows: one place each
  for a in
    select x.* from contact_addresses x
     where coalesce(btrim(x.adresse), '') = ''
       and not exists (select 1 from place_address_map m where m.address_id = x.id)
     order by x.id
  loop
    insert into place (name, kind, postcode, town, country, shipping_notes, description)
    values (coalesce(nullif(btrim(a.ville), ''), 'Adresse vide'), 'address',
            nullif(btrim(a.code_postal), ''), nullif(btrim(a.ville), ''), nullif(btrim(a.pays), ''),
            nullif(btrim(a.shipping_notes), ''),
            case when coalesce(btrim(a.ville), '') = '' and coalesce(btrim(a.code_postal), '') = ''
                 then 'adresse vide — à compléter ou à terminer' end)
    returning id into pid;
    insert into place_address_map (address_id, place_id) values (a.id, pid);
    n_single := n_single + 1;
  end loop;

  -- 3. Pem: the Atelier is a room inside the Principal
  select m.place_id into prin from contact_addresses x join place_address_map m on m.address_id = x.id
   where x.contact_id = 13 and x.label ilike 'principal' order by x.position nulls last, x.id limit 1;
  select m.place_id into atel from contact_addresses x join place_address_map m on m.address_id = x.id
   where x.contact_id = 13 and x.label ilike 'atelier' order by x.position nulls last, x.id limit 1;

  if prin is not null and atel is not null and prin <> atel
     and not exists (select 1 from place p where p.id = atel and p.parent_id is not null) then
    -- the creation place named like a studio, in the same town, when there is exactly one
    select case when count(*) = 1 then min(p.id) end into studio
      from place p, place q
     where q.id = atel and p.kind = 'studio' and p.parent_id is null and p.id <> atel
       and lower(btrim(p.town)) = lower(btrim(q.town))
       and not exists (select 1 from place_address_map m where m.place_id = p.id);

    if studio is not null then
      update place s
         set complement = coalesce(s.complement, q.address),
             postcode   = coalesce(s.postcode, q.postcode),
             country    = coalesce(s.country, q.country),
             shipping_notes = coalesce(s.shipping_notes, q.shipping_notes)
        from place q where s.id = studio and q.id = atel;
      update place_address_map set place_id = studio where place_id = atel;
      delete from place where id = atel;          -- created a few lines above; nothing points at it
      atel := studio;
      n_studio := 1;
    else
      update place set complement = coalesce(complement, address) where id = atel;
    end if;
    update place set kind = 'studio', parent_id = prin where id = atel;
  end if;

  -- 4. links: one per address row (same person + same place + same role = one link)
  for a in
    select x.id, x.contact_id, x.label, x.position, m.place_id,
           case when x.contact_id = 13 and x.label ilike 'principal' then 'home'
                when x.contact_id = 13 and x.label ilike 'atelier'   then 'work'
                else 'other' end as role,
           row_number() over (partition by x.contact_id
                              order by (x.label ilike 'principal') desc, x.position nulls last, x.id) = 1 as first
      from contact_addresses x join place_address_map m on m.address_id = x.id
     where m.link_id is null
     order by x.contact_id, x.position nulls last, x.id
  loop
    select c.id into lid from contact_place c
     where c.contact_id = a.contact_id and c.place_id = a.place_id and c.role = a.role and c.until is null;
    if lid is null then
      insert into contact_place (contact_id, place_id, role, label, is_primary, position)
      values (a.contact_id, a.place_id, a.role, a.label,
              a.first and not exists (select 1 from contact_place c2
                                       where c2.contact_id = a.contact_id and c2.is_primary and c2.until is null),
              a.position)
      returning id into lid;
      n_links := n_links + 1;
    end if;
    update place_address_map set link_id = lid where address_id = a.id;
    lid := null;
  end loop;

  return jsonb_build_object(
    'street_places', n_street, 'street_places_shared', n_merged,
    'single_places', n_single, 'links', n_links,
    'atelier_merged_into_creation_place', n_studio,
    'principal_place', prin, 'atelier_place', atel);
end;
$$;

-- Read only. Every count must be 0 before the readers switch.
create or replace function public.places_check()
returns jsonb
language sql
stable
set search_path to 'public'
as $$
  select jsonb_build_object(
    'address_rows_not_mapped',
      (select count(*) from contact_addresses x
        where not exists (select 1 from place_address_map m where m.address_id = x.id)),
    'map_rows_without_link',
      (select count(*) from place_address_map where link_id is null),
    'link_person_differs_from_address_row',
      (select count(*) from place_address_map m
         join contact_addresses x on x.id = m.address_id
         join contact_place c on c.id = m.link_id
        where c.contact_id <> x.contact_id or c.place_id <> m.place_id),
    'works_whose_holder_is_not_linked_to_the_place_root',
      (select count(*) from "Oeuvres" o
         join place_address_map m on m.address_id = o.localisation_address_id
         join place p on p.id = m.place_id
        where o.deleted_at is null
          and not exists (select 1 from contact_place c
                           join place q on q.id = c.place_id
                          where c.contact_id = o."LocalisationID" and c.until is null
                            and coalesce(q.root_id, q.id) = coalesce(p.root_id, p.id))),
    'empty_street_rows_merged_together',
      (select count(*) from (select m.place_id from place_address_map m
                               join contact_addresses x on x.id = m.address_id
                              where coalesce(btrim(x.adresse), '') = ''
                              group by m.place_id having count(*) > 1) z),
    'places_without_root',
      (select count(*) from place where root_id is null),
    'people_with_two_primaries',
      (select count(*) from (select contact_id from contact_place
                              where is_primary and until is null group by contact_id having count(*) > 1) z)
  );
$$;

revoke all on function public.places_backfill_from_addresses() from public, anon, authenticated;
revoke all on function public.places_check()                   from public, anon, authenticated;
