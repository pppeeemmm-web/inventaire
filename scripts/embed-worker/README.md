# Embed worker (Slice 8)

Desktop bridge: Supabase `public.nodes` ↔ local Ollama ↔ Qdrant Cloud.

## Prerequisites

1. Slice 5 + **07_embeddings.sql** + **09_query_embedding_cache.sql** applied on Supabase.
2. `ollama pull nomic-embed-text` and `ollama serve` (default `http://127.0.0.1:11434`).
3. Qdrant Cloud cluster + `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
QDRANT_URL=https://xxxx.cloud.qdrant.io
QDRANT_API_KEY=...
# optional:
OLLAMA_ORIGIN=http://127.0.0.1:11435
EMBEDDING_COLLECTION=pem_universe
```

## Commands

From repo root:

```bash
npm run embed:worker -- --once --limit=5
npm run embed:worker -- --watch
npm run embed:worker -- --audit
npm run embed:worker -- --reembed-all
```

## Behaviour

- Polls `embedding_status IN ('pending','error')` in batches of 32.
- Text from `node_search_text(node_id)`; empty → `skipped`.
- Point id = `node_id` (UUID).
- Tombstones drained before each pass; orphans removed with `--audit`.
