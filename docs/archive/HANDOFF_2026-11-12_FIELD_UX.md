# Handoff — field UX batch (2026-11-12)

**For:** Claude Fable 5.2, taking over from the Opus session of 2026-11-12.
**Owner:** Pem. **Repo:** `C:\Users\pppee\Documents\Claude\Projects\Art db\app` (Next.js 15, React 19, Supabase `mcrzsxrcoexnlwmaunte`).
**State at handoff:** `main` = `origin/main` = `d108da3`, deployed (live `x-build-sha` checked). Nothing of this batch is built.
**Owner GO:** the five items below are agreed in principle ("plan this and hand over"). Still confirm the plan in one short message before the first edit, then build; ask again only where this brief says so.

## Rules you must follow (from `CLAUDE.md` + owner memory — read `CLAUDE.md` first)

- No edit without GO; confirm any **data** deletion first. Removing dead UI/code listed below is approved.
- All UI copy through `useI18n().t(key)`, keys in `lib/i18n/messages/*.messages.ts` via `defineMessages` (FR + EN together). No duplicate keys across modules.
- Phone = field terminal: verify at 375 px, taps ≥ 44 px, no sideways scroll. Mobile branch: `useMediaQuery('(max-width: 767px)')`.
- Every team-facing change → a What's new item (`lib/whats-new.ts` + `lib/i18n/messages/whats-new.messages.ts`), bump `WHATS_NEW_RELEASE` once for the batch (current `3.1.0` → `3.1.1`).
- Docs in the same change: `SITE_MAP.md`, `docs/TODO.md`, `docs/ARCHITECTURE.md` where relevant.
- Checks before any commit: `npm run typecheck`, `npm run lint`, `npm run i18n:check`, `npm run atelier:chrome:check`.
- Commit/push only when Pem asks: `& .\scripts\commit-push-main.ps1 -Message '…' -Paths @(…)` (`-NoPush` = commit only). Pass a new folder as a directory path.
- **After a push, everything runs in the background** (owner rule 2026-11-12): `pwsh scripts/release-truth.ps1 -Checks …` and the deploy poll (`curl -sI https://www.thepemworkshop.com` until `x-build-sha` = HEAD) as `run_in_background`; the admin check in **Claude in Chrome** (owner's admin login on the live site) as a background agent, look only, close its tabs. Skip the Chrome check when Pem says so.
- Status words exactly: local draft / committed locally / pushed to origin/main / deployed / verified.
- Built-in browser pane = localhost dev user (team member, not admin) and often hangs on "Chargement Atelier" when the session is not on screen; admin-only UI must be checked in Chrome after deploy.
- Terse replies. English with Pem.

## 1. Production board: drag a card back to an earlier column

**Owner's words:** works waiting to be photographed that he wants "to move back to first stage of production"; drag and drop instead of opening the drawer and changing status.

**Where:** `app/atelier/(portal)/production/_components/Production.tsx` (columns = `ActionColumn`, cards = `WorkCard`, data = `work_action` rows `done=false`, `markDone`, `addAction`).

**Behaviour (agreed):**
- Drop a card from column A onto column B = **move the to-do**: the pending A row is cancelled (not marked done — `markDone` has side effects: sets `Catalogué`, creates the Photograph to-do, changes `statusId`), and a pending B row is added (`addAction` upsert).
- Dropping onto **Catalogue** (action type id 9) is the rewind: also set the work back to not catalogued / in production (`Catalogué=false`, `statusId=1`; keep `NeedsPhotograph` as is). Check the other special ids in `markDone` (6 = Photograph, 9 = Catalogue) and keep forward moves on ✓ only.
- "Cancel" the A row: decide between deleting the pending row and a flag. Check RLS / grants on `work_action` for delete; if delete is not allowed or not wanted, **ask Pem** before adding a column.
- Desktop only (HTML5 drag and drop); phone unchanged. Show the drop target; optimistic update like `markDone`; `router.refresh()` after.
- Multi-select drag is not required.

**Done when:** dragging #2402 from Photography to Catalogue leaves it only in Catalogue, catalogued flag off, status "En production"; a reload shows the same.

## 2. Journal: ✦ suggestions bar for admins

**Where:** `components/atelier/SessionJournalTab.tsx` (day list + day page), `app/atelier/(portal)/journal/entry-actions.ts` (`listJournalSourceDays` already returns `proposals` per day — admins see "✦ n to review" on that day).

**Behaviour:** admins only: a bar at the top of the Journal tab — "✦ 29 suggestions to review" — with a button to the **oldest** day that still has open suggestions (today 2026-06-10, the Atlas import date). Use the existing `?day=` mechanism / `openDay`. Hidden when the count is 0 and for team members. Count = sum of `proposals` from `listJournalSourceDays()` (no new query needed).

**Done when:** as admin the bar shows the count and jumps to 10 June; after validating/rejecting all, it disappears.

## 3. Work drawer → contact as a pop-up (replaces the round trip)

**Background:** Kaizen #34 "improve bouncing between data types nodes — allow contacts to be opened straight from work drawer". Shipped in `d108da3` as navigation: ↗ in the drawer's Ownership fields (`components/atelier/work-drawer/WorkDrawerPipelineSection.tsx`, `onOpenContact`) → `DrawerContent.tsx` closes the drawer and pushes `/atelier/contacts?contact=ID&from_work=OID` → `ContactsTab.tsx` shows "← Back to work #N" (`backToWork`, key `contacts_back_to_work`). Pem: "it's kind of heavy … there must be a solution".

**Behaviour:** ↗ opens the contact **in a modal over the drawer**; the work stays open and unchanged underneath; closing the modal returns to the work with no reload.
- Reuse `components/atelier/ContactEditorPanel.tsx` (props: contact, addresses, emails, phones, websites, socials, roleOptions, isAdminUser, narrow, oeuvres, onUpdated, onDismissEditor, baselineEpoch, …). ContactsTab loads those child rows itself — add a small server action (or reuse an existing loader) that returns one contact + its child rows.
- Unsaved-changes guard inside the modal (`hooks/useUnsavedActionGuard.tsx` pattern, as ContactsTab does); the drawer's own guard is not triggered by opening the modal.
- After saving, refresh the drawer's contact name (`localContacts` in `DrawerContent.tsx`).
- Phone: full-screen sheet with safe-area padding, sticky Save.
- Remove the navigation path once the modal works: `from_work` handling + "← Back to work" bar in `ContactsTab.tsx`, key `contacts_back_to_work`, the `SITE_MAP.md` note. Keep `?contact=ID` (used elsewhere).

**Done when:** from a work's drawer, ↗ on the owner opens the card over the work, edit + save works, close → same work still open.

## 4. `#1234` work links: preview on hover (desktop) and on hold (phone)

**Owner:** anywhere a `#` + work number shows, preview the work without opening the drawer and coming back. Phone: **hold** (long-press) shows the preview — owner confirmed.

**Build one shared component** (e.g. `components/atelier/WorkRef.tsx`): renders `#1234` as today (click/tap opens the work as each place does now), plus
- desktop: hover (~300 ms delay) → small card: thumbnail (`thumbUrl()` / `WorkThumb`), title, year (`yearOf`), technique, status;
- phone: long-press (~450 ms, cancel on move/scroll, suppress the click that follows, no text-selection/callout) → same card as a bottom sheet or popover; tap elsewhere closes;
- data via the existing `fetchOeuvreById` (`app/atelier/works/actions.ts`) or the already-loaded catalogue when available; cache per id for the session.

**Replace the hand-made links** (grep `inventory?work=` and `?work=${`): `components/atelier/journal/JournalDayExtras.tsx` + `EntryText.tsx` (`#1234` in entry text), `components/atelier/SessionJournalTab.tsx` (day list `#2407` links), `app/atelier/(portal)/kaizen/_components/Kaizen.tsx`, `app/atelier/(portal)/notes/_components/NoteTriagePanel.tsx`, `components/atelier/ContactsTab.tsx`, `components/atelier/session/SessionNewClient.tsx`, `components/atelier/WorkForm.tsx`, `app/atelier/works/[id]/page.tsx`. Keep each place's click target.

**Done when:** hovering `#2407` in the journal list shows the card; on a 375 px touch emulation, holding it shows the card and a tap still opens the work.

## 5. Kaizen → Opérations & Stratégie → Système: site tools

**Where:** `components/atelier/SystemTab.tsx` (`tools`, rendered embedded in Kaizen-ops System view).

**Owner decisions:**
- **Remove** "✦ Download site map checklist (PDF)" — "tried but can't see the use". Remove the button, `handleDownloadChecklist`, and `exportSiteMapChecklistPdf` + its keys if nothing else uses them (grep first).
- **Remove** "Copy reference (Markdown)" and "Download reference (.md)" — "they don't work anyway". Likely cause: `app/atelier/system-reference-actions.ts` reads `docs/SYSTEM_LEDGER.md` from disk at runtime, and the deployed server bundle probably doesn't contain `docs/`. Don't fix; remove the buttons, the action file if unused elsewhere, and the keys. `docs/SYSTEM_LEDGER.md` itself stays.
- **Keep** "Regenerate Studio Bible" (also in the Hub and ⌘K). With one button left, no fold is needed.

**Done when:** the Système view shows the intro line, Regenerate Studio Bible, then + New entry / search / Live–Done.

## Order and wrap-up

Suggested order: 5 (small, removes noise) → 2 → 1 → 3 → 4. Commit per item or as one batch — ask Pem. One What's new release for the batch. After the push: background release-truth + deploy poll + background Chrome admin check (look only, never open `/atelier/session/new` without `?session=`), then report with exact status words.

## Other open work (not in this batch — don't start without GO)

- Journal step 4 transcription batches: owner instructions in [`TRANSCRIPTION_BATCHES.md`](./TRANSCRIPTION_BATCHES.md) (handwriting 10-page test, reminder 2026-11-13).
- Drawer photo too tall on phone (start ~40 % of screen, enlarge on tap) — proposed, not yet GO'd.
- Journal entries as Constellation canvas nodes — needs a canvas redesign, no GO.
- ⌘K on the live site can't embed a new query itself: it queues it until the embed worker runs on Pem's PC (`npm run embed:worker -- --drain`). Known; not in scope.
