-- Slice 6 — flat edge rows for pivot / export (entity ⋈ tblrelations ⋈ entity).

CREATE OR REPLACE VIEW public.edge_fact
WITH (security_invoker = true) AS
SELECT
  r.id AS edge_id,
  r.relation_type,
  r.strength,
  r.description,
  r.created_at AS edge_created_at,
  r.source_id AS legacy_source_oeuvre_id,
  r.target_id AS legacy_target_oeuvre_id,
  r.source_uid AS source_node_id,
  r.target_uid AS target_node_id,
  es.node_type AS source_node_type,
  es.source_pk AS source_pk,
  coalesce(es.display_label, es.title) AS source_label,
  es.legacy_int_id AS source_legacy_int_id,
  es.legacy_uuid AS source_legacy_uuid,
  et.node_type AS target_node_type,
  et.source_pk AS target_pk,
  coalesce(et.display_label, et.title) AS target_label,
  et.legacy_int_id AS target_legacy_int_id,
  et.legacy_uuid AS target_legacy_uuid
FROM public.tblrelations r
LEFT JOIN public.entity es ON es.node_id = r.source_uid
LEFT JOIN public.entity et ON et.node_id = r.target_uid
WHERE r.source_uid IS NOT NULL
  AND r.target_uid IS NOT NULL;

COMMENT ON VIEW public.edge_fact IS
  'Hydrated graph edges for pivot atlas and CSV export (Slice 6).';

GRANT SELECT ON public.edge_fact TO authenticated;
