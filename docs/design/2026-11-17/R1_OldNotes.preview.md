# Old work notes → lines: preview (R1 step 7, 2026-11-17)

**Nothing has moved.** This is a dry run on live data, read only, so you can decide how the old text should read as lines (open question 3, chosen shape (a): one comment = one line, with author and date). Script: [`scripts/old-notes-to-lines.mjs`](../../../scripts/old-notes-to-lines.mjs) (`node scripts/old-notes-to-lines.mjs`, read-only; it has no write mode).

## How it splits

- One line per paragraph (line break) of `Commentaires` and of `Historique`.
- **Date:** the date written in the line when there is one (`[22/04/2026] …`, `[2026/05/31] …`, `2026/06/03 - Pem - …`, `Broken 13/10/2026`); else the day the line first appeared in the version history; else none.
- **Author:** whoever saved the change that first showed the line (version history, since 2026-05-12); else unknown. The old text never recorded who wrote it.
- **Kind:** *note* (someone wrote it), *event* (the app wrote it: status change, session, place, gift, the `date - who - place` custody line), *placeholder* (`?` only).

## Counts (live, 2026-11-17)

| | |
|---|---|
| Works (not deleted) | 1 176 |
| Works with old text | **195** (100 with Commentaires, 119 with Historique) |
| Lines it would make | **259** (108 from Commentaires, 151 from Historique) |
| — notes | **106** (102 Commentaires, 4 Historique); 20 with a known author, 22 dated |
| — events (app-written) | **142**, all in Historique: 58 « Session terrain », 46 status / place changes « → », 22 custody lines, 16 others (« Statut : … », « Atelier », « Don à … ») |
| — placeholders (`?`) | 11 |
| Dated | 161 (142 from the text, 19 from the version history); 98 undated |
| Author known | 74; **185 unknown** (text older than 2026-05-12) |
| Longest | 7 lines on one work; most works: 1 line (97 of 100 Commentaires are a single line) |

## What it shows

1. **Historique is mostly the app's own log, not comments.** 142 of its 151 lines are status changes, sessions, places and gifts the app wrote. As lines they would fill the Fil with « En production → Disponible ». Options: leave Historique as it is (it is a log, already readable on the card); or move only its 4 hand-written lines (owners' names, « Perdu »).
2. **Commentaires are short notes** (median 9 characters: « Plein air », « Destroyed », « Avec 1248 », « Muybridge »). They fit one line each.
3. **Authors are mostly unknown.** Only text added since 2026-05-12 has one (all of it yours). The rest would show « auteur inconnu », or be written in your name as the catalogue's author — your call.
4. **One paragraph = one line can cut a thought.** #2381 « Pot chinois » would become 6 lines of one note. Alternative: one line per field per work (the whole Commentaires = one line).
5. **11 `?` placeholders** — drop them, or keep them as « à compléter »?

## Examples, before → after

| Work | Before | After (author · date — text) |
|---|---|---|
| #1323 | Commentaires: « Une copie carbone plutôt puis gratée, mangée par les limaces » | ? · date ? — Une copie carbone plutôt puis gratée, mangée par les limaces |
| #2142 Montagne Sainte Victoire | Commentaires: « Plein air » | Pem · 02/11/2026 — Plein air |
| #2336 | Commentaires: « Argile blanche et fil de fer. Très fragile ⏎ Broken 13/10/2026 » · Historique: « [30/04/2026] Statut → Private ⏎ [2026/10/31] Disponible → Archive artiste » | note: ? · date ? — Argile blanche et fil de fer. Très fragile · note: Pem · 13/10/2026 — Broken 13/10/2026 · event: ? · 30/04/2026 — Statut → Private · event: Pem · 31/10/2026 — Disponible → Archive artiste |
| #2287 | Commentaires: « Destroyed » · Historique: « [22/04/2026] Statut : En cours - Contact : Aucun contact ⏎ [28/04/2026] Statut : WIP ⏎ [2026/08/23] En production → Archive artiste » | note: Pem · 23/08/2026 — Destroyed · 3 events (22/04, 28/04, 23/08/2026) |
| #2381 Pot chinois | Commentaires: 6 short lines « To-do. ⏎ What of; real imagined. ⏎ Memory, photo ⏎ Palette inspiration ⏎ … » · Historique: « [2026/08/22] Session terrain » | 6 notes, each Pem · 01/11/2026 (« To-do. », « What of; real imagined. », …) · event: ? · 22/08/2026 — Session terrain |
| #2341 Golden boy | Historique: « [01/01/1999] Atelier ⏎ [01/01/1999] Marie Antoinette Maroselli ⏎ [15/03/2023] Estefania Ruiz Maroselli » | event: ? · 01/01/1999 — Atelier · note: ? · 01/01/1999 — Marie Antoinette Maroselli · note: ? · 15/03/2023 — Estefania Ruiz Maroselli |
| #302 Corail | Historique: « Delphine Moulin ⏎ [28/04/2026] Statut : Gift ⏎ 2026/05/21 - Moulin - Lausanne/Suisse » | note: ? · date ? — Delphine Moulin · event: ? · 28/04/2026 — Statut : Gift · event: Pem · 21/05/2026 — Moulin - Lausanne/Suisse |
| #2397 Stereoscopic self dyptich | Commentaires: « Preparatory drawing for stereo in red and white chalk » · Historique: « [2026/09/28] Session terrain ⏎ 2026/09/28 - Pem - Marseille, France » | note: ? · date ? — Preparatory drawing… · 2 events (28/09/2026) |
| #286 Etude | Commentaires: « ? » · Historique: « ? » | 2 placeholders |

(⏎ = line break. « Pem » = your account, as the version history records it.)

## To decide (Pem)

1. Historique: leave it as the work's log, or move it too (all of it / only its hand-written lines)?
2. Unknown author: « auteur inconnu », or your name?
3. One line per paragraph, or one line per field?
4. `?` placeholders: drop or keep?

Moving needs its own GO, and the work card must read the lines first (built in a parallel session). The old text would stay readable until then.
