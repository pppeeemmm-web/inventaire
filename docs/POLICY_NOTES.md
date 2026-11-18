# Policy notes — the small points to settle (running list)

Pem 2026-11-18: « keep track of all the tid bits for policies ». One line per point, added as they come up; each one says what is proposed, where it would be written, and who confirms. When a point is decided it moves into its policy ([`LEGAL_POLICY.md`](./LEGAL_POLICY.md), [`COMMERCIAL_GUIDELINES.md`](./COMMERCIAL_GUIDELINES.md), [`ENVIRONMENTAL_POLICY.md`](./ENVIRONMENTAL_POLICY.md)) and its line here is struck through with the date.

**Not legal, tax or insurance advice** — proposals to brief the lawyer, the accountant and an insurance broker.

## Delivery and pick-up

| # | Point | Proposal | Written in | Confirm |
|---|---|---|---|---|
| D1 | Delivery damage | Condition photos before packing; buyer checks on delivery, notes any damage on the carrier's slip, tells Pem in writing with photos within **48 h**. | Sale paper conditions (**drafted 2026-11-18**, `lib/orders/order-paper.ts`) | lawyer |
| D2 | Pick-up at the studio | Offered on every sale as an alternative to shipping; hand-over dated, the 14 days start then. | Delivery policy (to draft) + order form | Pem |
| D3 | Risk in transit | For a consumer, the risk stays with Pem until the buyer has the work (R7 wording) → Pem insures every outgoing sale shipment. | Delivery policy | lawyer |
| D4 | Delivery times | State an estimate per destination on the order; a late delivery lets a consumer cancel (to confirm). | Delivery policy | lawyer |
| D5 | Shipping cost | A line « Expédition et assurance » on the sale, shown before signature; or included in the price — Pem decides (R7b Q2). | Commercial guidelines | Pem |

## Returns (14-day house rule)

| # | Point | Proposal | Written in | Confirm |
|---|---|---|---|---|
| R1 | Who pays the return | Today's draft: the buyer, « sauf accord contraire ». EU distance-selling rule: the buyer pays only if told before the sale — the sale paper does it. | Sale paper (exists) | lawyer |
| R2 | How a work comes back | Pem organises the return with his own insured shipper (cost charged to the buyer or not, per R1); the buyer does not pack it alone. | Delivery policy | Pem |
| R3 | Damage on the way back | Condition report on arrival; if damaged in the buyer's packing, the refund may be reduced by the loss of value (to confirm for consumers). | Sale paper | lawyer |
| R4 | Refund timing | Within 14 days of the work's return, same payment means (draft exists). | Sale paper (exists) | lawyer |

## Insurance

| # | Point | Proposal | Written in | Confirm |
|---|---|---|---|---|
| I1 | Before a yearly policy | Check what the studio's current insurance covers for finished works on the premises; buy **declared-value cover per shipment** (carrier's « ad valorem » or the art shipper's); never send uninsured above a carrier's fixed limit. | Insurance note | broker |
| I2 | Yearly policy | An « all-risks » fine-art policy (studio + transit + exhibitions) once sales / loans are regular — quotes from a broker. | Insurance note | broker |
| I3 | Who pays transit insurance on a sale | Can be charged to the buyer, together with shipping, as a line shown before the order is signed (D5). Pem still chooses the cover (D3). | Commercial guidelines | lawyer |
| I4 | Deposit / loan / Confié | The other party insures « clou à clou » at the line's value, at its cost; certificate received **before** the works leave (shipment checklist). | Deposit / loan / Confié papers (exist) | lawyer |
| I5 | Gift between signature and hand-over | Not covered anywhere (R7_Open_Decisions). Proposal: Pem's cover until hand-over. | Gift paper | lawyer + broker |
| I6 | Claims | Record every claim: insurer / carrier, ref, dates, amounts, outcome, linked to the constat (R7b « Insurance and claims »). | App (R7b) | — |

## Fate of a work

| # | Point | Proposal | Written in | Confirm |
|---|---|---|---|---|
| F1 | Stolen | A fate of its own (« Volée »), like « lost »: can be found again. File a police report; its number goes in the constat. | `supabase/sql/fate_stolen.sql` (**applied live 2026-11-18**, Pem: « Apply it ») | done |
| F2 | Destroyed / lost / stolen while in someone's custody | The custodian's insurance pays (I4); the constat + the claim (I6) record it. | Papers (exist) | lawyer |

## Certificates, files, other products

| # | Point | Proposal | Written in | Confirm |
|---|---|---|---|---|
| C1 | COA with every sale | Issued automatically at « Paid » for Pem's own works; one per edition copy; re-issue = new id, old one marked replaced (R7b). | COA policy | Pem |
| C2 | Digital files for sale | Sold as a **licence** (use, term, territory), never as the work; its own contract template. | LEGAL_POLICY §6 (template to add) | lawyer + accountant (VAT on digital services) |
| C3 | NFT | Not offered now; the COA's public check gives the provenance record. Revisit on a real request. | — | Pem |
| C4 | Editions | « 30 + 5 EA », copy number on the order line, one COA per copy (R6). | Commercial guidelines | Pem |
