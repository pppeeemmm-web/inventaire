-- Slice 5 — unified entity read model for graph / search / constellation hydration.

CREATE OR REPLACE VIEW public.entity AS
SELECT
  n.node_id,
  n.node_type,
  n.source_pk,
  n.created_at,
  CASE n.node_type
    WHEN 'oeuvre' THEN o."Titre"
    WHEN 'contact' THEN nullif(
      btrim(concat_ws(' ', c."Prénom", c."Nom")),
      ''
    )
    WHEN 'theme' THEN t.name
    WHEN 'concept' THEN cp.titre
    WHEN 'working_group' THEN wg.name
    WHEN 'exhibition' THEN sp.nom
    ELSE NULL
  END AS display_label,
  CASE n.node_type
    WHEN 'oeuvre' THEN o."Titre"
    WHEN 'contact' THEN coalesce(
      nullif(btrim(concat_ws(' ', c."Prénom", c."Nom")), ''),
      c."NomInstitution"
    )
    WHEN 'theme' THEN t.name
    WHEN 'concept' THEN cp.titre
    WHEN 'working_group' THEN wg.name
    WHEN 'exhibition' THEN sp.nom
    ELSE NULL
  END AS title,
  CASE n.node_type
    WHEN 'oeuvre' THEN o.is_public
    ELSE false
  END AS is_public,
  CASE n.node_type
    WHEN 'oeuvre' THEN o."OeuvreID"
    WHEN 'contact' THEN c."ContactID"
    ELSE NULL
  END AS legacy_int_id,
  CASE n.node_type
    WHEN 'concept' THEN cp.id
    WHEN 'working_group' THEN wg.id
    WHEN 'exhibition' THEN sp.id
    ELSE NULL
  END AS legacy_uuid
FROM public.nodes n
LEFT JOIN public."Oeuvres" o
  ON n.node_type = 'oeuvre' AND n.source_pk = o."OeuvreID"::text
LEFT JOIN public."Contact" c
  ON n.node_type = 'contact' AND n.source_pk = c."ContactID"::text
LEFT JOIN public.theme t
  ON n.node_type = 'theme' AND n.source_pk = t.id::text
LEFT JOIN public.concept cp
  ON n.node_type = 'concept' AND n.source_pk = cp.id::text
LEFT JOIN public.working_group wg
  ON n.node_type = 'working_group' AND n.source_pk = wg.id::text
LEFT JOIN public.suivi_process sp
  ON n.node_type = 'exhibition' AND n.source_pk = sp.id::text AND sp.type = 'exposition';

COMMENT ON VIEW public.entity IS
  'Hydrated graph nodes for search, pivot, and constellation (Slice 5).';

GRANT SELECT ON public.entity TO authenticated;
