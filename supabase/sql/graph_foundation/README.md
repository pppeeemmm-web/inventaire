# Graph foundation (Slice 5)

Apply **in this order** after a manual [`backup.yml`](../../../.github/workflows/backup.yml) run.

| Step | File | Purpose |
|------|------|---------|
| 1 | `01_nodes_table.sql` | `public.nodes` supertype, RLS, grants |
| 2 | `02_register_triggers.sql` | Auto-register nodes on source tables |
| 3 | `03_backfill_nodes.sql` | One-time node backfill (`session_replication_role = replica`) |
| 4 | `04_tblrelations_node_fks.sql` | `source_uid` / `target_uid` FKs + backfill from legacy oeuvre ids |
| 5 | `04b_dedupe_tblrelations_uids.sql` | Remove duplicate `(source_uid, target_uid, relation_type)` before unique index |
| 6 | `05_relation_sync_triggers.sql` | Same dedupe at top + unique index + junction/FK sync triggers |
| 7 | `06_entity_view.sql` | `public.entity` unified read model (`security_invoker`) |
| 8 | `05b_backfill_synced_edges.sql` | Optional: backfill synced edges for existing junction/FK rows |
| 9 | `08_edge_fact_view.sql` | **Slice 6** — `public.edge_fact` pivot/export view (`security_invoker`) |
| 9b | `08b_view_security_invoker.sql` | **If 06/08 already live** — flip `entity` + `edge_fact` to invoker (advisor 0010) |
| 10 | `07_embeddings.sql` | **Slice 8** — embedding columns, `node_search_text`, tombstones |
| 11 | `09_query_embedding_cache.sql` | **Slice 8** — query embedding cache tables |
| 12 | `10_embedding_rls_policies.sql` | **Slice 8** — deny-client RLS + grants (clears `grant_audit_queries.sql`) |

**Note:** Step 5 and 6 both dedupe — run **04b** then **05**, or only **05** if you use a current `05` from `main`. If **05** already failed on `tblrelations_uid_pair_type_uniq`, run **04b** and re-run **05** from the `CREATE UNIQUE INDEX` line.

After apply: [`grant_audit_queries.sql`](../grant_audit_queries.sql) (expect **0 rows**), then `npm run gen:types`.

**Exhibition nodes:** `exhibition` is a view; nodes register on `suivi_process` where `type = 'exposition'`.

**Deferred:** `concept.themes[]` (text names, no FK).

**App:** No dual-writes. Constellation still uses oeuvre `source_id`/`target_id` for manual edges until multi-type canvas.
