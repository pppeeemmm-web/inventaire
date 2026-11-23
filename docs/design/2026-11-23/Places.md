# Places and storage locations — design (2026-11-23)

Status: **local draft**, uncommitted, design only — no code, no SQL. Pem answered every question 2026-11-23 (four rounds, §12). Design complete — waiting for Pem's approval.
Brief: master plan §1.1 b (one place store) + §15.2 (where a work is — the storage map), held to People §4d (addresses are shared places).
Read for this page: root `CLAUDE.md`; [`BuildingPrinciples.md`](../2026-11-21/BuildingPrinciples.md); [`MasterPlan.md`](../2026-11-20/MasterPlan.md) §1.1 b, §14.2, §15.2; `docs/design/2026-11-22/People.md` §0, §3, §4d, §7 (worktree `scope-interview-d46685`, not landed yet).
Live database read only, 2026-11-23: columns, foreign keys, triggers, functions, RLS, counts — **no names, streets or other personal data copied here.** Code read: the files named in §10.
Mockup: [`Places_Mockup.html`](./Places_Mockup.html) — desk and phone (375 px) side by side, clickable, invented places and works.

---

## 1. Kind, home, what changes (principles first)

| | Answer |
|---|---|
| **Kind** | A place: anywhere a person can be reached, a work can be kept, sent, shown or made. A street address, a venue, a storage loft, the studio, and inside the studio a zone, a piece of furniture, a box. |
| **Home** | **`place`** (exists: 8 creation places with coordinates) becomes the one store, as a tree (a box inside a rack inside a zone inside the studio address). Beside it, **one new link**: a person ↔ a place with a role (`contact_place`). `contact_addresses` is folded into `place` + `contact_place` and then dropped. |
| **What changes** | Works, orders and shipments point at a place. Every box gets a QR. A work is found by its path (« Atelier › Mezzanine › Meuble à plans 2 › Tiroir 4 »), from search, the card, a scan or the studio map. Addresses are shared: « Retirer » ends a person's link, a place is archived, never deleted. |

**Why no new table for storage locations** (principle 8): a box is a place with a parent. The master plan already said so (« studio locations are child places of the studio address »). A separate `storage_location` table would be a third place store.

**Why `contact_place` is new** (the only one): a person ↔ place link carries a role and dates (lives here since 2019, works kept here). Checked against existing homes:

| Existing home | Why it does not fit |
|---|---|
| `contact_addresses` | It *is* the address, owned by one card — the thing that cannot be shared (live: one street typed on 2 cards). |
| `tblrelations` | The graph links nodes (works, contacts, themes); places are not nodes, and a role + since / until + primary flag do not fit its columns. The graph keeps `located_at` (work → holder) as today. |
| A `place.contact_id` « owner » column (master plan §1.1 b's first sketch) | One person only. People §4d decided several people per place, each with a role. |

---

## 2. What exists live (counts, 2026-11-23, no personal data)

| Thing | Live |
|---|---|
| Address rows (`contact_addresses`) | **40** rows on 36 cards. 12 have a street, **18 have only a city / postcode, 10 are empty** (no street, postcode or city). 1 row has shipping notes. |
| « Identical lines » | **4 lines are shared by 16 rows** — but read closely: **1** is a real street on 2 cards; 2 are a city alone on 2 cards each; **1 is the empty line, on 10 cards.** Merging « identical lines » blindly would make one fake place shared by 10 people. |
| Pem's card (contact 13) | 3 address rows, labelled « Principal » (1,029 works), « Atelier » (142 works), a third (0 works). |
| Works (`Oeuvres`) | 1,178 (1 in the bin). Holder set on all; address set on 1,176. Of the 2 without: holder with several addresses. 5 works point at another person's address. |
| `Oeuvres.LocalisationDetail` (old free text) | 1,075 works, **2 distinct values** — « city, country » (343) and « Atelier — city » (732). Read by the map as a label, not geocoded. **It does not duplicate the address:** 729 of the « Atelier » works point at the « Principal » address (they are finished, the stage rule moved them), 76 « city » works point at « Atelier ». Since the Atelier is inside the Principal (Pem 2026-11-23), the text may be the truer « which room » — kept as data for the migration (§7 step 4), not dropped blind. Still written by the work form, batch edit and pending keys. |
| Orders (`work_order.address_id`) · shipments (`shipment.address_id`) | 9 orders, 0 with an address · 0 shipments. |
| `place` (creation places) | 8 rows, all with coordinates, 5 with an address line; 3 named like a studio. Read by 13 creation steps and 4 periods (`ON DELETE SET NULL`). |
| Studio locations, box codes | **none** — no column, no table. Work labels already print a QR (`selection/actions.ts`, encodes `/atelier/works/<id>`); the scan page exists (`/atelier/scan`, tile on the phone home). |
| Sizes | Height + width filled on 822 works, all numbers (text columns `Hauteur`, `Largeur`). |
| Graph | `located_at` 1,178 links (work → holder contact). No place nodes. |
| RLS | `place` and `contact_addresses`: one « team all » policy each. |

**Triggers and functions that know addresses (live):**
- `oeuvre_location_by_stage` (BEFORE on works): clears an address that does not belong to the holder; for any holder but Pem, fills the address when the holder has exactly one; **for Pem, picks the address whose label matches the stage** (`atelier` while in making / not yet photographed, `principal` once finished, available or reserved).
- `contact_address_link_single` (AFTER on addresses, skips Pem): when a person has exactly one address, gives it to their works that have none.
- `merge_contacts`: moves the losing card's address rows to the kept card.
- `graph_place_text_dirty` (on `place`): marks every work's search text dirty when a place's name or address changes; `oeuvre_search_text` reads `place`.
- Rule 9 of the audit (`lib/work-rules-checks.ts:144`): the work's address must belong to its holder.

---

## 3. The model

### 3a. `place` — the one store (columns added to the existing table)

| Column | What | Notes |
|---|---|---|
| `id`, `name`, `address`, `town`, `country`, `latitude`, `longitude`, `created_at` | exist | `address` = street line |
| `postcode`, `complement` | new | complement = bâtiment, étage, appartement (People §4d: same building, another flat = another place) |
| `kind` | new, short fixed list | `address` · `venue` · `studio` · `zone` · `furniture` · `container` · `motif` (a landscape painted). A label, not a table: a change of mind costs a label. |
| `parent_id` | new | the place it sits in. A street address has none. Cycles refused by the database. |
| `root_id` | new, kept by the database | the top of the tree (the address). Moving a box under another address moves its root and everything inside. Readers that want « which address » read the root, one join. |
| `code` | new | short code on the label, « A-3-12 ». Unique among live places. Suggested from the parent's code + the next number; Pem can type another. |
| `photo_key` | new | one photo of the box / shelf (R2, through `imageUrl()`). |
| `fragile` | new | « papier de riz — ouvrir avec soin »: shown on every work inside. |
| `shipping_notes` | new | moved from the address row (1 live). |
| `archived_at`, `archived_by` | new | **never deleted** (today `period-source-actions.ts:324` deletes a place — becomes archive). |
| `valid_from`, `valid_to` | parked SQL (`place_validity_dates.sql`, not applied) | creation-place dates; unchanged by this design. |
| `description` | new | what the place is, in words |
| `conservation` | new | the conditions there, in words: light, temperature, humidity, dust, pests, roof, water — « état de conservation » (§6b) |
| `risk` | new, short fixed list | `none` · `watch` · `high`. A risky spot (under the roof, near the water heater) is itself a child place with `risk` set, a description and photos — so it shows on the plan and in lists, and nothing may be stored there without a warning |
| `plan` | new | the floor plan: walls and the rectangles of the child places, drawn with the Exhibitions floor-plan tool (§6a) |
| `plan_image_key` | new | the imported picture under the plan (§6f) |
| `access` | new | the ordered steps to reach this place from its parent: sentence, kind, photo, key name; door codes kept apart, admin-only (§6e) |
| `keeps` | new, optional | a storage hint for a box: a period, a number range, a maximum size, « fragile only » (§6c). Hints, never refusals |

**One rule for « who sees what »:** a place carries no name of a person. Who lives there is on the link (§3b). A place can be shown to the team and on papers; the people linked to it follow the person's own privacy (People §4d: the « adresse déjà connue » suggestion never says who else is linked).

### 3b. `contact_place` — a person at a place (new)

`contact_id`, `place_id`, `role` (`home` lives here · `work` works here · `works_kept` works kept here · `delivery` deliveries · `other`), `label` (free, kept from today: « Principal », « Atelier »), `is_primary` (one per person), `since`, `until` (optional; a move ends the old link, history stays), `position`.
- « Retirer » on a card = sets `until` (or removes a link that never had a work, an order or a paper). The place stays.
- Only top-level places (`address`, `venue`, `studio`) can be linked to a person. Pem's studio boxes are under the studio address.

### 3c. What points at a place

| Pointer | Today | After |
|---|---|---|
| A work | `Oeuvres.localisation_address_id` → address row | **`Oeuvres.place_id` → the deepest place it is in** (a box, or the address when nothing finer is known). The address = the place's root. **One pointer, not two**: the master plan's « a work points to one location » — moving a box moves its works, and the address can never disagree with the box. |
| The holder | `Oeuvres.LocalisationID` → contact | unchanged |
| An order | `work_order.address_id` | `work_order.place_id` (a top-level place) |
| A shipment | `shipment.address_id` | `shipment.place_id` (a top-level place) |
| A creation step, a period | `place_id`, `default_place_id` | unchanged (already `place`) |
| Old free text | `Oeuvres.LocalisationDetail` | **nothing is lost:** its 2 values become the place pointer at migration (« Atelier — … » → the Atelier room, « city » → the Principal, §7 step 4) and stay in each work's version history; then it stops being written and is dropped one release later, with its own OK |
| Its usual box, while it is out for a day (easel, photographer, a sheet issued) | — | `Oeuvres.home_place_id` (new). Why a second pointer: « where it is now » and « where it goes back » are two facts for a few hours; cleared when the work is scanned back. Never set by an order (rule 4) |
| A sheet issued (who was sent, when, which works) | — | **a `moment`** (People §4) of kind « mission », open until the works are back (Pem 2026-11-23). No `place_visit` table. So the Places build that issues sheets comes **after** `moment` lands |
| Who may enter, who knows a code, who holds a key | — | `contact_place` role `authorised` + level + `knows_code_since` + `key_name` (§6e) |
| Photos and papers of a place (lease, insurance, the roof) | — | the Vault: `document.place_id` (new column, same pattern as `oeuvre_id`, `contact_id` there) |
| A dated remark on a place (« fuite au plafond », « 68 % d'humidité ») | — | `note_line` with `target_kind = 'place'` + `place_id` (new column) — the same home as a remark on a work, with its photo |

---

## 4. The rules — in the database (principle 1)

1. **The holder is linked to the work's address.** A work's place root must be a place its holder is linked to (any role, link not ended). Refused otherwise with one sentence (« ce lieu n'est pas relié à X »). Replaces the first lines of `oeuvre_location_by_stage` and audit rule 9.
2. **Pem's stage rule, kept and made box-aware.** The Atelier is a room inside the Principal (Pem 2026-11-23), so the tree is **Principal › Atelier › zones › boxes**, and Principal › other rooms. When a work of Pem's changes stage, the database looks for the place linked to Pem with the stage's label (`atelier` / `principal`, as today). **If the work is already somewhere inside that place's tree, it stays put.** A finished work in an Atelier box is inside the Principal too, so it stays in its box — today it would be moved to « Principal ». A work in making stored in the attic is moved to the Atelier, top level, « à ranger ». Pem's choice by hand still wins (same « picked » test as today).
3. **One address only, filled for you.** A holder (not Pem) linked to exactly one place → their works with no place get it (today's `contact_address_link_single`, moved to `contact_place`).
4. **Leaving Pem's hands clears the box.** An order that moves works to a party sets their place to the order's place (or the party's single place); the studio box is no longer theirs. Back from loan or deposit → Pem's stage place, top level, « à ranger ».
5. **A place is never deleted.** Archive only; an archived place with works or children inside is refused (« 12 œuvres encore dedans — les déplacer d'abord »).
6. **No loops, one code.** A place cannot sit inside itself; a code is unique among live places.
7. **Every move is history.** A work's place change goes into its version history (`oeuvre_versions`, as today for the address). A box moved = one line on the box's own history, not 40 work versions (the works did not change — their root did).

---

## 5. Doors (principle 2 — one door per record, on the server, all or nothing)

| Door | Does | Returns |
|---|---|---|
| `savePlace` | create / edit a place (any kind); searches known addresses first (same street + postcode + city, the `sameAddress` rule) and answers `known_address` with the match, no names | the place as stored, `changed: [...]` |
| `movePlace` | put a box / shelf inside another place (« tout le carton A-3-12 au grenier ») | the place + how many works moved with it |
| `archivePlace` / `recallPlace` | never delete | refusal if not empty |
| `placeWorks` | put 1…n works in a place (from a scan, a selection, a group: « tout le groupe Montrouge → A-3-12 »); checks rule 1 per work; one transaction | per work: moved / already there / refused + why |
| `linkPersonPlace` / `endPersonPlace` | the person's side, called by `saveContact` (People §3 step 4) | the link |
| `resolveScan` (read) | a scanned text → a work or a place (`/atelier/works/<id>` or `/atelier/p/<code>`) | what it is, its path |

Team moves are written at once and reach Pem's Fil quietly (People §3 rule: « Lieu modifié par X — avant → après », « Vu », « Revenir »). No `revalidatePath('/atelier')`: a move returns the works it moved.

---

## 6. Finding « that 5 × 7 work » — and the box labels

**Search understands sizes.** « 5x7 », « 5 × 7 in », « 13 x 18 » → works whose height × width match in either order, within half a unit; a bare « 5x7 » tries inches and cm both, inches first (12.7 × 17.8 cm). Uses the 822 works with sizes; the other 356 say « taille inconnue » in a count, never hidden silently. The result line shows the thumbnail, number, title, size and **the path with the box code in large type**, the box photo on tap. « Sans emplacement » is a filter and a count everywhere.

**Where the path shows:** work card (desk + phone), ⌘K, phone search, Inventory column « Emplacement » + filters (place, size, « sans emplacement », « fragile »), the studio map, the box page, the insurer's list (§14.2), the contents sheet.

**Box label (QR).** Printed from the same label sheets as works (`selection/actions.ts` already draws QR labels). Big code « A-3-12 », name, kind, « FRAGILE » if set, and a QR → `https://www.thepemworkshop.com/atelier/p/A-3-12` (live site, never localhost — same rule as work labels). A phone camera opens the box page directly; the hub's scan page reads both kinds of QR.

**Box page** (`/atelier/p/<code>`, desk and phone, same read): path, photo, fragile flag, contents as thumbnails sorted by number, child places, « Imprimer la feuille de contenu » (the sheet taped inside the lid), « Ranger ici » (main button).

**Tidy-up session (phone).** Scan the box → « Ranger ici » → scan works one after another; each scan is one `placeWorks` call with a sound / vibration and a line « #1234 → A-3-12 » (« était dans A-2-03 »); « Terminer ». A work that is not Pem's to place (holder elsewhere) is refused with the sentence, the session goes on.

**One path bar, everywhere (Pem 2026-11-23: « more streamlined visually? » — yes).** The path is one row of steps, each tappable, the last one large: `Principal › Atelier › M › M-2 › M-2-4`. The same bar heads the box page, the work card, a search result and the phone. The tree on the left becomes indentation only: names, a small grey code, the count; no frames, no kind icons.

**Same information on the phone (Pem: « does the phone get less info? » — no).** The phone shows the same read as the desk, stacked: path bar, the box's photo, fragile and risk warnings, the conservation note of the room, **the neighbours in the box** (« entre #1233 et #1241 »), the floor plan with the spot lit, holder, size, history. Only the layout changes (principle 10). The first mockup was thinner by mistake.

### 6a. Floor plan (Pem 2026-11-23: « add a floor plan ») — in the first build

- Each place may carry a plan (`place.plan`): walls, doors, and the rectangles of its child places (racks, the plan chest, the risky corner). Drawn once with the **Exhibitions floor-plan tool** (`FloorPlanTool.tsx`, `ExhibitionFloorPlanEditor.tsx`) — the same editor, a second use.
- Tap a rectangle → that place (its own plan if it has one, else its boxes and works). A search result lights its spot on the plan.
- Risky spots are drawn in the warning colour; conservation notes show on hover / tap.
- Printed once for the wall at the entrance (master plan trick 4), with the codes.
- **Sending someone who does not know the place (Pem 2026-11-23: « he'll find the place straight away »).** On a work (or several): « Fiche pour aller la chercher » → one page, PDF or image to send by message: the plans from the entrance down to the spot, each with the next step lit and the door marked; the path in words (« Entrer par la cour › Atelier › escalier de la mezzanine › Meuble à plans 2 › Tiroir 4 »); the photo of each step (room, furniture, box); the work's thumbnail, number, size; « FRAGILE — papier de riz » when it applies. A file, not an access: the person needs no account (master plan: outsiders get files). Several works → one sheet sorted by route, so one trip picks them all.

### 6b. Photos, risky places, conservation (Pem 2026-11-23)

- **Photos of a place:** one cover photo (`photo_key`, shown on the box page, the label sheet, a search result) + as many as needed in the Vault (`document.place_id`): the room, the shelf, the inside of a drawer, the damp corner.
- **Risky places:** a spot is a child place with `risk` (`watch` / `high`), a description (« sous la toiture — fuite en 2024 »), photos. It shows red on the plan and in the tree; placing a work there asks « lieu à risque — ranger quand même ? »; the insurer's list (§14.2) gives works per risk.
- **State of conservation:** `conservation` on each room / furniture says the conditions in words (light, temperature, humidity, dust, insects, water). Dated checks — a reading, a leak, a mould spot — are **remarks on the place** (`note_line`, kind « conservation », with a photo), so the place keeps its history and the day's Journal page shows them (one stream). A remark flagged « œuvres touchées ? » lists the works inside so a condition report can be opened on each.
- **Warnings, with a before and an after (Pem 2026-11-23).** A remark can be a **warning** (« alerte conservation »): it opens with a photo and a sentence — the *before* (« tache d'humidité au plafond, 3 cartons dessous ») — and stays open until someone closes it with the *after* (« plafond repeint, cartons secs, photo »). Open and closed, the pair stays on the place's history. Same home (`note_line`), two fields more: `opened` / `closed_at` + `closed_note` + `closed_image_key`.
- **Listed (Pem: « it needs to be listed somewhere »):** one list « Alertes conservation » — every open warning, every place, oldest first, with the works inside each place — on the Atelier page, in Pem's Fil (one line per new warning), and in the insurer's list (§14.2). No yearly reminder (Pem chose warnings, not a calendar).
- One read « Conservation » on the Atelier page: rooms with their conditions, risky spots, open warnings, works in risky spots (count).

### 6c. Storage hints (Pem 2026-11-23: « by period, number order… just giving hints »)

- A box may say what it is for (`keeps`): a size range, a number range, a period (`work_period`, exists), « fragile only ».
- **Which first (Pem: « heart says period, head says size and numbers — what is best? »). Proposal: size, then numbers; period as a colour.**
  - **Size first**, because a box or a drawer is a physical thing: a 50 × 65 does not go in a 30 cm drawer, and same-size works stacked together do not crush each other.
  - **Numbers inside**, because a number is what you look for (the card, the label on the back, the scan) and the eye finds #1234 between #1233 and #1241 without unpacking. Numbers also follow time, so period comes almost free.
  - **Period as a colour dot** on the label and the contents sheet (master plan trick 6), and as a filter — the heart is served without fighting the shelf.
- **When placing**, the picker proposes boxes in this order: right size → neighbouring numbers → free room. « Proposé : M-2-4 — formats ≤ 30 cm, #1230–#1260 ».
- **When reading a box**, works that break its hint are marked « hors règle » (a 2015 work in a 2020 box) — never moved, never refused.
- Inside a box the contents sheet is always sorted by number (trick 5), so a box can be read by eye.
- Hints are labels and a read: changing the rule of a box costs nothing (« a kind is a label, a view is a read »).

### 6d. Exhibitions and Constellation (Pem 2026-11-23: « now if you wish »)

- **A gallery is a legal person, a building is a place (Pem: « galleries like moral personas, people physical personas — like in French law »).** Exactly the split here: the gallery as a body (personne morale) is a `Contact` card of kind institution (26 live), a person is a `Contact` of kind private; the gallery's rooms and stockroom are a `place`, linked to the gallery card with a role (« works here », « works kept here »). A fair is a place with no card linked, or linked to the fair's organiser.
- **Exhibitions:** a venue is a place (`exhibition.lieu` text → `exhibition.place_id`); the venue's plan is the place's plan; the hanging of one show (`exhibition_layout.placements`, exists, 3 live) is drawn on top of it. Same tool, same data. Custody stays with orders (loan / deposit to the venue).
- **Constellation — my proposal:** Constellation is the map of *meaning*. A place belongs on it only when it says something about the work:
  - **Yes:** where a work was **made** (the creation places, 8 live, read by creation steps), the **motif** painted (a landscape, a street), where it was **shown** (a venue, through the exhibition). Links « fait à », « motif », « montré à » — made by the machine from records that exist, like today's theme and owner links.
  - **Storage too (Pem 2026-11-23: « add another type of place, which is storage »)** — as its own place type and its own link « rangé dans », drawn as a **layer that is off by default**: switched on, it shows which works sleep together (a box is a cluster), without mixing into the meaning links. Only rooms and boxes of the studio tree; never a person's home address.
  - **Three views, never confused (Pem: « make sure we're not confusing with map »):**
    | View | Answers | Places shown |
    |---|---|---|
    | **Constellation** (`ConstellationTab`) | how works relate — meaning, and with the storage layer, what is kept together | nodes: made at, motif, shown at, storage (layer) |
    | **Map** (`WorldMapTab`) | where on earth — custody and creation, by coordinates | addresses and creation places at their coordinates |
    | **Floor plan** (§6a) | where in the room | rooms, furniture, boxes, risky spots |
    Each keeps its own name and icon; a place opens the same place page from any of the three.
  - Shape: `nodes.node_type = 'place'` for places of kind studio / motif / venue / storage (rooms and containers of the studio tree); the 1,178 `located_at` links (work → holder) stay as they are.
  - To build after the storage build, its own GO.

### 6e. Getting there — the access route (Pem 2026-11-23)

Pem: the building door with a code, stairs or a lift, gates, a door with keys only, a corridor, « the place is the second door on the left ». **Everything that someone sent there needs to be told, as one route from the street.**

- **Home:** each place carries its own **steps to reach it from its parent** (`place.access`, an ordered list): the address has the street-to-flat steps, the Atelier has the corridor-to-room steps, a rack has « au fond à gauche ». The route to a box = the steps of every place on its path, joined in order. Change one door once, every sheet follows.
- **A step** = a short sentence, a kind (door with a code · door with a key · gate · stairs · lift · corridor · room · furniture), an optional photo, and for doors **which key** (« clé bleue, trousseau atelier ») or **that there is a code**.
- **Codes are on the sheet (Pem 2026-11-23: « if it's hidden it makes no sense — record that the person knows the code from that moment »).** The sheet carries the codes and names the keys. What the hub keeps is **who knows what since when**: issuing a sheet with a code writes « Clara connaît le code de la porte de l'immeuble depuis le 2026-11-23 » on her link to the place. When Pem changes a code, the hub lists who knew the old one (« 3 personnes connaissaient l'ancien code ») and the new one starts an empty list. Codes themselves are stored admin-only; the team sees « porte à code » on screen, and the code only on a sheet Pem (or an authorised person, below) issues.
- **The sheet is a moment (Pem: « the person gets the task… it becomes a moment to them »).** Yes. Handing a sheet is a **moment** (People §4: who × which works × when × kind × paper) of kind « mission — aller chercher / rapporter »: the person, the works, the place, the PDF as its paper. It stays **open** until the works are scanned back into a box (or into the order that took them), then closes itself. So no `place_visit` table: the moment is the record, the Journal day page shows it (« Clara envoyée chercher #1234, #1241 — 14 h »), the works' history shows it.
- **Authorised people — a category of people with levels (Pem 2026-11-23).** Not a new table: a role on the person ↔ place link (`contact_place`, §3b), role `authorised`, with a **level** and since / until:
  | Level | May |
  |---|---|
  | 1 — accompagné | enter only with Pem or a team member; no code, no key |
  | 2 — code | knows the door codes (recorded as above); comes alone when sent with a sheet |
  | 3 — clé | holds a key (which one is named); may fetch and put back, scans works in and out |
  | 4 — équipe | the team: all the above, moves works between boxes (quiet note in Pem's Fil) |
  Ending the link (« plus autorisé·e ») keeps the history and lists the keys to get back and the codes to change. The sheet's « pour qui » picker offers authorised people of the place first; anyone else gets a warning (« n'est pas autorisé·e ici — l'autoriser pour cette fois ? », level 1 or 2, with an end date).
- **« Sorties en cours » — where (Pem: « whatever's best »):** on the Atelier page always (works out, with whom, since when, the open moment). In Pem's Fil **only when it is late**. **Late = past its date (Pem 2026-11-23: « late from day one — past date is late »):** every sheet carries a « à rapporter le » date (default: the same day, changeable when issuing; also printed on the sheet); the day after it, the mission is late and appears in the Fil. Same for an authorised person whose end date has passed with works still out. Nothing in the Fil before the date.

### 6f. Floor plans — import or draw? (Pem 2026-11-23: « do I import the floor plan? what do you suggest? »)

**Suggestion: import a picture, then mark the spots on it in the hub.** No architect drawing needed.

1. **Get one picture per level** (the building's floor with the corridor, the flat, the Atelier, the attic). Any of these:
   - a photo of the building's plan (fire-escape plans in the stairwell, the lease or sale papers often have one);
   - a quick sketch on paper, photographed flat;
   - drawn on the PC with a free tool if Pem wants it neat — **Sweet Home 3D** (free, Windows, works offline, exports a picture or PDF) is the one I would suggest; online planners (Floorplanner, Magicplan) work too but need an account and keep the file on their side.
2. **In the hub, the picture becomes the background** of the place's plan; with the Exhibitions plan tool Pem draws **only the clickable rectangles** on top (the door, the racks, the plan chest, the risky corner) and links each to its place. That is all the hub needs: where to click and where to light.
3. **Measures are optional.** A plan to find a box does not need centimetres; a scale can be added later if it is ever used for hanging.

Why not draw everything in the hub: drawing walls well is a full program; the hub would do it worse than a free tool, and it is not what finds a work. Why not only a photo: a photo cannot light the spot or open the box when tapped.

**Settled (Pem 2026-11-23):** any kind of plan — the Exhibitions floor-plan tool already in the app, Sweet Home 3D (Pem has it), a photo or a sketch — **placed in transparency under the hub's plan tool**, and the spots drawn on top. The engine is the Exhibitions plan tool (`FloorPlanTool.tsx`); the mockup's plans are plain drawings made only to show the idea. Needs one thing the tool may not have yet: a background picture with an opacity slider — to check in the code at build time.

### 6g. Issuing the sheet (Pem 2026-11-23: « as a PDF? »)

**Yes — a PDF, A4, one page per work (several works on one route → one page per stop, in route order).** It prints, it opens on any phone, it can be sent by mail or WhatsApp, and it needs no account (outsiders get files). On the phone, « Fiche pour aller la chercher » opens the share sheet straight away with the PDF. Content, top to bottom: the work (photo, number, size in cm and inches, FRAGILE), the route as numbered steps with their photos, each plan with the next spot lit, the box code in large type, the « put it back » line (« remettre dans M-2-4, ou laisser sur la table de l'entrée »). Codes as §6e. The same PDF is the paper the team uses in the studio.

### 6h. Your building, as it really is (Pem 2026-11-23: « yes and no — hold your horses »)

The Atelier is **not** the only place in the Principal. The tree is built from what is there, not from the two old address labels:

```
Principal (the building — the address)
├── l'appartement                → works hung on the walls (each wall can be a zone: « Salon — mur nord »)
│   └── l'Atelier (9–10 m²)      → works put away: meubles à plans, cartons, rouleaux
└── 6e étage — local fermé       → gated, own key; mostly the works in oil on linen
```

- **Works on a wall** are « in » that wall's place like any box: the same path bar (« Principal › Salon › mur nord »), the same fetch sheet. Taking one down for a day uses « sorti de … » (§3c).
- **The 6th-floor store** gets its own access steps (§6e: the gate, its key) — the route from the street branches there.
- **The 6th floor holds works** — mostly the oils on linen (Pem 2026-11-23: « oil on linen », the works, not supplies). A storage hint there can say « huiles sur lin » (§6c).
- **Supplies stay in the Atelier** (Pem 2026-11-23). Later a stock item (`stock_item`) may point at a place with the same pointer — no new store. Not in this build.
- Nothing of this is guessed by the migration: it creates only the address and the Atelier (§7); the flat, the walls and the 6th floor are added by Pem when the plan is drawn.

### 6i. Typing an address — the app fills what it can (Pem 2026-11-23: « when I enter the postcode, I should find the place … Marseille is always France »)

- **Postcode first:** typing « 20239 » proposes the town(s) that have it (« Rutali », « Murato »… when one code covers several) and fills the country. Typing « Marseille » fills France. One tap to accept; nothing is written without it.
- **How:** the app already asks OpenStreetMap (Nominatim) for coordinates (`/api/geocode`, `lib/geocode-nominatim.ts`); the same lookup answers postcode → town + country + coordinates. The coordinates are then stored on the place (the map stops looking them up on every visit, §10).
- **A town alone is a complete answer**, not an error: « Paris » with no street is a place in Paris; it never stops another place in Paris from existing (§6j).

### 6j. Names are not identities (Pem 2026-11-23: « Paris is a city … I don't understand where the problem is »)

Pem is right: there is no problem to protect against. The database still refuses two creation places with the same name (the old rule `place_name_creation_uq`, kept by phase A so the creation-places screen did not change). That rule is wrong for the same reason it was wrong for addresses: two different places can carry the same short name, and a place known only as « Paris » must not block the next one.

**Proposal:** drop the rule. A place is told apart by what it is (street, town, its parent, its code), never by its name. When a new place looks like a known one (same name and town, or same street), the app says « déjà connu — le reprendre ? » and Pem chooses — the same gentle check as for addresses (People §4d). The screen's « duplicate » message then simply never shows. Needs Pem's OK (one line of SQL, live).

**No-device tricks (master plan §15.2) need no build** and can start any day: code on the back label, contents sheet in the lid, code large on the box, one printed map at the entrance, sort by number inside a box, fragile boxes apart.

---

## 7. Migration — 40 address rows → places (one SQL file, its own OK, proof on the Docker copy first)

1. **Add** the `place` columns and `contact_place`; nothing reads them yet.
2. **Each address row with a street** → one place `kind = address` (12 rows). Rows with the same street + postcode + city (the `sameAddress` rule, spaces and case ignored) become **one** place: **1 live case, 2 cards**. Each card gets a `contact_place` link keeping its label, position and primary.
3. **City-only rows (18)** → one place each, `kind = address`, street empty, **not merged** (two people in the same city do not share a place). Empty rows (10, 1 work) → **one place each, flagged « adresse vide »** in an audit list for Pem to fill or end — never merged into one (§2).
4. **Pem's three rows** → the « Principal » becomes the address place; the « Atelier » becomes a **room inside it** (`kind = studio`, `parent_id` = Principal; the two rows hold different street lines today, so the Atelier keeps its line as a complement); the third row its own place. The creation place in the same town named like a studio **is** this Atelier (Pem: « the atelier is a small place ») and is merged into it — creation steps and periods keep pointing at it. **Nothing is moved on a guess (Pem 2026-11-23: « roughly yes, but some are upstairs now — sort it later, not now, this is huge work »):** every work keeps its address as today (Principal or Atelier). The old text becomes a **filter, « ancien repère : Atelier » (732) / « ancien repère : ville » (343)**, so the sorting can be done later, room by room, with the tidy-up session (§6). The text stays in each work's history. Counts before / after printed in the proof.
5. **Re-aim the pointers** from a mapping table (old address id → place id): `Oeuvres.place_id` (1,176 works), `work_order.place_id` (0), `shipment.place_id` (0); the 2 works without an address stay without.
6. **Rewrite** the two triggers on `contact_place` / `place` (§4), the audit rule 9, `merge_contacts` (moves links, not rows; two links to the same place merge into one).
7. **Check before swap** (in the same file, all or nothing): every work's place root is linked to its holder; counts per place equal counts per old address; no place without a name.
8. **Code switches readers** (§10) in one landing; `contact_addresses` stays read-only one release, then dropped with its own OK. Old columns `localisation_address_id`, `address_id` likewise.
9. **Storage tree** starts empty: Pem creates zones and boxes as they are labelled; works are placed as they are touched. « Sans emplacement : 1,171 » is the honest starting count.

Proof on the throwaway copy: `scripts/stress/` chains run before and after (order to a party, return from loan, stage change, merge two contacts, archive a place), counts compared.

### 7b. Written and proven on the copy (2026-11-23, after Pem's « approved, go ahead ») — local draft, not live

Two files, split so that nothing the app reads changes until the readers switch:

| File | Does | Live? |
|---|---|---|
| `supabase/sql/places_phase_a_shape.sql` | `place` columns (§3a), tree guard (no loops, root kept by the database), `contact_place` + `place_address_map` (empty, RLS team only, no anon), kinds on the 8 creation places. Name uniqueness kept for creation places only (the creation-place screen still answers « duplicate »); default kind `other` so that screen keeps working. | **applied live 2026-11-23** on Pem's « Yes, apply A » (migration `places_phase_a_shape`). Checked after: works, history, addresses, orders, places and creation steps identical (row checksums before = after); 8 places → 3 `studio`, 5 `other`, root set on all; the two new tables empty, no grant to anon; no new security advisor finding |
| `supabase/sql/places_phase_b_backfill.sql` | two functions, not called: `places_backfill_from_addresses()` (steps 2–4 of §7: one place per street line, streetless rows one each, the Atelier inside the Principal merged into the creation studio, one link per row, primary = « Principal ») and `places_check()` (read only, every count must be 0). No pointer on works / orders / shipments moves. | **not applied** — runs in the landing that switches the readers |

**Proof on the Docker copy (`supabase_db_stress`):**
- Phase A applied twice (re-runnable); works, versions, addresses and orders identical before and after (row checksums).
- Backfill in a rolled-back transaction with a fixture shaped like live (a creation studio in Pem's town, one street on 2 cards, two city-only pairs, empty rows): `places_check()` all 0; empty rows not merged; the Atelier became a studio under the Principal, kept its coordinates and took its street line as complement; Pem's primary = Principal; a second run did nothing.
- Tree: a loop refused (`place_cycle`), a duplicate code refused, an unknown kind refused; moving a meuble to another address moved its drawer's root; the app's creation-place insert still works (kind `other`) and a duplicate name is still refused; deleting a leaf creation place still works.
- The copy keeps phase A's shape (throwaway; its data unchanged).

**Not done, not proven:** phase B is not live; the readers (§10) are not switched; `Oeuvres.place_id` / `work_order.place_id` / `shipment.place_id` do not exist yet. Setting `Oeuvres.place_id` on 1,176 works fires the work's history triggers (`oeuvre_version_snap`, `trg_zz_oeuvre_history` run on every update) — **1,176 version rows** unless the landing writes it another way: to decide with the reader switch (phase B, step 2).

---

## 8. Scenario — steps Pem can check

**Desk**
1. Lieux (new entry under Contacts, or a tab beside the map): the tree — Principal › Atelier › rooms and zones, with the floor plan beside it. Pem clicks « + Lieu » under Atelier: kind « zone », name « Mezzanine », code suggested « M ». Saves.
2. Under Mezzanine: « Meuble à plans 2 » (furniture, « M-2 »), then « Tiroir 4 » (container, « M-2-4 »), photo dropped in, « fragile » ticked.
3. Selects 14 small works in Inventory → « Ranger dans… » → types « M-2-4 » → 14 moved. The drawer shows « 14 œuvres · fragile ».
4. « Imprimer l'étiquette » and « Feuille de contenu » → one PDF each.
5. Types « 5x7 » in ⌘K → 3 works; the second one reads « Atelier › Mezzanine › Meuble à plans 2 › Tiroir 4 » with **M-2-4** in large type. Click → the box page.
6. Opens a gallery's card → Adresses: the gallery address shows « aussi : 1 autre personne · 3 œuvres gardées ici ». « Retirer » on the director's card ends her link; the place and its 3 works stay.
7. Inventory filter « Sans emplacement » → the count goes down by 14.

**Phone (iPhone SE, 375 px)**
1. Home → Rechercher → « 5x7 » → the result card shows the path and **M-2-4**; tap the photo → the drawer's photo.
2. Tidy-up: Home → Scanner → camera on the box label → box page « M-2-4 · 14 œuvres · fragile » → « Ranger ici » → scans 3 works → three lines « #1234 → M-2-4 (était : Atelier, sans emplacement) » → « Terminer ».
3. Scans a work's back label anywhere → its card, path on top, « Changer d'emplacement ».
4. No signal in the cellar: the scan is refused with « pas de réseau — réessayer » (no offline queue in this build; §12 Q8).

---

## 9. What Pem sees change

- The work card's « Adresse » line becomes « Où » with the path; editing it opens one picker (search a code or a name; addresses of the holder first).
- The contact editor's Adresses tab = links to places (People §4d).
- A new « Lieux » list (desk) and box pages (desk + phone).
- Labels and contents sheets for boxes.
- Nothing disappears: today's two Pem addresses are still there, with the same names.

---

## 10. Flow trace — every reader (input → writers → triggers → readers)

**Input:** a place created or edited; a person linked / unlinked; works placed; a box moved; a place archived.
**Writers today → after:** contact editor (browser, `ContactEditorPanel`), quick contact modals (`ContactQuickModal`, `NewContactModal`, `ContactsTab`), `contacts/actions.ts` (import, quick add, merge), work form / drawer / phone record (`WorkForm`, `DrawerContent`, `WorkRecordPhone`, `LocationAddressPicker`), batch edit (`BatchEditModal`), selection actions (`selection/actions.ts`), work create (`lib/work-create-core.ts`, `works/new/page.tsx`), `works/actions.ts` (`saveWork`), orders (`orders-actions.ts` moves works and sets the address), cascade (`cascade-actions.ts` shipments), creation places (`period-source-actions.ts`, `PeriodSourceManager`), AI card (`ai/actions.ts`), supplier hub (`SupplierHub`) → **all through the doors of §5** (contacts through `saveContact`, which calls the link door).
**Triggers:** `oeuvre_location_by_stage`, `contact_address_link_single` (rewritten, §4), `graph_place_text_dirty` + `oeuvre_search_text` (now also read the path / code), version trigger on works, `merge_contacts`.

| Reader | Changes? | What |
|---|---|---|
| Work drawer + card (`DrawerContent`, `WorkCardLogistics`, `drawer-content-props.ts`) | **yes** | « Où » path, picker, fragile flag |
| Work form + phone record (`WorkForm`, `WorkRecordPhone`), `LocationAddressPicker` | **yes** | one place picker (holder's places first, then the tree) |
| Pending changes (`lib/work-pending-keys.ts`, `audit/pending-actions.ts`) | **yes** | key `localisation_address_id` → `place_id`; approval replays `saveWork` |
| Version history (`WorkVersionHistory`, `lib/oeuvre-version-fields.ts`), restore | **yes** | shows the path; restoring an old address id maps through the migration table |
| Audit rules (`rules-actions.ts`, `lib/work-rules-checks.ts` rule 9) | **yes** | « root linked to holder »; new list « adresse vide » |
| Inventory (`Inventory.tsx`) | **yes** | column « Emplacement », filters place / size / sans emplacement / fragile; counts asked of the database |
| Batch edit (`BatchEditModal`), selection actions | **yes** | « Ranger dans… » through `placeWorks` |
| Shell props (`load-atelier-shell-props.ts`, `atelier-data-actions.ts`, `TeamPortalClient`) | **yes** | address map → place map (only top-level places + Pem's tree; not the whole tree on first paint) |
| Overview counts (`OverviewTab`, `lib/atelier/overview-counts.ts`) | **yes** | « par adresse » reads place roots; new count « sans emplacement » |
| Map (`WorldMapTab`) | **yes** | « Œuvres » mode places a work at its root's coordinates (geocoded once and stored on `place`, not per visit); « Création » mode unchanged; stops reading `LocalisationDetail` |
| Orders: list, new, party address, move works (`orders-actions.ts`, `NewOrderForm`, `Orders.tsx`) | **yes** | `place_id`; party's places offered; rule 4 |
| Order / invoice papers (`cascade-actions.ts` `partyBlock`, `order-paper`) | **yes** | address lines from the place (+ complement); Pem's own block = the « principal » link |
| Shipments (`cascade-actions.ts`) | **yes** | `place_id`; grouping by place |
| Mobile sale (`sale/new`) | yes | same party place picker |
| Contacts tab + editor + merge (`ContactsTab`, `ContactEditorPanel`, `merge_contacts`, `lib/deleted-contact-refs.ts`) | **yes** | links, « aussi : n autres personnes », merge moves links |
| AI card (`ai/actions.ts`), supplier hub | yes | address creation through `savePlace` |
| Creation places (`period-source-actions.ts`, `PeriodSourceManager`, `ChronologieTab`, `WorkCreationHistory`, `lib/time-place.ts`, `lib/work-periods.ts`) | small | delete → archive; list filters `kind` (creation places = `studio` / `address` / `motif` with steps) |
| Reports (`lib/reports/works-table.ts`, `report-sources.ts`) | **yes** | « Emplacement », « Adresse » (root) columns; drop `LocalisationDetail` |
| Labels (`selection/actions.ts`) | **yes** | work label may print the box code; new box labels + contents sheet |
| Scan (`/atelier/scan`, `lib/mobile/parse-work-id-from-scan.ts`, hub tile) | **yes** | reads `/atelier/p/<code>` too |
| Search (`oeuvre_search_text`, ⌘K, phone search) | **yes** | path, code, size grammar « 5x7 » |
| Insurer's list (§14.2, not built) | new | per place / subtree |
| Archive export (`scripts/archive-export.mjs`) | yes | `place` public part (path, code) in the archive; `contact_place` with the private tables |
| Stress chains (`scripts/stress/*.mjs`), generated types | yes | new columns |
| Exhibitions (`ExhibitionDetail`, `ExhibitionFloorPlanEditor`, `FloorPlanTool`, `exhibitions-types.ts`) | **yes** | venue = place; the editor also draws `place.plan` |
| Vault (`vault/actions.ts`) | yes | `document.place_id`: photos and papers of a place |
| Remarks (`note_line` readers: work notes, Journal day page) | yes | `target_kind = 'place'`; the day page shows conservation checks |
| Periods (`lib/work-periods.ts`) | read | storage hints by period (§6c) |
| Constellation / graph | **open** | §6d — nothing until discussed |
| Public site, collector pages, kits | no | never show a storage place |
| Journal | no | (a « rangé dans M-2-4 » line may later appear on the day page as a read of the version history — not in this build) |

To be confirmed by a `scout` pass and the `flow-reviewer` at build time: every file above was found by grep on `localisation_address_id`, `contact_addresses`, `LocalisationDetail`, `address_id`, `place_id`, `from('place')` (2026-11-23).

---

## 11. Order of building (after the freeze, nothing promised before)

1. People's `saveContact` door lands first (it already plans the place links).
2. One SQL file (§7) on the Docker copy → proof → live with its own OK. Readers switched in the same landing (§10).
3. Lieux list + box page + path bar + picker + « Ranger dans… » + floor plan (desk and phone together, same reads).
4. Box labels + contents sheet; photos, risky spots, conservation notes; access steps.
4b. After People's `moment` lands: the « aller chercher » sheet (PDF) as a moment, authorised people and levels, who knows which code, « Sorties en cours ».
5. Phone: search path, scan box, tidy-up session.
6. Size search « 5x7 » (inches first); storage hints.
7. Later: insurer's list, exhibition venues on places, motif places; Constellation after the talk of §6d.

---

## 12. Pem's answers (2026-11-23) and questions left

| # | Question | Answer | Where |
|---|---|---|---|
| 1 | Principal and Atelier | « One is bigger and comprises the other » → Atelier = a room inside the Principal | §4.2, §7 step 4 |
| 2 | Creation place « studio » = studio address? | « The atelier is a small place » → read as: the same small Atelier; merged | §7 step 4 |
| 7 | « 5 × 7 » | Inches | §6 |
| 10 | Drop « LocalisationDetail » | « Are we going to lose the two values? » → **no**: they place the works at migration and stay in the history | §3c, §7 step 4 |
| 12 | Studio map | Floor plan wanted → first build | §6a |
| — | Desk view « more streamlined? » | Yes → one path bar, quieter tree | §6 |
| — | Phone gets less? | No — same read, stacked | §6 |

**Second round (2026-11-23):**

| # | Question | Answer | Where |
|---|---|---|---|
| 13 | 729 « Atelier » works really in the Atelier? | Roughly, some upstairs now — sort later, not now | §7 step 4 (filter, nothing moved) |
| 14 | Studio creation place = this Atelier? | Yes, about 9–10 m² | §7 step 4 |
| 15 | 28 streetless rows, one place each | OK | §7 step 3 |
| 16 | Codes « M-2-4 » | Yes | §6 |
| 17 | Box labels | Bigger format than work labels | §6 |
| 18 | Out for a day: remember the box | « Of course » → `Oeuvres.home_place_id` (its usual box), set when it goes out, cleared when scanned back; « sorti de M-2-4 » shown everywhere | §3c, §6e |
| 19 | No signal | Save later → no phone queue; a refused scan says so | §8 |
| 20 | Team moves boxes | Yes, quiet note in the Fil | §5 |
| 21 | Galleries, fairs | Yes — galleries are legal persons (cards), their rooms are places | §6d |
| 22 | Conservation | Warnings with before / after, listed | §6b |
| 23 | Storage hints | « What is best? » → size, then numbers, period as colour | §6c |
| 24 | Constellation | Now → proposal: made at / motif / shown at yes, storage and homes never | §6d |
| — | Import or draw the plan? | Import a picture, mark the spots in the hub | §6f |
| — | Getting there, who goes | The access route + every sheet recorded | §6e |
| — | The file | PDF | §6g |

**Third round (2026-11-23):**

| # | Question | Answer | Where |
|---|---|---|---|
| 25 | Recording a sheet | It is a moment for the person, a task to complete | §3c, §6e |
| 26 | Who may go | Authorised people, with levels | §6e |
| 27 | Constellation | Add storage as a place type; don't confuse with the map | §6d (storage layer off by default; three views table) |
| 28 | Size → numbers → period colour | Yes | §6c |
| 29 | Door codes | On the sheet; record that the person knows the code from then on | §6e |
| 30 | Plan engine | Any plan, in transparency under the Exhibitions plan tool | §6f |
| 31 | « Sorties en cours » | « Whatever's best » → Atelier page always, Fil only when late | §6e |
| 32 | Levels accompagné · code · clé · équipe | OK | §6e |
| 33 | When is « late » | Past its date is late, from day one → every sheet has a return date | §6e |
| 34 | Build order: boxes, plan, scan first; the sheet after `moment` | OK | §11 |

**Fifth round (2026-11-23, after phase A went live):**

| # | Point | Answer | Where |
|---|---|---|---|
| 35 | Lac du Peiroo, Aureille, Les Baux | Motifs | relabelled `motif` — **live 2026-11-23** |
| 36 | Rutali, Paris | Places where Pem worked | relabelled `address` — **live** |
| 37 | Rutali's town reads « 20239 » | A postcode should find the place | postcode 20239, town Rutali — **live**; §6i for every new entry |
| 38 | Marseille → France | Automatic | §6i |
| 39 | Atelier = the only room in Principal? | No: flat with works on the walls, the Atelier, a gated 6th-floor store with mostly the oils on linen; supplies stay in the Atelier | §6h |
| 40 | « Duplicate » for creation places | A name is not a place; Paris holds many places | §6j — name rule dropped — **live** |

Live fixes: migration `places_phase_a_fixes` ([`places_phase_a_fixes.sql`](../../../supabase/sql/places_phase_a_fixes.sql)). Checked after: 8 places (3 studio, 3 motif, 2 address), 13 creation steps and 4 periods still point at them, works unchanged (same checksum as before phase A), `place` keeps only its key, code and tree indexes.
