# Handoff 2026-11-14 — next batch

**State (2026-11-14 end of session):** `origin/main` = `192f11a`, pushed (deploy was still building at hand-off — check `curl -sI https://www.thepemworkshop.com` → `x-build-sha` = `192f11a` before saying deployed). Live in that push: place added from the card + a work's place follows its period + Inventory place line / filter (What's new 3.1.10), place addresses + « Trouver les coordonnées » (DB part applied), voice notes record first (3.1.11, other session — not tried on a real iPhone mic). The 2026-11-13 batch is archived: [`archive/HANDOFF_2026-11-13_NEXT.md`](./archive/HANDOFF_2026-11-13_NEXT.md), [`archive/HANDOFF_2026-11-13_DESIGN_BUILD.md`](./archive/HANDOFF_2026-11-13_DESIGN_BUILD.md).

**Next, in order:** (a) done by Pem 2026-11-14 — 8 places with coordinates, Marseille and Tooreeney periods have their place (Waterford / Rebirth and Youth still without); (b) item 1: place suggested from the field session built 2026-11-14 (pushed, 3.1.12), then replaced by the « Historique de création » (SQL applied, app local, 3.1.13); still open: the timeline map (design first: "where was I making what, when"; `/maps` shows contacts today); (c) items 2 → 4 below. Side sessions writing code must use a worktree (CLAUDE.md): sharing this checkout blocked both commits on 2026-11-14 until one stashed.

## Order (Pem 2026-11-14)

1. **Places, continued**
2. **Staged photos warning + production dates** (TODO "To build" 2–4)
3. **Measure speed** (read only)
4. **Work card: empty fields folded** — Pem 2026-11-14, placed here pending his say
5. **`#1234` previews everywhere + larger view** — Pem 2026-11-14, placed here pending his say
6. **Slideshow from the selection → PowerPoint / video / Reels** — Pem 2026-11-14, idea, design first (see §6)

Dropped: "Frame only" in Export (Pem 2026-11-14 — not wanted).

## 1. Places, continued

Verified against live code + DB 2026-11-14.

- **Bug / friction — "Place made offers no choice" (Pem, screenshot 2026-11-14).** The `place` table is empty (0 places, 0 `work_place`, 0 periods with a suggested place), so the card's Place made select (`WorkPeriodSourceSection.tsx`) only offers "— Not set", with no hint that places are added under Inventory → Periods & sources (`PeriodSourceManager.tsx`). Fix first: when the list is empty (or the place is missing), let the card add a place right there (name, town, country; coordinates optional), and say where the list lives. **Built 2026-11-14 (verified against live code 2026-11-14, pushed in `192f11a`, What's new 3.1.10 `place_add_from_card`):** `WorkPeriodSourceSection.tsx` — « + Lieu » button and « + Nouveau lieu… » in the select open name / town / country / coordinates; « Ajouter et choisir » saves the place (`savePlace`) and sets it on the work; an empty list says so and names « Gérer périodes et sources ». `parsePlaceCoords` moved to `lib/work-periods.ts` (shared with `PeriodSourceManager`). Checked on dev (form opened, cancelled — no test place written; DB still 0 places).
- **A work's place follows its period (Pem 2026-11-14):** "a lot of works have been done in ateliers … we can infer the address or the location from the periods … by default it would be set there" (Galway; Waterford atelier before the rebirth period — Pem will give the addresses). **Built (verified against live code 2026-11-14, pushed `dd6bb9d`, What's new 3.1.10 `place_from_period`):** `effectivePlace` in `lib/work-periods.ts` = the work's `work_place`, else its period's `default_place_id`, read never written; card select first entry « Automatique : {place} » + « d'après la période »; batch modify « Revenir au lieu de la période »; Reports `place_made`; Inventory: place as the period cell's second line (italic grey when from the period — no extra column, the table keeps its width), Place filter, place name in the search box, Place grouping field.
- **Address + coordinates (Pem 2026-11-14: "a place can be an address", "this place data is to be used in map"):** `supabase/sql/place_address_period_place.sql` — `place.address`; search text « made in » follows the period's place (+ address); search re-indexed when a period (name, dates, place) or a place changes (it was not, even for period renames). **Applied 2026-11-14 with Pem's OK** (`place.address` live; search text spot-checked on #2407 / #2401 / #1959 / #1636 — same periods as before; no new security advisor; `gen:types` unchanged). App side pushed `794fd16`, verified on dev 2026-11-14 (Galway, Ireland → 53.27441, -9.04906; nothing saved, 0 places): address field + « Trouver les coordonnées » (Nominatim via `findPlaceCoords`, on request only — the address is sent to OpenStreetMap) in the card's new-place form and in « Gérer périodes et sources »; place counts include works placed by their period.
- **Suggest the place from the field session.** **Built 2026-11-14 (verified against live code + dev 2026-11-14, What's new 3.1.12 `place_from_session`, pushed 2026-11-14):** `fetchWorkSessionLocations` (`period-source-actions.ts`) reads `payload.field_context` of the sessions holding the work (`payload @> {items:[{oeuvre_id}]}`), earliest first; `nearestPlace` / `distanceKm` (`lib/work-periods.ts`, radius `SESSION_PLACE_RADIUS_KM` = 2) picks the nearest saved place; the card (`WorkPeriodSourceSection.tsx`) shows « Session de terrain du {date} : {place} » + « Utiliser » when it differs from the place shown (or none), « Confirmé par la session de terrain du {date} » when equal. Never written by itself. Data 2026-11-14: 8 places with coordinates (Pem entered them), 2 located sessions (22 Aug, 24 Sep 2026) ~1 m from Marseille Atelier, holding #2379–#2382 and #2394 — all five undated, so all five show the suggestion. Checked on dev on #2380 (suggestion; with an unsaved date 2026-09-01 → « Confirmé »; cleared, nothing saved; 375 px fits).
- **Pem 2026-11-14: "if I fill in the end date of a work, it must not overwrite the place if it was filled in manually."** Verified against live code 2026-11-14: only an explicit choice writes `work_place` (`setWorkPlace` / `setWorksPlace` from the card select, « Utiliser », batch modify « Lieu »); no date save path touches it. A date only moves the automatic period, so it changes the place shown only for works with no place of their own (`effectivePlace`: own place first). Keep it that way. Still true with the creation history (2026-11-14): lines are written only by « + Ligne » / editing a line / « Ajouter » on a session suggestion / batch modify « Lieu de création » (adds an undated line, never removes one); no date save path touches them.
- **Place column + filter in Inventory.** Reads the « Création » route since 2026-11-14 (below): the period cell's second line shows « Tooreeney → Marseille Atelier » (italic grey when from the period); the Place filter matches any line; the search box and the Place grouping field read the route.
- **« Historique de création » — replaces the single place (Pem 2026-11-14: "a history for the creation where 'place' is just like 'history'"; "record different places of fabrication for a work with dates … it will force to decide which period").** **Built 2026-11-14 (verified against live code + live DB + dev 2026-11-14, What's new 3.1.13 `creation_history`, local — not committed):**
  - SQL `supabase/sql/work_creation_steps.sql` **applied 2026-11-14 with Pem's OK**: `work_creation_step` (date + precision year / month / day, kind started / worked / resumed / finished, place, note ≤ 500, `work_session_id`), team RLS, no anon grant, re-index trigger; the 2 `work_place` rows (#1950, #2310) copied as undated lines; `oeuvre_search_text` "made in" = the route, else the period's place; a work with no date reads its last dated line for its period. Security advisors: nothing new. `gen:types` matches.
  - App: `components/atelier/work-drawer/WorkCreationHistory.tsx` (list, « + Ligne », tap a line to edit / delete, new place inline, field-session suggestion → « Ajouter » with `work_session_id`); `lib/work-periods.ts` (`CreationStep`, `sortSteps`, `parseStepDate`, `stepDateLabel`, `periodsOfSteps`, `whenWithSteps`, `routeOf` / `routeLabel`; `effectivePlace` gains `route`); actions `saveCreationStep` / `deleteCreationStep` (`period-source-actions.ts`; `setWorkPlace` / `setWorksPlace` removed); card period block asks « Création sur N périodes : laquelle ? » (one button per period → `work_period_override`); Inventory Period filter « Périodes à trancher »; batch modify « Lieu de création (ajoute une ligne) »; Reports `place_made` = route; place counts in « Gérer périodes et sources » count each place once per work.
  - Checked on dev: #2380 offers « Session de terrain du 22 août 2026 : Marseille Atelier » + « Ajouter »; form opens (kinds, places, date hint), fits 375 px, cancelled — no line written (DB still 2 lines). Date parsing + periods checked with a script (2022 → Tooreeney, 06/2024 → Marseille by mid-month, 03/2026 → Marseille). **Not checked in a browser:** the « Périodes à trancher » filter and the Inventory route line (the hidden pane stalled on « Chargement Atelier »); a real save / edit / delete.
  - **Later:** drop `work_place` (copy any row added by the old app first — the live app still writes it until this ships); map « Création » mode with a date range (the timeline map below).
- **Timeline map.** Places with coordinates on a map, works by date along a timeline (`/maps` exists for contacts). Design first: what one screen should answer ("where was I making what, when").

## 2. Staged photos warning + production dates

From `TODO.md` "To build" 2–4 (details in [`TODO_NOTES.md`](./TODO_NOTES.md)):
- **Staged photos:** a session photo can sit in `payload.items[].shots[]` and never be applied to its work, with no signal (root cause of 10 stranded photos, 2026-07-30). Wanted: a visible "staged, not applied" marker on the work and in the journal.
- **Production start, partial date** (year / month / day) — the drawer has a full-date field only (admin).
- **Production span:** end date by hand; new / found choice in WorkForm (only in capture today).

## 3. Measure speed

Planned "after this batch ships" — it has shipped. Live site, read only: Inventory first paint + full catalogue, opening a work card, Overview; compare with the last measurements (see `docs/TODO.md` speed items).

## 4. Work card: empty fields folded (Pem 2026-11-14)

"The work drawer is excellent although it could do with some visual separation; mainly, if a field has no content — the comment has none, for instance — fold it and show it as empty (or greyed out), then show the box to enter it on click or long hover." Applies to the drawer's text fields (comment, notes, memory / place-of-invention texts, physical label…). Keep the drawer guard (`useUnsavedActionGuard`) behaviour; phone: tap, not hover.

## 5. `#1234` previews everywhere + larger view (Pem 2026-11-14)

Pem (screenshot of a journal entry's « ✦ Suggestions IA (à valider) »: `✦ #1316`, `✦ #1323`, `✦ #2336`, each with Confirm / Reject): "same with other '#items' show a preview on hover, or maybe thumb then hover show fit screen."

Verified against live code 2026-11-14:
- **The preview exists:** `components/atelier/WorkRef.tsx` (owner 2026-11-12) — hover ~300 ms (desktop) / hold ~450 ms (phone) → 288 px card with a 96 px thumbnail, title, year, technique, status (`fetchWorkPreview`, cached per session). Used in the journal entry's linked works, `EntryText`, `SessionJournalTab`, session new, Kaizen, `ContactEditorPanel`, `WorkLinksSection`.
- **Missing it — plain `<Link>` `#id`:** the AI suggestion rows (`JournalDayExtras.tsx` ~l.361, the screenshot — so Pem cannot judge Confirm / Reject without opening each work), the Kaizen works row (~l.564) and the changes list (~l.615) in the same file; also `NoteTriagePanel.tsx` (`#{note.oeuvre_id}`), `Notes.tsx` labels, `Production.tsx` (~l.820), `Sales.tsx` (~l.504, ~l.534); the work card's field-session list (`DrawerWorkSessionsSection.tsx` ~l.105, « Painting 1: #2357 · 1 photos » — Pem screenshot 2026-11-14; it also says "1 photos": singular missing). Sweep: grep `#{` and `#${` in `app/` + `components/` `.tsx`, keep only work ids (contact / order ids are not works).
- The suggestion rows show no title in the screenshot (`{p.title ?? ''}` empty) — check whether the proposal query loads the work's title; a title next to the number would help on its own.

To build:
1. Swap those work `#id` links to `WorkRef` (same `href` each place uses today).
2. **Thumbnail + loupe, like Inventory (Pem 2026-11-14: "do like the inventory").** Inventory's list row = 40 px `WorkThumb` (`size={96}`, `displaySize="40px"`, 1px `var(--bd)` border, `cursor: zoom-in`) wrapped in `ImageLoupe` (`components/atelier/ImageLoupe.tsx`, owner 2026-11-13): computer hover ~350 ms → the picture as large as the screen allows on the free side, never cropped, gone when the pointer leaves; phone long press ~450 ms → near full screen, any tap closes, the ending tap does not open the work. Full image via `imageUrl()`, thumb as placeholder (`Inventory.tsx` ~l.2037). Do the same in front of each `#id` in the AI suggestion rows first (decision list), then the other work lists above where a row has room; no image → `MissingThumb`-style empty box, no loupe. The `#id` text itself stays a `WorkRef` (title / year / technique card). Needs the work's cover file (`Oeuvres.txtImageNameLink`) in each list's data — the proposal query likely lacks it (and the title). Read-only; no drawer; tap on the thumb / text still opens the work.

## 6. Slideshow from the selection → PowerPoint / video / Reels (Pem 2026-11-14, idea — design first)

Pem: create a slideshow from the batch dock; choice of background (black, grey, white); manual controls; slide length and transitions configurable. Then maybe turn it into PowerPoint slides, and a base to work on in Premiere or Photoshop (layers to move on a timeline for a film); export as a moving file (GIF, MOV, AVI, MP4…). "The idea also is maybe to begin the work on the Reels, the Instagram Reels system."

Verified against live code 2026-11-14:
- **Batch dock = `components/atelier/CurationDock.tsx`**: the floating bar shown when works are selected (Modifier, Exporter, Images, Joindre au catalogue, Comparer, quick group, Curate →). The slideshow entry would sit there, on the selection (order = selection order or the list's sort).
- **Nothing exists yet:** no slideshow, no PowerPoint, GIF or video code, no Reels; no `ffmpeg` / `pptxgenjs` in `package.json`. Instagram today = the broadcast feed only (`app/api/inventory/broadcast/feed/route.ts`, `lib/broadcast-eligibility.ts`: public works with `broadcast_ready` and a cover, read by Make / n8n) — still images, no posting from the app.
- **Images:** full size via `imageUrl()`, thumbs via `thumbUrl()` (AVIF). PowerPoint and most video tools don't read AVIF → exports must convert (Sharp server-side, or canvas in the browser).

Steps, each a separate decision (smallest first):
1. **Slideshow in the browser** (no file): full screen, the selection one by one; background black / grey / white; ← → / Space / Esc and tap / swipe on the phone; play / pause; seconds per slide; transition (cut, fade, slide); caption on or off (title · year · technique · dimensions). Settings remembered per user. Image never cropped (contain), like `ImageLoupe`.
2. **PowerPoint (.pptx):** one slide per work, same background, image + caption, transition and timing carried over; images converted to JPEG. Library to choose (e.g. `pptxgenjs`); server action or client, per size limits (Vercel 4.5 MB action body).
3. **Moving file:** MP4 first (Instagram and Premiere read it), GIF for short loops; MOV / AVI only if a tool asks for them. Where it renders (in the browser with `MediaRecorder` / WebCodecs, or a job outside Vercel) is the main design question: long renders are a deferred background feature (CLAUDE.md) → owner GO.
4. **Base for Premiere / Photoshop:** a folder (ZIP) of numbered full-size images (JPEG / PNG, same frame size, background baked or transparent) + a sequence list (order, duration, transition) that the tools can import. "Layers on a timeline" = one image per layer / clip; a true Premiere project file (.prproj) or layered PSD is a later question.
5. **Reels:** 9:16 frame (1080 × 1920), safe zones for Instagram's overlay, length limits, a caption seeded from `broadcast_caption_seed`; output = the MP4 of step 3 in that frame. Posting stays manual (or via the existing Make / n8n path) unless Pem decides otherwise.

Pem's answers (2026-11-14):
- **First:** step 1, the slideshow in the browser.
- **Music / sound:** none for now.
- **Caption:** language switchable (FR / EN); Pem picks which attributes show (title, year, technique, dimensions…) and where on the slide; caption fade in / out options; a cast shadow so the text stands out from the background or from the image when it overlays it.
- **Saved?** A small slideshow yes (named, reopened); a large one can still be exported. Pem: "still a good few questions to answer for the plan" → write the plan for step 1 and get his say before building: saved slideshow = table or JSON, size limit for "small", caption layout editor (fixed positions vs drag), the transitions list, phone controls.

## Fixed (bug, Pem 2026-11-14)

- **Comments copied into History.** A work created from a field session got its note in Comments *and* under « [date] Session terrain » in History (`createWorkFromSessionFields`, `app/atelier/session/actions.ts`, since `d219611`). Fixed 2026-11-14 (local, not committed): History gets the origin line only. Live data cleaned with Pem's OK the same day: #2372, #2377, #2378, #2390 (History = origin line; comments untouched; old text in `oeuvre_versions`). Other creation paths checked: WorkForm (`[date] Atelier`, `historique_append` sent by nothing) and share triage write the origin line only.
- **⌘K « degas » found nothing (answered, not built).** ⌘K matches words in titles and contact names only; the AI descriptions are reached by meaning (embeddings), and the live site queues a new phrase until the PC worker embeds it (« degas » queued 14:28 UTC; no query embedded since 12 Nov). 102 works carry « degas » in their search text (AI "echoes"). No typo tolerance (`pg_trgm` not installed). Proposed, needs GO: word match over `oeuvre_search_text` in ⌘K with typo tolerance, so it answers with the PC off.

## Answered, nothing to build

- **"The 641 works with no year"** — Pem: "if you have no data how can you infer anything?" Right: a period is found from a work's date, so a work with no date can only get a period by hand (card or batch modify). Nothing is inferred. If wanted later: a "no year" filter in Inventory to fill dates in batch.

## Still unchecked from the last batch (live)

- Admin views of Overview and batch modify on the live site; the export panel + a real export; a real print (300 dpi, Light B&W, labels on a sheet).
- Phone: opening today's session records place and weather by itself.
- Constellation: the arrow on the first real "painted on" / "derived from" / "answers" link.
