# PEM Hub — status

_Generated 2026-05-14. Non-binding. Source of truth for current session work._

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
| **ConceptsTab TODO** for deferred `concept_themes` junction | `components/atelier/ConceptsTab.tsx` |
| **Playwright smoke** for Command Palette | `tests/command-palette.spec.ts` (new) |
| **Block B keys** — all new i18n strings added FR + EN in one edit | `lib/i18n/dictionary.ts` |

Lint: clean. Build: clean (pre-existing `<img>` warnings unchanged). Real-app files synced from worktree.  
Worktree commit: `4d407f3`. **Not yet committed in real app** — pending review.

---

## To do

### Block A — agility (no user-visible behavior change)

- [ ] **A0** Regenerate Supabase types (`supabase gen types`) + remove `as any` / `as unknown as` from `app/works/page.tsx`, `components/atelier/ThemesTab.tsx`, atelier loader.
- [ ] **A0'** Pre-Oct-30 GRANT audit (see §9 below) — run query, write remediation migrations for any gaps, add `🛂 SUPABASE GRANTS` block to `CLAUDE.md`.
- [ ] **A1** Move `ExhibitionsTab` + `CurationPanel` client-side Supabase mutations to server actions — `app/atelier/exhibitions/actions.ts` + `app/atelier/curation/actions.ts`. RLS stays as defense-in-depth.
- [ ] **A2** Switch `/works` from `force-dynamic` to RSC + `revalidateTag('portfolio')` called from `savePortfolioConfig`.
- [ ] **A3** Add R2 JSON optimistic-concurrency to `savePortfolioConfig` (etag or `updated_at` round-trip) — prevents lost edits when two browser tabs are open.
- [ ] **A4** Sanitize RichEditor HTML server-side in `savePortfolioConfig` before R2 PUT.
- [ ] **A5** Replace silent `catch {}` with logged variant in `app/page.tsx` + calendar OAuth callbacks.

### Block C — decomposition (largest files)

- [ ] **C1** `PortfolioTab.tsx` (1 772 lines) → `PortfolioLandingPanel`, `PortfolioCollectionsPanel`, `PortfolioWorksManager` + thin orchestrator.
- [ ] **C2** `PipelineTab.tsx` (2 054 lines) → `PipelineGanttView`, `PipelineDeadlineSidebar`, `PipelineRemindersPanel`. Also: add `AbortController` to `useEffect` fetches (stale-data risk on fast tab switches).
- [ ] **C3** `ExhibitionsTab.tsx` (1 403 lines) → `ExhibitionsListPanel`, `ExhibitionStepsPanel`, `ExhibitionFloorPlanEditor`. Combine with A1 (server actions) in one pass.
- [ ] **C4** Write `docs/CONSTELLATION.md` (purpose, user story, data model) before any further investment in the 3 003-line canvas.

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
- [ ] **F10** Concept–Themes cross-link — `concept_themes` junction table + UI linking; see TODO in `ConceptsTab.tsx`.

### Operations (time-sensitive)

- [ ] **O1** Pre-Oct-30 Supabase GRANT audit (deadline: 2026-10-30 for existing projects; May 30 for new). Run the audit SQL, write remediation migrations. See §9 in the rationalization plan.
- [ ] **O2** R2 access key rotation — document rotation date in `CLAUDE.md` Phase D.
- [ ] **O3** `broadcast` Bearer token rotation runbook → `docs/SYSTEM_LEDGER.md`.
- [ ] **O4** Quarterly DB backup recovery drill (next due: see `docs/BACKUP_RECOVERY.md`).

---

## Complexities

### Architecture
- **Single RSC spine** (`app/atelier/page.tsx`) is still a parallel `Promise.all` for all reference tables. First-chunk œuvres is paged; lookups (techniques, themes, junction tables) still ride the same round-trip → stale-blocks TTI on slow connections. Fix is per-table `cache()` + `revalidateTag()` (Block A).
- **R2-backed portfolio config** is a single JSON blob; no versioning. Two browser tabs editing simultaneously will silently lose one set of changes. Fix: etag/`updated_at` round-trip (Block A, A3).
- **Client-side Supabase mutations** in `ExhibitionsTab` + `CurationPanel` are an architecture rule violation (CLAUDE.md: domain mutations → `app/**/actions.ts`). RLS is the only gate today. Fix: Block A A1.
- **`force-dynamic` on `/works`** means every public visitor pays a cold render. Fix: Block A A2.
- **`ConstellationCanvas` (3 003 lines)** has no written spec, no tests, no purpose statement anywhere in docs. Blocking further investment.

### Security
- **Supabase GRANT change (May 30 / Oct 30 2026):** New tables need explicit `GRANT` + RLS + policies or PostgREST returns 42501. Existing tables enforce Oct 30. Must audit before then. See `docs/rationalization-plan.md` §9.
- **`dangerouslySetInnerHTML`** in `PortfolioTab.tsx` for RichEditor HTML — no visible server-side sanitization in `savePortfolioConfig`. Fix: Block A A4.
- **37 `as any` Supabase casts** across the app (6 on the public `/works` surface alone) — schema drift is silent. Fix: Block A A0 (types regen).
- **`ThemesTab` `as any` on static table names** — orphan symptom of stale generated types.

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
- Route inventory: `docs/SITE_MAP.md`
- Deferred work: `docs/ROADMAP.md`
