-- Slice 8 — client-deny RLS on embedding worker / service-role-only tables.
-- Apply after 07_embeddings.sql and 09_query_embedding_cache.sql.
--
-- Access model: app search actions + embed-worker use service_role (bypasses RLS).
-- authenticated gets GRANT (grant audit A) + deny policies (grant audit B, zero rows).
-- Do not REVOKE authenticated SELECT after this step — audit A will flag these tables.

-- ── node_embedding_tombstone (07) ──

DROP POLICY IF EXISTS "node_embedding_tombstone_no_client" ON public.node_embedding_tombstone;
CREATE POLICY "node_embedding_tombstone_no_client"
  ON public.node_embedding_tombstone
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

REVOKE ALL ON public.node_embedding_tombstone FROM anon;
GRANT SELECT ON public.node_embedding_tombstone TO authenticated;

-- ── query_embedding_cache (09) ──

DROP POLICY IF EXISTS "query_embedding_cache_no_client" ON public.query_embedding_cache;
CREATE POLICY "query_embedding_cache_no_client"
  ON public.query_embedding_cache
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

REVOKE ALL ON public.query_embedding_cache FROM anon;
GRANT SELECT ON public.query_embedding_cache TO authenticated;

-- ── pending_query_embeddings (09) ──

DROP POLICY IF EXISTS "pending_query_embeddings_no_client" ON public.pending_query_embeddings;
CREATE POLICY "pending_query_embeddings_no_client"
  ON public.pending_query_embeddings
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

REVOKE ALL ON public.pending_query_embeddings FROM anon;
GRANT SELECT, INSERT ON public.pending_query_embeddings TO authenticated;
