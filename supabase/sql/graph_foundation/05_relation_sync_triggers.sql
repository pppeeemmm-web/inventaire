-- Slice 5 — sync hard-column / junction rows into tblrelations (trigger-owned; no app dual-write).
-- Uses pg_trigger_depth() to avoid cascade loops with tblrelations → nodes CASCADE.

CREATE UNIQUE INDEX IF NOT EXISTS tblrelations_uid_pair_type_uniq
  ON public.tblrelations (source_uid, target_uid, relation_type)
  WHERE source_uid IS NOT NULL AND target_uid IS NOT NULL AND relation_type IS NOT NULL;

-- ── oeuvre_theme → theme ─────────────────────────────────────────────────────

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

  IF v_src IS NULL OR v_tgt IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.tblrelations (source_uid, target_uid, relation_type, source_id, target_id)
  VALUES (v_src, v_tgt, 'theme', v_oeuvre_id, NULL)
  ON CONFLICT (source_uid, target_uid, relation_type) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS graph_sync_oeuvre_theme_edge ON public.oeuvre_theme;
CREATE TRIGGER graph_sync_oeuvre_theme_edge
  AFTER INSERT OR DELETE ON public.oeuvre_theme
  FOR EACH ROW
  EXECUTE FUNCTION public.graph_sync_oeuvre_theme_edge();

-- ── working_group_work → workgroup ───────────────────────────────────────────

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

  IF v_src IS NULL OR v_tgt IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.tblrelations (source_uid, target_uid, relation_type, source_id, target_id)
  VALUES (v_src, v_tgt, 'workgroup', v_oeuvre_id, NULL)
  ON CONFLICT (source_uid, target_uid, relation_type) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS graph_sync_working_group_work_edge ON public.working_group_work;
CREATE TRIGGER graph_sync_working_group_work_edge
  AFTER INSERT OR DELETE ON public.working_group_work
  FOR EACH ROW
  EXECUTE FUNCTION public.graph_sync_working_group_work_edge();

-- ── Oeuvres buyer / owner / location contacts ──────────────────────────────────

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

  -- Buyer (AcheteurID)
  DELETE FROM public.tblrelations
  WHERE relation_type = 'buyer' AND source_uid = v_oeuvre;

  IF NEW."AcheteurID" IS NOT NULL THEN
    v_buyer := public.graph_node_id('contact', NEW."AcheteurID"::text);
    IF v_buyer IS NOT NULL THEN
      INSERT INTO public.tblrelations (source_uid, target_uid, relation_type, source_id, target_id)
      VALUES (v_oeuvre, v_buyer, 'buyer', NEW."OeuvreID", NULL)
      ON CONFLICT (source_uid, target_uid, relation_type) DO NOTHING;
    END IF;
  END IF;

  -- Owner (ContactID)
  DELETE FROM public.tblrelations
  WHERE relation_type = 'owner' AND source_uid = v_oeuvre;

  IF NEW."ContactID" IS NOT NULL THEN
    v_owner := public.graph_node_id('contact', NEW."ContactID"::text);
    IF v_owner IS NOT NULL THEN
      INSERT INTO public.tblrelations (source_uid, target_uid, relation_type, source_id, target_id)
      VALUES (v_oeuvre, v_owner, 'owner', NEW."OeuvreID", NULL)
      ON CONFLICT (source_uid, target_uid, relation_type) DO NOTHING;
    END IF;
  END IF;

  -- Location contact (LocalisationID)
  DELETE FROM public.tblrelations
  WHERE relation_type = 'located_at' AND source_uid = v_oeuvre;

  IF NEW."LocalisationID" IS NOT NULL THEN
    v_loc := public.graph_node_id('contact', NEW."LocalisationID"::text);
    IF v_loc IS NOT NULL THEN
      INSERT INTO public.tblrelations (source_uid, target_uid, relation_type, source_id, target_id)
      VALUES (v_oeuvre, v_loc, 'located_at', NEW."OeuvreID", NULL)
      ON CONFLICT (source_uid, target_uid, relation_type) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS graph_sync_oeuvre_contact_edges ON public."Oeuvres";
CREATE TRIGGER graph_sync_oeuvre_contact_edges
  AFTER INSERT OR UPDATE OF "AcheteurID", "ContactID", "LocalisationID" ON public."Oeuvres"
  FOR EACH ROW
  EXECUTE FUNCTION public.graph_sync_oeuvre_contact_edges();

-- concept.themes[] (text names) intentionally not synced here — no stable theme FK.
