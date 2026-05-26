# Slice 7 — Analog fallbacks handoff

> **ARCHIVED — slice complete (2026-05-25).** Active checklist: [`../TODO.md`](../TODO.md). Plan: [`PEM_HYBRID_REFACTOR_PLAN_V5.md`](./PEM_HYBRID_REFACTOR_PLAN_V5.md).

**Status:** Phase 1 on `main`. Phase 2 (weekly R2 CSV) — code in repo; run workflow once to verify.

---

## What shipped

| Piece | Role |
|-------|------|
| `app/api/export/csv/route.ts` | Admin-only CSV stream — `?view=entity` or `?view=edge_fact` |
| `lib/export/csv.ts` | RFC 4180 escaping + UTF-8 BOM |
| `lib/export/graph-csv-views.ts` | Column maps for `entity` / `edge_fact` views |
| `lib/portfolio-graph-appendix.ts` | Themes, working groups, concepts per portfolio work |
| `app/atelier/portfolio/pdf-action.ts` | Optional **Thèmes & regroupements** page before contact |

**Phase 2 (weekly off-site CSV):**

| Piece | Role |
|-------|------|
| `scripts/backup-graph-csv.sh` | `COPY` from `entity` / `edge_fact` (same columns as API), UTF-8 BOM, upload to R2 |
| `.github/workflows/graph-csv-backup.yml` | Sundays 04:30 UTC + `workflow_dispatch` |
| `docs/feature-graph.md` | Index for graph / export / backup docs |

Uses the **same GitHub secrets** as [`backup.yml`](../../.github/workflows/backup.yml). Objects: `weekly/pem_entity_YYYY-MM-DD.csv`, `weekly/pem_edge_fact_YYYY-MM-DD.csv`.

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

**Phase 1**

1. Admin session → download both CSV views; open in Excel / LibreOffice (UTF-8, commas in labels escaped).
2. Generate portfolio PDF for works with themes → **Thèmes & regroupements** page present.
3. `npm run typecheck` + `npm run lint`.

**Phase 2**

1. Actions → **Weekly graph CSV backup** → Run workflow → green.
2. R2 `art-db-backups/weekly/` → two `pem_*.csv` for today; open in Excel (BOM + headers).
3. Row counts roughly match admin CSV downloads (same views).

---

## Docs hygiene

- `AGENTS.md` — Prisma line → Supabase.
- Stale plans remain under [`archive/`](./README.md) only.
