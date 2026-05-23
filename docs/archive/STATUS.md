# PEM Hub — status

> **ARCHIVED — 2026-05-15.** Pending work lives in [`TODO.md`](../TODO.md).

_Generated 2026-05-14; Block A + Block C partial updated 2026-05-15. Non-binding. Historical snapshot only._

---

## Done (2026-05-15 — Verb 1 field session)

| Item | File(s) |
|------|---------|
| **`work_session` table** — draft / `pending_review` / apply path; RLS + grants (`supabase/sql/work_session.sql`) | migration SQL + `app/atelier/session/actions.ts` |
| **`tblImage` capture_meta + sha256** | `supabase/sql/tblimage_capture_meta_sha256.sql`; `addWorkImage` accepts optional metadata |
| **Field context (Verb 1)** | `lib/field-context.ts` + `GET /api/field-weather` — browser geolocation + Open-Meteo snapshot in `work_session.payload` |
| **`/atelier/session/new`** | `app/atelier/session/new/page.tsx`, `components/atelier/session/SessionNewClient.tsx` |
| **Drawer linked sessions** | `components/atelier/work-drawer/DrawerWorkSessionsSection.tsx` + `DrawerContent` |
| **E2E** | `tests/session-new.spec.ts`; hub launcher copy update |

---

## Done (2026-05-15 — Block C partial)

| Item | File(s) |
|------|---------|
| **`pipeline-shared.ts`** — `ProcessType`, étape/process statut types, `pipelineTypeLabel`, `TYPE_LABELS` / EN, colour maps, narrow MQ constant | `components/atelier/pipeline/pipeline-shared.ts` |
| **Pipeline imports** — `PipelineTab`, `ExhibitionsListPanel`, `ConceptCard` consume shared module instead of duplicating types/labels from `PipelineTab` | `PipelineTab.tsx`, `exhibitions/ExhibitionsListPanel.tsx`, `concepts/ConceptCard.tsx` |
| **`ExhibitionsTab` floor-plan UI** — removed dead `WallStrip` / `DefaultRoomSVG`; dropped orphan `dragOeuvreId` after handler removal (drag still sets `dataTransfer`) | `ExhibitionsTab.tsx` |

---

## Done (this session — Block B, UX & navigation)

| Item | File(s) |
|------|---------|
| **⌘K Command Palette** — tab jump, work/contact search, quick actions (New work, Export XLSX, Regen bible) | `components/atelier/CommandPalette.tsx` (new) |
| **6-room tab grouping** — Field · Studio · Catalogue · Commercial · Public · Admin; all tab ids preserved | `components/atelier/TeamPortalClient.tsx` |
| **`/hub` → thin launcher** — 4 tiles + CTA, zero DB queries; Overview is now the canonical dashboard | `app/hub/page.tsx`, `components/hub/HubLauncherClient.tsx` (new) |
| **Mobile bottom action bar** in WorkDrawer narrow mode — Add image 📷 + pipeline bump →, ≥44px, safe-area padding | `components/atelier/work-drawer/DrawerContent.tsx` |
| **LoadingShell + EmptyState** shared components — applied to AuditTab, ReportsTab zero-results, WorldMapTab pre-pins | `components/shared/LoadingShell.tsx`, `EmptyState.tsx` (new) |
| **`/c/[token]` bilingual** — `?lang=fr\|en` (default fr), all strings via `dict[lang]` | `app/c/[token]/page.tsx` |
| **`/works` SEO parity** — `metadataBase`, `openGraph`, `twitter`, `alternates` (canonical + language) | `app/works/page.tsx` |
| **`stock` tab label → "Fournisseurs / Suppliers"** — dict only, no id/file/migration change | `lib/i18n/dictionary.ts` |
| **Hub vs Overview decision** documented | `architecture.md` |
| **Concepts TODO** for deferred `concept_themes` junction | `app/atelier/concepts/_components/Concepts.tsx` |
| **Playwright smoke** for Command Palette | `tests/command-palette.spec.ts` (new) |
| **Block B keys** — all new i18n strings added FR + EN in one edit | `lib/i18n/dictionary.ts` |

Lint: clean. Build: clean (pre-existing `<img>` warnings unchanged). Real-app files synced from worktree.  
Worktree commit: `4d407f3`. **Not yet committed in real app** — pending review.

---

## To do

### Block A — agility (no user-visible behavior change)

- [ ] **A0** Regenerate Supabase types (`supabase gen types`) + remove remaining `as any` / `as unknown as` Supabase casts (Atelier actions, heavy tabs, public routes) — *partial 2026-05-15: `app/works/page.tsx` typed `works_modes` / legacy collections; `ThemesTab.tsx` has no `as any` as of 2026-05-15 sweep.*
- [ ] **A0'** Pre-Oct-30 GRANT audit (see §9 below) — run query, write remediation migrations for any gaps, add `🛂 SUPABASE GRANTS` block to `CLAUDE.md`.
- [x] **A1** Move `ExhibitionsTab` + `CurationPanel` client-side Supabase mutations to server actions — **`app/atelier/exhibitions/actions.ts`** + **`app/atelier/curation/actions.ts`** (already wired in tab code). *2026-05-15:* constellation graph reads + `tblrelations` edge insert/delete also moved to **`app/atelier/constellation/actions.ts`** (`fetchConstellationGraphBundle`, `insertConstellationRelation`, `deleteConstellationRelation`).
- [x] **A2** Switch `/works` from `force-dynamic` to RSC + `revalidateTag('portfolio')` called from `savePortfolioConfig` *(2026-05-15: `loadPortfolioSectionsCached` + tag on save; page still dynamic via `cookies()`).*
- [ ] **A3** Add R2 JSON optimistic-concurrency to `savePortfolioConfig` (etag or `updated_at` round-trip) — prevents lost edits when two browser tabs are open.
- [x] **A4** Sanitize RichEditor HTML server-side in `savePortfolioConfig` before R2 PUT (`sanitizePortfolioConfigForPersist`).
- [x] **A5** Replace silent `catch {}` with logged variant in `app/page.tsx` + calendar OAuth callbacks *(2026-05-15: also `selection/actions` PDF images, `works/actions` `r2SoftDelete`).*

### Block C — decomposition (largest files)

- [ ] **C1** `PortfolioTab.tsx` (~1 851 lines) → `PortfolioLandingPanel`, `PortfolioCollectionsPanel`, `PortfolioWorksManager` + thin orchestrator.
- [ ] **C2** `PipelineTab.tsx` (~1 877 lines; shared types in `pipeline/pipeline-shared.ts`) → `PipelineGanttView`, `PipelineDeadlineSidebar`, `PipelineRemindersPanel`. Also: add `AbortController` to `useEffect` fetches (stale-data risk on fast tab switches).
- [ ] **C3** `ExhibitionsTab.tsx` (~1 086 lines; list sidebar already `exhibitions/ExhibitionsListPanel.tsx`) → `ExhibitionStepsPanel`, `ExhibitionFloorPlanEditor` + thinner shell. *A1 server actions already shipped.*
- [x] **C4** Write `docs/CONSTELLATION.md` (purpose, user story, data model) before any further investment in the 3 003-line canvas — **doc in repo** [`docs/CONSTELLATION.md`](../CONSTELLATION.md); *2026-05-15* updated for server-side graph bundle + edge mutations.

### Deferred features (roadmap — no GO without decision)

- [ ] **F1** `/works` legacy mirror cleanup — sunset `works_collections` + `sections` fallback; fold into `works_modes`; remove PDF diagnostic log.
- [ ] **F2** Public-site staging (`?preview=<token>`) — blind editing of landing/about/practice; reuse private-link verification.
- [ ] **F3** Mobile capture-first quick-add route `/atelier/quick` — camera → vision draft → human confirm → soft-create.
- [ ] **F4** Saved searches / smart filter persistence in Inventory (`localStorage` per user + URL hash share).
- [ ] **F5** Per-collector "share kit" — one-click `/c/<token>` + printable PDF + enquiry CTA.
- [ ] **F6** Feature flags (`flags.json` alongside portfolio config in R2).
- [ ] **F7** Daily admin digest email — once transactional email lands (Resend/Postmark).
- [ ] **F8** Background job outbox — when server actions time out on PDF/geocode/broadcast at scale.
- [ ] **F9** Vision/OCR field capture — after mobile capture paths feel stable.
- [ ] **F10** Concept–Themes cross-link — `concept_themes` junction table + UI linking; see TODO in `Concepts.tsx`.

### Operations (time-sensitive)

- [ ] **O1** Pre-Oct-30 Supabase GRANT audit (deadline: 2026-10-30 for existing projects; May 30 for new). Run the audit SQL, write remediation migrations. See §9 in the rationalization plan.
- [ ] **O2** R2 access key rotation — document rotation date in `CLAUDE.md` Phase D.
- [ ] **O3** `broadcast` Bearer token rotation runbook → `docs/SYSTEM_LEDGER.md`.
- [ ] **O4** Quarterly DB backup recovery drill (next due: see [`docs/BACKUP_RECOVERY.md`](../BACKUP_RECOVERY.md)).

---

## Complexities

### Architecture
- **Single RSC spine** (`app/atelier/page.tsx`) is still a parallel `Promise.all` for all reference tables. First-chunk œuvres is paged; lookups (techniques, themes, junction tables) still ride the same round-trip → stale-blocks TTI on slow connections. Fix is per-table `cache()` + `revalidateTag()` (Block A).
- **R2-backed portfolio config** is a single JSON blob; no versioning. Two browser tabs editing simultaneously will silently lose one set of changes. Fix: etag/`updated_at` round-trip (Block A, A3).
- **Client-side Supabase mutations** in `ExhibitionsTab` + `CurationPanel` — **addressed** via `app/atelier/exhibitions/actions.ts` + `app/atelier/curation/actions.ts`. *2026-05-15:* `ConstellationCanvas` graph bootstrap + edge persistence moved to `app/atelier/constellation/actions.ts` (canvas file still large — Block C split remains).
- **`ConstellationCanvas` (~3k lines)** — [`docs/CONSTELLATION.md`](../CONSTELLATION.md) defines contract; server actions cover graph reads + `tblrelations` writes; module split still pending (C1-style decomposition).
- **Pipeline / exhibitions cross-imports** — label maps and process types now centralized in `pipeline-shared.ts`; full tab splits (C2/C3) still open.

### Security
- **Supabase GRANT change (May 30 / Oct 30 2026):** New tables need explicit `GRANT` + RLS + policies or PostgREST returns 42501. Existing tables enforce Oct 30. Must audit before then. See `docs/rationalization-plan.md` §9.
- **`dangerouslySetInnerHTML`** in `PortfolioTab.tsx` for RichEditor HTML — server-side sanitization exists in `savePortfolioConfig` (`sanitizePortfolioConfigForPersist`); keep PortfolioTab aligned if new HTML surfaces appear.
- **Many `as any` Supabase casts** remain across Atelier server actions and large client tabs (e.g. `PipelineTab`, `vault/actions`, `sales/actions`, `exhibitions/actions`) — schema drift is silent. Fix: Block A A0 (types regen + narrow table generics).

### UX / product
- **20 tabs → 6 rooms** is now in the sidebar (Block B done) but some room assignments are debatable (concepts + themes in different rooms could confuse). Validate with use.
- **Hub vs Overview:** decision made (Overview = dashboard, `/hub` = launcher), but the two surfaces have distinct UX audiences — verify the launcher tiles are the right entry points for non-daily users.
- **`themes` tab** is pure tag CRUD — low daily value as a top-level tab; candidate for demotion to a settings drawer (Inventory filter panel) in a future pass.
- **Bilingual sweep still open:** `lib/data.ts` status labels use a local `STATUS_LABEL_MAP` (intentional — can't import dictionary there); make sure any new surfaces that show status labels go through the map, not raw DB strings.

### Necessities (must not skip)
- Every new DB table: `GRANT select/insert/update/delete on public.<table> to authenticated; ... enable row level security; create policy ...` — per CLAUDE.md (to be added) and Supabase post-May-30 enforcement.
- EU R2 endpoint on every new R2 call: `https://<account_id>.eu.r2.cloudflarestorage.com` — no global endpoint.
- All user-visible strings: `useI18n().t(key)` in client components, `dict[lang][key]` in server components. No JSX literals.
- Mobile contract: 375px smoke before shipping any drawer/form change. ≥44px tap targets. Safe-area padding on sticky elements.
- Commit completeness: `git diff --stat` before every commit; stage all modified source files; exclude `.next/`, `tsconfig.tsbuildinfo`.

---

## Reference
- Full rationalization plan: `C:\Users\pppee\.claude\plans\rationalize-claude-md-read-roadmap-md-rippling-cook.md`
- Architecture audit: `architecture.md`
- Route inventory: [`SITE_MAP.md`](../../SITE_MAP.md)
- Pending work (current): [`docs/TODO.md`](../TODO.md)
