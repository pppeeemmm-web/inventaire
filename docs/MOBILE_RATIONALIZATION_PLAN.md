# Mobile Rationalization — Master Plan

Status: Phase 0 in progress. Verified against live code 2026-07-15.
Source analysis: ADMIN_GUIDE.md + TEAM_MEMBER_GUIDE.md (15 mobile workflows) + live code map.

## Findings TL;DR
- 15 documented phone workflows; 3 separate paths to "create a work", 3 paths to "store a document", 2 overlapping photo-ingest flows.
- 2 real defects in live code (silently lost images; approval bypass).
- Biggest structural problem: field flows exit into the desktop portal instead of returning to `/hub`.

## Phase 0 — Fix broken foundations

| # | Item | Where | Status |
|---|------|-------|--------|
| 0.1 | Bug: non-admin new-work images silently discarded. `res.pending` branch returns before staged `newImageFiles` upload; pending payload carries no files. Fix: explicit warning toast when pending save drops staged images. | `components/atelier/WorkForm.tsx:476-507` | done |
| 0.2 | Approval bypass: `addWorkImage` had no `is_admin` / pending gate. **Decision: Option A** — non-admins upload to R2 then queue an `image_add` pending_changes row (payload: filename + capture_meta + sha256); admin approve calls `commitWorkImage` (tblImage insert + cover/pipeline), reject soft-deletes the R2 objects. Migration `supabase/sql/pending_changes_image_add_kind.sql` adds `image_add` to the `change_kind` CHECK — **file only, not yet applied**. | `app/atelier/works/actions.ts` (`addWorkImage`, `commitWorkImage`), `app/atelier/(portal)/audit/pending-actions.ts` | done |
| 0.3 | Dead review path: `submitWorkSessionForReview` is a hardcoded-error stub still wired to a UI button. Remove both. | `app/atelier/session/actions.ts:1819`, `components/atelier/session/SessionNewClient.tsx:554` | done |
| 0.4 | Delete 3 unused `FieldToolStubPage` kinds (`session`/`documents`/`triage`); no-mode `/atelier/capture` redirects to `/hub`. | `components/atelier/FieldToolStubPage.tsx` (deleted), `app/atelier/capture/page.tsx` | done |

## Phase 1 — Navigation coherence
Status: 1–3 done, verified against live code 2026-07-15. 4 investigated only, no code changes — findings below revise the item's premise.
1. One rule: narrow-viewport flows return to `/hub`. WorkForm success does `router.push('/atelier')` → desktop overview (`WorkForm.tsx:508`). Fix: `narrow ? '/hub' : '/atelier'` everywhere; add `FieldHubBackLink` to WorkForm, WorkDrawer, IssueNewForm.
2. Remove ShareTriage redundant dual exit links (atelier + hub stacked) — keep hub only (`ShareTriageClient.tsx:332`).
3. Hub "session" tile: admins→capture, team→journal, identical look. Split into role-correct label/icon before tap.
4. Hub "More" legacy tiles push into desktop tab routes — drop or route to mobile-branched views. **Investigation finding:** all 4 (`inventory`/`overview`/`pipeline`/`contacts`) route through the shared `TeamPortalClient` shell (`(portal)/layout.tsx` → `AtelierTeamPortalLoader`), which already has narrow handling (`useAtelierNarrow`, mobile bottom action bar). Each tab's own content component also has a real `useMediaQuery('(max-width: 767px)')` branch (`Inventory.tsx`, `OverviewTab.tsx`, `Pipeline.tsx` via `ATELIER_NARROW_MQ`, `ContactsTab.tsx`). No drop/reroute needed — premise was stale.

## Pre-Phase 2 — Owner UX pass (2026-07-15)
- Owner on iPhone SE: Lightroom in-app open unusable. Real flow = capture inside Lightroom → export to camera roll → add via library picker on new/existing item. Removed Lightroom UI: session capture guide (`LightroomCaptureGuide` deleted), hub 🎨 tile + first-visit intro modal, share-triage hint. Kept: `lib/mobile/lightroom-return.ts` + triage return-session banner (reader intact, writer gone — re-add a writer if a future device restores the flow).
- Existing-work pickers made visual: session search results + share-attach work hits get 72px thumbnails + bold `#ID` + 2-line titles.
- **Mobile chrome rule (applies to every screen touched in Phase 2/3):** compact headers/menus; no stacked accordions or unfolding blocks eating the viewport; primary content visible on first screen at 375px; minimum chrome, maximum content.

## Phase 2 — Collapse duplicate processes
1. Work creation 3 paths → 1 engine — **done 2026-07-15**: `lib/work-create-core.ts` (`allocateOeuvreId` + `insertOeuvreRow`, provenance stamped inside) now backs all 3 Oeuvres inserts (`saveWork` insert branch, `createWorkFromSessionFields`, `createDraftWorkFromShareInbox`); per-path gates/defaults/Historique labels kept explicit at call sites. Dead export `createAndLinkWorkFromSession` removed; local `nextOeuvreId` removed. 2.1c also applied: `saveWork` create-time cover image goes through `commitWorkImage` (capture_meta `source:'work_form'` + sha256 + VAULT_UPLOAD log). Owner decision 2026-07-15: `NeedsPhotograph` is a MANUAL quality gate (diffusion-grade photo validated by the artist only) — removed `commitWorkImage`'s pre-existing auto-clear + auto-promotion to Disponible on image add (all flows: drawer, form, session, share, approval). Phone photos = journal reference images; the gate changes only via the explicit form/drawer checkbox.
2. Photo ingest: share-triage becomes canonical funnel. Keep single-image auto-redirect; merge "attach to existing" / "split to drafts" / "new work" into one triage panel with a work-picker.
3. Document storage: 3 entries (vault upload / doc-scan / COA) already converge on vault — add hub back-links + cross-links only.

## Phase 3 — Hub simplification (owner review before start)
Regroup 10 tiles + pulse + legacy accordion by verb: **Capture** (share/doc/card/scan-QR), **Work** (new/inventory/pipeline), **Business** (sale/COA/issue), **Review** (journal/pending/triage).

## Phase 4 — Approval flow ergonomics
- "Pending" badge on works with queued changes in drawer/inventory (today invisible until rejection).
- Sequence warning when multiple pending edits target the same work.
- After 0.2 decision: unify what queues vs what applies immediately (images, inline contacts currently mixed on one save).

## Phase 5 — Docs + verification (per phase, same change)
- Update `ADMIN_GUIDE.md` §9/§10/§24/§26 + `TEAM_MEMBER_GUIDE.md` step counts as flows shrink.
- Per phase: `npm run typecheck`, `npm run lint`, `npm run i18n:check`, `npm run test:e2e:field`; verify at 375px in real browser.

## Redundancy map (from docs analysis)
- Work creation: direct form / share-triage split / session new-item — 3 paths, re-entered context each.
- Photo ingest: share-inbox→attach-existing vs share-inbox→new-work — same attach UI twice.
- Document storage: vault upload / doc-scan / COA gen — converge on vault, no cross-links.
- Work edits: drawer save (queued for team) vs batch edit (immediate) vs session apply (re-stamps metadata).
- Work access: inventory search / QR scan / share-triage linked work.

## Step re-entry hotspots
1. Share→work chain forces re-entering title/image/ownership context per path.
2. Pending-changes approvals on same work invalidate later baselines; no sequence warning.
3. Inventory lazy-load: stats read loaded subset; export before full load = wrong totals.
4. Journal same-day consolidation window shows duplicates with no merge UI.
5. Mixed queue/immediate on single drawer save (contacts immediate, work fields queued).

## Owner decisions pending
- (b) Phase 3 tile grouping — proceed or keep 10-tile layout?

## Follow-ups (from 0.2 image_add gating)
- `Commentaires` append in `attachShareInboxToWork` (`app/atelier/share-triage/actions.ts`) is ungated for team — non-admin edits work Commentaires directly, bypassing pending_changes.
- `reorderWorkImages` / `replaceWorkImage` gating consistency — neither queues for non-admin like `addWorkImage` now does; decide if they should.
- `attachShareInboxFilesToWork` (`app/atelier/share-triage/actions.ts`) is an exported server action with no own `is_admin`/`is_team` check — currently only called from admin-gated `approvePendingChange`; audit before any new caller.
