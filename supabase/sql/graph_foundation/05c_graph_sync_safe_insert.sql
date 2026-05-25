-- Run when WorkDrawer/theme save fails with:
--   "there is no unique or exclusion constraint matching the ON CONFLICT specification"
-- Cause: graph_sync_* triggers use ON CONFLICT (source_uid, target_uid, relation_type)
-- but tblrelations_uid_pair_type_uniq was never created (05 failed mid-file).
--
-- Safe to re-run. Order: 04b dedupe (if needed) → this file.

-- ── Dedupe (no-op if clean) ───────────────────────────────────────────────────
DELETE FROM public.tblrelations r
USING (
  SELECT id
  FROM (
    SELECT
      id,
      row_number() OVER (
        PARTITION BY source_uid, target_uid, relation_type
        ORDER BY created_at ASC NULLS LAST, id ASC
      ) AS rn
    FROM public.tblrelations
    WHERE source_uid IS NOT NULL
      AND target_uid IS NOT NULL
      AND relation_type IS NOT NULL
  ) ranked
  WHERE rn > 1
) dup
WHERE r.id = dup.id;

CREATE UNIQUE INDEX IF NOT EXISTS tblrelations_uid_pair_type_uniq
  ON public.tblrelations (source_uid, target_uid, relation_type)
  WHERE source_uid IS NOT NULL AND target_uid IS NOT NULL AND relation_type IS NOT NULL;

-- ── Idempotent edge insert (no ON CONFLICT required) ────────────────────────────

CREATE OR REPLACE FUNCTION public.graph_upsert_relation_edge(
  p_source_uid uuid,
  p_target_uid uuid,
  p_relation_type text,
  p_source_id integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_source_uid IS NULL OR p_target_uid IS NULL OR p_relation_type IS NULL THEN
    RETURN;
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.tblrelations r
    WHERE r.relation_type = p_relation_type
      AND r.source_uid IS NOT DISTINCT FROM p_source_uid
      AND r.target_uid IS NOT DISTINCT FROM p_target_uid
  ) THEN
    RETURN;
  END IF;
  INSERT INTO public.tblrelations (source_uid, target_uid, relation_type, source_id, target_id)
  VALUES (p_source_uid, p_target_uid, p_relation_type, p_source_id, NULL);
END;
$$;

-- ── oeuvre_theme ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.graph_sync_oeuvre_theme_edge()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_src uuid;
  v_tgt uuid;
  v_oeuvre_id integer;
  v_theme_id integer;
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_oeuvre_id := OLD.oeuvre_id;
    v_theme_id := OLD.theme_id;
  ELSE
    v_oeuvre_id := NEW.oeuvre_id;
    v_theme_id := NEW.theme_id;
  END IF;

  v_src := public.graph_node_id('oeuvre', v_oeuvre_id::text);
  v_tgt := public.graph_node_id('theme', v_theme_id::text);

  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.tblrelations
    WHERE relation_type = 'theme'
      AND source_uid IS NOT DISTINCT FROM v_src
      AND target_uid IS NOT DISTINCT FROM v_tgt;
    RETURN OLD;
  END IF;

  PERFORM public.graph_upsert_relation_edge(v_src, v_tgt, 'theme', v_oeuvre_id);
  RETURN NEW;
END;
$$;

-- ── working_group_work ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.graph_sync_working_group_work_edge()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_src uuid;
  v_tgt uuid;
  v_oeuvre_id integer;
  v_group_id text;
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_oeuvre_id := OLD.oeuvre_id;
    v_group_id := OLD.group_id::text;
  ELSE
    v_oeuvre_id := NEW.oeuvre_id;
    v_group_id := NEW.group_id::text;
  END IF;

  v_src := public.graph_node_id('oeuvre', v_oeuvre_id::text);
  v_tgt := public.graph_node_id('working_group', v_group_id);

  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.tblrelations
    WHERE relation_type = 'workgroup'
      AND source_uid IS NOT DISTINCT FROM v_src
      AND target_uid IS NOT DISTINCT FROM v_tgt;
    RETURN OLD;
  END IF;

  PERFORM public.graph_upsert_relation_edge(v_src, v_tgt, 'workgroup', v_oeuvre_id);
  RETURN NEW;
END;
$$;

-- ── Oeuvres contact edges ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.graph_sync_oeuvre_contact_edges()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_oeuvre uuid;
  v_buyer uuid;
  v_owner uuid;
  v_loc uuid;
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_oeuvre := public.graph_node_id('oeuvre', NEW."OeuvreID"::text);
  IF v_oeuvre IS NULL THEN
    RETURN NEW;
  END IF;

  DELETE FROM public.tblrelations
  WHERE relation_type = 'buyer' AND source_uid = v_oeuvre;

  IF NEW."AcheteurID" IS NOT NULL THEN
    v_buyer := public.graph_node_id('contact', NEW."AcheteurID"::text);
    PERFORM public.graph_upsert_relation_edge(v_oeuvre, v_buyer, 'buyer', NEW."OeuvreID");
  END IF;

  DELETE FROM public.tblrelations
  WHERE relation_type = 'owner' AND source_uid = v_oeuvre;

  IF NEW."ContactID" IS NOT NULL THEN
    v_owner := public.graph_node_id('contact', NEW."ContactID"::text);
    PERFORM public.graph_upsert_relation_edge(v_oeuvre, v_owner, 'owner', NEW."OeuvreID");
  END IF;

  DELETE FROM public.tblrelations
  WHERE relation_type = 'located_at' AND source_uid = v_oeuvre;

  IF NEW."LocalisationID" IS NOT NULL THEN
    v_loc := public.graph_node_id('contact', NEW."LocalisationID"::text);
    PERFORM public.graph_upsert_relation_edge(v_oeuvre, v_loc, 'located_at', NEW."OeuvreID");
  END IF;

  RETURN NEW;
END;
$$;
