# Architecture map — rules, triggers, who writes what

_Read from the live DB (functions, triggers) and live code on 2026-11-12. Goal (brief phase 1 C): no more audits — **update this file in the same commit as any change to a rule, trigger or writer it describes.** Something learned later that this map did not anticipate goes in "Found later" at the end, dated._

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

Production stage (not a status): `Catalogué` + `NeedsPhotograph`. Cascade Cataloguer → Photographier → Disponible (see §5).

## 3. Triggers on `Oeuvres` (BEFORE triggers run in name order)

| Order | Trigger | Fires on | Does |
|---|---|---|---|
| 1 | `oeuvre_version_snap` → `snapshot_oeuvre` | every UPDATE | OLD row → `oeuvre_versions` (snapshot keys = real column names), `changed_by = auth.uid()` |
| 2 | `trg_enforce_anonymity_level` | INSERT/UPDATE | Unless `admin_override_anonymity`: status 1/2 → `anonymity_level` 0; status 3 → 2 |
| 3 | `trg_oeuvre_fate_guard` | `statusId`, `fate` | §1 |
| 4 | `trg_oeuvre_field_defaults` | `LocalisationID`, `ContactID`, `Profondeur`, `Encadree`, `Montee`, `Technique` | No holder → owner (else Pem 13); empty depth, not framed/mounted/sculpture → `0.1` |
| 5 | `trg_oeuvre_holder_check` | `statusId`, `ContactID`, `LocalisationID` | 1/2/3: Pem owns + holds. 4: Pem owns. 7/8: custodian ≠ Pem + active custody order. 6: owner ≠ Pem + paid sale order; custody to buyer only on delivery. 11: owner ≠ Pem. Errors `custody_order_required`, `holder_required`, `sale_order_required` |
| 6 | `trg_oeuvre_location_by_stage` | `statusId`, `Catalogué`, `NeedsPhotograph`, `LocalisationID`, `localisation_address_id`, `fate` | Address must belong to the holder. Holder ≠ Pem with one address → that address. Pem: address follows stage (Atelier in production, Principal from Disponible) unless picked by hand |
| 7 | `trg_oeuvre_production_span` | `Catalogué`, `statusId`, `Année`, `production_started_on`, `production_completed_on` | Status 3 ⇒ catalogued. Catalogued → `production_completed_on` = today; un-catalogued → cleared + "Reprise en production" line in `Historique`. `Année` empty → year of completion. End before start → error |
| 8 | `trg_oeuvre_soft_delete_gate` | `deleted_at` | Soft-deleting a sold / gift work: admin only |
| 9 | `trg_sync_is_public` | `statusId`, `fate` | `is_public` = status in (2, 4, 6, 7, 8, 11) and no fate |
| after | `graph_register_oeuvre_node` / `graph_unregister_oeuvre_node` | INSERT / DELETE | Index node in `nodes` |
| after | `graph_oeuvre_embedding_dirty` | `Titre`, `Commentaires`, `Technique` | Marks the work's index text for re-embedding |
| after | `graph_sync_oeuvre_contact_edges` | `AcheteurID`, `ContactID`, `LocalisationID` | Graph edges work ↔ contacts |

Column-specific triggers (`UPDATE OF …`) fire on the columns **in the UPDATE statement**, not on values another trigger changes.

**Fields the app never writes:** `is_public`, `txtImageNameLink` (cover, from `tblImage`), `fate*`, `status_before_fate`, `production_completed_on` (auto), `anonymity_level` when status 1/2/3 (forced), `Oeuvres.theme` (dead; themes = `oeuvre_theme`).

## 4. Other triggers that write works or derived data

| Table | Trigger | Does |
|---|---|---|
| `tblImage` | `tblimage_cover_sync` | Keeps `Oeuvres.txtImageNameLink` = cover image |
| `contact_addresses` | `trg_contact_address_link_single` (security definer) | Contact left with one address → its works (≠ Pem, not deleted) without address get it (2026-11-12) |
| `condition_report` | §1 | Fate |
| `Contact` | `ensure_admin_flags_protected` | Only an admin may change `is_admin`, `is_team_member`, `IsTeamMember` |
| `shipment` | `trg_shipment_return_window` | Sale order return window from delivery |
| `sale_order` | `trg_sale_order_ref` | Order reference |
| `oeuvre_theme`, `working_group_work` | graph edge sync | Graph edges |
| `Contact`, `theme`, `concept`, `working_group`, `suivi_process` (exposition) | graph node register / dirty | Index nodes |

## 5. Who writes what (app)

| Writer | Writes | Notes |
|---|---|---|
| `saveWork` (`app/atelier/works/actions.ts`) | Most `Oeuvres` fields incl. `statusId` | Non-admin edits on existing works → `pending_changes` (keys in `lib/work-pending-keys.ts`); approval replays `saveWork` |
| Drawer pipeline stages | Status 1/2/3/4/7/8/6/11 via orders | 9/10 not offered |
| Production board (`Production.tsx`) | `work_action` done; `Catalogué`, `NeedsPhotograph`, `statusId` 1/2 | Columns: not catalogued → Catalogue only; Photography needs catalogued; handling columns stack |
| Orders: sales, consignments, gifts, exhibitions | `statusId`, `ContactID`, `LocalisationID` | Through the holder check |
| Bulk edit (`BatchEditModal`) | Status 1/2/3, Pem address | |
| Field session apply (`app/atelier/session/actions.ts`) | New work (`Titre`, size, `Technique`, `Support`, `statusId` 1, `NeedsPhotograph`, `production_started_on`, `Historique`); images via `addWorkImage` | Existing works: size/technique/support display-only, never written back |
| Condition reports | `condition_report` → fate via §1 | Admin for destroyed/lost |
| Version restore (`restoreOeuvreVersion`, admin) | Snapshot row minus `OeuvreID`, `is_public`, `txtImageNameLink`, `created_at`, `fate*`, `status_before_fate` | Refused while a fate is open (`fate_open`); a snapshot with status 9/10 and no fate is refused by the guard |

## 6. Derived values (display only, nothing stored)

- **Period** (`lib/work-periods.ts`): manual override, else the period containing `periodYearOf(work)` = `Année`, else the year of `production_started_on`. Overlaps: latest start wins.
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

Writer: `app/atelier/(portal)/journal/entry-actions.ts` (`createJournalEntry` links works from `#1234` in the text; dictated text → provenance `voice`, verification `unverified`; `setJournalEntryHidden`). Reader: `getJournalDayExtras(day)` = entries + Kaizen Création items created that day (`kaizen_item` section `creation`, read in place — Création stays in Kaizen, owner 2026-11-12) + voice notes + works changed (from `oeuvre_versions`, admin only by RLS). `listJournalSourceDays()` = days that have entries / Création items / voice notes; the journal index merges them with field-session days and today (a day with no session is not a DB row). UI: `components/atelier/journal/JournalDayExtras.tsx` in the journal day page. Compared fields: one list, [`lib/oeuvre-version-fields.ts`](../lib/oeuvre-version-fields.ts) (journal compare, drawer history, day changes).

## 7. Callable database functions (API exposure)

Every `public` function is reachable through PostgREST `/rest/v1/rpc/…` by any role holding EXECUTE; new functions get EXECUTE for PUBLIC by default — **revoke it in the same SQL file** unless signed-out visitors need it.

| Function | anon | authenticated | service_role | Why |
|---|---|---|---|---|
| `is_admin()`, `is_team()` | yes | yes | yes | Called inside RLS policies for every role; return the caller's own role only |
| `replace_oeuvre_themes`, `replace_oeuvre_work_groups` | no | yes (team checked inside) | yes | Work save |
| `graph_node_id`, `oeuvre_order_exists` | no | yes | yes | Constellation; holder-check trigger |
| `graph_upsert_relation_edge`, `node_search_text` | no | no | yes | Graph triggers (definer); embed worker |

Source: [`security_definer_revoke_anon.sql`](../supabase/sql/security_definer_revoke_anon.sql) (2026-11-12). Trigger functions are not callable through the API.

**Signed-out table access (2026-11-13, [`anon_read_lockdown.sql`](../supabase/sql/anon_read_lockdown.sql)).** `anon` holds no rights on `Contact`, `tblrelations`, `work_action`. On `Oeuvres` it holds SELECT on these columns only: `OeuvreID`, `Titre`, `Année`, `Hauteur`, `Largeur`, `Profondeur`, `Technique`, `Support`, `Format`, `txtImageNameLink`, `statusId`, `is_public`, `deleted_at` (rows: public works, by RLS). No price, no notes, no contact ids. A signed-out page that needs another column → add it to the GRANT in the same commit, or it fails with `42501`. `Contact` rows: team, or your own (`auth_user_id`). Still open: `anon` write grants on most other tables (RLS is the only guard); a signed-in non-team account reads every column of public works.

Every function sets `search_path` (`set search_path to 'public'`) — new ones too ([`function_search_path_fix.sql`](../supabase/sql/function_search_path_fix.sql) fixed the last six, 2026-11-12).

## 8. Indexing

- `nodes` = one row per work, contact, theme, concept, working group, exhibition; text from `node_search_text`. Work text (2026-11-13, [`oeuvre_search_text_wider.sql`](../supabase/sql/oeuvre_search_text_wider.sql), function `oeuvre_search_text`) = title. comments. technique, support, year. themes (not those named like a working code, `^\d{4}[_-]`). period (override, else by year — same rule as `lib/work-periods.ts`). sources + note. `colours:` families ≥ 8 % of the cover image (max 4). Re-marked for indexing when `Titre`, `Commentaires`, `Technique`, `Support`, `Année`, `production_started_on` change, or a row of `oeuvre_theme`, `work_source_link`, `work_period_override`, or the cover / palette in `tblImage` changes (`graph_trg_oeuvre_child_dirty`). Renaming a theme / period / source does not re-mark its works (`npm run embed:worker -- --reembed-all`). Empty text → `skipped` (0 works on 2026-11-13; was 61).
- **Journal entries** (`node_type 'journal_entry'`, [`journal_entry_nodes.sql`](../supabase/sql/journal_entry_nodes.sql)): registered on insert; text = `body`, none when hidden or private (→ `skipped`, vector dropped). After each embed-worker pass, `journal_propose_links()` (service role) proposes, among the 3 nearest works and 3 nearest concepts, those with cosine ≥ 0.60 **and** ≥ 0.03 above that target's average closeness to all entries (hub correction, [`journal_link_threshold.sql`](../supabase/sql/journal_link_threshold.sql), 2026-11-12) as `journal_entry_link` rows `proposed_by 'ai'`; an admin validates (`validated_at`) or rejects (`rejected_at`; `rejected_by` NULL = retired by that rule); nothing deleted. In search: the `entity` view labels them (first 80 chars, [`journal_entry_search.sql`](../supabase/sql/journal_entry_search.sql)); ⌘K hits open `/atelier/journal?day=`. Constellation: the canvas stays works-only; the selected work's side panel lists its validated entries (`ConstellationJournalEntries`).
- Not indexed: kaizen, voice notes, documents, suivi, work_action notes, image notes, condition reports, stock.

## Found later

- 2026-11-12 — the stage/address trigger only ran on work saves; address-side trigger added (§4).
- 2026-11-12 — status 9/10 could be written without a fate; guard added (§1).
- 2026-11-12 — 4 security-definer functions were callable signed-out (theme/group rewrite, graph insert, private text read); revoked (§7).
- 2026-11-13 — signed-out visitors could read 31 contacts (all columns), every column of 836 public works (price, notes, owner / buyer ids), all `tblrelations` and `work_action` rows; closed (§7).
