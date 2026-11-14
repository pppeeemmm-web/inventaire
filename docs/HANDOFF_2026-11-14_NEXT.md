# Handoff 2026-11-14 — next batch

**State (2026-11-14 end of session):** `origin/main` = `192f11a`, pushed (deploy was still building at hand-off — check `curl -sI https://www.thepemworkshop.com` → `x-build-sha` = `192f11a` before saying deployed). Live in that push: place added from the card + a work's place follows its period + Inventory place line / filter (What's new 3.1.10), place addresses + « Trouver les coordonnées » (DB part applied), voice notes record first (3.1.11, other session — not tried on a real iPhone mic). The 2026-11-13 batch is archived: [`archive/HANDOFF_2026-11-13_NEXT.md`](./archive/HANDOFF_2026-11-13_NEXT.md), [`archive/HANDOFF_2026-11-13_DESIGN_BUILD.md`](./archive/HANDOFF_2026-11-13_DESIGN_BUILD.md).

**Next, in order:** (a) Pem enters the ateliers (Galway, Waterford before the rebirth period, …) with addresses → « Trouver les coordonnées » → set each as its period's place; (b) item 1 still open: place suggested from the field session (≈ 2 km radius, needs places with coordinates; only 2 / 54 sessions have a location, capture is automatic since 3.1.6) and the timeline map (design first: "where was I making what, when"; `/maps` shows contacts today); (c) items 2 → 4 below. Side sessions writing code must use a worktree (CLAUDE.md): sharing this checkout blocked both commits on 2026-11-14 until one stashed.

## Order (Pem 2026-11-14)

1. **Places, continued**
2. **Staged photos warning + production dates** (TODO "To build" 2–4)
3. **Measure speed** (read only)
4. **Work card: empty fields folded** — Pem 2026-11-14, placed here pending his say
5. **`#1234` previews everywhere + larger view** — Pem 2026-11-14, placed here pending his say

Dropped: "Frame only" in Export (Pem 2026-11-14 — not wanted).

## 1. Places, continued

Verified against live code + DB 2026-11-14.

- **Bug / friction — "Place made offers no choice" (Pem, screenshot 2026-11-14).** The `place` table is empty (0 places, 0 `work_place`, 0 periods with a suggested place), so the card's Place made select (`WorkPeriodSourceSection.tsx`) only offers "— Not set", with no hint that places are added under Inventory → Periods & sources (`PeriodSourceManager.tsx`). Fix first: when the list is empty (or the place is missing), let the card add a place right there (name, town, country; coordinates optional), and say where the list lives. **Built 2026-11-14 (verified against live code 2026-11-14, pushed in `192f11a`, What's new 3.1.10 `place_add_from_card`):** `WorkPeriodSourceSection.tsx` — « + Lieu » button and « + Nouveau lieu… » in the select open name / town / country / coordinates; « Ajouter et choisir » saves the place (`savePlace`) and sets it on the work; an empty list says so and names « Gérer périodes et sources ». `parsePlaceCoords` moved to `lib/work-periods.ts` (shared with `PeriodSourceManager`). Checked on dev (form opened, cancelled — no test place written; DB still 0 places).
- **A work's place follows its period (Pem 2026-11-14):** "a lot of works have been done in ateliers … we can infer the address or the location from the periods … by default it would be set there" (Galway; Waterford atelier before the rebirth period — Pem will give the addresses). **Built (verified against live code 2026-11-14, pushed `dd6bb9d`, What's new 3.1.10 `place_from_period`):** `effectivePlace` in `lib/work-periods.ts` = the work's `work_place`, else its period's `default_place_id`, read never written; card select first entry « Automatique : {place} » + « d'après la période »; batch modify « Revenir au lieu de la période »; Reports `place_made`; Inventory: place as the period cell's second line (italic grey when from the period — no extra column, the table keeps its width), Place filter, place name in the search box, Place grouping field.
- **Address + coordinates (Pem 2026-11-14: "a place can be an address", "this place data is to be used in map"):** `supabase/sql/place_address_period_place.sql` — `place.address`; search text « made in » follows the period's place (+ address); search re-indexed when a period (name, dates, place) or a place changes (it was not, even for period renames). **Applied 2026-11-14 with Pem's OK** (`place.address` live; search text spot-checked on #2407 / #2401 / #1959 / #1636 — same periods as before; no new security advisor; `gen:types` unchanged). App side pushed `794fd16`, verified on dev 2026-11-14 (Galway, Ireland → 53.27441, -9.04906; nothing saved, 0 places): address field + « Trouver les coordonnées » (Nominatim via `findPlaceCoords`, on request only — the address is sent to OpenStreetMap) in the card's new-place form and in « Gérer périodes et sources »; place counts include works placed by their period.
- **Suggest the place from the field session.** The session's location lives in `work_session.payload.field_context` (latitude / longitude, time, weather), captured by itself on the phone since 3.1.6 (A4). Today 2 of 54 sessions have one (22 Aug, 23 Sep 2026, Marseille) — the suggestion only helps works captured from now on, and only once places have coordinates. Rule to propose: nearest place with coordinates within a radius (≈ 2 km?) of the session that captured the work → shown as a suggestion with "Use it", never set by itself (same as the period's suggested place).
- **Place column + filter in Inventory.** `work_place` is loaded with the period data (`period-source-actions.ts`, `workPlaces`); the column shows the place set on the work, else the period's suggested place in grey. Filter: one place / not set.
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
- **Missing it — plain `<Link>` `#id`:** the AI suggestion rows (`JournalDayExtras.tsx` ~l.361, the screenshot — so Pem cannot judge Confirm / Reject without opening each work), the Kaizen works row (~l.564) and the changes list (~l.615) in the same file; also `NoteTriagePanel.tsx` (`#{note.oeuvre_id}`), `Notes.tsx` labels, `Production.tsx` (~l.820), `Sales.tsx` (~l.504, ~l.534). Sweep: grep `#{` and `#${` in `app/` + `components/` `.tsx`, keep only work ids (contact / order ids are not works).
- The suggestion rows show no title in the screenshot (`{p.title ?? ''}` empty) — check whether the proposal query loads the work's title; a title next to the number would help on its own.

To build:
1. Swap those work `#id` links to `WorkRef` (same `href` each place uses today).
2. **Thumbnail + loupe, like Inventory (Pem 2026-11-14: "do like the inventory").** Inventory's list row = 40 px `WorkThumb` (`size={96}`, `displaySize="40px"`, 1px `var(--bd)` border, `cursor: zoom-in`) wrapped in `ImageLoupe` (`components/atelier/ImageLoupe.tsx`, owner 2026-11-13): computer hover ~350 ms → the picture as large as the screen allows on the free side, never cropped, gone when the pointer leaves; phone long press ~450 ms → near full screen, any tap closes, the ending tap does not open the work. Full image via `imageUrl()`, thumb as placeholder (`Inventory.tsx` ~l.2037). Do the same in front of each `#id` in the AI suggestion rows first (decision list), then the other work lists above where a row has room; no image → `MissingThumb`-style empty box, no loupe. The `#id` text itself stays a `WorkRef` (title / year / technique card). Needs the work's cover file (`Oeuvres.txtImageNameLink`) in each list's data — the proposal query likely lacks it (and the title). Read-only; no drawer; tap on the thumb / text still opens the work.

## Answered, nothing to build

- **"The 641 works with no year"** — Pem: "if you have no data how can you infer anything?" Right: a period is found from a work's date, so a work with no date can only get a period by hand (card or batch modify). Nothing is inferred. If wanted later: a "no year" filter in Inventory to fill dates in batch.

## Still unchecked from the last batch (live)

- Admin views of Overview and batch modify on the live site; the export panel + a real export; a real print (300 dpi, Light B&W, labels on a sheet).
- Phone: opening today's session records place and weather by itself.
- Constellation: the arrow on the first real "painted on" / "derived from" / "answers" link.
