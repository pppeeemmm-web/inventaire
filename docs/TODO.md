# PEM Hub — TODO

_Open items only, one line each, in order. Details → [`TODO_NOTES.md`](./TODO_NOTES.md). Closed → [`DONE.md`](./DONE.md). Dropped on purpose → [`TODO_REFUSED.md`](./TODO_REFUSED.md). Aims → [`STRATEGY.md`](./STRATEGY.md)._

**Last refresh: 2026-11-13** (verified against live code + DB 2026-11-13). Order inside "To build" follows the aims: trace → links → transmission → value, then the public site, then speed and code health.

## 1. Waiting on Pem — only you can do these

- [ ] **Vercel env:** set `NEXT_PUBLIC_SITE_URL` to `https://www.thepemworkshop.com` — the live site's canonical, OG and sitemap links read `http://` today.
- [ ] **Vercel env:** delete the `QDRANT_*` variables (Qdrant was retired 2026-11-02).
- [ ] **Voice:** OK the first transcript write (1 note, 8 Aug 2026, read back in French) — then "Run on this PC" in Overview → Local jobs.
- [ ] **Image descriptions:** Gemma chosen (2026-11-13). Say GO for a batch, and whether to add an "echoes" line (artists / styles it recalls, marked AI) — you liked that in round 1. Report: [`TRANSCRIPTION_BATCHES.md`](./TRANSCRIPTION_BATCHES.md).
- [ ] **Handwriting test:** give the folder of ~10 notebook pages.
- [ ] **Four works, which cover?** #272, #1434, #2103, #2339 — look at the pictures. → [notes](./TODO_NOTES.md#four-covers)
- [ ] **R2 access key rotation (O2)** — not done or not recorded; note the date in `CLAUDE.md`.
- [ ] **Restore drill (O4)** — never run ([`BACKUP_RECOVERY.md`](./BACKUP_RECOVERY.md)).
- [ ] **Decisions:** status chips in English (translate the DB labels?) → [notes](./TODO_NOTES.md#status-labels) · consignment sales in recettes: gross or net (ask the accountant) → [notes](./TODO_NOTES.md#money) · carousel outro card on the phone (own slide or below?).

## 2. To build — in order

Trace
- [ ] 1. Handwriting batch (after the test above) → [notes](./TODO_NOTES.md#journal-phase-2)
- [ ] 2. Warn when a session photo is staged but never applied → [notes](./TODO_NOTES.md#staged-photos)
- [ ] 3. Production start: partial date input (year / month / day) → [notes](./TODO_NOTES.md#production-start-date)
- [ ] 4. Production span: set dates by hand; new / found choice in WorkForm → [notes](./TODO_NOTES.md#production-span)
- [ ] 5. Overview reminder when the PC archive is older than 14 days → [notes](./TODO_NOTES.md#restore-drill-and-archive)

Links
- [ ] 6. Work or version: a partial rework = a version on the same number (the links part is built) → [notes](./TODO_NOTES.md#work-or-version)
- [ ] 7. Journal entries as Constellation canvas nodes — needs a canvas redesign, no GO yet → [notes](./TODO_NOTES.md#journal-phase-2)

Transmission (safety of what is kept)
- [ ] 8. Security remaining: anon write grants, `system_log` / `studio_task` access, CSP report-only, `xlsx`, `storage_object_ledger` → [notes](./TODO_NOTES.md#security)

Value
- [ ] 9. Custody follow-ups (custodian address on orders, cancelled consigned sale) → [notes](./TODO_NOTES.md#custody)
- [ ] 10. Money: `is_paid` from payments; clean `sales-client.ts` extras → [notes](./TODO_NOTES.md#money)
- [ ] 11. Supplies: orders table, order → expense → [notes](./TODO_NOTES.md#supplies)

Public site
- [ ] 12. Circadian sky leftovers (preview another hour, real shadow direction, inert `atm` knobs) → [notes](./TODO_NOTES.md#circadian)
- [ ] 13. Upload the panorama + video for the map / motion layouts (`site/forest-panorama.avif`, `site/interior-loop.webm`)
- [ ] 14. `/works` gallery: cm-scaled wall scroll (on hold)
- [ ] 15. S6 leftovers (frame counted as a colour, storage per day, iOS share path, `/atelier/site` audit) → [notes](./TODO_NOTES.md#s6)

Speed and code health (measure first)
- [ ] 16. Cold load: measure `/atelier/journal?today=1` before changing anything
- [ ] 17. Session flow speed: parallel apply, defer day consolidation, indexed work search → [notes](./TODO_NOTES.md#session-flow)
- [ ] 18. Per-tab lazy Atelier reference fetch · Overview pipeline pulse on the server · Reports on keyset totals · one status-label layer
- [ ] 19. Bundle size check (≤ 250 kB) · slim RSC cold start for Audit / Logistics · ratchet `no-silent-catch` (~258 sites)

## 3. To check once, when it happens (no build)

- [ ] 2026-11-13 batch after the push: admin screens in Chrome (Local jobs, ✦ bar); one real Production drag-back; saving a contact from the pop-up.
- [ ] Next real field capture: technique / support written; removing an applied photo → [notes](./TODO_NOTES.md#session-write-paths)
- [ ] First real sale + payment, end to end → [notes](./TODO_NOTES.md#money)
- [ ] Concept documents: click through once → [notes](./TODO_NOTES.md#concept-documents)
- [ ] ⌘K on the live site queues new phrases until the PC indexes them (known) → [notes](./TODO_NOTES.md#semantic-search)
- [ ] Procession layout "not working": reopen only with repro steps.

## 4. Parked ideas — no GO

- VAT per sale, resolved from the transaction → [notes](./TODO_NOTES.md#vat)
- Photothèque (~4 000 photos): documentation or library? → [notes](./TODO_NOTES.md#phototheque)
- F2–F10 (preview token, quick-add, saved searches, share kit, flags, digest, outbox, OCR, `concept_themes`) — [archive/STATUS.md](./archive/STATUS.md)
- Background jobs / queues · broader field OCR · transactional email (explicit no-GO in `CLAUDE.md`)

## Rules (not tasks)

After a new `public` table: `npm run gen:types` · after schema changes: `grant_audit_queries.sql` · RLS + `GRANT` on new tables · EU R2 endpoint · bilingual copy · 375 px / 44 px phone contract · extend `audit_log_prune()` for new audit tables.
