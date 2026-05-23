-- Slice 5 — optional one-time backfill of trigger-synced edges for existing junction/FK data.
-- Run after 03 (nodes) and 05 (triggers + unique index). Idempotent (ON CONFLICT DO NOTHING).

INSERT INTO public.tblrelations (source_uid, target_uid, relation_type, source_id, target_id)
SELECT
  public.graph_node_id('oeuvre', ot.oeuvre_id::text),
  public.graph_node_id('theme', ot.theme_id::text),
  'theme',
  ot.oeuvre_id,
  NULL
FROM public.oeuvre_theme ot
WHERE public.graph_node_id('oeuvre', ot.oeuvre_id::text) IS NOT NULL
  AND public.graph_node_id('theme', ot.theme_id::text) IS NOT NULL
ON CONFLICT (source_uid, target_uid, relation_type) DO NOTHING;

INSERT INTO public.tblrelations (source_uid, target_uid, relation_type, source_id, target_id)
SELECT
  public.graph_node_id('oeuvre', wgw.oeuvre_id::text),
  public.graph_node_id('working_group', wgw.group_id::text),
  'workgroup',
  wgw.oeuvre_id,
  NULL
FROM public.working_group_work wgw
WHERE public.graph_node_id('oeuvre', wgw.oeuvre_id::text) IS NOT NULL
  AND public.graph_node_id('working_group', wgw.group_id::text) IS NOT NULL
ON CONFLICT (source_uid, target_uid, relation_type) DO NOTHING;

INSERT INTO public.tblrelations (source_uid, target_uid, relation_type, source_id, target_id)
SELECT
  public.graph_node_id('oeuvre', o."OeuvreID"::text),
  public.graph_node_id('contact', o."AcheteurID"::text),
  'buyer',
  o."OeuvreID",
  NULL
FROM public."Oeuvres" o
WHERE o."AcheteurID" IS NOT NULL
  AND public.graph_node_id('oeuvre', o."OeuvreID"::text) IS NOT NULL
  AND public.graph_node_id('contact', o."AcheteurID"::text) IS NOT NULL
ON CONFLICT (source_uid, target_uid, relation_type) DO NOTHING;

INSERT INTO public.tblrelations (source_uid, target_uid, relation_type, source_id, target_id)
SELECT
  public.graph_node_id('oeuvre', o."OeuvreID"::text),
  public.graph_node_id('contact', o."ContactID"::text),
  'owner',
  o."OeuvreID",
  NULL
FROM public."Oeuvres" o
WHERE o."ContactID" IS NOT NULL
  AND public.graph_node_id('oeuvre', o."OeuvreID"::text) IS NOT NULL
  AND public.graph_node_id('contact', o."ContactID"::text) IS NOT NULL
ON CONFLICT (source_uid, target_uid, relation_type) DO NOTHING;

INSERT INTO public.tblrelations (source_uid, target_uid, relation_type, source_id, target_id)
SELECT
  public.graph_node_id('oeuvre', o."OeuvreID"::text),
  public.graph_node_id('contact', o."LocalisationID"::text),
  'located_at',
  o."OeuvreID",
  NULL
FROM public."Oeuvres" o
WHERE o."LocalisationID" IS NOT NULL
  AND public.graph_node_id('oeuvre', o."OeuvreID"::text) IS NOT NULL
  AND public.graph_node_id('contact', o."LocalisationID"::text) IS NOT NULL
ON CONFLICT (source_uid, target_uid, relation_type) DO NOTHING;
