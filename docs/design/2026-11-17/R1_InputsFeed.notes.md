# Inputs → one feed (R1): design brief, 2026-11-17 (v1)

Design only, nothing built. Comes from a brainstorm with Pem on 2026-11-17 (this session). Inputs: TODO R1, [RETHINK](../../RETHINK_2026-11-14.md) (« How Pem works: inputs → outputs »), [TODO_NOTES#inputs](../../TODO_NOTES.md#inputs), [STRATEGY](../../STRATEGY.md) aims 1 (Trace) and 2 (Links). Sister design: phone « Aujourd'hui » (R2), [PhoneToday.notes.md](./PhoneToday.notes.md). A visual mockup was shown in the session (three phones: Journal, Idées, Kaizen); it predates the last refinements below and was not saved as a file.

## The problem, in Pem's words

- Inputs come in through too many doors and show in too many windows: Research / Concepts, Notes (voice), Reminders, « Idées brûlantes » on Overview, Kaizen, the Journal. « It's a bit of a mess really. »
- Two pyramids to reconcile: **creative vs business** input, and **artist vs team** input.
- Team members' creative input is **frequent and valuable** but lands anywhere: the bottom of a work's notes, a theme, Kaizen. Pem finds it by luck. Disciplining the team into the right channel has not worked, and Pem does not want to forbid editing work notes or themes: « I actually welcome it. »
- It is already noisy: complex concepts arrive faster than Pem has time to enter and understand them (« cold noise »).
- Goal: **fewer places to look**, everything « symbiotically running », and nodes popping up at the right time.

## The model

**Pem is the sorting node.** Everything that anyone else puts in reaches Pem in **one feed**, so nothing is missed.

| Place | Who writes | Who reads | What |
|---|---|---|---|
| **Journal** | Pem only | everyone (team can read) | Pem's notebook: writing, voice, photo, scan, dated reminders. A voice note is a Journal entry spoken instead of written — no separate « Notes » place. |
| **Idées** | Pem decides; team proposes | Pem (team read: to decide) | One kind of idea, two weights: **Petite** (a try, an observation: « try this maker's blue », « tonight's sky, because it was cold ») and **Recherche** (a subject to dig into: « the torus — what this geometry is, its implications for the practice »). Ideas and concepts are the same thing. |
| **Kaizen** | everyone | everyone | Business and system maintenance (the team's ops pyramid). |
| Work notes, themes | everyone, freely | everyone | About the work. Unchanged; creative bits written there reach the feed. |
| **The feed** | — (reads only) | Pem | Everything the team puts in, anywhere. Where all sorting happens. |

**The team's creative entry:** one button, « Proposer une idée » — one text box, optionally a work `#number` or a photo. It goes straight into the feed. It is the only dedicated creative entry for the team; text left elsewhere still reaches the feed.

**Team nudge:** when a team member writes more than a line in a work's notes, a small question: « Une idée pour Pem ? ». One tap flags it so it shows first in the feed. The text stays where it was written.

## Feed rules (Pem, 2026-11-17)

1. **Accepted by default.** What the team writes stands; the feed shows it to Pem.
2. **Pem flicks off** what he disagrees with → it is removed, and the team member who wrote it **may get a notification** (in-app; no email — transactional email is a non-goal without GO).
3. **Kaizen shows in the feed too**, « somehow » — its own section, so business and system items don't drown the creative ones.
4. From the feed Pem can also turn an item into an idea (Petite / Recherche) or link it to a work.
5. **Cooling:** items Pem leaves alone fold into « Refroidies » after a while (proposal: ~2 weeks) — still searchable, never deleted, no pile of guilt.
6. **The feed only reads.** Nothing is locked, moved or copied away from where it was written; nothing goes read-only.

**Gestures (Pem 2026-11-17):** two flicks on the phone.
- **Discard:** the item is rejected — the team member's text goes, the author is notified (see open question 3 for what « goes » means on a work's notes).
- **Remove from the list:** Pem has seen it; it stays where it was written and simply leaves the feed.
- **One global direction (Pem 2026-11-17): left = discard, right = remove from the list (keep)** — same as the Hub « Triage » deck today (left = reject, right = approve; `components/atelier/TriageDeckClient.tsx`, swipe threshold 72 px). Every swipe in the app follows it.
- **Undo toast** for ~5–6 s after each flick. **Nothing is lost:** every discard goes to a log and can be recalled; it only leaves Pem's view.
- **Desktop / laptop (agreed):** two small buttons on each row, plus ← / → keys that mirror the phone flick.

## Today's places this replaces (verified against live code + DB 2026-11-17)

- **Three separate triage places** — they serve different functions and **stay as they are in v1** (open question 7):
  - Hub **Triage** (`/atelier/triage`, `components/atelier/TriageDeckClient.tsx`, `app/atelier/triage/actions.ts`): swipe deck of **queued social post drafts** (`oeuvre_broadcasts`, `status = 'queued'`, admin only; reject deletes the draft) and **site enquiries** (`inquiry`, `status = 'open'`; approve / archive). It does not read anything from social media.
  - **Notes triage** (`app/atelier/(portal)/notes/_components/NoteTriagePanel.tsx`): voice note → work / concept / project.
  - **Share triage** (`/atelier/share-triage`, `share_inbox`): files shared from the phone → work / contact / concept / project.
- **Audit** (admin): non-admin edits to existing works go to `pending_changes` and wait for approval (review first) — the opposite of rule 1. See open question 2.
- **« Idées brûlantes »** on Overview = concepts with `energie = 5`. Today no concept has it (7 concepts; one at energie 3).
- **Kaizen** already counts entries others added since you last opened it (`kaizen_seen`: `user_id, scope, seen_at`) — the pattern the feed's « new since you looked » can reuse.

## Where the feed lives (agreed — Pem 2026-11-17: « Yes, Overview »)

Pem asked: « Where does my feed go then? Overview? » Overview today (`overview-dash.messages.ts`) is a board of signals: **Pour vous**, Catalogue, Intégrité, Échéances, Rappels, Argent, Tâches locales, Collection, each with a link elsewhere.
- **Desktop: the feed becomes Overview's main column**, growing out of the « Pour vous » signal that already exists. The other signals shrink to one compact strip above it (counts, one line each, links kept).
- **Phone:** Aujourd'hui (R2) shows the « À trier » count at the top; a tap opens the feed as the swipe deck, full screen. The Hub « Triage » deck stays as it is (open question 7: different function).
- **Team members, same place:** their « Pour vous » shows their own proposals and what happened to them (kept / discarded, with the undo window passed) — this is where the notification lands (open question 4).

## Effect on Audit (2026-11-17)

**Agreed (Pem):** Audit becomes **the ledger for the system** — the system log, plus the log of every discard with « Rappeler » (recall): everything is kept and can be recalled.

Still a proposal: where work-fact approvals go (below).

Audit today (admin only; Pem is the only admin, 3 linked users in all): two views in `app/atelier/(portal)/audit/_components/Audit.tsx`.
- **Pending** (`pending-actions.ts`): a team member's edit to an existing work waits for approval (`pending_changes`). The allow-list (`lib/work-pending-keys.ts`) includes the notes fields `commentaires`, `historique`, `historique_append` — so today **team notes on works are reviewed first**, the opposite of feed rule 1.
- **Ledger** (`actions.ts`): the system log (`system_log`), with admin delete. Version restore (`version-actions.ts`, `oeuvre_versions`) lives alongside.

Proposal:
- **Notes leave Pending.** A team note becomes a line (open question 3) that is live at once and shows in the feed.
- **The work's facts keep their approval** (title, year, size, price, status, location, buyer…), but the approval happens **in the feed** as its own section: same swipe, left = reject, right = approve. Pending stops being a separate place.
- Decisions happen in the feed; Audit is where you look back.

## Measured (live DB, 2026-11-17)

- Journal: 24 entries, **all by Pem** (22 imported `atlas` / `spark`, 2 voice); visibility all `team`.
- Team input inside the app, last 30 days: 1 Kaizen item by a non-admin (3 total), 4 `pending_changes` (2 approved, 2 rejected). Voice notes 10 total, concepts 7.
- AI link suggestions (`journal_entry_link`, `proposed_by = 'ai'`): 81 — 17 accepted, 64 rejected, 0 open.

The volume of team text measured in the app is low, while Pem feels a lot of noise → open question 1.

## AI

Kept, not deleted: suggesting and being rejected is its job, and the 64 rejections are a record of what « nothing to do with it » looks like. Pem rejects the ones that are unrelated. Direction: make it **quieter** — show only its most confident suggestions, tune with the rejections. It runs as batches on the studio PC (Whisper transcripts, local model via Ollama); results land in the DB, so team desktops run nothing. The feed works without AI.

## Open questions (for Pem)

1. ~~Where does the noise come from?~~ **Answered (Pem 2026-11-17):** mainly work notes and themes, « and other surprising places ». Doesn't change the design: Pem sorting everything in the feed is the answer. The feed must therefore read every free-text field a team member can write in, not only the obvious ones — list them from live code before building.
2. ~~Work edits~~ **Answered (Pem 2026-11-17):** a work's facts keep Pem's approval, now given in the feed (see « Effect on Audit »); notes become lines, accepted by default.
3. **Answered in principle (Pem 2026-11-17):** a discard only takes the item out of Pem's view; it is logged and can be recalled (see Gestures). For a work's notes Pem gave two shapes: **(a)** each comment is its own line on the work, identified as such (who, when), so one line can be discarded alone; or **(b)** each change makes a new version of the work that carries the earlier comments. **Chosen: (a) separate lines** (Pem 2026-11-17) — one comment = one line on the work, with author and date; a discard hides that line only, logged and recallable; the feed shows « A. added a line to #2357 ». Needs a new table (snake_case, RLS + explicit `GRANT`) → SQL GO; the existing single notes text stays readable until moved. (Rejected: (b) versions — `oeuvre_versions` snapshots the whole row, so undoing one comment would undo everyone's later changes.)
4. ~~Notification~~ **Answered:** in-app, in the team member's own Overview « Pour vous » (see « Where the feed lives »).
5. ~~Idées visibility~~ **Answered (Pem 2026-11-17):** the team reads Idées — « that's the point » — **and can annotate them**. An annotation is a line with author + date (same shape as work-note lines) and reaches Pem's feed under the same rules (accepted by default, left = discard). **So an idea can become a discussion** (Pem 2026-11-17): Pem and the team reply on the idea, one line each. Noise guard (agreed, Pem 2026-11-17): the feed shows **one item per idea** (« Le tore · 3 nouvelles lignes »), not one per line; Pem's own lines never enter his feed; Pem can **close** a discussion (it stays readable, no new lines).
6. ~~Weights~~ **Answered (Pem 2026-11-17):** Petite / Recherche kept. The 1–5 `energie` and « Idées brûlantes » read as urgency and put tension → replaced by **maturity, not heat: Graine · Pousse · Mûre** (just noted · being worked · ready to become a work session). No red, no counter on Overview.
7. ~~Merging the triages~~ **Answered (Pem 2026-11-17): they serve different functions — don't merge in v1.** Hub Triage = outgoing social drafts + site enquiries (commercial); Notes triage and Share triage = Pem filing his own inputs onto a work / idea / project. The feed is for **what others put in** (team text, « Proposer une idée », Kaizen, work-fact approvals); the three triages stay as they are, to look at again after the feed is lived with.

## Needs a GO before building

- Pem's GO on this design (and answers to the open questions).
- SQL, likely: an idea weight on `concept`; a seen / dismissed state per feed item (or `kaizen_seen` scopes widened); a flag for the team nudge; a team-member notification. Each new table: RLS + explicit `GRANT`.
- Moving « Notes » into the Journal day and retiring separate entry points touches R2 (phone sticky bar) — design them together.

## Build plan, R1 + R2 together (proposal, 2026-11-17)

Pem 2026-11-17: « start working on the two of them ». Order — no-SQL first, so the phone gets faster before the feed exists:

1. **Clean base.** Land what is waiting uncommitted in the main checkout (B13 / B14 fixes, these R1 / R2 docs) before any build; build in a worktree (`../app-wt-r1r2`, from `origin/main`).
2. **R2 · Aujourd'hui light route** (no SQL): a server-rendered phone page outside the Atelier shell — header, pulse line, « À revoir », works of the day, first entries from **one** server query; folds load on open. Measure against the baseline in [PhoneToday.notes.md](./PhoneToday.notes.md) (Speed › Baseline). Entry point today: `app/hub/page.tsx` (9 lines, `getFieldPulseData` + `HubLauncherClient`).
3. **R2 · sticky input bar** (no SQL): Écrire · Vocal · Œuvre · Photo · doc, replacing `MobileActionBar`; each sheet a small chunk preloaded after first paint.
4. **Shared swipe deck** (no SQL): one component, left = discard / right = keep, undo toast ~5–6 s; Hub Triage moves onto it unchanged in function.
5. **R1 schema — one migration, needs its own OK** (RLS + explicit `GRANT`, then `npm run gen:types`): note / annotation lines (target = work or idea, author, date, hidden / discarded state); idea weight (Petite / Recherche) + maturity (Graine / Pousse / Mûre) on `concept`; feed state per user + discard log (recallable from Audit); team proposals.
6. **R1 · the Fil**: Overview main column (desktop) + phone deck (Création · Fiches · Kaizen); team « Proposer une idée »; team « Pour vous » notifications; Audit gains the discard log with « Rappeler ».
7. Folding work-note text into lines, « Notes » into the Journal day, retiring « Idées brûlantes » — after 6 works, each with Pem's look.

Each step: one local commit, checks (`typecheck`, `lint`, `i18n:check`, `atelier:chrome:check`), 375 px look in a real browser, What's new at the end of the batch.

## Parked from the same session (not R1)

- **Theme notes:** `theme` has only `id, name`, so everything goes in the title (4 names over 40 characters, longest 166). Add a notes field so titles stay short → SQL GO.
- **A more human « What's new »:** the team doesn't read the list (too many updates, too complex, impersonal). Ideas: a « new » dot on the actual button that changed, with one plain sentence on first tap; or a 30-second voice note from Pem per batch. The list stays as the archive.
