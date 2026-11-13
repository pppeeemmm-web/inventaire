# Handoff — next batch (owner requests, 2026-11-13, reorganised evening)

**State:** `origin/main` = `bddc428` (deployed: A1 table tidy, Overview thumbnails, What's new 3.1.4). Local, not committed: this file, the design build handoff + mocks (`docs/design/2026-11-13/`), README + TODO lines. Push when Pem says.

## Order (readjusted 2026-11-13 after the design pass — Pem may reorder)
1. **B2 Batch modify** — Pem's sharpest complaint (said twice), mock ready, no decision needed. Place made left out until A3, then one row added. **Built 2026-11-13 (verified against live code 2026-11-13, committed locally, What's new 3.1.5)** — see the status under §3 of the design build handoff.
2. **B1 Overview** (+ shared `SignalMark`) — mock ready; D1 and D3 have safe defaults (D1 = the mock's rule, D3 = today's cash-health flag) until Pem answers. **Built 2026-11-13 (verified against live code 2026-11-13, committed locally, What's new 3.1.5)** — status under §2 of the design build handoff.
3. **A2 AI descriptions** with the usefulness slider (migration, drawer section). **Built 2026-11-14 (verified against live code 2026-11-14, committed locally; migration applied to the live DB 2026-11-14, What's new 3.1.6)** — status under §A2.
4. **A4 answer** (read only, no code) — what location/weather is recorded and for how many works; it decides what A3 can take from field sessions. **Answered 2026-11-14** — under §A4 (2 of 54 sessions, 5 works). Pem chose point 1 = automatic: **built 2026-11-14, committed locally** (What's new 3.1.6); points 2–5 wait for A3 / a GO.
5. **A3 periods by date + place per work** (migration) → then add **Place made** to Identity in batch modify (B2) and to the drawer. **Built 2026-11-14 (verified against live code 2026-11-14, committed locally; migration applied 2026-11-14, What's new 3.1.7)** — status under §A3.
6. **B3 Export** with live preview — biggest piece (preview engine); start only after Pem answers D2.
Then C (ask), D (housekeeping), E.
Why this order: the two dialogs Pem looked at and rejected come first; A3 goes after B2 so batch modify isn't redesigned twice (adding one row later is cheap); B3 waits on a decision.
**Rules:** `CLAUDE.md` (auto-loaded). Plan in one message, build in order, one commit per item, What's new 3.1.4 for the batch, checks once per batch. Open only the files named.
**Owner verdict 2026-11-13:** the batch-modify dialog "didn't respect the brief" — it was tweaked (narrower, 3 columns), not redesigned; dead space remains. Big layout surfaces now go through a design pass first (part B), then get built from that design, not tweaked.

---

## A. Build next (in this order unless Pem reorders)

### A1. Inventory table — nothing truncated or overlapping (owner screenshot, bug-level)
**Built 2026-11-13 (verified against live code 2026-11-13, committed locally):** `lib/format-price.ts` (compact / full), `StatusChip` + `WorkStateChip` `compact` (dot + label), title + medium 2-line clamp with hover, hover titles on period / contact / location / price; the table measures its pane — under 1100 px, dimensions + year and contact + location share a 2-line column (header has both sorts), so nothing runs off the right. Checked on dev at 1480 with the card open (list 823 px: no sideways scroll, 6 M € / 180 M € / 20 Md € in their column). Not checked: 1920 with the card closed and phone (browser pane hidden). What's new 3.1.4.
File: `app/atelier/(portal)/inventory/_components/Inventory.tsx` (header ~1815–1880, price cell ~1974).
Seen on desktop (~1480 px):
- **Price** overflows into Contact (`€180 000 000`, `€20 002 000 000` + lock icon over the contact name). → compact form above 4 digits with `Intl.NumberFormat(lang, { notation: 'compact' })` (fr: `180 M €`, en: `€180M`; thousands → `K`), right-aligned, `tabular-nums`, never wider than the column; exact amount on hover (`title`). Same helper for the pivot sums.
- **Title** and **Medium** cut after a few letters (`Buildi…`, `Huile · T…`). → 2-line clamp (rows are thumbnail-high, room for 2 lines) + full text on hover; medium gets the width freed below.
- **Status** column takes too much room (160 px + colSpan 2, large outlined badges). → compact chip (colour dot + short label, ~110 px), full label on hover.
- **Broadcast** header cut at the right edge (`Broa`). → fits once Status shrinks; otherwise icon header with label on hover.
- Rule for every cell: no text runs into the next cell; anything cut shows in full on hover. Check at 1280, 1480, 1920 px and that phones (cards view) are unchanged.

### A2. AI descriptions in the work's card, rated for usefulness (owner: "show them, but instead of accept/reject set a useful rating or a slider")
Data: table `work_description` (1,172 works, `supabase/sql/work_description.sql`): `body`, `echoes`, `verification` (default `unverified`).
- In the work drawer: a folded section "✦ Seen by AI" showing the description + the echoes line, clearly marked as AI.
- Instead of correct / wrong: a **usefulness** control — a 5-step slider (0 useless · 1 · 2 · 3 · 4 spot on), saved per work with who and when. Unrated = not yet judged.
- Migration: `usefulness smallint null check (0..4)`, `rated_by`, `rated_at` on `work_description`; team may update only those columns (explicit GRANT on the columns); `verification` stays for now.
- Use of the rating: rated 0 → left out of the search text; the average per prompt tells whether the prompt is worth re-running. Rapports field "AI description usefulness".
- Never copied into Commentaires.

**Status 2026-11-14 (verified against live code 2026-11-14):** built, committed locally.
- Migration `supabase/sql/work_description_usefulness.sql` — **applied to the live DB 2026-11-14** (Pem's OK); checked: 3 columns, 3 triggers, `UPDATE(usefulness)` the only team grant, AI text still in search. Adds `usefulness` (0–4, null = not judged), `rated_by`, `rated_at`; a BEFORE UPDATE trigger stamps who / when from `auth.uid()` / `now()`; team UPDATE policy + `grant update (usefulness)` only; `oeuvre_search_text` leaves out the latest description when rated 0; the re-index trigger now fires on update only when body / echoes change or the rating moves to / from 0.
- Drawer: `components/atelier/work-drawer/WorkAiDescriptionSection.tsx` (folded, after work sessions; nothing for a work never described). The same work can be open twice (Inventory side card + drawer): a rating reloads every copy (window event). AI badge + engine + date, body, echoes, 0–4 segmented control (44 px taps), clear, who / when, the prompt's average over rated descriptions.
- Actions: `app/atelier/works/description-actions.ts` (`getWorkDescription`, `rateWorkDescription`, `listDescriptionRatings`, paged past the 1000-row cap).
- Rapports: field `ai_usefulness` on Œuvres / Production / Ventes (loaded on demand; a failed load leaves the column empty).
- `lib/types/supabase.generated.ts` regenerated (`npm run gen:types`).
- Verified on dev 2026-11-14 in Chrome (admin, desktop): #2407 shows the section; rated 3 → "3/4 · Useful", stamped with the rater's name + date, prompt average 3 over 1 rated; cleared → back to not judged, both copies in sync, DB back to 0 rated / 0 stamped. Not checked: phone width, the Rapports column, a team (non-admin) rating.

### A3. Periods by date + place per work (bug-level for Pem)
Today `work_period` has `start_year` / `end_year`; a work's period comes from its year (`lib/work-periods.ts` `periodYearOf`, SQL `oeuvre_search_text`). Pem returned to France on **2024-06-13**: 2024 works before that are **Galway**, after are **Marseille** — a year cannot say that.
- Periods get start/end **dates** (`start_on` / `end_on`, backfilled from the years; a year alone = 1 Jan / 31 Dec). A work resolves by its production end date, else start date, else year.
- Update `lib/work-periods.ts`, `PeriodSourceManager`, the Inventory filter/column, `oeuvre_search_text`, the Rapports field. Then set Galway end = 2024-06-12, Marseille start = 2024-06-13 with Pem.
- **Place per work (owner):** "during a period I can be at one place, then another, then another" — the period is a span of time; each work also gets **the place it was made** as its own field. A small places list (name, town, country, optional coordinates), `made_at_place_id` per work, set in the drawer and in batch modify. A period may suggest a default place, never force it. Works without a place stay empty, never guessed. Works from a field session can take the session's recorded location.
- Later (idea, plan only): a **geo timeline** — places over time, works gathered under them.

**Status 2026-11-14 (verified against live code 2026-11-14):** built, committed locally.
- Live data first: 176 works carry a real day in `Année` (not 1 Jan); of the 114 works of 2024, 54 have a day — 23 before 13 June, 31 after. Today all 54 resolve to Marseille (except 6 set to Galway by hand). 641 of 1,182 works have no year at all.
- Migration `supabase/sql/work_period_dates_places.sql` — **applied to the live DB 2026-11-14** (Pem's OK): Galway 2022-01-01 → 2024-06-12, Marseille from 2024-06-13; 28 works of 2024 now read Galway in search; 206 works queued for re-indexing; no anon grant on the new tables. `work_period.start_on` / `end_on` (backfilled from the years; a trigger keeps `start_year` / `end_year` in sync), `default_place_id`; tables `place` (name, town, country, optional coordinates) and `work_place` (one place per work — its own table like `work_period_override`, so the team sets it without review; not a column on Oeuvres); RLS team + grants; re-index trigger; `oeuvre_search_text` resolves the period by day, else year, and adds "made in: …"; sets Galway end 2024-06-12 and Marseille start 2024-06-13 (Pem's dates in this brief); marks dated works for re-indexing.
- `lib/work-periods.ts`: `workWhen` (day = production end, else start, else `Année` when not 1 Jan; same rule as SQL), `autoPeriodFor` by day else year (latest start wins), `yearIsShared`, `periodRange` shows a day when the span is not whole years, `Place`, `placeLabel`.
- `PeriodSourceManager`: date fields, suggested place per period, places list (add / edit / delete with counts). Drawer `WorkPeriodSourceSection`: period "from its date", a yellow line when a year alone spans two periods, **Place made** select + the period's suggestion with "Use it" (never set by itself). Batch modify: **Place made** row (team allowed, like period). Rapports: `place_made`. Inventory period column/filter: by day.
- Verified on dev 2026-11-14 in Chrome (admin, desktop): #1959 (24 May 2024) → Inventory and card "Automatic: Galway · 2022 – 12 Jun 2024 · from its date" (was Marseille); Galway's date fields read 2022-01-01 / 2024-06-12; a test place created, set on #1959 (row + who; search "made in: …"), cleared through batch modify's Place made row, then deleted — DB back to 0 places; #2013 (2024, year only) shows the yellow "2024 spans two periods" line. Manager: Galway 103 works, Marseille 393. Not checked: phone width, a non-admin, the Rapports column.
- Not done: field-session location → place suggestion (A4 point 2), Inventory place column/filter, the geo timeline.

### A4. Conditions of making (Pem's question — answer first, then plan)
"We can record location and weather — are we doing anything with that data? What about works without it?" Check where it is stored (grep `field-weather`, `weather`, `latitude` in `app/atelier/session`, `lib/`, `work_session.payload`; `app/api/field-weather`). Answer plainly: what is recorded, for how many works, where it is shown or used. Then propose: show it on the work and the journal day, add it to search, a Rapports field; works without it may take the place from A3, marked "from the period", never as fact.

**Answer 2026-11-14 (read only, verified against live code + live DB 2026-11-14):**
- **What is recorded:** one snapshot per field session, only when someone taps "Capture location & weather" (folded in capture since 3.0.8): time, latitude / longitude (± accuracy), temperature, weather code, wind, humidity (Open-Meteo via `/api/field-weather`). Stored in `work_session.payload.field_context` (`lib/field-context.ts`, `lib/work-session-payload.ts`). No place name — raw coordinates only.
- **How much:** 2 of 54 field sessions (22 Aug and 23 Sep 2026, both Marseille 43.29 / 5.38). They touch 5 works (#2379–#2382, #2394). 72 works appear in any session; 1,182 works in all → the other ~1,177 have nothing.
- **Photos:** none. Uploads re-encode to AVIF and write only Artist / Copyright EXIF (`lib/image-upload.ts`), so any GPS in a Lightroom / phone export is dropped at upload. No other table holds coordinates for works (only `forest_pins`, the portfolio map layout).
- **Where it is shown / used:** only the journal (`SessionJournalTab.tsx` `FieldContextLede`: date, coordinates, °C, km/h — weather code and humidity unused). Not on the work, not in search, not in Rapports, not in the Overview.
- **Side finding for A3:** only 541 of 1,182 works have a year (`Année` or production start). A period by date can only place those; the other 641 need a hand-set period or place.

**Proposal (Pem's answers below each point):**
1. Root cause is capture, not display: 2 / 54. Either capture location once, automatically, when a session starts on the phone (asks permission once), or keep the tap but unfold it. **Pem 2026-11-14: automatic. Built (verified against live code 2026-11-14, committed locally):** `SessionNewClient.tsx` effect — phone width only, today's session only (never a past day), once per session, never over a saved snapshot, failures quiet; the button stays to retry by hand. `discardEmptyWorkSession` no longer counts location + weather as content, so blank journal days are still dropped. Not verified on a device: the dev account cannot capture and the pane denies location — check on the phone after the push (open today's session → the fold shows ✓, the journal day shows the line).
2. With A3's places list: match the session coordinates to the nearest known place (no outside call) → the session's works get that place as a *suggestion* "from the field session", Pem confirms. Works without it may take the period's default place, marked "from the period", never as fact.
3. On the work card (A3's Place made row): show "recorded on site — 22 Aug 2026, 29 °C, clear" when a session has it. Journal day: the place name instead of raw coordinates.
4. Optional, bigger: read GPS from the photo at upload, before the re-encode, into `tblImage` — every future phone photo would carry where it was taken. A new capture path → GO first.
5. Search / Rapports: not worth it at 5 works; revisit once capture is common.

---

## B. Design first — brief for Claude Design: `docs/DESIGN_BRIEF_2026-11-13.md`
**Design pass done 2026-11-13** — mocks in `docs/design/2026-11-13/`, build instructions in [`HANDOFF_2026-11-13_DESIGN_BUILD.md`](./HANDOFF_2026-11-13_DESIGN_BUILD.md) (build from that file, not from the lines below).
**Checked against the brief + live code 2026-11-13:** the design covers every block, field and export option of the brief, and already corrects the mock where live code differs (commission = yes/no, Format added, no "location notes", export tabs = the live layouts). Gaps the design handoff did not cover (now added to its §2–§3):
- Overview: Integrity, Local jobs and pending approvals are **admin-only** today (`OverviewTab.tsx` `isAdmin`). The design shows one 8-cell signal row; for non-admins the row has 6 cells (Integrity + Local jobs hidden, remaining cells keep their order), "Needs you" counts without approvals.
- Batch modify receives only `ids` (`CurationDock.tsx` → `BatchEditModal`). The selection strip (thumbs, techniques, years, status mix) needs the selected works: pass the rows `CurationDock` already has (it passes `oeuvres` to `ExportModal`), no new query. Theme/group `n/N` counts only if memberships are already in those rows, otherwise chips without counts.
- Batch modify `Format` label is hardcoded (`label="Format"`) → move to i18n while rebuilding.
- The mocks were not opened at 1280×800 by the design pass: check the fit on the first build screenshot, before polishing.
Three surfaces, each redesigned as a whole, then built from the approved design:
- **B1. Overview tab** — a one-glance dashboard: no scrolling, every block says OK or needs attention at a glance.
- **B2. Batch modify dialog** — all fields visible at once, no dead space (mixing-desk rule).
- **B3. Export dialog** (from the batch dock) — options on one side, a faithful preview of each export type on the other, fits the screen without scrolling (InDesign / Photoshop docked panels).

## C. Ask Pem first
- Constellation arrows for directed links (parent → child) — `components/atelier/constellation/constellation-draw-frame.ts`, `LINK_VIS`.

## D. Housekeeping
- Describe the 2 works the batch missed (#1636, #2357) once Ollama with `gemma3:4b` runs: `pwsh scripts/describe-run.ps1`.
- After this batch ships: measure speed (TODO).

## E. Still on the TODO, not this batch
F5 collector share kit · F10 concepts ↔ themes · one plan for local reading AIs (TODO 1b) · TODO "To build" items 2–4 (staged photos warning, production dates).

---

## Done earlier today (verified against live code 2026-11-13, pushed `5f10042`, deployed)
- See again → Link opens a type + direction picker (`SeeAgainCard.tsx`, `linkSeeAgainPair(from, to, type)`).
- Inventory loupe: hover on computer, long press on phone (`components/atelier/ImageLoupe.tsx`). Not done: double tap on phone (a tap already opens the work).
- Batch modify: notes appended per work as `YYYY-MM-DD — text` on a new line, Period field, 3-column dialog. Owner verdict: not a real redesign → B2.
- Journal date jump.
