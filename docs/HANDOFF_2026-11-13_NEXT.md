# Handoff — next batch (owner requests, 2026-11-13 afternoon)

**State:** `main` 3 commits ahead of `origin/main` (docs ×2 + Journal date jump, What's new 3.1.3) — not pushed; push when Pem says. Description batch (Windows task "PEM describe batch", 14:00) running on the PC GPU; do not start GPU jobs until it ends (log: `%USERPROFILE%\.venvs\transcribe-out\describe-batch\run-*.log`).
**Rules:** `CLAUDE.md` (auto-loaded). Plan in one message, build in order, one commit per item, What's new 3.1.4 for the batch, checks once per batch. Credits are short: open only the files named.

## Order (owner)

### 1. See again → Link: type + direction (owner GO "yes build it + type choices")
**Built 2026-11-13 (verified against live code 2026-11-13, committed locally):** picker in `SeeAgainCard.tsx` (type select + ⇄ + Save / Cancel), `linkSeeAgainPair(from, to, type)`; checked on dev at desktop and 375 px (not saved — would write a real link). Constellation arrows: still to ask.
Today `linkSeeAgainPair` (`app/atelier/see-again/actions.ts`) always writes `proximity`. Wanted: pressing **Link** opens a small choice — type (close to · same series · painted on · derived from · answers · diptych · influence) + a ⇄ button to swap direction (#A → #B). Reuse `WORK_LINK_TYPES` (`lib/work-links.ts`), `addWorkLink` (`app/atelier/works/work-link-actions.ts`), labels `wl_<type>_out` (`lib/i18n/messages/work-links.messages.ts`). Component: `components/atelier/SeeAgainCard.tsx` (close slot). Owner also wants directed links to read as parent → child; **Constellation arrows** for directed types = separate, ask before (`components/atelier/constellation/constellation-draw-frame.ts`, `LINK_VIS`).

### 2. Inventory loupe (owner screenshot: "DOUBLE-CLICK pour agrandir l'aperçu" on the list thumbnail)
**Built 2026-11-13 (verified against live code 2026-11-13, committed locally):** `components/atelier/ImageLoupe.tsx` on the Inventory list + grid thumbnails; checked on dev at 1400×900 (hover, contained, gone on leave) and 375 px (long press full screen, tap closes, no drawer opened). Not done: double tap on the phone (a single tap already opens the work; would need a delay on every tap).
Intended as a loupe. Phone: double tap or long press on a thumbnail → picture almost full screen, tap to close. Desktop: hover (short delay) → picture as large as the screen allows, never cropped (`object-fit: contain`, use the free side of the screen). Today double-click only widens the drawer — "awkward". Find the tooltip key (grep `agrandir l'aperçu` in `lib/i18n`) → its component in `app/atelier/(portal)/inventory/_components/`. Use `imageUrl()` (full size) with the thumb as placeholder.

### 3. Batch modify (Inventory selection → Modifier)
**Built 2026-11-13 (verified against live code 2026-11-13, committed locally):** notes appended per work as `YYYY-MM-DD — text` on a new line (owner: "new line + date"), admin only as before; Period field (`periodChoice`: auto / none / id → `work_period_override`); dialog 960 px, 3 columns (1 on phones), price merged into the first grid, themes + groups side by side, sticky Apply bar. Checked on dev: opened, layout measured (content 1 153 → 1 047 px), not applied. Not done: "place it was made" as its own field — periods are the places today (Galway, Marseille…); a real place field belongs to the geo timeline (item 4 idea).
- **Comments must not overwrite:** append to existing `Commentaires` (new line + date?) — ask Pem the format in the plan message.
- **Too much dead space** in the dialog — compact it (owner's mixing-desk rule: dense, all fields visible).
- **Period + place in batch:** set a period override (`work_period_override`) and the place the work was made for several works at once (today only per work in the drawer, `WorkPeriodSourceSection`). Bulk edit lives in `app/atelier/selection/actions.ts` (status etc. admin only).

### 4. Periods by date, not by year (bug-level for Pem)
Today `work_period` has `start_year` / `end_year`; a work's period comes from its year (`lib/work-periods.ts` `periodYearOf`, SQL `oeuvre_search_text`). Pem returned to France on **2024-06-13**: 2024 works made before that are **Galway**, after are **Marseille** — a year cannot say that. Rework: periods get start/end **dates** (keep year-only working: a year = 1 Jan / 31 Dec), resolve with the work's production end date, else start date, else year. Migration: `start_on`/`end_on` date columns backfilled from the years; update `lib/work-periods.ts`, the manager panel (`PeriodSourceManager`), Inventory filter/column, `oeuvre_search_text` (SQL), Rapports field. Then set Galway end = 2024-06-12, Marseille start = 2024-06-13 with Pem.
Later (idea, owner): a **geo timeline** — periods as places over time, works gathered under them, findings / default setups per place. Plan only.

### 5. Conditions of making (question from Pem — answer, then plan)
"We can record location and weather — are we doing anything with that data? What about works without it?" To check before answering: where location / weather are stored (grep `field-weather`, `weather`, `latitude` in `app/atelier/session`, `lib/`, `work_session.payload`; `app/api/field-weather`). Answer plainly: what is recorded, for how many works, where it is shown/used (search? reports? nothing?). Then propose: show it on the work and the journal day, add it to search text, a Rapports field; for works without it: infer place from the period (item 4) and mark "inferred", never as fact.

### 6. Export dialog from the batch dock (desktop)
- **Fit vertically without scrolling**; options on one side, **preview on the other** (left or right).
- **Preview per module/document type**, faithful to the real output (layout, fit options, page format) — sample works allowed, like InDesign page previews / image-fit options. Means: render each export type (PDF portfolio, catalogue sheet, labels, CSV/XLSX table…) small, from the same code path as the real export. Find the dialog: grep the batch dock export component in `components/atelier/` / `app/atelier/selection/`.
- Owner: "a lot of learning to take from the Photoshop app layout" — panels docked at the sides, canvas in the middle, no modal scrolling. Propose a layout before building.

## Not done / open from earlier today
F5 collector share kit and F10 concepts ↔ themes (TODO "To build"); one plan for local reading AIs (TODO 1b); items 2–4 of TODO "To build" (staged photos warning, production dates).
