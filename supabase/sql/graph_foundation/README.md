# Graph foundation (Slice 5)

Apply **in numeric order** after a manual [`backup.yml`](../../../.github/workflows/backup.yml) run.

| File | Purpose |
|------|---------|
| `01_nodes_table.sql` | `public.nodes` supertype, RLS, grants |
| `02_register_triggers.sql` | Auto-register nodes on source tables |
| `03_backfill_nodes.sql` | One-time node backfill (`session_replication_role = replica`) |
| `04_tblrelations_node_fks.sql` | `source_uid` / `target_uid` FKs + backfill from legacy oeuvre ids |
| `05_relation_sync_triggers.sql` | Hard-column / junction → `tblrelations` sync (depth guard) |
| `06_entity_view.sql` | `public.entity` unified read model |
| `05b_backfill_synced_edges.sql` | Optional: backfill synced edges for existing junction/FK rows |

After apply: run [`grant_audit_queries.sql`](../grant_audit_queries.sql), then `npm run gen:types` from repo root (needs `SUPABASE_ACCESS_TOKEN` + `NEXT_PUBLIC_SUPABASE_URL` in `.env.local`).

**Exhibition nodes:** `exhibition` is a view; nodes register on `suivi_process` rows where `type = 'exposition'`.

**Deferred:** `concept.themes[]` name-array sync (no stable FK) — Slice 6 / pivot may add name→theme resolution.

**App:** No dual-writes; triggers own graph edges. Constellation still renders oeuvre–oeuvre edges via legacy `source_id`/`target_id`; uid-only synced edges appear after multi-type canvas (Slice 5 follow-up or Slice 6).
