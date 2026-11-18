# Stress test — PEM Hub on a throwaway copy (2026-11-18)

Side session `brave-goldberg-0cf0bd`. **Nothing was written to production.** The copy is a local Supabase in
Docker, built from **read-only** catalog reads of `mcrzsxrcoexnlwmaunte` (no rows except the 7 label tables).
No app fix was made here: the proposals at the end wait for Pem's GO.

## In short

- **Works end to end:** sale (paper → signed → deposit → paid → certificate → invoice → 7-step shipment → delivered → « Retour » → credit note), sale taken away, deposit with a sale out of it and a « Retour » before delivery (the paid-custody fix holds), loan, gift, exhibition with a deposit to the venue, production stages and tasks, the bin, review of a team member's edit, supplies. 12 wrong inputs all refused with the right reason. 10 orders created at the same second get clean numbers.
- **Broke (5):** the same work can be sold twice; one payment can be recorded twice; receiving a delivery twice doubles stock; shipments outlive their orders (and a cancelled work ends up in a later box to the same buyer); the Sales tab stops loading at about 200 orders (« URI too long »).
- **Security (5 real, 4 minor):** a team member can skip the review of their edits (`__skip_review=1`); any signed-in account can rewrite a work's themes / groups, create groups and write the Studio Bible PDF to the vault (service-role writes behind a « signed in » check only); any signed-in account reads and writes the whole `system_log` and every column of public works (buyer names in Historique). Production has 3 accounts, all team, sign-ups disabled — so the last two are latent today, the first three are not.
- **Slow:** on a production build every action is 55–310 ms on a local database (add the Stockholm round trips live). The **dev** server grows to 18–20 GB and dies after ~12 page compiles or a few hundred actions — explains « stuck » dev sessions.

## How it was run

| Piece | What | File (`scripts/stress/`) |
|---|---|---|
| Schema copy | 87 tables, 3 views, 92 functions, 385 constraints, 160 indexes, 78 triggers, 235 policies rebuilt from production catalogs via the Management API **read-only** endpoint (`supabase db dump` is refused: the access token has no `database_write` — good). Grants (2 038) and policies (245) compared line by line with production: identical. | `dump-schema.mjs`, `q.mjs` |
| Labels | `OeuvreStatus`, `Format`, `Support`, `Technique`, `tblRole`, `tblPresentation`, `work_action_type` (labels only) | `dump-lookups.mjs` |
| Fake data | Pem (contact 13, admin), a team member, an outside account (signed in, not team); 38 fake contacts (25 collectors, 6 galleries — 3 with two addresses —, 2 museums, 3 suppliers, framer, carrier); 1 200 works (188 production, 647 available, 253 archive; 90 sold, 18 consigned, 4 lent through « reconstituted » past orders, as the DB rules require); 1 131 placeholder AVIF images + thumbs; 25 themes, 5 groups, 5 events, 40 supplies | `seed.mjs` (re-runnable; refuses a non-local API) |
| R2 | Local stub (HTTPS S3 + HTTP public read) into `dump/r2/`; a DNS guard preloaded into the server sends every `*.r2.cloudflarestorage.com` to 127.0.0.1 (see S7) | `r2-stub.mjs`, `net-guard.mjs` |
| Server | Next on :3077 with local keys only (refuses if `.env.local` is there or any value names production). Dev first, then a **production build** (`--prod`) because dev leaks (P1). | `run-stress-dev.mjs` |
| Driving the app | The app's own Server Actions called by id — the same code as the buttons — as admin / team / outsider / anon; each step timed, then the database checked | `actions.mjs`, `run-chains.mjs` |
| Checks | RLS per role through the public API; all 381 actions as anon and outsider (row counts of every table before/after); admin-only actions as team; integrity SQL; pages at 1280 / 375 px with Playwright | `security.mjs`, `integrity.mjs`, `ui.mjs` |

Re-run: `supabase start --workdir scripts/stress` → `node scripts/stress/seed.mjs` → `node scripts/stress/r2-stub.mjs` →
`node scripts/stress/run-stress-dev.mjs --prod --build-only` then the « stress prod 3077 » launch entry →
`node scripts/stress/run-chains.mjs [chain…]`, `security.mjs rest|actions|admin`, `integrity.mjs`, `ui.mjs`.
Results land in `scripts/stress/dump/` (gitignored). `supabase stop --workdir scripts/stress` when done.

## Chains (production build, local DB)

| Chain | Steps | Result | p50 / max per step |
|---|---|---|---|
| Sale shipped → « Retour » → credit note | 15 | pass; draft paper, COA, invoice, credit note written | 155 / 734 ms |
| Sale « emportée » (no shipment, delivered at payment) | 3 | pass | 233 / 405 ms |
| Deposit at a gallery with 2 addresses → picker → shipment → out → sale out of the deposit (parent + 40 % commission, line « sold ») → « Retour » before delivery (back Consigné at the gallery, line reopened) → return shipment → closed | 21 | pass | 131 / 327 ms |
| Loan (signed → out → closed), gift (signed → handed over) | 7 | pass | 215 / 271 ms |
| Refusals: skipped step, reserved work sold again, no price, order to Pem, deposit without / inverted dates, archived work, negative amount, bad date | 12 | all refused. Selling a work **in production** is accepted (by design, `SALE_ORDER_FROM = [1,2,7]`: commissions / pre-orders) | 55–160 ms |
| Exhibition: event, dates, venue, 10-step template, selection of 12, deposit to the venue from the event (reminders written for its dates), prep ticks, event view | 15 | pass | 59 / 293 ms |
| Stages: catalogue (photo still needed) → photo done → Disponible → Archive → Disponible; tasks « Cataloguer » / « Photographier » follow; bin pauses open tasks, restore resumes | 7 | pass | 151 / 216 ms |
| Review: team edit → pending → team cannot approve → admin approves | 3 | pass | 150 / 208 ms |
| Supplies: order (2 lines) → ordered → partial receive (stock 21 → 25) | 4 | pass | 60 / 82 ms |
| Badges / What's new / work rules (admin and team) | 7 | pass; rule checks over 1 199 works 216 ms (team refused, admin only) | 55 / 216 ms |
| Volume: 60 sales draft → signed → paid in a row | 180 | create 215, sign 273, pay 312 ms p50 (dev: 426 / 490 / 532) | |
| 10 sales at the same second | 1 | V-2026-009 … 018, no gap, no duplicate (advisory lock) | |

Not covered: a field session with shots (capture is admin and runs through phone uploads — not scripted), calendar
sync (no account on the copy → no-op), click-through of forms in the browser (pages were loaded and measured, actions
were called directly).

## What broke

- **B1 — one work sold twice.** Two sales of the same work created at the same moment are both accepted and both sign (the work « Réservé » to the second buyer, the first order still « signed »). Paying both: both orders « Soldée », 1 000 € in for one 500 € work, 3 certificates, owner = whoever paid last. `busyWorks` / `circulationError` read then write; nothing in the database forbids two live sales on one work. Done one after the other the second is refused — only near-simultaneous clicks get through (two tabs, two people, a double tap).
- **B2 — one payment recorded twice.** Two full « Encaisser » on the same order at the same moment: 2 000 € recorded on a 1 000 € sale and 2 certificates for the work (`PEM-1181-3YN0YSEI`, `PEM-1181-E-1DMNTM`). `recordOrderPayment` sums, moves the step, then inserts — no lock.
- **B1 + B2 fix (local draft, Pem « Fix the double sale and double payment first »):** `supabase/sql/order_race_guards.sql` (two triggers: one open sale / gift and one open deposit / loan per work, a lock per work; a payment on a sale can never take the total above the price, the order row locked) + `advanceWorkOrder` moves the step only from the step it read (the second click gets « ord_err_step ») + `recordOrderPayment` refuses an amount above what is left (`ord_err_overpaid`, FR/EN). Checked on the local copy with `scripts/stress/races-plus.mjs` — 3 rounds, 21 checks, 0 failed: 5 sales of one work at once → 1; sale + gift at once → 1; 3 full payments at once → 1 000 €, 1 certificate; 300 € then 2 × 400 € at once → 700 €; deposit then balance still ends « Soldée »; 2 signatures at once → 1, one shipment. 13 of the 15 refused clicks had passed the app's own check — the database guard is what stops them. Each refused click leaves a cancelled draft (« Annulée : œuvres non ajoutées »), as any failed line insert already did. **The SQL is not applied to production** (needs Pem's OK).
- **B3 — receiving a delivery twice doubles the stock.** The same receive (6 units) sent twice at once: stock 17 → 29, the line shows 12 received of 10 ordered (`receive_supply_order` neither locks nor caps).
- **B4 — shipments outlive their order.** A cancelled or returned sale, and a loan closed by hand, leave their shipment « open » in Logistics; it can still be walked to « Livré ». Worse: a later order to the same buyer and address **joins** that shipment, so the cancelled work rides in the box — seen: one shipment to a collector carrying 7 orders, 2 of them cancelled (works #1192, #1043).
- **B5 — the Sales tab stops loading at about 200 orders.** `fetchWorkOrders` puts every order id into one URL (`.in('order_id', …)` three times); with 248 orders (~9.7 KB) the API answers « URI too long » and the tab shows « Impossible de charger les commandes : URI too long » while the menu badge says 131. Same pattern to check wherever an unbounded id list goes into `.in()`.

## Security

Good: every table has RLS; anon wrote nothing through any of the 381 actions; admin-only actions (purge, image delete, version restore, invoice, credit note, rule checks) refuse the team member; only `is_team()` / `is_admin()` are SECURITY DEFINER and callable by anon; anon and outsider could not delete anything through the API.

- **S1 — a team member can skip the review.** `saveWork` skips the « pending changes » gate when the form carries `__skip_review=1` — the flag meant for the admin's replay — without checking who sends it. Test: team member set work #1074's price to 1 € with no review row.
- **S2 — any signed-in account can write with the service key.** `saveWork` (theme and group links), `createWorkingGroupWithOeuvres` and `vaultStudioBible` only check « signed in », then write with the service-role client or straight to R2. Test, outside account: work #1073's themes replaced (1, 2, 3) — the app answered « ok »; a group created; the Studio Bible PDF written to the vault bucket (only its document row was stopped by RLS).
- **S3 — `system_log` is open to any signed-in account**, read and write (`authenticated_read` / `authenticated_insert` = true): the outside account read 665 entries (amounts, payment methods, order refs, moves, errors) and wrote a fake one.
- **S4 — public works are fully readable by any signed-in account** (policy `is_public OR is_team()` for `authenticated`, all columns): `loadOeuvreLongText` gave the outside account the Historique of a sold public work — buyer name and city. Anon has no grant on `Oeuvres`, so the public site is not concerned.
- **S5 — team members can write past the app's rules through the public API** with their own token: `Oeuvres` (no review), `payments` (amounts), `work_order` (status, price; the DB guards on `Oeuvres` still hold), the 7 label tables (insert / update / delete), empty rows in `Contact`, `tblImage`, `tblrelations`, `shipment`. Today every team member is trusted; this matters before a non-admin helper joins.
- S1–S2 need only a team account (S1) or any account (S2); S3–S4 are latent while all 3 production accounts are team and sign-ups stay disabled.
- Minor: **S6** `getAnalyticsStats` answers anon (site traffic numbers). **S7** 12 code paths build `https://<account>.eu.r2.cloudflarestorage.com` themselves and ignore `R2_S3_HOST` (order papers, COAs, invoices, vault, capture, exhibitions, portfolio, bible, `r2-s3-object-get`, the order-paper route): a test setup cannot redirect them — the copy's first run tried Cloudflare with fake keys (refused at TLS). **S8** anon reads all 1 688 theme links (non-public works included) and every `profiles` name. **S9** policy clutter: `(true OR is_team())` on 9 tables; two overlapping permissive policies on `Oeuvres` UPDATE, `inquiry` INSERT, `note_line` UPDATE.

## Slow / heavy

- **P1 — the dev server leaks.** It reaches 18–20 GB after ~12 Atelier page compiles or a few hundred Server Action calls, then webpack fails (`RangeError: Invalid string length` in `processAssets`) and every page answers 500 or hangs; actions went from 0.3 s to 5–7 s before that. Not tied to one page (all Atelier tabs render the same shell). Production builds fine (all routes) and stays stable.
- **P2 — production build, local DB:** order steps 130–310 ms, reads 40–65 ms, work-rule checks over 1 199 works 216 ms, Sales list (before B5) 60 ms. Pages to data (Playwright, network idle): 1.0–2.1 s desktop, 1.0–1.4 s at 375 px. Live adds the Paris → Stockholm round trip per query; the speed-measure note showed the DB itself is not the cost.
- **P3 — writes per order step are heavy but fine:** 248 orders made 1 191 `system_log` rows (880 STATUS_CHANGE — the app's event and the DB trigger's both) and 1 554 `oeuvre_versions` (11 for one work that went through several sales).

## Redundant or confusing

- **R1 — invoices are manual and nothing lists what is unbilled.** 125 sales « Soldée » / « Livrée » had no invoice; the only hint is `uninvoicedSameBuyer` inside one order's cascade view. Either make the invoice at « Soldée » like the certificate, or a « À facturer » count.
- **R2 — deletes that did nothing say « ok ».** `deletePeriod`, `deletePlace`, `deleteSource`, `deleteCreationStep`, `deleteSlideshow`, `moveFolder`, `setJournalEntryHidden`, `markSuiviReminderRead` answer `{ ok: true }` when RLS removed 0 rows (seen for the outside account) — a refused change looks done.
- **R3 — internal helpers are public endpoints.** Exported from `'use server'` files, so callable by anyone with their id: `syncOrderCalendarQuietly`, `makeOrderCoas`, `openShipmentForOrder`, `fetchAtelierShellPostPaint(client)`… Most guard themselves, but 52 actions answer a malformed call with a 500 (`supabase.from is not a function`, uuid / integer cast errors) instead of a clean refusal.
- **R4 — a sale of a consigned work opens a shipment from the studio** to the buyer although the gallery holds the work: who ships is unclear on the card.
- **R5 — Logistics is long.** 25 open shipments = 25 full cards, each with an 8-step chip row and 3 buttons; no folding, no grouping by step, and an empty shipment (no works) is listed like the others.
- **R6 — « Payé » has three sources** (order step, payments, the hand switch). The paid-custody batch now writes the switch at the step and shows where it comes from; kept as is.
- Look at 375 px: no page scrolls sideways; Production's board columns scroll inside the page (by design). Sales at 375 px: 3 controls past the right edge.

## Data integrity (after all runs)

`integrity.mjs` — on the copy: works on two live sales 1 (B1), money above price 1 (B2), works with several certificates 2, open shipments whose orders are all finished 1, delivered shipments of cancelled orders 2 (B4), paid sales without invoice 125 (R1), image row without file 1 (the team member's empty insert, S5). Clean: order and invoice numbering (no gap, no duplicate), every « Vendu » has a paid sale to its owner, every « Réservé » a signed sale to its buyer, no order without lines, every paper / COA / invoice file present, no graph node of a missing work.
The same SQL can be run read-only on production to see whether live data has any of these (not run here: blocked by this session's permissions).

## Money guards test (2026-11-18 afternoon, Pem « Yes, test it »)

The main session's draft `money_guards_DRAFT.sql` (shared notes, local_dcb80e42…) applied **to the local copy only**:
B1 and B2 as written, plus B3's 3-line cap put into `receive_supply_order`. My own two triggers (`order_race_guards.sql`)
were removed from the copy first, so only the draft was active. Each race run 2 rounds (`scripts/stress/money-guards.mjs`)
on two builds:
- **original code** — local main `c56eaef` (no code fix), built in a spare worktree `app-worktrees/stress-head`;
- **with the code fix** — this worktree: `advanceWorkOrder` moves the step only from the step it read, `recordOrderPayment` refuses more than is left.

| Race (simultaneous) | Original code + draft SQL | Code fix + draft SQL |
|---|---|---|
| **B1** 2 sales of one work · 5 sales of one work | 1 accepted each time. The others are refused with `work_busy`; the app shows « Erreur : work_busy » (code not mapped to a message). Each refused click leaves its order **cancelled with no line** (« Annulée : œuvres non ajoutées (work_busy) ») — 1 for 2 clicks, 4 for 5. Work stays « Disponible », one draft holds it. | Same. |
| **B2** 2 full « Encaisser » on a signed 1 000 € sale | Money right: **1 payment, 1 000 €**. But **the step ran twice**: 2 « paid » status events, **2 certificates** for the work, and the second click shows « L’étape est passée mais le paiement n’a pas été enregistré : payment_over_order » + an error log line « Order payment not written after its step ». Order « Soldée », work sold to the buyer, 1 shipment. | Second click refused before any write (« Cette étape n’est pas possible… »): 1 payment, 1 000 €, **1 certificate**, 1 status event, no error log. |
| **B3** the same receive (6 of 10) twice | 1 accepted; the second refused `supply_over_receive` — the toast shows the raw code. Stock +6 (not +12), line 6 of 10, order still « Commandée »; then the 4 left go in (10 of 10, « Reçue ») and 1 more is refused (« commande pas ouverte »). | Same. |

Extra with the code fix (`races-plus.mjs`, 1 round, 7/7 ok): 3 full payments at once → 1 000 €, 1 certificate; 300 € then 2 × 400 € at once → 700 €
(the refused one shows « L’étape est passée mais le paiement n’a pas été enregistré : payment_over_order » — wrong here, no step moved);
2 signatures at once → 1, one shipment.

**Single clicks, nothing legit broken** (`run-chains.mjs sale takeaway deposit loanGift supplies`): original code + draft — 51 steps, 0 failed;
code fix + draft — sale, takeaway, deposit (with return), loan and gift, supplies all 0 failed (run in parts: my test server was stopped twice from outside mid-run, no crash in its log; the parts cut off were rerun).
Covers sale → deposit → balance → certificate → invoice → shipment → « Retour »; takeaway paid and handed over; consignment out, sold from the gallery, returned; loan out / back; gift; supply order, receive part then rest.
One test-script check fixed on the way (takeaway counted older shipments of the same work from earlier runs, not this order's).

**Reading:**
- B1 and B3 hold with the draft alone.
- B2 needs both halves: the draft trigger keeps the money right, but without the code fix the second click still makes a second certificate and says the step moved without payment.
- Draft vs `order_race_guards.sql`: same B1 rule. The draft's payment cap adds `shipping_charge` (better: mine ignored it), and has B3. Mine raises `ord_err_busy:#<work>` / `ord_err_overpaid`, which the app already turns into a sentence. With the draft as is, three raw codes reach the screen (`work_busy`, `payment_over_order`, `supply_over_receive`) unless the app maps them or the draft raises the app's codes.
- Left behind by a refused B1 click: one cancelled empty order per refused click, numbered (V-2026-xxx uses a number). Same as any failed line insert today.
- The local copy now runs the draft triggers, not mine. `app-worktrees/stress-head` (spare worktree, detached at `c56eaef`, untracked test copy only) can be removed once read: `git worktree remove` will refuse because of the untracked scripts copy, so it needs `--force` — Pem's OK first.

## B4 + B5 fix, B2 shipping (2026-11-18 evening, Pem « fix that » / « check this out ») — local draft

Pem's calls relayed by the lead: B3 stays open on purpose (receiving more than ordered is allowed, « maybe a gift »;
the double tap is handled on the screen by the other session — no cap in `receive_supply_order`). `order_race_guards.sql`
supersedes the draft money-guards file. Nothing committed; no production write.

- **B2, shipping counted:** the buyer owes price + `shipping_charge` (invoiced on top), so the cap is that sum in both
  `order_race_guards.sql` (`payments_within_price`) and `recordOrderPayment`'s pre-check — before, a single transfer
  including shipping would have been refused. « Soldée » is still reached when the price is covered.
- **B4 — shipments follow their orders** (`orders-actions.ts`, `cascade-actions.ts`, no SQL):
  - `releaseOrderShipments`: an order cancelled (`cancelWorkOrder`), returned (`returnSaleOrder`) or closed
    (`advanceWorkOrder` → `closed`, by hand or by its delivered return box) takes its works off every box not yet
    « Expédié »; a box left empty is cancelled. A box on the road is left as it is.
  - `openShipmentForOrder` never joins a box whose works all belong to cancelled / closed orders (it opens a new one).
  - Logistics (`fetchShipments`) and the shipment steps (`advanceShipment`) leave those orders' works out of a box not
    yet gone; a box with nothing else is not listed. That covers boxes left by the old code without touching data.
- **B5 — long id lists in chunks** (`lib/supabase/in-chunks.ts`, 100 ids per request, in parallel): `fetchWorkOrders`
  (5 lists + works + refunds), `fetchSaleOrdersForReport`, `fetchEntrustedOut`, `expandShipments` (Logistics: up to
  200 boxes → their lines, works, contacts, orders, demands, claims), `boxHasLiveOrder`. Other `.in()` in
  `sales/*` / `lib/orders/*` are bounded (one order, one buyer, a chosen few). `lib/sales/income.ts` has none.

**Checks on the local copy** (production build of this worktree):
| Check | Result |
|---|---|
| `b4b5.mjs` — signed sale alone in its box, cancelled | box cancelled, empty |
| two sales to one place share a box; one cancelled | its work leaves, box stays open with the other |
| paid sale, « Retour » before delivery | its box cancelled |
| loan out, return box opened, loan closed by hand | return box cancelled |
| old-code leftover: open box holding only a cancelled order's work | a new order to that place opens its own box; Logistics hides the old one |
| Sales list | 374 orders listed in 44 ms (failed « URI too long » at 248 before) |
| Reports sale orders · Logistics with finished boxes | 286 · 51, no error |
| `races-plus.mjs` (B1 / B2), 2 rounds | 14 / 14 ok |
| `run-chains.mjs sale takeaway deposit loanGift supplies` | 50 / 51 — the one « fail » is the B3 double receive, now accepted by Pem's decision |

Typecheck 0 errors · `npm run lint` 0 errors (302 warnings, none in changed files) · `i18n:check` ok.

**Production data:** boxes the old code left can be listed read-only — open boxes whose every work is on a cancelled /
closed order (local copy after all runs: 1 such box; 11 dead-order works sitting in boxes not yet gone):
```sql
select s.id, s.status, s.to_contact_id from shipment s
 where s.status not in ('shipped', 'delivered', 'cancelled')
   and exists (select 1 from shipment_work sw where sw.shipment_id = s.id)
   and not exists (select 1 from shipment_work sw left join work_order_work l on l.id = sw.order_line_id
                   left join work_order o on o.id = l.order_id
                    where sw.shipment_id = s.id and (o.id is null or o.status not in ('cancelled', 'closed')));
```
The app now ignores them; cancelling them in the data would be an SQL write — Pem's separate OK.

## TODO §4 on the copy (2026-11-18 evening, Pem « test whatever is in the todo.md … »)

Copy brought to main `6f43117`; its schema re-diffed read-only against production (tables / columns / functions / triggers /
policies): identical after copying production's two guard functions and `system_log_team_only.sql`. Production build of the
worktree on the copy, built-in browser pane (hidden → viewport emulated 1280 × 800 / 375 × 812, page `requestAnimationFrame`
shimmed, `confirm()` auto-yes), fake admin and fake team accounts. Where the pane can't act (microphone, file picker, HTML
drag-and-drop, Shift on its own drags) the same server action or DOM event was used and it says so. Running notes:
`scripts/stress/dump/todo4-notes.md`; screenshots `docs/design/2026-11-18/todo4-shots/`. Nothing fixed.

| Item | Result |
|---|---|
| Order guards (double « Encaisser », two tabs) | passed earlier today (races-plus 14/14) |
| Collector share kit: make + PDF, phone, enquiry → Triage chip, PDF download, Prolonger / Retirer | **passed** (1 look issue) |
| Phone navigation as admin: Fil tile + count, « Actions » rows, « Écrire » | **passed** (copy slips) |
| First order through the chain: signed → shipment, paid → certificate, invoice, first payment | **passed** (1 bug, 1 look issue) |
| First supply order: Recevoir → stock / cost / supplier; expense + invoice file | **passed** |
| « Partager » an order paper on the computer; line value on a draft | **passed** (download) — phone share sheet skipped (iPhone) |
| « #équipe » voice note on the team's Aujourd'hui + What's new dots | **passed** — recording skipped (no microphone; note made through `createVoiceNote`) |
| First sale through « Soldée »: « Payé » ticks itself; « Retour » out of a deposit → « Consigné »; « Choisir l'adresse » | **passed** (Retour via the action) |
| Security rules: image upload + contact address lookup | **passed** (no CSP violation) |
| « Rappels sans projet » → « En faire une idée » | **passed** (1 confusing point) |
| Export labels L7163 + L7651, QR | sheets **passed**; QR content **passed**; **QR target FAILED** (opens Vue d'ensemble); real print skipped |
| Waiting photo + production dates | **passed** (work card shows no waiting photo; « 2 peintures » for one work) |
| « Historique de création » saved / edited / deleted | **passed** |
| Small GIFs 40 × 40 + round, at 375 | **passed** |
| Journal ✦ suggestions: hover preview + loupe | **passed** (seeded 1 suggestion; « ✦ ✦ » slip) |
| Constellation: undo a link delete, Shift+drag, arrow tool, arrow on a typed link | Shift+drag + arrow tool **passed**; typed link saved; its arrow + undo of a link delete **not checked** (canvas, needs Pem's eye) |
| Slideshow: GIF of 20+ works, « Renommer », full loop | **passed** — full screen + swipe skipped (iPhone) |
| Batch modify, export, print 300 dpi, Local jobs, Production drag-back, contact from the pop-up | **passed** (pop-up look issue); physical print skipped; « Lancer sur ce PC » not clicked (worker reads the real keys) |
| Field capture: technique / support written, remove an applied photo | **passed** (actions; no camera) |
| Search after « Commentaires » (embed worker), speed on the live site | not in this list (PC worker / live site) |

**Bugs (proposed fix — Pem decides)**
1. **A label QR / « Copier le lien » does not open the work.** `/atelier/works/<id>` → `/atelier?work=<id>` → `app/atelier/page.tsx`
   ends with `redirect('/atelier/overview')` and drops `?work=`; seen: Vue d'ensemble, no work. `/atelier/overview?work=<id>` opens
   it. Fix: keep the query on that last redirect, as the two branches above it do.
2. **« Se déconnecter » signs the user out everywhere.** `components/shared/AccountActions.tsx` calls `signOut()` (Supabase default
   scope `global`); seen: signing the admin out in one tab ended the admin's other sessions. Fix: `signOut({ scope: 'local' })`, or
   say « partout » on the button if that is wanted.
3. **A desktop scroll changes a payment amount.** With the amount focused, scrolling the order panel turned 300 € into 299 €
   (`input type=number` + wheel) — shot 01. Fix: blur number inputs on wheel (or `type=text inputmode=decimal`), at least for money.
4. **Kit enquiry checkboxes unreadable in dark mode** (`color-scheme: dark` on a light page: unticked = solid dark square) — shot 03;
   same for the slideshow panel and the audio player. Fix: `color-scheme: light` on the kit page / light panels.
5. **Contact pop-up after « Enregistrer »:** stays open, no toast; at 1280 × 800 the form is a short strip with the buttons
   mid-height — shot 07.

**Look / copy / confusing (smaller)**
- Order panel clips « Émettre une facture pour 4 commandes… » and « Retrait (atelier ou événement) » at 1280 — shot 02.
- Inventory title column (panel open) and Production cards cut titles to 2–3 letters at 1280 — shot 04.
- Phone: a live selection keeps its floating bar over every page and over the bottom bar — shot 06; the « Écrit enregistré » toast
  covers the bottom bar.
- « 1 entrées · 1 notes », « 1 suggestions à revoir » (singular), Journal « ✦ ✦ Suggestions IA », its left button overflows — shot 08.
- New sale form ticks « Emportée aujourd'hui » by default.
- « Rappels sans projet » is filled with the automatic « Fin du délai de retour — vente … » reminders (one per delivered sale),
  each offering « En faire une idée »; the row says « 19 nov. », not « Demain ».
- Supply orders list « Reçue 0 / 2 » for a partly received order; a new line's « Prix HT » is not pre-filled.
- Phone ☰ menu has no What's new dots (desktop sidebar has 10); « Logistique 34 en route » counts boxes not yet on the road;
  team Overview shows « Rappels 0 » next to « Rappels 40 ».
- The Journal day counts « 2 peintures » when a session and its item are the same work; the work card says nothing of a waiting photo.
- Every labels file is `etiquettes_<date>`: two sheets the same day overwrite each other in Downloads.

**Harness notes:** a stale service worker on `localhost:3077` (from an earlier build) made every request of a page fail until
unregistered — worth checking that an old `sw.js` on the live domain can never block pages. The fake image server now listens on
IPv6 too; the test scripts' Flight parser reads large text chunks (labels / PDFs).

## Proposals, ranked

1. **Guard the money in the database (B1, B2, B3).** A unique partial index or trigger: at most one live sale line (signed → delivered) per work; `recordOrderPayment` and `receive_supply_order` as one SQL function each that locks the order row (`for update`), checks the remaining amount / quantity and writes step + payment together; disable the button while the call runs.
2. **Close the review and service-key holes (S1, S2).** `saveWork` honours `__skip_review` only for an admin; every action that writes with the service client checks `is_team()` (or `is_admin()`) first — `saveWork`, `createWorkingGroupWithOeuvres`, `vaultStudioBible`, and a sweep of the other `createServiceClient()` callers.
3. **Sales list in pages or one join (B5)** — chunk `.in()` lists (≈ 100 ids) or read through an RPC; check the other unbounded `.in()` reads.
4. **Shipments follow their orders (B4).** Cancel / return / close by hand removes the order's lines from open shipments (and cancels an empty one); `advanceShipment` and `openShipmentForOrder` skip lines of cancelled orders.
5. **Before any collector or helper account (S3, S4, S5):** `system_log` read / insert for team only (the logger is server-side); non-team readers of `Oeuvres` get public columns only (a view or column grants); decide whether non-admin team members may write `payments`, `work_order`, label tables directly.
6. **One R2 endpoint helper for the 12 paths (S7).**
7. **« À facturer »** — invoice at « Soldée » or a count of paid sales without invoice (R1).
8. **Actions say what happened (R2, R3):** a write that touched 0 rows is an error; helpers move out of `'use server'` files; bad input → a clean error, not a 500.
9. **Logistics folded and denser (R5)** — one line per shipment, grouped by step, open on tap (collapse-by-default, mixing-desk density).
10. **Dev leak (P1)** — try `next dev --turbo` or a periodic restart; dev only.

Questions for Pem: can a team member put a work in the bin (they can today; « purge » stays admin)? Should the gallery ship a work it holds (R4)?
