# Studio equipment — what is in the studio, where, in what state (design for Pem)

Now (verified against `main` 2026-11-28): **Built, on `main` (PR #14):** category « Équipement », the studio tree, the item card, « 🎙️ Dire » split on the device or « Envoyer au PC » (Ollama, `ai_job_equipment.sql` live), a photo per item. Open: QR labels for places (no place has a code, no zones / shelves yet; SQL + a place page), papers and tasks linked to an item, photo → proposed lines. The status line below is the original.
Status: **design + mockup (`Equipment.mockup.html`), nothing built.** Pem « Go design the equipment system »,
2026-11-28. Companion of [`Laboratoire.md`](./Laboratoire.md) (recipe steps name the equipment they need).

Pem, 2026-11-28: « the studio equipment that leans also into this endeavour — a list will make sense; this is a
messy job, completely overwhelming — what tools could you propose? »

## Which kind of thing, which home, what changes

Read in the repository's schema (generated types) and design notes, 2026-11-28; the live rows were not read.

| Thing | Home (exists) | Change |
|---|---|---|
| An object on a shelf — a muller, a scale, a hot plate, a press, a lamp | **Stock** (`stock_item`: name, category, quantity, unit, cost, supplier, notes) | Category « Équipement » (a label, like « Pigment »). Equipment = quantity 1, no minimum stock |
| Where it is | **Places** (`place`, kinds `studio` · `zone` · `furniture` · `container`, a tree by `parent_id`, a `code` and a photo per place — Places.md) | `stock_item.place_id` → the shelf / drawer / box. The same tree already locates works (`Oeuvres.place_id`): one « where » for works, materials and tools |
| Its state | — | `stock_item.condition`: bon · à réparer · hors service · prêté (a short fixed list) |
| When / how it came | Supply orders (`supply_order`, lines) for what was bought through the Hub | `stock_item.acquired_on` (date, may be a year — « c. 2015 ») for the rest |
| Its photo | — | `stock_item.photo_key` (R2, same pipeline as other photos) |
| Its papers — manual, invoice, warranty, safety sheet | The Vault (`document`, already linked to works, contacts, ideas, supply orders) | `document.stock_item_id` |
| Upkeep — sharpen, recalibrate, clean, replace a part | Tasks (`studio_task`, « any other task » in the map of homes) | `studio_task.stock_item_id`, a due date; shows with the other tasks |
| Used by a recipe step | Laboratoire (`recipe_step`, designed) | `recipe_step.stock_item_id` → equipment |

No new table. Six columns (four on `stock_item`, one on `document`, one on `studio_task`) — SQL, throwaway copy
first, live on Pem's OK.

**Door.** Stock is written today from four browser files (SupplierHub, StockTake, SuppliesRestock, SupplyOrderSheet
— the principles debt, principle 2). Equipment arrives with the door it should have had: `save_stock_item` on the
server (all or nothing, stale-checked, team only); the four browser writers move to it in the same build.

## Making the overwhelming list small

Order of work — each step useful on its own; stop whenever it is enough.

1. **Only what matters first.** The Laboratoire's needs and what is costly or fragile: the muller, slab, scale,
   hot plate, press, easels, lamps, the camera kit. 30–50 items, not every brush.
2. **The places first, once.** The studio tree: the studio → its zones (« coin broyage », « mur des toiles »…) →
   furniture (« étagère A », « commode ») → containers (« boîte 3 »). Ten minutes on the phone; each gets its code.
3. **Walk and talk, one place at a time.** Open « étagère A » on the phone → 🎙️ « molette en verre, balance au
   centième, deux couteaux à palette… » → the transcript becomes proposed lines, already placed on « étagère A »,
   Pem ticks / corrects / drops. (Voice recorder exists; « transcript → proposed lines » is new.)
4. **Photo instead of voice, when quicker.** One photo of the shelf → proposed lines from what it shows (the AI
   card-reading path, reused) — after step 3 has proved useful.
5. **Labels.** A QR per place (the place `code`): scan a box → its list. A QR on a single precious tool only when
   it helps (the scanner exists).
6. **Keep it true without effort.** A purchase received (supply order) adds or updates its line; a recipe step
   names its tool; « hors service » from the phone in one tap; a yearly « still there? » pass by place, not by item.

## Screens (same doors, two designs)

- **Phone, by place** — the studio tree; a place opens its list (photo, name, state) with « + » (voice / photo /
  typed) and the scan button. Made for standing in front of the shelf.
- **Desk, by list** — Stock → « Équipement »: filters by place, state, category; the item page (photo, place,
  state, papers, upkeep tasks, recipes that use it).

## Scenario (steps Pem can check)

1. Phone → Équipement → « + Lieu »: Atelier › Coin broyage › Étagère A. A code is shown (printable QR).
2. Étagère A → 🎙️ « molette en verre, plaque de verre dépoli, balance au centième, spatule » → four proposed lines
   placed on Étagère A → Pem ticks three, corrects one.
3. Balance → state « à réparer » → « + Tâche » « recalibrer » due 15/12 → it shows in the tasks.
4. Desk → Stock → Équipement → Balance: the photo, the place, the Vault manual added, the task, and « utilisée par :
   Budget de blancs, étape 1 » (once the Laboratoire exists).
5. Scan the QR on Étagère A → its list on the phone.

## Build steps (each its own GO)

1. Category « Équipement » (code + FR/EN) — usable at once in today's Stock screen.
2. SQL: the six columns + `save_stock_item` door (live 2026-11-28); the four browser writers moved to it (2026-11-28, with steps 3–4: SupplierHub, Comptage via `saveStockQuantities`, Réassort, the order sheet's new item; only the delete stays a browser write).
3. Phone « by place » screen + desk item page.
4. Voice walk → proposed lines. 5. Photo → proposed lines. 6. QR printing for places.

## Decided (Pem 2026-11-28)

1. States: **bon · à réparer · hors service · prêté** — ok.
2. Zones: **a framework first** — pictures to draft the places and the proceedings, recordings to do the bulk
   (the photo and voice walks of « Making the overwhelming list small » become the way in, not an extra).
3. Value: **yes, with invoices** — the purchase price and date come from the invoice (Vault); without an invoice the
   line stays without a value. (For an accountant, equipment bought for the studio counts on invoices; whether it is
   expensed or depreciated depends on the status chosen with the SIRET decision — a question for the accountant.)
4. **Step 1 alone first** — the Stock category « Équipement » is in (2026-11-28).

## Questions for Pem (answered above)

1. The states: bon · à réparer · hors service · prêté — enough?
2. Rooms of the studio today (the zones), to seed the tree — or by voice on the day?
3. Equipment value matters (insurance, inventory for the accountant)? If yes, purchase price + date become
   required for items above an amount.
4. Start with step 1 alone (the category, no SQL) and the voice walk later?
