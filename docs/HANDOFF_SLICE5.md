# Slice 5 — Graph foundation handoff

**Status:** SQL + `lib/graph/node-ref.ts` **committed locally** until applied on Supabase and `npm run gen:types` is run in CI/dev.

**Cold-start:** [`supabase/sql/graph_foundation/README.md`](../supabase/sql/graph_foundation/README.md) → apply `01`…`06` in order after backup.

---

## What landed in repo

| Artifact | Role |
|----------|------|
| `supabase/sql/graph_foundation/01_nodes_table.sql` | `public.nodes` + RLS + team SELECT |
| `02_register_triggers.sql` | Register nodes on `Oeuvres`, `Contact`, `theme`, `concept`, `working_group`, `suivi_process` (exposition) |
| `03_backfill_nodes.sql` | One-time backfill |
| `04_tblrelations_node_fks.sql` | `source_uid` / `target_uid` + oeuvre backfill |
| `05_relation_sync_triggers.sql` | `oeuvre_theme`, `working_group_work`, `Oeuvres` contact FKs → edges |
| `06_entity_view.sql` | `public.entity` view |
| `lib/graph/node-ref.ts` | `nodeRef`, `GraphNodeType`, `EntityRow`, `GraphRelationRow` |

**Not in repo yet (apply on DB first):** Slice 8 `07_embeddings.sql`, pivot `08_edge_fact_view.sql`.

---

## Operator checklist

1. Run GitHub **backup** workflow.
2. Apply SQL `01` → `06` in Supabase SQL editor (or migration runner).
3. Run `supabase/sql/grant_audit_queries.sql` queries; fix any missing grants.
4. `npm run gen:types` (updates `lib/types/supabase.generated.ts`).
5. Smoke: insert/delete a test `Contact` + `Oeuvre`; `select count(*) from nodes`; `select * from entity limit 5`.
6. Optional: re-run `03` is idempotent (`ON CONFLICT DO NOTHING`); run `05` backfill pass only if you add a one-shot sync script later.

---

## App follow-ups (post–gen:types)

- Extend `fetchConstellationGraphBundle` to `select` `source_uid`, `target_uid`; hydrate via `entity` for multi-type glyphs ([`CONSTELLATION.md`](./CONSTELLATION.md)).
- Constellation canvas still uses oeuvre integer positions for **manual** edges (`source_id` + `target_id`); uid-only synced edges (`theme`, `buyer`, …) need multi-type layout (Slice 5 UI tail or Slice 6).
- **No app dual-writes** to `nodes` or sync edges — triggers own the graph.

---

## Deferred

- `concept.themes[]` (text names) → `tblrelations` (needs name→`theme.id` resolution).
- `08_edge_fact_view.sql` (Slice 6 pivot).
- `07_embeddings.sql` + embed worker (Slice 8).
