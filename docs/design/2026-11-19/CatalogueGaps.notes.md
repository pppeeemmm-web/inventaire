# Catalogue gaps — what Artwork Archive has that the catalogue lacks (design draft, 2026-11-19)

Draft only. No code, no SQL. Pem 2026-11-19: « draft "catalogue gaps" in todo ». The 16 lines of TODO §3 « Catalogue gaps »; field lists in [`TODO_NOTES.md#artwork-archive-gaps`](../../TODO_NOTES.md#artwork-archive-gaps). Each touches data → each needs its Flow trace re-done at build time and Pem's GO.

**Read on 2026-11-19:** live DB (Supabase, read only: columns of `Oeuvres`, `Contact`, `suivi_process`, `work_order(_work)`, `condition_report`, `document`, `private_link(_work)`, `voice_note`, `event_*`; counts) and live code (grep). Works: 1 175 not deleted.

Groups (items that share data are drafted together):

- **A. The work record** — 4 free-text date / size, 5 signature, 6 video / audio, 7 public text, 9 condition at a glance, 3 wholesale price
- **B. Editions** — 1 editions and print runs (= R6 editions part 2)
- **C. Statuses** — 10 Lost / Stolen / Destroyed / Deaccessioned / In transit / Installed
- **D. Events and calls** — 11 exhibition record, 12 calls for entry, 2 bibliography
- **E. Contacts** — 8 tags, dates, nationality, bio, role toward a place
- **F. Sharing and papers** — 13 share kit switches, 14 preset papers, 15 studio documents
- **G. Insights** — 16 production / sales / income over time, map

---

## A. The work record

### A1 (item 4). Free-text date and size: circa, override, framed / paper size, weight

**Today**
- `Oeuvres.Année` DATE (`YYYY-01-01`, `yearOf()`), plus `production_started_on / _completed_on` with precision `year / month / null=day`. No « circa », no free date text.
- `Hauteur`, `Largeur`, `Profondeur` are stored as text, but all 1 175 works hold plain numbers (checked live). `Format` = paper formats only (A1–A7, 10x8, Carnet 10x8; set on 471 works). No framed size, no weight.
- `Montee` / `Encadree`: **false on all 1 175 works** — the very great majority of works are unmounted (no chassis), so unframed. Framed size only matters for the rare framed work.
- Readers of size: work card, inventory list, cartel / labels, portfolio PDF, order papers (`lib/orders/order-paper.ts`), public `/works` (anon grant covers `Hauteur / Largeur / Profondeur / Format`), shipments (crate sizing by hand), `trg_oeuvre_field_defaults` (depth `0.1`).

**Missing:** « vers 1998 », a date shown as typed (« 1997–1999 », « été 2004 »), framed outer size (rare), weight (shipping, insurance).

**Proposal**
- `Oeuvres.date_display text` — optional; when set it replaces the shown year everywhere (card, cartel, PDF, site). `Année` stays the sortable truth. « circa » = a tick `date_circa boolean` that prefixes « vers / c. » (i18n) — no free text needed for the common case.
- Size: height / width / depth stay plain numbers. **Formats fill the size** (Pem 2026-11-19: « you just enter the format and we get dimensions straight away »): `Format` gets `height_cm / width_cm`; picking A4, 30F, 20P… fills height and width on the card (still editable). Add the canvas formats (Figure / Paysage / Marine) to the list. SQL: 2 columns on `Format` + rows.
- `framed_h / framed_w / framed_d numeric` (cm) — shown only when `Encadree` is ticked; `weight_kg numeric`.
- Work card: under « Dimensions », « Poids » always; « Encadré » only for a framed work. Phone: same, one column. Papers: weight on shipment sheets, framed size on loan / consignment papers when framed; public site: `date_display` only.

**Flow sketch:** writer `saveWork` (+ `lib/work-pending-keys.ts` for non-admin) → triggers: `oeuvre_version_snap` (snapshot picks up new columns), none other → readers: work card, `/hub` work view, inventory columns + `report-sources.ts`, portfolio PDF, order papers, shipment sheets, cartel, public `/works` + anon GRANT (only the two display columns), `oeuvre_version_fields.ts` (journal compare), CSV export.

**SQL:** yes (additive columns; anon GRANT for `date_display`, `date_circa`).

**Decide:** see question 2 (date).

### A2 (item 5). Signed + signature notes

**Today:** nothing on the work. `Contact.signature_r2_key` is Pem's **paper** signature (for order papers), not the work's.

**Proposal:** `Oeuvres.signed boolean` (null = unknown), `signature_note text` (« signé b.d., daté au dos »). Work card: one row next to technique. Phone: same. COA and order papers: one line « Signature : … ». Public site: no (unless Pem wants it on the kit — see F1).

**Flow:** `saveWork` + pending keys → version snapshot → readers: card, `/hub`, COA (`coa-verify.ts` / COA builder), order papers, condition report (a missing signature is a condition fact), `oeuvre-version-fields.ts`, inventory column.

**SQL:** yes (2 columns). **Decide:** fixed position list (b.d. / b.g. / h.d. / verso …) or free text only?

### A3 (item 6). Video links and audio files on a work

**Today:** `voice_note` already holds audio per work (`oeuvre_id`, `audio_r2_key`, transcript) — these are Pem's notes, private. `work_source_link` holds sources. No video link. `document.external_url` exists (vault) and `document.oeuvre_id`.

**Proposal:** no new table. A work « Médias » list = `document` rows with `oeuvre_id`, new kinds `video` (`external_url`: YouTube / Vimeo / R2 file) and `audio` (R2 file), plus a `public boolean` on `document` (default false) for the ones that may show on the site / kit. Voice notes stay private and stay where they are.

**Flow:** writer vault upload / a new « + Média » on the card → `document` (no work trigger) → readers: card « Médias », `/hub` (play), share kit (F1 switch), public work view (only `public`), vault lists (new kinds get a folder), retention / storage ledger (`storage_object_ledger`).

**SQL:** yes (`document.public` + kind values if a check exists; R2 key prefix). **Decide:** video files uploaded to R2 or links only (cost / size)?

### A4 (item 7). A public description written by Pem

**Today:** `Commentaires` retired (empty since 2026-11-18); private notes = `note_line`; AI text = `work_description` (unverified). Public `/works` descriptions are per **series / collection** (site config `description_fr / _en`), not per work. No per-work public text.

**Proposal:** `Oeuvres.public_text_fr text`, `public_text_en text`. Work card: a « Texte public » block (FR / EN tabs), with « Partir du texte IA » that copies the AI text in for Pem to rewrite (never auto-published). Public site + share kit + portfolio PDF (presse / collectionneur presets) read it. Notes and AI text never leave the studio.

**Flow:** `saveWork` + pending keys (a non-admin proposes, Pem approves) → snapshot; `graph_oeuvre_embedding_dirty` should add the column (search) → readers: public `/works` + anon GRANT, `/c/[token]` kit, portfolio PDF, OG image text, work card, `/hub`.

**SQL:** yes (2 columns, anon GRANT, embedding trigger column list). **Decide:** FR + EN both required before it shows, or EN falls back to FR?

### A5 (item 9). Condition at a glance

**Today:** `condition_report.grade` exists with five values in code (`lib/condition.ts`: excellent / good / fair / poor / critical) — 1 graded report live, 2 ungraded. Reports drive fate (§1 ARCHITECTURE). Nothing shows a grade on the work card head or in lists.

**Proposal:** **no new field** — derived: the grade of the newest report with a grade = the work's condition. Chip on the work card head, an inventory column + filter, a line on loan / consignment papers (« État au départ : bon »). A work with no graded report shows nothing (not « Excellent » by default).

**Flow:** writer condition reports (existing) → no trigger → readers: card head, inventory + `report-sources.ts`, order papers, shipment sheets, share kit (F1 switch), `/hub`.

**SQL:** no (read only; optional SQL view later for the inventory sort). **Decide:** keep our five words (with « critical ») or move to Artwork Archive's five (Excellent / Very good / Good / Fair / Poor)?

### A6 (item 3). Wholesale price per work, on consignment papers

**Today:** `Oeuvres.Prix`, `Discount`, `PrixFinal`, `tva_rate`; per order: `work_order.commission_pct / commission_amount`, `work_order_work.price`. So the « net to Pem » of a consignment is computable from price × commission, per order, not per work.

**Proposal (pick one):** (a) **nothing stored** — the consignment paper prints « Prix public / Commission / Net artiste » per line from the order (most likely what is needed); (b) `Oeuvres.price_wholesale numeric` when galleries get a fixed trade price regardless of commission.

**Flow (b):** `saveWork` + pending keys (price trio becomes a quartet in the conflict check) → snapshot → readers: card price block, consignment paper, order line default price, sales report, inventory value pivots, kit (never shown publicly). **SQL:** (a) no; (b) one column. **Decide:** (a) or (b)?

---

## B. Editions (item 1) — = R6 editions part 2

**Today:** R6 (APPLIED 2026-11-17) gave events of kind `edition` (`suivi_process.type`) and the R7 order kind **Confié** (`entrusted`, « Bon de confiage ») for the source works going to the printer. Part 2 was deferred « at the first real edition » (Q7: **one catalogue entry per edition**, not per print; copy numbers on order lines). 0 editions in the data; `r6_events.sql:24` lists `work_order_work.copy_no` as not built.

**Missing (Artwork Archive):** open / limited, copies, artist's proofs (EA / HC), master work, run date / medium, run cost, price per print, signed prints.

**Proposal (follows R6 Q7):**
- The edition **is a work row** (`Oeuvres`) marked as an edition: `edition_kind text` (`limited` / `open`), `edition_size int`, `edition_proofs int` (EA), `edition_hc int`, `edition_source_id int` → the master work, `edition_process_id uuid` → the « Lancement d'édition » event. `Prix` = price per copy. Run cost = an `expense` linked to the edition (`expense_oeuvre`, exists) — no new cost field.
- Copies: `work_order_work.copy_no text` (« 3/30 », « EA 2/5 »). A copy leaves through an R7 sale / gift / consignment line like any work.
- Status of a multiple: the edition stays Disponible (2) while copies remain; the card shows « 30 · 7 vendus · 2 offerts · 21 au studio » derived from order lines. **This collides with `trg_oeuvre_holder_check`** (status 6 needs owner ≠ Pem + paid sale): an edition must never move to 6 / 11 on one copy's sale → the order cascade must skip the status move for edition rows.
- Shows: work card « Édition » block (run, copies left, copies table); phone: the same counts, read only; papers: copy number on bon de commande / acte de don / COA (« épreuve 3/30 »); public site: « Édition de 30 » + price per copy if shown.

**Flow:** writers `saveWork` (edition fields), orders (`orders-actions.ts`, `cascade-actions.ts`: copy number, **no status move for an edition**) → triggers `trg_oeuvre_holder_check`, `trg_oeuvre_a_status_follows_stage`, `work_order_line_one_open` (**one open sale per work — blocks selling two copies at once; must key on work + copy for editions**), `trg_work_order_after_step` (closes other lines on sale — must not for editions), `trg_zz_oeuvre_history` → readers: card, inventory (an edition counts once, with copies), stock-take, COA, order papers, sales report / fiscal (BNC income per copy), public site, Constellation (edition ↔ master edge, `tblrelations` type `derived_from` exists).

**SQL:** yes — and touches order guards (`order_race_guards.sql`) and the holder trigger. High effort, admin-reviewed SQL.

**Decide:** build now, or still « at the first real edition »? Per-copy custody (where is copy 7?) — needed, or counts are enough?

---

## C. Statuses (item 10)

**Today (live `OeuvreStatus`):** 1 En production · 2 Disponible · 3 Archive artiste · 4 Réservé · 6 Vendu · 7 Consigné · 8 Prêt · 9 Destroyed · 10 Lost · 11 Gift. Plus: fate model (§1: destroyed / lost only through an admin condition report), order kinds V / D / P / C (Confié) / G, shipments with steps, event prep ticks (`event_work.hung_at` …).

| Artwork Archive | Covered by | Gap |
|---|---|---|
| Destroyed | status 9 via constat (fate) | none |
| Lost | status 10 via constat | none |
| **Stolen** | — | a theft is a loss with a police report: `condition_report.kind = 'stolen'` (fate) → status 10 with label « Volé » via `fate`; `insurance_claim.police_report_ref` exists |
| **Deaccessioned** | — | Pem's own works: « retirée du catalogue » (destroyed by the artist, repainted, disowned). Today: bin (`deleted_at`) or Archive (3). Proposal: a fate `withdrawn` (admin) — or nothing (bin is enough) |
| **In transit** | shipment steps (`shipment` `photos_at` … `delivered_at`) | derived, not a status: chip « En transit » on the card while a shipment for the work is between left and delivered |
| **Installed** | event prep `hung_at` / Prêt / Vendu delivered | derived: « Accrochée — <event> » while `hung_at` set and `taken_down_at` null |
| On loan / Reserved / Sold / Gifted / In storage / In progress / Available / Not for sale | 8 / 4 / 6 / 11 / 1–2 address / 1 / 2 / 3 | none (« Not for sale » ≈ Archive artiste) |
| Under maintenance / Returned to owner | Confié (restorer) / order returned | none |

**Proposal:** no new statuses. Add **Stolen** as a third fate kind and two **derived chips** (En transit, Accrochée) shown beside the status, never stored.

**Flow:** fate `stolen`: writer condition reports (admin) → `condition_report_fate_sync`, `oeuvre_fate_guard`, `trg_sync_is_public`, `trg_zz_oeuvre_history` (« Volée ») → readers: every status chip (card, inventory, `/hub`, public never), insurance claims, `WORK_RULES.md`. Derived chips: readers only (card head, inventory, `/hub`, map « Œuvres »).

**SQL:** yes for Stolen (fate check values, history wording, maybe `OeuvreStatus` stays 10). No for the chips. **Decide:** Stolen = Lost with a « volé » label (status 10), or its own status 12? Deaccessioned: bin is enough?

---

## D. Events and calls

### D1 (item 11). Exhibition record

**Today:** an exhibition = `suivi_process` type `exposition` (0 rows live; types live: residence 2, salon 1, correspondance 1, autre 1). It has `nom, date_debut, date_fin, statut, notes, localisation, url, contact_id, deadline_time, on_site, prep_columns`; dated steps `suivi_etape` + `suivi_reminder`; people with roles `event_contact` (lieu, commissaire …); per-work prep `event_work`; loans / consignments via `work_order.process_id`.

**Missing:** juror (→ `event_contact.role = 'jury'`, no SQL), fee (participation fee paid / earned), reception date (vernissage), delivery / pickup deadlines, show format (on site / online / travelling), solo / group.

**Proposal:** deadlines = **`suivi_etape` rows from the kind's template** (« Dépôt des œuvres », « Vernissage », « Retrait ») — they already have dates, reminders and the calendar export; no columns. Add `suivi_process.event_format text` (`site` / `online` / `travelling`), `solo boolean`, `fee_amount numeric` + `fee_direction` (`paid` / `received`) — or the fee as an `expense` linked to the process. Travelling = several venues → each venue a child event (`exhibition_process_id` exists as parent link).

**Flow:** writer `event-actions.ts` → no trigger → readers: event view, events list strip, calendar export, About « Expositions » block (`on_site`), CV / exhibition history (F3), work card « Expositions », fiscal (fee).

**SQL:** small (2–3 columns) or none if fee = expense and format = a step. **Decide:** fee as expense (fiscal sees it) or a field?

### D2 (item 12). Calls for entry (Prix / Résidence / Salon)

**Today:** Pipeline processes of types `prix`, `residence`, `salon` (`pipeline-shared.ts`), with steps, deadline, url, notes, statut. No entry fee, no award amount, no decision field beyond `statut`, no « saved calls to apply later ».

**Proposal:** keep Pipeline. Add on `suivi_process`: `entry_fee numeric` (or an expense), `award text` (prize / grant amount as typed), `decision text` (`pending / accepted / rejected / shortlisted`) with `decided_on date`. « Saved calls » = a Pipeline status `a_candidater` (to apply) before `en_cours` — a column on the board, no table. Works submitted = the process's working group (`working_group.process_id`, exists).

**Flow:** writer `pipeline/actions.ts` → none → readers: Pipeline board + modal, calendar (deadline), fiscal (fee / award income), CV (accepted calls), insights.

**SQL:** yes (3–4 columns) unless fee / award go through expense / invoice. **Decide:** one status word list for Pipeline + events (R6 unified events only)?

### D3 (item 2). Bibliography

**Today:** none. Pipeline « Livre » = making a book. `document` can hold a PDF (kind free), `work_source_link` = sources **of** a work (inspiration), not mentions of it.

**Proposal:** a `publication` table: `author, title (article), publication (journal / book), kind (press / book / catalogue / web / radio), published_on, precision, url, pages, document_id` (the scan / PDF in the vault), `notes`; + `publication_work (publication_id, oeuvre_id, page)`. Work card: « Publications » list; contact card: as author (optional `author_contact_id`); CV / press kit (F3) lists them; public site: About « Presse » block, opt-in per row (`on_site`).

**Flow:** new writer (bibliography sheet, vault upload) → no trigger (graph node later) → readers: work card, `/hub` read-only, CV generator, share kit (F1 « exhibition / publication history »), public About.

**SQL:** yes (2 tables, RLS team, anon none — public block through a server read). **Decide:** a contact for each author, or text only?

---

## E. Contacts (item 8)

**Today:** `Contact` has `Type`, `Role` (text), `TypeContact` (int; 50 of 61 null), `Notes`, `is_private`, addresses / emails / phones / socials / websites in child tables, groups only for works (`working_group`). No tags, no birth / death, no nationality, no bio. « Role toward a place » partly exists as `event_contact.role` (per event) and `PersonneResponsable / RoleResponsable` (free text).

**Proposal:**
- `contact_tag (contact_id, tag text)` — free tags, autocomplete from existing; list filter + pivot. Replaces nothing yet (`Type` / `TypeContact` cleanup = separate item).
- `Contact.born_on date`, `died_on date` (+ precision year), `nationality text`, `bio text` — for artists, collectors of record, authors (provenance lines, COA « collection de feu X »).
- Role toward a place: `contact_place_role (contact_id, place_contact_id, role text)` (« directrice — Galerie X »). Or reuse `PersonneResponsable` and do nothing.
- Shows: contact card (desktop + phone); provenance lines on COA / kit (dates of a past owner); no public display.

**Flow:** writer `ContactEditorPanel` / contact actions (**main session is editing these files now — build after AI desk phase 3 lands**) → `Contact` graph node dirty trigger → readers: contacts list, pickers (`is_private` rule), search (`node_search_text` — add bio / tags?), COA provenance, orders party block, reports pivots, AI card suggestion (`lib/ai-card-suggestion.ts` fills contact fields — must learn the new ones).

**SQL:** yes (columns + 1–2 tables, RLS team). **Decide:** tags free or from a fixed list? Role toward a place needed now?

---

## F. Sharing and papers

### F1 (item 13). Collector share kit display switches

**Today:** kit built 2026-11-18: `private_link` (contact, lang, message, expiry, revoke, PDF) + `private_link_work` (position, `show_price`, `price` snapshot). Per-work price switch only; the page shows photo, title, year, size.

**Proposal:** `private_link.show jsonb` (or booleans): `sold` (show sold works as « Vendu »), `provenance`, `exhibitions` (+ publications once D3), `condition` (A5), `signature` (A2), `hires_download` (signed R2 URL per work, logged), `public_text` (A4, default on). Password: the token is already the secret — a password adds friction for little; skip unless Pem wants it. Favourites: a visitor heart → `inquiry` row tagged « favori » (no account).

**Flow:** writer kit sheet (`curation/actions.ts`) → none → readers: `/c/[token]` page, kit PDF (frozen at creation — switches must be read at PDF time too), counters.

**SQL:** yes (one column). **Decide:** which switches matter for a real collector; high-res download yes / no?

### F2 (item 14). Preset papers

**Today:** order papers (bon de commande, bordereau de dépôt, contrat de prêt, acte de don, bon de confiage — `lib/orders/order-paper.ts`), COA with verify, portfolio PDF presets galerie / collectionneur / presse / custom, cartels (event prep « cartel »), Reports tab with saved reports (`saved_report`) and pivots, fiscal (BNC). Missing: tear sheet (one work, one page: image + all facts + price), address labels, contact report (one contact: works owned, orders, kits), cover page, income by category.

**Proposal:** add three presets to the portfolio PDF engine rather than new engines: **Fiche œuvre** (tear sheet = portfolio with 1 work, all facts, price on), **Liste d'inventaire** (table layout of a selection). Contact report = a print view of the contact card (works / orders / kits). Address labels = a print CSS sheet (A4 3×8) from a contact selection. Income by category = a saved report on payments × technique / kind (exists as pivot; add a preset). Cover page = the portfolio cover alone.

**Flow:** readers only (no writer) except `saved_report` presets.

**One limit to lift (plain words):** a tear sheet is one page about one work, made to show a gallery, a buyer or an insurer — often a work that is **not on the site** (in production, in the archive, sold, consigned). Today the PDF engine (`generatePortfolioPdf`) keeps only works that are on the site and silently drops the others, so a tear sheet of such a work would come out empty. Fix: any work can go in a PDF made in the studio; the site itself keeps its rule (only public works). **Pem 2026-11-19: « I need to validate that as admin »** → a PDF holding a non-public work is made by an admin, or waits for an admin's OK (to settle at build: question 17).

**SQL:** no (saved report presets are rows; seed via app). **Decide:** which three first?

### F3 (item 15). Studio documents in one place

**Today:** vault (`document`, folders, kinds incl. `CV` ×3, `contrat`, `facture` …). No « studio » set, no one-click share. About page on the public site.

**Proposal:** a vault folder « Studio » with fixed kinds `cv`, `bio`, `statement`, `press_kit`, `proposal` (one current file each, older kept as versions by `doc_date`). « Partager » = a share kit of kind `documents` (reuse `private_link` with a `document_ids` list) or a signed link per file. CV could later be generated from D1 / D2 / D3 data.

**Flow:** writer vault upload → `document` → readers: vault, share link page, About page (bio / statement if published), kit.

**SQL:** small (kind values; link table if shared as a kit). **Decide:** generated CV (from events / publications) or uploaded files only?

---

## G. Insights (item 16)

**Today:** Analytics tab = site traffic (`page_view`); Reports tab = pivots on works / orders / payments; Fiscal = BNC; Map tab (`WorldMapTab`) already has an « Œuvres » mode placing each work **at its own address** (custody model) and a « Création » mode. So « where the works are now » exists.

**Missing:** time charts — works made per month / year (`production_completed_on`, `Année`), sales count and income per month / year (`payments`, `work_order.paid_at`), inventory value by status.

**Proposal:** an « Activité » panel in Reports (collapsed by default): three sparklines / bar lists (existing `Sparkline`, `BarList` components) — production, sales, income — by year with month drill-down; inventory value by status. Map: nothing new; link from the panel to Map « Œuvres ».

**Flow:** readers only. **SQL:** no (maybe a view for speed — measure first). **Decide:** income = payments received (cash) or sale price at sale date?

---

---

## H. Added by Pem on reading (2026-11-19)

### H1. Social links not in the contact details
**Today:** two stores for the same thing — columns `Contact.Instagram / LinkedIn / Facebook / Twitter` (filled on 3 contacts) and the table `contact_socials` (platform + handle, 1 row). The editor (`ContactEditorPanel`) edits both. Pem: the social shortcuts are not in the contact details. To check in the browser: what the read view shows, and whether a handle opens the profile (link) or is plain text.
**Pem 2026-11-19: « I couldn't see them either » → a bug** (saved links not shown in the contact details).
**Proposal:** one store (`contact_socials`; move the 3 column values in, then stop reading the columns), the **website is one of the social links** (Pem), and a row of clickable icons in the contact details (desktop + phone), next to email / phone. After AI desk phase 3 lands (same files).
**SQL:** yes (copy 3 values; drop the columns later, own OK).

### H2. Risk watch on works, places and moves (idea — not now)
Pem: the current storage is under the roof of an old building — big temperature swings, damp, never out of risk of a leak. Something should record risks for a place and for works, especially when works move. Parked as an idea. Pieces that exist: `place` / contact addresses (where works are), condition reports + `condition_issue` (damage), shipments (moves), insurance claims. Missing: a risk note per storage place (temperature, damp, leak — maybe readings), a reminder to check works stored there, and a warning when a work is moved into a risky place. Design later, its own draft.

### H3. Why only 16 items
These 16 come from the comparison list written on 2026-11-19 (`TODO_NOTES.md#artwork-archive-gaps`), itself made from the 39 captures by a code grep. This draft did **not** reopen the captures one by one. A full pass (each capture → each field → « have / missing / not wanted ») may find more; offered as the next step.

---

## I. Pem's own pass on the captures (2026-11-19, spoken)

Pem's reading, mapped onto the items above. « → » = what changes in this draft.

**Contacts = relationship building** (not a card of fields)
- Already there: graph nodes for every contact, follow-up dates, purchase / acquisition history, files linked to a contact, calendar OAuth (`calendar_account`, `calendar_event_link`).
- Wanted: **reminders** (birthdays first), tied to Google Workspace; **events linked to people**; **which works were shown to whom, in what context** (kits, events, enquiries, visits) — one « Relation » timeline per contact.
- Contact form in four parts like Artwork Archive: contact info · addresses · about · relationships. About = notes, birth / death date, nationality, spouse first / last name, bio. Relationships = **« Sphère »** (Pem's word: groups of people — distinct from our work groups), tags, place relation. Contact **image**.
- → E grows: `born_on` drives a yearly reminder; spouse names; contact image (R2); « Sphère » = `contact_sphere` + `contact_sphere_member`; the « Relation » timeline is read-only from existing tables (orders, kits, events, enquiries, journal).
- **AI fill writes Spanish when the source is Spanish** — the AI contact suggestion must write in the app's language (or keep the source language only for proper names). → **for the AI desk lead**, it is `lib/ai-card-suggestion.ts`, being landed now.

**Editions** (B)
- Edition ≠ series. A type of edition: monotype, printmaking, photography, sculpture (painting / drawing hardly fit).
- Starts from a **reference work**, an **inspiration**, a **concept** (`concept` table exists), and **who is involved** (printer, photographer, foundry → contacts with a role).
- Artwork Archive form: open / limited, optional master piece, title, category, subject matter, wholesale price, size override, framed or not.
- **A new run when the stock is gone** → an edition holds **runs**: `edition_run (edition_oeuvre_id, run_no, date, medium, prints, proofs, cost → expense, price per print)`; copies numbered per run.

**Statuses** (C) — In storage, In transit, Under maintenance: covered (address, shipments, Confié). Deaccessioned / Returned to owner: see the glossary in the reply; neither needed for Pem's own works so far.

**Condition** (A5) — fine as proposed.

**Calls and exhibitions** (D1, D2)
- A call is **one event**, with the usual references, contacts, works.
- Call types (Artwork Archive): art fair, competition, exhibition, residency, workshop / classes, public art proposal, grant / fellowship, services, other → our Pipeline types today: prix, résidence, salon, exposition, livre, collaboration… → add `atelier / cours`, `art public`, `bourse` (split from résidence), `services`.
- Submission: entry fee, **awards** (what winning brings), status (our process steps), works.
- Exhibition: show type, solo / group, fee, curators, jurors, location (on site / off site, an existing place or a new one), **location records for the works in the show** (= our `event_work` + loan orders), reception date, deadlines submission / notification / delivery / pickup, private notes. → D1 as drafted; curators / jurors = `event_contact` roles.

**Papers** (F2)
- Tear sheet: fine.
- **Inventory list with thumbnail on the left, about 15 per A4**, configurable — Pem likes it.
- **Large labels like a cartouche**, with or without thumbnail.
- Exhibition proposal (capture 15): a pitch document of chosen works for a venue → a PDF preset « Proposition ».
- Contact labels for mailing.
- COA: have. Income report: probably have (Fiscal / Reports) — to check. **Sales report (capture 19): wanted** — sale price, commission, net, tax, **sold where and by whom** (the gallery / agent: the consignment party of the order).
- → F2 first three: inventory list with thumbnails, cartouche labels, sales report.

**Press / publications** (D3) — no press section today. Wanted: a press section linking each mention to **works, people and collaborations / events**. → D3 adds `publication_contact` and `publication_process`; hard copy = a vault scan.

**Map** (G) — have. Works in transit on the map: no need. Shipping: carrier tracking updates pushed by API → idea, parked.

**Work record** (A)
- Inventory: optional **taller rows** with more facts beside the thumbnail.
- Video links: yes. Audio: see glossary.
- « Profile page field », « Collections »: see glossary — both exist here under other names.

**Share kit** (F1) — Artwork Archive's private room has every display switch; that is the kit's model. Our kit today has one switch (price per work).

**Not here:** mailing / newsletter — no sending from the app today (deferred feature, needs Pem's GO; idea parked).

## Suggested build order

1. **A5 condition at a glance** + **C derived chips** (En transit, Accrochée) — no SQL, read only, quick wins.
2. **A1 date / size** + **A2 signature** + **A4 public text** — one additive SQL file on `Oeuvres`, one work-card pass, one `saveWork` / pending-keys pass, one anon GRANT review.
3. **F2 papers** (tear sheet, inventory list) — uses step 2's fields; lifts the public-only limit for team PDFs.
4. **D1 + D2 events / calls** — small columns + step templates; one Pipeline / events pass.
5. **E contacts** — after AI desk phase 3 lands (same files).
6. **F1 kit switches**, **F3 studio documents**, **A3 media**, **D3 bibliography** — each small, each its own GO.
7. **G insights** — after the data above exists.
8. **B editions** and **C Stolen fate** — touch order guards / fate triggers; at the first real edition / theft, high-effort SQL review.
9. **A6 wholesale** — only if (b) is chosen; (a) rides with F2.

10. **J reverse pricing** — design draft first (it decides A6).

## Pem's answers (2026-11-19, form + spoken)

| # | Question | Answer → what it changes |
|---|---|---|
| 1 | Uncertain date | **Both**: a « vers / c. » tick and an optional free text (`date_circa` + `date_display`) |
| 2 | Signature | **Position list + text** (b.d. / b.g. / h.d. / h.g. / verso / châssis… then a note) |
| 3 | Video | **Links only** — no video files in R2 |
| 4 | Public text | **FR and EN both required** before it shows |
| 5 | Condition words | **Ours** (excellent, good, fair, poor, critical) |
| 6 | Wholesale | Open → becomes **J. Reverse pricing** below |
| 7 | Editions | **To build, not right now** — after the steps 1–7 of the build order |
| 8 | Edition copies | **Sold by Pem → each copy tracked** (number, buyer, where). **Sold outside** (gallery, publisher) → counts, plus the buyer's details when we get them |
| 9 | Stolen | **Its own status** (12 « Volée »), weighed against the database work: it was not there (only 9 Destroyed, 10 Lost). Same path as Lost: an admin constat of kind `stolen` → status 12, never public, history line, insurance claim with police report |
| 10 | Fees | A call's fee is **information** first (a field on the event / call: amount, who pays). It becomes an **expense only once paid** (linked to the event) |
| 11 | Press authors | **Contact** when the article is worth it, else a typed name. Later: a process that pulls the author's contact details (AI desk) |
| 12 | Contact tags | **Free with suggestions** (autocomplete from tags already used) |
| 13 | Kit switches | Open — explained below (K) |
| 14 | Studio documents | **Both**: Pem's files stay in the vault; a **CV generated** from events, calls, press and collections, kept up to date by the data |
| 15 | Income chart | **Money received**, by payment date |
| 16 | PDF with a non-public work | **Team makes it, admin approves** before it can be downloaded or sent |
| 17 | Sphère | **Several** spheres per person |

## J. Reverse pricing (new, from question 6)

Pem: think the price backwards — from what must come back to the studio, after discount, gallery commission and taxes, with every cost of making and running the work added — so no work is sold at a loss.

**Today:** per work `Prix`, `Discount`, `PrixFinal`, `tva_rate`; per order `commission_pct / _amount`, `price_final`, `shipping_charge`; costs in `expense` + `expense_oeuvre` (costs linked to works), supplies `stock_item` / `supply_order`; BNC in Fiscal. Nothing ties them into « what is left for Pem ».

**Proposal (to draft fully before any build):**
- A **price grid** per work and per channel (studio sale, gallery on consignment, fair, online): list price → − discount → − commission → − VAT / social charges → **net to the studio**; then − direct costs (materials, framing, shipping, photo, run cost for an edition) − a share of the year's running costs (studio rent, insurance, fees) → **margin**.
- Run **backwards**: pick the net (or margin) wanted and the channel → the app gives the list price to ask, and the wholesale price for a gallery falls out of it (this answers question 6 without a fixed field).
- Shown on the work card price block (one line per channel, folded) and on the consignment paper (list / commission / net).

**Needs from Pem:** the cost items to count, the running-cost share rule (per work, per m², per hour?), the charges rate to use.

## K. Kit switches, explained (question 13)

A **kit** = the private link + PDF made for one person (Collector share kit). The **switches** are chosen **when you make the kit**, once, and decide **what that person sees** on the kit page and its PDF — not a condition for sending it, and not a filter on which works go in (you pick the works yourself, as today).

Example: a kit for a collector shows prices and provenance; a kit for an insurer shows condition, size, value; a kit for a curator shows exhibitions and press, no prices.

Proposal: three ready-made combinations to start from, each switch still changeable per kit:

| Switch | Collector | Gallery / curator | Insurer |
|---|---|---|---|
| Prices (per work, as today) | on | off | value |
| Sold works shown as « Vendu » | off | on | off |
| Provenance | on | off | on |
| Exhibitions and press | on | on | off |
| Condition | off | off | on |
| Signature | on | off | on |
| High-res download | off | on | off |
| Favourites (heart → enquiry) | on | off | off |

Password: skipped (the private link is already the secret).

## Pem asked for suggestions

1. **Build order:** step 1 (condition chip + « En transit / Accrochée » chips) is read-only and small — a good first GO. Step 2 (one SQL file: date, signature, public text, weight, formats with sizes) unlocks the papers.
2. **Reverse pricing before wholesale:** draft J next — it settles question 6 and feeds the sales report and the consignment paper.
3. **Contacts as relationships** (section I) is the largest piece — worth its own design draft (whole screen first, as for the work card) before the contact-field SQL.
4. **The full capture pass (H3)** is still worth doing once J and the contacts draft exist, to catch what neither covers.
5. **Social links bug (H1)** and **AI fill in Spanish (I)** are bugs for the lead now, not part of this batch.
