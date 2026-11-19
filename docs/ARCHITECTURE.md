# Architecture map — rules, triggers, who writes what

_Read from the live DB (functions, triggers) and live code on 2026-11-12; triggers (§3, §4) and §7 re-read live 2026-11-18. Goal (brief phase 1 C): no more audits — **update this file in the same commit as any change to a rule, trigger or writer it describes.** Something learned later that this map did not anticipate goes in "Found later" at the end, dated._

Schema itself: always live (Supabase MCP / `lib/types/supabase.generated.ts`), never from this file. Custody detail: [`WORK_CUSTODY_MODEL.md`](./WORK_CUSTODY_MODEL.md).

## 1. Fate rule (read first)

A work's fate (destroyed / lost) has **one source**: an open condition report of kind `destroyed` or `lost` (`condition_report`, admin only).

| Piece | Where | Does |
|---|---|---|
| `condition_report_fate_check` (BEFORE, condition_report) | `condition_report_fate.sql` | Non-admin may not insert / update / delete a non-`examination` report → `fate_admin_only` |
| `condition_report_fate_sync` (AFTER, condition_report, security definer) | same | Mirrors the newest open destroyed/lost report on `Oeuvres.fate`, `fate_on`, `fate_precision`; first fate → `oeuvre_fate_close_orders` |
| `oeuvre_fate_guard` (BEFORE, Oeuvres, on `statusId`, `fate`) | `condition_report_fate.sql` + `oeuvre_fate_requires_constat.sql` | Fate set and status 1/2/3/4/7/8 → status 9 (destroyed) / 10 (lost), previous kept in `status_before_fate`. **Status 9/10 with no fate → `fate_requires_constat`** (2026-11-12) |

- Pem still owns the work (1 En production, 2 Disponible, 3 Archive artiste, 4 Réservé, 7 Consigné, 8 Prêt) → status becomes 9 / 10.
- Sold (6) / Gift (11) → status stays (buyer, price, provenance kept); only `fate` is set (chip suffix).
- Lost report resolved (`resolved_on`) or report deleted → status back to `status_before_fate` (default 2).
- A work with a fate is never public (`sync_is_public_from_status`).
- **Never write** `fate`, `fate_on`, `fate_precision`, `status_before_fate`, or status 9/10 from the app. The drawer does not offer 9/10; the DB refuses them without a fate.
- Journal (phase 2): any change from the journal goes through `saveWork` → these same triggers. No second notion of fate.

## 2. Statuses

`OeuvreStatus`: 1 En production · 2 Disponible · 3 Archive artiste · 4 Réservé · 6 Vendu · 7 Consigné · 8 Prêt · 9 Destroyed · 10 Lost · 11 Gift. (5 "Archive privée" removed 2026-11-03.)

Production stage (not a status): `Catalogué` + `NeedsPhotograph`. Cascade Cataloguer → Photographier → Disponible (see §5). **Rules of a work (states, moves, consequences, live checks): [`WORK_RULES.md`](./WORK_RULES.md)** — since 2026-11-17 (batch 1) the database sets the studio status from the stage, opens / closes the stage tasks, stamps a ticked task, dates the end of production at Prêt, sets tasks aside for archived / destroyed / lost works, and writes every Historique line and status event ([`work_state_rules.sql`](../supabase/sql/work_state_rules.sql)).

**Archive (3) = the shelf** (Pem 2026-11-17, [`archive_shelf.sql`](../supabase/sql/archive_shelf.sql)): put away, out of circulation, reversible.
- In only once catalogued (a partial record is fine) — the database refuses otherwise (`archive_requires_catalogue`); nothing ticks « Catalogué » by itself any more. Un-ticking « Catalogué » on an archived work is refused the same way.
- In: open `work_action` rows are **paused** (`paused_at`), kept, neither done nor open; a task added while archived starts paused; ticking one done clears the pause.
- Out of circulation: not public (`is_public`), not on the Production board or the pending-tasks report (open = `done = false` and `paused_at is null`), not in the work-session picker, not offered for sale or gift.
- Out, to the studio (status 1 or 2): paused tasks come back. Straight to Disponible only with the photo done (`archive_exit_requires_photo`); otherwise En production — the work card's production row is the choice (Atelier / Catalogué · photo à faire / Disponible). Out through a destruction / loss constat: tasks stay paused.

## 3. Triggers on `Oeuvres` (BEFORE triggers run in name order)

| Order | Trigger | Fires on | Does |
|---|---|---|---|
| 1 | `oeuvre_version_snap` → `snapshot_oeuvre` | every UPDATE | OLD row → `oeuvre_versions` (snapshot keys = real column names), `changed_by = auth.uid()` |
| 2 | `trg_enforce_anonymity_level` | INSERT/UPDATE | Unless `admin_override_anonymity`: status 1/2 → `anonymity_level` 0; status 3 → 2 |
| 2a | `trg_oeuvre_a_status_follows_stage` | INSERT; `statusId`, `Catalogué`, `NeedsPhotograph`, `fate` | Status 1 / 2 with no fate → 2 if catalogued and photo validated, else 1 (WORK_RULES rule 5, 2026-11-17) |
| 2b | `trg_oeuvre_archive_guard` | INSERT; `statusId`, `Catalogué`, `NeedsPhotograph` | §2 Archive: status 3 needs `Catalogué`; 3 → 2 needs the photo done. Errors `archive_requires_catalogue`, `archive_exit_requires_photo` (2026-11-17) |
| 3 | `trg_oeuvre_fate_guard` | `statusId`, `fate` | §1 |
| 3a | `trg_oeuvre_fate_not_showable` | INSERT; `fate`, `Exposable` | A fate set → `Exposable` false |
| 4 | `trg_oeuvre_field_defaults` | `LocalisationID`, `ContactID`, `Profondeur`, `Encadree`, `Montee`, `Technique` | No holder → owner (else Pem 13); empty depth, not framed/mounted/sculpture → `0.1` |
| 5 | `trg_oeuvre_holder_check` | `statusId`, `ContactID`, `LocalisationID` | 1/2/3: Pem owns + holds. 4: Pem owns. 7/8: custodian ≠ Pem + active custody order. 6: owner ≠ Pem + paid sale order; custody to buyer only on delivery. 11: owner ≠ Pem. Errors `custody_order_required`, `holder_required`, `sale_order_required` |
| 6 | `trg_oeuvre_location_by_stage` | `statusId`, `Catalogué`, `NeedsPhotograph`, `LocalisationID`, `localisation_address_id`, `fate` | Address must belong to the holder. Holder ≠ Pem with one address → that address. Pem: address follows stage (Atelier in production, Principal from Disponible) unless picked by hand |
| 7 | `trg_oeuvre_production_span` | `Catalogué`, `NeedsPhotograph`, `statusId`, `Année`, `production_started_on`, `production_completed_on`, `production_started_precision`, `production_completed_precision` | Becomes Prêt (catalogued + photo validated) → `production_completed_on` = today (precision reset to day); leaves Prêt → cleared + "Reprise en production" line in `Historique` (WORK_RULES rule 8, 2026-11-17; was: at cataloguing). `Année` empty → year of completion. End before start → error. Start / end can be a year or month (stored 1 Jan / the 1st + precision; null = day, [`oeuvres_production_precision.sql`](../supabase/sql/oeuvres_production_precision.sql), 2026-11-14). Status 1 also covers « catalogued, photo still to take » (`NeedsPhotograph`) — screens must word it from `Catalogué`, not from the status label |
| 8 | `trg_oeuvre_soft_delete_gate` | `deleted_at` | Soft-deleting a sold / gift work: admin only |
| 9 | `trg_sync_is_public` | `statusId`, `fate`, `Catalogué`, `NeedsPhotograph` | `is_public` = status in (2, 4, 6, 7, 8, 11) and no fate |
| 10 | `trg_zz_oeuvre_history` (security definer) | every UPDATE | Last BEFORE trigger: status line (« Vendu à X », « Réservé — X », « A → B »…), destroyed / lost / found / report removed, custodian line — appended to `Historique` unless already there (rule 14) |
| after | `trg_oeuvre_archive_tasks` (security definer) | `statusId` | Into 3 / 9 / 10 → open `work_action` set aside (`paused_at`); out to any other status → back (rule 12) |
| after | `trg_oeuvre_bin_tasks` (security definer) | `deleted_at` | Into the bin → open `work_action` paused; restored → resumed unless status 3 / 9 / 10 (rule 18, [`bin_pauses_tasks.sql`](../supabase/sql/bin_pauses_tasks.sql), 2026-11-18) |
| after | `trg_oeuvre_tasks_follow_stage` (security definer) | INSERT; `Catalogué`, `NeedsPhotograph` | Cataloguer open ⇔ not catalogued; Photographier open ⇔ catalogued + photo to take (rule 6) |
| after | `trg_oeuvre_status_event` (security definer) | UPDATE where status changed | `system_log` STATUS_CHANGE, source `db` (rule 14) |
| after | `graph_register_oeuvre_node` / `graph_unregister_oeuvre_node` | INSERT / DELETE | Index node in `nodes` |
| after | `graph_oeuvre_embedding_dirty` | `Titre`, `Commentaires`, `Technique`, `Support`, `Année`, `production_started_on` | Marks the work's index text for re-embedding (`Commentaires` is retired and empty since 2026-11-18; note lines feed the index instead, §8) |
| after | `graph_sync_oeuvre_contact_edges` | `AcheteurID`, `ContactID`, `LocalisationID` | Graph edges work ↔ contacts |

Column-specific triggers (`UPDATE OF …`) fire on the columns **in the UPDATE statement**, not on values another trigger changes.

**Fields the app never writes:** `is_public`, `txtImageNameLink` (cover, from `tblImage`), `fate*`, `status_before_fate`, `production_completed_on` (auto), `anonymity_level` when status 1/2/3 (forced), `Oeuvres.theme` (dead; themes = `oeuvre_theme`).

## 4. Other triggers that write works or derived data

| Table | Trigger | Does |
|---|---|---|
| `tblImage` | `tblimage_cover_sync` | Keeps `Oeuvres.txtImageNameLink` = cover image |
| `contact_addresses` | `trg_contact_address_link_single` (security definer) | Contact left with one address → its works (≠ Pem, not deleted) without address get it (2026-11-12) |
| `condition_report` | §1 | Fate |
| `work_action` | `trg_work_action_before_write` (security definer) | Task added / reopened on an archived / destroyed / lost work → set aside; ticked → pause cleared, `done_at` stamped; unticked → `done_at` cleared (rules 7, 12) |
| `Contact` | `ensure_admin_flags_protected` | Only an admin may change `is_admin`, `is_team_member`, `IsTeamMember` |
| `work_order` | `trg_work_order_before_write` | Reference `V/D/P/C/G-YYYY-NNN` per kind and year (advisory lock), checks on update |
| `work_order` | `trg_work_order_after_step` (security definer) | Sale → paid / delivered, gift → handed over: the work's active lines on other open consignments / loans close as `sold` / `given` |
| `work_order_work` | `work_order_line_one_open` (security definer) | One open sale / gift and one open consignment / loan / entrusted per work; lock per work; error `ord_err_busy:#<work>` ([`order_race_guards.sql`](../supabase/sql/order_race_guards.sql), 2026-11-18) |
| `payments` | `payments_within_price` (security definer) | A sale's payments never pass price + shipping; order row locked; error `ord_err_overpaid` (same file). Both guard functions: EXECUTE only `postgres` / `service_role` since 2026-11-18 ([`order_race_guards_revoke.sql`](../supabase/sql/order_race_guards_revoke.sql)) — triggers fire for every role |
| `shipment` | `trg_shipment_before_write` | Stamps each step's time (`photos_at` … `delivered_at`, `cancelled_at`) on the step change |
| `supply_order` | `trg_supply_order_before_write` | Reference `A-YYYY-NNN` (locked once set); cancel rules |
| `invoice`, `invoice_order`, `expense` | `trg_invoice_before_write`, `trg_invoice_order_check`, `trg_expense_fiscal_year_default` | Invoice numbering and links; expense fiscal year default |
| `oeuvre_theme`, `working_group_work` | graph edge sync | Graph edges |
| `note_line`, `work_description`, `work_creation_step`, `work_period(_override)`, `work_source_link`, `place`, `tblImage` (palette) | `graph_*_text_dirty` | The work's index text is marked pending (§8) |
| `Contact`, `theme`, `concept`, `working_group`, `suivi_process` (exposition) | graph node register / dirty | Index nodes |

## 5. Who writes what (app)

| Writer | Writes | Notes |
|---|---|---|
| `saveWork` (`app/atelier/works/actions.ts`) | Most `Oeuvres` fields incl. `statusId` (one stage, no separate photo switch since 2026-11-17); no history line / status event / task sync of its own. `Historique` only when edited, merged with lines the database wrote since the card loaded it (`historique_base`, [`lib/historique-merge.ts`](../lib/historique-merge.ts), WORK_RULES batch 2) | Non-admin edits on existing works → `pending_changes` (keys in `lib/work-pending-keys.ts`); `baseline` = the work as the card opened it (`__base_json` from the drawer, kept through the offline queue; validated by `parsePendingLoadedBase`), else as it is at save. Approval (`approvePendingChange`, Audit + Fil) writes only the proposed fields (`planPendingEdit`): `saveWork` gets the work as it stands with those fields overlaid (`formDataForPendingEdit`) and skips theme / group links not proposed (`__keep_themes` / `__keep_groups`, honoured for an admin only). A proposed field (or a linked one: price trio, stage set, custody set) changed since its base → `{ conflict }`, nothing written, until « Appliquer quand même » (`force`). Admin save from the work card: the card sends the `edited_at` that goes with its fields (`__base_edited_at` — the list row's, then each own save's; none after a restored draft); a save made elsewhere since → `work_changed`, a binned work → `work_in_bin`, nothing written (checked before the write and on the UPDATE itself). No stamp sent (approval replay, new work) → no check. Sets `edited_at` / `edited_by`; `restoreOeuvreVersion` stamps them too (now + admin), never the snapshot's |
| Drawer pipeline stages | Status 1/2/3/4/7/8/6/11 via orders | 9/10 not offered |
| Production board (`Production.tsx` → server `production-board-actions.ts` since 2026-11-17; shows a refusal) | `Catalogué`, `NeedsPhotograph`, other tasks' fields; status and stage tasks follow in the database; drag-back (desktop, 2026-11-13) deletes the pending source row, adds the target row; onto Catalogue: `Catalogué=false`, `statusId=1` | Columns: not catalogued → Catalogue only; Photography needs catalogued; handling columns stack; forward onto Photography only by ✓ |
| AI desk (`queueAiJob`, `decideAiJob`, admin) · card capture (`commitBusinessCardCapture`, team: kind `card`) · PC agent (`scripts/ai-agent/index.mjs`, service role) | `ai_job` (desk / capture insert « waiting »; agent sets running → done / failed + `result` — card: `{ text, contact, model, log }`; desk or contact editor set `decision`), `ai_agent` (agent heartbeat, every minute) | Agent runs one job at a time; a job left « running » is marked failed when the agent restarts; one open job per kind + target (`ai_job_one_open`); a card job is refused unless its key is that contact's Vault card photo; a card suggestion reaches `Contact` only through the contact editor's Save (`lib/ai-card-suggestion.ts`: empty fields only, missing rows added) |
| Contact links: contact editor Save, Google import (`importContacts`), work card quick add (`WorkForm`), contact merge (moves rows) | `contact_websites` (url + label) and `contact_socials` (platform + handle) — the only stores; shown as one clickable row in the editor (`lib/contacts/contact-links.ts`) | `Contact.Website / Instagram / LinkedIn / Facebook / Twitter` are no longer read or written (2026-11-19; values copied by [`contact_links_from_columns.sql`](../supabase/sql/contact_links_from_columns.sql), columns kept until a drop gets its own OK); backed up by `npm run archive` (`private/`) |
| Contact merge (`mergeContacts`, admin; bulk « Fusionner » shown to admins only) → `merge_contacts(p_keep, p_lose)` ([`merge_contacts_fn.sql`](../supabase/sql/merge_contacts_fn.sql), definer, one transaction) | Kept `Contact`: empty fields from the lost one, `is_team_member` / `IsTeamMember` / `is_private` = OR, login moved if the kept has none; repoints `work_order` (first, for the holder check), `Oeuvres.ContactID / LocalisationID / AcheteurID`, `suivi_process`, `document`, `expense`, `shipment`, `stock_item`, `supply_order`, `private_link`, `page_view`, `contact_addresses`, `event_contact`, `contact_emails / phones / websites / socials` (duplicates dropped), `ai_job` card readings; deletes the lost `Contact` | Refused (nothing written): two logins, invoices on the lost contact. Any error rolls back the whole merge (2026-11-19) |
| Image descriptions (`describe_batch.py`, service role) | `work_description` (AI, unverified); feeds `oeuvre_search_text` → node pending | Never writes `Commentaires`; one row per work + cover + engine + prompt |
| Work drawer links (`WorkLinksSection`), See again **Link** | `tblrelations` (source = this work, target = other; `lib/work-links.ts` types: painted_on, derived_from, answers, series, diptych, influence, proximity) via `insertConstellationRelation` | Human links only; the Constellation draws unknown types with its default edge |
| Orders: sales, consignments, gifts, exhibitions | `statusId`, `ContactID`, `LocalisationID` | Through the holder check |
| Orders (`sales/orders-actions.ts`, `cascade-actions.ts`) | `work_order`, `work_order_work`, `payments`, `shipment`; `is_paid` follows payments (« Soldée ») | `advanceWorkOrder` moves only from the step it read; `recordOrderPayment` refuses more than price + shipping; cancel / return / closed by hand take the works off a shipment not yet left (2026-11-18); DB guards in §4 |
| Collector share kit (`/c/[token]`, service role after the token check) | `private_link` open / PDF counters, `inquiry.private_link_token` | Team makes / extends / revokes kits; visitors only read the frozen kit (2026-11-18) |
| Retention cron (`/api/cron/retention`, monthly, service role → `retention_page_view_inquiry()`) | Deletes `page_view` > 25 months; `inquiry` > 3 years with no contact email match, order, kit sent to a contact or still-live kit | Legal A.2 n° 3; SQL [`retention_page_view_inquiry.sql`](../supabase/sql/retention_page_view_inquiry.sql) **not applied** as of 2026-11-18 (needs Pem's OK) — until then the cron returns the error |
| Bulk edit (`BatchEditModal`) | Status 1/2/3, Pem address (no « gift » flag since 2026-11-17) | Archive: checks first and names the works not catalogued; « Catalogué »: names the works with no photo (WORK_RULES rule 2); nothing changes if one blocks (2026-11-17) |
| Image replace after retouch (`replaceWorkImage`, drawer) | `tblImage`: new `txtImageNameLink` (content-hash key, same `ImageID` / `SeqNo`), `DateAdded`, `sha256`, `palette`; `txtImageName` = the previous name when empty (keeps the shoot date « Photographiées ce jour » on `/hub` matches on) → cover trigger moves `Oeuvres.txtImageNameLink` | Old file pair stays in R2 at its key (backup, old links keep working; 2026-11-19). The landing hero follows by `hero_image_id` (`lib/seo/landing-hero-live.ts`), not the name stored in the site config |
| Thèmes page « Copier en groupe » / « Copier en thème » (`copyThemeToGroup`, `copyGroupToTheme` in `app/atelier/selection/actions.ts`, team, signed-in rights) | New `working_group` (+ `created_by`) + `working_group_work` (theme has no order: by work number; positions appended), or new `theme` + `oeuvre_theme` | Same name already there → `{ conflict }`, nothing written; the page asks, then adds only the missing works into it (2026-11-19, themes = creation, groups = business) |
| Field session apply (`app/atelier/session/actions.ts`) | New work (`Titre`, size, `Technique`, `Support`, `statusId` 1, `NeedsPhotograph`, `production_started_on`, `Historique`); images via `addWorkImage` | Existing works: size/technique/support display-only, never written back |
| Condition reports | `condition_report` → fate via §1 | Admin for destroyed/lost |
| Version restore (`restoreOeuvreVersion`, admin) | Snapshot row minus `OeuvreID`, `is_public`, `txtImageNameLink`, `created_at`, `fate*`, `status_before_fate`; `Historique` = the snapshot's text + every line written since | Refused while a fate is open (`fate_open`); a snapshot with status 9/10 and no fate is refused by the guard |

## 6. Derived values (display only, nothing stored)

- **Period** (`lib/work-periods.ts`, `workWhen` / `whenWithSteps` / `effectivePeriod`; same rule in SQL `oeuvre_search_text`): manual override, else the period containing the work's day — production end, else start (a month reads as its 15th, a bare year gives no day), else a real day in `Année`, else the last « Historique de création » line dated to the day — else its year (`Année`, else production start, else the last dated creation line). Lines spanning two periods → the card asks which. Overlaps: latest start wins.
- **Place made** (`effectivePlace`): the « Historique de création » route (`work_creation_step` places, in order), else the period's place.
- **Vault types**: counts and type lists ignore `.keep` folder markers; custom types get their own row.
- **Session journal compare / drawer version history**: diff of `oeuvre_versions` snapshots on real column names.

## 6b. Journal entries (2026-11-12, [`journal_entry.sql`](../supabase/sql/journal_entry.sql))

| Rule | Where |
|---|---|
| Team only; default visibility `team`; `private` = author + admins; nothing for anon | RLS on `journal_entry`, `journal_entry_link`; grants select/insert/update to `authenticated` only |
| Append only: `body`, `kind`, `event_on`, `event_precision`, `created_at`, `author_id`, `provenance`, `corrects_id` never change | `trg_journal_entry_guard` → `journal_append_only` |
| Never deleted | no DELETE grant + guard → `journal_no_delete` |
| Hide / visibility change: admin only | guard → `journal_admin_only` |
| Links entry → work or concept; immutable target; AI proposals later (`proposed_by 'ai'`, `validated_at` null) | `journal_entry_link`, `trg_journal_entry_link_guard` |

Writer: `app/atelier/(portal)/journal/entry-actions.ts` (`createJournalEntry` links works from `#1234` in the text; dictated text → provenance `voice`, verification `unverified`; `setJournalEntryHidden`). Reader: `getJournalDayExtras(day)` = entries + old Kaizen « Création » items created that day (`kaizen_item` section `creation`, read in place; new ideas go to Idées since 2026-11-18, `kaizen_creation_to_ideas.sql`) + voice notes + works changed (from `oeuvre_versions`, admin only by RLS). `listJournalSourceDays()` = days that have entries / Création items / voice notes; the journal index merges them with field-session days and today (a day with no session is not a DB row). UI: `components/atelier/journal/JournalDayExtras.tsx` in the journal day page. Compared fields: one list, [`lib/oeuvre-version-fields.ts`](../lib/oeuvre-version-fields.ts) (journal compare, drawer history, day changes).

## 7. Callable database functions (API exposure)

Every `public` function is reachable through PostgREST `/rest/v1/rpc/…` by any role holding EXECUTE; new functions get EXECUTE for PUBLIC by default — **revoke it in the same SQL file** unless signed-out visitors need it.

| Function | anon | authenticated | service_role | Why |
|---|---|---|---|---|
| `is_admin()`, `is_team()` | yes | yes | yes | Called inside RLS policies for every role; return the caller's own role only |
| `replace_oeuvre_themes`, `replace_oeuvre_work_groups` | no | yes (team checked inside) | yes | Work save |
| `graph_node_id`, `oeuvre_order_exists` | no | yes | yes | Constellation; holder-check trigger |
| `graph_upsert_relation_edge`, `node_search_text` | no | no | yes | Graph triggers (definer); embed worker |
| `receive_supply_order` | no | yes | yes | Supplies « Recevoir » (stock + cost in one step) |
| `merge_contacts` | no | yes (admin checked inside) | yes | Contact merge in one transaction ([`merge_contacts_fn.sql`](../supabase/sql/merge_contacts_fn.sql), 2026-11-19) |
| `private_link_count_open`, `private_link_count_pdf` | no | no | yes | Collector share kit counters (`/c/[token]`, server side) |

Source: [`security_definer_revoke_anon.sql`](../supabase/sql/security_definer_revoke_anon.sql) (2026-11-12). Trigger functions are not callable through the API.

**Signed-out table access (2026-11-13, [`anon_read_lockdown.sql`](../supabase/sql/anon_read_lockdown.sql)).** `anon` holds no rights on `Contact`, `tblrelations`, `work_action`. On `Oeuvres` it holds SELECT on these columns only: `OeuvreID`, `Titre`, `Année`, `Hauteur`, `Largeur`, `Profondeur`, `Technique`, `Support`, `Format`, `txtImageNameLink`, `statusId`, `is_public`, `deleted_at` (rows: public works, by RLS). No price, no notes, no contact ids. A signed-out page that needs another column → add it to the GRANT in the same commit, or it fails with `42501`. `Contact` rows: team, or your own (`auth_user_id`). Still open: `anon` write grants on most other tables (RLS is the only guard); a signed-in non-team account reads every column of public works.

Every function sets `search_path` (`set search_path to 'public'`) — new ones too ([`function_search_path_fix.sql`](../supabase/sql/function_search_path_fix.sql) fixed the last six, 2026-11-12).

## 8. Indexing

- `nodes` = one row per work, contact, theme, concept, working group, exhibition; text from `node_search_text`. Work text (2026-11-13, [`oeuvre_search_text_wider.sql`](../supabase/sql/oeuvre_search_text_wider.sql), function `oeuvre_search_text`) = title. note lines (all of the work's `note_line` bodies; the old `Commentaires` field until 2026-11-18, [`old_comments_retire.sql`](../supabase/sql/old_comments_retire.sql)). technique, support, year. themes (not those named like a working code, `^\d{4}[_-]`). period (override, else by year — same rule as `lib/work-periods.ts`). sources + note. `colours:` families ≥ 8 % of the cover image (max 4). Re-marked for indexing when `Titre`, `Commentaires`, `Technique`, `Support`, `Année`, `production_started_on` change, or a row of `oeuvre_theme`, `work_source_link`, `work_period_override`, or the cover / palette in `tblImage` changes (`graph_trg_oeuvre_child_dirty`). Renaming a theme / period / source does not re-mark its works (`npm run embed:worker -- --reembed-all`). Empty text → `skipped` (0 works on 2026-11-13; was 61).
- **Journal entries** (`node_type 'journal_entry'`, [`journal_entry_nodes.sql`](../supabase/sql/journal_entry_nodes.sql)): registered on insert; text = `body`, none when hidden or private (→ `skipped`, vector dropped). After each embed-worker pass, `journal_propose_links()` (service role) proposes, among the nearest works and concepts, those with cosine ≥ 0.60 **and** above that target's average closeness to all entries by a margin (hub correction, [`journal_link_threshold.sql`](../supabase/sql/journal_link_threshold.sql), 2026-11-12). Quieter since R1 step 7 (2026-11-17): the embed worker passes **1 work + 1 concept, margin ≥ 0.05** ([`scripts/embed-worker/config.mjs`](../scripts/embed-worker/config.mjs), env `JOURNAL_LINK_K` / `_MIN` / `_MARGIN`; SQL defaults 3 / 0.60 / 0.03 unchanged), measured on Pem's 17 accepted / 18 rejected; the score is not stored as `journal_entry_link` rows `proposed_by 'ai'`; an admin validates (`validated_at`) or rejects (`rejected_at`; `rejected_by` NULL = retired by that rule); nothing deleted. In search: the `entity` view labels them (first 80 chars, [`journal_entry_search.sql`](../supabase/sql/journal_entry_search.sql)); ⌘K hits open `/atelier/journal?day=`. Constellation: the canvas stays works-only; the selected work's side panel lists its validated entries (`ConstellationJournalEntries`).
- Not indexed: kaizen, voice notes, documents, suivi, work_action notes, image notes, condition reports, stock.

## Found later

- 2026-11-12 — the stage/address trigger only ran on work saves; address-side trigger added (§4).
- 2026-11-12 — status 9/10 could be written without a fate; guard added (§1).
- 2026-11-12 — 4 security-definer functions were callable signed-out (theme/group rewrite, graph insert, private text read); revoked (§7).
- 2026-11-17 — Batch 1 of [`WORK_RULES.md`](./WORK_RULES.md): #2381 was half-moved (the card held the stage twice); 21 open Cataloguer tasks on catalogued works, 1 missing Photographier, #2112's open task, 23 end dates on works not Prêt, 12 / 37 status changes with no history line, 4 with no event. Rules moved into the database ([`work_state_rules.sql`](../supabase/sql/work_state_rules.sql)), repaired ([`work_state_repairs.sql`](../supabase/sql/work_state_repairs.sql)); `is_gift` / `StageProduction` / `commercial_status` to drop after deploy ([`work_state_drop_duplicates.sql`](../supabase/sql/work_state_drop_duplicates.sql)).
- 2026-11-17 — Archive ticked « Catalogué » by itself (owner rule of 2026-11-03, `oeuvres_status_location_depth_rules.sql`) and left open tasks open on archived works (25 tasks on 25 works). Pem's rule of 2026-11-17 replaces it: catalogued first, tasks paused (§2 Archive, [`archive_shelf.sql`](../supabase/sql/archive_shelf.sql)); the 25 tasks were paused. Its two trigger functions are not callable through the API (EXECUTE revoked). Not yet in this map (to verify in the data-integrity walk): §5 lists 9 writers, the code has 27 files writing `Oeuvres` and 18 browser components writing tables directly.
- 2026-11-13 — signed-out visitors could read 31 contacts (all columns), every column of 836 public works (price, notes, owner / buyer ids), all `tblrelations` and `work_action` rows; closed (§7).
