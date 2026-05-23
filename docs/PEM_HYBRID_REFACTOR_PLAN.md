# Pem Hub — Hybrid Refactor Plan (Virtual Thunder)

> **Repo copy (reordered 2026-05-22).** Execute in Cursor against `origin/main` of this repo. Each slice ships as one or more PRs to `main`. **Owner GO required** before implementation (see `CLAUDE.md`). Desktop mirror: `Pem Hub — Hybrid Refactor Plan 2.md` — keep in sync when this file changes.

---

## How to use this plan

1. Pick **one slice** below (start with **Slice 2** unless ops blockers).
2. Pin **only that slice’s section** + listed file anchors — do not load `TeamPortalClient.tsx` (2188 LOC) or `ConstellationCanvas.tsx` (3013 LOC) unless that slice is active.
3. One chat ≈ **one PR outcome**; end with a 5-line handoff (branch, files, checks run, next PR).
4. You run heavy checks; paste failures only: `npm run lint`, `npm run typecheck`, `npm run test:e2e:field` when mobile touched.
5. Before “done” wording: `pwsh scripts/release-truth.ps1`.

---

## Execution order (reordered)

| Order | Slice | Focus | ~Agent sessions | Calendar (focused) |
|------|-------|--------|-----------------|-------------------|
| **1** | **2** | Lightroom / share-target (phone capture) | 3–6 | 1 week |
| **2** | **0a** | Error reporter + `no-silent-catch` + hot paths | 4–8 | 1–1.5 weeks |
| **3** | **0b** | Flip `ignoreBuildErrors` / `ignoreDuringBuilds` | 1–2 | 3–5 days |
| **4** | **1** | Serwist spike → full SW + caching | 6–12 | 2–3 weeks |
| **5** | **3** | Route segments + UX overlap (optional MVP) | 20–35 full / 8–12 MVP | 3–5 weeks full |
| **6** | **4** | i18n `defineMessages` (parallel with 3/1) | 4–8 | 1–1.5 weeks |
| **7** | **5** | Graph foundation (**gate** for 6) | 10–18 | 3–4 weeks |
| **8** | **6** | Pivot on `edge_fact` view | 2–4 | 1–1.5 weeks |
| **9** | **7** | Docs hygiene (continuous; finalize last) | 3–6 | 1 week concentrated |

**Full track calendar:** ~**12–14 weeks** focused · **14–18 weeks** part-time · **16–20 weeks** if graph or SW needs a second pass.

**MVP track (tight Cursor Pro $20):** Slices **2 → 0a → 0b → 1 minimal → 3 partial (4 routes)** · defer **5, 6, full 3, full 1** · ~**8–10 weeks** calendar, ~**25–35** agent sessions.

---

## Cursor usage (Pro+ → Pro $20)

- **Rollout time** = your merge/review/device calendar, not model typing speed.
- **Pro+ (until billing reset):** Use for Slice **2**, **0a**, **0b**, **1 offline spike**, and **1–2 template tab routes** if headspace allows.
- **After downgrade to $20 Pro:** Assume **~2–4 focused Composer sessions/week**; Slice **3** must be **one tab per chat**; Slice **5** = **one SQL file per PR**; you apply migrations in Supabase.
- **On-demand off:** At **~85% Auto + Composer**, finish the open PR; don’t open a new slice.
- **Do not** re-attach this entire file every session — pin one slice section only.

---

## Context

**Why this refactor.** The app is functionally complete for cataloguing, broadcasting, and field capture, but four structural issues block compounding work:

1. **Silent failures** — Lint/typecheck pass; runtime swallows errors (`console.error` → `[]` / `null`). No generic `RUNTIME_ERROR` path in `system_log` (audit logging exists in `lib/utils/logging.ts` only for typed events).
2. **Caching floor** — Few `revalidateTag` sites, some `force-dynamic`, no R2 `Cache-Control`, no Service Worker. `next.config.ts` ignores build errors/lint.
3. **Phone friction** — Native `capture="environment"` causes color drift; Lightroom Mobile is the real capture tool. **No Lightroom x-callback-url** — canonical path: Lightroom → iOS Share Sheet → PWA (`share_target` in `app/manifest.ts`).
4. **Schema** — `tblrelations` FKs both ends to `Oeuvres`; Constellation/pivot are work-only.

**Approved decisions:**
- In-place refactor on `main`; no `app-v2/`, no long-lived feature branches.
- Phone work capture: **Lightroom + share-target**; remove native camera on work paths (exceptions documented per slice).
- ESLint: add `pem-i18n/no-silent-catch` in existing `eslint-rules/` package (not a new plugin name).
- Graph: constellation foundation only; defer AI edges, time-scrubber, clusters.

**Prerequisites (must stay true):** Next.js 15 App Router · Supabase SSR + RLS + `gen:types` after SQL · Cloudflare R2 **EU** endpoint · Vercel deploy · Server Actions for mutations · `CLAUDE.md` verification tiers · explicit **GO** before edits.

---

## Goals & non-goals

**Goals:** Silent-fail enforcement · SW + offline · Lightroom canonical capture · graph `nodes` + triggers · i18n messages wired · route-segmented atelier · docs consolidated.

**Non-goals:** AI edges/embeddings · time-scrubber · deleting `TeamPortalClient` entirely before last · wire transfers · portfolio PDF background queues.

---

## Folder strategy

Stay in `app/`. New: `lib/error-reporter/`, `eslint-rules/no-silent-catch.js`, `supabase/sql/graph_foundation/`, `public/sw/`, `lib/sw-install/`, `lib/graph/node-ref.ts`, `components/shared/BottomStack.tsx`.

**Slice 3 correction:** Tab routes like `app/atelier/inventory/page.tsx` are created incrementally (Slice 3). **`/atelier/inventory`** landed 2026-05-23; other tabs still use `?tab=` on `/atelier` until migrated. Verb routes (`share-triage`, `capture`, `works/new`, …) unchanged.

---

## Slice 2 — Phone capture, Lightroom-first (**start here**)

**Goal:** One tap from Lightroom export to draft work with thumbnail and prefilled form. **Do triage before removing native capture.**

**Pre-flight (no GO needed for read-only):**
- Confirm `supabase/sql/share_inbox.sql` applied.
- Smoke: Lightroom or Files → Share → Atelier → triage (baseline).

**Scope (order matters):**

1. **Triage UX** (`app/atelier/share-triage/`, `ShareTriageClient.tsx`):
   - Single image on phone → jump to `WorkForm` with image + filename → `Titre` seed.
   - Multiple images → thumb grid; split into N draft works.
   - Recent draft works (last 5) to attach.
   - Optional: `mode=newWork` query on share-receive redirect.

2. **Hub / mobile chrome:**
   - `/hub` tile “From Lightroom” + first-run instructions modal.
   - `MobileActionBar`: primary capture → `/atelier/session/new` (Lightroom via Share Sheet, not URL scheme).

3. **Remove `capture="environment"` on work paths** (after step 1 works):
   - `components/atelier/WorkForm.tsx`
   - `components/atelier/work-drawer/WorkDrawerImageArea.tsx`
   - `components/atelier/capture/CaptureCardClient.tsx` — **exception: business-card capture stays native**
   - `components/atelier/capture/CaptureDocClient.tsx` — same exception for card mode only

4. **Also decide (per flow):**
   - `IssueNewForm.tsx`, `ConceptCard.tsx`, `NewConceptForm.tsx`, `SessionPhotoCapture.tsx` — session/concept photos: native vs file picker vs share-only.

5. **`CLAUDE.md`:** Replace “Mobile image capture may use `capture="environment"`” with Lightroom/share-target as canonical on phone; document card-capture exception.

6. **`app/manifest.ts`:** Add `pwa-icon-180` to `icons[]` (layout already has apple-touch).

**Verification:**
- iPhone SE: Lightroom → export → Share → Atelier → `WorkForm` with thumb.
- `npm run test:e2e:field` regression.
- Add `tests/share-target-triage.spec.ts` (desktop mock share).

**Risk:** Low if triage ships before capture removal. **Product:** Phone capture assumes Lightroom or Share Sheet / Files — document in modal.

**Depends on:** Nothing from 0/1/5. **Does not require** Serwist for happy path.

---

## Slice 0a — Safety net (reporter + rule + hot paths)

**Goal:** Eliminate silent-fail class; surface errors to toast + `system_log`.

**Scope:**
- `lib/error-reporter/` — `logError`, `logWarn`, `surfaceError` (server → `system_log` with `event_type='RUNTIME_ERROR'`; client → toast + POST `/api/system/log-error`).
- `app/api/system/log-error/route.ts` — authenticated, rate-limited.
- `eslint-rules/no-silent-catch.js` → wire as **`pem-i18n/no-silent-catch`** in `.eslintrc.json`.
- Refactor **verified** hot paths (not broadcast 74–117 / consignments 117 — those already return `{ error }`):

| File | Issue |
|------|--------|
| `lib/r2-s3-object-get.ts:30` | `catch { return null }` |
| `app/atelier/works/actions.ts` | `listWorkDrawerImages`, `fetchOeuvresKeysetPage` → `[]` |
| `app/atelier/works/gift-actions.ts:228` | `catch {}` on `doc.image()` |
| `app/atelier/portfolio/pdf-action.ts:500` | CV load → `''` |
| `app/atelier/portfolio/pdf-action.ts` | image loop errors (log only) |
| `app/atelier/portfolio/actions.ts:56` | `getDocSignedUrls` → null URLs |
| `app/atelier/sales/actions.ts:287` | PDF catch → still `{ ok: true }` |
| `app/atelier/consignments/actions.ts:181` | PDF error logged, no return |
| `app/atelier/session/actions.ts` | multiple `return []` after `console.error` |
| `app/atelier/audit/actions.ts:38` | `return []` |
| `lib/mobile/image-upload-client.ts:54` | downscale fail (log at minimum) |

**Verification:** `npm run lint` (no silent-catch violations); manual R2 miss → toast + `system_log`; `tests/error-reporter.spec.ts`.

**Risk:** Medium — **50+** `catch {` sites repo-wide; ratchet with documented `eslint-disable-next-line` where intentional.

**Do not flip build ignores in this slice.**

---

## Slice 0b — Build gates

**Goal:** CI honesty — types and lint block production build.

**Scope:** `next.config.ts` — `ignoreBuildErrors: false`, `ignoreDuringBuilds: false`; fix fallout.

**Note (2026-05-22 audit):** `npm run typecheck` already clean; fallout may be smaller than originally assumed — still required for discipline.

**Verification:** `npm run typecheck`, `npm run lint`, `npm run build`.

---

## Slice 1 — Caching + Service Worker

**Goal:** PWA offline capture + cached R2 thumbs. **Spike first.**

**Phase 1 — Spike (one PR):**
- Prove one offline `saveWork` round-trip: extend `lib/mobile/offline-work-queue.ts` for blobs if needed; keep **`AtelierOfflineFlush`** calling `saveWork(fd)` (document replay path — don’t assume anonymous POST to server action URL without research).
- Register minimal Serwist; version cache namespace by build ID.

**Phase 2 — Full:**
- `@serwist/next` — precache `/hub`, `/atelier`; CacheFirst AVIF; SWR on `/_next/static/*`; Background Sync on share-receive POST + save queue.
- `Cache-Control` on R2 PUT (`lib/r2-s3-object.ts`) + `next.config.ts` headers for `/r2-proxy/*`.
- Replace `force-dynamic` on `app/atelier/page.tsx` with `revalidateTag('atelier-shell')` where safe; keep `app/maps/page.tsx`, `app/atelier/sale/new/page.tsx` dynamic.
- `lib/sw-install/AtelierSWRegistrar.tsx` in `InternalSessionChrome`; thin `AtelierOfflineFlush` to SW events.

**Verification:** Lighthouse PWA ≥ 90 on `/hub`; offline form → reconnect → save; `npm run test:e2e:field`.

**Risk:** Medium-high — Next 15 chunk hashing + SW; keep dynamic tab imports in `TeamPortalClient` until Slice 3 stable.

---

## Slice 3 — UX overlap + route segmentation

**Goal:** Split monolith tabs into routes; fix bottom-of-viewport collisions; optional WorkForm decomposition.

**Tab migration order (one PR each):**
1. ✅ `inventory` (template) — **done** 2026-05-23
2. ✅ `sales` — **done** 2026-05-23
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
16. `constellation` last (bundle + phone read-only list)

**Per tab PR:**
- Create `app/atelier/<tab>/page.tsx` + `_components/<Tab>.tsx` (move from `components/atelier/`).
- Leave unmoved tabs in thin `TeamPortalClient` until done.

**Also:**
- `@container atelier` replace `useMediaQuery` narrow branches in portal chrome.
- `components/shared/BottomStack.tsx` — `MobileActionBar`, `CurationDock`, sticky save bars, `VoiceNoteSheet`.
- Constellation: read-only list &lt; 768px; dynamic import gate.
- **Optional / defer on $20 Pro:** split `WorkForm.tsx` into 7 subcomponents (composer ≤ 200 LOC).

**MVP (Pro budget):** Only steps 1–2 + `works` + keep rest in portal.

**Verification:** `typecheck`, `lint`, `test:e2e:field`; bundle target ≤ 250kb per route (aspirational).

**Risk:** Highest slice — calendar driver is **PR count**, not LOC.

---

## Slice 4 — i18n messages

**Goal:** `defineMessages` modules wired; precedence messages &gt; dictionary in `lib/i18n/context.tsx`.

**Scope:**
- Wire 8 files under `lib/i18n/messages/` into routes.
- Tighten `no-hardcoded-jsx-text` for FR leaks; remove eslint **off** overrides for tabs as they’re fixed (`ExhibitionsTab`, `FiscalTab`, `InventoryTab`, `CurationPanel`, `PortfolioConfigShell`, …).
- `logWarn` when both messages and dictionary miss.

**Runs parallel to:** Slice 1 (late) and Slice 3 (per tab).

**Verification:** `npm run i18n:check`, `npm run lint`, manual `fr` ↔ `en` on exhibitions.

---

## Slice 5 — Graph foundation (**gate**)

**Goal:** `public.nodes` supertype; `tblrelations` → node FKs; triggers sync hard columns; `entity` view. **No app dual-writes.**

**Migrations:** `supabase/sql/graph_foundation/01` … `06` (one PR per file).

**Before each PR:** Manual `backup.yml` workflow; grant audit after grants.

**Code:** `lib/graph/node-ref.ts`; constellation actions + canvas multi-type glyphs; legacy `source_id`/`target_id` shim one release.

**Verification:** Insert/change/delete Oeuvre + Contact; cascade; `npm run gen:types` same PR as SQL; constellation E2E.

**Risk:** Highest technical risk — chunked backfills, `pg_trigger_depth()`, bulk import uses `session_replication_role = replica` when documented.

**Requires:** Slice 0a recommended before heavy constellation edits (not Slice 2).

---

## Slice 6 — Pivot generalization

**Goal:** `edge_fact` **view** (not MV); generalize `lib/pivot.ts`; Pivot Atlas in reports.

**After Slice 5 only.**

**Verification:** Existing pivot works; Contacts × Themes within 1 of manual SQL; &lt; 200ms per canonical pivot at current scale.

---

## Slice 7 — Docs hygiene

**Keep:** `CLAUDE.md`, `AGENTS.md`, `SITE_MAP.md`, `docs/BACKUP_RECOVERY.md`, `docs/CONSTELLATION.md`, slim `docs/PROJECT_SYNTHESIS.md`.

**Add:** `docs/README.md`, `docs/STATUS.md` (merge ROADMAP/TODO/SYSTEM_LEDGER), `docs/feature-graph.md`, `docs/feature-sw.md`, `docs/feature-i18n.md`.

**Archive:** everything else → `docs/archive/` with banner.

**Update CLAUDE/AGENTS:** ESLint rule name, SW policy, graph migration rule, mobile capture (if not done in Slice 2). Fix **AGENTS.md** “Prisma” stale line → Supabase.

---

## Structural risks (ranked)

1. Graph migration (5)
2. SW stale chunks (1)
3. Route split bundle bloat (3)
4. Lightroom-only without app installed (2) — mitigated by triage + instructions
5. ESLint ratchet (0a)
6. i18n precedence bugs (4)
7. Branch maze — merge each slice to `main` before next

---

## End-to-end verification (all slices merged)

1. iPhone SE `/hub` TTI ≤ 2s on 4G (aspirational)
2. Offline capture round-trip (1)
3. Lightroom share → 2+2 draft works (2)
4. Constellation multi-type nodes (5)
5. Pivot Contacts × Themes (6)
6. R2 thumb fail → toast + `system_log` (0a)
7. `npm run lint && npm run typecheck` with build gates on
8. `npm run test:e2e && npm run test:e2e:field`
9. `pwsh scripts/release-truth.ps1`

---

## Critical file references

| Area | Path |
|------|------|
| Atelier bootstrap | `app/atelier/page.tsx`, `lib/atelier/load-atelier-shell-props.ts` |
| Inventory tab (Slice 3) | `app/atelier/inventory/page.tsx`, `app/atelier/inventory/_components/Inventory.tsx` |
| Sales tab (Slice 3) | `app/atelier/sales/page.tsx`, `app/atelier/sales/_components/Sales.tsx` |
| Monolith | `components/atelier/TeamPortalClient.tsx` |
| Constellation | `components/atelier/ConstellationCanvas.tsx`, `app/atelier/constellation/actions.ts` |
| Work form | `components/atelier/WorkForm.tsx` |
| Share | `app/atelier/share-receive/route.ts`, `app/atelier/share-triage/` |
| Offline | `lib/mobile/offline-work-queue.ts`, `components/mobile/AtelierOfflineFlush.tsx` |
| R2 | `lib/r2-s3-object.ts`, `lib/r2-s3-object-get.ts` |
| i18n | `lib/i18n/context.tsx`, `lib/i18n/messages/` |
| Config | `next.config.ts`, `app/manifest.ts`, `.eslintrc.json` |
| Graph (future) | `supabase/sql/graph_foundation/`, `lib/pivot.ts` |

---

*Plan reordered 2026-05-22 after repo audit + Cursor Pro+ → Pro usage constraints. Original authoring: Virtual Thunder.*
