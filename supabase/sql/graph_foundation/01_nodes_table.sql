-- Slice 5 — graph supertype: one row per embeddable / graph entity.
-- Apply manually in Supabase SQL editor (or migration runner) after backup.

CREATE TABLE IF NOT EXISTS public.nodes (
  node_id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  node_type  text NOT NULL,
  source_pk  text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nodes_node_type_check CHECK (
    node_type IN ('oeuvre', 'contact', 'theme', 'concept', 'working_group', 'exhibition')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS nodes_node_type_source_pk_uniq
  ON public.nodes (node_type, source_pk);

CREATE INDEX IF NOT EXISTS nodes_node_type_idx
  ON public.nodes (node_type);

COMMENT ON TABLE public.nodes IS
  'Graph supertype: stable node_id per source row. Writes via triggers / service role only.';

ALTER TABLE public.nodes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "nodes_team_select" ON public.nodes;
CREATE POLICY "nodes_team_select"
  ON public.nodes
  FOR SELECT
  TO authenticated
  USING (is_team());

-- No INSERT/UPDATE/DELETE for authenticated — triggers use SECURITY DEFINER functions.

GRANT SELECT (node_id, node_type, source_pk, created_at) ON public.nodes TO authenticated;
