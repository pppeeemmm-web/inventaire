-- N1 (2026-11-01): semantic search vectors move from Qdrant Cloud into Postgres (pgvector).
--
-- Why: the free Qdrant cluster was deleted for inactivity; every point is gone and search has been
-- down. A free tier is reaped again the next quiet month. ~1300 nodes × 768 dims is tiny, so the
-- vector now lives on its own `nodes` row — deleting a node deletes its vector, no sync queue.
--
-- What stays: `node_search_text()`, the dirty triggers, `embedding_status` / `embedding_text_hash`,
-- `query_embedding_cache` + `pending_query_embeddings` (Vercel still has no Ollama).
-- What goes: the Qdrant tombstone trigger (the delete queue only existed to sync Qdrant).
-- Kept for now, unused: `nodes.qdrant_point_id`, table `node_embedding_tombstone` — drop later.
--
-- RLS: `embedding` is a column on `nodes`, covered by the existing `nodes_team_select` policy.
-- `match_nodes` is service-role only; the search action checks the team before calling it.
-- After applying: npm run gen:types, then `npm run embed:worker -- --watch` to re-embed.

create extension if not exists vector with schema extensions;

alter table public.nodes
  add column if not exists embedding extensions.vector(768);

comment on column public.nodes.embedding is
  'nomic-embed-text vector of node_search_text(node_id). Written by scripts/embed-worker; null until embedded.';

create index if not exists nodes_embedding_hnsw_idx
  on public.nodes using hnsw (embedding extensions.vector_cosine_ops);

-- Nearest nodes by cosine similarity (score 1 = identical), same shape the Qdrant search returned.
create or replace function public.match_nodes(query_embedding extensions.vector(768), match_count int default 12)
returns table (node_id uuid, node_type text, score double precision)
language sql
stable
set search_path = public, extensions
as $$
  select n.node_id, n.node_type, 1 - (n.embedding <=> query_embedding) as score
  from public.nodes n
  where n.embedding is not null
  order by n.embedding <=> query_embedding
  limit least(greatest(match_count, 1), 50);
$$;

revoke all on function public.match_nodes(extensions.vector, int) from public, anon, authenticated;
grant execute on function public.match_nodes(extensions.vector, int) to service_role;

-- The tombstone queue only fed Qdrant deletes.
drop trigger if exists graph_enqueue_embedding_tombstone on public.nodes;
drop function if exists public.graph_enqueue_embedding_tombstone();

-- Every vector was lost with the cluster: re-embed everything that had one.
update public.nodes
set embedding_status = 'pending', embedding_dirty_at = now()
where embedding_status = 'ok';
