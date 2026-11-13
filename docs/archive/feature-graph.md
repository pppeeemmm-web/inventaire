# Graph layer (nodes, edges, export)

**Truth:** live SQL under `supabase/sql/graph_foundation/` and handoffs below.

| Topic | Doc / path |
|-------|------------|
| Schema + triggers | [`archive/HANDOFF_SLICE5.md`](./archive/HANDOFF_SLICE5.md) — `nodes`, `entity` view |
| Pivot + `edge_fact` | [`archive/HANDOFF_SLICE6.md`](./archive/HANDOFF_SLICE6.md) — `08_edge_fact_view.sql` |
| Admin CSV + PDF appendix | [`archive/HANDOFF_SLICE7.md`](./archive/HANDOFF_SLICE7.md) — `/api/export/csv`, portfolio PDF |
| Embeddings | [`archive/HANDOFF_SLICE8.md`](./archive/HANDOFF_SLICE8.md) |
| Weekly off-site CSV | [`BACKUP_RECOVERY.md`](./BACKUP_RECOVERY.md) — R2 `weekly/pem_*.csv` |

**In-app:** Constellation (`docs/CONSTELLATION.md`), Rapports → Pivot Atlas, admin CSV links on Pivot Atlas.

**Do not** run SQL from `docs/archive/` — superseded plans only.
