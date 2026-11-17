# Timeline + map + previews (R4): design brief, 2026-11-17 (v1)

Design only, nothing built, no SQL run (reads only). Inputs: TODO R4, [TODO_NOTES#previews](../../TODO_NOTES.md#previews), [RETHINK](../../RETHINK_2026-11-14.md) (piece 3 « Timeline + map extension + previews »), [STRATEGY](../../STRATEGY.md) aim 2 (links between nodes) and aim 1 (trace), [CONSTELLATION](../../CONSTELLATION.md), [WORK_CUSTODY_MODEL](../../WORK_CUSTODY_MODEL.md) (where works are). Sister briefs: [R1_InputsFeed](./R1_InputsFeed.notes.md), [PhoneToday](./PhoneToday.notes.md) (R2, the day), [R7_Orders](./R7_Orders.notes.md) (works leaving). Mockup next to this file: [R4_TimelineMap.mockup.html](./R4_TimelineMap.mockup.html) (desktop « Création » with Rutali selected, three 375 px phones — map, vertical « Temps », Notes « Trier » with the loupe — and the preview rule before → after; real works, real places and real counts; « Où elles sont » mode not drawn).

## The problem, in Pem's words

- RETHINK 2026-11-14: « Timeline + map extension + previews » is one of the five big pieces.
- TODO R4: a **timeline map** / a map « **Création** » mode; **`#1234` thumbnail + loupe everywhere** — Notes triage shows « #2357 · Les mortes marguerites » with neither (Pem 2026-11-15); a **title next to the number** in the AI suggestion rows (« thumbnails OK? », Pem's annotated mockup 2026-11-14).
- Mission: trace, **links between nodes and insight**, transmission, valuing the oeuvre. Time and place are the two links every work already has — they are just not shown.

## What each screen is for (inputs → outputs)

**1. The timeline — « when ».** One view of the practice over time.
- **Inputs (already in the app, nothing new to type):** each work's date as precisely as it is known (day / month / year, or only its period) · the periods (Waterford, Tooreeney, Marseille…) · work sessions (field and studio) · Journal entries and notes · « Création » lines (started / worked / resumed / finished, with a place) · works leaving (gifts today; sales, deposits, loans from R7) · custody moves.
- **Outputs:** seeing the rhythm of the work (what was made when, and around what: sessions, notes, ideas); jumping to a day (opens « Aujourd'hui » on that day, R2) or a span (opens those works in Inventory / Constellation / on the map); spotting the gaps — works with no date, a period with no notes — so the trace gets completed (aim 1).

**2. The map « Création » — « where made », next to « where now ».**
- **Inputs:** each work's place of making (its « Création » lines' places, else its period's atelier — `effectivePlace`, already the rule in the work card) · the 8 `place` rows (with coordinates) · field-session GPS (suggestion only) · where each work is now (custodian + address, custody model).
- **Outputs:** the geography of the oeuvre — Pem's route Waterford → Tooreeney → Marseille, the field places (Rutali, Lac du Peiroo…); for a work that left: from where it was made to where it is now (provenance, aim 4); a selection of works by place to open elsewhere.

**3. The preview rule — « which work is this? ».** Not a screen: a rule for every screen.
- **Input:** a work number shown anywhere.
- **Output:** you recognise the work without opening it — a thumbnail and a title next to the number, the picture large on hold / hover. 912 of 1,176 works have **no title** (measured), so the number alone says nothing; the thumbnail does the recognising.

## Measured (live DB, read-only, 2026-11-17)

| What | Count |
|---|---|
| Works (not deleted) · with an image | 1,176 · 1,174 |
| Works **without a title** | **912** (78 %) |
| Works with a year (`Année`) | 597 — 1999: 1 · 2000: 1 · 2020: 24 · 2021: 25 · 2022: 44 · 2023: 27 · 2024: 115 · 2025: 155 · 2026: 205 |
| Works with no year | 579 — of which 559 are placed in a period by hand (`work_period_override`: Tooreeney 556, Waterford 2, Marseille 1) |
| Works with a real day (production dates or a day in `Année`) | ~210 |
| Periods (`work_period`, each with its atelier) | 4: Youth 1997–2000 · Rebirth – Waterford Dec 2019 – 5 Dec 2021 · Tooreeney 6 Dec 2021 – 12 Jun 2024 · Marseille 13 Jun 2024 – |
| Places (`place`, all with coordinates) | 8: Marseille Atelier, Tooreeney Atelier (Whitegate, IE), Waterford Atelier, Rutali, Paris, Aureille, Les Baux-de-Provence, Lac du Peiroo |
| « Création » lines (`work_creation_step`) · with a place · dated | 57 · 11 · 46 (Rutali 9, Marseille Atelier 1, Lac du Peiroo 1) |
| **Where made**, resolved by today's rule (approx., SQL copy of `effectivePlace`) | Tooreeney Atelier **648** · Marseille Atelier **458** · Waterford Atelier **51** · Rutali 9 · Lac du Peiroo 1 · unknown 9 |
| …of which from a place of the work's own (a « Création » line) | **11** — the other ~1,156 only through their period's atelier |
| Work sessions · with GPS (`payload.field_context`) | 56 (May → Nov 2026: 4 · 10 · 9 · 16 · 10 · 2 · 5) · 3 (all at Marseille) |
| Journal entries (visible) | 20 (18 in June 2026) · voice notes 10 |
| **Where now**: at Pem (Atelier · Principal) | 1,169 (139 · 1,030) — same street in Marseille |
| …away from Pem | **7**, all gifts: Bastia, Spain (country only), Marseille ×2, Lausanne, Istres, Rutali |
| Gift / move dates | none stored (no `fate_on`, `DateStatut`, `DateLivraison` on the 7 gifts); custody history only exists since the first `oeuvre_versions` row, **2026-05-12**, and records when the row was edited, not when the work moved |

So: **« where made » is known for almost every work, but coarsely** (the atelier of its period); **« where now » is Marseille for 99 %**. The interesting map is the « Création » one. Dates are the weak link: half the works have no year.

## Today's map — what exists

_Verified against live code 2026-11-17_ (worktree HEAD `fb702c6`, which is on `origin/main`; also checked `origin/main` `b27bcd0` for the R1 6.4b files).

### Map tab (`/atelier/map`, Commercial group)
- `app/atelier/(portal)/map/page.tsx` → portal tab `map` → `components/atelier/team-portal-segment-panel.tsx:205` → `components/atelier/WorldMapTab.tsx` (Leaflet in `WorldMapInner.tsx`).
- Two modes: **Contacts** (pins by city of `contact_addresses`, else `Contact.Ville/Pays`, coloured by role) and **Œuvres** (works grouped by city). Chip filters: role / country (contacts), status / theme / technique (works).
- Every pin is **geocoded by city name at runtime** (`/api/geocode`, cached in `localStorage` `pem_geo_cache`), then jittered ±0.004° at random. The `place` table's coordinates are **not used**.
- **Œuvres mode places a work at its custodian's `Contact.Ville`** (`WorldMapTab.tsx:489–495`: `LocalisationID` → `ContactID` → Pem 13), **ignoring the work's address** (`localisation_address_id`, custody model). Found: **#1653 « Maroselli »** is at its custodian's « Rutali » address but the map shows it in **Marseille** (that contact's card city). With 1,169 of 1,176 works at Pem, Œuvres mode is one Marseille pin and six others.
- It reads `oeuvres` from the Atelier shell (`team-portal-segment-panel.tsx:210`), i.e. the loaded batch, not necessarily the whole catalogue (CLAUDE.md: first paint loads the first keyset chunk).
- No time: no date filter, no period.

### Where « where made » already lives
- `lib/work-periods.ts`: periods by date, each with its atelier (`default_place_id`); `place` rows with lat / lng and validity dates; « Création » lines (`work_creation_step`, kinds started / worked / resumed / finished, a place, a session); `effectivePlace()` = last line's place, else the period's place; `routeOf()` = the places of the lines in order (« Tooreeney → Marseille Atelier »); `nearestPlace()` within 2 km turns a session's GPS into a suggestion.
- Shown only **inside one work's card** (`components/atelier/work-drawer/WorkCreationHistory.tsx`) and on the phone record (`WorkRecordPhone.tsx`). Inventory filters by period / place (search bag `Inventory.tsx:760`). No screen shows them across works.
- `forest_pins` (4 rows, `portfolio/forest-pins-actions.ts`) = positions for the public site's forest layout — not geography.

### Where « when » already lives
- **Journal** day view (desktop) and **« Aujourd'hui »** on the phone with ‹ › days and `?day=` (R2, `components/hub/TodayClient.tsx`): one day at a time.
- **Constellation** can group by year (`GroupBy = 'year'` in `constellation/constellation-shared.ts`) — a layout, not an axis.
- **Pipeline** has a Gantt for processes (`components/atelier/pipeline/PipelineGanttChart.tsx`).
- The **public site** has a « timeline » works layout (`components/public/works-layouts/WorksTimelineLayout.tsx`, horizontal, bucketed by year).
- Nothing in the Atelier puts works, sessions, notes and moves on one time axis.

### The `#1234` preview today
- **`components/atelier/WorkRef.tsx`**: `#id` link; hover ~300 ms (desktop) or hold ~450 ms (phone) → a small card (96 px thumbnail, `#id` + title, year · technique, status) from `fetchWorkPreview` (`app/atelier/works/preview-actions.ts`, 3 queries per work, cached per session). Tap / click still opens the work.
- **`components/atelier/ImageLoupe.tsx`**: on a thumbnail, hover ~350 ms / hold ~450 ms → the picture as large as the screen allows. Used in Inventory (`WorkThumb` 40 px), Overview, `SeeAgainCard`, `SessionJournalTab`.
- So there are **two gestures with two results**: hold a number → a small card; hold a picture → the big picture.

**Where a work number shows** (grep `#{` / `#${` in `.tsx`, work ids only; contact / expense / order ids left out):

| Place | File | Today | Thumb | Title | Preview |
|---|---|---|---|---|---|
| Notes triage, linked work + work picker | `notes/_components/NoteTriagePanel.tsx:165`, `:190` | « #2357 · Les mortes marguerites » plain text | — | ✓ | — |
| Notes list labels | `notes/_components/Notes.tsx:64–66` | title, else `#id` | — | ✓ | — |
| Journal day: works of the day, ✦ rows, Kaizen works, changes | `journal/JournalDayExtras.tsx:355`, `:377`, `:584`, `:635` | `WorkRef` | — | ✓ (✦, changes) / — (Kaizen row) | card |
| Phone Aujourd'hui ✦ rows | `hub/TodayClient.tsx:299–315` | 44 px thumb + `#id` + title (R2) | ✓ | ✓ | — (plain `Link`, no hold) |
| Phone Aujourd'hui « Attributs modifiés », « Création » folds | `hub/TodayClient.tsx:371`, `:408` | plain `#id` link (+ title in the first) | — | ½ | — |
| Phone Aujourd'hui works of the day / À revoir | `hub/TodayClient.tsx:66` `WorkChip`; `SeeAgainCard.tsx:248` | thumb + `#id` + title | ✓ | ✓ | loupe in `SeeAgainCard` only |
| Fil (phone) · Fil on Overview · « Pour vous » | `hub/FilClient.tsx:215`; `overview/OverviewFil.tsx:205`; `overview/OverviewMine.tsx:72` (on `origin/main`) | 44 / 36 px thumb + `#id` + title; « Pour vous »: ` · #id` only | ✓ / ✓ / — | ✓ / ✓ / — | — |
| Kaizen works row | `kaizen/_components/Kaizen.tsx` | `WorkRef` | — | — | card |
| Work card « Liens » | `work-drawer/WorkLinksSection.tsx:77` | `WorkRef` `#id` | — | — | card |
| Work card sessions list · pending sessions | `work-drawer/DrawerWorkSessionsSection.tsx:172`; `PendingWorkSessions.tsx:100` | « Peinture 1 : #2405 · … » plain | — | — | — |
| Session (phone) linked work | `session/SessionNewClient.tsx:1107` | `#id · title` plain (`WorkRef` elsewhere in the file) | — | ✓ | ½ |
| Production list | `production/_components/Production.tsx:673` | `#id · year` under a thumb | ✓ | ✓ | — |
| Audit Pending | `PendingQueue.tsx:89–90` | `#id · title` with a thumb | ✓ | ✓ | — |
| Broadcast | `broadcast/_components/Broadcast.tsx:269`, `:317`, `:394` | `#id title` plain | — | ✓ | — |
| Fiscal expense ↔ works | `fiscal/_components/Fiscal.tsx:850`, `:875` | `#id title` plain | — | ✓ | — |
| Vault document ↔ works | `vault/_components/Vault.tsx:845`, `:1623`, `:1716`, `:1875` | title, else `#id` | — | ✓ | — |
| Share triage hits | `ShareAttachPanel.tsx:205` | **#id** + label (thumb on other rows) | ½ | ✓ | — |
| Voice-note sheet work picker | `shared/VoiceNoteSheet.tsx:1361` | « title (#id) » | — | ✓ | — |
| Phone sale form | `sale/SaleNewClient.tsx:420` | `#id · title` with a thumb | ✓ | ✓ | — |
| Issue report header | `app/atelier/issue/new/page.tsx:30` | `#id · title · year` | — | ✓ | — |
| Portfolio reorder thumbs | `portfolio/shared/ReorderableThumb.tsx:68` | thumb + `#id` | ✓ | — | — |
| Constellation side panel · Map pin editor · PDF export list · ⌘K | `ConstellationSidePanel.tsx:158`; `site/MapPinEditor.tsx:296`; `PdfExportDrawer.tsx:508`; `CommandPalette.tsx:143` | title, else `#id` | ✓ / ✓ / ✓ / — | ✓ | — |
| Map pins (works) | `WorldMapTab.tsx:511` | title, else `#id`, thumbs in the popup | ✓ | ✓ | — |

Also seen: the Inventory row (`WorkThumb` 40 px in `ImageLoupe`) is the model Pem pointed at. `fetchWorkPreview` runs 3 queries per work; a list of 30 numbers would make 90 — places that list many works already have the title and file in memory or should fetch them in one go.

## The proposal

### A. One screen « Carte & temps » (working name — question 1)

**Merge, don't add** (STRATEGY 2026-11-14): the Map tab becomes a map on top and a timeline under it, two views of the same works filtered together. The timeline *is* the « timeline map » of the TODO line: drag a span on it and the map shows the works made in that span; click a place on the map and the timeline shows only what was made there.

**Moves** from Commercial to **Catalogue**, after Inventaire, next to Constellation (question 2). Contacts mode stays in it for the commercial use.

**Modes (pills, top left):** **Création** (default) · **Où elles sont** (today's Œuvres mode, fixed) · **Contacts** (unchanged).

#### Desktop (mockup, top)
- **Map (upper ~55 %).**
  - **Création:** one pin per place of making, at the `place` row's coordinates (no geocoding, no jitter). Size = number of works. **Solid** = works whose place is their own (a « Création » line); **ring** = works placed only by their period's atelier — so the map says how sure it is (« 11 précis · 1 156 par période »). Pem's **route** drawn as a dated line between the ateliers in period order: Waterford (déc. 2019) → Tooreeney (déc. 2021) → Marseille (juin 2024). A small **Provence inset** where Marseille, Aureille, Les Baux, Lac du Peiroo and Istres sit within a few pixels.
  - **Où elles sont:** pins at the **work's address** (custodian's address, custody model), not the custodian's card city — fixes #1653. Pem's 1,169 works collapse to « Atelier · Principal ». Works away from Pem show a thin **arc from where made to where they are** (the 7 gifts today; deposits / loans from R7 later).
  - Clicking a pin opens the **side panel (right, collapsed by default)**: the place, its dates, its works as a grid of thumbnails (`#id` + title or « Sans titre · 2024 »), and « Ouvrir dans l'Inventaire » / « Constellation » with that set.
- **Timeline (lower ~45 %), horizontal, years → months → days on zoom.**
  - **Period bands** behind everything, one colour per atelier (same colour as its pin).
  - **Lanes** (each can be folded):
    1. **Œuvres** — a bar per month (year when zoomed out); zoomed in, the thumbnails themselves. A work dated to the year sits on a **year shelf** (a band over the whole year), not on a fake 1 January. Works with no date: a **« sans date »** shelf at the end of each period (they are in a period by hand), with the count and a link to the Inventory filter « Périodes à trancher ».
    2. **Séances** — one dot per work session (field / studio), its work's thumbnail on hover.
    3. **Journal & notes** — one tick per entry / voice note / idea line.
    4. **Création** — the « Création » lines (started / worked / resumed / finished) of the works in view, joined per work so a long work reads as a short bar.
    5. **Sorties** — works leaving (gifts now; R7 agreements later) and custody moves; an arrow up when a work leaves, down when it comes back.
  - **Brush** (drag on the axis) = the span; the map, the side panel and the counts follow. **Click a day** → « Aujourd'hui » / Journal for that day (`?day=`, R2). **Click a period band** → the span of that period.
  - A one-line **strip** on top: span · works · sessions · notes · « 579 sans année » (link) — so the gaps are visible (aim 1).
- Reads from the server in one query for the whole catalogue (dates, place, thumbnail, title — not the loaded batch of the Atelier shell).

#### Phone 375 px (mockup, right)
- **Carte (Création)**: full-width map, mode pills, **period chips** under it (Tout · Waterford · Tooreeney · Marseille) as the phone's time control; a **bottom sheet** with the selected place's works as rows (thumbnail 44 px + `#id` + title; hold = loupe). No horizontal timeline on the phone.
- **Temps**: the timeline turns **vertical**, most recent first, one header per month: « nov. 2026 · 5 séances · 7 œuvres · 1 note », then rows (a session with its work, a work made that month, a note). Tapping a day opens « Aujourd'hui » on that day; the ‹ › of Aujourd'hui stays the day-to-day stepping, this is the jump.
- Both reachable from the phone menu under Catalogue (not the top block — question 6).

### B. The preview rule — « a work number never travels alone »

**Rule:** wherever a work is named by its number, it shows **its thumbnail and its title** next to it, and **holding it (phone) / hovering it (desktop) shows the picture large with its caption**. Tap / click still opens the work, as each place does today.

Three sizes, one component (`WorkChip`, new; built from `WorkThumb` + `ImageLoupe` + `WorkRef`):

| Form | Where | Shape |
|---|---|---|
| **Row** | lists, ✦ suggestions, Fil, folds, pickers, Notes triage | thumbnail 40 px (44 px tap target on the phone) · `#2357` · title |
| **Chip** | dense tables, side panels, work card « Liens » | thumbnail 24 px · `#2357` · title (ellipsis) |
| **Inline** | inside a sentence (Journal text, a note, Kaizen body) | `#2357` · short title, a 16 px thumbnail before the number; no line break |

- **No title (912 works):** the title slot shows « Sans titre · 2024 · huile » in a quieter tone — never the number alone.
- **One gesture, one result:** today a held number gives a small card and a held picture gives the big picture. Proposal: **both give the loupe** — the picture as large as the screen allows, with a caption strip (`#id` · title · year · technique · status). The small card goes (question 4).
- **Data:** places that list many works fetch thumbnail + title in **one call for all their ids** (a batch version of `fetchWorkPreview`, cached per session), so a list of 30 numbers is one request, not 90.
- **Sweep order** (Pem's first): ① Notes triage (« #2357 · Les mortes marguerites ») ② the ✦ suggestion rows, desktop Journal (phone already has thumb + title; add the hold) ③ Aujourd'hui folds « Attributs modifiés » / « Création » ④ work card « Liens » and sessions lists ⑤ Kaizen works row, « Pour vous », Broadcast, Fiscal, Vault, Share triage, voice-note picker, issue header ⑥ everywhere else in the table above. Each place keeps where its tap goes.

### C. Fixes to the map found while reading (each its own GO, bug batch)
1. Œuvres mode ignores the work's address and uses the custodian's card city (#1653 in Marseille instead of Rutali).
2. The map geocodes city names at runtime although the 8 `place` rows have coordinates; contacts' addresses have no coordinates at all (34 rows) — geocoding stays for them, cached.
3. Pins jitter at random (±0.004°) on every load: the same work moves a little each time.

## Field map — what each part reads (no new field needed for v1)

| Shown | Read from | Note |
|---|---|---|
| Work's date on the axis | `workWhen()`: production end / start (with precision), a real day in `Année`, else the year; else the last dated « Création » line | year-only → year shelf; none → the period's « sans date » shelf |
| Work's period | `effectivePeriod()`: `work_period_override`, else by date | 570 set by hand (559 of them on works with no year) |
| Where made | `effectivePlace()`: last `work_creation_step.place_id`, else `work_period.default_place_id` | solid vs ring on the map |
| Route | `routeOf()` per work; Pem's route = periods in order with their places | |
| Place coordinates | `place.latitude / longitude` | 8 / 8 filled |
| Sessions | `work_session` (`created_at`, `payload.session_day`, `payload.items[].oeuvre_id`, `payload.field_context` GPS) | 3 / 56 with GPS |
| Journal & notes | `journal_entry.event_on` (+ precision), `voice_note.created_at`, `note_line` (R1) | |
| « Création » lines | `work_creation_step.on_date` / `date_precision` / `kind` / `place_id` | 46 dated |
| Sorties | gifts: status « Gift » (no date stored); R7 agreements' steps later; custody moves from `oeuvre_versions` snapshots (since 2026-05-12) | see question 7 |
| Where now | `Oeuvres.LocalisationID` + `localisation_address_id` → `contact_addresses` (label, ville, pays) | geocoded by city, cached |
| Thumbnail + title | `Oeuvres.txtImageNameLink` via `thumbUrl()`, `Titre`, `Année`, `Technique`, status | batch call |

## Open questions (for Pem)

1. **One screen or two?** Map and timeline as one screen « Carte & temps » (map above, time below, filtering each other) — my pick, it merges instead of adding a tab. Or keep « Carte » and add a separate « Chronologie » tab? Name ideas: « Carte & temps », « Atlas », « Où & quand ».
2. **Where it lives.** Move it from Commercial to **Catalogue** (after Inventaire, next to Constellation), with Contacts as one of its modes? Or leave the map in Commercial and put only the timeline in Catalogue?
3. **Lanes.** Œuvres · Séances · Journal & notes · Création · Sorties — the right five? Anything missing (exhibitions / events, R6; ideas from R1; photos of the day)? Which open by default (proposal: Œuvres and Séances; the rest folded — « collapse by default »)?
4. **One gesture.** Holding / hovering a work number or its thumbnail always shows **the big picture with a caption** (the small preview card goes)? Or keep the small card on numbers and the loupe on pictures?
5. **Undated works.** 579 works have no year (559 are in a period by hand). Show them as a « sans date » shelf at the end of each period with a count and a link to fix them — or leave them off the timeline? Is completing dates something you want the timeline to push (a « à dater » count), or just show?
6. **Phone.** Map « Création » + the vertical « Temps » on the phone, under Catalogue in the menu — or is this a desktop tool and the phone only gets the preview rule?
7. **Where works were, over time.** No move has a date before 2026-05-12 (the first version snapshot), and the 7 gifts have no gift date. Are all the works made in Tooreeney and Waterford physically in Marseille now (the data says so)? Do you want to give the old moves a date (e.g. the gift dates, the move from Ireland in June 2024) so « Sorties » means something, or leave the lane to R7's agreements from now on?
8. **Field places.** Only 11 works have a place of their own (Rutali 9, Lac du Peiroo, Marseille). Should a field session's GPS **propose** the place on the work (it already does in the card, never writes), and should the map show those suggestions as a third, dotted kind of pin?
9. **The Youth period (1997–2000)** has Marseille Atelier as its place in the data. Is that right? (It decides where 2 works sit on the map.)
10. **When.** R4 is « later » (after R1, R2, R8). The preview rule (B) is small and can go first as a sweep — build B now and A after R8?

## Needs a GO before building

- Pem's GO on this design and the answers above.
- **No SQL for v1**: everything reads existing tables. Possible later (own OK): a date on gifts / custody moves (question 7), coordinates on `contact_addresses` (stop geocoding by city).
- Part B: new `WorkChip` + a batch preview action; the sweep is many small UI edits (i18n for « Sans titre · … » FR + EN).
- Part A: the map component rework (place coordinates, modes, side panel), the timeline (new), the phone views, the sidebar move; What's new item.
- Part C fixes: bug batch, each its own GO.

## Not in this brief

- The Constellation itself (links between works) — it gains the preview rule only; « where / when » stay on this screen.
- Public site maps / timelines (R8).
- Photographs as an output (RETHINK: « another time »).
