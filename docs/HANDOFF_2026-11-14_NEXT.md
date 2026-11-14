# Handoff 2026-11-14 — next batch

**State:** `origin/main` = `d9bb23f`, deployed (live `x-build-sha` checked 2026-11-14 09:55). The 2026-11-13 batch is all live and archived: [`archive/HANDOFF_2026-11-13_NEXT.md`](./archive/HANDOFF_2026-11-13_NEXT.md), [`archive/HANDOFF_2026-11-13_DESIGN_BUILD.md`](./archive/HANDOFF_2026-11-13_DESIGN_BUILD.md).

## Order (Pem 2026-11-14)

1. **Places, continued**
2. **Staged photos warning + production dates** (TODO "To build" 2–4)
3. **Measure speed** (read only)
4. **Work card: empty fields folded** — Pem 2026-11-14, placed here pending his say

Dropped: "Frame only" in Export (Pem 2026-11-14 — not wanted).

## 1. Places, continued

Verified against live code + DB 2026-11-14.

- **Bug / friction — "Place made offers no choice" (Pem, screenshot 2026-11-14).** The `place` table is empty (0 places, 0 `work_place`, 0 periods with a suggested place), so the card's Place made select (`WorkPeriodSourceSection.tsx`) only offers "— Not set", with no hint that places are added under Inventory → Periods & sources (`PeriodSourceManager.tsx`). Fix first: when the list is empty (or the place is missing), let the card add a place right there (name, town, country; coordinates optional), and say where the list lives.
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

## Answered, nothing to build

- **"The 641 works with no year"** — Pem: "if you have no data how can you infer anything?" Right: a period is found from a work's date, so a work with no date can only get a period by hand (card or batch modify). Nothing is inferred. If wanted later: a "no year" filter in Inventory to fill dates in batch.

## Still unchecked from the last batch (live)

- Admin views of Overview and batch modify on the live site; the export panel + a real export; a real print (300 dpi, Light B&W, labels on a sheet).
- Phone: opening today's session records place and weather by itself.
- Constellation: the arrow on the first real "painted on" / "derived from" / "answers" link.
