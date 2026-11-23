# Places phase B — build plan (2026-11-23)

Status: **local draft**, uncommitted, not live. **§§2–7 are the first plan; where they differ, §9 wins** (Pem's answers 2026-11-23: rule 1 flags instead of refusing, no address question, no « in use » refusal, floors / flats are child places).
Builds [`Places.md`](./Places.md) §7 steps 4–8, §4, §5, §10. Answers 1–40 of §12 win.
Read live 2026-11-23: function bodies of `oeuvre_location_by_stage`, `contact_address_link_single`, `merge_contacts`, `snapshot_oeuvre`, `oeuvre_history`; every trigger on `Oeuvres`, `contact_addresses`, `place`, `work_order`, `shipment`; foreign keys into `contact_addresses` and `place`; counts. Code: a `scout` pass on `localisation_address_id`, `contact_addresses`, `address_id`, `LocalisationDetail`, `from('place')`, `syncContactRows` (2026-11-23).

## 0. Scope

**In:** the switch from address rows to places, with the same functions as today: every reader and writer of the old pointers moves to `place` / `contact_place`; the database rules of §4 that apply now (1, 2, 3, 4, 5, 6, 7); the doors the switch needs.
**Out (later builds, §11 steps 3–7):** Lieux list, box pages, path bar, tree picker, « Ranger dans… », floor plan, labels, scan of `/atelier/p/<code>`, size search, storage hints, search text with path. In phase B a work still sits at an address (the storage tree is empty, §7 step 9).

## 1. Live facts that shape the plan

| Fact | Consequence |
|---|---|
| Works 1,178; 1,176 with an address. Versions 11,713 (about 1.3 kB each). | Writing `place_id` on 1,176 works = 1,176 version rows unless the snapshot trigger is off (§4 decision). |
| `oeuvre_history` only adds a line when status, fate or holder change. | It writes nothing for a place change; firing it is harmless. |
| Orders 9, none with an address; shipments 0 with an address. | Re-aiming `work_order` / `shipment` moves no data. |
| `pending_changes`: 4 rows carry `localisation_address_id`, all approved / rejected, none open. | No open payload to remap; restore and history views map old ids through `place_address_map`. |
| No database function reads `LocalisationDetail`; only `oeuvre_location_by_stage`, `contact_address_link_single`, `merge_contacts` know `contact_addresses`. | Three functions to rewrite, nothing else in SQL. |
| Rule 4 (orders) lives in the app, not in a trigger: `orders-actions.ts` `moveWorks` sets `localisation_address_id = order.address_id` on hand-over, `null` on return, and the stage trigger refills Pem's place. | Rule 4 keeps its shape: rename the column; return to Pem = `place_id null` → the stage rule puts the work at the top of Pem's stage place (« à ranger »). |
| Foreign keys from works / orders / shipments to `contact_addresses` are `ON DELETE SET NULL`; `contact_place.place_id` is `RESTRICT`. | The contact editor's « delete the rows the form removed » silently unplaces works today. Phase B: removing an address ends the link (`until`), never deletes. |

## 2. Live triggers to rewrite (read 2026-11-23)

| Today | After |
|---|---|
| **`oeuvre_location_by_stage`** (BEFORE on `Oeuvres`, columns status / Catalogué / NeedsPhotograph / LocalisationID / localisation_address_id / fate). (a) Clears an address not owned by the holder. (b) Holder ≠ Pem: fills the address when the holder has exactly one. (c) Pem: on stage change, unless Pem picked an address in the same update, takes Pem's address whose label = stage key (`atelier` / `principal`). | Same trigger, on `place_id`. (a) **Refuses** (`place_not_linked`, rule 1) a place whose root is not linked to the holder by a live link, instead of clearing silently. (b) unchanged on `contact_place` (exactly one live top-level link). (c) the stage place = Pem's live link with that label; **if the work is already inside that place's tree it stays put** (rule 2): a finished work in the Atelier stays in the Atelier, since the Atelier is inside the Principal. Pem's pick still wins. |
| **`contact_address_link_single`** (AFTER on `contact_addresses`, skips Pem): one address → given to the holder's unplaced works. | Dropped; **`contact_place_link_single`** on `contact_place` (insert / update of `until` / delete), same rule (rule 3). |
| **Audit rule 9** (`lib/work-rules-checks.ts:144`, `wr_b_address`): address owner ≠ holder. | « place root not linked to the holder », reading `contact_place`; new list « adresse vide » (the 10 empty places). |
| **`merge_contacts`**: moves `contact_addresses` rows. | Moves `contact_place` links; two live links to the same place → one (keeps the primary / the older `since`). `contact_addresses` line removed (table read-only). |
| `snapshot_oeuvre` / `oeuvre_versions` | unchanged; snapshots carry `place_id` from then on. |
| New | `place_archive_guard` (rule 5: no `DELETE` on `place`; archiving refused while works or live children are inside). Rule 6 is phase A (`trg_place_tree`, unique code). |

## 3. Flow trace — re-checked against live code

Writers (all move to doors, §5): `ContactEditorPanel` (browser), `contacts/actions.ts` (import, quick add), work form / drawer / phone record + `works/actions.ts` `saveWork`, `BatchEditModal`, `selection/actions.ts`, `orders-actions.ts` (order address + `moveWorks`), `cascade-actions.ts` (shipment insert), `period-source-actions.ts` (place insert / update / **delete**).

| Reader / writer | Change | What |
|---|---|---|
| `works/actions.ts` (`saveWork` read form 391, insert 512, update 645, pending map 672/680, select 1594) | **yes** | `place_id`; `LocalisationDetail` no longer written (still selected for the « ancien repère » filter) |
| `lib/work-pending-keys.ts`, `audit/pending-actions.ts` (94, 105, 120) | **yes** | key `place_id`; label from the place |
| `WorkForm`, `DrawerContent`, `WorkDrawerPipelineSection`, `WorkRecordPhone`, `LocationAddressPicker`, `lib/mobile/work-form-draft.ts` | **yes** | the same address picker, fed by the holder's live linked places; an old phone draft holding `localisation_address_id` drops that field on load |
| `BatchEditModal` (218, 233, 237, 380), `selection/actions.ts` (52–54, 160–161) | **yes** | `place_id`; the free-text « Détail » input removed |
| `WorkVersionHistory`, `lib/oeuvre-version-fields.ts`, `audit/version-actions.ts` `restoreOeuvreVersion` | **yes** | label `place_id`; restoring an old snapshot maps `localisation_address_id` through `place_address_map` |
| `audit/rules-actions.ts` (55, 72), `lib/work-rules-checks.ts` (39, 144) | **yes** | rule 9 on `contact_place` |
| `Inventory.tsx` (104, 119, 242) | **yes** | « Adresse » column from the place; filter « ancien repère » on the old text |
| `load-atelier-shell-props.ts` (67), `atelier-data-actions.ts` (206, 229, 264), `TeamPortalClient` | **yes** | address map → place map of top-level places + links (not the tree) |
| `overview-counts.ts` (21, 26, 70), `OverviewTab` (137) | **yes** | « sans adresse » counted on `place_id` by the database |
| `WorldMapTab` (395, 548, 557) | **yes** | « Œuvres » mode at the place's root coordinates; stops reading `LocalisationDetail` (geocode-once storage = later, §11) |
| `orders-actions.ts` (86–1217), `NewOrderForm` (218), `cascade-actions.ts` (59–612) | **yes** | `work_order.place_id`, `shipment.place_id`; party's places = live links; papers read place + complement; Pem's block = the « Principal » link |
| `ContactEditorPanel` (132, 474–519), `ContactsTab` (204), `ContactQuickModal` (56), `contacts/actions.ts` (128, 496), `lib/deleted-contact-refs.ts` | **yes** | links through the new door (§5); « aussi : n autres personnes » on a shared place |
| `ai/actions.ts` (150), `SupplierHub` (585), `works/new/page.tsx` (38) | **yes** | read places via links |
| `period-source-actions.ts` (36, 57, 298–324), `PeriodSourceManager` | **small** | delete → archive; list = creation kinds |
| `lib/reports/works-table.ts` (225) | **yes** | « Adresse » from the place; `LocalisationDetail` column dropped |
| `scripts/archive-export.mjs` (121), `scripts/stress/*` (b4b5, run-chains, seed) | **yes** | new tables / columns; chains re-pointed |
| `lib/types/database.ts`, generated types | **yes** | regenerated after live SQL |
| `oeuvre_search_text`, `graph_place_text_dirty` | **no change now** | search does not read the address today; path / code in search = later build |
| Creation steps, periods, `ChronologieTab`, `WorkCreationHistory` | no | already `place` |
| Public site, collector pages, kits, Journal, Constellation | no | never read addresses |

## 4. The one decision: 1,176 version rows

Setting `Oeuvres.place_id` fires `oeuvre_version_snap` (one full snapshot per work) and `trg_zz_oeuvre_history` (writes nothing for a place change).

- **A — accept:** 1,176 « migration » versions (+10 % of the table, about 1.5 MB); every work's history opens with a version that changed nothing Pem did.
- **B — recommended:** inside the migration transaction only, `ALTER TABLE "Oeuvres" DISABLE TRIGGER oeuvre_version_snap, trg_zz_oeuvre_history, trg_oeuvre_location_by_stage`, write `place_id` from `place_address_map`, re-enable, then one `system_log` line (« Places phase B: 1,176 works re-aimed, address → place, map kept in `place_address_map` »). The trail is not lost: each work's last snapshot still holds its old address id, the map turns it into the place, `LocalisationDetail` stays in the row and its history. The lock lasts the few seconds of the transaction.

## 5. Contact editor during phase B

`ContactEditorPanel` writes six tables from the browser (`syncContactRows`). People's `saveContact` does not exist yet. Phase B moves **only the address tab** to a small server door; emails / phones / sites / socials stay as they are until `saveContact` (they do not touch places).

- **`saveContactPlaces(contactId, rows)`** (server, team check, one transaction through an RPC): each row = an existing link (edit its label / role / primary / position, or the place's street / postcode / town / country / complement / shipping notes) or a new one (searches a known place with the `sameAddress` rule first; answers `known_address`, no names, Pem chooses « reprendre » or « nouveau lieu »). A row the form removed **ends** the link (`until = today`), or deletes it when nothing ever pointed at it (no work, order, shipment). Returns the links as stored + `changed`.
- Editing the street of a place shared by two people asks « ce lieu est aussi relié à 1 autre personne — modifier pour tous ? » (yes = edit the place; no = a new place for this card).
- `contacts/actions.ts` (quick add, import) and `ContactQuickModal` call the same RPC.
- When `saveContact` lands, it calls this door for its address part (§5 `linkPersonPlace` / `endPersonPlace`).

## 6. Order (one landing: SQL + readers + writers)

1. **One SQL file** `places_phase_b_switch.sql`: add `Oeuvres.place_id`, `work_order.place_id`, `shipment.place_id` (FK `place`, `RESTRICT`), `Oeuvres.home_place_id` (empty, §3c); run `places_backfill_from_addresses()` (already written); re-aim pointers through the map (decision §4); rewrite `oeuvre_location_by_stage`, add `contact_place_link_single`, drop `contact_address_link_single`, rewrite `merge_contacts`, add `place_archive_guard`; the door RPC `save_contact_places` (security definer, team check, grant `authenticated` only); `places_check()` must return all 0 or the whole file rolls back; **`contact_addresses`, `localisation_address_id`, `address_id` made read-only** (revoke insert / update / delete from `authenticated`; a trigger refuses writes from anyone else).
2. **Proof on the Docker copy** (`supabase_db_stress`, live-shaped fixture): before / after counts per place = per old address; chains — order to a party, return from loan, stage change of a finished work in the Atelier (stays), stage change of a work in making elsewhere (moves to the Atelier), merge two contacts sharing a place, archive a place with works (refused), delete a place (refused), editor ends a link (works keep their place); version count before = after.
3. **Code** (§3 table), typecheck, lint, i18n:check, focused Playwright (work drawer address, order hand-over, contact editor addresses), phone at 375 px for the work record and contact editor.
4. `flow-reviewer` on diff + trace; fix every « NOT updated ».
5. Live: SQL with Pem's explicit OK for that file, **then the push within the same minute** (the new code reads `place_id`; old code writing the old columns in the gap is refused — say nothing is being edited meanwhile).
6. **One release later**, with its own OK: drop `contact_addresses`, `localisation_address_id`, `work_order.address_id`, `shipment.address_id`, `LocalisationDetail` (after the « ancien repère » filter has done its job or moved to a label).

## 7. Questions for Pem

1. Version rows: B (no migration versions, one log line) — OK?
2. Rule 1 refuses (instead of today's silent clearing) a place not linked to the holder — OK?
3. Removing an address in a card = ends the link, the place stays, works keep it — OK?
4. Editing the street of a shared place asks « pour tous ou nouveau lieu ? » — OK?
5. Batch edit loses the free-text « Détail localisation » input (the text stays readable as « ancien repère ») — OK?
6. The live switch needs a minute where nobody edits works or contacts — tell me when.

## 8. Build (after Pem's « GO, option B », 2026-11-23) — local draft, uncommitted, NOT live

- SQL: `supabase/sql/places_phase_b_switch.sql` (one transaction, steps 1–7 above). Run whole on the Docker copy: checks all 0, version rows before = after (option B), a second run refused. Tested there: stage rule (a finished work in the Atelier stays, a work in making at the Principal goes to the Atelier, an unplaced Pem work gets its stage place), a place not linked to the holder refused, holder change clears a carried-over place, delete refused, archive with works refused, old columns refused, merge keeps works' places, the address door (known address, shared place « pour tous / nouveau », drop refused while in use, orphan place archived, unchanged save = nothing changed). The door function was changed after the whole-file run and reloaded alone from the final file.
- Code switched: §3 table, plus `supabase/sql/work_rules_checks.sql` (manual rule 9), `docs/ARCHITECTURE.md`, `docs/WORK_CUSTODY_MODEL.md`, stress scripts (seed keeps working after phase B). typecheck, lint (0 errors), i18n:check pass. `flow-reviewer` run; its findings fixed except the two below.
- Sales / movements on the copy against this code: sale, take-away, deposit (2 addresses, picker), sale out of a deposit + return, return shipments, grouped shipments B4/B5, double sale, double payment — pass. First failures came from the copy being older than live (`oeuvre_holder_check`, `oeuvre_soft_delete_gate`); both synced from live onto the copy, then rerun.
- **Change from answer 3 (to confirm with Pem):** removing an address that this person's works or running orders / shipments still use is **refused** with the counts (as the editor did before), not ended. Ended links with works left at the place made the drawer blank the place, could refuse an order hand-over and made rule 9 flag the work. An address with only finished history is ended; an unused one is removed and its place archived.
- Not done here: reports keep the old free text column (« Adresse » from the place not added); the « adresse vide » audit list; `place_id` in the version diff labels; generated types are hand-edited (regenerate after the live SQL).

## 9. Rework after Pem's answers (2026-11-23, relayed) — local draft, uncommitted, NOT live

- Rule 1: a work at a place its holder is not linked to is **flagged, never refused or moved** — read `oeuvre_place_unlinked`, audit rule 9, the work card (« ⚠ Lieu non relié au détenteur »), an Overview count linking to the audit.
- Removing an address ends that person's link only; works never move with a link (they get the flag). No « in use » refusal, no « pour tous ? » / « reprendre ? » dialog: the same full line is the same building; « Étage / appartement » = a child place of the building (people link to the floor); an edited line is corrected for everyone.
- Proof on the Docker copy: phase B undone on the copy, the final file run whole from phase A (checks 0, versions before = after, works' rows unchanged, Atelier merged into the creation studio, a second run refused); behaviour tested (stage rule, flag on pick / holder change, floors, shared building, unchanged save = no change, links ended with works flagged, street corrected for everyone). Chains: sale, take-away, deposit, refusals, grouped shipments 8/8, deposit return pass. « stages » fails on a test work with no photo row on the copy (catalogue photo gate) — not place-related.
- Left: Places.md §3b / People §4d wording for floors; reports « Adresse » from the place; « adresse vide » list; `place_id` in version-diff labels; regenerate types after live SQL; the work card flag reads one level (building or floor), boxes come later.

### 9b. Second flow review, fixed (2026-11-23)

Orders reach people linked to a floor; order / invoice papers print the building's line + the floor (`lib/places/place-address.ts`); the work card reads the database's flag (`oeuvre_place_unlinked`) so card, audit rule 9 (now its own line) and the Overview count agree; « others » counts the whole building; a floor cleared onto a building the person is already linked to ends the extra link (no duplicate-key error); a dropped orphan floor archives its building too; a new line never matches a creation studio / motif; Pem's stage rule skips archived places; a linked place is not archived from the creation places; the switch no longer rolls back on a flagged legacy work (a notice instead). Reports print the work's place. Re-proven whole on the copy (undo → full file → second run refused; versions unchanged). Chains: sale, take-away, deposit, grouped shipments 8/8, deposit return pass; the « sale of a work in production » refusal test picked a work out of circulation on the copy (status gate, not places).
Known, not changed: `contact_place` / `contact_place_lines` are team-wide like live `contact_addresses` today (the private-contact policy file is not live); People.md §3's `saveContact` answer list still has `address_in_use` (the main session was told it goes away with phase B).
