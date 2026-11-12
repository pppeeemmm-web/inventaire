# Work custody model — owner, custodian, address

Owner-approved 2026-11-03. Every rule, screen and order that touches who owns a work, who holds it
or where it is must match this page. Verified against live code 2026-11-03.

## Terms

- **Contact** — a person, an institution or an organisation (`Contact`).
- **Address** — one of a contact's places (`contact_addresses`: label + street, city…). A contact can have several.
- **Owner** — who holds the title (`Oeuvres.ContactID`).
- **Custodian** — who physically holds the work, always filled (`Oeuvres.LocalisationID`). A role, not a kind of contact.
- **Address of the work** — always one of the custodian's addresses (`Oeuvres.localisation_address_id`). Screens show the label; the street is behind it.
- **Buyer** — `Oeuvres.AcheteurID` (also set while reserved, before ownership moves).

Pem = Contact 13. Pem's addresses: **Atelier** and **Principal** (same street, 6 rue des Trois Frères Barthélemy, 13006 Marseille — two separate rows), **Rutali**.

## The table

| Stage | Owner | Custodian | Address |
|---|---|---|---|
| In production (everything before Available, catalogued / photo pending included) | Pem | Pem | Atelier |
| Available | Pem | Pem | Principal |
| Artist archive | Pem | Pem | Principal |
| Reserved / sale started, payment not cleared | Pem | wherever it is kept (Pem, gallery, outlet) | that custodian's |
| Consignment / loan | Pem | gallery / borrower | one of the custodian's |
| Sold, payment cleared, not delivered | buyer | Pem (or the gallery that holds it) | Principal (or the gallery's) |
| Sold, delivered | buyer | buyer | one of the buyer's |
| Gift, deed signed, not handed over | recipient | Pem | Principal |
| Gift, handed over | recipient | recipient | one of the recipient's |

- **Ownership moves** when payment is complete and cleared (sale: order `completed`), or when the gift deed is signed.
- **Custody moves** on delivery / hand-over, never at payment.
- **Every move out of Pem's place goes through an order**: consignment, loan (exhibitions included), sale. Gifts: the owner decides (gift dialog in the work drawer), no order needed.
- Pem's address follows the stage: Atelier while in production, Principal from Available on. An address picked by hand is kept until the next stage change.
- A custodian with one address gives the work that address automatically; with several, pick it in the drawer.

## Where it is enforced

- DB trigger `oeuvre_holder_check` ([`work_custody_model.sql`](../supabase/sql/work_custody_model.sql)): the table above, per status.
- DB trigger `oeuvre_location_by_stage` (same file): the address rules. Runs only when the work row is saved.
- DB trigger `trg_contact_address_link_single` on `contact_addresses` ([`contact_address_single_link.sql`](../supabase/sql/contact_address_single_link.sql), applied 2026-11-12): same single-address rule from the address side — when a contact is left with one address, its works without an address get it (Pem excluded). Backfill linked #302, #2124, #2162, #2339, #2341 (Kaizen "linkage broken").
- Orders: [`sales/actions.ts`](../app/atelier/(portal)/sales/actions.ts), [`consignments/actions.ts`](../app/atelier/consignments/actions.ts); gifts: [`gift-actions.ts`](../app/atelier/works/gift-actions.ts); exhibitions: [`exhibitions/actions.ts`](../app/atelier/(portal)/exhibitions/actions.ts).

## Mismatches found 2026-11-03 (live code + DB) and their fix

| # | Where | Did | Table says | Fix |
|---|---|---|---|---|
| 1 | DB `oeuvre_holder_check` | Sold / gift refused while Pem holds the work | Paid, not delivered → custodian Pem | Sold / gift: owner ≠ Pem only |
| 2 | Sale completion | Owner **and** custodian → buyer at payment | Custodian moves at delivery | Completion moves owner only; "Mark delivered" moves custodian |
| 3 | Gift dialog | Owner and custodian → recipient at once | Custodian moves at hand-over | "Handed over" choice in the dialog; later hand-over in the drawer |
| 4 | Exhibitions "Add selection" | Wrote the venue as **owner** | Owner Pem, venue custodian, via an order | Creates a loan (or consignment) order to the venue |
| 5 | Exhibition works list | Works whose owner = venue | Works whose custodian = venue | Reads custodian |
| 6 | Drawer ownership | One contact for owner and custodian; reserved wrote the buyer as owner | Separate owner / custodian / address | Three rows; reserved keeps owner Pem, buyer stored as buyer |
| 7 | Drawer stage pills | Consigned / loan / sold set by hand | Out of Pem's place only through an order | Those pills follow orders; gift stays manual |
| 8 | Drawer custodian line | Read a removed table, showed Pem's city | Custodian + address | Shows custodian and address label |
| 9 | Inventory location column | Hardcoded "Pem - Atelier" | Custodian + address label | Shows both |
| 10 | Pem's address by stage | Agreed, never built; 1,162 works without an address | Atelier / Principal by stage | DB trigger + backfill of Pem-held works |
| 11 | Studio health | Counted missing custodian only (always 0) | — | Adds "no address" |
| 12 | Bulk edit | Any status / owner / location; address picker saved nothing | Orders move works | Status 1 / 2 / 3 only; owner / location fields removed; Pem address saved |

Not changed (noted): orders do not yet store the custodian's address (picked in the drawer when the
custodian has several); a cancelled sale of a consigned work returns it to Pem rather than to the gallery.
