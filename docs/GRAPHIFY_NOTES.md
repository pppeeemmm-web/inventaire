# Graphify audit notes

Companion to [`graphify-out/GRAPH_REPORT.md`](../graphify-out/GRAPH_REPORT.md). Resolves ambiguous edges and ops follow-ups from the 2026-05-24 graph run.

## Ambiguous edges (resolved)

| Edge | Verdict |
|------|---------|
| `Oeuvres` → `previewBusinessCardCapture` | **False positive.** Card capture reads/writes `Contact` only ([`app/atelier/capture/card-actions.ts`](../app/atelier/capture/card-actions.ts)); no oeuvre row access. |
| `fetchSystemLogs` → `fetchContactConflicts (profiles.role)` | **Stale label.** Live guard is `is_admin()` RPC in [`conflicts-actions.ts`](../app/atelier/(portal)/contacts/conflicts-actions.ts); `profiles.role` is dead per `CLAUDE.md`. Re-run `/graphify --update` to refresh. |

## Ops

- **Embed backfill:** `npm run embed:worker -- --watch` (desktop; Ollama + Qdrant). See [`archive/HANDOFF_SLICE8.md`](./archive/HANDOFF_SLICE8.md).
- **Graph CSV backup (Slice 7 Phase 2):** [`.github/workflows/graph-csv-backup.yml`](../.github/workflows/graph-csv-backup.yml) + [`scripts/backup-graph-csv.sh`](../scripts/backup-graph-csv.sh). Verify locally: `pwsh scripts/verify-graph-csv-backup.ps1`.
- **GRANT audit (O1, deadline 2026-10-30):** `pwsh scripts/run-grant-audit.ps1` (requires `SUPABASE_DB_URL`).

## God nodes (expected hubs)

`useI18n()`, `createClient()`, `Oeuvre` — cross-cutting; low community cohesion in `app/atelier/**/actions` is the maintainability target (see [`TODO.md`](./TODO.md) Block C).
