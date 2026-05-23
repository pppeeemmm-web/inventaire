# Slice 6 — Pivot Atlas handoff

> **ARCHIVED — slice complete (2026-05-23).** Active checklist: [`../TODO.md`](../TODO.md). Plan: [`../PEM_HYBRID_REFACTOR_PLAN_V5.md`](../PEM_HYBRID_REFACTOR_PLAN_V5.md).

**Status:** Code on `main`; apply **`08_edge_fact_view.sql`** on Supabase, then `npm run gen:types`.

---

## Apply

1. Backup workflow.
2. Run [`supabase/sql/graph_foundation/08_edge_fact_view.sql`](../../supabase/sql/graph_foundation/08_edge_fact_view.sql) (after Slice 5 `01`–`06`). If the view already exists, run [`08b_view_security_invoker.sql`](../../supabase/sql/graph_foundation/08b_view_security_invoker.sql) instead to clear advisor **0010**.
3. `npm run gen:types` — removes `edge_fact` cast shim in `edge-fact-actions.ts`.
4. `/atelier/reports` → **Pivot Atlas (graph)**.

---

## What shipped

| Piece | Role |
|-------|------|
| `public.edge_fact` view | Flat edge rows: relation + source/target entity labels |
| `lib/graph/edge-fact.ts` | `buildContactThemePivotRows`, pivot dims, `pivotEdgeFacts` |
| `fetchEdgeFactRows` | Server load (team-gated) |
| `PivotAtlasPanel` | Presets: **Contacts × Themes**, **Raw edges** |
| Reports tab | Toggle from works table → atlas |

**Contacts × Themes:** joins oeuvre→theme with oeuvre→contact (`owner` / `buyer` / `located_at`) on the same `source_node_id` — matches manual “works linked to both” counts.

---

## Verification

- `npm run typecheck`, `npm run lint`, `npm run i18n:check`
- Pivot Atlas loads; preset **Contacts × Themes** shows non-empty grid when theme + owner edges exist
- Existing inventory/sales pivots unchanged (`buildPivot` on œuvres / expenses)
