# PEM Hub — TODO

_Open work only, one line each, read top to bottom: finish → wait for Pem → design → later → parked. Details → [`TODO_NOTES.md`](./TODO_NOTES.md). Closed → [`DONE.md`](./DONE.md). Dropped → [`TODO_REFUSED.md`](./TODO_REFUSED.md). Aims → [`STRATEGY.md`](./STRATEGY.md). Board → [`Rethink_Board.html`](./design/2026-11-17/Rethink_Board.html)._

Item numbers (1, 1c, 11e, 12–15, 17–19) stay fixed: code comments and other docs point to them. A closed item moves to [DONE](./DONE.md) the same day; `git log origin/main..` shows what is committed but not pushed.

## Now — being worked on

The lead keeps this current; nothing here is landed until it moves to DONE.

- First: the Journal design — one stream (a feed by day, labels and links, backlinks), the capture entry on the day's page from the desk hotkey and the phone, corrections, the desk mockup, the scenario in steps; one set of cards (entry, voice note, photo) drawn once and two frames around it — phone: today opens first with a sticky record bar, speed measured before and after; desk: day list and wide page; days loaded as the stream is scrolled; a day holding only a photo listed; every capture (line, voice note, photo) can be placed on the day it happened, apart from the day it was recorded; day dividers in the stream; the day list and the day content merged into one flow (no side list of days), each day's line carrying its summary (works, entries, ✦ suggestions); a time scale that widens from days to months to years — two-finger pinch on the phone as in the iPhone photo library, a control on the desk; a work named by typing its title, with its picture, as a real link editable from the work; design before code, no separate inbox → [BuildingPrinciples](./design/2026-11-21/BuildingPrinciples.md), [MasterPlan §3.1, §5](./design/2026-11-20/MasterPlan.md), surveys in `design/2026-11-21/`.
- Until the pause (Max runs to 17 Dec 2026), in this order: one automated stress round (apply `merge_contacts_fn.sql` to the Docker copy first) → if time remains, the design drafts for reverse pricing and contacts as relationships (§3, no builds).

## 1. Finish first — small, before anything new

Data safety (SQL, Pem's OK given)
- [ ] A deleted contact (not merged) still named in a queued work change or an old work version makes approve / restore fail (foreign key).
- [ ] Journal transcripts: « Corriger » on machine-made text (keeps the original, marks it verified) — the Journal is append-only in the database.
- [ ] A work card left open while an order step, batch edit or stage change rewrites the work can still post the old status / owner / price: those writers don't move `edited_at` (only the card's save does). The database stamp (`supabase/sql/oeuvre_edit_stamp.sql`, not live) needs first: the production board, Inventory broadcast toggle, constat, production dates, contact merge / delete remap and the card's « Annuler » carrying the new stamp; « Annuler » resetting the card's form; the phone offline queue keeping a refused edit; the Journal badge ignoring system stamps.

Stress-test leftovers ([`StressTest.notes.md`](./design/2026-11-18/StressTest.notes.md))
- [ ] Contacts: no warning when adding a contact with the same name and email as an existing one (quick add / manual; only the Google import checks).
- [ ] Contacts at 375: search box 42 px wide; the list is the desktop table.
- [ ] Phone sale, buyer step: one long select, no search, no « + nouveau contact »; offers Pem, team accounts and a nameless « #1002 »; fields without linked labels.
- [ ] « Commandes » badge 179 vs list « Toutes » 187: the badge leaves out 8 reconstituted open orders. Order list at 1280 with the panel open: « Papiers » column cut.

Small fixes
- [ ] Phone offline queue: a save whose answer was lost is replayed, refused and dropped with « Pas enregistré » although it was saved → a softer message for that case.
- [ ] Site editor previews (hero picker, Site panel) show the stored hero key: the old picture after a retouch, while `/` shows the new one. OG images refresh within the hour.
- [ ] A theme or group made, deleted or copied anywhere (Thèmes, batch edit, export, catalogue save, an exhibition) reaches the other screens (Inventory filters, drawer pickers, per-work chips and counts) only after a reload → one shared refresh after any change (a first try that only covered Thèmes is parked on branch `wt-themes-push`).

Checks
- [ ] One automated stress round once the contact merge transaction lands: run-chains, races-plus, money-guards, integrity, security only — no browser, no screenshots, failures only, reported without fixing in the same session (a side session on a cheaper model) → [`scripts/stress/README.md`](../scripts/stress/README.md)
- [ ] AI desk « Lancer »: confirm on Pem's PC that a job starts; what still fails is fixed or removed.

## 2. Waiting on you, Pem

- [ ] **Lawyer / accountant:** [`LEGAL_POLICY.md`](./LEGAL_POLICY.md), [`WEBSITE_LEGAL_PAGES.md`](./WEBSITE_LEGAL_PAGES.md), [`POLICY_NOTES.md`](./POLICY_NOTES.md), the order papers ([`R7_Papers_Wording.md`](./design/2026-11-17/R7_Papers_Wording.md)); the VAT rate for the order form; micro-BNC / VAT thresholds on money received vs definitive (Revenus & Dépenses). The site has no legal pages yet.
- [ ] **Your look:** R4 (Chronologie, map « Création », thumbnails), R6 (Studio → Expositions).
- [ ] **Site module:** fill email, phone and Instagram.
- [ ] **Restore drill (O4):** run it once ([`BACKUP_RECOVERY.md`](./BACKUP_RECOVERY.md)) — 20 minutes together.
- [ ] **Phone capture checks:** five things to try on the iPhone before the Journal design (back tap → Shortcut, a second icon, recording with the page in the background, a lock-screen shortcut, a capture with no signal) → [survey](./design/2026-11-21/Survey_JournalCapture.md).
- [ ] **Delacroix's notebooks:** read Hannoosh's article, or allow one page fetch → [survey §3](./design/2026-11-21/Survey_DelacroixJournal.md).
- [ ] **Handwriting test:** the folder of ~10 notebook pages.
- [ ] **R2 access key rotation (O2):** rotate, and note the date in `CLAUDE.md`.
- [ ] **Phone check:** open Aujourd'hui once on Wi-Fi, then airplane mode and reopen (cached copy).
- [ ] **Your call:** the automatic « Fin du délai de retour » reminders fill « Rappels sans projet » on Idées — hide them there, or give them their own fold? And should a new sale tick « Emportée aujourd'hui » by default?
- [ ] **Vault:** delete the two old guides « Admin guide html » and « Team member Guide html » (type Studio Bible) with the Vault's own delete — the Aide replaces them.
- [ ] **Aide wording:** read chapter 1 « Le projet et son périmètre » (`lib/aide/team.fr.ts`) — the French of your quote is a translation.
- [ ] **Reverse pricing inputs:** the cost items to count, the running-cost share rule (per work, per m², per hour?), the charges rate → [notes J](./design/2026-11-19/CatalogueGaps.notes.md#j-reverse-pricing-new-from-question-6)

## 3. Big designs — one at a time, design first (whole screen before code)

- [ ] **Contacts as relationships:** a four-part contact (info · addresses · about · relationships), « Sphères », reminders (birthdays first), a « Relation » timeline (works shown to whom, kits, events, enquiries); absorbs the rest of the contacts review (better autofill, one phone format E.164 shown grouped, a fixed FR / EN label list + clean-up of imported labels) → [notes E, I](./design/2026-11-19/CatalogueGaps.notes.md#e-contacts-item-8)
- [ ] **Reverse pricing:** from the net wanted after discount, commission, taxes and costs back to the list price per channel; the wholesale price falls out of it (needs your inputs, §2) → [notes J](./design/2026-11-19/CatalogueGaps.notes.md#j-reverse-pricing-new-from-question-6)
- [ ] **Phone outbox on mobile data (designed with the Journal capture):** a « hold uploads until Wi-Fi / Tout envoyer » switch (manual — an iPhone can't tell Wi-Fi from mobile data); an outbox for voice notes, photos, journal entries and captures, a one-time id per item so a resend never duplicates, « send » from /hub too, the phone's capture time trusted past 24 h. Today only work text saves are kept and resent.
- [ ] **R8 public site:** look decisions A big painting vs true-scale wall, B a work's page, C landing, D one name → [`R8_SiteAssessment.notes.md`](./design/2026-11-17/R8_SiteAssessment.notes.md); then one page per work (`/works/[id]-[slug]`), landing, one name, real FR / EN, About / Practice content, daily feed (`/journal` + RSS → weekly letter + Instagram) → [SITE_REVIEW](./SITE_REVIEW_2026-11-16.md)
- [ ] **Editions:** an edition holds runs (date, medium, prints, proofs, cost, price per print), copies numbered per run, each copy you sell tracked; = R6 editions part 2 — after catalogue gaps steps 1–7 → [notes B](./design/2026-11-19/CatalogueGaps.notes.md)
- [ ] **AI desk, web addresses:** contacts with a web address read by the PC agent and suggested on Bureau IA like the cards — which contacts, how often reread → [`AiDesk.notes.md`](./design/2026-11-18/AiDesk.notes.md)

## 4. Later — once §1 is clear, each its own GO

Catalogue gaps, in build order ([draft with Pem's answers](./design/2026-11-19/CatalogueGaps.notes.md); each touches data: Flow trace + GO)
- [ ] Step 1: condition at a glance + « En transit / Accrochée » chips — read only, no SQL.
- [ ] Step 2: free-text date (« vers / c. » + text), sizes (framed, paper, weight, formats), signature (position + note), public text FR + EN — one SQL file on `Oeuvres`.
- [ ] Step 3: papers — tear sheet, inventory list with thumbnails (~15 per A4), cartouche labels, contact address labels, sales report; a PDF with a non-public work made by the team, approved by an admin.
- [ ] Step 4: events and calls — call types, entry fee, awards, curators / jurors, reception and deadlines.
- [ ] Step 5: contact fields — after the contacts-as-relationships design (§3).
- [ ] Step 6: kit display switches (three presets: collector, gallery / curator, insurer) · studio documents + a CV generated from events, calls, press and collections · video links on a work · press section (bibliography).
- [ ] Step 7: insights — production / sales / money received over time, a map of where the works are.
- [ ] Step 8: « Volée » as its own status 12 (admin constat → insurance claim with police report).

Public site
- [ ] Website legal pages, A.2 part 2 ([`LegalPages_A2.notes.md`](./design/2026-11-18/LegalPages_A2.notes.md)): the four pages + footer, needs the C.1 facts (§2). `ANALYTICS_EXCLUDE_VISITOR_IDS` lists browser IDs that all renew on 2027-06-14 — the team should use « Ne pas être compté·e » instead. `CRON_SECRET` must be set on Vercel for the monthly retention cron.
- [ ] Phones: show the closing text (« outro ») of a works sequence on `/works` — own last slide, or below?
- [ ] Status chips in English (translate the DB labels) → [notes](./TODO_NOTES.md#status-labels)
- [ ] 12. Circadian sky leftovers → [notes](./TODO_NOTES.md#circadian)
- [ ] 13. Upload the panorama + video for the map / motion layouts (`site/forest-panorama.avif`, `site/interior-loop.webm`)
- [ ] 14. `/works` gallery: cm-scaled wall scroll (on hold)
- [ ] 15. S6 leftovers → [notes](./TODO_NOTES.md#s6)

Trace
- [ ] 1. Handwriting batch (after the test) → [notes](./TODO_NOTES.md#journal-phase-2)
- [ ] 1c. Voice notes over one upload (~4 MB) or recorded offline — only if you hit it twice → [notes](./TODO_NOTES.md#voice-limits)
- [ ] R1: store the ✦ match score (SQL) — only if the ✦ suggestions feel noisy.

Storage and Vault
- [ ] Retouched photos: the old file pair stays in storage for ever (logged as « backup » in `storage_object_ledger`); a work purge does not remove it, and `scripts/storage-ledger-backfill.mjs --write` relabels those rows « unidentified » → a clean-up that reads the ledger, and the backfill keeping `backup` rows.
- [ ] Vault: a naming policy for every non-picture file.

Speed and code health
- [ ] 17. Session flow: a « photo 3 of 12 » counter while applying session photos → [measurements, 17–19](./TODO_NOTES.md#speed)
- [ ] 18. Reports on keyset totals · one status-label layer · the voice-note sheet's work picker lists only the loaded works.
- [ ] Push-blocking checks for the building principles: no table write from a browser file, no new whole-Atelier refresh — today's files listed as the debt, the list may only shrink → [BuildingPrinciples §1](./design/2026-11-21/BuildingPrinciples.md).
- [ ] `saveContact`: one server door for a contact and its addresses, emails, phones and links, in one transaction — before any People build.
- [ ] Eight kinds of record the museum standards expect (inscriptions, moves with « seen on », valuations, treatments, licences / reproductions, literature, objects coming in, details of each showing): place each on the map of homes, with the catalogue-gaps steps → [survey](./design/2026-11-21/Survey_MuseumStandards.md).
- [ ] 19. Fewer silent catches (lint warns) · one combined badge action on tab switch.

## 5. Parked — no GO

Separate systems (another time, maybe another tool)
- Budgets, forecasts, accountancy — VAT per sale from the transaction → [notes](./TODO_NOTES.md#vat)
- Photothèque (~4 000 photos): a library → [notes](./TODO_NOTES.md#phototheque)
- The system as a product for other artists.
- 11e. Docket scan by OCR (iPhone scans → PC batch proposes each expense / supply purchase, scan in Vault « Factures ») → [notes](./TODO_NOTES.md#docket-scan)

Ideas
- Progress dashboard: aims → done / open / estimate / target (the « where we stopped » note is its first version).
- Storage risk watch: temperature, damp, leak per place; a reminder to check the works stored there; a warning on a move into it → [notes H2](./design/2026-11-19/CatalogueGaps.notes.md#h2-risk-watch-on-works-places-and-moves-idea--not-now)
- Carrier tracking updates pushed by API.
- Mailing / newsletter from the app (a deferred feature: needs a GO).
- Writings as an output.
- Journal entries as Constellation nodes — big → [notes](./TODO_NOTES.md#journal-phase-2)
- A « no year » filter in Inventory to date works in batch (641 works have no year) — only if wanted.
- AI reading of inspiration pictures (style, technique, guessed author kept apart from the typed one) through a closed word list and a format check before anything is saved — waits on the local AI working reliably.
- Palette likeness: works ordered by closeness to one picked colour, and works whose whole palette resembles a given work's (reads `tblImage.palette`, no new data).

On hold
- Procession layout « not working »: reopen only with repro steps.
- Place « from / to » dates (`supabase/sql/place_validity_dates.sql`, not applied).
- F7 daily digest email · F6 feature switches · F8 background job outbox — [archive/STATUS.md](./archive/STATUS.md)
- Other background jobs / queues (the AI agent has its GO) · broader field OCR · transactional email (explicit no-GO in `CLAUDE.md`).

## 6. To check once, when it happens (no build)

- [ ] Search after the old « Commentaires » field: run `npm run embed:worker` on the PC once (search now reads note lines).
- [ ] Speed on the live site as admin: Inventory full catalogue (baseline 22–27 s), 3 work cards + Overview (5.5–10 s), Audit / Logistics first open, a day on the phone.
- [ ] « Partager » an order paper on the iPhone (share sheet).
- [ ] Your first real « #équipe » voice note recorded with the microphone.
- [ ] Constellation: the arrow on the first real « painted on / derived from / answers » link, and undoing a real link delete.
- [ ] Slideshow: full screen + swipe on an iPhone.
- [ ] Physical printing: one real labels sheet (L7163 image + QR, L7651 QR) with a QR scanned, and a 300 dpi print.
- [ ] Live site: an old service worker (`sw.js`) never blocks pages.
- [ ] A business card captured on the phone end to end: Bureau IA badge → « Lancer sur ce PC » → « Cartes lues » → Save.

## Rules (not tasks)

New `public` table → RLS + `GRANT` (revoke first: Supabase defaults add TRUNCATE) + `npm run gen:types` · schema change → `grant_audit_queries.sql` · EU R2 endpoint · FR + EN copy · 375 px / 44 px phone contract · new audit table → extend `audit_log_prune()` · pivots and side sections collapsed by default · a team-facing change ships with its What's new line · a closed item moves to `DONE.md` the same day.
