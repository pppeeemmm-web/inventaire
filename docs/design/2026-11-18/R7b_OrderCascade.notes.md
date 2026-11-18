# R7b — the order drives the whole chain (design brief, 2026-11-18)

Design only. No code, no SQL applied. Pem's replies of 2026-11-18 on the order review: preparation (mounting, framing) « could [be in the order] if the order stipulates such demands … and be part of the chain »; shipping « should be connected and be part of the chain »; picking / packing / label / tracking « should come in now »; COA issued automatically with the transaction when authenticity is guaranteed; the invoice « to be developed now »; several orders in one shipment or on one invoice « we need to cater for that »; the cascade sketch: « excellent ».

Builds on [`R7_Orders.notes.md`](../2026-11-17/R7_Orders.notes.md) (orders, refs, papers), [`R6_Events.notes.md`](../2026-11-17/R6_Events.notes.md) (editions, Confié), [`LEGAL_POLICY.md`](../../LEGAL_POLICY.md) §4 (invoice = the accountant's call), [`POLICY_NOTES.md`](../../POLICY_NOTES.md) (the policy points this raises).

## What is true today (read in code and live DB, 2026-11-18)

- An order (`work_order`) moves ownership, custody and money: each step stamps a date and moves the works (`advanceWorkOrder`, `app/atelier/(portal)/sales/orders-actions.ts`).
- **Not tied to the order:** Production stages (mounting / framing are stages of a work, `lib/data.ts` `StageKey`); `shipment` + `shipment_work` exist and Logistics lists them, but **no code path creates a shipment** (the app only lists them and marks one delivered); `work_order.shipping_method` is free text; the COA is made per work from the Vault (`generateCOA`, cert id `PEM-<id>-<8>` + hash, public check in `lib/coa-verify.ts`); **no invoice** (the sale paper is the bon de commande).
- Live data: 7 reconstituted gifts + 2 cancelled test orders (G-2026-001, V-2026-001). The next real sale will be **V-2026-002** (cancelled refs are kept).

## The chain, per sale

```
Order signed ─┬─► Prep (only if the order asks)        production task on the work, or a « Confié » order to the framer
              │                                         blocks « Packed » until done
              ├─► COA (auto, Pem's own works)          made at « Paid », filed in COA + listed on the order
              └─► Shipment opened (or Pick-up)          one per destination, can carry several orders
                     1 Condition photos   (constat « examination », photos before packing — the 48 h rule needs them)
                     2 Picked             (works taken off the wall / rack; location = « packing »)
                     3 Packed             (crate / box, dimensions + weight → the carrier quote)
                     4 Insured            (value, insurer or carrier cover, certificate / policy no.)
                     5 Label + tracking   (carrier, tracking no., link)
                     6 Shipped            (date)
                     7 Delivered          (date) ─► order « Delivered » ─► 14-day window starts
              Invoice ◄─ at the step the accountant names (payment / handover / end of the 14 days)
```

Deposit, loan, Confié: the same shipment, both ways (out at « out », back at « closed »), with the condition report out and back; insurance on the other party (nail to nail). Gift: shipment or hand-over.

**Pick-up** (Pem: « to be offered »): the buyer chooses « collect at the studio » instead of a shipment. The shipment record stays (kind `pickup`): steps 1, 2, 3 (light wrap), then « Handed over » with the date and who collected. No label, no carrier insurance. The 14 days start at hand-over, as today.

## What « the order stipulates » means

A sale line can carry **demands**: framing (moulding, glass), mounting, varnish, a dedication, a certificate in another language, gift wrap. Each demand becomes:
- a **production task** on the work (done in the studio), or
- a **Confié order** to the framer / mounter (the work leaves and comes back — custody is tracked, R6 decision).
The shipment cannot pass « Packed » while a demand is open. The cost of a demand can be a line on the order (« Encadrement — 180 € ») and on the invoice.

## Several orders together

- **One shipment, several orders:** the shipment holds works (`shipment_work`, exists); each work points to its order line. A shipment accepts works from any open order whose address is the same. A sale + a loan to the same museum can travel together; each order still closes on its own.
- **One invoice, several orders:** an invoice holds one or more **sale** orders of the **same buyer**, never across buyers. Each order is on one invoice at most (a credit note cancels it).
- **One order, several shipments:** allowed (a large order sent in two crates); the order is « Delivered » when its last work is delivered.

## COA with the transaction

- **When:** automatically at « Paid » (ownership passes), for works by Pem only (authenticity guaranteed). Editions: one COA per copy, with the copy number (« 3/30 »).
- **Where:** filed in `COA` (as today) and linked to the order line; printed and put in the crate at « Packed » (checklist tick).
- **Re-issue:** a new COA on the same work (resale, lost certificate) gets a new cert id; the old one is marked replaced, never deleted (the public check says « replaced on … »).
- Off: a work not by Pem (secondary market, « Dépôt reçu », parked) never gets an automatic COA.

## Invoice (« Facture »)

To build now, with the accountant's answers (LEGAL_POLICY §4, questions 1–3, 13) filled in as settings, not code:
- **Number series** with no gap: `F-2026-0001`, counted per year, given at issue, never re-used; a cancellation is a **credit note** (`AV-2026-0001`) pointing to it.
- **Content:** studio identity (name, SIRET, address), buyer, date, lines (works with title / year / technique / size, demands, shipping + insurance if charged), totals, the **VAT mention** chosen by the accountant (e.g. « TVA non applicable, art. 293 B du CGI » under the franchise — to confirm), payment received (from `payments`), order refs.
- **Issued at** the step the accountant names; until the answer, « at payment » with a setting to change.
- Filed in `Commandes/Factures`, `<F-ref>_facture.pdf`; payments and the 14-day hold keep working as today.

## Digital files and NFT (Pem: « what about them now? Check also numeric files for sale »)

- **Digital files for sale** (a high-resolution image of a painting, a print file): this is the sale of a **licence** (right of reproduction for a stated use), not of the work. It needs its own product (file, licence text, use, term, territory, price) and its own paper (licence contract — LEGAL_POLICY §6, template to write). VAT on digital services to EU consumers is a separate regime (accountant question 5 / 9). Fits the « products » engine (editions, books, files), not the unique-work order.
- **NFT:** not proposed now. What collectors use an NFT for — a verifiable record of authenticity and provenance — the app already gives through the COA's public check (`lib/coa-verify.ts`). If a buyer asks for one: a token pointing to the COA id, made by hand, recorded in the order notes. Revisit if a real request comes ≥ 2× (house rule).

## Insurance and claims (Pem's « ? »)

- A **claim** is the file opened with the insurer or the carrier when a work is damaged, lost or stolen in transit or in someone's custody: who (insurer / carrier), claim number, date filed, amount claimed, amount paid, outcome, linked to the constat (photos) and to the shipment or order. Today nothing records it.
- Proposal: a small `insurance_claim` table hanging off the constat (`condition_report`) and optionally a shipment / order. Built with the shipment, own SQL OK.
- Who pays the transit insurance: see [`POLICY_NOTES.md`](../../POLICY_NOTES.md) — on a sale it can be a line paid by the buyer (« Expédition et assurance »), shown before the order is signed.

## Data (sketch — superseded by the applied SQL, see « Built » below)

- `shipment`: add `kind` values `ship` / `pickup` / `return`, `address_id`, `carrier`, `tracking_no`, `tracking_url`, `packed_dims`, `packed_weight_kg`, `insured_value`, `insurer`, `policy_ref`, `cost`, `charged_to` (`buyer` / `studio` / `other_party`), one dated column per step (`photos_at`, `picked_at`, `packed_at`, `insured_at`, `labelled_at`, `shipped_at`, `delivered_at`).
- `shipment_work`: add `order_line_id` (→ `work_order_work`).
- `work_order_work`: add `demands jsonb` (or a `work_order_demand` table if demands need their own steps) and `coa_document_id`.
- `invoice` (+ `invoice_order`, `invoice_line`): number series by trigger (gap-free), `kind` invoice / credit note, `paper_path`, `issued_at`, `vat_mention`.
- `insurance_claim`: `condition_report_id`, `shipment_id`, `order_id`, insurer, ref, dates, amounts, status.
- RLS team, explicit GRANT, anon none — as every R7 table.

## Questions for Pem

1. Prep demands: which ones do you actually offer on a sale (framing, mounting, varnish, dedication)? Priced as lines?
2. Shipping cost and insurance on a sale: charged to the buyer as a line, included in the price, or decided per sale?
3. COA at « Paid » or at « Delivered »? (Proposal: Paid, put in the crate.)
4. Pick-up: only at the Marseille studio, or other places (an exhibition)?
5. Carriers you use or want to use (art shipper, parcel carrier) — for the quote step later (« keep it mindful »).
6. Build order: (a) shipment chain + pick-up, (b) COA auto, (c) invoice once the accountant answers the VAT mention — or all three in one batch with the invoice mention left as a setting?

## Pem's answers (2026-11-18)

1. Prep a sale can ask for: **framing, mounting, dedication / signature** (not varnish).
2. Shipping and transit insurance: **paid by the buyer, as a line** on the order and the invoice.
3. COA: **at « Paid »**, put in the crate.
4. Pick-up: **at the studio or at an event**.
5. Carriers: later (« keep it mindful »).
6. Build: « ok » — SQL applied, screens built.

## Built 2026-11-18 (worktree `pem-next-1118`, not landed yet)

- **SQL** `supabase/sql/r7b_order_cascade.sql` **applied live** (Pem « ok »), migration `r7b_order_cascade`: shipment reshaped (0 rows before), step dates stamped by the DB, `shipment_work.order_line_id`, `work_order_demand`, `work_order.shipping_charge` / `delivery_mode`, `work_order_work.coa_document_id`, `invoice` + `invoice_order` (gap-free F- / AV- numbers, frozen once issued, one live invoice per order, same buyer only), `insurance_claim`; RLS + grants checked, security advisor: nothing new. The old shipment → order trigger is gone: it set a sale « delivered » without moving the works. Types regenerated.
- **Code**: `lib/orders/cascade.ts` (steps, demand kinds, invoice settings: VAT mention and SIRET **null until the accountant / Pem give them** — the PDF says « à compléter »), `app/atelier/(portal)/sales/cascade-actions.ts`, `lib/orders/invoice-paper.ts`, `components/atelier/orders/OrderCascadePanel.tsx` (in the order view: delivery choice + shipping line, prep per work, shipment cards, COA, invoice), `components/atelier/orders/ShipmentCard.tsx` (checklist, fields per step, works + their orders, claims), Logistics tab = shipment cards. Hooks in `advanceWorkOrder`: a signed sale / deposit / loan opens its shipment (joins one being prepared for the same party + address + kind — that is how orders travel together); a paid sale makes one COA per work. « Delivered » on a shipment moves each order whose works have all arrived (sale paid → delivered and the 14 days start; deposit / loan → out; gift → handed over; Confié → out; a return → closed); otherwise the order is listed as « to do by hand ».
- **Not tested on data**: a test invoice would burn F-2026-0001 for good and test orders burn order numbers (same database as production). Typecheck, lint (no new warnings), i18n:check pass.
- **Known gaps**: a sale switched to « taken away » at payment after its shipment was opened at signature leaves that shipment open (cancel it by hand); `logistics/actions.ts` (`markShipmentDelivered`, unused) deleted 2026-11-18 on Pem's request, and the Logistics tab's `atelier-logistics-root` test id restored (the R7b rewrite had dropped it; `tests/atelier-logistics-tab.spec.ts` updated to the new intro line); edition copy numbers on COAs wait for the products engine ([Products_Engine.notes.md](./Products_Engine.notes.md)); claims are on shipments only (not yet on a constat outside a shipment).
- **Calendar (2026-11-18, Pem « Apply both »):** `supabase/sql/calendar_order_dates.sql` applied (migration `calendar_order_dates`). `lib/calendar/sync-order.ts`: deposit / loan / Confié « out » + « back by », a sale's or gift's planned delivery (`start_date`), the last day of a sale's 14-day return. Synced after an order is created, at each step and when cancelled (nothing happens without a connected calendar; a failure is logged), and by a button in the order. No calendar is connected yet: connect one in Business → Événements → an event → Calendrier. Not tried against a real Google / Microsoft account.
- **Overview « Système »:** `supabase/sql/work_rule_runs.sql` applied (migration `work_rule_runs`); Audit → Règles and the nightly job each write one summary row; the Overview shows the last one.
