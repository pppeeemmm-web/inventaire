# Supplies — orders, invoice → stock + supplier (design brief, 2026-11-18)

TODO 11 + 11d (Pem « go » 2026-11-18). Designed, then built 2026-11-18 behind its flag; SQL written, not applied (see « Pem's answers » below). Mockup: [`Supplies_Orders.mockup.html`](./Supplies_Orders.mockup.html).

Out of scope: reading an invoice or docket by itself (OCR — its own GO, TODO 11e); artwork orders (`work_order`, R7) — supply orders never touch them; cost per work (`expense_oeuvre`) stays as it is.

## What is true today (read in code and live DB, 2026-11-18)

- **Stock** (`stock_item`): 235 items, 137 with a supplier (9 suppliers), **0 with a unit cost**, 0 with a minimum. RLS « team all ».
- **Count** (`/atelier/stock?view=count`, `StockTake.tsx`) writes the counted figure straight over `quantity`. No history of moves.
- **Réassort / Commande** (`SuppliesRestock.tsx`): items out of stock or under their minimum, grouped by supplier, an order quantity per line kept **on this device only** (`localStorage`), then « Copier » = a text to paste in an email. Nothing is tracked after that.
- **Expense** (Business → Revenus & dépenses, `Fiscal.tsx`): typed by hand — date, type (ticket / facture / docket / autre), category, contact (a plain list of all contacts), HT / TVA / TTC, `receipt_ref`. 7 rows, 1 with a contact. It touches neither stock nor the supplier list.
- **Vault « Factures »** (`document.kind = 'facture'`): 1 file. A document can point to a contact or a work order, not to an expense.
- Suppliers are contacts (`Contact`, role fournisseur / magasin / fabricant, or linked on an item). Adding one today = the Contacts tab.

## The flow

```
Réassort (low items, per supplier) ──► « Créer la commande »
                                          │
  « + Achat » (walk-in, ticket in hand) ──┤
                                          ▼
                        Commande A-2026-001 · supplier · lines (item, qty, price HT)
                        Brouillon ──► Commandée (date) ──► Reçue (date)
                                          │                    │
                          « Copier / envoyer le texte »        └─ Recevoir : qty per line (pre-filled)
                                                                    + qty to stock_item.quantity
                                                                    unit price → stock_item.cost_unit
                                                                    supplier → stock_item.supplier_id (switches)
                        Dépense : « Créer » (pre-filled expense) or « Lier » an existing one
                        Facture : file → Vault « Factures » (supplier set), linked to the order
```

One record, two ways in:
1. **Planned order** — from Réassort (the device draft becomes a real draft order for that supplier) or « + Commande ». Draft → « Marquer commandée » (date) → the parcel arrives → « Recevoir ».
2. **Walk-in purchase / invoice in hand** (the 11d case) — « + Achat »: supplier, lines, « Reçu aujourd'hui ». The order is born received: stock goes up, the supplier is set on the items, and « Créer la dépense » + the ticket photo in one go.

### Supplier

Picker = contacts with a supplier role first, then search all contacts. « + Nouveau fournisseur » inline: name (→ `NomInstitution`), role « fournisseur », email / phone optional. It creates the contact; the Contacts tab shows it like any other.

### Lines

Search `stock_item` by name (items of this supplier first). « + Nouvel article » inline: name, unit, category → creates the stock item with this supplier, quantity 0. Each line: quantity, unit, unit price HT (optional), line total. Order total HT at the foot.

### Receiving

A sheet with one row per line, pre-filled with what is still due, each with − / + steppers (44 px). It shows the move before you confirm: « Ocre jaune 37 ml : 3 → 8 ». Confirm = one database call that adds every quantity at once (no lost update if two people touch stock), stamps what was received on each line, sets the received date. A line short of its ordered quantity shows « 3 / 5 ». (As built: no undo, no history — see Pem's answers.)

### Expense and invoice

- « Créer la dépense » opens a short expense form inside the order (as built), filled: date = today, type « Facture », contact = supplier, category « Matériaux artistiques », libellé « Commande A-2026-001 — Supplier », HT = order total (when priced). You type the invoice number (`receipt_ref`) and check the amounts against the paper. Saved → linked to the order.
- « Lier une dépense » = the supplier's expenses not yet linked to an order.
- One invoice for two orders: both orders point to the same expense.
- « Facture » = a file (PDF or photo) → Vault « Factures », supplier set, linked to the order. On the phone, the file picker also offers the camera (no forced-camera attribute).
- The expense form shows « Commande A-2026-001 (4 lignes) » when linked, with a link back.

## Screens

- **Studio → Fournitures** gains a fourth view **Commandes** (after Réassort). List: ref, supplier, status chip, lines, total HT, ordered / received dates, ✓ dépense, ✓ facture. Filter: open (draft + ordered) by default, then all. « + Commande » and « + Achat » top right.
- **Réassort**: « Copier » stays; next to it « Créer la commande » per supplier group (takes the quantities typed there, then clears them).
- **Order** = drawer on desktop, full-screen sheet on the phone; status steps at the top, lines in the middle, actions in a sticky footer (safe-area padding). Unsaved-change guard as everywhere (`useUnsavedActionGuard`).
- **Phone (375 px)**: list as cards; the two jobs that happen on the phone are « Recevoir » (parcel at the studio) and « + Achat » (at the shop counter, ticket photo). Desk work (prices, linking the expense) works on the phone but is not tuned for it.

## Data (first proposal — see « as built » below)

New tables only, no change to existing ones:

- `supply_order` — `id`, `ref` (A-YYYY-NNN, set by trigger like `work_order`), `supplier_id` → `Contact`, `status` (draft / ordered / received / cancelled), `ordered_at`, `received_at`, `expense_id` → `expense` (null when none; several orders may share one), `invoice_document_id` → `document`, `notes`, `created_by`, `created_at`, `updated_at`.
- `supply_order_line` — `id`, `order_id` (cascade), `stock_item_id` → `stock_item`, `qty_ordered`, `qty_received` (default 0), `unit_price_ht`, `position`.
- `receive_supply_order(order_id, lines jsonb)` — security invoker (RLS applies), adds the quantities, fills `cost_unit` / `supplier_id`, stamps the lines and the status, all in one transaction.
- RLS « team all » like `stock_item` and `expense`; `revoke all … from authenticated, anon` then explicit `grant select, insert, update, delete` to `authenticated`; nothing for `anon`; execute on the function to `authenticated` only.

UI behind `SUPPLY_ORDERS_SQL_LIVE = false` until applied. Letter **A** (achat) is free: work orders use V / D / P / G / C.

## Pem's answers (2026-11-18) and what was built

Pem first replied here (« ? », « yes », « idk », « we track everything », « what's best? », « as you see fit », refs unlimited), then confirmed the lead's suggested answers (« Yes, take them », relayed 2026-11-18). Built to the confirmed answers, behind `SUPPLY_ORDERS_SQL_LIVE = false` (`lib/supply-orders.ts`); SQL in `supabase/sql/supply_orders.sql`, not applied.

1. **One « Commandes » list** for planned orders and walk-in purchases (« + Achat » = an order born « reçue »).
2. **Partial delivery**: the order stays open (« Reçue 3 / 4 »), « Recevoir le reste… » later, « Clore (manque accepté) » to stop waiting.
3. **Item with another supplier: switch to the latest** on receiving; the old supplier stays on past orders.
4. **Invoice file on every expense**: `document.expense_id` (+ `document.supply_order_id`); the expense form in Revenus & dépenses gets a « Facture / ticket » section, order or not.
5. **No undo** of a receipt; a wrong figure is fixed by Count. An order with something received cannot be cancelled — it is closed (« Clore »).
6. **No stock history log** for now. Count is unchanged.
7. **Ref** `A-2026-001`; the number grows past 999 (`A-2026-1000`, no lpad cut).

Data (as built): `supply_order` (ref by trigger, supplier, status, dates, `expense_id`), `supply_order_line` (`qty_received` written only by `receive_supply_order()` — column-level update grant), `receive_supply_order(order_id, lines jsonb)` (security definer + `is_team()`, one transaction: stock + unit cost + supplier + line + status). A draft can be deleted; an ordered order is cancelled instead.

## Questions for Pem (asked 2026-11-18, answered above)

1. **One « Commandes » list for both** planned orders and walk-in purchases (a purchase = an order born « reçue »)? Or keep walk-in purchases out of it?
2. **Partial delivery**: the order stays open until everything has come (with « Clore » to accept a shortfall), or one « Recevoir » closes it whatever arrived?
3. On receiving, **the price paid becomes the item's unit cost**, and the **supplier is written on items that have none**. If an item already has another supplier: keep the old one, or switch to the latest?
4. **Invoice file**: linked to the order only (no change to existing tables), or should **every expense** (a shop ticket with no order) be able to carry its file? That one adds a column to the Vault documents table.
5. **Undo a receipt**: none — a wrong figure is fixed by Count, as today. OK?
6. **Stock history** (a log of every move, receipts and counts): not now? Today Count leaves no trace either.
7. **Ref** « A-2026-001 » on each order (to quote to the supplier) — OK, or no ref?
