# An old work found again — the full flow

Status: **design note, nothing built, no SQL.** TODO §1 « « Ancienne — retrouvée » writes a dated line in Historique »
and « Marking a work « retrouvée » asks « Terminée ? » ». Pem 2026-11-27: « Historique shows latest date but should
show something more precise like found again » · « I changed to catalogued because it was considered so — maybe need to
ask if finished or not, to queue in the right place ».

## Which kind of thing, which home, what changes
- **Kind:** facts about one work, all already stored on it: `production_origin` (new / found), `Année`, the stage
  (`Catalogué` + `NeedsPhotograph`), the end of production (`production_completed_on` + precision), `Historique`.
- **Home:** the work. No new table, field, door or screen.
- **What changes:** when « Ancienne — retrouvée » is chosen, two short questions appear beside it — **« Année »**
  (optional) and **« Terminée ? » Oui / Non** — and the answer puts the work in the right production place at once.
  Historique gets one dated line saying the work is an old one, entered now.

## Scenario Pem can check (throwaway copy first for the SQL part)
1. Phone → Œuvre → Nouvelle œuvre → photo → « Ancienne — retrouvée ». Two lines appear under it: « Année » and
   « Terminée ? Oui · Non ». Type 1999, tap Oui, Enregistrer.
2. The card shows: retrouvée · 1999 · production ended 1999 · « Catalogué · photo à faire »; the Production board has
   it under Photographier; the period follows 1999. Historique: « [2026/11/27] Œuvre ancienne entrée au catalogue (1999) ».
3. Same with « Non »: the card shows « En production », start unknown, under Cataloguer on the board.
4. An existing work marked « Ancienne — retrouvée » in its card: the same two questions appear under the buttons; the
   answer saves at once (like the buttons). Historique gets the same line, written by the database.
5. « Oui » on a work with no photo: it stays « En production » and the card says « Ajoutez une photo pour la
   cataloguer » (rule 2: Catalogué needs a photo).

## The rules it follows (WORK_RULES)
- Rule 2 (Catalogué needs a photo) — checked by the door, as on the card and the board.
- Rules 5, 6 (status and tasks follow the stage) — the database already does it; nothing new.
- Rule 8 (finished = the day it becomes Prêt): a found work's end is its year when known (`precision` year), as Pem
  set by hand on #2412; never « today ».
- Rule 14 (Historique written by the database): on a change to « found » the database writes the line
  (`oeuvre_history`). At creation, the app writes the first line as it does today (« [date] Atelier ») — for a found
  work it becomes the found line instead.

## Wording — needs Pem
« Retrouvée » is already written by the database for a **lost work found again** (`oeuvre_history`, fate branch:
« [date] Retrouvée »). Reusing it would mix two stories. Proposed: « Œuvre ancienne entrée au catalogue (1999) ».
Other choices: « Ancienne œuvre retrouvée (1999) » · « Redécouverte (1999) ».

## Flow trace (to confirm with the flow reviewer at build time)
- **Input:** phone add form (`WorkRecordPhone.tsx`), desk new-work form (`WorkForm.tsx`), drawer production line
  (`WorkProductionSpan.tsx`).
- **Writers:** `saveWork` create (origin, `Année`, `Catalogué` / `NeedsPhotograph` when « Oui » and a photo, end = year,
  first Historique line); `setProductionOrigin` (gains « Terminée » + year; refuses Catalogué without a photo);
  `oeuvre_history` trigger gains one branch: `production_origin` changed to 'found' → the line (SQL, Pem's OK).
- **Triggers that follow:** `oeuvre_production_span` (end ≥ start; no start for found), `oeuvre_status_follows_stage`,
  `oeuvre_tasks_follow_stage` (Photographier opens), `oeuvre_version_snap`, period search text re-mark.
- **Readers:** the card (production line, Historique, stage), Production board columns, Inventory (Période, origin,
  stage filters), Journal change lines, PDFs / exports that print Historique (portfolio, archive export), the public
  site only through status (rule 13: En production stays private).
- **One-off:** #2410–#2412 (set by hand tonight) get the line once, with Pem's OK.

## Open for Pem
1. The wording of the Historique line.
2. « Terminée ? » asked but optional (no answer = « En production », as today), or required before saving?
3. The one-off line for #2410–#2412.
