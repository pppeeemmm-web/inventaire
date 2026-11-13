# Design brief — Overview, Batch modify, Export (for Claude Design, 2026-11-13)

**App:** PEM atelier — private catalogue and studio tool for one artist (Pem) and a small team. ~1,180 works (paintings, pastels, drawings). Desktop = heavy work (tables, CRM, reports). Phone = field tool (capture, quick fixes).
**House style:** dense "mixing desk" — compact controls, everything visible at once, thin dividers, no decorative space. Existing tokens: `--bg0/--bg1` backgrounds, `--tx/--tx3` text, `--bd` borders; FR + EN copy (labels can be ~30% longer in French).
**What we want back:** one static mock per surface at 1440×900 (and 1280×800 must still fit), plus a phone variant where stated; a short note on the grid and the states. No code needed — the app team rebuilds from the mock.
**Why this pass:** the previous rounds only tweaked spacing; the owner wants each surface rethought as a whole.

---

## 1. Overview tab — a one-glance dashboard
**Problem today:** a long scrolling page of cards; you have to read it to know if anything is wrong.
**Goal:** like a cockpit / plant control panel — the whole state of the studio in one screen, **no scrolling at 1440×900**. Each block shows a signal first (OK · needs attention · wrong), the number second, the detail only on click.

Blocks that exist today (keep the data, rethink weight and placement; merge or drop if a block does not earn its place):
| Block | Data | "Wrong" means |
|---|---|---|
| Needs you | approvals waiting, field tasks, ledger items, works not catalogued, photos to validate, sessions to finish | any count > 0 (all zero = "all clear") |
| Catalogue health | works missing photo / dimensions / location / custodian address / technique / support / title / year | counts > 0, worst first |
| Integrity | duplicate / colliding records | any collision |
| Collection summary | total value, available, exhibitable, priced, works this year, by technique | informative, no alarm |
| Money | income vs expenses, net (BNC), cash health, financial pulse | negative trend / cash low |
| Pipeline & deadlines | active projects, next deadlines (overdue / today / in N days), calendar link | overdue |
| Reminders | follow-ups (overdue, today, tomorrow, in N days) | overdue |
| This week | what is planned / happened this week | — |
| Ideas | "burning ideas" with an energy level 1–5 | — |
| Recent documents | last files | — |
| See again | one older work resurfaced, with "link to another work" | — |
| Local jobs | voice notes waiting for transcription, search index backlog, days since last PC archive (alarm after 14 days) | backlog > 0, archive > 14 days |

Constraints: signals readable from 2 m (colour + shape, not colour alone); clicking a block opens the tab that fixes it. Phone variant: a single column of signal rows (label · count · dot), no charts.

## 2. Batch modify dialog — edit many works at once
**Context:** the user selects N works in the inventory and opens this dialog. Every field starts at "unchanged"; only fields set are applied. Admin-only fields are hidden for others.
**Fields:** status · year · title · technique · support · price · discount · commission · framed (yes/no/unchanged) · mounted · paid · gift · catalogued · exhibitable · needs photo · ready to broadcast · location detail · location notes · Pem address (with help text) · period (unchanged / automatic / none / a named period) · place made (new, a list of places) · themes (add/remove, search, new theme) · working groups · note to append (each work gets a new dated line, never overwritten).
**Problem today:** a tall modal with large gaps; the owner still sees dead space after a 3-column compaction.
**Goal:** every field visible without scrolling at 1440×900, dense like a mixer strip; the header says "Modify N works"; a footer with the count of fields that will change + Apply / Cancel. Make "unchanged" visually quiet and "will change" obvious (so a glance shows what Apply will do). Phone variant: one column, sticky Apply bar.

## 3. Export dialog — options + faithful preview
**Context:** from the batch dock, export the selected works as: PDF portfolio, catalogue sheet, labels, table (CSV/XLSX) — confirm the exact list with the app team.
**Goal:** Photoshop / InDesign logic — options docked on one side, a **live preview** of the real output in the middle (page format, image fit, layout), sample works allowed; switching the export type swaps the preview. Fits the screen without scrolling at 1440×900. Desktop only.
