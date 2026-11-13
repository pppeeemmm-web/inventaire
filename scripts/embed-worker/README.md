# Embed worker (Slice 8)

Desktop bridge: Supabase `public.nodes` ↔ local Ollama. Vectors are stored on the node row
(`nodes.embedding`, pgvector) and searched with `match_nodes()` — no external vector store
(Qdrant Cloud was retired 2026-11-01 after its free cluster was deleted for inactivity).

## Prerequisites

1. Slice 5 + **07_embeddings.sql** + **09_query_embedding_cache.sql** + **semantic_search_pgvector.sql** applied on Supabase.
2. `ollama pull nomic-embed-text` — **`ollama serve` is optional**: the worker auto-starts Ollama on `OLLAMA_ORIGIN` (default `127.0.0.1:11435`) when offline. Set `EMBED_WORKER_NO_OLLAMA_AUTOSTART=1` to disable.
3. `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
# optional:
OLLAMA_ORIGIN=http://127.0.0.1:11435
```

## Commands

From repo root:

```bash
npm run embed:worker -- --once --limit=5
npm run embed:worker -- --drain
npm run embed:worker -- --watch
npm run embed:worker -- --audit
npm run embed:worker -- --reembed-all
```

`--once` = one batch (32). `--drain` = batches until one embeds nothing, then exit.

## Overview button

Atelier Overview (admin) has a **Local jobs** card (formerly Search indexing): voice notes to transcribe + indexing backlog, **Run on this PC**,
a `pem-embed:run` link. It works only on a PC where the protocol is registered (once, per user, HKCU):

```powershell
pwsh scripts/register-embed-protocol.ps1          # -Unregister to remove
```

The protocol opens `scripts/embed-run.ps1`: voice transcription (`scripts/transcribe/voice_batch.py --run --write`) then `--drain`, one after the other; window closes 10s after success.
The URL is not passed to the script. The card re-polls the count every 5s for up to 5 min.

## Behaviour

- Polls `embedding_status IN ('pending','error')` in batches of 32.
- Drains `pending_query_embeddings` → `query_embedding_cache` (production semantic search).
- Text from `node_search_text(node_id)`; empty → `skipped`.
- Vector written to `nodes.embedding` with the `ok` status in one update; deleting a node deletes its vector.
- `--audit` counts nodes that still have no usable vector.
