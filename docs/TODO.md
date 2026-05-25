# PEM Hub — TODO

_Version-controlled checklist + non-binding roadmap items. Prefer this file over a Desktop mirror._

**Last refresh: 2026-05-25** — Constellation UI split (shared + toolbar + tool rail + side panel). Ops: O1 GRANT audit + R2 lifecycle on `paintings` verified by owner. **`/works` gallery deferred** (do not commit `WorksClient.tsx` WIP until that track reopens).

---

## Next up (recommended order)

| # | Track | Item | Notes |
|---|--------|------|--------|
| 1 | **Dev** | Block C — **C2** Pipeline decomposition + `AbortController` | After A.3 toolbar work |
| 2 | **Dev** | Block A — **A0** Supabase cast cleanup | ~40 files; run `gen:types` after each migration |
| 3 | **Dev** | Constellation — canvas redraw / export / handlers split | Toolbar, rail, side panel done 2026-05-25 |
| 4 | **Deferred** | **`/works` gallery + F1** | WIP paused; see Desktop section below |

---

## Operations — time-sensitive

- [x] **O1** Pre-Oct-30 2026 Supabase GRANT audit — run 2026-05-25 (`run-grant-audit.ps1` / `grant_audit_queries.sql`).
- [ ] **O2** R2 access key rotation; document rotation date in `CLAUDE.md` Phase D.
- [ ] **O3** Broadcast Bearer token rotation runbook → `SYSTEM_LEDGER.md`.
- [ ] **O4** Quarterly DB backup recovery drill (per `BACKUP_RECOVERY.md`).
- [ ] **Vercel** `NEXT_PUBLIC_SITE_URL` / `NEXT_PUBLIC_APP_URL` on production (metadataBase / OG / sitemap).

## Manual Supabase / Cloudflare

- [ ] Verify views such as `OeuvresComplete` after `dead_columns_drop.sql`.
- [ ] Run `grant_audit_queries.sql` after schema changes.
- [x] `studio_task.sql` + `contact_signature_r2_key.sql` applied; `npm run gen:types` — 2026-05-15.
- [ ] Re-run **`npm run gen:types`** after each new `public` table migration.
- [ ] GH secret `SUPABASE_DB_URL` for `audit-prune.yml`; sanity-check `audit_log_prune()` before enabling workflow.
- [ ] Staging AVIF upload smoke (R2 objects + thumbs).
- [x] Cloudflare lifecycle: `recycle/` 90d, `ledger/` 30d on `paintings` — configured 2026-05-25 (and `vault` if used).

## Phase 0 remainders

- [x] **0.4** Dictionary modularization (`lib/i18n/dictionary/`).
- [ ] ESLint allow-list ratchet — legacy Atelier tabs; remove overrides as cleaned.

## Block A — agility

- [ ] **A0** Remove remaining `as any` Supabase casts (partial 2026-05-15).
- [x] **A1** Exhibitions + curation + constellation server actions.
- [x] **A2** `/works` RSC + `revalidateTag('portfolio')` (config path; gallery UX separate).
- [x] **A3** R2 etag optimistic concurrency on `savePortfolioConfig` (`ifMatch` + `PORTFOLIO_SAVE_ERR` in PortfolioTab).
- [x] **A4** Sanitize portfolio HTML server-side.
- [x] **A5** Logged errors (home, calendar, selection PDF, `r2SoftDelete`).

## Block C — decomposition

- [ ] **C1** `PortfolioTab.tsx` → panels + orchestrator.
- [ ] **C2** `app/atelier/pipeline/_components/Pipeline.tsx` → Gantt / deadline / reminders panels; `AbortController` on fetches.
- [ ] **C3** `Exhibitions.tsx` → steps + floor-plan panels.
- [x] **C4** `docs/CONSTELLATION.md`.
- [x] **C-partial** Constellation — `constellation-shared`, toolbar, tool rail, side panel (2026-05-25); canvas redraw/export/handlers remain.
- [x] **C-partial** `pipeline-shared.ts`, list panel extractions.
- [ ] WorkDrawer further decomposition (`DrawerContent`).

## Desktop — public site (`/works` deferred)

- [ ] **`/works` gallery** — cm-scaled wall scroll in `WorksClient.tsx` *(WIP on hold; not in push set)*.
- [ ] **F1** Sunset `works_collections` / `sections` fallback; `works_modes` only; drop PDF diagnostic log.

## Mobile field-tool — Phases 1–8

### Phase 1 — Ring A

- [x] A.1 slim top bar / drawer chrome.
- [x] A.2 subset chip.
- [x] A.3 per-tab narrow polish (Production, Pipeline, Hub, landing) — 2026-05-15.

### Phase 2 — Ring B

- [x] B.1 field launcher `FIELD_ROWS`.
- [x] B.2 `MobileActionBar` + hide when drawer open.
- [x] B.4 PWA manifest + share target.

### Phases 3–7 — Verbs 1–8

- [x] Shipped in repo (session, voice, capture, triage, pipeline swipe, card, documents, sign, issue). Operator: ensure SQL live in Supabase + `gen:types` when migrations change.

### Phase 8 — a11y + observability

- [x] Body ≥16px narrow; focus rings; `prefers-reduced-motion`; field `system_log`.
- [x] **Icon `aria-label` sweep** — Vault, Exhibitions, Constellation, ExportModal + earlier tabs (2026-05; see `ea76b4f`). Re-open only when new icon-only controls ship without labels.

## Roadmap (no GO without decision)

- [ ] **F2**–**F10** — preview token, quick-add, saved searches, share kit, flags, digest, outbox, OCR, `concept_themes` (detail in [archive/STATUS.md](archive/STATUS.md)).

### Near-term product / data loading

- [ ] Per-tab lazy Atelier reference fetch (junction + lookups still on RSC `Promise.all`).
- [ ] Reports / analytics aligned with keyset catalogue totals (Rapports tab ships on loaded batch only).
- [ ] Overview pipeline pulse → server + tags (remove remaining client Supabase widgets).
- [ ] Status labels via `dictionary` vs `STATUS_LABEL_MAP` (needs thin shared layer).

### Deferred integrations (explicit no-GO in CLAUDE)

- [ ] Background jobs / queues (portfolio PDF at scale, bulk R2/geocode) — prefer outbox + idempotency if DB webhooks fire side effects.
- [x] Vision / OCR field capture — *partial 2026-05-15:* `/atelier/capture?mode=card` (photo + paste, optional OpenAI vision, confirm → `importGoogleContacts`). Broader field OCR still deferred.
- [ ] Transactional email (Resend/Postmark-class).

### Suggested sequencing (opinion only)

1. Per-tab / lazy Atelier reads where TTI hurts.  
2. WorkDrawer + Supabase type cleanup in the same window.  
3. Background job outbox when server actions time out on heavy work.  
4. Vision/OCR after mobile capture paths are stable.

## Broadcast follow-ups (optional)

- [ ] Platform filter in Broadcast tab ([`BROADCAST.md`](./BROADCAST.md)).
- [ ] VIP unread cursor beyond fetched window.

## V5 refactor (see plan)

- [x] **Slice 3 — Atelier tab route segmentation** (2026-05-23) — 16 segment routes, QR bridge, `BottomStack`, `@container atelier` portal chrome, `TeamPortalClient` trim. Handoff: [`archive/HANDOFF_SLICE3.md`](./archive/HANDOFF_SLICE3.md).
- [x] **Slice 3B — Legacy tab segments** (2026-05-23) — `overview`, `map`, `journal`, `system`, `portfolio`, `contacts`, `stock`, `site`, `analytics`; `/atelier` → overview; `OverviewTab` extract. Handoff: [`archive/HANDOFF_SLICE3.md`](./archive/HANDOFF_SLICE3.md).
- [x] **Slice 5 — Graph foundation** (2026-05-23) — SQL applied; `gen:types`; constellation bundle + insert uids. Handoff: [`archive/HANDOFF_SLICE5.md`](./archive/HANDOFF_SLICE5.md).
- [x] **Slice 6 — Pivot Atlas** (2026-05-23) — `08_edge_fact_view.sql`, Reports atlas. Handoff: [`archive/HANDOFF_SLICE6.md`](./archive/HANDOFF_SLICE6.md).
- [x] **Slice 8 — Embeddings** (2026-05-23) — `07`+`09` SQL, embed-worker, semantic palette search verified. Handoff: [`archive/HANDOFF_SLICE8.md`](./archive/HANDOFF_SLICE8.md).
- [x] **Slice 7 — Analog fallbacks (Phase 1)** — admin CSV export (`/api/export/csv`), portfolio PDF graph appendix, `AGENTS.md` Supabase line. Handoff: [`archive/HANDOFF_SLICE7.md`](./archive/HANDOFF_SLICE7.md).
- [ ] **Slice 7 — Phase 2** — weekly R2 graph CSV (`graph-csv-backup.yml`); verify one Actions run. Optional: `feature-i18n.md`, `feature-embeddings.md`.
- [x] **Docs archive sweep** (2026-05-23) — completed slice handoffs → `docs/archive/`; slim `docs/README.md`; cross-links updated.

**Optional backlog (post–Slice 3, owner chooses vs Slice 4 i18n):**

- [ ] Segment remaining legacy `?tab=` tabs: overview, map, journal, system, portfolio, contacts, stock (+ site/analytics aliases)
- [ ] Per-route bundle size check (aspirational ≤ 250 kB)
- [ ] **Atelier shell reload on segment tab hop** — **client fix on `main` (2026-05-23):** `(portal)/layout` persists shell. Remaining: slim RSC loaders for Audit/Logistics.
- [ ] **Slice 1 — PWA / offline (Phase 1)** — local draft: Serwist + blob offline queue + `/~offline`. Handoff: [`archive/HANDOFF_SLICE1.md`](./archive/HANDOFF_SLICE1.md). Phase 2: Background Sync, R2 Cache-Control, shell revalidate tags.

- [x] **Slice 4 (core)** — `resolveMessage` + `t()` precedence (2026-05-23).
- [x] **Slice 4 (segment tabs)** — Exhibitions / Fiscal / Inventory / Sales hardcoded copy → `defineMessages`; ESLint off removed for those paths.
- [x] **i18n CI ratchet** — `i18n:check` fails on blocking hardcoded hotspots; allowlist synced with ESLint overrides (`scripts/i18n-check-allowlist.json`); `.github/workflows/ci.yml`.
- [x] **Slice 4 (panels)** — allowlist empty; `CurationPanel`, `PortfolioConfigShell`, `WorldMapTab` migrated (2026-05-23).

**V5 sequence (locked):** Slices 3–8 ✓ on `main` (Slice 8: SQL + worker + semantic search verified locally).

Active plan: [`PEM_HYBRID_REFACTOR_PLAN_V5.md`](./PEM_HYBRID_REFACTOR_PLAN_V5.md) (Slice 7 Phase 2 · Slice 1 PWA).

## Guardrails (not tasks)

RLS + `GRANT` on new tables · EU R2 endpoint · bilingual `dict` · 375px / 44px mobile contract · extend `audit_log_prune()` for new audit tables.

