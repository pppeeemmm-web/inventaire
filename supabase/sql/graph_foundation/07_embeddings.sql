-- Slice 8 — embedding columns on nodes, tombstones, search text, dirty triggers.

ALTER TABLE public.nodes
  ADD COLUMN IF NOT EXISTS embedding_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS embedding_text_hash text,
  ADD COLUMN IF NOT EXISTS embedding_model text,
  ADD COLUMN IF NOT EXISTS embedded_at timestamptz,
  ADD COLUMN IF NOT EXISTS qdrant_point_id uuid,
  ADD COLUMN IF NOT EXISTS embedding_error text,
  ADD COLUMN IF NOT EXISTS embedding_attempts int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS embedding_dirty_at timestamptz;

ALTER TABLE public.nodes
  DROP CONSTRAINT IF EXISTS nodes_embedding_status_check;

ALTER TABLE public.nodes
  ADD CONSTRAINT nodes_embedding_status_check CHECK (
    embedding_status IN ('pending', 'embedding', 'ok', 'error', 'skipped')
  );

-- Backfill qdrant_point_id = node_id where unset.
UPDATE public.nodes
SET qdrant_point_id = node_id
WHERE qdrant_point_id IS NULL;

CREATE INDEX IF NOT EXISTS nodes_embedding_poll_idx
  ON public.nodes (node_type, created_at)
  WHERE embedding_status IN ('pending', 'error');

COMMENT ON COLUMN public.nodes.embedding_status IS
  'pending | embedding | ok | error | skipped — worker-owned transitions after insert.';

-- Tombstone queue for Qdrant deletes (Postgres-side guarantee).
CREATE TABLE IF NOT EXISTS public.node_embedding_tombstone (
  node_id uuid PRIMARY KEY,
  deleted_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.node_embedding_tombstone ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.node_embedding_tombstone IS
  'Drained by embed-worker: DELETE in Qdrant then remove row.';

CREATE OR REPLACE FUNCTION public.graph_enqueue_embedding_tombstone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.node_embedding_tombstone (node_id)
  VALUES (OLD.node_id)
  ON CONFLICT (node_id) DO NOTHING;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS graph_enqueue_embedding_tombstone ON public.nodes;
CREATE TRIGGER graph_enqueue_embedding_tombstone
  AFTER DELETE ON public.nodes
  FOR EACH ROW
  EXECUTE FUNCTION public.graph_enqueue_embedding_tombstone();

-- Stable search document per node (concat_ws skips NULL parts).
CREATE OR REPLACE FUNCTION public.node_search_text(p_node_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT nullif(
    trim(
      CASE n.node_type
        WHEN 'oeuvre' THEN (
          SELECT concat_ws(
            '. ',
            o."Titre",
            o."Commentaires",
            tech."Technique"
          )
          FROM public."Oeuvres" o
          LEFT JOIN public."Technique" tech ON tech."TechniqueID" = o."Technique"
          WHERE o."OeuvreID"::text = n.source_pk
        )
        WHEN 'contact' THEN (
          SELECT concat_ws(
            '. ',
            concat_ws(' ', c."Prénom", c."Nom"),
            c."NomInstitution",
            c."Notes"
          )
          FROM public."Contact" c
          WHERE c."ContactID"::text = n.source_pk
        )
        WHEN 'theme' THEN (
          SELECT t.name FROM public.theme t WHERE t.id::text = n.source_pk
        )
        WHEN 'concept' THEN (
          SELECT concat_ws('. ', cp.titre, cp.description)
          FROM public.concept cp
          WHERE cp.id::text = n.source_pk
        )
        WHEN 'working_group' THEN (
          SELECT concat_ws('. ', wg.name, wg.note)
          FROM public.working_group wg
          WHERE wg.id::text = n.source_pk
        )
        WHEN 'exhibition' THEN (
          SELECT concat_ws(
            '. ',
            sp.nom,
            sp.localisation,
            concat_ws(' – ', sp.date_debut::text, sp.date_fin::text),
            sp.notes
          )
          FROM public.suivi_process sp
          WHERE sp.id::text = n.source_pk AND sp.type = 'exposition'
        )
        ELSE NULL
      END
    ),
    ''
  )
  FROM public.nodes n
  WHERE n.node_id = p_node_id;
$$;

GRANT EXECUTE ON FUNCTION public.node_search_text(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.node_search_text(uuid) TO service_role;

-- Mark nodes pending when source rows change.
CREATE OR REPLACE FUNCTION public.graph_mark_nodes_pending(p_type text, p_pk text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.nodes
  SET
    embedding_status = 'pending',
    embedding_dirty_at = now(),
    qdrant_point_id = coalesce(qdrant_point_id, node_id)
  WHERE node_type = p_type AND source_pk = p_pk;
END;
$$;

CREATE OR REPLACE FUNCTION public.graph_trg_oeuvre_embedding_dirty()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.graph_mark_nodes_pending('oeuvre', NEW."OeuvreID"::text);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS graph_oeuvre_embedding_dirty ON public."Oeuvres";
CREATE TRIGGER graph_oeuvre_embedding_dirty
  AFTER UPDATE OF "Titre", "Commentaires", "Technique" ON public."Oeuvres"
  FOR EACH ROW
  EXECUTE FUNCTION public.graph_trg_oeuvre_embedding_dirty();

CREATE OR REPLACE FUNCTION public.graph_trg_contact_embedding_dirty()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.graph_mark_nodes_pending('contact', NEW."ContactID"::text);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS graph_contact_embedding_dirty ON public."Contact";
CREATE TRIGGER graph_contact_embedding_dirty
  AFTER UPDATE OF "Nom", "Prénom", "Notes", "NomInstitution" ON public."Contact"
  FOR EACH ROW
  EXECUTE FUNCTION public.graph_trg_contact_embedding_dirty();

CREATE OR REPLACE FUNCTION public.graph_trg_theme_embedding_dirty()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.graph_mark_nodes_pending('theme', NEW.id::text);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS graph_embedding_dirty ON public.theme;
CREATE TRIGGER graph_embedding_dirty
  AFTER UPDATE OF name ON public.theme
  FOR EACH ROW
  EXECUTE FUNCTION public.graph_trg_theme_embedding_dirty();

CREATE OR REPLACE FUNCTION public.graph_trg_concept_embedding_dirty()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.graph_mark_nodes_pending('concept', NEW.id::text);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS graph_concept_embedding_dirty ON public.concept;
CREATE TRIGGER graph_concept_embedding_dirty
  AFTER UPDATE OF titre, description ON public.concept
  FOR EACH ROW
  EXECUTE FUNCTION public.graph_trg_concept_embedding_dirty();

CREATE OR REPLACE FUNCTION public.graph_trg_working_group_embedding_dirty()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.graph_mark_nodes_pending('working_group', NEW.id::text);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS graph_working_group_embedding_dirty ON public.working_group;
CREATE TRIGGER graph_working_group_embedding_dirty
  AFTER UPDATE OF name, note ON public.working_group
  FOR EACH ROW
  EXECUTE FUNCTION public.graph_trg_working_group_embedding_dirty();

CREATE OR REPLACE FUNCTION public.graph_trg_exhibition_embedding_dirty()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.type = 'exposition' THEN
    PERFORM public.graph_mark_nodes_pending('exhibition', NEW.id::text);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS graph_exhibition_embedding_dirty ON public.suivi_process;
CREATE TRIGGER graph_exhibition_embedding_dirty
  AFTER UPDATE OF nom, notes, localisation, date_debut, date_fin, type ON public.suivi_process
  FOR EACH ROW
  EXECUTE FUNCTION public.graph_trg_exhibition_embedding_dirty();

-- Team may read embedding_status for UI badges; writes are service-role / worker only.
GRANT SELECT (node_id, node_type, source_pk, embedding_status, embedded_at) ON public.nodes TO authenticated;
