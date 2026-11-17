# Old work notes → lines (R1 step 7, 2026-11-17)

**Moved, 2026-11-17** (Pem's GO « go all », confirmed in the side session): `node scripts/old-notes-to-lines.mjs --apply --expect 98` inserted the **98 `note_line` rows below (ids 1–98, 96 works)** in one insert. The old `Commentaires` / `Historique` text is untouched. A second run refuses (« already on their work »). Script: [`scripts/old-notes-to-lines.mjs`](../../../scripts/old-notes-to-lines.mjs).

## Your answers, as applied

1. **Historique** (« you choose what's best »): it stays the work's log. Only its hand-written lines move (one line each). The lines the app wrote (status and place changes, sessions, gifts, the `date - who - place` line) stay where they are, untouched.
2. **Unknown author** (« my name ok »): you, when the version history doesn't say who wrote it.
3. **Paragraphs** (« ok but should not impede readability »): one line per work for Commentaires, its paragraphs kept together with their line breaks. « Pot chinois » is one line.
4. **`?` placeholders** (« as you see fit »): dropped, whether the whole field is `?` or one paragraph of it.

**Date:** a date written in the text when there is one; else the day the text first appeared in the version history (kept since 2026-05-12); else **« avant mai 2026 »** (stored as created_at 2026-05-01T00:00Z, read by [`lib/note-line-dates.ts`](../../../lib/note-line-dates.ts) on the work card and in « Pour vous »). **Author:** whoever saved that change, else you.

## Totals (live, 2026-11-17)

| | |
|---|---|
| Works (not deleted) | 1 176 |
| Works with old text | 195 |
| **Works that get lines** | **96** (the other 99 have only the app's log or `?`) |
| **Lines** | **98**: **94 from Commentaires**, **4 from Historique** |
| Lines with several paragraphs (kept together) | 3 |
| Historique lines that stay as the work's log | 142 |
| `?` dropped | 6 whole fields, 11 paragraphs in all |
| Date from the text | 3 |
| Date from the version history | 12 |
| **No date: « avant mai 2026 »** | **83** |
| Author from the version history | 12 (all you) |
| Author unknown → you | 86 |

The old text stays on the work, unchanged. The 4 Historique lines that move: #302 « Delphine Moulin », #1302 « Perdu », #2341 « Marie Antoinette Maroselli » (01/01/1999) and « Estefania Ruiz Maroselli » (15/03/2023).

## Five lines as they read

| Work | Before | Line (author · date — text) |
|---|---|---|
| #2381 Pot chinois | Commentaires, 6 paragraphs | Pem · 01/11/2026 — To-do. ⏎ What of; real imagined. ⏎ Memory, photo ⏎ Palette inspiration ⏎ = Standard work of nota, tyvm WIP XXXXXXX ⏎ Proud of you - your qualities - as ever ; Golden footsteps*quattro* |
| #2336 | Commentaires « Argile blanche et fil de fer. Très fragile ⏎ Broken 13/10/2026 » · Historique: 2 status lines | Pem · 13/10/2026 — Argile blanche et fil de fer. Très fragile ⏎ Broken 13/10/2026 (the 2 status lines stay in the log) |
| #2142 Montagne Sainte Victoire | Commentaires « Plein air » | Pem · 02/11/2026 — Plein air |
| #1323 | Commentaires « Une copie carbone plutôt puis gratée, mangée par les limaces » | Pem · avant mai 2026 — Une copie carbone plutôt puis gratée, mangée par les limaces |
| #2341 Golden boy | Historique « [01/01/1999] Atelier ⏎ [01/01/1999] Marie Antoinette Maroselli ⏎ [15/03/2023] Estefania Ruiz Maroselli » | Pem · 01/01/1999 — Marie Antoinette Maroselli · Pem · 15/03/2023 — Estefania Ruiz Maroselli (« Atelier » stays in the log) |

Dropped: #286 Etude (Commentaires « ? », Historique « ? ») gets no line.

(⏎ = line break kept in the line.)

## Apply command (run once, 2026-11-17)

```bash
node scripts/old-notes-to-lines.mjs --apply --expect 98
```

One INSERT (all or nothing). It refuses with `--work`, without `--expect`, when the count differs, or when any of these lines is already on its work.
