# Slice 5 — Graph foundation handoff

**Status:** SQL applied on Supabase (owner 2026-05-23). Repo helpers in `lib/graph/node-ref.ts`. Run `npm run gen:types` after apply so `supabase.generated.ts` includes `nodes`, `entity`, and `tblrelations.source_uid` / `target_uid`.

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

**Not in repo yet (apply on DB first):** Slice 8 `07_embeddings.sql`. Slice 6: [`08_edge_fact_view.sql`](../supabase/sql/graph_foundation/08_edge_fact_view.sql) — see [`HANDOFF_SLICE6.md`](./HANDOFF_SLICE6.md).

---

## Operator checklist

1. Run GitHub **backup** workflow.
2. Apply SQL in order — see README table (`01` … `06`, **`04b`** between `04` and `05`, optional `05b` last).
3. Run `supabase/sql/grant_audit_queries.sql` queries; fix any missing grants.
4. `npm run gen:types` (updates `lib/types/supabase.generated.ts`).
5. Smoke: insert/delete a test `Contact` + `Oeuvre`; `select count(*) from nodes`; `select * from entity limit 5`.

**If 05 fails on `tblrelations_uid_pair_type_uniq`:** legacy constellation had duplicate edges per pair+type. Run `04b_dedupe_tblrelations_uids.sql`, then re-run `05` (dedupe is also at the top of `05` in current `main`).
6. Optional: re-run `03` is idempotent (`ON CONFLICT DO NOTHING`); run `05` backfill pass only if you add a one-shot sync script later.

---

## App (on `main`)

- `fetchConstellationGraphBundle` selects `source_uid` / `target_uid` and hydrates `entity` rows into `bundle.entities`.
- `insertConstellationRelation` sets `source_uid` / `target_uid` via `graph_node_id` RPC.
- Constellation canvas still draws **oeuvre–oeuvre** edges only; `bundle.entities` is ready for multi-type glyphs (Slice 6 / canvas tail).
- **No app dual-writes** to `nodes` or sync edges — triggers own the graph.

---

## Deferred

- `concept.themes[]` (text names) → `tblrelations` (needs name→`theme.id` resolution).
- `07_embeddings.sql` + embed worker (Slice 8).
