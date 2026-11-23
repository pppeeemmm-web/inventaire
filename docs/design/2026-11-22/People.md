# People on one page — design (2026-11-22)

Status: **local draft**, uncommitted, design only: no SQL. Pem answered every question 2026-11-23 (§11). The §0 fix is code, done on Pem's GO.
Read for this page: root `CLAUDE.md`; [`BuildingPrinciples.md`](../2026-11-21/BuildingPrinciples.md); [`MasterPlan.md`](../2026-11-20/MasterPlan.md) §1.1, §2, §5; [`Survey_ContactsCare.md`](../2026-11-21/Survey_ContactsCare.md), [`Survey_LinksDigests.md`](../2026-11-21/Survey_LinksDigests.md); [`CatalogueGaps.notes.md`](../2026-11-19/CatalogueGaps.notes.md) E and I; [`ContactsReview.notes.md`](../2026-11-18/ContactsReview.notes.md); `docs/TODO.md` §3. The Journal design of today (main checkout, `JournalDesign.md`) for its `@person` links.
Code read: `app/atelier/(portal)/contacts/actions.ts`, `components/atelier/ContactEditorPanel.tsx` (save path), a scout list of every writer and reader (§7). Live database read only, 2026-11-22: foreign keys, triggers, RLS policies and counts — no names or other personal data copied here.
Mockup: [`People_Mockup.html`](./People_Mockup.html) — desk and phone side by side, clickable, invented people.

---

## 0. Found while surveying — a data-safety bug (today, not a design question)

**Saving a contact in the editor deletes and rewrites all its addresses, emails, phones, websites and socials** (`ContactEditorPanel.tsx:444-449` then inserts at `:464-507`), from the browser, with the five deletes' errors never checked. Address rows get **new ids** on every save. Three columns point at an address and are `ON DELETE SET NULL`: `Oeuvres.localisation_address_id`, `work_order.address_id`, `shipment.address_id`.

- **Pem's own card** (id 13) holds **1,171 works**, all pointing at its 3 address rows. One Save of that card in the editor would set those 1,171 pointers to null: the stage trigger cannot pick an address while the rows are gone, and the single-address relink skips id 13 by design. Each of those works also gets an update (version row, triggers). **Not happened yet**: all 1,171 are still linked today.
- A holder with **two or more** addresses loses the pointer the same way (one live: 2 works, already without an address). A holder with one address is repaired by `contact_address_link_single` on reinsert.
- Order and shipment addresses would always be lost (0 live today).
- Also: if a delete fails and the inserts succeed, the rows are doubled.

**I cannot prove which of these happens on a real Save without running it on the throwaway copy;** the reasoning is from the live trigger and FK definitions.

**Fix (Pem 2026-11-23: « fix it yes ») — local draft, uncommitted in this worktree:** `ContactEditorPanel.handleSave` now writes the five child tables by id (`syncContactRows`): kept rows updated in place, new rows inserted, removed rows deleted, every error stops the save. Removing an address that a work, an order or a shipment still uses is refused before anything is written, with one sentence (`contact_editor_addr_in_use_fmt`). **Interim:** this refusal is the safety net until addresses become shared places (§4d — SQL with its own OK); then « Retirer » only unlinks the person, the place stays, and nothing is refused. Still from the browser and not one transaction — the door of §3 replaces it later. Typecheck and i18n check pass; not run against a database.

Two smaller findings: quick add writes duplicate hints into `contact_conflicts`, **a table that does not exist live**, and swallows the error (`actions.ts:512`, `isSupabaseMissingTableError`) — the duplicate hint for private cards never reaches anyone. And **five browser files write `Contact`** (`ContactEditorPanel`, `ContactsTab:587`, `WorkForm:1449`, `PipelineProcessModal:235`, `DrawerContent:1574`).

---

## 1. Kind, home, what changes (principles first)

| | Answer |
|---|---|
| **Kind** | A person or an organisation, and what happened between them and Pem's works over time. |
| **Home** | The person: `Contact` + its five child tables (exist). What happened: the records that already have a life keep their tables (orders, payments, shipments, events, kits, papers, enquiries, journal links); the dated facts with no life — « touches » — get the one new office table the master plan already names, `moment`. A link between two people or a person and a work: `tblrelations` (the graph, where contact nodes already live). Spheres / tags: `contact_tag` (new). Addresses: shared places — `place` (exists) + a person ↔ place link (new), §4d. |
| **What changes** | One server door for a contact (`saveContact`) replaces six browser writers. One door for a touch (`saveMoment`). The person page is **reads only**: works by relation, a timeline (union of existing tables + touches, paged by date), counts asked of the database. Phone gets a person page it does not have today (no contact view in `/hub`). |

Why each new store (principle 8 — « a new table says why no existing one fits »):

| New | Existing homes checked | Why none fits |
|---|---|---|
| `moment` (touches) | `journal_entry` | The notebook, Pem's own, append-only, private by author; the office must never mix into the notebook (master plan §0). A touch is written by the team for Pem, names several people with roles, works and a paper. The Journal **reads** touches on the day page (one stream, principle 9) — a read, not a copy. |
| | `studio_task` | Something to do, not something that happened. |
| | `suivi_process` | Has a life (steps, dates, reminders). A call is one fact. |
| | `document` | A paper. A touch may point to one. |
| | `inquiry` | Incoming site form only; no people with roles, no works list. |
| | `tblrelations` | A standing link, no date / summary / paper. |
| `contact_tag` | `working_group` | Groups are for works and business packages (Pem: themes = creation, groups = business). |
| | `Type`, `TypeContact`, `Role` on `Contact` | Three single-value text / int fields (filled on 61, 11, 58 cards) — one value each, no list, no filter. Tags replace all three. |
| *(none)* person ↔ person, person ↔ work | `tblrelations` | **Fits**: contact nodes exist (61), the graph already holds 2,357 machine links touching contacts (owner, holder, buyer). New human types (`introduced`, `works_at`, `spouse`, `advises`, `interested_in`) + the author / proposal columns Survey 5 asks for anyway. No new table. |

---

## 2. What exists live (counts, 2026-11-22, no personal data)

| Relation | Live |
|---|---|
| Contacts | 61 (32 private, 26 institutions, 3 team, 3 with a login, 1 inactive) |
| Child rows | 40 addresses · 31 emails · 62 phones · 12 websites · 4 socials |
| Works by person | owner: 7 people, 1,178 works · holder: 7 people, 1,178 works (1,171 on Pem's card) · buyer: 1 person |
| Orders (`work_order.party_id`) | 9 orders, 6 people; 0 with an address |
| Payments · shipments · invoices · supply orders | 0 · 0 · 0 · 0 |
| Events (`event_contact`) | 0 · process with a contact: 1 of 5 |
| Kits (`private_link`) | 0 |
| Enquiries (`inquiry`) | 4 — **no contact column** (name + email only) |
| Papers / expenses with a contact | 1 / 1 |
| Stock items with a supplier | 137 |
| AI card readings (`ai_job` kind card) | 1 |
| Calendar links | 0 |
| Journal links | 91 (works / ideas only; `@person` comes with the Journal step B) |
| Graph | 61 contact nodes; 2,357 links touching them, all machine types (`owner`, `located_at`, `buyer`) |
| Touches | **no home** |

**Plainly:** apart from Pem's own card, the office has almost no case yet (master plan §0). The person page will look empty for most people until touches are recorded. The design is built so that the first real case fills it without a rebuild; the proof is the mock year on the Docker copy.

---

## 3. The door for a contact — `saveContact`

**One server action → one SQL function, one transaction.** Every writer goes through it: the editor, quick add, the work-card « new contact », the pipeline modal, the order party picker, supply orders, card capture, Google import, web-address fill, the AI card « open and check », share-triage notes, team access. The browser writes no contact table (principle 2; today 5 browser files).

**Input** — the whole card as the screen sees it:
`{ id | null, read_stamp, fields: {…}, emails: [{id|null,…}], phones: […], addresses: […], websites: […], socials: […], tags: [...], confirm_new?: true }`

**What it does, in order, inside one transaction:**
1. **Who asks.** Signed in and team, else refused `forbidden`. Admin-only fields — `is_private`, `is_team_member`, `is_admin`, `auth_user_id`, `signature_r2_key` — refused for the team (`admin_only`), never silently dropped (principle 3). `protect_admin_flags` stays as the backstop.
2. **Stale check.** The card carries the values it read; the function writes a field only if it still holds them (same rule as the work card, commit 2fc1c0e). Else `stale`, with the fresh card, nothing written.
3. **Duplicates on create.** Same email, or same family + first name, among all cards (private included, read with the function's rights) → `possible_duplicate` with the visible candidates (a private match says only « a confidential card may match — Pem will see it »). `confirm_new` creates anyway and records the hint for Pem (in a working table — the one the code writes to today does not exist).
4. **Child rows by id; a person never owns an address (Pem 2026-11-23: « an address never disappears … more people can share the same address »).** Unchanged rows untouched; changed rows updated **in place, same id**; new rows inserted. Emails, phones, websites and socials that the form drops are deleted (nothing points at them). An **address is a place of its own** (§4d): the card links the person to places; « Retirer » on the card **unlinks this person** from the place, and the place stays — for the other people who share it, and for every work, order, shipment and paper that names it.
   In plain words: Claire and her husband, a gallery and its director, a venue and its staff — one address, several people. Today each card keeps its own copy (live: 1 street typed on 2 cards, 2 city-only lines on 2 cards each, and an empty line on 10 cards — [Places.md](../2026-11-23/Places.md) §2). After the change there is one place, and people point to it with a role (lives here, works here, works kept here, deliveries). If Claire moves out, her link to the country house ends; the house is still there for her husband and for the 3 works kept there; the 2025 shipment still says where it went. A place nobody uses any more is archived, never deleted.
5. **One primary per kind** (email, phone, address) — kept by the function; the legacy mirror columns (`Email`, `Téléphone1`, `Adresse`, `Ville`, …) are written from the primaries here, until their readers move to the child tables.
6. **Formats** (ContactsReview decisions): phone stored E.164, label as a key from the fixed list; an unparseable number kept as typed and flagged.

**Output** — the truth, never « ok » for nothing:
`{ ok: true, contact: <the card as now stored, child rows with their ids>, changed: ['Notes', 'phones'] }` · `{ unchanged: true }` · `{ refused: 'forbidden' | 'admin_only' | 'stale' | 'possible_duplicate' | 'address_in_use' | 'not_found', detail }` — every code has a FR / EN sentence.
No `revalidatePath('/atelier')`: the caller updates its one card (principle 6). The shell's address list is refreshed from the returned card (fixes the stale address list of ContactsReview §6).

**Team edits (Pem 2026-11-23: « saves directly, then secretly warn the change »):** a team save is written at once; in the same transaction the door writes one `system_log` row (exists: `table_name`, `row_id`, `old_value`, `new_value`, `author_id`) with what changed, before → after. Pem's Fil shows « Contact modifié par X — champ : avant → après » with « Vu » and « Revenir » (Revenir = one more save through the door with the old values). Admin-only read; the team sees nothing. An admin's own saves are not logged to the Fil. **The same holds for every team change to a person** — archive, recall, a death recorded, tags, links (Pem 2026-11-23: « any change fed into my feed, so I can check and discard it if necessary »).

**Delete = archive (Pem 2026-11-23).** « Supprimer » becomes **Archiver**: the person leaves the lists and pickers, everything they touched stays (moments, orders, works history, papers), and **Rappeler** brings them back. New on `Contact`: `archived_at`, `archived_by` (the old `Actif` flag folds into it; 1 card inactive live). **Seen afterwards (Pem 2026-11-23):** inside old records (orders, moments, papers on screen) the team sees « une personne archivée »; an admin sees the name, marked « archivée ». Papers already issued are not rewritten. A true delete stays for two cases only, admin: a duplicate (that is a **merge**, which already exists) and a GDPR erasure request (the name and details wiped, the records kept without them).

**A person who has died (Pem 2026-11-23: « some contacts will pass away; we need to bear this in mind »).** Not an archive: they stay in the lists. **Anyone may record it**, and it reaches Pem's Fil like any team change, with « Revenir ». New on `Contact`: `died_on` + precision (year / month / day), next to the birth date. Shown « † 2031 » beside the name; the timeline shows the death on its date (read from the field, not a separate record); birthday reminders stop; papers and provenance lines write « feu Claire VASSEUR » / « the late … » (COA, kits, catalogue: « collection de feu … »). Works they owned or held keep them as owner / holder until the estate is settled — the custody change is an order or a custody move, as today.

**Merge** keeps its door (`merge_contacts`) and learns the new stores: tags, moment participants, graph links, the archive and death fields.

---

## 4. Where touches live — `moment` (after the pause)

As sketched in master plan §1.1, held to « who × which works × when × kind × paper »:

- `moment`: date + precision (day / month / year), kind, channel (phone, mail, studio, site, calendar…), a short summary (FR text as typed or dictated), private flag, a paper (`document_id`), source + external id (a gate never writes twice), created by, created at.
- `moment_person` (moment, contact, role) and `moment_work` (moment, work) — one touch names several people and works.
- **Kinds, short and fixed** (Pem 2026-11-23: OK), each added when a real case needs it: call · studio visit · meeting elsewhere (a fair, an opening — where most first meetings happen) · mail in · mail out · introduction · press mention · thank you · other. A kit sent, an order, a payment, a death are **not** touches: they already have their records or fields and appear in the timeline as such.
- **Door `saveMoment`**: anyone signed in records (Pem: « anyone »); private only by an admin; all or nothing (the moment and its people and works together); a correction keeps the original (same rule as the Journal).
- **Home decided (Pem 2026-11-23: « as you see fit »): its own table `moment`**, read on the Journal day page — the office stays out of the notebook, the day page still shows everything (one stream).

### 4d. Addresses are shared places (Pem 2026-11-23)

The master plan's « places — one shared resource » (§1.1 b) is the home; People uses it instead of addresses under each card.

- **`place`** (exists, 8 creation places today) becomes the one store: a street address, a venue, a storage loft, a studio zone (§15.2 of the master plan: storage locations are child places of the studio). Columns added: street, postcode, city, country (some exist), parent place, archived at. Never deleted.
- **`contact_place`** (new link): person, place, role (`home`, `work`, `works_kept`, `delivery`, `other`), primary flag, since / until (optional — a move keeps the old link with an end date, so history stays).
- Works, orders and shipments point at the **place** (today `contact_addresses.id`). The custody rule « the address belongs to the holder » becomes « the holder is linked to that place ».
- **Migration (one SQL file, its own OK, proof on the Docker copy):** each of the 40 address rows → a place, identical lines merged (same street + postcode + city — the rule `sameAddress` already uses), the 34 + 6 links recreated, the three pointers re-aimed. Flow: custody triggers (`oeuvre_location_by_stage`, `contact_address_link_single`), merge, order papers, shipments, map, Inventory, LocationAddressPicker, audit rules.
- The editor's « Adresses » tab: each place shows who else is linked (« aussi : Galerie Lumen, Inès DUVAL ») and what is kept there; « + Adresse » first searches existing places: type the street → « adresse déjà connue — la reprendre ? ». Reusing it **only shares the address, never a household**: the role is asked every time and has no default (lives here · works here · works kept here · deliveries · other), so a new contact at a gallery's address is « works here » or « deliveries », never « lives with » anyone. The suggestion does not show who else is linked (a private card stays private). Same building, different flat or floor → « Non, une autre adresse » or a complement line (bâtiment, étage, appartement): a separate place. The other people linked to a place appear only on the place's own read, for those allowed to see them.

### 4b. « Interested in » — always with where it came from (Pem 2026-11-23)

Pem: track **where the interest comes from**, to see whether kits and visits are useful. So an interest is a link person ↔ work that always carries its **source**: `kit` (which kit), `visit` / `meeting` / `call` (which moment), `event` (which event), `enquiry` (which enquiry), `said` (Pem or the team noted it, no source record). Stored as a human graph link (`tblrelations` type `interested_in` + source kind + source id + author); a sale that follows is already in the orders.

The read it makes possible — **« Ce qui sert »**, one table per source kind, counts asked of the database:

| Kit / visit / event | People reached | Interests | Sales after (12 months) |
|---|---|---|---|
| Kit « Lisières 2026 » | 1 | 2 | 0 |
| Studio visits (all) | 6 | 4 | 1 |

On the person page the « Intéressée par » strip shows each work with its source as a small badge (kit, visite, demande…).

### 4c. Who's who — the value map of people (Pem 2026-11-23)

Person ↔ person links (kinds confirmed: introduced by · spouse · works at / directs · advises · works with) are graph links, so « who knows whom » is a **read**: a people layer in the existing map (Constellation), each person a dot sized by what passes through them (introductions made, works held, interests, sales), lines by kind. Later, after the links exist — a view, no new store.
- **Typed links, one grammar for the whole app** (Pem 2026-11-22, see §8): in the summary, `@name` picks a person, `#title` picks a work or an idea — real links written to `moment_person` / `moment_work`, not text.

---

## 5. The person page — reads only

| Block | Read | Notes |
|---|---|---|
| Header | `Contact`, `contact_tag` | Name (desk: « Claire VASSEUR »; lists: « VASSEUR Claire », family-name sort), role, tags, 🔒 private. |
| Works | `Oeuvres` (owner, holder, buyer), kit works, event works, touch works, `tblrelations interested_in` | Five strips: owns · holds · bought · seen (kits, events, visits) · interested in. Counts from the database. |
| Timeline | **`person_timeline(contact_id, before, limit)`** — one SQL read, a union: touches · order steps + payments · shipments · event membership (process dates) · kits sent / opened · enquiries · papers · journal entries **written by** the person (author = a team member's login, linked to their card through `Contact.auth_user_id`) and entries that **link** them (`@`), ideas they planted included (`idea_plant` writes the planting as an entry — IdeasDesign.md §2) · custody / ownership changes from work versions · the death date | Keyset by (date, kind, id), 20 per page, « Charger plus ancien ». Kind chips with counts from one count query, each chip in its kind's colour (the same colour as the card's bar). Private rows only for admins. |
| Enquiries (Pem 2026-11-23: « link them ») | an enquiry whose email matches a card's email is linked to that person automatically (new `inquiry.contact_id`, set by the enquiry door, shown « relié par l'email », undoable); no match → it waits as today, « + Personne » creates the card through `saveContact` | The gate rule « never creates a contact by itself » holds: it only links to an existing one. |
| Rail (desk) / « Coordonnées » (phone, folded) | child tables, person ↔ person links, birthday, notes | Click to call / mail / map. |
| Care | birth date (new field), `studio_task` + contact link | Memory first: no reminder unless asked; two rules at most (enquiry unanswered 3 days, birthday in 7 days) — later, master plan §1.2. |

The **work card** gets the mirror block « Personnes » (the same union read, by work) — later, same function family.
The **Journal day page** reads the day's touches (one stream) — a read, the Journal session's design names « Dans le Journal » backlinks on the contact page, which this page uses.

---

## 6. Scenario — steps Pem can check

**Desk (Windows, Atelier → Personnes)**
1. Open Personnes. The list shows « VASSEUR Claire », sorted by family name, 🔒 on private cards, tag chips above (collector, gallery, curator, press, artist, supplier, thinker). Pick « collectionneur »: only those.
2. Click a person. The middle shows their works in five strips and the timeline, newest first, with day dividers; the right rail their details, links to other people, birthday, notes.
3. Click the chip « Commande 3 »: only orders. « Tout » again. Scroll to the end: « Charger plus ancien » brings the next 20.
4. Press **+ Moment** (the one coloured button). Pick « Appel », type « veut revoir #Lis… » → pick the work, « @Hug… » → pick the person. Enregistrer. The call is on top of both people's timelines and on today's Journal page.
5. Press **Modifier**. Four tabs: Identité · Adresses · À propos · Relations. Remove the address where three works are held → refused in words, nothing saved, with « Déplacer les 3 œuvres… ». Change a note, Enregistrer → « 1 champ changé ».
6. Two tabs open on the same card, both save → the second gets « changed meanwhile », the fresh card, nothing overwritten.
7. **⋯ → Archiver**: the person leaves the list; the filter « Archivés » shows them; **Rappeler** brings them back. Nothing they touched is lost.
8. A person marked « † 2031 » stays in the list with the cross; their timeline ends on that date.

**Phone (iPhone SE, 375 px — ☰ → Personnes: the same Atelier contacts page in its phone face, no separate `/hub` page)**
1. A search field and tag chips (wrapping on two lines, no sideways scroll); each row a name, role, date of the last touch. **+ Moment** sticky at the bottom.
2. Tap a person: name, two large buttons (Appeler · Écrire), works as one horizontal strip (the only sideways scroll), the kind chips wrapping in their colours, details folded (tapping an address opens the phone's Maps), timeline below.
3. **+ Moment** opens a sheet from the bottom: « ● Dicter » first, kind chips, date, the line with `@` / `#`. Enregistrer — it is on the person and on today's Journal page.
4. ✎ opens the same editor as a sheet, same door, same refusals.

Check at 375 px and ~360 px: no side scroll, taps ≥ 44 px, sticky bar above the home indicator.

---

## 7. Flow trace — every reader that changes

Writers today → after: `ContactEditorPanel` (browser, 6 tables), `ContactsTab:587`, `WorkForm:1449-1457`, `PipelineProcessModal:235`, `DrawerContent:1574` (browser) · `contacts/actions.ts` (import `:78-143`, quick add `:481-512`, delete, merge), `team-actions.ts:52,127`, `stock/supply-order-actions.ts:340`, `share-triage/actions.ts:303`, `sign/actions.ts:36`, `lib/contacts/persist-primary-email.ts`, card commit (`capture/card-actions.ts`), scripts `link-auth-contact`, `link-contact-id`, `clear-contact-auth-link` (service role, admin tools — keep, listed in the runbook) → **all through `saveContact`** except delete / merge (own doors) and the scripts.

Triggers on the path (live): `ensure_admin_flags_protected`, graph node register / unregister / embedding dirty on `Contact`; `trg_contact_address_link_single` on `contact_addresses`; on works `oeuvre_location_by_stage` (reads addresses). Ids kept by the door → none of them fires for nothing.

| Reader | Changes? | What |
|---|---|---|
| Contacts tab list + editor (`ContactsTab`, `ContactEditorPanel`, `ContactKitsSection`) | **redrawn** | person page, four-tab editor, door result |
| Shell address / contact maps (`TeamPortalClient`, `atelier-data-actions.ts:227`) | yes | refreshed from the door's returned card |
| Work card: owner / holder / buyer, quick modal, new contact (`WorkCardLogistics`, `ContactQuickModal`, `NewContactModal`, `DrawerContent`, `WorkForm`, `LocationAddressPicker`) | yes | create through the door; « Personnes » block later |
| Inventory (`Inventory.tsx:97-242`), Curation, Compare | no (address ids now stable) | — |
| Orders: party, address, cascade, papers (`orders-actions.ts`, `cascade-actions.ts`, `Orders.tsx`, `NewOrderForm`, `order-paper.ts`) | no | party picker « + Nouveau » through the door |
| Mobile sale (`sale/new`) | no | same |
| Events (`event-actions.ts`, `EventPeople`) | no | their rows appear in the timeline (read) |
| Kits (`kits/actions.ts`, `app/c/[token]`) | no | timeline read |
| Supplier hub, stock take, supply orders, exports | create path only | through the door |
| Map (`WorldMapTab:395`) | no | — |
| Reports, pivots, audit rules / pending (`report-sources.ts`, `rules-actions.ts`, `pending-actions.ts`) | tags | `Type` / `Role` pivots move to tags when tags land |
| Search, graph (`node_search_text`, embeddings) | tags, bio | add tags / bio to the search text when they exist |
| Journal (step B `@person`) | **new link** | timeline reads validated `@` links + entries authored by the person; Idées plantings; Journal day reads touches |
| Fil (`fil/actions.ts`) | later | « enquiry unanswered » rule, if Pem wants it |
| AI card suggestion (`lib/ai-card-suggestion.ts`, `ai/actions.ts:146`) | yes | « Ouvrir et vérifier » saves through the door |
| Public collector / gallery pages, page views, session user, calendar sync | no | — |
| `merge_contacts`, `deleteContacts` | **yes** | learn tags, touches, graph links |
| Phone `/hub` | **new** | person list + page + moment sheet (none today) |
| Archive export (`npm run archive`) | later | add touches when they exist |

---

## 8. One link grammar for the whole app (Pem 2026-11-22: « a general rule for the whole project »)

Added to `BuildingPrinciples.md` as commandment 13 (Pem 2026-11-23: « yes »):

> **Wherever text is typed, `#` links a work or an idea, `@` links a person.** Typing `#` or `@` opens the same picker everywhere (picture for a work, role for a person, alphabetical within each group); picking writes a **real link** in that record's link table, never only text. The text keeps the name as typed; renaming the work or person later does not break the link. A name that matches nothing offers « + Personne » / « + Œuvre » through their doors — never a silent new record. One picker component, one parsing rule, used by: Journal entries, touches, work notes, idea notes, Kaizen items, order and event notes.

Where the link is stored stays per home (Journal → `journal_entry_link`; touch → `moment_person` / `moment_work`; work note → `note_line` columns). Only the way to type it is shared. The `#1234` number parsing that exists stays as a shortcut.

---

## 9. Phone face, desk face (same doors)

| | Desk | Phone |
|---|---|---|
| Led by | reading and connecting: list + page + rail at once, filters, editing four tabs | taking in: « + Moment » by voice right after a call or visit; calling and mailing from the page |
| Main button | **+ Moment** (read view) · **Enregistrer** (editor) | **+ Moment** sticky at the bottom |
| Quieter | Modifier · ⋯ (new order, kit, contact sheet PDF, merge, archive) | ✎ · Appeler · Écrire · details folded |
| Sideways scroll | none | only the works strip |
| Route | `/atelier/contacts` | the same route, phone branch (`useMediaQuery('(max-width: 767px)')`), reached from the ☰ menu tile — the phone does not need its own `/hub` person page |
| Doors | `saveContact`, `saveMoment`, `person_timeline`, counts | same |

---

## 10. Order of building (after the pause — nothing before the freeze)

0. **Now, as a §1 item:** the editor stops deleting and reinserting child rows (§0). Small, on its own GO.
1. **Shared places** (§4d): one migration, addresses → places, identical lines merged; built together with the master plan's places and storage design.
1b. `saveContact` (SQL function + action), every writer moved, the five browser writers removed. Proof on the Docker copy: two tabs, address in use, team vs admin fields, duplicate.
2. Display layer (ContactsReview phases 1–2): one name helper, family-name sort, private chip.
3. Person page with the reads that have data (works strips, orders, papers, enquiries, custody history).
4. `contact_tag` replacing `Type` / `TypeContact` / `Role`.
5. `moment` + `saveMoment` + the phone sheet; the Journal day reads touches.
6. Person ↔ person and « interested in » as human graph links (with the link author columns of Survey 5).
7. Birth date, then the two care rules, care tasks in `studio_task`.

---

## 11. Pem's answers (2026-11-23) — folded in above

| # | Question | Answer | Where |
|---|---|---|---|
| 1 | Fix the editor's delete-and-rewrite now | Yes | §0 (fix in this worktree, uncommitted) |
| 2 | Team edits | Saved directly, Pem quietly warned | §3 |
| 3 | Home for touches | « As you see fit » → `moment` | §4 |
| 4 | Kinds | OK (+ « meeting elsewhere ») | §4 |
| 5 | Who records | Anyone | §4 |
| 6 | Interested in | Always with its source — to measure kits and visits | §4b |
| 7 | Tags, fold the three type fields | Yes | §1 |
| 8 | Person ↔ person kinds | Yes — and a value map « who's who » | §4c |
| 9 | Delete | Archive, recall later; deaths recorded | §3 |
| 10 | Phone: record or read first | Dropped (both are on the page; no choice needed) | — |
| 11 | `#` / `@` commandment | Yes | `BuildingPrinciples.md` commandment 13 |
| 12 | Enquiries | Linked automatically on email | §5 |

| 13 | Archived name in old records | « une personne archivée » for the team, the name for Pem | §3 |
| 14 | Who records a death | Anyone; reaches Pem's Fil with « Revenir », like every team change | §3 |

| 16 | Removing an address | Never: an address is a shared place; a person is unlinked, the place stays | §3 step 4, §4d |
| 17 | Reusing a known address | Shares the address only; the role is always asked, never « lives with » | §4d |
| 15 | « Ce qui sert » window | One year after the kit / visit (« as you wish ») | §4b |

No question left. **Design complete — waiting for Pem's approval.**
