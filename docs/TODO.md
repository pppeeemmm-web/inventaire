# PEM Hub — TODO

_Open items only, one line each. Details → [`TODO_NOTES.md`](./TODO_NOTES.md). Closed → [`DONE.md`](./DONE.md). Dropped → [`TODO_REFUSED.md`](./TODO_REFUSED.md). Aims → [`STRATEGY.md`](./STRATEGY.md). Board → [`Rethink_Board.html`](./design/2026-11-17/Rethink_Board.html)._

**Refreshed 2026-11-18, late** — everything built is on `origin/main` (What's new 3.1.61). Item numbers are kept (other docs point to them); a closed item moves to [DONE](./DONE.md) the same day.

## 0. Bugs — fix now

_None open._

## 1. Waiting on you, Pem

Things only you can do:
- [ ] **Lawyer / accountant:** [`LEGAL_POLICY.md`](./LEGAL_POLICY.md), [`WEBSITE_LEGAL_PAGES.md`](./WEBSITE_LEGAL_PAGES.md), [`POLICY_NOTES.md`](./POLICY_NOTES.md), the order papers ([`R7_Papers_Wording.md`](./design/2026-11-17/R7_Papers_Wording.md)); the VAT rate for the order form. The site has no legal notice yet.
- [ ] **Your look:** R4 (Chronologie, map « Création », thumbnails), R6 (Studio → Expositions).
- [ ] **Site module:** fill email, phone and Instagram.
- [ ] **Restore drill (O4):** never run ([`BACKUP_RECOVERY.md`](./BACKUP_RECOVERY.md)) — 20 minutes together.
- [ ] **Handwriting test:** the folder of ~10 notebook pages.
- [ ] **R2 access key rotation (O2):** not done or not recorded; note the date in `CLAUDE.md`.
- [ ] **Phone check:** the cached copy — open Aujourd'hui once on Wi-Fi, then airplane mode and reopen.
- [ ] **Aide wording:** read chapter 1 « Le projet et son périmètre » (`lib/aide/team.fr.ts`) — the French of your quote is a translation.

## 2. Rethink leftovers → [RETHINK](./RETHINK_2026-11-14.md)

R1–R7 built and pushed (history → [DONE](./DONE.md)); R6 events live, only editions part 2 left. R8 parked (§5).

- [ ] R1: store the ✦ match score (SQL) — only if the ✦ suggestions feel noisy (Pem « if necessary, go »).
- [ ] R6: editions part 2 — at the first real edition.

## 3. To build — needs a GO

Trace
- [ ] 1. Handwriting batch (after the test) → [notes](./TODO_NOTES.md#journal-phase-2)
- [ ] 1c. Voice notes over one upload (~4 MB) or recorded offline — only if you hit it twice → [notes](./TODO_NOTES.md#voice-limits)

Value

Public site
- [ ] Phones: show the closing text (« outro ») of a works sequence on `/works` — own last slide, or below?
- [ ] Status chips in English (translate the DB labels) → [notes](./TODO_NOTES.md#status-labels)
- [ ] 12. Circadian sky leftovers → [notes](./TODO_NOTES.md#circadian)
- [ ] 13. Upload the panorama + video for the map / motion layouts (`site/forest-panorama.avif`, `site/interior-loop.webm`)
- [ ] 14. `/works` gallery: cm-scaled wall scroll (on hold)
- [ ] 15. S6 leftovers → [notes](./TODO_NOTES.md#s6)

Guides — in-app Aide (`/atelier/aide`): team guide complete 2026-11-18 (15 chapters, FR + EN); design: one how-to card per task — When · Steps · What happens next · Pitfalls
- [ ] Batch 5: admin guide (approvals, Audit, version restore, Fil, Diffusion, hard delete, contacts merge / private, backups, Opérations & Stratégie).
- [ ] Batch 6: retire the old copies — `ADMIN_GUIDE.md` + `TEAM_MEMBER_GUIDE.md` → `docs/archive/`, ⌘K « Download Studio Bible » + the Kaizen → Système regenerate button; delete the two Vault uploads (« Admin guide html », « Team member Guide html ») and the Studio Bible PDF only with Pem's OK.

Speed and code health — first round built 2026-11-18 (measured: queries < 7 ms, the cost is Next.js running a page's server actions one at a time; notes `speed-measure-17-19.md` in the side-session notes)
- [ ] 17. Session flow, left: a « photo 3 of 12 » counter while applying session photos (round 2 did the day-merge skip and the faster photo apply).
- [ ] 18. Reports on keyset totals · one status-label layer · the voice-note sheet's work picker still lists only the loaded works (round 2: the catalogue loads only on tabs that use it).
- [ ] 19. Fewer silent catches (~258, lint warns) · one combined badge action on tab switch · `is_admin()` STABLE. Phone JS budget in place (`npm run perf:budget`: /hub 268.6 / 280 kB).
- [ ] Live data checks: rules 9 and 10 can't run (`npm run checks:live` → « permission denied for function oeuvre_order_exists » for the read-only role); needs a GRANT EXECUTE for that role — SQL, your OK first.

## 4. To check once, when it happens (no build)

New today
- [ ] Order guards (applied 2026-11-18): a real double « Encaisser » or a sale from two tabs is refused with its message.
- [ ] Collector share kit: the first real kit — made with its PDF, opened on a phone, an enquiry from it (Triage chip with the collector's name), the PDF download, « Prolonger » / « Retirer » (not tried: it would write real rows).
- [ ] Phone navigation as admin: the Fil tile and its count, « Actions » rows; saving a real entry from the « Écrire » sheet (seen as a non-admin at 375 / 360 px only).
- [ ] Search after the old « Commentaires » field: run `npm run embed:worker` on the PC once (works were re-marked; search now reads note lines).
- [ ] First real order through the chain (signed → shipment, paid → certificate, invoice paper), its calendar dates, its first payment — not clicked on data (it would use real numbers).
- [ ] First real supply order: « Recevoir » adds to stock, cost + supplier; an expense with its invoice file.
- [ ] « Partager » an order paper on the phone (share sheet) and on the computer (download); edit a line's value on a draft.
- [ ] Your first « #équipe » voice note: the card on a team member's Aujourd'hui; the What's new dots on their menu.
- [ ] Speed on the live site as admin after the push: Inventory full catalogue (was 22–27 s), 3 work cards + Overview (was 5.5–10 s), Audit / Logistics first open, a day on the phone.
- [ ] First real sale through « Soldée »: « Payé » ticks itself; a « Retour » of a paid sale out of a deposit puts the work back « Consigné » at the gallery; « Choisir l'adresse » on an order missing one.
- [ ] Security rules enforced: an image upload and the contact address lookup on the live site.
- [ ] « Rappels sans projet » on Idées as admin: « En faire une idée » on « Demain ».

Older, still unseen live
- [ ] Export labels: print one real sheet (L7163 image + QR, L7651 QR), scan one QR.
- [ ] Waiting photos + production dates: a real waiting photo on the Journal day and the card; an admin save of start / end; a « Nouvelle » work starts production today.
- [ ] « Historique de création »: a real line saved, edited, deleted.
- [ ] Small GIFs: a real 40 × 40 and a round one, on the phone.
- [ ] Journal ✦ suggestions: hover a « ✦ #1316 » row → preview + loupe — when a day has open suggestions again (none open on 2026-11-18).
- [ ] Constellation: undo a real link delete (note comes back); Shift+drag; arrow tool; the arrow on the first real « painted on / derived from / answers » link.
- [ ] Slideshow: a GIF of 20+ works; full screen + swipe on an iPhone; « Renommer »; a full loop.
- [ ] From the 13–14 Nov batches: batch modify; a real export; a real print (300 dpi, labels); Local jobs; one Production drag-back; saving a contact from the pop-up.
- [ ] Next real field capture: technique / support written; removing an applied photo → [notes](./TODO_NOTES.md#session-write-paths)

## 5. Parked — no GO

- R8 public site (Pem 2026-11-18: « skip r8 for now »): look decisions A big painting vs true-scale wall, B a work's page, C landing, D one name → [`R8_SiteAssessment.notes.md`](./design/2026-11-17/R8_SiteAssessment.notes.md); then one page per work (`/works/[id]-[slug]`), landing, one name, real FR / EN, About / Practice content, daily feed (`/journal` + RSS → weekly letter + Instagram; SQL + design + GO) → [SITE_REVIEW](./SITE_REVIEW_2026-11-16.md).
- 11e. Docket scan by OCR (iPhone scans → PC batch proposes each expense / supply purchase, scan in Vault « Factures ») — Pem 2026-11-18: « later » → [notes](./TODO_NOTES.md#docket-scan)
- Procession layout « not working »: reopen only with repro steps.
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
