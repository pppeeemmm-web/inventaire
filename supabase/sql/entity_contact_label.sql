-- Journal / graph / search chips name a contact the way every screen does (lib/contacts/contact-display.ts
-- contactListLabel, Pem 2026-11-18 / 19): `DUPONT Marie · Galerie X`; institution only → as typed; a family name
-- equal to the institution (#35) shows the institution once (`Nathalie · Galerie Patrick Reygade`).
-- Before: `Marie Dupont` (display_label: person only, NULL for an institution-only contact).
-- Applied live 2026-11-19 (migration entity_contact_label). Same columns and types as before (security_invoker kept).

create or replace function public.contact_list_label(p_nom text, p_prenom text, p_inst text)
returns text
language sql
immutable
set search_path = public, pg_catalog
as $$
  with v as (
    select
      nullif(btrim(regexp_replace(coalesce(p_nom, ''), '\s+', ' ', 'g')), '') as nom,
      nullif(btrim(regexp_replace(coalesce(p_prenom, ''), '\s+', ' ', 'g')), '') as prenom,
      nullif(btrim(regexp_replace(coalesce(p_inst, ''), '\s+', ' ', 'g')), '') as inst
  ), w as (
    select
      case when nom is not null and inst is not null and lower(nom) = lower(inst) then null else nom end as fam,
      prenom, inst
    from v
  ), x as (
    select nullif(btrim(concat_ws(' ', upper(fam), prenom)), '') as person, inst from w
  )
  select case
    when person is not null and inst is not null then person || ' · ' || inst
    else coalesce(person, inst)
  end
  from x;
$$;

comment on function public.contact_list_label(text, text, text) is
  'Contact name for lists / chips: DUPONT Marie · Galerie X (same rule as lib/contacts/contact-display.ts contactListLabel).';

create or replace view public.entity
with (security_invoker = true)
as
select n.node_id,
  n.node_type,
  n.source_pk,
  n.created_at,
  case n.node_type
    when 'oeuvre'::text then o."Titre"
    when 'contact'::text then public.contact_list_label(c."Nom", c."Prénom", c."NomInstitution")::character varying
    when 'theme'::text then t.name::character varying
    when 'concept'::text then cp.titre::character varying
    when 'working_group'::text then wg.name::character varying
    when 'exhibition'::text then sp.nom::character varying
    when 'journal_entry'::text then "left"(regexp_replace(btrim(je.body), '\s+'::text, ' '::text, 'g'::text), 80)::character varying
    else null::character varying
  end as display_label,
  case n.node_type
    when 'oeuvre'::text then o."Titre"
    when 'contact'::text then public.contact_list_label(c."Nom", c."Prénom", c."NomInstitution")::character varying
    when 'theme'::text then t.name::character varying
    when 'concept'::text then cp.titre::character varying
    when 'working_group'::text then wg.name::character varying
    when 'exhibition'::text then sp.nom::character varying
    when 'journal_entry'::text then "left"(regexp_replace(btrim(je.body), '\s+'::text, ' '::text, 'g'::text), 80)::character varying
    else null::character varying
  end as title,
  case n.node_type
    when 'oeuvre'::text then o.is_public
    else false
  end as is_public,
  case n.node_type
    when 'oeuvre'::text then o."OeuvreID"
    when 'contact'::text then c."ContactID"
    when 'journal_entry'::text then je.id::integer
    else null::integer
  end as legacy_int_id,
  case n.node_type
    when 'concept'::text then cp.id
    when 'working_group'::text then wg.id
    when 'exhibition'::text then sp.id
    else null::uuid
  end as legacy_uuid
from nodes n
  left join "Oeuvres" o on n.node_type = 'oeuvre'::text and n.source_pk = o."OeuvreID"::text
  left join "Contact" c on n.node_type = 'contact'::text and n.source_pk = c."ContactID"::text
  left join theme t on n.node_type = 'theme'::text and n.source_pk = t.id::text
  left join concept cp on n.node_type = 'concept'::text and n.source_pk = cp.id::text
  left join working_group wg on n.node_type = 'working_group'::text and n.source_pk = wg.id::text
  left join suivi_process sp on n.node_type = 'exhibition'::text and n.source_pk = sp.id::text and sp.type = 'exposition'::text
  left join journal_entry je on n.node_type = 'journal_entry'::text and n.source_pk = je.id::text;
