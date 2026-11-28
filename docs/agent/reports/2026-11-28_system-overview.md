# System overview and data-quality report — 2026-11-28

Week 1 of the trial (`STATE.md`). Read only: every figure is a query of the live database on 2026-11-28 (project
`mcrzsxrcoexnlwmaunte`). Catalogue figures are exact counts (deleted works left out); the per-table row counts in §1
are Postgres estimates (`pg_stat_user_tables`), close but not exact. Nothing was written. Every fix in §3 is a proposal
that waits for Pem's GO.

## 0. In one paragraph

The catalogue is large and well imaged (1 180 works, all but 1 with an image), but the drawings — the strongest card
for « Saison du dessin » and Paréidolie — mostly have **no year**: 211 of 251 « Crayons », 61 of 62 « Graphite », 63
of 75 « Encre noire ». The recent works have the opposite gap: **no dimensions** on 148 of the 154 works dated 2025
and 139 of the 206 dated 2026. Half the catalogue has no theme (575). The sales side is empty by design (Pem has not
sold or promoted yet), not a data gap.

## 1. What the system holds (104 tables)

| Area | Tables (≈ rows) | Used? |
|---|---|---|
| **Catalogue** | `Oeuvres` 1 181 · `tblImage` 1 240 · `work_description` 1 175 · `oeuvre_theme` 1 297 · `theme` 27 · `Technique` 24 · `Support` 20 · `Format` 9 · `OeuvreStatus` 10 | Core, in daily use |
| History of works | `oeuvre_versions` 11 726 · `work_action` 807 · `work_period_override` 570 · `work_creation_step` 60 · `work_period` 4 · `pending_changes` 12 | Used; 12 team edits wait for approval |
| Graph / ideas | `nodes` 1 524 · `tblrelations` 3 797 · `concept` 29 · `concept_change` 16 | Used |
| **Journal** | `journal_entry` 64 · `journal_entry_link` 103 · `journal_entry_label` 2 · `voice_note` 26 · `note_line` 116 · `inspiration_photo` 11 · `work_session` 57 | Used, young (started 22/11) |
| People | `Contact` 62 · `contact_phones` 53 · `contact_emails` 32 · `contact_addresses` 40 · `contact_tag` 63 · `contact_sphere` 13 · `contact_websites` 13 · `contact_socials` 5 | Used; few art-world cards |
| Places | `place` 47 (40 addresses, 3 studios, 3 motifs, 1 other) · `place_address_map` 40 · `contact_place` 40 | Used; **no zone / shelf / box yet** (QR labels wait on this) |
| Pipeline | `suivi_process` 11 · `suivi_etape` 41 · `suivi_reminder` 18 · `working_group` 6 · `working_group_work` 85 | Used (applications, deadlines) |
| Studio | `stock_item` 235 · `studio_task` 8 · `expense` 7 | Used |
| Documents | `document` 97 · `storage_object_ledger` 79 | Used |
| Kaizen / system | `kaizen_item` 33 · `system_log` 1 373 · `ai_job` 13 · `page_view` 2 942 | Used |
| **Sales — empty by design** | `work_order` 9 · `invoice` 0 · `payments` 0 · `shipment` 0 · `supply_order` 0 · `inquiry` 4 | No selling yet (Pem 27/11) |
| Empty, built for later | `moment` 0 · `event_work` 0 · `event_contact` 0 · `calendar_*` 0 · `slideshow` 0 · `sketchbook` 0 · `private_link` 0 · `insurance_claim` 0 · `condition_issue` 0 · `saved_report` 0 | Not used yet |
| Laboratoire (new 28/11) | `recipe_ingredient` 0 · `recipe_step` 0 · `lab_assessment` 0 | Screens just landed; waits for Pem's content |

## 2. Data quality — ranked by what it blocks

| # | Gap | Count | What it blocks |
|---|---|---|---|
| 1 | **Drawings with no year** | Crayons 211 / 251 · Graphite 61 / 62 · Encre noire 63 / 75 · Pierre noire 27 / 49 · Pastel 29 / 41 · Feutre 14 / 14 | Every drawing dossier (Saison du dessin, Paréidolie, Documents d'Artistes): a work without a year cannot go in a CV-style list. Years are missing on 11 of the 15 works of the Therapeia / Paréidolie selection. |
| 2 | **Recent works with no dimensions** | 2026: 139 / 206 · 2025: 148 / 154 · 2024: 56 / 116 (before 2024: complete) | Any application asks the size; also the price per size and the shipping. By technique: Huile 112, Mixte 45, Crayons 32, Digital 22. |
| 3 | **No theme** | 575 / 1 180 works (Graphite 57 / 62, Pierre noire 40 / 49, Encre noire 50 / 75) · 9 empty themes | Series-based selections (« abarés », « strephó »…) and the public site groups miss half the catalogue. |
| 4 | **No technique** | 64 works (55 of them also have no dimensions) | Filters, counts by medium, dossiers by medium. |
| 5 | **To photograph** | 78 works marked « needs photograph » | Dossiers need good images; 1 work has none at all. |
| 6 | **Not catalogued** | 74 works | Unclear state; partly the found works (#2410–#2412 and others). |
| 7 | Contacts with no email / no phone | 36 / 62 · 26 / 62 | Outreach (prepared only, nothing is sent without Pem's written OK). |
| 8 | Team edits waiting | 12 `pending_changes` | Edits by the team not applied until approved in Audit. |
| — | **Titles: a question, not a gap** | 877 works have an empty `Titre`, and 874 of them have a description | Likely « sans titre » by practice; Pem to say whether a title is wanted for dossier works. |

Checked and clean: every work has a status and a place; only 1 work has no image; only 6 have no description.

## 3. Proposed fixes (each waits for Pem's GO)

1. **Years for drawings — a phone « year pass ».** One drawing at a time (image, series, neighbours' years), three
   taps: « 2019 », « c. 2019 », « je ne sais pas ». Starts with the 15 works of the selection, then by series. Needs
   « c. » for every date (already in TODO §1) so a guess is recorded as a guess. Suggested years can come from the
   work's creation day (`nodes.created_at`) or its session, shown as « suggested », never written without a tap.
2. **Dimensions for 2025–2026 — a measuring pass.** On the phone at the shelf: the work, two fields (H × W, cm),
   next. Oil first (112), then Mixte, Crayons. Same door as the work card (non-admin edits go to `pending_changes`).
3. **Themes — by series.** A desk view « works with no theme », grouped by technique and year, multi-select → add
   to a theme. The 9 empty themes: delete or keep (Pem).
4. **Technique for 64 works** — the same desk view, one select.
5. **Photograph list** — a filter « to photograph » (78), sorted by dossier priority, on the phone at the studio.
6. **Catalogue state** — Pem's word on the 74 « not catalogued »: found works to finish, or a status to set.
7. **Pending edits** — Pem reviews the 12 in Audit.

The two passes (1, 2) are the ones that unblock the dossiers; both are phone screens over existing doors (no new
table). Order proposed: 1 then 2, the selection's 15 works first.

## 4. How this was measured

Exact counts on `Oeuvres` (deleted left out) joined to `Technique`, `OeuvreStatus`, `tblImage`, `oeuvre_theme`,
`work_description`; contacts joined to `contact_emails` / `contact_phones`; table sizes from `pg_stat_user_tables`.
« No dimensions » = `Hauteur` or `Largeur` empty. Re-run monthly (`STATE.md` « What the data say »).
