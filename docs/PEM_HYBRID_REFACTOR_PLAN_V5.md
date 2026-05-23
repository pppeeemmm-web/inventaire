# Pem Hub — Hybrid Refactor Plan V5 (Cursor Execution)

> **Cursor Auto Mode plan, generated 2026-05-22.** Supersedes `universe V3.md` after a Claude Code audit of `origin/main` and integration of the Qdrant + Ollama addendum. Execute against `origin/main` of the Art db / app repo. Each slice ships as one or more PRs to `main`. **Owner GO required** before any edits (`CLAUDE.md`).

---

## Cursor Auto Mode Protocol (Strict)

To prevent context-loss and hallucinated code, Cursor must follow this exact loop for every task:

1. **Plan:** Read the active slice. Output a bulleted list of the exact files to touch and what will change. **Wait for Owner GO.**
2. **Agent:** Execute the approved changes. Do not touch files outside the agreed scope.
3. **Verify:** Run `npm run lint`, `npm run typecheck`, `npm run i18n:check`, and `npm run test:e2e:field` for mobile/UI work.
4. **Commit:** Ensure `pwsh scripts/release-truth.ps1` is clean before finalizing the PR.

Pin **only that slice's section** + listed file anchors. Do not load `TeamPortalClient.tsx` (2188 LOC) or `ConstellationCanvas.tsx` (3013 LOC) unless that slice is active.

---

## What changed since V3

V3 was a planning doc; V5 is the executable plan after the codebase audit + the Qdrant/Ollama integration decision.

**Owner decisions baked in:**
- UX layer = Slice 3 (routes + QR Physical Bridge) + Slice 4 (i18n messages). PWA/SW deferred.
- Safety net (0a + 0b) goes after Lightroom-first, before UX.
- Qdrant = **async desktop worker** (no Cloudflare tunnel).
- Embedding scope = **all node types** (works + contacts + themes + concepts + working_groups + exhibitions). Slice 5 (graph foundation) must land before Qdrant.

**Audit deltas vs V3 assumptions:**
- Share target + triage already exist (`app/manifest.ts`, `app/atelier/share-triage/`, `ShareTriageClient.tsx`). Slice 2 is now incremental — filename → Titre seed, hub tile, capture removal — not greenfield.
- 7 files still use `capture="environment"` (4 unconditional, 3 narrow-only).
- 8 `.messages.ts` files exist under `lib/i18n/messages/` but `lib/i18n/context.tsx` has no precedence wiring yet.
- 11 atelier route directories contain only `actions.ts` — `page.tsx` files don't exist (except **`/atelier/inventory`** — Slice 3 PR 1 landed 2026-05-23).
- No `public.nodes`, no `tblrelations` node FKs, no `entity`/`edge_fact` views, no embedding columns anywhere.
- `npm run typecheck` is already clean — Slice 0b fallout will be small.

---

## Execution order

| # | Slice | Focus | Gates next |
|---|-------|-------|------------|
| 1 | **2**  | Lightroom-first phone capture + triage + AVIF/EXIF        | — |
| 2 | **0a** | Error reporter + `pem-i18n/no-silent-catch` + hot paths   | — |
| 3 | **0b** | Flip `ignoreBuildErrors` / `ignoreDuringBuilds`           | — |
| 4 | **3**  | Route segmentation (16 tabs) + QR Physical Bridge         | — |
| 5 | **4**  | `defineMessages` precedence in `lib/i18n/context.tsx`     | — |
| 6 | **5**  | `public.nodes` + triggers + tblrelations FKs + `entity` view | gates 6 & 8 |
| 7 | **8**  *(new)* | Ollama + Qdrant async desktop worker                | — |
| 8 | **6**  | `edge_fact` view + pivot generalization + Pivot Atlas     | — |
| 9 | **7**  | Docs hygiene + CSV Universal Export + graph-aware PDF     | — |
| 10 | **1** | PWA/SW (Serwist) + R2 cache — deferred polish             | — |

Each slice = one or more PRs against `origin/main`. **First PR target: Slice 2.**

---

## Context & Resilience Philosophy

The app is functionally complete; we are moving from a strict relational ledger to a hybrid graph ("Universe Map").

**Core Directives:**
- **Low-Friction Capture:** Mobile Lightroom → Share Sheet is the canonical phone path.
- **Supabase Free Tier Limits:** No background cron jobs. Heavy joins use standard indexed views. Native Postgres constraints over application-layer logic.
- **Graceful Degradation:** Graph-aware PDFs and CSV dumps ensure the system's knowledge outlives the software.
- **Image Pipeline:** Payloads arrive as AVIF, 2100 px long edge. Server extracts EXIF then strips it (minimal `sharp` on serverless). Transparent/round images fall back to desktop upload.
- **AI Compute Off-Box:** Ollama runs locally on the owner's desktop; Qdrant Cloud Free Tier holds vectors. Supabase stays lean and relational.

---

## Slice 2 — Phone capture, Lightroom-first (**start here**)

**Goal:** One tap from Lightroom export → draft work with thumb + seeded `Titre`.

**Scope (order matters):**

1. **Triage UX** (`app/atelier/share-triage/page.tsx`, `components/atelier/ShareTriageClient.tsx`):
   - Single image on phone → jump straight to `WorkForm` with image + filename → `Titre` seed.
   - Multiple images → thumb grid; split into N draft works.
   - Accept `?mode=newWork` on share-receive redirect.
   - Reuse existing `ParsedShareDetail` + `ShareAttachPanel`.

2. **Hub chrome** (`app/hub/page.tsx` + `HubLauncherClient`):
   - "From Lightroom" tile.
   - First-run instructions modal.

3. **Remove `capture="environment"` on work paths** (after step 1 works):
   - `components/atelier/WorkForm.tsx:1138`
   - `components/atelier/work-drawer/WorkDrawerImageArea.tsx:103`
   - `components/atelier/session/SessionPhotoCapture.tsx:103`
   - `components/atelier/IssueNewForm.tsx:164`
   - `components/atelier/concepts/NewConceptForm.tsx:107`
   - `components/atelier/concepts/ConceptCard.tsx:214`
   - **Exception:** keep native capture in `components/atelier/capture/CaptureCardClient.tsx:200` (business cards).

4. **Image pipeline** (`lib/image-upload.ts`):
   - Confirm AVIF input passes `validateWorkImageBuffer()`.
   - Add EXIF Artist/Copyright stamp; document transparent/round-image desktop fallback in JSDoc.

5. **Manifest** (`app/manifest.ts`):
   - Add `pwa-icon-180` to `icons[]`.

6. **CLAUDE.md update:**
   - Replace "Mobile image capture may use `capture=environment`" with Lightroom/share-target as canonical on phone; document card-capture exception.

**Verification:**
- iPhone SE: Lightroom → export → Share → Atelier → `WorkForm` shows thumb + filename-seeded Titre.
- `npm run test:e2e:field` regression.
- Add `tests/share-target-triage.spec.ts` (desktop mock share).

**Risk:** Low — triage exists; this is incremental UX polish. Capture removal blocked by step 1 landing.

**Depends on:** Nothing.

---

## Slice 0a — Safety net (reporter + rule + hot paths)

**Goal:** Eliminate silent-fail class; surface errors to toast + `system_log`.

**Scope:**
- `lib/error-reporter/index.ts` (new) — `logError`, `logWarn`, `surfaceError`. Server → `system_log` with `event_type='RUNTIME_ERROR'`; client → toast + POST `/api/system/log-error`.
- `app/api/system/log-error/route.ts` (new) — authenticated, rate-limited.
- `eslint-rules/no-silent-catch.js` (new) → wire as `pem-i18n/no-silent-catch` in `.eslintrc.json`.
- Refactor verified hot paths:

| File | Issue |
|------|-------|
| `lib/r2-s3-object-get.ts:30` | `catch { return null }` |
| `app/atelier/works/actions.ts` | `listWorkDrawerImages`, `fetchOeuvresKeysetPage` → `[]` |
| `app/atelier/works/gift-actions.ts:228` | `catch {}` on `doc.image()` |
| `app/atelier/portfolio/pdf-action.ts:500` | CV load → `''` |
| `app/atelier/portfolio/pdf-action.ts` | image-loop errors logged but swallowed |
| `app/atelier/portfolio/actions.ts:56` | `getDocSignedUrls` → null URLs |
| `app/atelier/sales/actions.ts:287` | PDF catch → still `{ ok: true }` |
| `app/atelier/consignments/actions.ts:181` | PDF error logged, no return |
| `app/atelier/session/actions.ts` | multiple `return []` after `console.error` |
| `app/atelier/audit/actions.ts:38` | `return []` |
| `lib/mobile/image-upload-client.ts:54` | downscale fail (log at minimum) |

**Reuse:** `system_log` insert pattern in `lib/utils/logging.ts`; existing toast util.

**Verification:** `npm run lint` (no silent-catch violations); manual R2 miss → toast + `system_log`; `tests/error-reporter.spec.ts`.

**Risk:** Medium — 50+ `catch {` sites repo-wide. Ratchet with documented `eslint-disable-next-line` where intentional.

**Do not flip build ignores in this slice.**

---

## Slice 0b — Build gates

**Goal:** CI honesty — types and lint block the production build.

**Scope:** `next.config.ts:37` and `:42` — flip `ignoreBuildErrors: false`, `ignoreDuringBuilds: false`; fix fallout.

**Note:** `npm run typecheck` already clean per audit. Fallout should be small.

**Verification:** `npm run typecheck`, `npm run lint`, `npm run build`.

---

## Slice 3 — UX overlap + Route segmentation + QR Physical Bridge

**Goal:** Split monolith `components/atelier/TeamPortalClient.tsx` (2188 LOC) into route segments. Introduce the Physical-to-Digital Bridge via QR codes.

**Tab migration order** (one PR each):
1. ✅ `inventory` (template) → `app/atelier/inventory/page.tsx` + `_components/Inventory.tsx` — **done** (`8590d04` + `f7b8621`, 2026-05-23)
2. ✅ `sales` → `app/atelier/sales/page.tsx` + `_components/Sales.tsx` — **done** (2026-05-23)
3. `pipeline`
4. `production`
5. `stock-take`
6. `notes`
7. `reports`
8. `exhibitions`
9. `concepts`
10. `themes`
11. `logistics`
12. `vault`
13. `fiscal`
14. `broadcast`
15. `audit`
16. `constellation` (last; dynamic import gate; read-only list < 768 px)

**Per-tab PR:**
- Create `app/atelier/<tab>/page.tsx` + `_components/<Tab>.tsx` (move from `components/atelier/`).
- Leave unmoved tabs in thin `TeamPortalClient` until done.

**Also:**
- `components/shared/BottomStack.tsx` (new) — z-index manager for `MobileActionBar`, `CurationDock`, sticky save bars, `VoiceNoteSheet`.
- `@container atelier` replaces `useMediaQuery` narrow branches in portal chrome.
- **QR Physical Bridge:** inside the decomposed `WorkForm.tsx`, add a UI element to generate / print a QR code pointing to that entity's canonical URL. Use a tiny client-side lib (`qrcode` ~14 kB) — no server call. Extend to Contact / Exhibition forms as those routes split.

**Verification:** Per tab — `typecheck`, `lint`, `test:e2e:field`. Final — smoke each route at 375 px. Bundle ≤ 250 kB per route (aspirational).

**Risk:** Highest slice — calendar driver is **PR count**, not LOC.

---

## Slice 4 — i18n messages precedence

**Goal:** `defineMessages` modules > dictionary fallback in `lib/i18n/context.tsx`.

**Scope:**
- Wire the 8 existing files in `lib/i18n/messages/` into the context: lookup messages first, fall back to `dict[lang][key]`, `logWarn` on both-miss.
- Remove `off` overrides for tabs as they're migrated: `ExhibitionsTab`, `FiscalTab`, ~~`InventoryTab`~~ (`Inventory.tsx` migrated — override path updated), `CurationPanel`, `PortfolioConfigShell`.
- Tighten `no-hardcoded-jsx-text` for FR leaks.
- New copy added in Slices 2 / 0a / 3 must use `defineMessages` — do not extend the legacy dictionary.

**Runs parallel to:** Slice 3 (per tab).

**Verification:** `npm run i18n:check`, `npm run lint`, manual `fr` ↔ `en` on exhibitions.

---

## Slice 5 — Graph foundation (Free Tier Architecture)

**Goal:** `public.nodes` supertype; `tblrelations` FK'd to nodes; triggers auto-register hard-column relations; `entity` view. **No app dual-writes.**

**Migrations** (`supabase/sql/graph_foundation/`, one PR per file):

- `01_nodes_table.sql` — `public.nodes(node_id UUID PK, node_type TEXT, source_pk TEXT, created_at TIMESTAMPTZ DEFAULT now())`, with partial unique on `(node_type, source_pk)`.
- `02_register_triggers.sql` — `AFTER INSERT` triggers on `Oeuvres`, `Contact`, `theme`, `concept`, `working_group`, `exhibition` → insert into `public.nodes`; matching `AFTER DELETE` triggers cascade to `public.nodes`.
- `03_backfill_nodes.sql` — one-time `INSERT … SELECT` for existing rows. Use `session_replication_role = replica` to bypass triggers during the backfill.
- `04_tblrelations_node_fks.sql` — add `source_uid UUID REFERENCES nodes(node_id) ON DELETE CASCADE`, `target_uid UUID REFERENCES nodes(node_id) ON DELETE CASCADE`. Backfill from `source_id`/`target_id`. Keep legacy columns one release as a shim.
- `05_relation_sync_triggers.sql` — triggers on `Oeuvres.AcheteurID`, `oeuvre_theme`, `concept.themes[]`, etc. → upsert edges into `tblrelations`. Use `pg_trigger_depth()` to avoid cascade loops.
- `06_entity_view.sql` — unified `entity` view (`node_id`, `node_type`, display fields) joining `public.nodes` to each source table.

**Code:** `lib/graph/node-ref.ts` — `nodeRef(type, id)` helper. Constellation actions + `ConstellationCanvas.tsx` updated to consume `entity` view + multi-type glyphs. Legacy `source_id`/`target_id` shim one release.

**Before each PR:** manual `backup.yml` workflow run; `supabase/sql/grant_audit_queries.sql` after grants. `npm run gen:types` in the same PR as SQL.

**Verification:** Insert/change/delete `Oeuvre` + `Contact`; observe cascade; constellation E2E with both types.

**Risk:** Highest technical risk — chunked backfills, `pg_trigger_depth()`, bulk import uses `session_replication_role = replica` when documented.

**Requires:** Slice 0a recommended before heavy constellation edits.

---

## Slice 8 — Ollama + Qdrant async bridge *(new)*

**Goal:** Local Ollama (`nomic-embed-text`, 768-dim) embeds every node; Qdrant Cloud Free Tier holds vectors; desktop Node worker bridges Supabase ↔ Qdrant. Mobile capture stays instant; embeddings catch up when desktop wakes.

**Depends on:** Slice 5 (`public.nodes` + triggers must exist).

### 8.1 — Schema (PR 1)

**File:** `supabase/sql/graph_foundation/07_embeddings.sql`

Add to `public.nodes`:

| Column | Type | Purpose |
|---|---|---|
| `embedding_status` | `TEXT NOT NULL DEFAULT 'pending'` | `pending` / `embedding` / `ok` / `error` / `skipped` |
| `embedding_text_hash` | `TEXT` | sha256 of input text; skip re-embed when unchanged |
| `embedding_model` | `TEXT` | e.g. `nomic-embed-text:v1.5` |
| `embedded_at` | `TIMESTAMPTZ` | |
| `qdrant_point_id` | `UUID` | Point id = `node_id` (1:1) |
| `embedding_error` | `TEXT` | truncated last error |
| `embedding_attempts` | `INT NOT NULL DEFAULT 0` | |
| `embedding_dirty_at` | `TIMESTAMPTZ` | bumped by source-row UPDATE triggers → re-embed |

**Partial index** on `(node_type, node_id) WHERE embedding_status IN ('pending','error')` — cheap polling query.

**New table:** `public.node_embedding_tombstone(node_id UUID PRIMARY KEY, deleted_at TIMESTAMPTZ DEFAULT now())`. Populated by `AFTER DELETE` trigger on `public.nodes`; drained by the worker → Qdrant `DELETE` → tombstone row removed.

**New function:** `public.node_search_text(p_node_id UUID) RETURNS TEXT` (`SECURITY DEFINER`, `STABLE`). Switches on `node_type`.

> **CRITICAL — use `concat_ws('. ', …)`, never `||`.** Postgres `||` collapses the whole expression to `NULL` if **any** operand is `NULL`, which would silently produce empty embeddings whenever a node is missing one field. `concat_ws` skips `NULL` operands individually.

```sql
case node_type
  when 'oeuvre'        then concat_ws('. ', "Titre", "Description", "Médium")
  when 'contact'       then concat_ws('. ', concat_ws(' ', "FirstName", "LastName"), "Notes")
  when 'theme'         then concat_ws('. ', name, description)
  when 'concept'       then concat_ws('. ', title, body_md)
  when 'working_group' then concat_ws('. ', name, summary)
  when 'exhibition'    then concat_ws('. ', concat_ws(' @ ', title, venue), dates::text, notes)
end
```

Wrap the function return in `nullif(trim(…), '')` so all-empty inputs return `NULL` (worker sets `embedding_status='skipped'` and never calls Ollama).

**Grants:** `GRANT SELECT (node_id, node_type, embedding_status) ON public.nodes TO authenticated`. All writes service-role only.

`npm run gen:types` in the same PR.

### 8.2 — Worker (PR 2)

**Location:** `scripts/embed-worker/` (mirrors `scripts/storage-ledger-backfill.mjs` — Node ESM `.mjs`, service-role key loaded from `.env.local`, never bundled).

**Files:**
- `index.mjs` — entry; modes: `--once`, `--watch`, `--reembed-all`, `--audit`, `--limit=N`
- `ollama-client.mjs` — `POST http://127.0.0.1:11434/api/embeddings`
- `qdrant-client.mjs` — `@qdrant/js-client-rest`
- `supabase-admin.mjs` — service-role client (mirror existing pattern)
- `text-builder.mjs` — fallback only; primary truth is `node_search_text()` SQL function
- `README.md` — setup steps (Ollama pull, Qdrant Cloud signup, env vars)

**Cadence:** `--watch` polls 60 s when queue empty, 0 s while pending. Batch 32 per pass.

**Failure modes:**
- Ollama `ECONNREFUSED` → rows stay `pending`. Log once to stderr, sleep 60 s, retry. **Do not** increment `embedding_attempts` (not the node's fault).
- Qdrant 5xx / network → `embedding_attempts++` with exponential backoff (1 s → 60 s cap). After 5 fails → `embedding_status='error'`.
- Supabase down → worker dies cleanly. No in-memory queue. Restart resumes from DB.
- Mid-batch crash → rows stuck in `embedding` > 10 min reset to `pending` at next startup.
- `--audit` mode → scroll all Qdrant point ids, diff against `select node_id from public.nodes`, delete orphans. Run weekly with `backup.yml`.

### 8.3 — Retrieval (PR 3)

**Files:**
- `app/atelier/search/actions.ts` — desktop server action: embed query via local Ollama → Qdrant search → hydrate via `entity` view.
- `app/(public)/search/actions.ts` — mobile/public path: read `public.query_embedding_cache(query_norm TEXT PK, vector JSONB, created_at TIMESTAMPTZ)`. Miss → graceful fallback to keyword search + enqueue into `public.pending_query_embeddings` for the worker.
- `lib/graph/node-ref.ts` — extend with hydrate helper.
- New tables: `public.query_embedding_cache`, `public.pending_query_embeddings`.

**Qdrant collection:** single `pem_universe`, vector 768, cosine distance, on-disk. Payload indexed: `node_id` (uuid), `node_type` (keyword), `is_public` (bool), `lang_hint` (keyword), `embedded_at` (epoch int), `model` (keyword). Point id = `node_id` (idempotent upserts).

### 8.4 — UI (PR 4)

**Files:**
- `lib/i18n/messages/search.messages.ts` (new) — `defineMessages` (FR + EN).
- Wire semantic search into the Atelier search input + public-site search.
- "Embedding pending" badge in lists where `embedding_status != 'ok'`.
- **Optional** ESLint rule `eslint-rules/no-service-role-in-client.js` — forbids `process.env.SUPABASE_SERVICE_ROLE_KEY` / `process.env.QDRANT_API_KEY` outside `scripts/`, `lib/supabase/server.ts`, `app/api/`.

**Reuse:** `lib/supabase/server.ts` (service-role pattern); `scripts/storage-ledger-backfill.mjs` (script shape); `entity` view from Slice 5.

**Verification (no paid services):**
1. `ollama pull nomic-embed-text` → ~270 MB.
2. `ollama serve` + `curl http://127.0.0.1:11434/api/tags` confirms model loaded.
3. Sign up at `cloud.qdrant.io` Free Tier; cluster `pem-dev`; `QDRANT_URL` + `QDRANT_API_KEY` in `.env.local`.
4. Apply slice-8 SQL; `select node_search_text('<oeuvre uuid>')` returns expected string.
5. `node scripts/embed-worker/index.mjs --once --limit=5` → 5 rows flip to `ok`; Qdrant dashboard shows 5 points.
6. Delete a source row → tombstone appears → re-run worker → Qdrant count drops.
7. Stop Ollama → run worker → clean stderr, no `attempts` increment.
8. Atelier search "marine paysage" → ranked Qdrant hits hydrated via `entity` view.

**Risks (ranked):**

1. **Supabase ↔ Qdrant drift (HIGH)** — a deleted row in Postgres but alive in Qdrant pollutes results. Mitigation: tombstone trigger is a Postgres-side guarantee, not a worker assumption; weekly `--audit` reconciler.
2. **Embedding model drift (MEDIUM)** — `embedding_model` column + Qdrant `model` payload; worker refuses mismatched writes; re-embed = `update public.nodes set embedding_status='pending'`. Bigger model swaps → create `pem_universe_v2` and flip `EMBEDDING_COLLECTION` env.
3. **Trust boundary leak (CRITICAL)** — service-role + Qdrant write keys live only in `.env.local`. Lint rule blocks accidental client-side imports. Browser never talks to Qdrant directly.

**Out of scope:** Cloudflare tunnel (rejected by owner), pgvector inside Supabase (paid-tier RAM cost), `sentence-transformers.js` on mobile (>30 MB WASM + model divergence kills field-tool budget).

---

## Slice 6 — Pivot on `edge_fact` view

**Goal:** Multidimensional pivoting without burning compute.

**Files:**
- `supabase/sql/graph_foundation/08_edge_fact_view.sql` (new) — standard indexed `VIEW` joining `entity ⋈ tblrelations ⋈ entity` with row-level filters. **No materialized view, no cron.**
- `lib/pivot.ts` — generalize to consume the view (currently aggregates client-side arrays).
- Add Pivot Atlas page under `app/atelier/reports/` (after route segmentation lands).

**Verification:** Existing pivot regression; Contacts × Themes pivot within ±1 of manual SQL; < 200 ms per canonical pivot at current scale.

---

## Slice 7 — Docs hygiene & Analog Fallbacks

**Goal:** Guarantee system longevity through universally readable formats.

**Scope:**
- **CSV Universal Export:** `app/api/export/csv/route.ts` (new) — streams `entity` and `edge_fact` views to plain `.csv`. Auth-gated via `is_admin()`. Optional weekly GitHub Action that drops the CSV alongside the daily R2 backup.
- **Graph-Aware PDF:** update `app/atelier/portfolio/pdf-action.ts` — `generatePortfolioPdf()` appends graph relationships (Themes, Working Groups, Concepts) from `entity` + `edge_fact` to the printable portfolio.
- **Docs consolidation:**
  - **Keep:** `CLAUDE.md`, `AGENTS.md`, `SITE_MAP.md`, `docs/BACKUP_RECOVERY.md`, `docs/CONSTELLATION.md`, slim `docs/PROJECT_SYNTHESIS.md`.
  - **Add:** `docs/README.md`, `docs/STATUS.md` (merge ROADMAP / TODO / SYSTEM_LEDGER), `docs/feature-graph.md`, `docs/feature-i18n.md`, `docs/feature-embeddings.md` (Slice 8 setup + audit ritual).
  - **Archive:** everything else → `docs/archive/` with banner.
- Fix `AGENTS.md` "Prisma" stale line → Supabase.

**Verification:** CSV opens cleanly in Excel + Google Sheets + LibreOffice; PDF generation includes a Themes section; `docs/archive/` is the only place stale plans live.

---

## Slice 1 — PWA / Service Worker (deferred polish)

**Goal:** Offline capture round-trip + cached R2 thumbs.

**Phase 1 spike (one PR):**
- Prove one offline `saveWork` round-trip with blob; extend `lib/mobile/offline-work-queue.ts` for image blobs. Keep `components/mobile/AtelierOfflineFlush.tsx` calling `saveWork(fd)`.
- Register minimal Serwist; version cache namespace by build ID.

**Phase 2 full:**
- `@serwist/next` — precache `/hub`, `/atelier`; CacheFirst on AVIF; SWR on `/_next/static/*`; Background Sync on share-receive POST + save queue.
- `Cache-Control` on R2 PUT (`lib/r2-s3-object.ts`); headers for `/r2-proxy/*` in `next.config.ts`.
- Replace `force-dynamic` on `app/atelier/page.tsx` with `revalidateTag('atelier-shell')` where safe. Keep `app/maps/page.tsx`, `app/atelier/sale/new/page.tsx` dynamic.
- `lib/sw-install/AtelierSWRegistrar.tsx` (new) inside `InternalSessionChrome`.

**Verification:** Lighthouse PWA ≥ 90 on `/hub`; offline WorkForm → reconnect → save; `npm run test:e2e:field`.

**Why last:** Slice 2 ships a working online Lightroom path; offline is a nice-to-have, not a blocker. Touching the SW after route segmentation (Slice 3) avoids churning cache namespaces twice.

---

## End-to-end verification (all slices merged)

1. iPhone SE `/hub` → "From Lightroom" tile → Lightroom export → Share → `WorkForm` with thumb + seeded Titre (Slice 2).
2. R2 thumb 404 → toast + `system_log` row with `event_type='RUNTIME_ERROR'` (Slice 0a).
3. `npm run build` fails on a deliberate type error (Slice 0b).
4. Each atelier tab is a standalone route, < 768 px usable, QR print from `WorkForm` scans to canonical URL (Slice 3).
5. FR ↔ EN toggle on exhibitions; missing key logs a warn (Slice 4).
6. Constellation shows Oeuvre + Contact + Theme glyphs; delete Oeuvre cascades edges (Slice 5).
7. `embed-worker --once` brings Qdrant point count to row count of `public.nodes`; "marine paysage" returns ranked hydrated rows (Slice 8).
8. Reports → Pivot Atlas → Contacts × Themes within ±1 of manual SQL (Slice 6).
9. `/api/export/csv?view=entity` opens in Excel; portfolio PDF includes Themes section (Slice 7).
10. Offline WorkForm save → airplane mode → reconnect → row appears (Slice 1).
11. `pwsh scripts/release-truth.ps1` — branch=main, HEAD==origin/main, working tree clean.

---

## Critical files (cross-slice anchors)

| Area | Path |
|------|------|
| Atelier bootstrap | `app/atelier/page.tsx`, `lib/atelier/load-atelier-shell-props.ts` |
| Inventory tab (Slice 3) | `app/atelier/inventory/page.tsx`, `app/atelier/inventory/_components/Inventory.tsx`, `lib/atelier/tab-routes.ts` |
| Sales tab (Slice 3) | `app/atelier/sales/page.tsx`, `app/atelier/sales/_components/Sales.tsx` |
| Monolith to split | `components/atelier/TeamPortalClient.tsx` (2188 LOC) |
| WorkForm | `components/atelier/WorkForm.tsx` (1243 LOC) |
| Constellation | `components/atelier/ConstellationCanvas.tsx` (3013 LOC), `app/atelier/constellation/actions.ts` |
| Share target | `app/atelier/share-receive/route.ts`, `app/atelier/share-triage/`, `components/atelier/ShareTriageClient.tsx` |
| Offline queue | `lib/mobile/offline-work-queue.ts`, `components/mobile/AtelierOfflineFlush.tsx` |
| R2 | `lib/r2-s3-object.ts`, `lib/r2-s3-object-get.ts` |
| Image pipeline | `lib/image-upload.ts` |
| i18n | `lib/i18n/context.tsx`, `lib/i18n/messages/` |
| Pivot | `lib/pivot.ts` |
| PDF | `app/atelier/portfolio/pdf-action.ts` |
| Worker analogue | `scripts/storage-ledger-backfill.mjs` |
| Config | `next.config.ts`, `app/manifest.ts`, `.eslintrc.json` |
| Graph (new) | `supabase/sql/graph_foundation/`, `lib/graph/node-ref.ts` |
| Embed worker (new) | `scripts/embed-worker/` |

---

## Structural risks (ranked)

1. Graph migration (Slice 5) — backfill, triggers, `pg_trigger_depth()`.
2. Supabase ↔ Qdrant drift (Slice 8) — mitigated by tombstone trigger + audit.
3. Route split bundle bloat (Slice 3) — verify per-route bundle size.
4. Lightroom-only without app installed (Slice 2) — mitigated by triage UX + instructions modal.
5. ESLint ratchet (Slice 0a) — 50+ silent-catch sites.
6. SW stale chunks (Slice 1) — version cache namespace by build ID.
7. i18n precedence bugs (Slice 4).
8. Trust boundary leak (Slice 8) — service-role + Qdrant keys must never enter the client bundle.

---

*Plan V5 generated 2026-05-22 after Claude Code audit of `origin/main` + Qdrant/Ollama integration. Supersedes `universe V3.md`. Owner GO required before any edits.*
