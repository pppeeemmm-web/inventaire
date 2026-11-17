# Orders and their papers in one place (R7): design brief, 2026-11-17 (v2)

Design only, nothing built, no SQL run (reads only). Inputs: TODO R7, [TODO_NOTES#custody](../../TODO_NOTES.md#custody), [TODO_NOTES#money](../../TODO_NOTES.md#money), [WORK_CUSTODY_MODEL](../../WORK_CUSTODY_MODEL.md), [RETHINK](../../RETHINK_2026-11-14.md) (« Orders and their papers »), [STRATEGY](../../STRATEGY.md) aim 4 (Value: provenance, certificates). Mockup next to this file: [R7_Orders.mockup.html](./R7_Orders.mockup.html) (the life of each kind of order, desktop, two 375 px phones).

## v2 — Pem's answers (2026-11-17). Where they differ from v1 below, this section wins.

- **Name: « Commandes / Orders ».** Pem: « I see nothing wrong with order »; « Contrats » sounds legal. (v1 proposed « Contrats »; every « Contrats » / « agreement » below now reads « Commandes » / « order ».)
- **Every movement is an order — gifts included.** A gift is a full order (draft → deed signed → handed over) with its paper, like the other three.
- **A hand change in the work card becomes a draft order.** Pem: when a stage is overwritten from the work drawer, « it would create an order to be submitted to me to check all the details ». So the drawer never moves a work out of Pem's hands by itself: picking « Vendu / Consigné / Prêt / Don » there opens (or creates) a **draft order** for that work, which lands in Pem's feed (R1 « Fil », work-fact approvals section) to check and confirm. The locked stage pills become a link to their order.
- **Loans and deposits can be for a single work, made from anywhere.** Today a loan can only start from Exhibitions and a deposit from Pipeline / Exhibitions — « funny, because loans can be individual ». « + Nouvelle commande » (Orders screen) and the work card both start any of the four kinds, one work or many.
- **Loan ≠ deposit** (Pem, agreed): a **loan always comes back** (exhibition, institution, a period, no sale); a **deposit is an intermediary step** (placed with a dealer to sell: it ends in a sale or comes back). Both leave Pem the owner and change the custodian. Their papers say different things (below, « Papers per kind »), so the loan paper must stop printing « dépôt ».
- **Papers and Vault: a naming policy and one folder per kind** (« Policies about namings should be built … folders should be rationalized »). See « Naming and filing policy » below.
- **Refs:** one series per kind, counted in order — part of the policy.
- **Drafts first:** every order starts as a draft with its paper; works move only when it is signed / goes out. « Sure, as usual. »
- **The 6 old gifts without a paper get an order** each, marked « reconstituted »: what the data holds (recipient = current owner, status Gift) and blanks where nothing is known — Pem cannot give all the details.
- **Commercial becomes « Business »** (« only formal, but for understanding and clarity »): Orders, Contacts, Map, Logistics, Revenue & expenses (Fiscal), Vault. The revenue-by-year chart and the sales pivot move out of Orders into Revenue & expenses.
- **Build now, test with mock orders** (Pem: « you can make mock orders, we'll delete them after, just to test the line »). Deleting the mock orders afterwards still gets its own OK.
- **SQL: yes** to one table for the four kinds, a real list of works per order, the address the works go to, a link from each paper to its order. The migration is written and shown before it is applied (own OK, `CLAUDE.md`).
- **Still open:** how papers are **sent** (print / email / signature) and so what the phone does — « we need to set this in stone better »; and the **gift price** (keep the price as the work's value?) — « I don't know the implications … we need to look at this ».
- Found issue 6 (gifting a deposited / lent work leaves its order open): **« Fix that »** — done as part of the build (with the works list in a real table it is a few lines; in today's code it means rewriting the `BATCH_IDS` notes text). Issue 1 (Pipeline « Regénérer le PDF »): « to be looked at » — Pipeline stops making papers anyway (it links to the order).

### Works coming back in (Pem's question, 2026-11-17)

« Could a work that's been sold by me be deposited to me, and would that come into my archive? » — e.g. a collector lends a work back for a show, or asks Pem to keep or resell it.

- **Today:** possible by hand, with no paper. A sold work (« Vendu », owner = collector) may have Pem as custodian — the DB allows it without an order (`oeuvre_holder_check`, status 6). It stays « Vendu », never « Archive artiste » (that stage means Pem owns it and took it out of circulation).
- **Proposal: the same orders, the other way round.** A deposit or a loan gets a **direction**: *out* (Pem → gallery / borrower, as designed) or *in* (collector → Pem). « Prêt reçu » = borrowed back for an exhibition (the collector's loan agreement, condition reports, insurance on Pem's side); « Dépôt reçu » = the collector asks Pem to keep or sell it (secondary market — rare, Pem works in the primary market). Owner stays the collector; custodian becomes Pem while it is « in », back to the collector at « closed ». A sale *by* Pem of a work Pem does not own is out of scope until a real case.
- **The work's card shows it as « Vendu · chez Pem (prêt reçu P-2026-00x) »** — still in the catalogue, never in the archive.
- **Needs:** one column `work_order.direction` (`out` default / `in`), allowed on deposit and loan only, and the custody check reading it — a small additive migration, own OK. Refs could stay one series per kind, the paper title saying « reçu ».
- **Pem 2026-11-17: « Later »** — not before the create form. The form is built for outgoing orders; the direction is added when a real case comes back in.

### Papers per kind (what each one must say)

| Kind | Paper (FR title) | Says | Signed by |
|---|---|---|---|
| Vente | Bon de commande, then **Facture** when paid; Certificat d'authenticité | works, price, discount, deposit and balance, delivery, cooling-off | Pem + buyer |
| Dépôt | **Bordereau de dépôt-vente** | works, agreed sale price per work, commission, how and when Pem is paid after a sale, insurance while held, end date / return | Pem + gallery |
| Prêt | **Contrat de prêt** (+ condition report out and back) | works, purpose (exhibition…), dates out / back, insurance value « nail to nail », credit line, **no sale** | Pem + borrower |
| Don | **Acte de don** | works, recipient, date, value declared (open question), hand-over | Pem (+ recipient) |

### Naming and filing policy (proposal)

- **Refs:** `V-2026-001` (vente), `D-2026-001` (dépôt), `P-2026-001` (prêt), `G-2026-001` (don / gift); counted per kind per year; reconstituted old gifts `G-R-001…`.
- **File names:** `<REF>_<paper>[_signe].pdf` — e.g. `V-2026-001_bon-de-commande.pdf`, `V-2026-001_facture.pdf`, `D-2026-001_bordereau-depot.pdf`, `P-2026-001_contrat-pret.pdf`, `P-2026-001_constat-depart.pdf`, `G-2026-001_acte-de-don_signe.pdf`.
- **Vault folders, one per kind:** `Commandes/Ventes`, `Commandes/Dépôts`, `Commandes/Prêts`, `Commandes/Dons`. The certificate stays in `COA` and is also listed on its order. The 1 existing gift slip moves to `Commandes/Dons`.
- One rule in code (`lib/vault/folder-routing.ts` grows it), never typed by hand.

### Does it fit a traditional fine-art studio? (Pem's question)

Yes for the papers: a studio or gallery works with exactly these four — invoice / bill of sale with a certificate, consignment agreement (dépôt-vente), loan agreement with condition reports and insurance, gift deed. What is ours is **one list for all four** and the word « order » for a gift or a loan; the papers keep their usual names, so a gallery, a museum or an accountant receives the document they expect. The one list is what gives provenance: every movement of a work, dated, with its paper.

### Build plan (proposal, after the open points above are settled or parked)

1. **SQL migration, shown first** (own OK): one `work_order` table (kind, ref, other party, address, status + dated steps, money, notes) + `work_order_work` (one row per work) + `document.work_order_id`; `payments` and `shipment` point to it; ref series per kind; RLS + explicit `GRANT`; `sale_order` / `consignment_order` (0 rows) dropped after the code moves. Then `npm run gen:types`.
   **Drafted 2026-11-17, not applied** (Pem: « Yes, write it »), three files, each its own OK:
   - [`work_order.sql`](../../../supabase/sql/work_order.sql) — additive, today's code keeps working: the two tables, ref trigger (V / D / P / G-YYYY-NNN), step dates stamped by the DB, kind / ref locked; a paid sale or a signed gift **takes its works off any open deposit / loan and closes it when empty** (found issue 6, in the DB so every path gets it); custody checks (`oeuvre_order_exists`), destroyed / lost (`oeuvre_fate_close_orders`) and shipment-delivered read both old and new orders; links on `document`, `payments`, `shipment`, `inquiry`; RLS team read / write, admin delete (a team member may take a work off a draft only); no anon grant.
   - [`work_order_gift_backfill.sql`](../../../supabase/sql/work_order_gift_backfill.sql) — data: the 7 works in « Gift » get `G-R-001…007` (handed over, reconstituted, dates blank where unknown); #287's slip linked and filed in `Commandes/Dons`. Stops if the count is no longer 7. Prices untouched.
   - [`work_order_drop_legacy.sql`](../../../supabase/sql/work_order_drop_legacy.sql) — only after the code moved (a `rg` must find no `sale_order` / `consignment_order` / `BATCH_IDS`): custody checks on new orders only, **gift rule** in `oeuvre_holder_check` (a work becomes « Gift » only through a signed gift order, reaches the recipient's hands only once handed over), drops the old tables, columns, ref sequence and `oeuvre_batch_ids`.
   **Step 1 applied 2026-11-17** (Pem: « Apply step 1 ») as migrations `work_order_r7_step1` + `work_order_r7_step1_grants` (the second removes TRUNCATE / REFERENCES / TRIGGER that Supabase's default privileges had given `authenticated`; RLS does not cover TRUNCATE). Checked live: both tables empty, RLS on, 8 policies, no anon grant, both triggers, `work_order_id` on `document` / `payments` / `shipment` / `inquiry`, security advisor shows nothing new. `npm run gen:types` + `npm run typecheck` pass (the regenerated types also carry `feed_item_state` / `note_line`, applied by the R1 session). No screen uses the new tables yet.
   **Step 2 applied 2026-11-17** (Pem: « Yes, run step 2 »), migrations `work_order_r7_step2_gift_backfill` + `work_order_r7_step2_clear_stamped_dates`. Checked live: 7 gift orders `G-R-001` (#287) … `G-R-007` (#2341), each « handed over », reconstituted, recipient = the work's owner (7 / 7 match); only #287 has a date (deed 2026-05-21, from its slip) and a paper; hand-over dates empty (the first run had stamped today's date through the step-date rule — cleared). #287's « Bordereau de Don » is linked to its order and filed in `Commandes/Dons` (+ folder marker). Work rows untouched (7 still in « Gift », prices unchanged). Step 3 needs its own OK, after the code moves.
   Code that reads the old tables today (to move in steps 2–4): `app/atelier/(portal)/sales/*`, `app/atelier/consignments/actions.ts`, `app/atelier/sale/new/actions.ts`, `app/atelier/works/gift-actions.ts`, `app/atelier/(portal)/exhibitions/actions.ts`, `components/atelier/pipeline/PipelineProcess{Modal,Drawer}.tsx`, `app/api/cron/return-window/route.ts`, `lib/sale-return-window.ts`, `lib/sales/*`, `app/atelier/(portal)/logistics/actions.ts`, `app/atelier/(portal)/contacts/actions.ts` (contact merge), `/enquiry?sale_order_id=`.
2. **Orders screen** (desktop) replacing Ventes; « Business » group; revenue chart → Revenue & expenses.
   **Slice 1 built 2026-11-17 (read only), verified against live code 2026-11-17:** the Ventes tab (`/atelier/sales`) opens on « Commandes » — [`Orders.tsx`](../../../app/atelier/(portal)/sales/_components/Orders.tsx) + [`orders-actions.ts`](../../../app/atelier/(portal)/sales/orders-actions.ts) (`fetchWorkOrders`), copy in `lib/i18n/messages/orders.messages.ts`. Filters by kind, « + closes », list + the order (steps with dates, works → work card, papers → signed URL, money, notes); phone: cards → the order, « ‹ Commandes ». The former Sales panel is folded below until its figures move. Seen in a browser (dev server, live DB): the 7 reconstituted gift orders at 1280 px and 375 px, no page overflow; `typecheck`, `lint`, `i18n:check`, `atelier:chrome:check` pass. Not yet: create / move orders, papers, « Business » rename (sidebar label still « Commercial / Ventes »), entry points.
   **Slice 2 built 2026-11-17 (Pem: « Yes, start it »), verified against live code 2026-11-17:** « + Nouvelle commande » ([`NewOrderForm.tsx`](../../../app/atelier/(portal)/sales/_components/NewOrderForm.tsx), unsaved-changes guard) — kind first, works by number or title, the other party (Pem excluded) + its address (a single one is picked by itself), that kind's terms, notes → a **draft**. Server ([`orders-actions.ts`](../../../app/atelier/(portal)/sales/orders-actions.ts)): `createWorkOrder` (works in circulation for that kind, not already on an open order of the same family, address must be the party's), `advanceWorkOrder` (the order step is written first so the DB custody check sees it, then the works move with a history line; if they refuse, the order goes back), `cancelWorkOrder` (a signed sale's reserved works go back). Moves per step: sale signed → « Réservé », buyer stored; paid → owner = buyer, « Vendu » (+ commission and parent if the work was out on a deposit); delivered → custodian = buyer + its address, cooling-off starts; deposit / loan out → « Consigné » / « Prêt », custodian = the party; closed → works still with the party back to « Disponible » at Pem's, lines « rentrée »; gift deed signed → owner = recipient, « Gift », **price kept** (Q8 open); handed over → custodian = recipient. Step buttons + cancel in the order panel (confirm first).
   Tested live (dev server, 2026-11-17): created draft loan **P-2026-001** for #2399 with a borrower (address picked by itself) → listed and selected; cancelled → « Annulée », cancelled date stamped; #2399 untouched (« Disponible », Pem / Pem). **Steps that move works were not clicked**: they change real works' status, owner and history, which deleting the order would not undo — test them on a throwaway work or with Pem's say. `typecheck`, `lint` (no new warning), `i18n:check`, `atelier:chrome:check` pass. Phone: the form measures 375 px wide with no sideways scroll, but the browser pane's screenshot of the open dialog showed its right edge cut — check on a real phone. The cancelled mock P-2026-001 is still in the table (delete = own OK; it holds the first loan number).
   **Line test 2026-11-17 (Pem: « Throwaway test work »).** Not with real throwaway works: every work in a public status (2, 4, 6, 7, 8, 11) is flagged `is_public` by trigger and `/works` lists all of them live, so a test work would have shown on the public site. Instead the whole line ran in **one transaction rolled back at the end** (nothing kept — checked: no test works, live orders unchanged), with the writes in the same order as `advanceWorkOrder`. Results, all as designed:
   0. a work sent out with no order → refused `custody_order_required`;
   1. deposit **D-2026-001** signed → out (dates stamped); W1 « Consigné », owner Pem, holder the gallery, gallery address;
   2. sale **V-2026-001** of W1 by the gallery: signed (reserved) → paid → the deposit line became « sold » and the deposit **closed by itself** → delivered; W1 « Vendu », owner and holder = buyer;
   3. loan **P-2026-002** out (W2 « Prêt » at the borrower) → back: « Disponible », Pem, address set back to Pem's by the stage trigger; loan closed;
   4. gift **G-2026-001**: deed signed (owner = recipient) → handed over (holder = recipient);
   5. changing an order's kind → refused `work_order_kind_locked`.
   Not covered by it: the screen buttons themselves and the app's history lines (the transaction mirrors the order of writes, not the TypeScript). A full click-through needs a test work that is allowed to show on `/works` for a few minutes, or a hidden flag for test works — Pem's call.
   **Click-through 2026-11-17 (Pem: « Yes, a few minutes »).** Two test works **#-901, #-902** (negative numbers so the next real work keeps its number — `allocateOeuvreId` takes the highest + 1), created « En production » (not public), driven through the screen's own form and step buttons on the dev server, then **soft-deleted at once** (off `/works`; public for a few minutes only). Results:
   - #-901: deposit **D-2026-001** to Evans (40 %) draft → signed → out; sale **V-2026-001** to MCM (1 000 €) signed → paid → delivered. The deposit **closed by itself** (line « sold »); the sale got `parent_order_id` + **commission 400 €**; cooling-off started at delivery. End: « Vendu », owner and holder MCM.
   - #-902: loan **P-2026-002** to Evans out → back (line « rentrée », back « Disponible » at Pem's), then gift **G-2026-001** to MCM deed → handed over. End: « Don », owner and holder MCM.
   - Every step wrote a history line (« Consigné », location, « Réservé », « Vendu à MCM », « Prêt », « Retour atelier », « Don à MCM »). The work's address stayed empty because MCM has two addresses and « à préciser plus tard » was left — as designed (picked in the work card).
   Fixed after it: the « Réservé / Consigné / Prêt — … » lines named Pem instead of the buyer / gallery / borrower (now the other party — not re-clicked); a deposit / loan's steps read « Signé / Rentré » (were « Signée / Close »); the server now accepts any existing work number (it dropped negative test numbers). Checks pass again.
   **Test data purged 2026-11-17 (Pem: « Yes, delete them »):** the 5 test orders (D-2026-001, V-2026-001, P-2026-001, P-2026-002, G-2026-001, with their lines), works #-901 / #-902 and their 18 version snapshots, in one transaction. Checked: only the 7 reconstituted gift orders remain, no test work, version or graph node left, #2399 unchanged, highest work number still 2407 — the first real order of each kind will be `…-2026-001`. The `system_log` events of the test (order created / step) are kept as audit trail.
   **Slice 3 — papers, built 2026-11-17 (Pem: « next »), verified against live code 2026-11-17:** one generator for the four kinds, [`lib/orders/order-paper.ts`](../../../lib/orders/order-paper.ts) — header (title FR + EN, ref, date, page; « BROUILLON / DRAFT » on a draft), artist and other party with addresses, the works with picture (AVIF → PNG through sharp; the former deposit / gift papers could not show pictures), title, year, medium, size, and by kind price / agreed price / insurance value, the kind's terms, conditions, notes (« objet du prêt » for a loan), « Fait à Marseille, le … » and two signature lines. Loan wording is its own (comes back, not for sale, insured nail to nail, credit line, condition reports) — found issue 5 fixed for the new papers. **The wording is a plain draft for Pem to review (not legal advice).** Naming policy applied: R2 `commandes/<ventes|depots|prets|dons>/<REF>_<bon-de-commande|bordereau-depot|contrat-pret|acte-de-don>.pdf`, signed copy `…_signe[-n].<pdf|jpg|png|webp|heic>`; Vault folders `Commandes/Ventes · Dépôts · Prêts · Dons` (`lib/vault/folder-routing.ts`: `VAULT_ORDER_FOLDERS`, routing by key prefix; old `gifts/` slips route to `Commandes/Dons` — found issue 4). Server: `makeOrderPaper` (at creation, again at « signed » without the draft mark, and on « Faire / Refaire le papier »), `attachSignedCopy` (PDF or photo ≤ 4 MB, photos shrunk to 2400 px in the browser first). Panel: « Faire / Refaire le papier », « Ajouter la copie signée » (not on a draft).
   Checked: the four papers rendered locally with sample data and real pictures (no database or Vault write) and read page by page — layout fits on one page each; `typecheck`, `lint` (no new warning), `i18n:check`, `atelier:chrome:check` pass. **End to end 2026-11-17 (Pem: « Yes, test and delete »):** test work **#-903** (« En production », never public — a draft or signed loan moves nothing), loan **P-2026-001** to Evans made through the form → paper made at creation, filed `Commandes/Prêts` as « P-2026-001 · Contrat de prêt » (`commandes/prets/P-2026-001_contrat-pret.pdf`); « Marquer signé » → the same file and Vault row redone (no duplicate); downloaded from R2 and read: no « Brouillon », Pem's real address (Principal), Evans's address, the test note as « objet du prêt »; « Ajouter la copie signée » with a generated PNG through the real file input → `…_contrat-pret_signe.png`, row « … — copie signée », same folder. Not checked: « Ouvrir » itself (the page cannot fetch the signed link across origins; the files were read on R2 instead). **Cleanup:** both files copied to `recycle/2026-11-17/…` then deleted (ledger rows marked « recycled », like `r2SoftDelete`), the 2 Vault rows, the order and #-903 (+ versions) deleted; only the 7 reconstituted gift orders remain, no `commandes/` document left. Seen in passing: a loan saved without dates printed « du — au — ». **Pem 2026-11-17: « Yes, require them »** — a deposit or a loan now needs its out and back dates (form marks them `*`; `createWorkOrder` refuses `ord_err_dates` / `ord_err_dates_order` too). Checked in the browser: no dates → « Un dépôt ou un prêt a besoin de ses dates… »; back before out → « La date de retour vient avant la sortie. »; nothing created.
   Still open in this slice's area: payments (the « Encaisser » amount; Fiscal still reads the old `payments.order_id`), papers, Pipeline / Exhibitions / work card still use the old order paths.
   **Build step 2 — entry points moved, built 2026-11-17 (side session r7-step2, uncommitted for the lead to land), verified against live code 2026-11-17:**
   - **Work card « Don… »** ([`GiftTransferModal.tsx`](../../../components/atelier/work-drawer/GiftTransferModal.tsx)) opens the new-order form on Don only, with the work in it → a **draft** G-YYYY-NNN with its « Acte de don » (`createWorkOrder` + `makeOrderPaper`, Vault `Commandes/Dons`); then « Ouvrir la commande ». Nothing moves in the card any more: « Acte signé » / « Remise » are order steps. The old `markAsGift` (immediate « Gift », price set to 0, slip in `gifts/`) is no longer called; `app/atelier/works/gift-actions.ts` is left in place, unused (deleting it = own OK).
   - **New-order form** ([`NewOrderForm.tsx`](../../../app/atelier/(portal)/sales/_components/NewOrderForm.tsx)) can open prefilled (`initial`: kind, lock kind, works by number, party, terms, notes, Pipeline / exhibition link); « dirty » = changed from what it opened with. A sale now needs its final price (form + server `ord_err_price`).
   - **Orders screen links:** `/atelier/sales?order=<id>` selects an order (shows closed ones if it is closed); `/atelier/sales?new=<kind>&works=1,2&party=<id>&process=<id>&start=&end=&price=&commission=` opens the form filled in. The Atelier mobile bar « Vente » opens the form on Vente (was: the former Sales form). The former Sales panel (folded) no longer offers « + Nouvelle commande » (it made `sale_order` rows).
   - **Pipeline:** a new process of type « vente » / « consignment » with works and a contact makes a **draft order** linked by `work_order.process_id` (checks dates / price before the process is written) instead of `createSaleOrder` / `createConsignmentOrder`; the process drawer shows « Commandes liées » (→ the order) or « Créer la commande » (→ the form prefilled from the process). The « Bon commercial PDF » block (regenerate / download / close consignment) is gone — fixes found issue 1.
   - **Exhibitions « send works »** ([`exhibitions/actions.ts`](../../../app/atelier/(portal)/exhibitions/actions.ts) `sendWorksToExhibition`): a **draft** loan / consignment to the venue for the exhibition dates, linked to the exhibition; the screen then opens that order. Works move when it is signed and marked « Sortie » (was: moved at once). Exhibition without dates → « Un dépôt ou un prêt a besoin de ses dates ».
   - **Phone `/atelier/sale/new`** ([`actions.ts`](../../../app/atelier/sale/new/actions.ts) `completeMobileSale`): a sale order V-YYYY-NNN. Nothing paid → a draft (nothing moves). Money taken → signed + « Encaisser » (part → « Acompte », works reserved; all → « Soldée », buyer owner). End screen links to the order. Same form, same 375 px layout.
   - **« Encaisser »** (`recordOrderPayment`): on a signed / deposit sale, amount + method + date → one `payments` row with `work_order_id`; the step follows the money (part → « Acompte », total ≥ price → « Soldée »). The step is moved first (a refused move writes no payment). The order panel shows price, received, left to pay and the payments; the « Acompte reçu » / « Soldée » buttons are replaced by « Encaisser ».
   - **Revenus & dépenses** ([`lib/sales/income.ts`](../../../lib/sales/income.ts)): payments count on their day whatever order they belong to (already true); a sale order paid with no payment row counts its price on `paid_at` (same rule as the old completed `sale_order`). Work cost card (`fiscal/cost-actions.ts`) falls back to the work's paid sale order for its sale price.
   - **Menu:** sidebar group « Commercial » → **« Business »**, tab « Ventes » → **« Commandes »** (new keys `nav_group_business`, `nav_tab_orders`; tab id and route stay `sales`). The Hub launcher tile « Commercial » (opens Pipeline) is unchanged.
   - **Contact merge** also moves `work_order.party_id` (it was missing: merging a gift recipient would have failed on the order's foreign key).
   Checked: `typecheck`, `lint` (no new warning), `i18n:check` (0 blocking), `atelier:chrome:check` pass. Browser (dev server, live DB, **nothing saved**): 1280 px — sidebar « Business / Commandes »; `?new=consignment&works=2399&start=…&end=…` opens the form with #2399 and the dates, closes without the unsaved prompt and drops the query; `?order=<G-R-001>` selects it and shows closed orders; #2399's card « Don… » opens the form on Don only with #2399 and the intro line. 375 px — `/atelier/sale/new` no sideways scroll; `?order=` opens the order on the phone; `?new=sale&works=2399` prefilled, price marked required. **Not clicked (would write to real works / the live DB):** creating any order from these paths, « Encaisser », the phone « Créer et finaliser », Pipeline save, Exhibitions send. Typecheck covers their wiring; a click-through needs test works like #-901 (Pem's say).
   **Readers of the old tables left after step 2** (`rg "sale_order|consignment_order|BATCH_IDS|fromSaleOrder|fromConsignmentOrder"`), to clear before `work_order_drop_legacy.sql`:
   - `app/atelier/(portal)/sales/actions.ts` + `_components/Sales.tsx` — the former Sales panel (folded under Commandes: KPIs, revenue by year, pivot, old orders table, payments). Its figures still have to move to Revenus & dépenses (v2: « The revenue-by-year chart and the sales pivot move out of Orders »).
   - `app/atelier/(portal)/reports/_components/Reports.tsx` + `report-sources.ts` — report source « Ventes » reads `fetchOrders` (sale_order).
   - Cooling-off: `lib/sale-return-window.ts`, `lib/sale-return-window-cron.ts`, `app/api/cron/return-window`, `SaleReturnWindowBanner.tsx` / `drawer-open-actions.ts` (`getReturnWindowHintForOeuvre`) — still read `sale_order`; **a work_order sale's cooling-off (stamped `return_window_starts_at` at « Livrée ») has no banner or reminder yet.**
   - `app/atelier/consignments/actions.ts` — no caller left (Pipeline + Exhibitions moved); unused file (delete = own OK).
   - `app/atelier/works/gift-actions.ts` — no caller left; unused file (delete = own OK).
   - `lib/sales/income.ts`, `app/atelier/(portal)/fiscal/cost-actions.ts` — read `sale_order` beside `work_order` (0 rows; drop the old half with the table).
   - `app/atelier/(portal)/contacts/actions.ts` (merge list), `app/atelier/(portal)/logistics/actions.ts` (comment on `shipment.sale_order_id`), `components/public/EnquiryClient.tsx` (`/enquiry?sale_order_id=` writes `inquiry.sale_order_id`), `lib/sales/sales-client.ts` (typed helpers), `components/atelier/team-portal-types.ts` (comment), `lib/work-save-error.ts` (`sale_order_required` gate — a DB error name, keep while the DB raises it).
   - Scripts: `scripts/seed-mock-sale-order.mjs`, `scripts/archive-export.mjs`, `scripts/storage-ledger-backfill.mjs`.
   Needs Pem: (1) GO for a click-through of these paths on test works (create / encaisser / cancel, then purge — own OK each); (2) delete the two unused action files; (3) the phone rule « nothing paid → draft, money taken → signed » (the old phone flow reserved the works at once even unpaid) — Q7 « how papers are sent » still open; (4) the open points stay open: gift price (Q8; gift orders keep the price), « Confié » fifth kind, lawyer / accountant read of the paper wording.
3. **Papers:** four generators with the naming policy and Vault folders; loan paper rewritten; upload of the signed copy.
4. **Entry points:** work card « + order » and stage pills → order; Pipeline / Exhibitions link to an order instead of making one; drawer stage change → draft order in Pem's feed (with R1 step 6).
5. **Phone** (after the « how papers are sent » answer).
6. **Old gifts:** 7 reconstituted orders (6 without paper + #287 with its slip) — data change, own OK.
7. **Test with mock orders** (one per kind, the whole line), then delete them (own OK).

## The problem, in Pem's words

- « This needs to be rationalized » (2026-11-15). A work leaving Pem's hands makes a paper, and each kind of leaving makes it somewhere else: a sale in « Ventes », a consignment or a loan in **Pipeline**, a gift in the **work card**.
- « Consignment is not a sale » — so the tab called « Ventes / Sales » cannot be the home of a deposit or a loan.

## What the screen is for (inputs → outputs)

**One place where every work that leaves Pem's hands is decided, and where its papers live.**

- **Inputs:** the decision to let one or more works go (sell, deposit, lend, give) · the other party (buyer, gallery, borrower, recipient) and the address the works go to · the terms (price, discount, commission, dates, insurance value) · what happens afterwards (payments, signature, delivery / hand-over, return).
- **Outputs:** the **paper** (bon de commande, bordereau de dépôt, bordereau de prêt, acte de don) and later the **signed copy** · the work's stage, owner and custodian moving at the right moment ([custody model](../../WORK_CUSTODY_MODEL.md): ownership on cleared payment or signed deed, custody on delivery / hand-over) · a line in the work's history · money in for Fiscal (`payments`) · provenance that stays readable without the app (aim 3, transmission).

It is a record tool, not a sales machine: [STRATEGY](../../STRATEGY.md) says commercial tools hold almost no data and get effort only when a real case comes. **Measured today: there has never been a real case** (below). So the design aims to be small, clear and ready for the first one — not to add layers.

## Measured (live DB, read-only, 2026-11-17)

| What | Count |
|---|---|
| `sale_order` rows | **0** |
| `consignment_order` rows (deposit + loan) | **0** |
| `payments` rows | 0 |
| `shipment` rows | 0 (and no screen creates one) |
| Works in « Vendu » (6), « Réservé » (4), « Consigné » (7), « Prêt » (8) | 0 · 0 · 0 · 0 |
| Works in « Gift » (11) | **7** — `is_gift` true on 6 of them (#2339 is « Gift » with `is_gift` false) |
| Gift slips in the Vault (`gifts/…`) | **1** (#287, the only gift made through the gift dialog; its document has no folder) |
| The other 6 gifts | no slip, no recipient stored as buyer, set by hand before the dialog existed |
| Pipeline processes of type « consignment » or « vente » | 0 (Pipeline has 6 processes, none commercial) |
| Order papers in the Vault (`orders/`, `consignments/`, `loans/`) | 0 |

The TODO's « 0 sale orders, 0 consignment / loan orders, 6 gifts » holds, with one nuance: **7** works are in « Gift », 6 flagged `is_gift`, and only **1** has a paper. None of the order paths has ever been used for real.

## Today's map — where each paper is made and stored

_Verified against live code 2026-11-17_ (worktree HEAD `4db1bb8`, which is on `origin/main`).

| Kind | Where you start it | Server action | Paper (R2 bucket `vault`) | Vault document row | Moves the works |
|---|---|---|---|---|---|
| **Sale** | ① Ventes tab « Nouvelle commande » (`sales/_components/Sales.tsx` `OrderFormModal`) · ② phone `/atelier/sale/new` (Hub « Vente » verb, also on `/hub/today`; `completeMobileSale` = create + payment + status in one go) · ③ Pipeline new process of type « vente » (`PipelineProcessModal.tsx:271`) | `createSaleOrder` (`app/atelier/(portal)/sales/actions.ts:218`), PDF by `buildOrderPdf` | `orders/ORDER_<ref>.pdf`, regenerated after each payment / status change | « Commercial Bond <ref> », kind `facture`, folder **Invoices** | At creation → « Réservé », buyer stored. « Soldée » → owner = buyer, « Vendu » (or « Gift » if `is_gift`). « Livré » → custodian = buyer. |
| **Deposit** (consignment) | ③ Pipeline new process of type « consignment » (`PipelineProcessModal.tsx:257`) · ④ Exhibitions « send works » (`ExhibitionDetail.tsx`) with kind consignment (`exhibitions/actions.ts:360` `sendWorksToExhibition`) | `createConsignmentOrder` (`app/atelier/consignments/actions.ts:86`) | `consignments/BORDEREAU_<ref>.pdf` | « Bordereau de Dépôt <ref> », kind `contrat`, folder **Consignment** | At creation, no draft: « Consigné », custodian = gallery, owner stays Pem. Close (« returned ») → back to « Disponible » at Pem. |
| **Loan** | ④ Exhibitions « send works » with kind loan — **only there**: Pipeline never sends `kind`, so a Pipeline « consignment » is always a deposit | same `createConsignmentOrder`, `kind = 'loan'` | `loans/BORDEREAU_PRET_<ref>.pdf` | « Bordereau de Prêt <ref> », kind `contrat`, folder **Consignment** | « Prêt », custodian = borrower. Close → back to Pem. |
| **Gift** | ⑤ work card, « Don… » chip on the ownership row (`WorkDrawerPipelineSection.tsx` → `GiftTransferModal.tsx`) — one work at a time | `markAsGift` (`app/atelier/works/gift-actions.ts:62`), PDF by `buildGiftPdf` | `gifts/BORDEREAU_DON_<id>_<date>.pdf` | « Bordereau de Don <id> », kind `contrat`, **no folder** (the Vault routing does not know `gifts/`) | At once: « Gift », owner = recipient, price set to 0; custodian = recipient only if « remis » is ticked. **No order row.** |

Where you look at them afterwards:
- **Ventes tab** (`/atelier/sales`, Commercial group): sale KPIs, revenue by year, a pivot, and the **sale orders** table + detail panel (payments, status steps, delivery, cooling-off window, regenerate / download PDF). No deposits, loans or gifts.
- **Pipeline** (Studio group): a deposit or sale process shows « Bon commercial PDF » (regenerate, download, and « close the consignment » for a deposit) — the process only keeps a copy of the order's `pdf_path`; it is linked to the order **by that file path**.
- **Vault**: every paper, in three different folders (Invoices, Consignment, none).
- **Work card**: the stage pills « Consigné / Prêt / Vendu » are locked « by order » but **link to nothing** — you cannot get from a work to its order.
- Related papers made elsewhere: the **certificate of authenticity** (`generateCOA`, Vault and `/atelier/documents`) — 48 COA files in the Vault folder « COA »; condition reports (constat). Not orders, but a buyer usually gets a COA with the sale.

### Things found while reading (not fixed — each needs a GO, `CLAUDE.md`)

Read in the code, never clicked (there is no order to click on):

1. **Pipeline « Regénérer le PDF » cannot work.** `PipelineProcessDrawer.tsx:156` passes the **Pipeline process id** to `regenerateConsignmentPdf`, which looks for a `consignment_order` with that id → « Order not found ». For a sale process it calls the deposit regenerator on a sale paper.
2. **The list of works on an order is hidden in the notes text** (`notes = "BATCH_IDS: [12,34]\n…"`), parsed back with a regex in three files (`sales/actions.ts`, `consignments/actions.ts`, `lib/sale-return-window.ts`). `oeuvre_id` keeps only the first work. Fragile, and invisible to a query.
3. **A gift erases the work's price** (`gift-actions.ts:112–113`, `Prix = 0`, `PrixFinal = 0`). Nothing was lost so far — none of the 7 gift works ever had a price in any `oeuvre_versions` snapshot — but a priced work given tomorrow would lose its value for insurance, estate or a later appraisal.
4. **The gift slip lands unfiled** in the Vault (no folder; routing in `lib/vault/folder-routing.ts` covers `orders/`, `consignments/`, `loans/` only).
5. **The loan slip says « deposit »** in two places: heading « ŒUVRES EN DÉPÔT » and signature « POUR LE DÉPOSITAIRE » are printed for a loan too (`consignments/actions.ts:389`, `:458`).
6. **Gifting a deposited or lent work** (allowed from « Consigné » / « Prêt ») does not close its deposit / loan order.
7. **Three ways into a sale** (Ventes modal, phone `/atelier/sale/new`, Pipeline « vente ») with different fields: Pipeline asks no payment terms, the phone asks no delivery.
8. Known since 2026-11-03 (custody follow-ups): orders don't store the **custodian's address**; a cancelled sale of a deposited work returns it to Pem, not to the gallery; `insurance_value` and `catalog_price` on a deposit are never filled by any screen.

## The proposal

### One screen: « Contrats » (working name — see question 1)

Replaces **Ventes** at the top of the Commercial group (`sales` tab id and `/atelier/sales` route can stay, or redirect). It lists **every agreement that lets a work leave Pem's hands**, four kinds, one look:

| Kind | Chip | Steps (one button = the next step) | Owner moves | Custodian moves | Paper |
|---|---|---|---|---|---|
| **Vente** | `V` | Brouillon → Signée → Acompte → Soldée → Livrée (→ délai de rétractation) | at Soldée (payment cleared) | at Livrée | Bon de commande (+ COA offered at Soldée) |
| **Dépôt** | `D` | Brouillon → Signé → Sorti (chez la galerie) → Rentré, or → « vendu par la galerie » (opens a Vente linked to it, commission computed) | never (Pem) | at Sorti / Rentré | Bordereau de dépôt |
| **Prêt** | `P` | Brouillon → Signé → Sorti → Rentré | never (Pem) | at Sorti / Rentré | Bordereau de prêt (with insurance value) |
| **Don** | `G` | Brouillon → Acte signé → Remis | at Acte signé | at Remis | Acte / bordereau de don |

The same rules as the custody table, written once, read the same way for all four. Every step leaves a dated line on the order and on each work's history.

**Desktop layout** (mockup, left):
- **Top strip, one line** (dense, like the Overview signals): open by kind (V 0 · D 0 · P 0 · G 0) · to cash · works out with a return date · papers awaiting a signed copy.
- **Left: the list.** Filter chips Toutes · Vente · Dépôt · Prêt · Don and Ouverts / Clos. One row per agreement: kind chip, ref, work thumbnails (`#1234` + title on hover), other party, dates, the step as a short dot line, paper icons (generated ✓, signed ✓). Sticky header, division lines.
- **Right: the agreement** (opens on click; sections collapsed except the first two):
  1. **Header** — kind, ref, other party + the address the works go to, the works (thumbnails, each opens the work card).
  2. **Next step** — one primary button (« Marquer signé », « Encaisser », « Marquer livré », « Rentré »…) and the step line with dates.
  3. **Papers** — the generated paper (view, regenerate, share), **the signed copy** (upload a scan / photo; on the phone through the existing doc scan), other papers attached to it (COA, invoice, condition report, transport). All of an agreement's papers in one Vault folder (question 6).
  4. **Money** (Vente, Dépôt) — price, discount, commission, net to Pem, payments, what is left.
  5. **Links** — the Pipeline process or the exhibition it came from, a shipment.
- **« + Nouveau »** opens one form: **kind first** (four big buttons), then works (search, a working group, or the current inventory selection), the other party + address, then only the terms of that kind. It creates a **draft** with its paper; works don't move until the « signed » / « sorti » step (question 4).
- Revenue by year and the sale pivot leave this screen (Fiscal « Par année » already shows income per year; the pivot can go to Reports) — question 5.

**Phone (375 px)** (mockup, right): it is a field tool, so only what is done standing up:
- The list of **open** agreements as cards (kind chip, works, other party, next step).
- The agreement: next-step button (sticky, safe-area padding), papers (open / share the PDF, **photograph the signed copy**), money in one line.
- « + Nouveau » keeps the phone sale flow of `/atelier/sale/new` (sale at an open studio, paid on the spot) and adds Don; Dépôt and Prêt are made on the desktop (question 7).
- The phone input bar (R2) is unchanged; the Hub « Vente » verb opens the new form on Vente.

### What happens to today's entry points

| Today | Proposal |
|---|---|
| Ventes tab | becomes « Contrats » (all four kinds) |
| Pipeline process « vente » / « consignment » creates an order | Pipeline stays the **conversation** (negotiation, steps, reminders); it **links** to an agreement instead of making one (« Créer le contrat » opens the form prefilled, the link is kept). Fixes found issue 1. |
| Exhibitions « send works » (loan / deposit) | unchanged in function: it still creates a Prêt / Dépôt; the agreement shows « from exhibition X » and the exhibition shows its agreement |
| Work card « Don… » dialog | the chip opens the Don form prefilled with this work (or the dialog stays and writes a Don agreement — question 3) |
| Work card stage pills « Consigné / Prêt / Vendu / Don » | become a link « voir le contrat » (and « créer un contrat » when the work is in Pem's hands) |
| Phone `/atelier/sale/new` | stays as the phone form of a Vente |
| Vault folders Invoices / Consignment / (none) | one folder per agreement or per kind — question 6 |

### Field map — today → new place

| Today (table · field, or form) | New place in the agreement |
|---|---|
| `sale_order.order_ref` · `consignment_order.order_ref` (`CNSG-` / `LOAN-` + 4 random digits) · gift `DON-<id>-<date>` (only on the PDF) | **Ref**, one series per kind (question 2) |
| `sale_order.buyer_id` · `consignment_order.partner_id` · gift `recipient_id` (written to `Oeuvres.ContactID` + `AcheteurID`) | **Other party** |
| — (picked in the work card when the custodian has several addresses) | **Address the works go to** (new) |
| `BATCH_IDS` in `notes` + `oeuvre_id` (first work) | **Works** (a real list, one row per work) |
| `sale_order.notes` · `consignment_order.notes` · gift notes (only on the PDF + Vault doc) | **Notes** |
| `sale_order.statut` (draft · confirmed · deposit_paid · completed · cancelled) · `consignment_order.status` (active · returned · cancelled) · gift: none | **Steps** with dates (table above) |
| `prix_catalogue`, `discount_pct`, `prix_final`, `currency` | Money (Vente) |
| `deposit_pct`, `deposit_due`, `balance_due`, `payment_method`, `deposit_paid`, `balance_paid`, `payments.*` | Money → payments (Vente) |
| `commission_pct` (deposit) · `consignment_order_id`, `commission_amount` (sale) | Money (Dépôt; the Vente sold through it shows its commission) |
| `insurance_value`, `catalog_price` (deposit / loan — never filled today) | Money → insurance value (Dépôt, Prêt) |
| `start_date`, `end_date` (deposit / loan) · `Oeuvres.ReturnDate` | Dates → out / back by |
| `delivery_address`, `shipping_method`, `delivery_date`, `delivered` · gift `delivery_date`, « remis » box | Delivery / hand-over step |
| `return_window_days`, `return_window_starts_at`, `return_window_skipped`, `completed_at` | Vente → after « Livrée » (cooling-off) |
| `sale_order.pdf_path` · `consignment_order.pdf_path` · `suivi_process.pdf_path` (copy) · `gifts/…` key | **Papers → generated** (one place; Pipeline keeps a link, not a copy of the path) |
| — | **Papers → signed copy** (new) |
| Vault `document` rows « Commercial Bond … », « Bordereau de Dépôt / Prêt … », « Bordereau de Don … » | **Papers** list (same files, attached to the agreement) |
| `generateCOA` (Vault, `/atelier/documents`) | Papers → « Certificat » offered at Vente « Soldée » |
| `shipment.sale_order_id` / `order_id` | Links → shipment |
| `suivi_process` (Pipeline) of type vente / consignment · exhibition process | Links → Pipeline / exhibition |

## Open questions (for Pem)

_v1 list, kept as asked. Answered 2026-11-17 (see « v2 » at the top): 1 (Orders), 2 (yes), 3 (full order; old gifts get one), 4 (yes), 5 (to Revenue & expenses, group renamed Business), 6 (one folder per kind), 9 (build, test with mock orders). Still open: 7 (how papers are sent → what the phone does) and 8 (gift price)._

1. **The name.** « Commandes / Orders » as you suggested? In French « une commande » is also a *commissioned work* — a painter's word. Alternatives: **« Contrats / Agreements »** (all four are agreements: bon de commande, bordereau de dépôt, de prêt, acte de don — the Vault already files deposits and gifts as `contrat`), or « Sorties » (works leaving the studio). My pick: **Contrats**.
2. **Refs.** One series per kind (V-2026-001, D-…, P-…, G-…), counted in order instead of the random 4 digits today? Paper titles stay in French with an English line, as now?
3. **Gifts become agreements** like the other three (a draft, an « acte signé » step, a « remis » step, the paper attached)? Or does a gift stay a one-tap action in the work card that only *shows* in the list? (Custody model today: « gifts: the owner decides, no order needed ».) And the 6 old gifts without a paper — leave them, or make a « record only » agreement for each so the provenance is complete?
4. **Draft first, works move at signature?** Today a deposit / loan moves the works the moment it is created, a sale reserves them at once, a gift transfers at once. Proposal: everything starts as a draft with its paper (to send or print), and the works move only at « signé / sorti / soldée / acte signé ». OK?
5. **Revenue by year and the pivot** (today on Ventes): move to Fiscal « Par année » and Reports, so this screen is only the agreements? Or keep a one-line money strip here?
6. **Vault filing.** One Vault folder per agreement (« Contrats / V-2026-001 / … » with the generated paper, the signed copy, the COA), or one folder per kind (« Ventes », « Dépôts & prêts », « Dons »)?
7. **Phone.** Vente and Don can be made on the phone (studio sale, a gift handed over on the spot); Dépôt and Prêt only on the desktop — right? Is photographing the signed copy on the phone the way you'd sign (paper signed by hand, photo kept)?
8. **The gift price.** A gift should **keep** the work's price as its value (insurance, estate, appraisal) and record « gift » separately, instead of setting the price to 0 (found issue 3)? (Nothing to restore: the 7 gifts never had a price.)
9. **When.** There has never been a real sale, deposit or loan in the app. Build R7 now, or design it now and build when the first real case comes (STRATEGY: « nothing is spent there until a real case needs it »)? The small fixes (found issues 1, 3, 4, 5) could go in a bug batch either way.

## Needs a GO before building

- Pem's GO on this design and the answers above.
- **SQL (own OK, RLS + explicit `GRANT`, then `npm run gen:types`).** With 0 rows in both order tables this is the cheapest moment it will ever be. Proposal, to confirm: one table for the four kinds (e.g. `work_agreement`: kind, ref, other party, address, steps + dates, money, notes) + one row per work (`work_agreement_work`), replacing `sale_order` + `consignment_order` and the `BATCH_IDS` text; `payments.order_id` and `shipment` re-pointed; `document` gains a link to its agreement (for « signed copy » and the per-agreement folder). Smaller alternative: keep the two tables, add a works junction, an address column and a `gift` kind.
- Pipeline change (link instead of create), work-card pills → link, Vault routing for gifts, i18n rename (FR + EN), What's new item.
- Each « found issue » fix is its own GO (bug batch).

## Not in this brief

- Supplier orders (TODO 11, `11d`) — they are purchases, not works leaving; they stay with Supplies.
- Invoicing rules for tax (gross vs net on a deposit sale, TODO_NOTES#money (c)) — a Fiscal question; the agreement only stores the numbers.
- Editions (prints issued from a series) — R6 « Exhibitions / events ».
