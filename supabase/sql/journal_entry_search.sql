-- Journal entries in semantic search (owner GO 2026-11-12).
-- `nodes` already holds journal_entry rows with embeddings (journal_entry_nodes.sql);
-- `match_nodes` returns them, but the `entity` view gave them no label, so search dropped
-- them. Add a journal_entry branch: label = first 80 chars of the body (whitespace folded),
-- legacy_int_id = journal_entry.id. Hidden / private entries have no embedding, so they never
-- match. security_invoker kept: a signed-in reader only sees entries RLS lets them read.
-- Same columns as before (graph_foundation/06_entity_view.sql + later branches), so
-- CREATE OR REPLACE keeps the grants.

create or replace view public.entity
with (security_invoker = true)
as
select n.node_id,
  n.node_type,
  n.source_pk,
  n.created_at,
  case n.node_type
    when 'oeuvre'::text then o."Titre"
    when 'contact'::text then nullif(btrim(concat_ws(' '::text, c."Prénom", c."Nom")), ''::text)::character varying
    when 'theme'::text then t.name::character varying
    when 'concept'::text then cp.titre::character varying
    when 'working_group'::text then wg.name::character varying
    when 'exhibition'::text then sp.nom::character varying
    when 'journal_entry'::text then left(regexp_replace(btrim(je.body), '\s+', ' ', 'g'), 80)::character varying
    else null::character varying
  end as display_label,
  case n.node_type
    when 'oeuvre'::text then o."Titre"
    when 'contact'::text then coalesce(nullif(btrim(concat_ws(' '::text, c."Prénom", c."Nom")), ''::text), c."NomInstitution"::text)::character varying
    when 'theme'::text then t.name::character varying
    when 'concept'::text then cp.titre::character varying
    when 'working_group'::text then wg.name::character varying
    when 'exhibition'::text then sp.nom::character varying
    when 'journal_entry'::text then left(regexp_replace(btrim(je.body), '\s+', ' ', 'g'), 80)::character varying
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
