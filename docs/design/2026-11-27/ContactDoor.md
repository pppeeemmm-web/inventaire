# One door for contacts (saveContact v2) — plan and Flow trace

Status: **steps 1, 3, 4 (code) built; step 2 and the phone one-off wait for Pem.** Built: supplier inline and the
primary email through the door; phones stored in one form at the door — only a number typed or changed in the save
(one sent back as read is left alone, so an untouched card still answers « unchanged »), country from the number, its
own code, the card's address country, else France; a number found however it is typed (Contacts, suppliers); the
report's phone column shows its country code. Waiting: `contact_phones_one_form.sql` (54 rows, « apply phones »),
the duplicates delete (own OK), #393 / #694 / #713 to check by Pem. Was: **plan for Pem — nothing built.** TODO §4 « `saveContact` v2: phones stored E.164; the server writers still
outside the door » (principle 2: one door per record, on the server, all or nothing). Pem 2026-11-27: « Trying to push
the ball along ». Inventory read 2026-11-27 (code + live DB).

## Which kind of thing, which home, what changes
- **Kind:** a person or institution (`Contact` + its lists: emails, phones, websites, socials, places).
- **Home and door:** `saveContact` → SQL `save_contact` (one transaction: the card + its lists + the mirrored columns).
- **What changes:** the last writers outside the door go through it; phone numbers get one stored format. No new
  table, no new screen.

## What already goes through the door (most of it — good news)
Contact editor, bulk edit, quick add (phone), Google CSV / URL import, card capture, sale buyer « + Nouveau contact »,
work card « + contact », `@` picker, Pipeline, Fil, new order form.

## What still writes around it
| Writer | What it writes | Problem | Proposal |
|---|---|---|---|
| Supplier « + nouveau » (Stock, `createSupplierInline`) | `Contact` row with email and phone typed into the card's old columns | No email / phone list rows → the contact is invisible to email / phone search and to duplicate warnings | Through `saveContact` (email and phone as list rows) |
| Share sheet → contact notes (`attachShareInboxToContact`) | Reads Notes, appends a block, writes it back | Two shares at once: one block lost (read-then-write) | A one-line SQL append (`Notes = Notes ‖ block`) in one statement — SQL, your OK |
| Team access (`applyAuthLink`, `setContactTeamMember`) + primary email (`persist-primary-email`) | Login link, team flags, the primary email in the list | Access rights are a separate fact (admin door) — fine; but the email list is written by hand, beside the door's rules | Keep the admin door for access; the email goes through the door's list logic |
| Signature (`sign/actions`) | Signature file key | A file reference, admin only | Keep as is (its own fact) |
| Delete (`deleteContacts`) | Deletes the card (lists cascade) | A real delete, while « Archiver » exists | Keep for admins; the screen proposes « Archiver » first (already there) — no change |
| Merge (`merge_contacts`, live version moves places too) | Moves lists, deletes the duplicate | — | No change |

## Phones in one format (E.164: `+33612345678`, shown grouped `+33 6 12 34 56 78`)
- Today: **62** phone rows, typed as entered; **10** with no country code; **none** stored with « + ».
- At the door: a number is stored as `+` country code + digits (country from its field, else France for a number
  starting with 0); shown grouped by country on the cards. A number that can't be read is kept as typed and flagged
  « à vérifier » — never dropped.
- The 62 existing rows: a one-off update (SQL, throwaway copy first, your OK), each changed row listed before / after.

## Flow trace (to confirm with the flow reviewer at build time)
Input: the writers above → door `save_contact` → triggers on `Contact` (edit stamp, versions) → readers: contacts list
and search (email / phone / city), duplicate warning (similar contact), person page, sale buyer picker, order papers
(party address and phone), Pipeline, Fil cards, AI desk card reader, exports, phone `tel:` links.

## Steps (each its own commit; SQL only with your OK)
1. Supplier inline → door (code only).
2. Share sheet notes → atomic append (SQL function + code).
3. Primary email via the door's list logic (code).
4. Phone format at the door + grouped display (code), then the one-off for the 62 rows (SQL).

## Question for Pem
1. Default country for a number typed without one: **France** (proposed)?
2. All four steps, or start with 1–3 (no data rewrite) and keep the phone format for later?
