# Vue d'ensemble — « coup d'œil » (design for Pem, 2026-11-23)

Now (verified against `main` 2026-11-28): **Built, on `main`:** `1f867fe` (« coup d'œil »: signal cards, compact Fil, the month calendar). The status line below is the original.
Status: **local draft**, not committed. Mockup beside it: [`OverviewGlance_Mockup.html`](OverviewGlance_Mockup.html) (example numbers; click a card, toggle « Le Fil vide / 4 lignes », 2000 / 1280 px, dark / light; phone at 375 px). Read: root `CLAUDE.md`, `BuildingPrinciples.md`, `OverviewTab.tsx` (all 822 lines), `overview-counts.ts`, `overview-business-actions.ts`, `OverviewFil.tsx` head, `R1_InputsFeed.notes.md` § « Where the feed lives ». **Not read:** the live screen (admin login; the 2000 px view is from Pem's screenshot only), `OverviewMine.tsx` body, `SeeAgainCard.tsx`.

Pem 2026-11-23: « you can see the same rows as the same columns. The at-a-glance doesn't really work. Maybe not a liquid grid, but you hover over a caption and it opens the drawer or something. »

## 1. Kind of thing · home · what changes

- **Kind:** a *read* — a view over counts that already exist. No record, no table, no door.
- **Home:** `/atelier/overview` (`OverviewTab.tsx`, `OverviewFil.tsx`); phone = the same component's narrow branch. Map §2: it lives with « the desk reads and connects ».
- **Changes:** layout only. Tiles and rail panels merge into **one signal each**; the detail moves from permanent side-rail panels into the card itself (**each card shows the rows that fit; click widens it in place, one at a time**); Le Fil is the fixed first column on the left; content cards share the liquid grid. **No SQL, no new action, no new read** (principles 5–7 untouched: every number below is asked once, as today).
- **Why no existing home fits better:** none needed — nothing new is stored.

## 2. What is wrong (seen in the code, not only on the screen)

| Today | Why it reads as « the same twice » |
|---|---|
| Strip tile **Pour vous 155** and rail panel **À traiter 155** | both = `needsTotal` (`OverviewTab.tsx:225`, `:562`) |
| **Catalogue 1946** and **Santé du catalogue 1946** | both = `gapTotal` (`:233`, `:565`) |
| **Intégrité** tile and the Intégrité row inside Santé | both = `conflicts.length` (`:241`, `:568`) |
| **Échéances** / **Rappels** / **Argent** / **Tâches locales** / **Collection** tiles and their panels | same counts (`:250–320` vs `:588–692`) |
| **Événements** tile and **Cette semaine** | events counted in the tile, drawn in the week |
| Le Fil in the middle | empty most days → the biggest area says « Rien à trier ici » |
| « Catalo… », « Collect… » | 11 tiles in `repeat(n, 1fr)` with ellipsis |

Also: every rail panel starts folded (a header and a count), so the rail is a second list of the same numbers with nothing in it.

## 3. The proposal

### 3.1 The signal cards (the mixing desk)

Nine signal cards (today's eleven tiles; Échéances and Événements move into the calendar §3.3b; Le Fil is the left column §3.3), in one fixed order, always the same (Pem): Pour vous · Rappels · Catalogue · Intégrité · Commandes · Argent · Collection · Tâches locales · Système. Admin-only ones stay admin-only.

A tile = mark + label + **the count once** + one micro-chart made of data the tile already has (no extra read):

| Tile | Micro-chart |
|---|---|
| Pour vous | 7 bars, one per row of `needsRows` |
| Rappels | 4 bars: en retard · aujourd'hui · demain · 7 jours |
| Catalogue | 8 bars = the 8 gaps (today's Santé bars, sorted) |
| Commandes | 2 bars: en cours · à envoyer |
| Argent | income bar vs expenses bar |
| Collection | the technique stack bar |
| Tâches locales | 3 pips: voix · index · âge de l'archive |
| Le Fil, Intégrité, Système | none (a number or « 0 ») |

Width: labels never truncate — a card has a minimum width that fits its label; the grid wraps before it ever ellipsizes.

### 3.2 Look, click, section (revised again after Pem, 2026-11-23: « no need for a preview if liquid; only one pane at a time »)

- **No hover preview.** The grid is liquid, so each card already shows as many of its own rows as its size allows (a small card: the count, its chart and one or two rows; a big screen: the card shows more). A floating preview would only repeat that.
- **Click:** the card widens in place (two columns × three rows, taken from its neighbours) and shows all the rows that fit, then « + n autres » and the actions the old panel had (✓ on a reminder, archive / index buttons). **One card open at a time** (this replaces « several at once »): clicking another card swaps; clicking the open card, or Esc, folds it.
- **Section:** only « Ouvrir l'écran → » inside the opened card (or a row inside it) leaves the page; same jumps and Inventory filter hand-offs as today.
- **No drawer, no sheet, no hover card.** No unsaved-changes guard needed (read-only plus one-tap actions).
- **Phone:** no hover anyway. A row's second line is what fits; tap opens the row in place (accordion) with the same rows and « Ouvrir l'écran ».
- **Calendar:** no day preview either; click a day = the agenda shows that day.

### 3.3 Layout: the left column (Le Fil + Calendar), then one liquid grid

Pem 2026-11-23 (second reply): several cards open at once was kept at first; later the same day Pem: « only one pane at a time » — see §3.2. Le Fil must stay on the left, but « cleverly »: an empty Fil column was dead space; and « a better use of the calendar than a week ».

- **Left column, fixed position, full height (340 px; 400 px when the Fil has lines).** It is two stacked blocks: **Le Fil** on top, *as tall as its content* (empty = one line « Rien à trier ici », four lines = four rows), then the **Calendar** takes all the height that is left. The column is therefore never empty and never dead; the Fil keeps its place (first, left) and simply costs what it holds. (A team member gets `OverviewMine` in the Fil's block.)
- **Right of it, one liquid grid** (`auto-fill, minmax(190px, 1fr)`, dense): the **9 signal cards** (Pour vous · Rappels · Catalogue · Intégrité · Commandes · Argent · Collection · Tâches locales · Système) and the content cards **Dernières œuvres** (as many thumbs as fit), **À revoir**, **Idées mûres**. Nothing in it repeats a count.

### 3.3a One screen, and no scrolling anywhere (Pem 2026-11-23, twice)

« No scroll inside the scroll. Whatever expanded it is. » The rule, in one line: **nothing on the page has a scrollbar of its own; each region shows what its size allows and says « + n autres » for the rest.**

- The page is exactly the window's height under the Atelier chrome (the current fixed layout already does this above 900 px wide). The grid is **liquid**: its columns follow the width, its rows share the height equally (`grid-auto-rows: minmax(84px, 1fr)`), so on a big screen the cards simply get bigger and show more.
- Every list is **fitted, not scrolled**: the agenda, each card's rows (collapsed or opened), Dernières œuvres' thumbs. A small helper measures the container and cuts after the last row that fits, adding « + n autres » (it leads to the section). No `overflow: auto` anywhere in the desk (checked in the mockup: 0 scrollable elements, with cards open and the month expanded).
- Opening a card (one at a time) takes two columns × three rows from its neighbours; the page does not grow; the card shows as many rows as fit, then « + n autres » and « Ouvrir l'écran → ».
- **Small screens** (under ~760 px of height) and the phone: the **page** scrolls, as today — and then nothing inside it scrolls either: the regions take their full height (agenda, lists complete). One scroll, never two.

### 3.3b The calendar — smallest by default, expands on demand (replaces « Cette semaine », *Échéances*, *Événements*)

Pem: by default minimized, « or at least the smallest format »; the month can expand to fit more data, 60 % of the screen is enough.

One calendar of everything dated, read from sources the page already loads — `overviewCalendarEvents` (every open deadline, no 60-day window, no cap), `overviewEventSpans` (multi-day events, from the same `suivi_process` select; `date_debut` added), the reminders list — **no new read**. `upcomingPulse` (8 items, 60 days) is no longer read by the Overview:

- **Smallest (default):** the left column is narrow and liquid (`clamp(250px, 17vw, 380px)`). Under Le Fil: a mini month (Monday first, 28 px rows) with up to 4 dots per day (◆ échéance, ● événement, ◔ rappel; today ringed), the chips Tout · Échéances · Événements · Rappels, then the **agenda fitted to the height left**: En retard · Aujourd'hui · Demain · Cette semaine · Plus tard, cut with « + n autres ». Click a day → the agenda shows that day.
- **Expanded (« ⤢ Agrandir »):** the column widens to **60 % of the screen**; cells carry **titles**, up to 4 per day then « +n »; an event longer than a day is shown on every day it covers, ▸ on the continuation days; the agenda is hidden (the month is the list); the cards on the right shrink to fit. « ⤡ Réduire » goes back. On a big screen there is room for both.
- **Events longer than a week** (a fair, a residency, a loan) are marked on every day they cover and listed once in the agenda from the first day (« 27 → 30 nov. ») while they run.
- **Rappels keep their own card** (Pem: « you need to have reminders somewhere »): the card owns the list and the ✓; the calendar shows rappels as ◔ marks only, and its agenda leaves them out unless the ◔ chip is on — the same row is never drawn twice.
- Month arrows ‹ › and « Aujourd'hui »; « Pipeline » leaves the page.

### 3.4 Gone

The right rail « Le reste », its « Tout ouvrir / Tout fermer » and the fold state, the signal legend in the header (the tally stays), the Événements tile (→ Semaine header), the Intégrité row inside Santé (→ own tile, as the strip already had it), the *second* copy of every count.

### 3.5 Phone face (same doors)

The phone branch already is « signal rows, worst first + tally + reminders ». Kept. Adds tap-to-open-in-place (3.2) and the cards stacked below (Le Fil first, Semaine, Dernières œuvres 4 × 2, À revoir, Idées). Taps ≥ 44 px. `/hub` « Aujourd'hui » is not touched.

## 4. Scenario Pem can check (mockup now; real screen after the build)

1. Open the mockup at « Écran 2000 px »: the desk is one screen, no page scrolling. Left: Le Fil on top, the month under it. Right: 9 signal cards + 3 content cards filling the rest.
2. Each card already lists what fits (Pour vous: two rows, Catalogue: its top gaps). Click **Catalogue**: it widens in place with all its rows; click **Rappels**: Catalogue folds, Rappels opens (one at a time). A long list ends in « + n autres »; nothing shows a scrollbar. Esc folds.
3. Calendar, smallest by default: click a day → agenda of that day; chips filter. Click **⤢ Agrandir**: the column widens, the days show titles, « Salon d'automne » appears on 27, 28, 29, 30. **⤡ Réduire** goes back.
4. **Rappels** card: open it, ✓ a reminder; the calendar's ◔ mark follows.
5. Toggle « Le Fil : 4 lignes »: the Fil block grows, the calendar gets shorter, the column keeps its place.
6. « 1280 px »: fewer grid columns, nothing truncated, still one screen.
7. Right phone: rows open in place on tap, worst first; under them the calendar as a list, then works and ideas; the phone page scrolls (as today).

## 5. Readers and count sources — all unchanged

Every number keeps its source (checked in `OverviewTab.tsx` and the scout map); only where it is drawn changes.

| Signal | Source today = after |
|---|---|
| Pour vous rows | `backlog.*` (`atelier-data-actions.ts` bootstrap: pending_changes, studio_task, kaizen_item, work_session), `needsPhotoValidation` / `notCatalogued` (`overview-counts.ts`, server read `getOverviewCatalogueCounts` or loaded rows), `biz.placeUnlinked` (`oeuvre_place_unlinked`) |
| Catalogue gaps, Collection | `computeOverviewCounts` (same function both sides) |
| Intégrité | `conflicts` prop (`fetchContactConflicts`) |
| Rappels card | `listUnreadSuiviReminders` (+ `markSuiviReminderRead` from the ✓) |
| Calendar, tally, phone rows | `overviewCalendarEvents` + `overviewEventSpans` + the reminders list; **one function** (`calStatus`, `OverviewCalendar.tsx`) gives « en retard · aujourd'hui », the ■ / ▲ of the tally and the phone's Échéances / Événements rows, so no two numbers can differ. A span already over counts only while the Pipeline still shows its end deadline (`skipDateFin`). Chip counts = every open item of the kind, overdue included (same as the Rappels card). Events are counted once: the chip « Événements » = the calendar items of that kind; the Commandes card no longer lists events. |
| Argent | bootstrap `expenseTotalTtc`, `salesIncomeTtc` |
| Commandes, Système | `getOverviewBusiness` (`getSidebarCounts`, `shipment`, `system_log`, `work_rule_run`) |
| Tâches locales | `useLocalJobs` (`embedding-status-actions.ts`) |
| Le Fil | `listFil()` inside `OverviewFil` — the tile count is **lifted from that same read** (a callback with `live.length`); no second `listFil` |
| Idées, À revoir, Dernières œuvres | bootstrap `burningConcepts`; `getSeeAgain`; loaded `oeuvres` |

**Other readers to re-check at build (Flow):** `TeamPortalClient.tsx:1504–1506` (props, unchanged), the phone branch of the same file, the sidebar badges (separate code, untouched), `/hub` Aujourd'hui (not this component). **E2E that name the old structure and must follow:** `tests/atelier-overview-bootstrap.spec.ts`, `tests/note-lines-overview.spec.ts` — ids `overview-side-rail`, `overview-panel-fold-*`, `overview-side-toggle-all`, `atelier-overview-executive`, `overview-reminders` and `overview-reminder-done` (stay on the Rappels card's opened list), `overview-embedding-index`, `ov-panel-*`, `atelier-field-reminders` (the phone action bar scrolls to it, `TeamPortalClient.openFieldReminders`): keep the last three ids on the opened card / phone list so the action bar and reminder test still work. Copy: the new strings (peek hint « + n autres — cliquez », « Ouvrir l'écran ») go in `overview-dash.messages.ts` FR + EN; `i18n:check` holds it.

## 6. Settled by Pem (2026-11-23)

One opened card at a time, no hover preview (liquid cards show what fits) · Le Fil always the left column, no dead space · one fixed order (phone: worst first) · no Journal in the Overview · Rappels keep a card · the calendar is a month that expands, **60 % of the screen is enough** · content cards = Dernières œuvres, À revoir, Idées mûres · one screen, vertical scroll limited (page scrolls below ~760 px height: « of course » — but never a scroll inside a scroll) · the liquid grid is a means, not a principle.

**What is dated, in the calendar (Pem: « a maximum, but is it necessary, is it useful? »).** Rule: a thing earns a mark when it has a date you must act on or be at, and nothing else on this page already says it.
- **First build (no new read):** échéances, événements (exhibitions are already events), rappels as marks.
- **Next, one read each, to add only if the date exists in the source (not checked):** shipments to send (Logistique), loans due back (`work_order` loan end), payments due. They are « act by this date » things, so useful; each is its own small ask after the first build.
- **Not added:** anything whose date only informs (a sale's creation date, a work's year).

## 7. Not done / not verified

Mockup run in the built-in browser pane: clicks checked by script (a card widens, opening another folds the first, 0 scrollable elements; month expands to 15 labelled marks; no console errors); screenshot looked at in a ~790 px pane only — not at 2000 px by eye, not on a phone, not against the live admin screen. Whether today's bootstrap holds a full month of events / deadlines is not checked. Example numbers are invented except Pour vous 155 / Catalogue 1 946.

## 8. As built (2026-11-23, after the lead's flow review)

- Left column: Le Fil shows its per-section counts (Création · Fiches · Kaizen) and a « Refroidies n » toggle that swaps the list for the cooled lines; ←/→/↑/↓ act only on rows the height shows (`FitList.onFit`); the count resets when the Fil leaves.
- Calendar: « Pipeline → » is always visible (status line); the Rappels card carries `id="atelier-field-reminders"` on the desk too; the money card's tooltip is the BNC note; the local-jobs card has no « Ouvrir l'écran ».
- Phone: Échéances and Événements rows are back (a tap jumps, as before); the agenda lists today first, then overdue (nearest first), then what is coming.
