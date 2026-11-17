# PEM Hub — TODO

_Open items only, one line each, in order. Details → [`TODO_NOTES.md`](./TODO_NOTES.md). Closed → [`DONE.md`](./DONE.md). Dropped on purpose → [`TODO_REFUSED.md`](./TODO_REFUSED.md). Aims → [`STRATEGY.md`](./STRATEGY.md)._

**Last refresh: 2026-11-16 pm** (parallel batch 1: B9, 1e, 20, 21 closed → [DONE](./DONE.md); earlier: B7 labels image + period places + two §4 checks closed → [DONE](./DONE.md); earlier: bug batch 1 — B1, B2, B8, B10, 1f — closed → [DONE](./DONE.md); earlier: Pem's screenshots of 2026-11-15 triaged; verified against live code + DB, `origin/main` `2a9c714`). Order: bugs first, then Pem's rethink (design whole screens before building — [RETHINK](./RETHINK_2026-11-14.md)), then the rest. Item numbers are kept from earlier lists (other docs point to them); a closed item leaves for [DONE](./DONE.md) — never ticked in place. No open handoff: this file is the current batch.

## 0. Bugs — fix now (each still needs Pem's GO to edit, `CLAUDE.md`)

_None open (B13, B14 closed 2026-11-17 → [DONE](./DONE.md))._

## 1. Waiting on Pem — only you can do these

- [ ] **Handwriting test:** give the folder of ~10 notebook pages.
- [ ] **R2 access key rotation (O2)** — not done or not recorded; note the date in `CLAUDE.md`.
- [ ] **Restore drill (O4)** — never run ([`BACKUP_RECOVERY.md`](./BACKUP_RECOVERY.md)).
- [ ] **Batch scan of expenses / dockets (11e):** GO to read dockets by OCR on the PC (widening OCR needs your explicit GO, `CLAUDE.md`), and which scan path (below).

## 2. Rethink — design first (Pem 2026-11-14) → [RETHINK](./RETHINK_2026-11-14.md)

Each one: what the screen is for, a whole-screen design, Pem's say — then build. No tweaks to the current screens meanwhile (bugs in §0 excepted).

- [ ] R1 / R2 leftovers (R1 + R2 closed 2026-11-17 → [DONE](./DONE.md); board: [`Rethink_Board.html`](./design/2026-11-17/Rethink_Board.html)). **Pem:** phone checks (Aujourd'hui on 4G vs the [baseline](./design/2026-11-17/PhoneToday.notes.md#baseline-measured-2026-11-17-on-production-as-admin), cached copy, a Journal day with a voice note + « Relier… », the Fil rows on Overview, one sign-out); SQL GO: Inspiration photo (linked to a work / idée) and storing the ✦ match score. **Lead:** old notes → lines written 2026-11-17 (98 `note_line` rows on 96 works, `187fe9f`; 83 undated show « avant mai 2026 »); **Pem:** the old « Commentaires & notes » field still shows above the lines, so each moved comment appears twice — hide or retire it?; run the embed worker once with the quieter ✦ settings; the servers are in Stockholm (`vercel.json` `arn1`, Pem's GO 2026-11-17; live `6a98ce5`: dynamic routes answer from `arn1`, signed-out `/hub` redirect 0.17–0.25 s warm, 1.65 s cold, from Pem's PC) — the signed-in measure is Pem's phone check. Parked: the team's phone; `components/hub/HubLauncherClient.tsx` no longer routed (delete needs Pem's OK).
- [ ] R4. **Timeline + map + previews.** Timeline map / map « Création » mode; `#1234` thumbnail + loupe everywhere (Notes triage « #2357 · Les mortes marguerites » has neither — Pem 2026-11-15); a title next to the number in the AI suggestion rows → [notes](./TODO_NOTES.md#previews) Design drafted 2026-11-17 → [`design/2026-11-17/R4_TimelineMap.notes.md`](./design/2026-11-17/R4_TimelineMap.notes.md) + mockup; Pem's answers in v2. **Build v1 landed 2026-11-17 (`52bd738`, local):** Carte « Création » mode + Œuvres pins at the work's address (C1, C3 fixed); new **Chronologie** tab (`/atelier/chronologie`, Catalogue, desktop only); preview rule — WorkChip / WorkRef thumb + title, loupe with caption on hold — swept over Journal, Aujourd'hui, Fil / Pour vous, card sessions, Broadcast, Fiscal, voice-note link. Rutali #1617–#1625 dated 2024-08 + period Marseille (SQL, Pem's OK). Left: sweep Orders / Vault / Production / Share triage / Exhibitions / Pipeline / Constellation / ⌘K; R4 mockup not redrawn; /hub JS 276.8 / 280 kB (near budget).
- [ ] R6. **Exhibitions → « Exhibitions / events »** (Pem 2026-11-15): collaborations live there too; **editions** (prints, books… issued from a series) as an in-between state — taken out of the inventory, then back. An event is about works (a print-series launch is one): a group of works tracked out and back + what to prepare; PR and books / publications stay in Pipeline (Pem 2026-11-15, [RETHINK](./RETHINK_2026-11-14.md)). Ties to the custody model ([`WORK_CUSTODY_MODEL.md`](./WORK_CUSTODY_MODEL.md)). Design drafted 2026-11-17 on the R7 orders model → [`design/2026-11-17/R6_Events.notes.md`](./design/2026-11-17/R6_Events.notes.md) + mockup; 12 questions for Pem; no code, no SQL.
- [ ] R8. **Public site, from the review of 2026-11-16** → [SITE_REVIEW](./SITE_REVIEW_2026-11-16.md): paintings shown big, one page per work (`/works/[id]-[slug]`), a landing that says who / what in 3 s, 1200×630 JPEG previews, ISR + images off `r2.dev`, one name, real FR / EN, About / Practice content, calls to action (buy / commission / newsletter / Instagram), captions with medium. Daily feed: public journal entries at `/journal` + RSS → weekly letter (Buttondown / Kit) + Instagram pointing back (needs a `public` visibility value, anon read policy + GRANT, a screen design, Pem's GO). Pem picks what goes first. **Assessed 2026-11-17** → [`R8_SiteAssessment.notes.md`](./design/2026-11-17/R8_SiteAssessment.notes.md): what the Atelier « Site » module controls vs the 10 items; look decisions A–F for Pem (big painting vs true-scale wall first); a first batch that needs no look decision (`/works` `&amp;` bug + « aperçu » label, `/works` speed, About / Practice server-rendered, OG images, captions + enquiry reasons + Instagram, dead knobs). **First batch landed 2026-11-17 (`c76cdf2`):** /works text card (entities, no « aperçu »), /works static + 15 min refresh, /about + /practice server-rendered, 1200×630 JPEG previews, medium in captions + mouse / touch zoom hint, enquiry reasons Acquérir / Commande / Exposition / Presse (stored as `general` + « Motif : » until SQL), Instagram link, text size + parallax knobs hidden. Left: SQL GO for the enquiry categories; Pem fills email / phone / Instagram in the Site module; confirm « Papier huile » / « Papier Yupo »; `loadPortfolioSectionsFromR2` drops `pages` + `knobs` (every knob edit is lost — 2-line fix, but About blocks would keep their own bio copy: Pem decides); look decisions A–G.
- [ ] R7. **Commercial: orders and their papers in one place** (Pem 2026-11-15: « this needs to be rationalized »). Today: sales in « Sales » (order + PDF), consignment / loan slips in **Pipeline** (`createConsignmentOrder` → « Bordereau » PDF in the Vault), gift slip in the **work card** gift dialog (« Bordereau de Don »). Consignment is not a sale → rename « Sales » to « Orders »? Not proven: **0 sale orders, 0 consignment / loan orders** in the data (6 gifts) — no path clicked through yet → [notes](./TODO_NOTES.md#custody) **Drafted 2026-11-17** → [`R7_Orders.notes.md`](./design/2026-11-17/R7_Orders.notes.md) + mockup: one « Contrats » screen (Vente · Dépôt · Prêt · Don, steps, papers incl. the signed copy) replacing Ventes; 8 issues found in code (Pipeline PDF regenerate broken, a gift zeroes the price, loan slip says « dépôt », gift slip unfiled…); 9 questions for Pem, incl. build now or at the first real case. **Build step 1 landed 2026-11-17 (`b266f3c`):** « Commandes » in Sales (`app/atelier/(portal)/sales/_components/Orders.tsx`, `NewOrderForm.tsx`, `orders-actions.ts`), step buttons, out / back dates required for deposit + loan, one paper per order filed in the Vault under Commandes with the signed copy beside it (`lib/orders/order-paper.ts`); the 7 gift orders show as G-R-001…007 (seen as admin in Pem's Chrome). **Step 2 landed 2026-11-17 (`db2f40e`, local):** work card « Don… », Pipeline vente / consignment, Exhibitions « send works » and phone `/atelier/sale/new` make draft `work_order` orders; « Encaisser » payments on the order, counted in Revenus & dépenses; menu Business / Commandes; contact merge moves orders. Not clicked on real works (types only). **Review pack landed (`6a22c63`):** [`R7_Papers_Wording.md`](./design/2026-11-17/R7_Papers_Wording.md) (for a lawyer / accountant) + [`R7_Open_Decisions.md`](./design/2026-11-17/R7_Open_Decisions.md). **Leftovers + Pem's decisions landed 2026-11-17 (`9506cb1`, local):** value per order line (gift: reference, never printed; loan / Confié: insurance; deposit: agreed price); gift ownership at handover (deed remade, new wording for the lawyer); old Sales figures → Revenus & dépenses, Reports, cooling-off, enquiry, income / cost on `work_order`; card stage change → draft order in the Fil; dead files removed (Pem's OK); click-through on test works done and purged (DB checked: only the 7 gift orders). Legal: [`LEGAL_POLICY.md`](./LEGAL_POLICY.md) draft + Pem's answers. Left: **SQL `work_order_r7_decisions.sql`** (Confié kind + gift closing at handover — own OK; then `ENTRUSTED_LIVE` true + gen:types); then `work_order_drop_legacy.sql` (own OK); **house rule: 14-day return + buyer information on every sale, money held « en attente » until the period ends** (to build); line value editable after creation; « Confié » ↔ Production board tasks (not linked); preview sweep of Orders (R4); share button for papers. Pem / lawyer / accountant: the questions page in `LEGAL_POLICY.md` (status artiste-auteur, VAT, CISG exclusion, gift wording + resale clause).

## 3. To build — outside the rethink (needs GO)

Trace
- [ ] 22. Work card leftovers (R3 closed 2026-11-17 → [DONE](./DONE.md)): OK `supabase/sql/place_validity_dates.sql` (place from / to dates; the place-vs-date rule no-ops until then) + a screen to enter those dates · the work session's own « + œuvre » flow in the phone recording screen · « Brouillon » on the recording screen (« Annuler » for now) · 3 card files no longer used (`DrawerContentIdentitySection.tsx`, `DrawerContentNotesVersionSection.tsx`, `DrawerContentGroupsSection.tsx`) — delete on Pem's OK.
- [ ] 1. Handwriting batch (after the test above) → [notes](./TODO_NOTES.md#journal-phase-2)
- [ ] 1c. Voice notes longer than one upload (~4 MB) or recorded offline → build only if Pem hits either ≥2× → [notes](./TODO_NOTES.md#voice-limits)

Links
- [ ] 23. **Theme notes** (Pem 2026-11-17): `theme` has only `id, name`, so the text goes in the title (4 names over 40 characters, longest 166) → add a notes field so titles stay short. SQL GO → [R1 brief](./design/2026-11-17/R1_InputsFeed.notes.md#parked-from-the-same-session-not-r1)
- [ ] 24. **A more human « What's new »** (Pem 2026-11-17): the team doesn't read it — too many updates, too complex, impersonal. Ideas: a « new » dot on the changed button with one plain sentence on first tap, or a short voice note from Pem per batch; the list stays as the archive → [R1 brief](./design/2026-11-17/R1_InputsFeed.notes.md#parked-from-the-same-session-not-r1)

Transmission (safety of what is kept)
- [ ] 8. Security remaining: CSP is report-only (2026-11-16) — watch the live console, then enforce → [notes](./TODO_NOTES.md#security) (anon grants, ledger, `xlsx`, `system_log` / `studio_task` closed 2026-11-16 → [DONE](./DONE.md))

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
