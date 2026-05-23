-- Slice 5 — tblrelations → nodes FKs (legacy source_id/target_id shim retained).

ALTER TABLE public.tblrelations
  ADD COLUMN IF NOT EXISTS source_uid uuid REFERENCES public.nodes (node_id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS target_uid uuid REFERENCES public.nodes (node_id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS tblrelations_source_uid_idx ON public.tblrelations (source_uid);
CREATE INDEX IF NOT EXISTS tblrelations_target_uid_idx ON public.tblrelations (target_uid);

-- Backfill oeuvre–oeuvre constellation edges (legacy integer FKs).
UPDATE public.tblrelations r
SET source_uid = n.node_id
FROM public.nodes n
WHERE r.source_uid IS NULL
  AND r.source_id IS NOT NULL
  AND n.node_type = 'oeuvre'
  AND n.source_pk = r.source_id::text;

UPDATE public.tblrelations r
SET target_uid = n.node_id
FROM public.nodes n
WHERE r.target_uid IS NULL
  AND r.target_id IS NOT NULL
  AND n.node_type = 'oeuvre'
  AND n.source_pk = r.target_id::text;

COMMENT ON COLUMN public.tblrelations.source_uid IS
  'Graph source node (Slice 5). Cross-type edges may leave source_id NULL.';
COMMENT ON COLUMN public.tblrelations.target_uid IS
  'Graph target node (Slice 5). Cross-type edges may leave target_id NULL.';
