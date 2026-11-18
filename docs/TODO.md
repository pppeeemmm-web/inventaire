# PEM Hub — TODO

_Open items only, one line each. Details → [`TODO_NOTES.md`](./TODO_NOTES.md). Closed → [`DONE.md`](./DONE.md). Dropped → [`TODO_REFUSED.md`](./TODO_REFUSED.md). Aims → [`STRATEGY.md`](./STRATEGY.md). Board → [`Rethink_Board.html`](./design/2026-11-17/Rethink_Board.html)._

**Refreshed 2026-11-18, late** — everything built is on `origin/main` (What's new 3.1.60). Item numbers are kept (other docs point to them); a closed item moves to [DONE](./DONE.md) the same day.

## 0. Bugs — fix now

_None open._

## 1. Waiting on you, Pem

Decisions (a form or one word):
- [ ] **Old comments:** empty the old field on the 94 works whose text is already in a line (#2381…); move the 8 others into a line? (form sent 2026-11-18)
- [ ] **Work card (22):** delete the 3 unused card files? « Brouillon » on the phone recording screen? (form sent 2026-11-18)
- [ ] **Phone navigation:** designed with your 6 answers ([`PhoneNav.notes.md`](./design/2026-11-18/PhoneNav.notes.md), option A) — GO to build.
- [ ] **Collector share kit (11b):** designed with your 8 answers ([`Collector_ShareKit.notes.md`](./design/2026-11-18/Collector_ShareKit.notes.md)) — GO to build.
- [ ] **R8 look decisions:** A (big painting vs true-scale wall), then B (a work's page), C (landing), D (one name) → [`R8_SiteAssessment.notes.md`](./design/2026-11-17/R8_SiteAssessment.notes.md).
- [ ] **#2381:** first step or catalogued? (Audit → Règles)
- [ ] **Docket scan (11e):** GO to read dockets by OCR on the PC, and which scan path.

Things only you can do:
- [ ] **Lawyer / accountant:** [`LEGAL_POLICY.md`](./LEGAL_POLICY.md), [`WEBSITE_LEGAL_PAGES.md`](./WEBSITE_LEGAL_PAGES.md), [`POLICY_NOTES.md`](./POLICY_NOTES.md), the order papers ([`R7_Papers_Wording.md`](./design/2026-11-17/R7_Papers_Wording.md)); the VAT rate for the order form. The site has no legal notice yet.
- [ ] **Your look:** R4 (Chronologie, map « Création », thumbnails), R6 (Studio → Expositions).
- [ ] **Site module:** fill email, phone and Instagram.
- [ ] **Restore drill (O4):** never run ([`BACKUP_RECOVERY.md`](./BACKUP_RECOVERY.md)) — 20 minutes together.
- [ ] **Handwriting test:** the folder of ~10 notebook pages.
- [ ] **R2 access key rotation (O2):** not done or not recorded; note the date in `CLAUDE.md`.
- [ ] **Phone check:** the cached copy — open Aujourd'hui once on Wi-Fi, then airplane mode and reopen.

## 2. Rethink leftovers → [RETHINK](./RETHINK_2026-11-14.md)

R1–R7 built and pushed (history → [DONE](./DONE.md)).

- [ ] R1: store the ✦ match score (SQL) — only if the ✦ suggestions feel noisy (Pem « if necessary, go »).
- [ ] R6: editions part 2 — at the first real edition.
- [ ] R8. **Public site** → [SITE_REVIEW](./SITE_REVIEW_2026-11-16.md): after your look decisions — one page per work (`/works/[id]-[slug]`), landing, one name, real FR / EN, About / Practice content, daily feed (`/journal` + RSS → weekly letter + Instagram; needs SQL + design + GO).

## 3. To build — needs a GO

Trace
- [ ] 1. Handwriting batch (after the test) → [notes](./TODO_NOTES.md#journal-phase-2)
- [ ] 1c. Voice notes over one upload (~4 MB) or recorded offline — only if you hit it twice → [notes](./TODO_NOTES.md#voice-limits)

Value
- [ ] 9. Custody follow-ups (custodian address on an order; a cancelled sale of a consigned work goes back to the gallery) — written before R7, re-check against the new orders → [notes](./TODO_NOTES.md#custody)
- [ ] 10. « Paid » on a work derived from its payments (still hand-editable) → [notes](./TODO_NOTES.md#money)
- [ ] 11e. Batch scan of dockets: iPhone scans → a folder on the PC → a PC batch proposes each expense / supply purchase to confirm, scan kept in Vault « Factures » (needs the OCR GO, §1) → [notes](./TODO_NOTES.md#docket-scan)

Public site
- [ ] Phones: show the closing text (« outro ») of a works sequence on `/works` — own last slide, or below?
- [ ] Status chips in English (translate the DB labels) → [notes](./TODO_NOTES.md#status-labels)
- [ ] 12. Circadian sky leftovers → [notes](./TODO_NOTES.md#circadian)
- [ ] 13. Upload the panorama + video for the map / motion layouts (`site/forest-panorama.avif`, `site/interior-loop.webm`)
- [ ] 14. `/works` gallery: cm-scaled wall scroll (on hold)
- [ ] 15. S6 leftovers → [notes](./TODO_NOTES.md#s6)

Speed and code health — measure first
- [ ] 17. Session flow speed → [notes](./TODO_NOTES.md#session-flow)
- [ ] 18. The full catalogue still loads in the background on every Atelier tab · Reports on keyset totals · one status-label layer
- [ ] 19. Slow first open of Audit / Logistics · fewer silent catches (~258, lint warns). Phone JS budget is in place (`npm run perf:budget`: /hub 268.6 / 280 kB).

## 4. To check once, when it happens (no build)

New today
- [ ] First real order through the chain (signed → shipment, paid → certificate, invoice paper), its calendar dates, its first payment — not clicked on data (it would use real numbers).
- [ ] First real supply order: « Recevoir » adds to stock, cost + supplier; an expense with its invoice file.
- [ ] « Partager » an order paper on the phone (share sheet) and on the computer (download); edit a line's value on a draft.
- [ ] Your first « #équipe » voice note: the card on a team member's Aujourd'hui; the What's new dots on their menu.
- [ ] Security rules enforced: an image upload and the contact address lookup on the live site.
- [ ] « Rappels sans projet » on Idées as admin: « En faire une idée » on « Demain ».

Older, still unseen live
- [ ] Voice-note chip in the work card (Création › Commentaires & notes) — when a work has a linked voice note.
- [ ] Export labels: print one real sheet (L7163 image + QR, L7651 QR), scan one QR.
- [ ] Waiting photos + production dates: a real waiting photo on the Journal day and the card; an admin save of start / end; a « Nouvelle » work starts production today.
- [ ] « Historique de création »: a real line saved, edited, deleted; Inventory « Périodes à trancher ».
- [ ] Journal on the phone: how long until the day shows.
- [ ] Small GIFs: a real 40 × 40 and a round one, on the phone.
- [ ] Speed on the live site as admin: Inventory full catalogue (was 22–27 s); 3 work cards + Overview (was 5.5–7 s / 7.5–10 s).
- [ ] Journal ✦ suggestions: hover a « ✦ #1316 » row → preview + loupe.
- [ ] Constellation: undo a real link delete (note comes back); Shift+drag; arrow tool; the arrow on the first real « painted on / derived from / answers » link.
- [ ] Slideshow: a GIF of 20+ works; full screen + swipe on an iPhone; « Renommer »; a full loop.
- [ ] From the 13–14 Nov batches: batch modify; a real export; a real print (300 dpi, labels); Local jobs; one Production drag-back; saving a contact from the pop-up.
- [ ] Next real field capture: technique / support written; removing an applied photo → [notes](./TODO_NOTES.md#session-write-paths)
- [ ] Concept documents: click through once → [notes](./TODO_NOTES.md#concept-documents)
- [ ] ⌘K queues new phrases until the PC indexes them (known) → [notes](./TODO_NOTES.md#semantic-search)
- [ ] Procession layout « not working »: reopen only with repro steps.

## 5. Parked — no GO

- Place « from / to » dates (`supabase/sql/place_validity_dates.sql`, not applied) — Pem « not sure » 2026-11-18.
- VAT per sale, from the transaction → [notes](./TODO_NOTES.md#vat)
- Photothèque (~4 000 photos): a library, another system, another time → [notes](./TODO_NOTES.md#phototheque)
- Writings as an output (Pem 2026-11-14: « we'll leave it for now »).
- A « no year » filter in Inventory to date works in batch (641 works have no year) — only if wanted.
- Journal entries as Constellation nodes — big, not now → [notes](./TODO_NOTES.md#journal-phase-2)
- F7 daily digest email · F6 feature switches · F8 background job outbox — [archive/STATUS.md](./archive/STATUS.md)
- Background jobs / queues · broader field OCR · transactional email (explicit no-GO in `CLAUDE.md`).

## Rules (not tasks)

New `public` table → RLS + `GRANT` (revoke first: Supabase defaults add TRUNCATE) + `npm run gen:types` · schema change → `grant_audit_queries.sql` · EU R2 endpoint · FR + EN copy · 375 px / 44 px phone contract · new audit table → extend `audit_log_prune()` · pivots and side sections collapsed by default · a team-facing change ships with its What's new line · a closed item moves to `DONE.md` the same day.
