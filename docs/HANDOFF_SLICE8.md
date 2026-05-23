# Slice 8 — Embeddings handoff

**Status:** Code on `main`; apply SQL on Supabase before worker / semantic search.

---

## Apply (order)

After Slice 5 `01`–`06` and Slice 6 `08`:

1. [`07_embeddings.sql`](../supabase/sql/graph_foundation/07_embeddings.sql)
2. [`09_query_embedding_cache.sql`](../supabase/sql/graph_foundation/09_query_embedding_cache.sql)
3. `npm run gen:types`
4. Local: Ollama + Qdrant env (see [`scripts/embed-worker/README.md`](../scripts/embed-worker/README.md))
5. `npm run embed:worker -- --once --limit=5`

---

## What shipped

| Piece | Role |
|-------|------|
| `07_embeddings.sql` | Columns on `nodes`, `node_search_text()`, tombstones, dirty triggers |
| `09_query_embedding_cache.sql` | Public query cache + pending queue |
| `scripts/embed-worker/` | `--once`, `--watch`, `--audit`, `--reembed-all` |
| `app/atelier/search/actions.ts` | `searchSemanticAtelier` (Ollama + Qdrant on server host) |
| Command palette | Semantic group when query ≥ 3 chars |

**Not in this slice:** public-site search UI (tables only), embedding pending badges on lists, ESLint service-role rule.

---

## Env (`.env.local`, never commit)

```env
QDRANT_URL=https://….cloud.qdrant.io
QDRANT_API_KEY=…
OLLAMA_ORIGIN=http://127.0.0.1:11435
# optional alias: OLLAMA_URL=http://127.0.0.1:11435
```

Semantic search in the **deployed** app only works if the Next server can reach Ollama + Qdrant (typically **local `npm run dev`** on the studio machine). Production Vercel → set `unavailable` gracefully.

---

## Verification

- `select node_search_text(node_id) from nodes limit 5;`
- Worker: 5 rows → `embedding_status = ok`, Qdrant shows 5 points
- Command palette: query ≥ 3 chars → semantic group (when env configured)
