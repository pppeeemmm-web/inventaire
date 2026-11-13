# PEM Hub — TODO

_Open items only, one line each, in order. Details → [`TODO_NOTES.md`](./TODO_NOTES.md). Closed → [`DONE.md`](./DONE.md). Dropped on purpose → [`TODO_REFUSED.md`](./TODO_REFUSED.md). Aims → [`STRATEGY.md`](./STRATEGY.md)._

**Last refresh: 2026-11-13** (verified against live code + DB 2026-11-13). Order inside "To build" follows the aims: trace → links → transmission → value, then the public site, then speed and code health.

## 1. Waiting on Pem — only you can do these

- [ ] **Handwriting test:** give the folder of ~10 notebook pages.
- [ ] **R2 access key rotation (O2)** — not done or not recorded; note the date in `CLAUDE.md`.
- [ ] **Restore drill (O4)** — never run ([`BACKUP_RECOVERY.md`](./BACKUP_RECOVERY.md)).

## 2. To build — in order

Current batch (design build)
- [ ] ~~B2 Batch modify mixer~~ (built 2026-11-13, committed locally) → ~~B1 Overview one-glance dashboard~~ (built 2026-11-13, committed locally) → (A2, A4, A3) → B3 Export with live preview — build from the approved mocks, order in [NEXT](./HANDOFF_2026-11-13_NEXT.md) → [handoff](./HANDOFF_2026-11-13_DESIGN_BUILD.md) (4 decisions for Pem inside: D1–D4)

Trace
- [ ] 1. Handwriting batch (after the test above) → [notes](./TODO_NOTES.md#journal-phase-2)
- [ ] 1b. One plan for every local "reading" AI (owner 2026-11-13: "it all needs rationalization"): handwriting, text in field photos (labels, notebooks, invoices — F9), business-card reader, and the owner's local contact-details scraper. Inventory what exists first; then one engine, one place. Widening field OCR needs the owner's GO (`CLAUDE.md`).
- [ ] 2. Warn when a session photo is staged but never applied → [notes](./TODO_NOTES.md#staged-photos)
- [ ] 3. Production start: partial date input (year / month / day) — not built (the drawer has a full-date field, admin) → [notes](./TODO_NOTES.md#production-start-date)
- [ ] 4. Production span: end date by hand (start is editable since 2026-11-03); new / found choice in WorkForm (only in capture today) → [notes](./TODO_NOTES.md#production-span)

Links
- [ ] 6. Versions: a partial rework (glaze, correction) = a new version of the same work, same number, recorded in its history with its photo (owner 2026-11-13) → [notes](./TODO_NOTES.md#work-or-version)

Transmission (safety of what is kept)
- [ ] 8. Security remaining: anon write grants, `system_log` / `studio_task` access, CSP report-only, `xlsx`, `storage_object_ledger` → [notes](./TODO_NOTES.md#security)

Value
- [ ] 9. Custody follow-ups (custodian address on orders, cancelled consigned sale) → [notes](./TODO_NOTES.md#custody)
- [ ] 10. Money: `is_paid` from payments; clean `sales-client.ts` extras → [notes](./TODO_NOTES.md#money)
- [ ] 11. Supplies: orders table, order → expense → [notes](./TODO_NOTES.md#supplies)
- [ ] 11b. Collector share kit (F5, owner 2026-11-13): one click → a private link for one collector with a selection of works, a printable PDF and an "enquire" button — [archive/STATUS.md](./archive/STATUS.md)
- [ ] 11c. Link Recherche concepts to catalogue themes (F10, owner: "can do") — `concept_themes` junction + UI

Public site — next batch
- [ ] Phones must show the closing text ("outro") of a works sequence on `/works` (owner 2026-11-13: visitors need to see it) — desktop shows it as the last card; decide its place on phones (own last slide, or below the sequence)
- [ ] Status chips in English (translate the DB labels) — after the next batch → [notes](./TODO_NOTES.md#status-labels)
- [ ] 12. Circadian sky leftovers (preview another hour, real shadow direction, inert `atm` knobs) → [notes](./TODO_NOTES.md#circadian)
- [ ] 13. Upload the panorama + video for the map / motion layouts (`site/forest-panorama.avif`, `site/interior-loop.webm`)
- [ ] 14. `/works` gallery: cm-scaled wall scroll (on hold)
- [ ] 15. S6 leftovers (frame counted as a colour, storage per day, iOS share path, `/atelier/site` audit) → [notes](./TODO_NOTES.md#s6)

Speed and code health — measure soon after the next batch
- [ ] 16. Cold load: measure `/atelier/journal?today=1` before changing anything
- [ ] 17. Session flow speed: parallel apply, defer day consolidation, indexed work search → [notes](./TODO_NOTES.md#session-flow)
- [ ] 18. Per-tab lazy Atelier reference fetch · Overview pipeline pulse on the server · Reports on keyset totals · one status-label layer
- [ ] 19. Bundle size check (≤ 250 kB) · slim RSC cold start for Audit / Logistics · ratchet `no-silent-catch` (~258 sites)

## 3. To check once, when it happens (no build)

- [ ] Image descriptions (batch 2026-11-13, 14:00): read a sample (`work_description`, or ⌘K); log in `transcribe-out/describe-batch/`.
- [ ] 2026-11-13 batch after the push: admin screens in Chrome (Local jobs, ✦ bar); one real Production drag-back; saving a contact from the pop-up.
- [ ] Next real field capture: technique / support written; removing an applied photo → [notes](./TODO_NOTES.md#session-write-paths)
- [ ] First real sale + payment, end to end → [notes](./TODO_NOTES.md#money)
- [ ] Concept documents: click through once → [notes](./TODO_NOTES.md#concept-documents)
- [ ] ⌘K on the live site queues new phrases until the PC indexes them (known) → [notes](./TODO_NOTES.md#semantic-search)
- [ ] Procession layout "not working": reopen only with repro steps.

## 4. Parked ideas — no GO

- VAT per sale, resolved from the transaction → [notes](./TODO_NOTES.md#vat)
- Photothèque (~4 000 photos): a **library** (owner 2026-11-13) — standalone photographs, mostly not tied to a work, sometimes serving one → [notes](./TODO_NOTES.md#phototheque)
- Journal entries as Constellation canvas nodes — a big one, not now (owner 2026-11-13) → [notes](./TODO_NOTES.md#journal-phase-2)
- F7 daily digest email (owner: "not sure"; needs an email service) · F6 feature switches · F8 background job outbox — [archive/STATUS.md](./archive/STATUS.md)
- Background jobs / queues · broader field OCR · transactional email (explicit no-GO in `CLAUDE.md`)

## Rules (not tasks)

After a new `public` table: `npm run gen:types` · after schema changes: `grant_audit_queries.sql` · RLS + `GRANT` on new tables · EU R2 endpoint · bilingual copy · 375 px / 44 px phone contract · extend `audit_log_prune()` for new audit tables.
