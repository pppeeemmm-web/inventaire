-- N1 cleanup (owner OK 2026-11-02): semantic search runs on pgvector (`semantic_search_pgvector.sql`);
-- Qdrant Cloud is retired. Drop what only existed to sync Qdrant.
--   - `nodes.qdrant_point_id` (1207 stale ids) and the 9-row `node_embedding_tombstone` delete queue.
--   - `graph_mark_nodes_pending` no longer seeds `qdrant_point_id`.
-- The daily pg_dump backup keeps the dropped data.

create or replace function public.graph_mark_nodes_pending(p_type text, p_pk text)
  returns void
  language plpgsql
  security definer
  set search_path to 'public'
as $function$
begin
  update public.nodes
  set
    embedding_status = 'pending',
    embedding_dirty_at = now()
  where node_type = p_type and source_pk = p_pk;
end;
$function$;

drop table if exists public.node_embedding_tombstone;
alter table public.nodes drop column if exists qdrant_point_id;
