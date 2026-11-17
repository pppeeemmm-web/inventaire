# Orders and their papers in one place (R7): design brief, 2026-11-17 (v1)

Design only, nothing built, no SQL run (reads only). Inputs: TODO R7, [TODO_NOTES#custody](../../TODO_NOTES.md#custody), [TODO_NOTES#money](../../TODO_NOTES.md#money), [WORK_CUSTODY_MODEL](../../WORK_CUSTODY_MODEL.md), [RETHINK](../../RETHINK_2026-11-14.md) (« Orders and their papers »), [STRATEGY](../../STRATEGY.md) aim 4 (Value: provenance, certificates). Mockup next to this file: [R7_Orders.mockup.html](./R7_Orders.mockup.html) (desktop + two 375 px phones).

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
