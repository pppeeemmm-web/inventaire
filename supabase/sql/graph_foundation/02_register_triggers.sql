-- Slice 5 — register / unregister nodes when source rows change.

CREATE OR REPLACE FUNCTION public.graph_register_node(p_type text, p_pk text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_type IS NULL OR p_pk IS NULL OR btrim(p_pk) = '' THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.nodes (node_type, source_pk)
  VALUES (p_type, p_pk)
  ON CONFLICT (node_type, source_pk) DO NOTHING;

  SELECT node_id INTO v_id
  FROM public.nodes
  WHERE node_type = p_type AND source_pk = p_pk;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.graph_unregister_node(p_type text, p_pk text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_type IS NULL OR p_pk IS NULL THEN
    RETURN;
  END IF;
  DELETE FROM public.nodes
  WHERE node_type = p_type AND source_pk = p_pk;
END;
$$;

CREATE OR REPLACE FUNCTION public.graph_node_id(p_type text, p_pk text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT node_id
  FROM public.nodes
  WHERE node_type = p_type AND source_pk = p_pk
  LIMIT 1;
$$;

-- ── Oeuvres ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.graph_trg_register_oeuvre_node()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.graph_register_node('oeuvre', NEW."OeuvreID"::text);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.graph_trg_unregister_oeuvre_node()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.graph_unregister_node('oeuvre', OLD."OeuvreID"::text);
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS graph_register_oeuvre_node ON public."Oeuvres";
CREATE TRIGGER graph_register_oeuvre_node
  AFTER INSERT ON public."Oeuvres"
  FOR EACH ROW
  EXECUTE FUNCTION public.graph_trg_register_oeuvre_node();

DROP TRIGGER IF EXISTS graph_unregister_oeuvre_node ON public."Oeuvres";
CREATE TRIGGER graph_unregister_oeuvre_node
  AFTER DELETE ON public."Oeuvres"
  FOR EACH ROW
  EXECUTE FUNCTION public.graph_trg_unregister_oeuvre_node();

-- ── Contact ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.graph_trg_register_contact_node()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.graph_register_node('contact', NEW."ContactID"::text);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.graph_trg_unregister_contact_node()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.graph_unregister_node('contact', OLD."ContactID"::text);
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS graph_register_contact_node ON public."Contact";
CREATE TRIGGER graph_register_contact_node
  AFTER INSERT ON public."Contact"
  FOR EACH ROW
  EXECUTE FUNCTION public.graph_trg_register_contact_node();

DROP TRIGGER IF EXISTS graph_unregister_contact_node ON public."Contact";
CREATE TRIGGER graph_unregister_contact_node
  AFTER DELETE ON public."Contact"
  FOR EACH ROW
  EXECUTE FUNCTION public.graph_trg_unregister_contact_node();

-- ── theme ────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.graph_trg_register_theme_node()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.graph_register_node('theme', NEW.id::text);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.graph_trg_unregister_theme_node()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.graph_unregister_node('theme', OLD.id::text);
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS graph_register_theme_node ON public.theme;
CREATE TRIGGER graph_register_theme_node
  AFTER INSERT ON public.theme
  FOR EACH ROW
  EXECUTE FUNCTION public.graph_trg_register_theme_node();

DROP TRIGGER IF EXISTS graph_unregister_theme_node ON public.theme;
CREATE TRIGGER graph_unregister_theme_node
  AFTER DELETE ON public.theme
  FOR EACH ROW
  EXECUTE FUNCTION public.graph_trg_unregister_theme_node();

-- ── concept ──────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.graph_trg_register_concept_node()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.graph_register_node('concept', NEW.id::text);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.graph_trg_unregister_concept_node()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.graph_unregister_node('concept', OLD.id::text);
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS graph_register_concept_node ON public.concept;
CREATE TRIGGER graph_register_concept_node
  AFTER INSERT ON public.concept
  FOR EACH ROW
  EXECUTE FUNCTION public.graph_trg_register_concept_node();

DROP TRIGGER IF EXISTS graph_unregister_concept_node ON public.concept;
CREATE TRIGGER graph_unregister_concept_node
  AFTER DELETE ON public.concept
  FOR EACH ROW
  EXECUTE FUNCTION public.graph_trg_unregister_concept_node();

-- ── working_group ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.graph_trg_register_working_group_node()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.graph_register_node('working_group', NEW.id::text);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.graph_trg_unregister_working_group_node()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.graph_unregister_node('working_group', OLD.id::text);
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS graph_register_working_group_node ON public.working_group;
CREATE TRIGGER graph_register_working_group_node
  AFTER INSERT ON public.working_group
  FOR EACH ROW
  EXECUTE FUNCTION public.graph_trg_register_working_group_node();

DROP TRIGGER IF EXISTS graph_unregister_working_group_node ON public.working_group;
CREATE TRIGGER graph_unregister_working_group_node
  AFTER DELETE ON public.working_group
  FOR EACH ROW
  EXECUTE FUNCTION public.graph_trg_unregister_working_group_node();

-- ── exhibition (suivi_process type = exposition; view public.exhibition) ─────

CREATE OR REPLACE FUNCTION public.graph_trg_sync_exhibition_node()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.type = 'exposition' THEN
      PERFORM public.graph_register_node('exhibition', NEW.id::text);
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.type = 'exposition' AND NEW.type IS DISTINCT FROM 'exposition' THEN
      PERFORM public.graph_unregister_node('exhibition', OLD.id::text);
    END IF;
    IF NEW.type = 'exposition' THEN
      PERFORM public.graph_register_node('exhibition', NEW.id::text);
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.type = 'exposition' THEN
      PERFORM public.graph_unregister_node('exhibition', OLD.id::text);
    END IF;
    RETURN OLD;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS graph_sync_exhibition_node ON public.suivi_process;
CREATE TRIGGER graph_sync_exhibition_node
  AFTER INSERT OR UPDATE OR DELETE ON public.suivi_process
  FOR EACH ROW
  EXECUTE FUNCTION public.graph_trg_sync_exhibition_node();

GRANT EXECUTE ON FUNCTION public.graph_node_id(text, text) TO authenticated;
