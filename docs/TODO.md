# PEM Hub — TODO

_Open items only, one line each, in order. Details → [`TODO_NOTES.md`](./TODO_NOTES.md). Closed → [`DONE.md`](./DONE.md). Dropped on purpose → [`TODO_REFUSED.md`](./TODO_REFUSED.md). Aims → [`STRATEGY.md`](./STRATEGY.md)._

**Last refresh: 2026-11-16 pm** (parallel batch 1: B9, 1e, 20, 21 closed → [DONE](./DONE.md); earlier: B7 labels image + period places + two §4 checks closed → [DONE](./DONE.md); earlier: bug batch 1 — B1, B2, B8, B10, 1f — closed → [DONE](./DONE.md); earlier: Pem's screenshots of 2026-11-15 triaged; verified against live code + DB, `origin/main` `2a9c714`). Order: bugs first, then Pem's rethink (design whole screens before building — [RETHINK](./RETHINK_2026-11-14.md)), then the rest. Item numbers are kept from earlier lists (other docs point to them); a closed item leaves for [DONE](./DONE.md) — never ticked in place. No open handoff: this file is the current batch.

## 0. Bugs — fix now (each still needs Pem's GO to edit, `CLAUDE.md`)


## 1. Waiting on Pem — only you can do these

- [ ] **Handwriting test:** give the folder of ~10 notebook pages.
- [ ] **R2 access key rotation (O2)** — not done or not recorded; note the date in `CLAUDE.md`.
- [ ] **Restore drill (O4)** — never run ([`BACKUP_RECOVERY.md`](./BACKUP_RECOVERY.md)).
- [ ] **Batch scan of expenses / dockets (11e):** GO to read dockets by OCR on the PC (widening OCR needs your explicit GO, `CLAUDE.md`), and which scan path (below).

## 2. Rethink — design first (Pem 2026-11-14) → [RETHINK](./RETHINK_2026-11-14.md)

Each one: what the screen is for, a whole-screen design, Pem's say — then build. No tweaks to the current screens meanwhile (bugs in §0 excepted).

- [ ] R1. **Inputs → outputs.** One clear place for inputs (images / documents with their text, voice notes as the main spoken input, writings) feeding the practice; outputs = works via sessions. Takes in: **rename « Voice notes » → « Notes »** (a sketchbook / notebook + voice — the input of the rethink, Pem 2026-11-15); kind (memo / dictation / meeting / field) and project (field / studio / commercial / general) are only chosen while recording (default Memo · General) and cannot be changed after — make them editable or drop them; **spoken keywords** at the start or end of a recording to route a note by itself (after the PC transcript; Pem 2026-11-15); 1b (one plan for every local "reading" AI — widening field OCR needs a GO); 1d (Overview « Reminders » opens voice notes); 11c (concepts ↔ catalogue themes); search re-indexing (Pem: not now); the ⌘K word match with typo tolerance (needs GO; `pg_trgm` not installed) → [notes](./TODO_NOTES.md#inputs)
- [ ] R2. **Mobile terminal reprioritized** for the day-to-day. Takes in: 4b (`/atelier/works/new` keeps its desktop two columns at 375 px); a session work with no « Nouvelle / Ancienne » choice still gets no date — make the choice required?
- [ ] R3. **Work drawer reorganized** — top block + « Création » / « Objet » drawers, empty greyed out, collapse switch; phone recording drawer → [DESIGN_DRAWER](./DESIGN_DRAWER.md); next: mockups.
- [ ] R4. **Timeline + map + previews.** Timeline map / map « Création » mode; `#1234` thumbnail + loupe everywhere (Notes triage « #2357 · Les mortes marguerites » has neither — Pem 2026-11-15); a title next to the number in the AI suggestion rows → [notes](./TODO_NOTES.md#previews)
- [ ] R6. **Exhibitions → « Exhibitions / events »** (Pem 2026-11-15): collaborations live there too; **editions** (prints, books… issued from a series) as an in-between state — taken out of the inventory, then back. An event is about works (a print-series launch is one): a group of works tracked out and back + what to prepare; PR and books / publications stay in Pipeline (Pem 2026-11-15, [RETHINK](./RETHINK_2026-11-14.md)). Ties to the custody model ([`WORK_CUSTODY_MODEL.md`](./WORK_CUSTODY_MODEL.md)).
- [ ] R8. **Public site, from the review of 2026-11-16** → [SITE_REVIEW](./SITE_REVIEW_2026-11-16.md): paintings shown big, one page per work (`/works/[id]-[slug]`), a landing that says who / what in 3 s, 1200×630 JPEG previews, ISR + images off `r2.dev`, one name, real FR / EN, About / Practice content, calls to action (buy / commission / newsletter / Instagram), captions with medium. Daily feed: public journal entries at `/journal` + RSS → weekly letter (Buttondown / Kit) + Instagram pointing back (needs a `public` visibility value, anon read policy + GRANT, a screen design, Pem's GO). Pem picks what goes first.
- [ ] R7. **Commercial: orders and their papers in one place** (Pem 2026-11-15: « this needs to be rationalized »). Today: sales in « Sales » (order + PDF), consignment / loan slips in **Pipeline** (`createConsignmentOrder` → « Bordereau » PDF in the Vault), gift slip in the **work card** gift dialog (« Bordereau de Don »). Consignment is not a sale → rename « Sales » to « Orders »? Not proven: **0 sale orders, 0 consignment / loan orders** in the data (6 gifts) — no path clicked through yet → [notes](./TODO_NOTES.md#custody)

## 3. To build — outside the rethink (needs GO)

Trace
- [ ] 1. Handwriting batch (after the test above) → [notes](./TODO_NOTES.md#journal-phase-2)
- [ ] 1c. Voice notes longer than one upload (~4 MB) or recorded offline → build only if Pem hits either ≥2× → [notes](./TODO_NOTES.md#voice-limits)

Links
- [ ] 6. Rework on the same work = a « Reprise » line in « Historique de création » + its own photo (no version table, no link) → [notes](./TODO_NOTES.md#work-or-version)

Transmission (safety of what is kept)
- [ ] 8. Security remaining: `system_log` / `studio_task` access, CSP report-only, `xlsx` → [notes](./TODO_NOTES.md#security) (anon grants + ledger closed 2026-11-16 → [DONE](./DONE.md))

Value
- [ ] 9. Custody follow-ups (custodian address on orders, cancelled consigned sale) → [notes](./TODO_NOTES.md#custody)
- [ ] 10. Money: `is_paid` from payments; clean `sales-client.ts` extras → [notes](./TODO_NOTES.md#money)
- [ ] 11. Supplies: orders table, order → expense → [notes](./TODO_NOTES.md#supplies)
- [ ] 11d. **Supplier invoice → stock + supplier** (Pem 2026-11-15 asked how it works: **it does not today**). An expense (Income & Expenses: bill / ticket) is typed by hand and touches neither stock quantities nor the supplier list; stock moves only by Count. Design with 11; reading the invoice by itself = OCR → needs GO → [notes](./TODO_NOTES.md#supplies)
- [ ] 11e. **Batch scan of expenses and dockets** (Pem 2026-11-15): scan many dockets in one go on the iPhone → a folder the PC sees → a PC batch (like `scripts/transcribe/`) reads each one and proposes an expense (date, supplier, amount, VAT, `receipt_ref`) to confirm, the scan kept in the Vault « Factures ». Needs the OCR GO (§1); with 11d (lines → stock) → [notes](./TODO_NOTES.md#docket-scan)
- [ ] 11b. Collector share kit (F5): a private link for one collector with a selection, a PDF and an "enquire" button — [archive/STATUS.md](./archive/STATUS.md)

Public site — next batch
- [ ] Phones must show the closing text ("outro") of a works sequence on `/works` — decide its place (own last slide, or below)
- [ ] Status chips in English (translate the DB labels) → [notes](./TODO_NOTES.md#status-labels)
- [ ] 12. Circadian sky leftovers → [notes](./TODO_NOTES.md#circadian)
- [ ] 13. Upload the panorama + video for the map / motion layouts (`site/forest-panorama.avif`, `site/interior-loop.webm`)
- [ ] 14. `/works` gallery: cm-scaled wall scroll (on hold)
- [ ] 15. S6 leftovers → [notes](./TODO_NOTES.md#s6)

Speed and code health — measure first, change after
- [ ] 17. Session flow speed → [notes](./TODO_NOTES.md#session-flow)
- [ ] 18. Per-tab lazy Atelier reference fetch (work card + Overview one-read open done 2026-11-16 → [DONE](./DONE.md)); a deep link `?work=347` opens two drawers (Inventory panel + overlay), each reading once · Overview pipeline pulse on the server · Reports on keyset totals · one status-label layer
- [ ] 19. Overview stops loading catalogue chunks it doesn't need; Inventory loads its ~500-work chunks in parallel (full catalogue 22–27 s live) · bundle size check (≤ 250 kB) · slim RSC cold start for Audit / Logistics · ratchet `no-silent-catch` (~258 sites)

## 4. To check once, when it happens (no build)

- [ ] Notes (bug batch 1, What's new 3.1.20), live as admin: « Couleur » shows its ✦ PC transcript; edit, switch note → Save / Discard / Cancel.
- [ ] Export labels (`00f8085` QR, B7 image): print one real sheet — L7163 with image + QR, L7651 with QR — check the picture and the cut text by eye, scan one QR with the phone.
- [ ] Waiting photos + production dates (`85b450c`): one real waiting photo on the Journal day and the work card; an admin save of a start / end date; a « Nouvelle » work starts production today.
- [ ] « Historique de création » (`e48eac8`): a real line saved, edited, deleted; Inventory « Périodes à trancher » filter and the route line.
- [ ] Journal on the phone, live, after the speed fix (`0e7a160`): how long until the day shows.
- [ ] Small GIFs (TODO 21, 3.1.28): a real 40 × 40 GIF and a round one, opened on the phone.
- [ ] Speed (TODO 18, 3.1.29): open 3 work cards and the Overview on the live site as admin — cost section and a sold work's return-window banner fill in; re-measure (was 5.5–7 s / 7.5–10 s).
- [ ] Journal ✦ suggestions (B12, 3.1.29): hover a « ✦ #1316 » row as admin → preview + loupe.
- [ ] Constellation tools (TODO 20, 3.1.28): undo of a real link delete on the live site (the link must come back with its note); Shift+drag marquee; arrow tool.
- [ ] Slideshow (`bab78b6`, `7caaebe`): a GIF of 20+ works; full screen + swipe on a real iPhone; « Renommer »; fade / slide by eye; a full loop.
- [ ] Live, from the 2026-11-13/14 batches: admin Overview and batch modify; a real export; a real print (300 dpi, Light B&W, labels); admin screens in Chrome (Local jobs, ✦ bar); one Production drag-back; saving a contact from the pop-up.
- [ ] Constellation: the arrow on the first real "painted on" / "derived from" / "answers" link.
- [ ] Next real field capture: technique / support written; removing an applied photo → [notes](./TODO_NOTES.md#session-write-paths)
- [ ] First real sale + payment, end to end (see R7) → [notes](./TODO_NOTES.md#money)
- [ ] Concept documents: click through once → [notes](./TODO_NOTES.md#concept-documents)
- [ ] ⌘K on the live site queues new phrases until the PC indexes them (known; Local jobs « Search index backlog » 1 182 on 2026-11-15) → [notes](./TODO_NOTES.md#semantic-search)
- [ ] Procession layout "not working": reopen only with repro steps.

## 5. Parked ideas — no GO

- VAT per sale, resolved from the transaction → [notes](./TODO_NOTES.md#vat)
- Photothèque (~4 000 photos): a **library**, needs a different system, another time → [notes](./TODO_NOTES.md#phototheque)
- Writings as an output (Pem 2026-11-14: "we'll leave it for now").
- A "no year" filter in Inventory to fill dates in batch — only if wanted (641 works have no year).
- Journal entries as Constellation canvas nodes — a big one, not now → [notes](./TODO_NOTES.md#journal-phase-2)
- F7 daily digest email · F6 feature switches · F8 background job outbox — [archive/STATUS.md](./archive/STATUS.md)
- Background jobs / queues · broader field OCR · transactional email (explicit no-GO in `CLAUDE.md`)

## Rules (not tasks)

After a new `public` table: `npm run gen:types` · after schema changes: `grant_audit_queries.sql` · RLS + `GRANT` on new tables · EU R2 endpoint · bilingual copy · 375 px / 44 px phone contract · extend `audit_log_prune()` for new audit tables · **pivots and side sections collapsed by default** · a closed item moves to `DONE.md` the same day (no ✓ inside an open line).
