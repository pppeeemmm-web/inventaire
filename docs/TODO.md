# PEM Hub — TODO

_Open items only, one line each. Details → [`TODO_NOTES.md`](./TODO_NOTES.md). Closed → [`DONE.md`](./DONE.md). Dropped → [`TODO_REFUSED.md`](./TODO_REFUSED.md). Aims → [`STRATEGY.md`](./STRATEGY.md). Board → [`Rethink_Board.html`](./design/2026-11-17/Rethink_Board.html)._

**Refreshed 2026-11-18, evening.** What has shipped is in What's new (`lib/whats-new.ts`, 3.1.70 at this writing); `git log origin/main..` shows anything committed but not pushed. Item numbers are kept (other docs point to them); a closed item moves to [DONE](./DONE.md) the same day.

## 0. Bugs — fix now

From Pem's pass, 2026-11-18 evening (screenshots in that chat; not yet reproduced):
- [ ] Carte (map) shows nothing.
- [ ] Contacts: deleting a contact does not update the sidebar badge count.
- [ ] Business card: photo taken in the app → « nothing happened » (Live Text pasted from a photo taken outside worked).
- [ ] Vault folder tree: a nested folder (Commandes → Confiés) draws its row out of line, buttons overlapping (also check speed).
- [ ] Contact editor: phone labels « Main / Other / Work » in English in the French UI.
- [ ] Aide (team guide) says team members record new works, reworks and photos; in fact only Pem (admin) does / approves; card « Améliorer avec l'IA » only works on Pem's laptop (Ollama) — say so. Condition report: who should make it (the custodian / closest person?) — Pem's call.

## 1. Waiting on you, Pem

Things only you can do:
- [ ] **Lawyer / accountant:** [`LEGAL_POLICY.md`](./LEGAL_POLICY.md), [`WEBSITE_LEGAL_PAGES.md`](./WEBSITE_LEGAL_PAGES.md), [`POLICY_NOTES.md`](./POLICY_NOTES.md), the order papers ([`R7_Papers_Wording.md`](./design/2026-11-17/R7_Papers_Wording.md)); the VAT rate for the order form. The site has no legal notice yet.
- [ ] **Your look:** R4 (Chronologie, map « Création », thumbnails), R6 (Studio → Expositions).
- [ ] **Site module:** fill email, phone and Instagram.
- [ ] **Restore drill (O4):** never run ([`BACKUP_RECOVERY.md`](./BACKUP_RECOVERY.md)) — 20 minutes together.
- [ ] **Handwriting test:** the folder of ~10 notebook pages.
- [ ] **R2 access key rotation (O2):** not done or not recorded; note the date in `CLAUDE.md`.
- [ ] **Phone check:** the cached copy — open Aujourd'hui once on Wi-Fi, then airplane mode and reopen.
- [ ] **Your call (stress test):** the automatic « Fin du délai de retour » reminders fill « Rappels sans projet » on Idées (hide them there, or their own fold?); a new sale ticks « Emportée aujourd'hui » by default.
- [ ] **Vault:** delete the two old guides « Admin guide html » and « Team member Guide html » (type Studio Bible, 2026-05-24) with the Vault's own delete — replaced by the Aide (no Studio Bible PDF exists).
- [ ] **Aide wording:** read chapter 1 « Le projet et son périmètre » (`lib/aide/team.fr.ts`) — the French of your quote is a translation.

## 2. Rethink — closed

R1–R7 built and pushed (history → [DONE](./DONE.md)); the rethink is archived ([`archive/RETHINK_2026-11-14.md`](./archive/RETHINK_2026-11-14.md), 2026-11-18). Its two leftovers are in §3; R8 is parked (§5).

## 3. To build — needs a GO

Contacts and Vault (Pem 2026-11-18 evening)
- [ ] Contacts tab review (design first): sort by family name everywhere, family names in CAPITALS; an admin badge / filter for confidential contacts; much better autofill; one phone format (international E.164 stored, shown grouped, country codes — today « 0 », « +336 32932616 », « 0879262103 » mixed).
- [ ] Vault: a naming policy for every non-picture file (today a mess).
- [ ] AI desk: one place on the computer to run the AI passes (card « Améliorer », web address) for items captured on the phone, since the phone can't reach Ollama — needs a GO (deferred-feature rule).
- [ ] Website legal pages: prepare the A.2 batch (8 gaps: legal pages + footer, enquiry privacy line, 13 / 25-month retention, one audience counter, opt-out, self-hosted fonts, team notice, OpenAI DPA) → `WEBSITE_LEGAL_PAGES.md`.
- [ ] « Check the next site playbook » — which document? (ask Pem).


Stress-test look leftovers (2026-11-18, [`StressTest.notes.md`](./design/2026-11-18/StressTest.notes.md))
- [ ] Needs a layout design: Inventory title column (panel open) and Production cards cut titles to 2–3 letters at 1280; phone selection bar + « Écrit enregistré » toast over the bottom bar.
- [ ] Small slips: supply orders « Reçue 0 / 2 » for a partly received order, new line « Prix HT » not pre-filled; no What's new dots in the phone ☰ menu; « Logistique 34 en route » counts boxes not yet on the road; team Overview « Rappels 0 » next to « Rappels 40 »; Journal day counts « 2 peintures » for one work; the work card says nothing of a waiting photo.

Rethink leftovers
- [ ] R1: store the ✦ match score (SQL) — only if the ✦ suggestions feel noisy (Pem « if necessary, go »).
- [ ] R6: editions part 2 — at the first real edition.

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

Guides — in-app Aide (`/atelier/aide`): team guide 15 chapters, admin guide 8, FR + EN; design: one how-to card per task — When · Steps · What happens next · Pitfalls. PDF download + « ? » panel built 2026-11-18. Pem 2026-11-18: the Aide is too short (team ≈ 4 800 words vs 14 800 in the old guide; admin ≈ 1 200 vs 11 200) — « proper admin and user guides » (GO):
- [ ] Admin guide in full (~16 chapters): Audit sub-tab by sub-tab, approvals in depth, versions, hard delete, contact privacy + merge, Diffusion, backups + a restore drill, live checks + the work rules, AI engines + keys (`docs/AI_ENGINES.md`), troubleshooting, a weekly admin routine.
- [ ] Team guide: a « Référence » part under each chapter — every field of the work card, every status / stage, every order step and paper (the Aide never says « facture » today), phone vs computer — plus FAQ / troubleshooting.

Speed and code health — first round built 2026-11-18 (measured: queries < 7 ms, the cost is Next.js running a page's server actions one at a time; notes `speed-measure-17-19.md` in the side-session notes)
- [ ] 17. Session flow, left: a « photo 3 of 12 » counter while applying session photos (round 2 did the day-merge skip and the faster photo apply).
- [ ] 18. Reports on keyset totals · one status-label layer · the voice-note sheet's work picker still lists only the loaded works (round 2: the catalogue loads only on tabs that use it).
- [ ] 19. Fewer silent catches (277, lint warns, counted 2026-11-18) · one combined badge action on tab switch · `is_admin()` STABLE (still VOLATILE live, 2026-11-18). Phone JS budget in place (`npm run perf:budget`: /hub 268.6 / 280 kB).

## 4. To check once, when it happens (no build)

Run on the Docker copy 2026-11-18 (report [`StressTest.notes.md`](./design/2026-11-18/StressTest.notes.md) « TODO §4 on the copy »; passed items → [DONE](./DONE.md)). Left for Pem's eye or the live site:
- [ ] Search after the old « Commentaires » field: run `npm run embed:worker` on the PC once (works were re-marked; search now reads note lines).
- [ ] Speed on the live site as admin after the push: Inventory full catalogue (was 22–27 s), 3 work cards + Overview (was 5.5–10 s), Audit / Logistics first open, a day on the phone.
- [ ] « Partager » an order paper on the iPhone (share sheet) — the computer download passed on the copy.
- [ ] Your first real « #équipe » voice note recorded with the microphone — the card on the team's Aujourd'hui and the dots passed on the copy.
- [ ] Constellation: the arrow on the first real « painted on / derived from / answers » link, and undoing a real link delete (canvas — not checkable on the copy; Shift+drag and the arrow tool passed).
- [ ] Slideshow: full screen + swipe on an iPhone.
- [ ] Physical printing: one real labels sheet (L7163 image + QR, L7651 QR) with a QR scanned, and a 300 dpi print.
- [ ] Live site: an old service worker (`sw.js`) can never block pages (a stale one on localhost made every request fail in the stress run).

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
