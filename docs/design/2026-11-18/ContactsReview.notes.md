# Contacts review — draft (2026-11-18)

Pem: « contacts review to draft ». Source: [`TODO.md`](../../TODO.md) §3 « Contacts tab review ». **Nothing built, nothing written to the DB.** Two bugs are being fixed separately and are **in progress, not redesigned here**: delete refused when a work references the contact; confidential (« Privé ») contacts hidden from the team by RLS. Design first: what exists, the problem, one proposal, decisions.

## What exists today

**Name.** Four copies of the same rule « institution, else `Prénom Nom` », none sorting by family name: `displayName` (`components/atelier/ContactsTab.tsx:62`), `contactMap` label (`TeamPortalClient.tsx:1049`), `contactName` (`TeamPortalClient.tsx:1604`), plus `events-shared.ts:14`, `ExhibitionDetail.tsx:41`, `SaleNewClient.tsx:75` (`contactLabel`), `lib/supplier-list-export.ts` (via `supplierDisplayName`), `lib/stock-item.ts`, `app/atelier/kits/actions.ts:242`, `WorkCardLogistics.tsx:62`, `WorldMapTab.tsx:493/506`. The list sorts on that string (`ContactsTab.tsx:360`), so « Anna Zola » sorts under A.

**Confidential.** `Contact.is_private`: set in the editor, admin only (`ContactEditorPanel.tsx:750-767`, saved `:391`), read in the list select (`ContactsTab.tsx:178`), created by the card flow (`contacts/actions.ts:86`). The list shows **no badge and no filter**; the team never sees the flag (RLS bug above).

**Autofill — what exists.**
- Editor: only French postcode → city + « France » (`ContactEditorPanel.tsx:328-350`, api-adresse, fallback zippopotam `/fr/`). Nothing else: no street lookup, no non-French country, no phone country guess, no name split, no duplicate hint while typing.
- Create flow (`ContactsTab.tsx` ~1361): « from a web address » → `previewContactFromUrl` (`contacts/actions.ts:387`, `lib/contact-url-enrich.ts`: page text parsed, optional Ollama / OpenAI refine, SSRF guard).
- Card capture: `lib/contact-card-parse.ts` (deterministic parse of Live Text / paste) + `app/atelier/capture/card-actions.ts` (`previewBusinessCardCapture`, `commitBusinessCardCapture`); AI pass optional, see [`AiDesk.notes.md`](./AiDesk.notes.md) phase 3.
- CSV / vCard-like import (`ContactsTab.tsx` ~1231-1298).
- Likely what Pem means by « much better autofill »: type a **name or institution** and get the rest (address, site, country, role) proposed; type **one address line** and get street + postcode + city + country; type a **phone** and get the country code; and **never retype** what the card / web page already gave. To confirm (decision 6).

**Address list staleness.** `ContactsTab` keeps `addresses` in its own state (`:152`, filled `:182-214`, updated `:402/:415/:900`). The Atelier shell holds the list once, `curationAddresses` (`TeamPortalClient.tsx:344`, filled post-paint `:360` from `fetchAtelierShellPostPaint`, `app/atelier/atelier-data-actions.ts:206-228`) and passes it to Curation dock (`:1423/1478/1510`), Compare (`:1568`), Inventory, work overlay. `onContactsChange` / `onContactsMerged` / `onContactsDeleted` (`:1413-1415`) refresh `contacts` and remap works (`remapWorkContacts :399`) but **not addresses**. Merge moves addresses server-side (`contacts/actions.ts:302`); the shell never learns.

**Phones.** `contact_phones(id, contact_id, country_code, phone, label, is_primary, created_at)`; `country_code` free text (editor placeholder `+33`, `ContactEditorPanel.tsx:934`), `phone` free text. Shown as `country_code + ' ' + phone` (`fmtPhone`, `ContactsTab.tsx:66`; same in `supplier-list-export.ts:130`). Legacy `Contact.Téléphone1` / `IndicatifPays1` mirrored on save (`contacts/actions.ts:83`). Importers write `country_code: null` and the digits as typed (`contact-card-parse.ts:21-49`, `contact-url-enrich.ts:172/259`). No normalisation anywhere; no phone library in `package.json`.

**Labels.** `contact_emails.label`, `contact_phones.label` free text (`label: string | null`, `supabase.generated.ts:603-675`). Written by hand in the editor, and by importers with fixed French words: `Carte`, `Principal`, `Personnel`, `Mobile` (`contact-card-parse.ts:49`, `contact-url-enrich.ts:172/220`, `contacts/actions.ts:562/566`). No list, no FR / EN.

## The problem, in one line

The same person is written, sorted, found, phoned and labelled differently on every screen, and an edit in Contacts does not reach the screens that pick a contact.

## Proposal — one contact « identity layer », then the list on top

### 1. One display helper (`lib/contacts/display.ts`)
`contactSortKey(c)`, `contactLabel(c, { caps })`, `contactListName(c)`. Every place in the table below calls it; no more inline `NomInstitution || Prénom Nom`.
- **Person** → shown `DUPONT Marie` (family name first, capitals) in lists / pickers; `Marie DUPONT` in running text and papers. **Institution** → as is. Sort key = lowercase family name (accents folded, `localeCompare` FR / EN as today), then first name; institution sorts by its name.
- **CAPS = display only, not stored** (recommended). Stored `Nom` stays as typed; capitalising at display never corrupts « de Kooning », « McCoy »; no migration, reversible. Rule: `toLocaleUpperCase` on `Nom` only, never on institutions. Particles (« de », « van ») stay with the family name for sorting — a one-line exceptions note, Pem to confirm.
- Alphabetical sort of every contact dropdown (Pem's rule) falls out of the shared key.

### 2. Confidential, visible to admins
In the list: a small lock chip « Privé » on the row and a filter chip « Privé (n) » in the filter bar (admin only; the filter does not exist for the team). Row + drawer banner reuse the existing key `wf_vis_private_banner`. RLS stays as the other fix leaves it.

### 3. Phone: one stored format, one display
- **Stored**: E.164 in `phone` (`+33612345678`), `country_code` kept as a derived column (or dropped later). **Shown** grouped by country (`+33 6 12 34 56 78`), `tel:` link from E.164.
- **Input**: one field with a country selector (flag + `+33`, default France, sorted A–Z by name in the user's language). Typing `06 12 …` with France selected stores `+336…`; typing `+44 …` switches the selector.
- **Library?** Recommend **`libphonenumber-js`** with the **`min`** metadata: about 80 kB gzipped, loaded only in the editor / import (dynamic import), parses, validates, formats, guesses the country. A small table (country → code → group pattern) is about 3 kB but only handles the ~15 countries the team uses and breaks on national numbering rules (Belgium, Italy, UK, mobile vs fixed). Compromise if bundle weight worries Pem: table for display + the library only in the editor and the clean-up script. Either way: **unparseable numbers are kept as typed** and flagged, never dropped.
- Writers to change: editor (`:931-960`), `commitBusinessCardCapture`, `previewContactFromUrl` / `contact-url-enrich.ts`, `contact-card-parse.ts`, CSV import, `contacts/actions.ts:83/118/562-566`, merge. Readers: see table.

### 4. Fixed label lists, FR / EN
- Phone: `mobile`, `work`, `home`, `fax`, `assistant`, `other`. Email: `work`, `personal`, `billing`, `assistant`, `other`. Stored as a **key** (`mobile`), shown through `useI18n` (`Mobile` / `Mobile`, `Pro` / `Work`…), sorted A–Z by shown name. A free « other » text is kept in a separate `label_other` so nothing typed is lost.
- Clean-up of imported labels: map the known French words (`Mobile`, `Pro`, `Travail`, `Domicile`, `Personnel`, `Fax`… to keys (`Principal` and `Carte` are import words, not real labels: → `other`, decision 5); everything else → `other` + `label_other`. A before / after list goes to Pem before any update.

**Count to run** (read only, Pem's OK to run; not run here):
```sql
select 'phone' as kind, coalesce(nullif(trim(label),''),'(empty)') as label, count(*) n
from contact_phones group by 1,2
union all
select 'email', coalesce(nullif(trim(label),''),'(empty)'), count(*)
from contact_emails group by 1,2
order by kind, n desc;
-- how many distinct labels, and numbers that are not yet +E.164:
select count(distinct lower(trim(label))) from contact_phones;
select count(distinct lower(trim(label))) from contact_emails;
select count(*) filter (where phone !~ '^\+[1-9][0-9]{6,14}$') as not_e164, count(*) as total from contact_phones;
select count(*) from contact_phones where country_code is null or country_code = '';
```

### 5. Autofill — better, in steps, always as suggestions
Same rule as the AI desk: **suggest, never overwrite** a field the user typed.
- **Address**: one search box (api-adresse `/search/` for France — already in the CSP; `api-adresse` does full addresses, not only postcodes; Nominatim is already in `lib/geocode-nominatim.ts` for abroad). Pick a result → street, postcode, city, country filled together. Keep the postcode → city shortcut, extend zippopotam beyond `/fr/` using the chosen country.
- **Country**: from the postcode shape, the phone prefix, or the web address TLD.
- **Phone**: country guess from the selector (above).
- **Name / institution**: split « Marie Dupont » → first / family; « DUPONT, Marie » handled; a duplicate warning while typing (the conflict logic exists: `contacts/actions.ts:512-571`, `fetchContactConflicts`).
- **Web address**: today only in the create flow; add the same button in the editor for an existing contact (fills only empty fields, shows « before → suggested »).
- **Card**: unchanged here; AI part stays in AiDesk phase 3.
- Every online lookup is a CSP entry (`next.config.ts:54`) and sends text to a third party: the address search sends what the user types — mention in the privacy notice ([`WEBSITE_LEGAL_PAGES.md`](../../WEBSITE_LEGAL_PAGES.md)).

### 6. Atelier address list refresh (small, no SQL)
`ContactsTab` already reports contacts up. Add `onAddressesChange(contactId, rows)` (edit / create), and on merge `{ fromId → intoId }`, on delete `ids`. `TeamPortalClient` owns `curationAddresses` and applies: replace rows of that contact; re-point `contact_id` on merge; drop on delete. Same pattern as `remapWorkContacts`. Longer term: lift `addresses` out of `ContactsTab` into the shell so there is one copy (phase 3).

## Every place a contact is shown or picked

« Change » = must use the shared helper (name / sort / CAPS) or the phone format. « Same » = already shared or not applicable.

| Place | File | Name / sort | Phone / email shown | Change |
|---|---|---|---|---|
| Contacts list + drawer | `ContactsTab.tsx`, `ContactEditorPanel.tsx` | sort `:360`, `displayName :62` | `fmtPhone :66`, labels | name, phone, labels, Privé chip / filter, addresses callback |
| Shell maps (works table, Inventory, Curation dock, Compare) | `TeamPortalClient.tsx:1049, 1604, 1568` | inline copies | — | name; addresses refresh (§6) |
| Work drawer owner / holder / buyer | `WorkCardLogistics.tsx:60`, `ContactQuickModal.tsx`, `DrawerContent.tsx`, `WorkForm.tsx`, `LocationAddressPicker.tsx` | inline; roles sorted `:87` | quick-add modal has phone / email | name + sort in lists; address picker follows §6 |
| Pipeline process modal | `pipeline/PipelineProcessModal.tsx` | inline | — | name |
| Orders: party, address, shipments | `sales/_components/NewOrderForm.tsx`, `Orders.tsx`, `sales/orders-actions.ts:124/1144`, `orders/ShipmentCard.tsx`, `OrderCascadePanel.tsx`, `sales/cascade-actions.ts` | inline in actions | — | name; address list read from DB each time (fresh) |
| Mobile sale | `sale/SaleNewClient.tsx:75` (`contactLabel`) | own copy | — | name |
| Supplier hub + exports | `SupplierHub.tsx`, `lib/supplier-list-export.ts`, `lib/stock-item.ts` (`supplierDisplayName`) | own | `fmtPhone` copy `:130` | name, phone |
| Map | `WorldMapTab.tsx:268-301, 493-506` | inline | — | name; role / city dropdowns already A–Z |
| Events, exhibitions | `events/events-shared.ts:14`, `exhibitions/ExhibitionDetail.tsx:41` | own | — | name |
| Phone `/hub` | `components/hub/HubHomeClient.tsx`, capture card `capture/CaptureCardClient.tsx` | own | importers | name; phone input (E.164) |
| Reports, Audit, Journal, Fil, Kaizen | `reports/source-actions.ts`, `audit/*`, `journal/entry-actions.ts`, `fil/*`, `kaizen/actions.ts` | server-side names | — | scout the strings at build |
| Papers (PDF): order paper, invoices, kits | `lib/orders/order-paper.ts`, `lib/collector-kit.ts`, `kits/actions.ts:242`, `lib/calendar/sync-order.ts` | **running text**: `Prénom NOM` | phone if printed | name, phone (print format) |
| Work history / record | `lib/oeuvre-historique.ts`, `docs` work record | own | — | name |
| Public: collector / gallery pages, kit link | `app/collection/[id]`, `app/galerie/[id]`, `app/c/[token]` | own | — | name (collector sees `Prénom NOM`; **no** privacy leakage — respect `is_private`) |
| Export (CSV / vCard) | `ContactsTab.tsx` import section; supplier export | — | phone | E.164 in vCard, grouped in CSV |

(Paths are from a search; the scout pass at build time lists the exact lines.)

## Data (sketch — SQL needs Pem's OK)

- `contact_phones`: add `label_key text`, `label_other text`; keep `phone` as E.164. No new table.
- `contact_emails`: same `label_key`, `label_other`.
- A dry-run script (read only) writes the before / after label and phone map to a file; Pem reads it, then a numbered migration applies it. Backup first (`supabase/CLAUDE.md`). `Contact.Téléphone1` / `IndicatifPays1` legacy mirror re-derived by the existing save path, not by SQL.
- No change to `is_private` or its RLS (other fix).
- **Flow trace.** Writers: editor save (`ContactEditorPanel.tsx:391-470`), `contacts/actions.ts` (create / merge `:302` / delete / `:83-118` legacy mirror), card capture (`card-actions.ts`), URL enrich, CSV import, `team-actions.ts`, `ContactQuickModal`, Hub quick capture. Triggers: none known on `contact_phones` / `contact_emails` (check `docs/ARCHITECTURE.md` + live DB at build). Readers: every row in the table above, plus Overview contacts count, Audit rules (`audit/rules-actions.ts:72`), search index (names in embeddings, re-embed if names change — they do not, display only), Aide screenshots / guide text about contacts, What's new.

## Phases

1. **Display layer** — shared helper, family-name sort, CAPS display, Privé chip + filter, replace all name copies. No SQL. Biggest visible gain, lowest risk.
2. **Atelier addresses refresh** — §6. No SQL. Small; can ship with phase 1.
3. **Labels** — fixed lists + i18n keys in the editor; the count query; dry-run map; SQL on Pem's OK.
4. **Phones** — decision on library, editor input, importers write E.164, display everywhere, dry-run + SQL.
5. **Autofill** — address search, name split, duplicate hint, web-address button in the editor; then lift `addresses` into the shell.

Each phase ends with a 375 px check of the Contacts list + drawer and a Flow review (`flow-reviewer`).

## Decisions for Pem

**Pem 2026-11-18: « Yes, all recommended »** — decisions 1–5, 7, 8 as recommended; phases 1 + 2 to build. Decision 6 (which autofill first) still open: it only matters for phase 5.

1. Phase order: 1 + 2 first, labels, phones, autofill last (recommended)? Or phones first?
2. Family-name capitals: **display only**, institutions untouched (recommended), or stored?
3. Display format: `DUPONT Marie` in lists, `Marie DUPONT` in papers and sentences (recommended), or one format everywhere?
4. Phone library: `libphonenumber-js` min, loaded only in the editor (recommended), or a small table for the ~15 usual countries?
5. Label lists: confirm the proposed keys (phone: mobile, work, home, fax, assistant, other; email: work, personal, billing, assistant, other) and that `Principal` / `Carte` map to « other » unless you say otherwise. Run the count query first?
6. « Much better autofill »: which of address search, country / phone guess, name split, duplicate warning, web address in the editor do you most want first?
7. Privé chip and filter: admin only (recommended); the team never sees private contacts at all once the RLS fix lands.
8. Particles (« de », « van », « von ») sort under the family name including the particle (recommended: `de Kooning` under D), or under K?
