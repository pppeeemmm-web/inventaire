# Products engine — prints, books, other products, digital files (design, 2026-11-18)

Pem's GO (2026-11-18, « go » on « Multiple products engine »). **Design only — no code, no SQL.** Builds on [R6_Events.notes.md](../2026-11-17/R6_Events.notes.md) (editions decided: one catalogue entry per edition, « 30 + 5 EA », copy numbers on order lines, « Confié » to the printer), [R7b_OrderCascade.notes.md](./R7b_OrderCascade.notes.md) (orders → shipment → COA → invoice), [COMMERCIAL_GUIDELINES.md](../../COMMERCIAL_GUIDELINES.md) §5, [POLICY_NOTES.md](../../POLICY_NOTES.md) C2–C4.

## What is true today (live, 2026-11-18)

- Every catalogue entry (`Oeuvres`) is **one unique object**: one owner, one place, one status. An order line (`work_order_work`) is one work.
- No edition, book or product exists in the data (0 works in technique « Gravure »; R6 count).
- `stock_item` exists — for **studio supplies** (paints, papers, counted in Studio → Fournitures), not for things sold.
- Strategy: commercial tools get effort when a real case comes (STRATEGY). So the engine is built small, around the first real edition or book.

## Three families, three shapes

| Family | Example | Unique? | What is sold | Shape in the app |
|---|---|---|---|---|
| **Edition** (numbered) | a print run « 30 + 5 EA » from a painting | each copy is numbered, so each copy is traceable | one copy (« 7/30 ») | **edition** = one catalogue entry with a run; **copies** = numbered rows (owner, place, status each) |
| **Product** (not numbered) | a book, a catalogue, cards, an open print, a poster | no — identical items | a quantity | **product** + **stock by place**; an order line carries a quantity |
| **Licence** (digital file) | a high-resolution file for a book cover, a print-on-demand file | no — a right, not an object | a use (purpose, term, territory) | **licence** on an order line + its contract; no stock, no shipment (a download link) |

Why copies get rows: a numbered copy has a buyer, a COA, a provenance, can be lent or come back (14 days) — exactly what a work has. A book does not: 200 identical copies are counted, not followed one by one.

## Edition

- **Edition entry**: the existing work card, marked `is_edition`, with: source work(s) (a link, R6), technique / support / size of the print, printer (contact), run size, proofs (EA, HC, BAT counts), price steps (§5.2 of the guidelines), date.
- **Copies**: `edition_copy` (edition, number « 7 », series « main / EA / HC », status available / reserved / sold / gift / lent / destroyed, owner, place, COA). Created all at once when the run is printed (the Confié to the printer comes back).
- **Order line**: a sale line points to **one copy** (`work_order_work.edition_copy_id`), so payment, COA (« 7/30 » printed on it), shipment, invoice and the 14 days all work as for a unique work.
- **Inventory**: the edition shows once, with « 23 / 30 available ».
- **Site**: the edition page shows the current step price and « n left ».

## Product (books, cards, posters…)

- `product`: title, kind (book, catalogue, card, poster, other), ISBN (books), price, VAT rate (books often have their own rate — accountant), weight (for shipping), linked works (what it reproduces), publisher / printer.
- `product_stock`: quantity per place (studio, a bookshop on deposit, an event), with movements (`product_move`: printed, sold, given, deposited, returned, damaged), so the count is explained.
- **Order line**: `work_order_product_line` (product, quantity, unit price). A sale can mix works, copies and products; a **deposit** to a bookshop can carry 20 books (sold copies reported back, like a gallery deposit).
- Shipping: the same R7b shipment (a product line ships like a work; weight adds up).
- No COA for a product.

## Licence (digital files)

- `licence` on an order line: the work or image, the use (book cover, editorial, print-on-demand, advertising), term, territory, exclusivity, print run limit, credit line, price.
- Paper: the **licence contract** (LEGAL_POLICY §6, template to write) instead of a bon de commande; delivery = a time-limited download link to the file in the Vault; no shipment, no COA.
- Money: copyright income may be a different tax regime and VAT rate from a sale of a work (accountant questions 5, 9) — the invoice line says « licence ».

## What stays the same

Orders (one list, five kinds), papers, payments, shipment checklist, invoice, 14-day rule (for physical goods; a licence or a made-to-order item may be excluded — lawyer), Fil, Overview counts.

## Build order (each its own GO, SQL shown first)

1. **Edition + copies** — when the first run is planned (an « Lancement d'édition » event already exists in R6).
2. **Products + stock** — when the first book or card set is printed.
3. **Licences** — when the first file request comes (or with the licence contract template).

## Questions for Pem

1. What comes first in real life: a print run, a book, or a file request?
2. Editions: which proofs do you use (EA only, or HC / BAT too)? Is the run size always fixed at printing?
3. Products: will others sell your books / cards on deposit (bookshops, museum shops)?
4. Licences: have you had requests for images (book covers, press, merchandise)? Do you want them priced from a grid or case by case?
5. The website: should editions and products be **buyable online** (a shop), or « enquire » like the paintings today?
