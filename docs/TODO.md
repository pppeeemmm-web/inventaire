# PEM Hub — TODO

_Open work only, one line each, read top to bottom: finish → wait for Pem → design → later → parked. Details → [`TODO_NOTES.md`](./TODO_NOTES.md). Closed → [`DONE.md`](./DONE.md). Dropped → [`TODO_REFUSED.md`](./TODO_REFUSED.md). Aims → [`STRATEGY.md`](./STRATEGY.md). Board → [`Rethink_Board.html`](./design/2026-11-17/Rethink_Board.html)._

Item numbers (1, 1c, 11e, 12–15, 17–19) stay fixed: code comments and other docs point to them. A closed item moves to [DONE](./DONE.md) the same day; `git log origin/main..` shows what is committed but not pushed.

## Now — being worked on

The lead keeps this current; nothing here is landed until it moves to DONE.

- Journal stream (the default on desk and phone; `?stream=0` keeps the old day screens) — open pieces: the desk hotkey → [JournalDesign](./design/2026-11-22/JournalDesign.md).
- People: the design is built (timeline, spheres, dates, links, moments, archive, Fil, custody, four-tab editor); open: birthday reminders and the two care rules, journal entries that name the person in the timeline, « feu » on papers for a deceased person → [People.md](./design/2026-11-22/People.md).
- Reverse pricing: first slice live (admin block on the work card); open: the contributions rate and how a consignment receipt is declared (accountant), a database sum for the running-cost rate.
- Idées: a voice note recorded in an idea whose Journal entry fails, or that is re-sent after a crash, gets no link to the idea — its desk shows it through the note, the idea list's counts leave it out → [IdeasDesign](./design/2026-11-23/IdeasDesign.md).
- Pem's order « 1 3 2 » is done (see DONE); next if time remains before the pause (Max runs to 17 Dec 2026): the reverse pricing design draft (§3, no build).
- Tests on the copy, open: the live dev server's auto-login (plan §2B: B2 would also stop the LAN phone's real-account login — Pem decides); `e2e:writes:check` in `ship.ps1` / CI with the first `@writes` spec; the copy's `next dev` can exit mid-run (« exited code=0 », 7 specs then refused) — a rerun passes → [TestsOnDockerCopy](./design/2026-11-23/TestsOnDockerCopy.md).

## 1. Finish first — small, before anything new

Data safety (SQL, Pem's OK given)
- [ ] Share sheet → a work's « Commentaires » and a Pipeline entry's notes: the same read-then-write the contact notes had (two shares at once can lose one) → the same one-statement append (`append_contact_notes` pattern).
- [ ] Contacts batch edit stops halfway (the cards before are saved) when one card is refused — e.g. a private card kept on screen for a team member.
- [ ] Journal corrections, rare cases: a second machine transcription of the same voice note (other engine) shows in Notes over Pem's correction; a correction of a private entry written by a team member stays unreadable to that author; search by meaning still matches the uncorrected words (the semantic index holds the original text).
- [ ] Order cancel, very unlikely: if a reserved work refuses to be released at the very moment another sale or gift opens a line on the same work, putting the cancelled order back can leave two open lines on that work.
- [ ] A theme or group list changed in the same split second as a card save that also changes that list is replaced by the card's list (the lists are written apart from the work row, outside the save's guard).

Stress-test leftovers ([`StressTest.notes.md`](./design/2026-11-18/StressTest.notes.md))
- [ ] Contacts: the « n / total » counter counts archived cards in the total.
- [ ] « Commandes » badge 179 vs list « Toutes » 187: the badge leaves out 8 reconstituted open orders. Order list at 1280 with the panel open: « Papiers » column cut.

Small fixes
- [ ] Stock: deleting an item (SupplierHub, a browser delete) leaves its Équipement photo in R2 (`stock/S_…` + thumb, ledger still « linked »).
- [ ] Phone pattern: re-run the 375 px guard (`npm run test:e2e:field`, `tests/phone-pattern.spec.ts`) — Coffre, Contacts, Rapports, Fiscal should now pass: take them out of PENDING; add Audit to TABS → [PhonePattern](./design/2026-11-28/PhonePattern.md).
- [ ] A contact merge rewrites a Stock line's supplier without marking the line changed: a Stock card open across the merge saves the deleted supplier back and fails with « erreur de la base » (admin merge, rare).
- [ ] Desk Journal: an image dropped offline on a day older than the 5 newest is not reread when it is sent, and waits under today with no sign of its day.
- [ ] Phone Aujourd'hui and the old day page show the clock time, not « ajouté le … », for a photo added later to a past day.
- [ ] After a contact merge the desk keeps the merged contact's duplicate address links until a reload (pickers show a place twice; a save there answers « stale »).
- [ ] Site editor previews (hero picker, Site panel) show the stored hero key: the old picture after a retouch, while `/` shows the new one. OG images refresh within the hour.
- [ ] Desk check (Pem, at the desk): a theme or group created, renamed, deleted or copied in Thèmes, an exhibition selection or the Constellation shows at once in the Inventory filters, the card pickers and the works' chips, with no reload (one shared refresh, PR #11).
- [ ] Supabase Auth → Redirect URLs, tidy: delete `https://inventaire-dusky.vercel.app/auth/callback` and `http://localhost:3000` (each covered by its `/**` line); `http://192.168.1.9:3000/` → `/**` if Google login on the phone over home Wi-Fi is used. Keep `https://www.thepemworkshop.com/auth/…` (live login) and `https://inventaire-git-*-pppeeemmm-webs-projects.vercel.app/**` (pull request test copies).
- [ ] « c. » (circa) for every date in the app — works (year, production start / end, fate), people (born / died), moments, orders, papers: a guessed date is recorded and shown as « c. 1999 », never as certain (Pem: « provenance and history is a matter of recording sometimes less than perfect data »). The gap is itself data: counted at the top (« n dates c. à préciser », asked of the database) and opened down to each record to firm it up when the information turns up → design first (one precision value beside day / month / year, every reader that prints a date, the count and its list).
- [ ] Provenance: a box in the work card to write a work's past steps (gift, succession, sale… with « c. » dates, `@` people) as clean records; parked until Pem clarifies rule 10 for the past, moves between other people, true dates in Historique / « Garde », « c. », public. First case: #2410–#2412 (Maroselli, still read owner Pem, place Marseille) → [ProvenanceInput](./design/2026-11-27/ProvenanceInput.md).
- [ ] `@name` typed in a caption or a Journal text with no match: kept as text and queued; the PC agent looks it up (handle, website) and proposes a contact card in « Cartes lues »; Pem accepts → the real `@` link (principle 13) → short design first (queue home, what the agent may look up).
- [ ] Moments as a way of reading: one read-only view over every home (« what happened on day X / to work N / with person P ») so Mois / Années and day paging count everything; SQL, Pem's GO, throwaway copy first → [VirtualMoments](./design/2026-11-26/VirtualMoments.md).
- [ ] Journal: each added work is a moment « Œuvre ajoutée » (written by the database at creation, linked to the work), labelled nouvelle / retrouvée from the work; one card per day; one-off for the 5 works added since the Journal is written in — reader code on the branch (`f90eced`), SQL not applied: throwaway copy, then live with Pem's OK, then ARCHITECTURE §3 / §7 → [WorksAddedMoments](./design/2026-11-26/WorksAddedMoments.md).

Checks
- [ ] One automated stress round: run-chains, races-plus, money-guards, integrity, security only — no browser, no screenshots, failures only, reported without fixing in the same session (a side session on a cheaper model) → [`scripts/stress/README.md`](../scripts/stress/README.md)
- [ ] AI desk « Lancer »: confirm on Pem's PC that a job starts; what still fails is fixed or removed.

## 2. Waiting on you, Pem

- [ ] **Journal #53 / #54 (test notes, hidden):** a real delete means switching off the Journal's « never delete » guard (and those on their labels and links) for that delete — your word on that method, or they stay hidden.
- [ ] **Lawyer / accountant:** [`LEGAL_POLICY.md`](./LEGAL_POLICY.md), [`WEBSITE_LEGAL_PAGES.md`](./WEBSITE_LEGAL_PAGES.md), [`POLICY_NOTES.md`](./POLICY_NOTES.md), the order papers ([`R7_Papers_Wording.md`](./design/2026-11-17/R7_Papers_Wording.md)); the VAT rate for the order form; micro-BNC / VAT thresholds on money received vs definitive (Revenus & Dépenses). The site has no legal pages yet.
- [ ] **Your look:** R4 (Chronologie, map « Création », thumbnails), R6 (Studio → Expositions).
- [ ] **Site module:** fill email, phone and Instagram.
- [ ] **Restore drill (O4):** run it once ([`BACKUP_RECOVERY.md`](./BACKUP_RECOVERY.md)) — 20 minutes together.
- [ ] **Phone capture gesture:** on the live Journal stream, two minutes with the phone in hand — tap the back twice → the recorder opens on today; the Journal design states the other iPhone limits as assumptions → [survey](./design/2026-11-21/Survey_JournalCapture.md).
- [ ] **Delacroix's notebooks:** read Hannoosh's article, or allow one page fetch → [survey §3](./design/2026-11-21/Survey_DelacroixJournal.md).
- [ ] **Handwriting test:** the folder of ~10 notebook pages.
- [ ] **R2 access key rotation (O2):** rotate, and note the date in `CLAUDE.md`.
- [ ] **Phone check:** open Aujourd'hui once on Wi-Fi, then airplane mode and reopen (cached copy).
- [ ] **Your call:** the automatic « Fin du délai de retour » reminders fill « Rappels sans projet » on Idées — hide them there, or give them their own fold? And should a new sale tick « Emportée aujourd'hui » by default?
- [ ] **Vault:** delete the two old guides « Admin guide html » and « Team member Guide html » (type Studio Bible) with the Vault's own delete — the Aide replaces them.
- [ ] **Aide wording:** read chapter 1 « Le projet et son périmètre » (`lib/aide/team.fr.ts`) — the French of your quote is a translation.
- [ ] **Reverse pricing inputs:** the cost items to count, the running-cost share rule (per work, per m², per hour?), the charges rate → [notes J](./design/2026-11-19/CatalogueGaps.notes.md#j-reverse-pricing-new-from-question-6)

## 3. Big designs — one at a time, design first (whole screen before code)

- [ ] **Catalogue gaps for the dossiers** (week-1 report): a phone « year pass » for drawings (211 / 251 Crayons have no year; the selection's 15 first) and a « measuring pass » for 2025–2026 (287 works with no size) — each its own GO → [report](./agent/reports/2026-11-28_system-overview.md)

- [ ] **Laboratoire:** open — the book as PDF, the material (Pem's content: Temperone, the white-budget recipe, « Transparence »), « Ce qui n'a pas marché » (a data state for a failed idea), Lexique and material pages → [Laboratoire](./design/2026-11-28/Laboratoire.md)
- [ ] **Studio equipment:** open — QR labels for places (first: shelves / boxes in the tree; codes need SQL + a place page), papers and tasks linked to an item, photo → proposed lines → [Equipment](./design/2026-11-28/Equipment.md)
- [ ] **Contacts, rest of the review:** better autofill; a fixed FR / EN label list for phones and the clean-up of the other imported labels (« Main », « Móvil », « Carte », « Travail » — « Mobile » / « Home » now follow the number's type) → [notes E, I](./design/2026-11-19/CatalogueGaps.notes.md#e-contacts-item-8)
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
- [ ] `saveContact`: the server writers still outside the door — team access, signature → [People.md §3](./design/2026-11-22/People.md).
- [ ] Eight kinds of record the museum standards expect (inscriptions, moves with « seen on », valuations, treatments, licences / reproductions, literature, objects coming in, details of each showing): place each on the map of homes, with the catalogue-gaps steps → [survey](./design/2026-11-21/Survey_MuseumStandards.md).
- [ ] 19. Fewer silent catches (lint warns) · one combined badge action on tab switch.

## 5. Parked — no GO

- [ ] Voice memos as batch instructions for the AI advisors (cloud or local): a memo marked « Instruction » is queued for them → design first (which advisors, what they may do alone, what waits for Pem's OK) → [RecorderPause](./design/2026-11-27/RecorderPause.md).
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
