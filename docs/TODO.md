# PEM Hub — TODO

_Open work only, one line each. Details → [`TODO_NOTES.md`](./TODO_NOTES.md). Closed → [`DONE.md`](./DONE.md). Dropped → [`TODO_REFUSED.md`](./TODO_REFUSED.md). Aims → [`STRATEGY.md`](./STRATEGY.md). Board → [`Rethink_Board.html`](./design/2026-11-17/Rethink_Board.html)._

Item numbers stay fixed (other docs point to them). A closed item moves to [DONE](./DONE.md) the same day; `git log origin/main..` shows what is committed but not pushed.

## Now — being worked on (lead keeps this current; nothing here is landed until it moves to DONE)

- 🔧 §0 « Privé » contacts: hidden from non-admins in lists, search and pickers only; still readable where tied to a work / order / paper (Pem 2026-11-19, no RLS) — stress-test session builds it in `app-worktrees/privacy-test`; `supabase/sql/contact_private_rls.sql` is not used

## 0. Bugs — fix now

- [ ] **Privacy:** a contact marked « Privé » (admin-only) is still shown to the team in Contacts, lists and pickers; nothing filters `is_private`.

## 1. Waiting on you, Pem

- [ ] **Lawyer / accountant:** [`LEGAL_POLICY.md`](./LEGAL_POLICY.md), [`WEBSITE_LEGAL_PAGES.md`](./WEBSITE_LEGAL_PAGES.md), [`POLICY_NOTES.md`](./POLICY_NOTES.md), the order papers ([`R7_Papers_Wording.md`](./design/2026-11-17/R7_Papers_Wording.md)); the VAT rate for the order form. The site has no legal pages yet.
- [ ] **Your look:** R4 (Chronologie, map « Création », thumbnails), R6 (Studio → Expositions).
- [ ] **Site module:** fill email, phone and Instagram.
- [ ] **Restore drill (O4):** run it once ([`BACKUP_RECOVERY.md`](./BACKUP_RECOVERY.md)) — 20 minutes together.
- [ ] **Handwriting test:** the folder of ~10 notebook pages.
- [ ] **R2 access key rotation (O2):** rotate, and note the date in `CLAUDE.md`.
- [ ] **Phone check:** open Aujourd'hui once on Wi-Fi, then airplane mode and reopen (cached copy).
- [ ] **Your call:** the automatic « Fin du délai de retour » reminders fill « Rappels sans projet » on Idées — hide them there, or give them their own fold? And should a new sale tick « Emportée aujourd'hui » by default?
- [ ] **Vault:** delete the two old guides « Admin guide html » and « Team member Guide html » (type Studio Bible) with the Vault's own delete — the Aide replaces them.
- [ ] **Aide wording:** read chapter 1 « Le projet et son périmètre » (`lib/aide/team.fr.ts`) — the French of your quote is a translation.

## 2. Rethink — nothing open

Leftovers are in §3, R8 in §5.

## 3. To build — needs a GO

Admin
- [ ] Journal transcripts: « Corriger » on machine-made text (keeps the original, marks it verified) — the Journal is append-only in the database, so it needs SQL (Pem's OK).
- 🔧 Themes = creation, groups = business: the portfolio PDF gets its own « Groupe » source (its collections are the public /works chapters, kept on themes) — Inventory session builds it in `app-worktrees/theme-group`
- [ ] Phone on mobile data: a « hold uploads until Wi-Fi / Tout envoyer » switch (manual — an iPhone can't tell Wi-Fi from mobile data). Needs a phone outbox for voice notes, photos, journal entries and captures, a one-time id per item so a resend never duplicates, the « send » running from /hub too, and the phone's capture time trusted past 24 h. Today only work text saves are kept and resent. Design first.
- [ ] Ask the accountant: micro-BNC / VAT thresholds on money received vs definitive (Revenus & Dépenses).
- [ ] Contact merge is still separate writes, not one transaction: a failure half-way leaves a split pair → one SQL function (Pem's OK).
- [ ] Phone offline queue: a save whose answer was lost is replayed, refused and dropped with « Pas enregistré » although it was saved — softer message for that case.
- [ ] Retouched photos: the old file pair stays in storage for ever (logged as « backup » in `storage_object_ledger`); a work purge does not remove it, and `scripts/storage-ledger-backfill.mjs --write` relabels those rows « unidentified » — a clean-up that reads the ledger, and the backfill keeping `backup` rows.
- [ ] Site editor previews (hero picker, Site panel) show the stored hero key: the old picture after a retouch, while `/` shows the new one. OG images refresh within the hour.
- [ ] A theme or group created or copied on the Thèmes page reaches the other screens (Inventory filters, batch edit, drawer chips) only after a reload; leaving Thèmes and coming back hides it until then.
- [ ] A work card left open while an order step, batch edit or stage change rewrites the work can still post the old status / owner / price: those writers don't move `edited_at` (only the card's save does).

Contacts and Vault
- [ ] Contacts tab review (design first): sort by family name everywhere; family names in CAPITALS; an admin badge / filter for confidential contacts; much better autofill; the Atelier's address list is not refreshed by Contacts edit / merge / delete (Inventory, work overlay, Curation dock, Compare stay stale until reload); one phone format (E.164 stored, shown grouped, with country codes); a fixed phone / email label list shown FR / EN, plus a clean-up of the imported labels (SQL, Pem's OK).
- [ ] Vault: a naming policy for every non-picture file.

AI desk
- [ ] Phase 3 ([`AiDesk.notes.md`](./design/2026-11-18/AiDesk.notes.md)): business cards captured on the phone become `ai_job` rows (kind `card`), the PC agent reads the photo with a local vision model and the desk suggests the fields, to accept or reject; then web addresses the same way.

Public site
- [ ] Website legal pages, A.2 part 2 ([`LegalPages_A2.notes.md`](./design/2026-11-18/LegalPages_A2.notes.md)): the four pages + footer, needs the C.1 facts. Part 1 is built; its retention SQL waits for Pem's OK (« Now »). `ANALYTICS_EXCLUDE_VISITOR_IDS` lists browser IDs that all renew on 2027-06-14 — the team should use « Ne pas être compté·e » instead. `CRON_SECRET` must be set on Vercel for the monthly retention cron.
- [ ] Phones: show the closing text (« outro ») of a works sequence on `/works` — own last slide, or below?
- [ ] Status chips in English (translate the DB labels) → [notes](./TODO_NOTES.md#status-labels)
- [ ] 12. Circadian sky leftovers → [notes](./TODO_NOTES.md#circadian)
- [ ] 13. Upload the panorama + video for the map / motion layouts (`site/forest-panorama.avif`, `site/interior-loop.webm`)
- [ ] 14. `/works` gallery: cm-scaled wall scroll (on hold)
- [ ] 15. S6 leftovers → [notes](./TODO_NOTES.md#s6)

Look and layout ([`StressTest.notes.md`](./design/2026-11-18/StressTest.notes.md))
- [ ] Phone and desktop Journal disagree on a day item with no work yet (phone skips it).
- [ ] Contacts: no warning when adding a contact with the same name and email as an existing one (quick add / manual; only the Google import checks).
- [ ] Contacts at 375: search box 42 px wide; the list is the desktop table (Contacts review phase 1).
- [ ] Phone sale, buyer step: one long select, no search, no « + nouveau contact »; offers Pem, team accounts and a nameless « #1002 »; fields without linked labels.
- [ ] « Commandes » badge 179 vs list « Toutes » 187: the badge leaves out 8 reconstituted open orders. Order list at 1280 with the panel open: « Papiers » column cut.
- [ ] Phone: /hub chips « Fil » / « Inbox » 32 px tall; field session photo ✕ 28 px; the Journal day card lists the same work twice.
- [ ] Bureau IA phase 3: the agent must accept only a `cards/` Vault key in a « card » job (the team can queue one with any payload, by design).

Rethink leftovers
- [ ] R1: store the ✦ match score (SQL) — only if the ✦ suggestions feel noisy.
- [ ] R6: editions part 2 — at the first real edition.

Trace
- [ ] 1. Handwriting batch (after the test) → [notes](./TODO_NOTES.md#journal-phase-2)
- [ ] 1c. Voice notes over one upload (~4 MB) or recorded offline — only if you hit it twice → [notes](./TODO_NOTES.md#voice-limits)

Speed and code health
- [ ] 17. Session flow: a « photo 3 of 12 » counter while applying session photos → [measurements, 17–19](./TODO_NOTES.md#speed)
- [ ] 18. Reports on keyset totals · one status-label layer · the voice-note sheet's work picker lists only the loaded works.
- [ ] 19. Fewer silent catches (lint warns) · one combined badge action on tab switch · `is_admin()` STABLE (VOLATILE live).

## 4. To check once, when it happens (no build)

- [ ] Search after the old « Commentaires » field: run `npm run embed:worker` on the PC once (search now reads note lines).
- [ ] Speed on the live site as admin: Inventory full catalogue (baseline 22–27 s), 3 work cards + Overview (5.5–10 s), Audit / Logistics first open, a day on the phone.
- [ ] « Partager » an order paper on the iPhone (share sheet).
- [ ] Your first real « #équipe » voice note recorded with the microphone.
- [ ] Constellation: the arrow on the first real « painted on / derived from / answers » link, and undoing a real link delete.
- [ ] Slideshow: full screen + swipe on an iPhone.
- [ ] Physical printing: one real labels sheet (L7163 image + QR, L7651 QR) with a QR scanned, and a 300 dpi print.
- [ ] Live site: an old service worker (`sw.js`) never blocks pages.

## 5. Parked — no GO

- R8 public site: look decisions A big painting vs true-scale wall, B a work's page, C landing, D one name → [`R8_SiteAssessment.notes.md`](./design/2026-11-17/R8_SiteAssessment.notes.md); then one page per work (`/works/[id]-[slug]`), landing, one name, real FR / EN, About / Practice content, daily feed (`/journal` + RSS → weekly letter + Instagram; SQL + design + GO) → [SITE_REVIEW](./SITE_REVIEW_2026-11-16.md).
- 11e. Docket scan by OCR (iPhone scans → PC batch proposes each expense / supply purchase, scan in Vault « Factures ») → [notes](./TODO_NOTES.md#docket-scan)
- Procession layout « not working »: reopen only with repro steps.
- Place « from / to » dates (`supabase/sql/place_validity_dates.sql`, not applied).
- VAT per sale, from the transaction → [notes](./TODO_NOTES.md#vat)
- Photothèque (~4 000 photos): a library, another system, another time → [notes](./TODO_NOTES.md#phototheque)
- Writings as an output.
- A « no year » filter in Inventory to date works in batch (641 works have no year) — only if wanted.
- Journal entries as Constellation nodes — big → [notes](./TODO_NOTES.md#journal-phase-2)
- F7 daily digest email · F6 feature switches · F8 background job outbox — [archive/STATUS.md](./archive/STATUS.md)
- Other background jobs / queues (the AI agent has its GO) · broader field OCR · transactional email (explicit no-GO in `CLAUDE.md`).

## Rules (not tasks)

New `public` table → RLS + `GRANT` (revoke first: Supabase defaults add TRUNCATE) + `npm run gen:types` · schema change → `grant_audit_queries.sql` · EU R2 endpoint · FR + EN copy · 375 px / 44 px phone contract · new audit table → extend `audit_log_prune()` · pivots and side sections collapsed by default · a team-facing change ships with its What's new line · a closed item moves to `DONE.md` the same day.
