# Slice 7 — Analog fallbacks handoff

**Status:** Code on `main` (local draft until commit/push). CSV export API + graph-aware portfolio PDF appendix.

---

## What shipped

| Piece | Role |
|-------|------|
| `app/api/export/csv/route.ts` | Admin-only CSV stream — `?view=entity` or `?view=edge_fact` |
| `lib/export/csv.ts` | RFC 4180 escaping + UTF-8 BOM |
| `lib/export/graph-csv-views.ts` | Column maps for `entity` / `edge_fact` views |
| `lib/portfolio-graph-appendix.ts` | Themes, working groups, concepts per portfolio work |
| `app/atelier/portfolio/pdf-action.ts` | Optional **Thèmes & regroupements** page before contact |

**Not in this slice:** weekly GitHub Action CSV backup (optional in plan), `docs/feature-*.md` guides.

**UI (admin):** Rapports → Pivot Atlas → **Entités** / **Arêtes** CSV links (`GraphCsvExportButtons`).

---

## CSV export (admin)

While logged in as admin, open or fetch:

```
GET /api/export/csv?view=entity
GET /api/export/csv?view=edge_fact
```

- **401** — not signed in  
- **403** — signed in but not admin  
- **400** — missing/invalid `view`  
- Response: `text/csv; charset=utf-8` with BOM, attachment filename `pem_<view>_YYYY-MM-DD.csv`

Paginates 500 rows per Supabase request until exhausted.

---

## Portfolio PDF

When exported works have graph edges (`theme`, `workgroup`, or `concept` targets), the PDF adds a **Contexte / Context** page listing per-work themes, working groups, and concepts from `edge_fact`. Skipped when no graph data.

---

## Verification

1. Admin session → download both CSV views; open in Excel / LibreOffice (UTF-8, commas in labels escaped).
2. Generate portfolio PDF for works with themes → **Thèmes & regroupements** page present.
3. `npm run typecheck` + `npm run lint`.

---

## Docs hygiene

- `AGENTS.md` — Prisma line → Supabase.
- Stale plans remain under [`archive/`](./archive/) only.
