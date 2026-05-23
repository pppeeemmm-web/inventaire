-- Slice 8 — query embedding cache (public search fallback) + pending queue.

CREATE TABLE IF NOT EXISTS public.query_embedding_cache (
  query_norm text PRIMARY KEY,
  vector jsonb NOT NULL,
  model text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.pending_query_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query_norm text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS pending_query_embeddings_created_idx
  ON public.pending_query_embeddings (created_at);

ALTER TABLE public.query_embedding_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_query_embeddings ENABLE ROW LEVEL SECURITY;

-- Service-role worker + server actions write; no anon access.
GRANT SELECT ON public.query_embedding_cache TO authenticated;
GRANT SELECT, INSERT ON public.pending_query_embeddings TO authenticated;

COMMENT ON TABLE public.query_embedding_cache IS
  'Normalized query → embedding vector for public-site semantic search (Slice 8).';
COMMENT ON TABLE public.pending_query_embeddings IS
  'Queries waiting for desktop worker to embed (mobile/public miss path).';
