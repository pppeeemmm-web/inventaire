-- Slice 5 — optional one-time backfill of trigger-synced edges for existing junction/FK data.
-- Run after 03 (nodes). Prefer after 05 (triggers + unique index) so live edits stay in sync.
-- Idempotent via NOT EXISTS (works even if 05 unique index is not created yet).

INSERT INTO public.tblrelations (source_uid, target_uid, relation_type, source_id, target_id)
SELECT s.src, s.tgt, 'theme', s.oeuvre_id, NULL
FROM (
  SELECT
    ot.oeuvre_id,
    public.graph_node_id('oeuvre', ot.oeuvre_id::text) AS src,
    public.graph_node_id('theme', ot.theme_id::text) AS tgt
  FROM public.oeuvre_theme ot
) s
WHERE s.src IS NOT NULL
  AND s.tgt IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.tblrelations r
    WHERE r.source_uid = s.src
      AND r.target_uid = s.tgt
      AND r.relation_type = 'theme'
  );

INSERT INTO public.tblrelations (source_uid, target_uid, relation_type, source_id, target_id)
SELECT s.src, s.tgt, 'workgroup', s.oeuvre_id, NULL
FROM (
  SELECT
    wgw.oeuvre_id,
    public.graph_node_id('oeuvre', wgw.oeuvre_id::text) AS src,
    public.graph_node_id('working_group', wgw.group_id::text) AS tgt
  FROM public.working_group_work wgw
) s
WHERE s.src IS NOT NULL
  AND s.tgt IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.tblrelations r
    WHERE r.source_uid = s.src
      AND r.target_uid = s.tgt
      AND r.relation_type = 'workgroup'
  );

INSERT INTO public.tblrelations (source_uid, target_uid, relation_type, source_id, target_id)
SELECT s.src, s.tgt, 'buyer', s.oeuvre_id, NULL
FROM (
  SELECT
    o."OeuvreID" AS oeuvre_id,
    public.graph_node_id('oeuvre', o."OeuvreID"::text) AS src,
    public.graph_node_id('contact', o."AcheteurID"::text) AS tgt
  FROM public."Oeuvres" o
  WHERE o."AcheteurID" IS NOT NULL
) s
WHERE s.src IS NOT NULL
  AND s.tgt IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.tblrelations r
    WHERE r.source_uid = s.src
      AND r.target_uid = s.tgt
      AND r.relation_type = 'buyer'
  );

INSERT INTO public.tblrelations (source_uid, target_uid, relation_type, source_id, target_id)
SELECT s.src, s.tgt, 'owner', s.oeuvre_id, NULL
FROM (
  SELECT
    o."OeuvreID" AS oeuvre_id,
    public.graph_node_id('oeuvre', o."OeuvreID"::text) AS src,
    public.graph_node_id('contact', o."ContactID"::text) AS tgt
  FROM public."Oeuvres" o
  WHERE o."ContactID" IS NOT NULL
) s
WHERE s.src IS NOT NULL
  AND s.tgt IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.tblrelations r
    WHERE r.source_uid = s.src
      AND r.target_uid = s.tgt
      AND r.relation_type = 'owner'
  );

INSERT INTO public.tblrelations (source_uid, target_uid, relation_type, source_id, target_id)
SELECT s.src, s.tgt, 'located_at', s.oeuvre_id, NULL
FROM (
  SELECT
    o."OeuvreID" AS oeuvre_id,
    public.graph_node_id('oeuvre', o."OeuvreID"::text) AS src,
    public.graph_node_id('contact', o."LocalisationID"::text) AS tgt
  FROM public."Oeuvres" o
  WHERE o."LocalisationID" IS NOT NULL
) s
WHERE s.src IS NOT NULL
  AND s.tgt IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.tblrelations r
    WHERE r.source_uid = s.src
      AND r.target_uid = s.tgt
      AND r.relation_type = 'located_at'
  );
