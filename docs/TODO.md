# PEM Hub — TODO

_Open items only, one line each, in order. Details → [`TODO_NOTES.md`](./TODO_NOTES.md). Closed → [`DONE.md`](./DONE.md). Dropped on purpose → [`TODO_REFUSED.md`](./TODO_REFUSED.md). Aims → [`STRATEGY.md`](./STRATEGY.md)._

**Last refresh: 2026-11-15** (verified against live code + DB + `origin/main` `7caaebe` 2026-11-15). Pem's rethink comes first: design whole screens before building ([RETHINK](./RETHINK_2026-11-14.md)). Item numbers are kept from earlier lists (other docs point to them); a closed item leaves for [DONE](./DONE.md) — never ticked in place.

## 1. Waiting on Pem — only you can do these

- [ ] **Handwriting test:** give the folder of ~10 notebook pages.
- [ ] **R2 access key rotation (O2)** — not done or not recorded; note the date in `CLAUDE.md`.
- [ ] **Restore drill (O4)** — never run ([`BACKUP_RECOVERY.md`](./BACKUP_RECOVERY.md)).
- [ ] **Period places:** Waterford / Rebirth and Youth have no place yet (Marseille and Tooreeney do) — give the addresses, or set them in Inventory → Périodes & sources.

## 2. Rethink — design first (Pem 2026-11-14) → [RETHINK](./RETHINK_2026-11-14.md)

Each one: what the screen is for, a whole-screen design, Pem's say — then build. No tweaks to the current screens meanwhile. (R5 slideshow: built and pushed 2026-11-15 → [DONE](./DONE.md); live checks in §4.)

- [ ] R1. **Inputs → outputs.** One clear place for inputs (images / documents with their text, voice notes as the main spoken input, writings) feeding the practice; outputs = works via sessions. Clears the research / concepts / voice notes / « reminders » / AI suggestions / search confusion. Takes in: 1b (one plan for every local "reading" AI — inventory first, widening field OCR needs a GO), 1d (Overview tile « Reminders » opens voice notes, `od_rem_*`), 11c (concepts ↔ catalogue themes — hold until R1), search indexing (whole re-index each time vs one by one — Pem: not now), and the ⌘K proposal after « degas » found nothing: a word match over the works' search text with typo tolerance, so ⌘K answers with the PC off (needs GO; `pg_trgm` not installed).
- [ ] R2. **Mobile terminal reprioritized** for the day-to-day, not the sales on the welcome page. Takes in: 4b (`/atelier/works/new` keeps its desktop two columns at 375 px; the menu leads there since ➕ left the bar); a session work with no « Nouvelle / Ancienne » choice still gets no date, so no period (46 backfilled 2026-11-14) — make the choice required?
- [ ] R3. **Work drawer reorganized** — a quicker, organized glance at everything. Replaces "empty fields folded" ([NEXT §4](./HANDOFF_2026-11-14_NEXT.md)). Step 1 done 2026-11-15: inventory + live emptiness + proposed grouping, 5 questions for Pem → [DESIGN_DRAWER](./DESIGN_DRAWER.md); next: mockups.
- [ ] R4. **Timeline + map + previews.** Takes in: timeline map / map « Création » mode (places with coordinates, works by date), `#1234` thumbnail + loupe everywhere, and a title next to the number in the AI suggestion rows ([NEXT §5](./HANDOFF_2026-11-14_NEXT.md) lists every plain `#id` link).

## 3. To build — outside the rethink

Trace
- [ ] 1. Handwriting batch (after the test above) → [notes](./TODO_NOTES.md#journal-phase-2)
- [ ] 1c. Voice notes, after the record-first sheet (2026-11-14): a note longer than one upload (~4 MB — auto-stopped today, the owner starts a new one) → browser → R2 direct upload (needs a CORS PUT rule on the public bucket); a note recorded with no network is kept only while the sheet is open → keep it on the phone (IndexedDB) and send later. Build only if Pem hits either ≥2×.
- [ ] 1f. Bug: the work card's field-session list says « 1 photos » (no singular; `DrawerWorkSessionsSection.tsx`, Pem screenshot 2026-11-14).
- [ ] 1e. Drop `work_place`: no code reads or writes it since 2026-11-14 (« Historique de création »); its 2 rows are in `work_creation_step`. A one-line SQL — show it, apply with Pem's OK.

Links
- [ ] 6. Versions: a partial rework (glaze, correction) = a new version of the same work, same number, recorded in its history with its photo (owner 2026-11-13) → [notes](./TODO_NOTES.md#work-or-version)

Transmission (safety of what is kept)
- [ ] 8. Security remaining: anon write grants, `system_log` / `studio_task` access, CSP report-only, `xlsx`, `storage_object_ledger` → [notes](./TODO_NOTES.md#security)

Value
- [ ] 9. Custody follow-ups (custodian address on orders, cancelled consigned sale) → [notes](./TODO_NOTES.md#custody)
- [ ] 10. Money: `is_paid` from payments; clean `sales-client.ts` extras → [notes](./TODO_NOTES.md#money)
- [ ] 11. Supplies: orders table, order → expense → [notes](./TODO_NOTES.md#supplies)
- [ ] 11b. Collector share kit (F5, owner 2026-11-13): one click → a private link for one collector with a selection of works, a printable PDF and an "enquire" button — [archive/STATUS.md](./archive/STATUS.md)

Public site — next batch
- [ ] Phones must show the closing text ("outro") of a works sequence on `/works` (owner 2026-11-13: visitors need to see it) — desktop shows it as the last card; decide its place on phones (own last slide, or below the sequence)
- [ ] Status chips in English (translate the DB labels) → [notes](./TODO_NOTES.md#status-labels)
- [ ] 12. Circadian sky leftovers (preview another hour, real shadow direction, inert `atm` knobs) → [notes](./TODO_NOTES.md#circadian)
- [ ] 13. Upload the panorama + video for the map / motion layouts (`site/forest-panorama.avif`, `site/interior-loop.webm`)
- [ ] 14. `/works` gallery: cm-scaled wall scroll (on hold)
- [ ] 15. S6 leftovers (frame counted as a colour, storage per day, iOS share path, `/atelier/site` audit) → [notes](./TODO_NOTES.md#s6)

Speed and code health — measure first, change after
- [ ] 16b. Live measures (read only): Inventory first paint + full catalogue, opening a work card, Overview; compare with the last ones. (The Journal's own cold load was measured and fixed 2026-11-14 — DONE.)
- [ ] 17. Session flow speed: parallel apply, defer day consolidation, indexed work search → [notes](./TODO_NOTES.md#session-flow)
- [ ] 18. Per-tab lazy Atelier reference fetch · Overview pipeline pulse on the server · Reports on keyset totals · one status-label layer
- [ ] 19. Bundle size check (≤ 250 kB) · slim RSC cold start for Audit / Logistics · ratchet `no-silent-catch` (~258 sites)

## 4. To check once, when it happens (no build)

- [ ] Waiting photos + production dates (`85b450c`): one real waiting photo on the Journal day and the work card; an admin save of a year / month start or end; a work created with « Nouvelle » starts production today.
- [ ] « Historique de création » (`e48eac8`): a real line saved, edited, deleted; Inventory « Périodes à trancher » filter and the route line (« Tooreeney → Marseille ») in a browser.
- [ ] Journal on the phone, live, after the speed fix (`0e7a160`): how long until the day shows.
- [ ] Slideshow (`bab78b6`, `7caaebe`): a GIF of 20+ works (size, time); full screen + swipe on a real iPhone; « Renommer » in Diaporamas; fade / slide by eye; a full loop of auto-advance.
- [ ] Live, from the 2026-11-13/14 batches: admin Overview and batch modify; the export panel + a real export; a real print (300 dpi, Light B&W, labels on a sheet); admin screens in Chrome (Local jobs, ✦ bar); one real Production drag-back; saving a contact from the pop-up.
- [ ] Phone: opening today's session records place and weather by itself.
- [ ] Constellation: the arrow on the first real "painted on" / "derived from" / "answers" link.
- [ ] Image descriptions: 1 174 written, none rated yet (2026-11-14) — read a sample (work card or ⌘K); log in `transcribe-out/describe-batch/`.
- [ ] Next real field capture: technique / support written; removing an applied photo → [notes](./TODO_NOTES.md#session-write-paths)
- [ ] First real sale + payment, end to end → [notes](./TODO_NOTES.md#money)
- [ ] Concept documents: click through once → [notes](./TODO_NOTES.md#concept-documents)
- [ ] ⌘K on the live site queues new phrases until the PC indexes them (known) → [notes](./TODO_NOTES.md#semantic-search)
- [ ] Procession layout "not working": reopen only with repro steps.

## 5. Parked ideas — no GO

- VAT per sale, resolved from the transaction → [notes](./TODO_NOTES.md#vat)
- Photothèque (~4 000 photos): a **library** (owner 2026-11-13) — standalone photographs, mostly not tied to a work; Pem 2026-11-14: needs a different system, another time → [notes](./TODO_NOTES.md#phototheque)
- Writings as an output (Pem 2026-11-14: "we'll leave it for now").
- A "no year" filter in Inventory to fill dates in batch — only if wanted (641 works have no year; a period can't be inferred without a date, Pem 2026-11-14).
- Journal entries as Constellation canvas nodes — a big one, not now (owner 2026-11-13) → [notes](./TODO_NOTES.md#journal-phase-2)
- F7 daily digest email (owner: "not sure"; needs an email service) · F6 feature switches · F8 background job outbox — [archive/STATUS.md](./archive/STATUS.md)
- Background jobs / queues · broader field OCR · transactional email (explicit no-GO in `CLAUDE.md`)

## Rules (not tasks)

After a new `public` table: `npm run gen:types` · after schema changes: `grant_audit_queries.sql` · RLS + `GRANT` on new tables · EU R2 endpoint · bilingual copy · 375 px / 44 px phone contract · extend `audit_log_prune()` for new audit tables · a closed item moves to `DONE.md` the same day (no ✓ inside an open line).
