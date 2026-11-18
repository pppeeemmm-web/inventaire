# PEM Hub — TODO

_Open items only, one line each, in order. Details → [`TODO_NOTES.md`](./TODO_NOTES.md). Closed → [`DONE.md`](./DONE.md). Dropped on purpose → [`TODO_REFUSED.md`](./TODO_REFUSED.md). Aims → [`STRATEGY.md`](./STRATEGY.md)._

**Last refresh: 2026-11-18, night** (tidied: each R is one line of what is left; the build history moved to [DONE](./DONE.md) « 2026-11-18 — Rethink history »). Order: bugs first, then what waits on Pem, then the rethink leftovers, then the rest. Item numbers are kept from earlier lists (other docs point to them); a closed item leaves for [DONE](./DONE.md) — never ticked in place. Board: [`Rethink_Board.html`](./design/2026-11-17/Rethink_Board.html).

## 0. Bugs — fix now (each still needs Pem's GO to edit, `CLAUDE.md`)

_None open (B13, B14 closed 2026-11-17 → [DONE](./DONE.md))._

## 1. Waiting on Pem — only you can do these

- [ ] **Lawyer / accountant read:** [`LEGAL_POLICY.md`](./LEGAL_POLICY.md), [`WEBSITE_LEGAL_PAGES.md`](./WEBSITE_LEGAL_PAGES.md), [`POLICY_NOTES.md`](./POLICY_NOTES.md), the order papers ([`R7_Papers_Wording.md`](./design/2026-11-17/R7_Papers_Wording.md)); the VAT rate for the order form's VAT line. The site has no legal notice yet.
- [ ] **Your look:** R4 (Chronologie, the map « Création », thumbnails on work numbers), R6 (Studio → Expositions, empty until your first event).
- [ ] **Phone navigation:** Aujourd'hui and the Journal day show the same day twice (Pem 2026-11-18: « make navigation more mobile straightforward ») — say when to start the whole-screen design.
- [ ] **Site module:** fill email, phone and Instagram.
- [ ] **R8 look decisions:** A (big painting vs true-scale wall), then B (a work's page), C (landing), D (one name) → [`R8_SiteAssessment.notes.md`](./design/2026-11-17/R8_SiteAssessment.notes.md).
- [ ] **Restore drill (O4)** — never run ([`BACKUP_RECOVERY.md`](./BACKUP_RECOVERY.md)); 20 minutes together.
- [ ] **#2381:** first step or catalogued? (Work rules, Audit → Règles).
- [ ] **Handwriting test:** give the folder of ~10 notebook pages.
- [ ] **R2 access key rotation (O2)** — not done or not recorded; note the date in `CLAUDE.md`.
- [ ] **Batch scan of expenses / dockets (11e):** GO to read dockets by OCR on the PC (widening OCR needs your explicit GO, `CLAUDE.md`), and which scan path (below).

## 2. Rethink leftovers → [RETHINK](./RETHINK_2026-11-14.md) · [board](./design/2026-11-17/Rethink_Board.html)

R1–R7 are built and pushed (history → [DONE](./DONE.md)). Only what is left:

- [ ] R1 / R2: storing the ✦ match score (SQL; Pem « if necessary, go »); the cached-copy check on the phone (airplane mode after one Wi-Fi open).
- [ ] R6: editions part 2, at the first real edition.
- [ ] R7: line value editable after creation; « Confié » ↔ Production board tasks; a share button for papers. R7b order chain **built 2026-11-18** (`ac04469`, SQL live; not clicked on data — it would use real order / invoice numbers) → [`R7b_OrderCascade.notes.md`](./design/2026-11-18/R7b_OrderCascade.notes.md) « Built » for its gaps; order dates in the calendar live (`f18fb99`, SQL applied on Pem's « Apply both »); Kaizen Création → Idées proposal waits for Pem ([notes](./design/2026-11-18/KaizenCreation_to_Ideas.notes.md)).
- [ ] R8. **Public site** → [SITE_REVIEW](./SITE_REVIEW_2026-11-16.md): first batch and enquiry categories live; knobs saved; next after Pem's look decisions — one page per work (`/works/[id]-[slug]`), landing, one name, real FR / EN, About / Practice content, daily feed (`/journal` + RSS → weekly letter + Instagram, needs SQL + a screen design + GO).

## 3. To build — outside the rethink (needs GO)

Trace
- [ ] 22. Work card leftovers (R3 closed 2026-11-17 → [DONE](./DONE.md)): OK `supabase/sql/place_validity_dates.sql` (place from / to dates; the place-vs-date rule no-ops until then) + a screen to enter those dates · the work session's own « + œuvre » flow in the phone recording screen · « Brouillon » on the recording screen (« Annuler » for now) · 3 card files no longer used (`DrawerContentIdentitySection.tsx`, `DrawerContentNotesVersionSection.tsx`, `DrawerContentGroupsSection.tsx`) — delete on Pem's OK. Place dates: Pem « not sure » (2026-11-18) — park unless needed.
- [ ] 1. Handwriting batch (after the test above) → [notes](./TODO_NOTES.md#journal-phase-2)
- [ ] 1c. Voice notes longer than one upload (~4 MB) or recorded offline → build only if Pem hits either ≥2× → [notes](./TODO_NOTES.md#voice-limits)

Links

Transmission (safety of what is kept)

Value
- [ ] 9. Custody follow-ups (custodian address on orders, cancelled consigned sale) → [notes](./TODO_NOTES.md#custody)
- [ ] 10. Money: `is_paid` from payments; clean `sales-client.ts` extras → [notes](./TODO_NOTES.md#money)
- [ ] 11. Supplies: orders table, order → expense → [notes](./TODO_NOTES.md#supplies) **GO 2026-11-18** — design + build in session supplies-stock (with 11d).
- [ ] 11d. **Supplier invoice → stock + supplier** (Pem 2026-11-15 asked how it works: **it does not today**). An expense (Income & Expenses: bill / ticket) is typed by hand and touches neither stock quantities nor the supplier list; stock moves only by Count. Design with 11; reading the invoice by itself = OCR → needs GO → [notes](./TODO_NOTES.md#supplies) **GO 2026-11-18** (no OCR) — session supplies-stock.
- [ ] 11e. **Batch scan of expenses and dockets** (Pem 2026-11-15): scan many dockets in one go on the iPhone → a folder the PC sees → a PC batch (like `scripts/transcribe/`) reads each one and proposes an expense (date, supplier, amount, VAT, `receipt_ref`) to confirm, the scan kept in the Vault « Factures ». Needs the OCR GO (§1); with 11d (lines → stock) → [notes](./TODO_NOTES.md#docket-scan)
- [ ] 11b. Collector share kit (F5): a private link for one collector with a selection, a PDF and an "enquire" button — [archive/STATUS.md](./archive/STATUS.md) **Drafted 2026-11-18** → [`Collector_ShareKit.notes.md`](./design/2026-11-18/Collector_ShareKit.notes.md) + mockup; Pem's 8 answers recorded in the notes (2026-11-18); build waits for a GO.

Public site — next batch
- [ ] Phones must show the closing text ("outro") of a works sequence on `/works` — decide its place (own last slide, or below)
- [ ] Status chips in English (translate the DB labels) → [notes](./TODO_NOTES.md#status-labels)
- [ ] 12. Circadian sky leftovers → [notes](./TODO_NOTES.md#circadian)
- [ ] 13. Upload the panorama + video for the map / motion layouts (`site/forest-panorama.avif`, `site/interior-loop.webm`)
- [ ] 14. `/works` gallery: cm-scaled wall scroll (on hold)
- [ ] 15. S6 leftovers → [notes](./TODO_NOTES.md#s6)

Speed and code health — measure first, change after
- [ ] 17. Session flow speed → [notes](./TODO_NOTES.md#session-flow)
- [ ] 18. Per-tab lazy Atelier reference fetch (work card + Overview one-read open, deep link = one card, Overview counts on the server done 2026-11-16 → [DONE](./DONE.md)) · the background full-catalogue load still runs on every tab (Overview / Journal don't need it once their counts are server-side) · Reports on keyset totals · one status-label layer
- [ ] 19. Bundle size check (≤ 250 kB) · slim RSC cold start for Audit / Logistics · ratchet `no-silent-catch` (~258 sites). (Catalogue in one call done 2026-11-16; the Overview's counts now come from the server, item 18.)

## 4. To check once, when it happens (no build)

- [ ] Voice-note chip in the work card (Création › Commentaires & notes, R3): not yet seen live — no work with a linked voice note at hand; look when one exists.
- [ ] Notes (bug batch 1, What's new 3.1.20), live as admin: « Couleur » shows its ✦ PC transcript; edit, switch note → Save / Discard / Cancel.
- [ ] Export labels (`00f8085` QR, B7 image): print one real sheet — L7163 with image + QR, L7651 with QR — check the picture and the cut text by eye, scan one QR with the phone.
- [ ] Waiting photos + production dates (`85b450c`): one real waiting photo on the Journal day and the work card; an admin save of a start / end date; a « Nouvelle » work starts production today.
- [ ] « Historique de création » (`e48eac8`): a real line saved, edited, deleted; Inventory « Périodes à trancher » filter and the route line.
- [ ] Journal on the phone, live, after the speed fix (`0e7a160`): how long until the day shows.
- [ ] Small GIFs (TODO 21, 3.1.28): a real 40 × 40 GIF and a round one, opened on the phone.
- [ ] Catalogue in one call (TODO 19, 3.1.30): Inventory full catalogue time on the live site (was 22–27 s).
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
