# Handoff — next batch (owner requests, 2026-11-13, reorganised evening)

**State:** `origin/main` = `5f10042` (deployed). Local `main` +1 docs commit, + this rewrite. Push when Pem says.
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

### A3. Periods by date + place per work (bug-level for Pem)
Today `work_period` has `start_year` / `end_year`; a work's period comes from its year (`lib/work-periods.ts` `periodYearOf`, SQL `oeuvre_search_text`). Pem returned to France on **2024-06-13**: 2024 works before that are **Galway**, after are **Marseille** — a year cannot say that.
- Periods get start/end **dates** (`start_on` / `end_on`, backfilled from the years; a year alone = 1 Jan / 31 Dec). A work resolves by its production end date, else start date, else year.
- Update `lib/work-periods.ts`, `PeriodSourceManager`, the Inventory filter/column, `oeuvre_search_text`, the Rapports field. Then set Galway end = 2024-06-12, Marseille start = 2024-06-13 with Pem.
- **Place per work (owner):** "during a period I can be at one place, then another, then another" — the period is a span of time; each work also gets **the place it was made** as its own field. A small places list (name, town, country, optional coordinates), `made_at_place_id` per work, set in the drawer and in batch modify. A period may suggest a default place, never force it. Works without a place stay empty, never guessed. Works from a field session can take the session's recorded location.
- Later (idea, plan only): a **geo timeline** — places over time, works gathered under them.

### A4. Conditions of making (Pem's question — answer first, then plan)
"We can record location and weather — are we doing anything with that data? What about works without it?" Check where it is stored (grep `field-weather`, `weather`, `latitude` in `app/atelier/session`, `lib/`, `work_session.payload`; `app/api/field-weather`). Answer plainly: what is recorded, for how many works, where it is shown or used. Then propose: show it on the work and the journal day, add it to search, a Rapports field; works without it may take the place from A3, marked "from the period", never as fact.

---

## B. Design first — brief for Claude Design: `docs/DESIGN_BRIEF_2026-11-13.md`
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
