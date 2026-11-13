# Handoff — 2026-11-13, for Opus

> **Status (Opus session, 2026-11-13, verified against live code 2026-11-13):** F, B, C, A, D, E built and committed locally (not pushed at time of writing). Open: owner OK for the first voice `--write`; owner's reading of the image test round 2; owner decisions on the unclear TODO items; G (small leftovers) not started. Archive this file once those are answered.

**From:** Fable session of 2026-11-13. **Owner:** Pem. **State:** `main` = `origin/main` = `33c06f2`.
**Owner's constraint:** credits are short. Build cheaply (section 0), in the order of section 2.
**Why any of this:** [`STRATEGY.md`](./STRATEGY.md) — trace → links and mapping → transmission → value. Rank by that.

## 0. Working cheaply (read first)

- `CLAUDE.md` is auto-loaded: do not re-read it. Do not re-audit: yesterday's findings are in this file, [`ARCHITECTURE.md`](./ARCHITECTURE.md) §7–8 and [`TODO.md`](./TODO.md) "App review, 2026-11-13".
- Per task, open only the files named under it. `grep` for a symbol before reading a whole file. Never read `ADMIN_GUIDE.md` / `TEAM_MEMBER_GUIDE.md` (1 800 lines each) or `SITE_MAP.md` in full.
- DB schema: one `information_schema.columns` query for the tables you touch — not `list_tables` verbose.
- One plan message for the whole batch, then build. Ask only where a task says **ask**.
- Checks once per batch, not per file: `npm run typecheck`, `lint`, `i18n:check`, `atelier:chrome:check`.
- One commit per task group (A, B, C…) with `scripts/commit-push-main.ps1`; push when Pem says. One What's new release for the batch (`3.1.1` → `3.1.2`).
- After a push: deploy poll in the background (`x-build-sha`). Skip the Chrome admin agent unless a task says "admin check" — it is the expensive step.
- No subagents unless Pem asks. No browser screenshots where `read_page` answers the question.
- The built-in browser pane is a non-admin dev user and hangs on "Chargement Atelier" when hidden (memory note `reference_browser_pane_raf_hang`).

## 1. What changed on 2026-11-13 (so you do not rediscover it)

- Signed-out visitors: no rights on `Contact`, `tblrelations`, `work_action`; 13 columns of public `Oeuvres` only. A public page needing another column must add it to the GRANT in [`anon_read_lockdown.sql`](../supabase/sql/anon_read_lockdown.sql) or it fails with `42501`.
- Work search text = title, comments, technique, support, year, themes (not code-named ones), period, sources, cover colours (`oeuvre_search_text`). All works indexed.
- `journal_entry` has `voice_note_id`, `source_key`, `engine` (fixed at insert). A voice note with a transcript cannot be deleted.
- `scripts/transcribe/`: `voice_batch.py`, `handwriting_test.py`, `describe_images_test.py`, `fetch_whisper_model.py` (run with `C:\Users\pppee\.venvs\transcribe\Scripts\python.exe`). Model `faster-whisper-large-v3` is on the PC.
- `npm run archive` → `C:\Users\pppee\PEM-Archive` (first full copy made). Weekly task script exists, **not registered** (Pem runs `pwsh scripts/register-archive-task.ps1` once).
- Headers: frame / nosniff / referrer. `/api/geocode` needs a sign-in.

## 2. Tasks, in order

### A. Sign out + password (owner request, new)

Found: **no `signOut` call exists anywhere** in `app/`, `components/`, `lib/`. A reset flow exists: `app/login/LoginClient.tsx`, `app/login/ResetPasswordClient.tsx`, `app/login/reset-password/page.tsx`; invites in `app/atelier/(portal)/contacts/team-actions.ts`.

1. **Sign out** for every signed-in user: one entry in the Atelier sidebar footer / user area (`components/atelier/TeamPortalClient.tsx`) and on `/hub`. Client: `supabase.auth.signOut()` then a full document navigation to `/login` (not `router.push` — middleware only redirects document requests). Phone: reachable, ≥ 44 px.
2. **Password for accounts that do not use Google**: check on the dev server that `/login` shows "forgot password" for an email account and that the emailed link lands on `/login/reset-password` and saves. Then add **Change password** next to Sign out (email accounts only; hide for Google-only users — `user.app_metadata.providers`). Fix what is broken; do not rebuild what works.
3. Copy through `t()`; What's new item; `SITE_MAP.md` auth rows.

**Done when:** a team member signs out from phone and desktop and lands on `/login`; an email account can request a reset and set a new password; a Google account sees no password option.

### B. Transcription from the app, not from a terminal (owner: "automation from the app seems handier")

Today: Pem must run `voice_batch.py --run --write` then the embed worker by hand. Wanted: no terminal.

- Reuse the existing pattern: Overview (admin) "Search indexing" card + `pem-embed:` protocol → `scripts/embed-run.ps1` (`scripts/register-embed-protocol.ps1`, `scripts/embed-worker/README.md`).
- Make `embed-run.ps1` run, in order: `voice_batch.py --run --write` (skips notes already done) → `npm run embed:worker -- --drain`. Rename the card "Local jobs" and show two counts: voice notes with audio and no transcript; nodes waiting for indexing. The phone cannot start the PC: the card there only shows what is waiting.
- Zero-click option, **ask Pem**: a scheduled task at sign-in + every 2 h that runs the same script (same style as `scripts/register-archive-task.ps1`).
- GPU: whisper large-v3 and the Ollama vision model do not fit together in 8 GB (measured: 160 s of audio took 416 s while the image test was running; 4 s with the tiny model alone). Run jobs one after another, never in parallel. Re-time large-v3 alone before quoting a speed.
- Journal day page (`components/atelier/journal/JournalDayExtras.tsx`, `app/atelier/(portal)/journal/entry-actions.ts`): an entry with `voice_note_id` shows its audio player and "✦ transcript · <engine> · unverified". Admin can mark it verified (`verification` is not in the append-only guard).
- Owner feedback on the first transcript: fine, apart from a few unusable characters — strip control / replacement characters (`\uFFFD`, C0 controls except newline) before insert. Pem dictates on Windows with his own OpenWhisper setup (Whisper Large, CUDA); that text arrives as typed text and needs nothing from us.
- One voice note with audio exists today (`6c8e59b2…`, 2026-08-08). `--write` has never been run: show Pem the list and get his OK before the first write.

**Done when:** Pem records a 🎤 voice note on the phone, clicks one button on the PC (or nothing, if the scheduled task is chosen), and the transcript appears on that journal day with its audio and the ✦ mark, and is found by ⌘K.

### C. Image description test, second round (owner asked to redo it)

First run (`C:\Users\pppee\.venvs\transcribe-out\describe\20261113-011802\`, `result.json` + `report.html`): 14 of 20 described, **6 errors** (read their `error` field first — likely timeouts under GPU contention), average 84 s per image (contended; not a real speed). Owner's reading: results vary a lot, some real findings, vocabulary repetitive and generic ("artwork, composition, abstract, dominant, appears, technique, visible, textured…").

Second round, **nothing written to the database**, GPU otherwise idle:
1. Fix the errors (longer timeout, check AVIF → JPEG conversion).
2. Prompt for observation, not art-speak: ask for concrete nouns and verbs — who or what is there, posture, gesture, objects, setting, light direction, how the marks are made — as short labelled lines (`figures:`, `setting:`, `light:`, `marks:`, `unusual:`). Ban the generic words above in the prompt. Give it what the catalogue knows (technique, support, title if any) so it stops guessing those.
3. Same 20 works, two or three prompt variants side by side in one report so Pem compares. Report real seconds per image.
4. Optional, **ask before any download**: a second vision model for comparison. Only models that fit 8 GB.

Pem judges. Only after his yes: a batch that stores descriptions apart from his own text (new column or table, marked AI + unverified, never in `Commentaires`) and adds them to `oeuvre_search_text`.

### D. "See again" card (owner asked how it would be built — build only on his GO)

Purpose: links come from seeing things again. No AI-written text; it only chooses what to show.

- **Where:** top of the Journal today page (phone and desktop) and Overview. One small card, three slots at most, the same all day (seed = the date).
- **Slots:** (1) *Then* — a journal entry whose `event_on` falls in this week of an earlier year; if none, one older entry by seed. (2) *Alone* — a work with no journal link and no hand-made relation (`influence`, `proximity`, `series`), by seed. (3) *Close* — for a seeded work, its nearest other work by embedding (`match_nodes()` in `app/atelier/search/actions.ts` already does this for search) where no relation exists between the two.
- **Actions:** open (work → drawer; entry → its day); on the *Close* pair: **Link** (writes a `tblrelations` row, type `proximity`, by Pem — a human link, not an AI one) or **Not related**; **Write about it** opens the entry form with `#number` prefilled.
- **Data:** one small table `see_again_dismissed (user_id, kind, a, b, at)` for "Not related" / hidden items (RLS own rows, explicit grants, nothing for anon). One server action returning the three slots. No cron, no queue.
- **Size:** one SQL file, one action, one component, i18n keys, What's new item.

### E. Earlier brief, still unbuilt

[`HANDOFF_2026-11-12_FIELD_UX.md`](./archive/HANDOFF_2026-11-12_FIELD_UX.md), owner's order: item 3 (contact pop-up over the drawer) → item 4 (`#1234` preview) → item 5 (Système tools cleanup) → item 1 (Production drag-back) → item 2 (✦ banner; open suggestions are 0 today, lowest priority). Plus, agreed in principle: **work ↔ work links from the drawer** ("painted on", "derived from", "answers" — `tblrelations`, see `JOURNAL_PROPOSAL.md` "Work or version").

### F. Docs tidy (owner request) — cheap, mostly moving text

1. **`TODO.md` → open items only.** Create `docs/DONE.md`; move every `[x]` block and the "Done (compressed)" section there, newest first, unchanged. For each remaining `[ ]`: verify against live code in one grep; if obsolete, move it to DONE.md under "Dropped" with one line why; if unsure, list it for Pem — **ask** once with the whole list, do not decide alone. Candidates that look obsolete: "Session flow follow-ups" (Lightroom-return loop; session is now inside the journal day), "Mobile rationalization 2.2 / Phase 3" (Hub rows changed 2026-11-12), "Idea: VAT per sale" (park under Roadmap), E2E note of 2026-07-30.
2. **Docs folder.** Move to `docs/archive/`: `AUDIT_2026-11.md`, `JOURNAL_PROPOSAL.md` (after copying its still-open points to TODO), `HANDOFF_2026-11-12_FIELD_UX.md` and this file once done, `MOBILE_RATIONALIZATION_PLAN.md` if 2.2 is dropped, `GRAPHIFY_NOTES.md`, `feature-graph.md`, `PROJECT_SYNTHESIS.md` (May; superseded by `ARCHITECTURE.md` + `STRATEGY.md`). Update `docs/README.md` table and the "Session bootstrap" line in `CLAUDE.md` (it still names the mobile plan as current workstream). Fix links that pointed to moved files (`grep -rn` the file names).
3. **Guides — recommendation: do not rewrite.** 3 600 lines, stale since May/July, and What's new already tells the team what changed. Put a dated banner at the top of both ("accurate to 2026-07; later changes: Kaizen → Nouveautés") and stop. A rewrite only if Pem asks; then a short task-based guide (one page per job on the phone), not an encyclopedia.
4. **Graphify — recommendation: do not re-run.** `graphify-out/` dates from 2026-05-24; it maps the code for an agent, and `ARCHITECTURE.md` + `SITE_MAP.md` now do that job at no cost. Re-run only if Pem wants the graph itself.
5. `SITE_MAP.md` (308 lines) — trim the changelog tail (section 10 "Recent doc sync" entries from May) into `docs/archive/`; keep routes.

### G. Small leftovers (take any that sit next to a task above)

- Overview reminder when `PEM-Archive` is older than 14 days (the PC writes `archive-info.json`; the site cannot read the PC — simplest: `archive-export.mjs` stamps a row, e.g. `system_log` event `ARCHIVE_RUN`, and Overview reads the latest).
- Security remaining ([`TODO.md`](./TODO.md)): `anon` write grants on other tables; `system_log` / `studio_task` policies to `is_team()`; content security policy in report-only mode; `xlsx` usage; missing `storage_object_ledger` table.
- Handwriting 10-page test: waiting for Pem's folder ("not now").
- Cold load: Pem is not convinced of the gain — measure one cold load of `/atelier/journal?today=1` before proposing anything (`lib/atelier/load-atelier-shell-props.ts` fetches Overview figures on every tab).

## 3. Verified / not verified at handoff

Verified 2026-11-13: lockdown (anon key refused on the four reads; `/works` 200 with 836 works); re-index (1 182 ok, 0 skipped); archive run (1 176 works, 2 587 image files); checks green at `33c06f2`.
Not verified: What's new 3.1.1 popup in a browser; `index.html` of the archive opened by a person; `--write` path of `voice_batch.py`; real handwriting; large-v3 speed alone.
