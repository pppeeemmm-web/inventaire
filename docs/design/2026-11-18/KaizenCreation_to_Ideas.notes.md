# Kaizen « Création » → Idées (R1), proposal 2026-11-18

Pem's GO (2026-11-18): fold Kaizen « Création » into Idées, as R1 says ([R1_InputsFeed.notes.md](../2026-11-17/R1_InputsFeed.notes.md) « The model »: Journal = Pem's inputs, **Idées** = creative ideas, team proposes, **Kaizen = business and system upkeep**, everything reaches the Fil). The lead session handed this to me; it does not touch Kaizen or Idées meanwhile.

**Nothing moved yet.** The 20 entries are not one kind of thing, so moving them is a choice per entry — below. Each move is a data write (own OK, `CLAUDE.md`); the Kaizen rows are **kept, marked moved** (not deleted) so nothing is lost and the Fil does not show them twice.

## What the 20 entries are (live, 2026-11-18)

Read as titles only; the text stays where it is until moved.

| # | Date | What it is | Done? | Proposed destination |
|---|---|---|---|---|
| 3 | 06-27 | #2313 — book-cover image annotation (Greek word, *dunamis*) | open | **Idée · Recherche**, linked to #2313 |
| 2 | 06-27 | #2313 — a book cover for « Masterly Connections » | done | **line on #2313** (work notes) |
| 1 | 06-27 | #2313 — « Self Portrait avec Panache » | done | **line on #2313** |
| 4 | 06-27 | #2313 — framework / a question on AI models (book project) | done | **Idée · Recherche**, linked to #2313 |
| 11 | 06-28 | #2074, #1988 — French cultural icons series | done | **Idée · Petite**, linked to #2074 |
| 10 | 06-28 | #2074 — French cultural heritage masterpieces | done | **line on #2074** |
| 5 | 06-28 | #2161–#2163 — autobiography tiles, palette sets | done | **Idée · Petite** (palette sets), linked to the 3 works |
| 6 | 06-28 | #2057–#2063 — autobiography sequence | done | **line on each of the 7 works** |
| 12 | 06-30 | « Bello » — a compliment | done | **stays in Kaizen, archived** (no idea, no work) |
| 13 | 07-03 | #2356 — « special blues » | done | **line on #2356** |
| 15 | 07-11 | « Qu'est-ce qui se passe » — inspirations, travel | open | **Idée · Recherche** |
| 17 | 07-15 | Title idea for #2205 (*eidó*) | open | **line on #2205** (title proposal, flagged for Pem) |
| 19 | 07-15 | Title idea for #219 (*haima*) | open | **line on #219** (title proposal, flagged) |
| 18 | 07-15 | Title idea for #1567, #1565 (*athleó*) | open | **line on both** (title proposal, flagged) |
| 22 | 08-22 | « TY » — a thank-you | done | **stays in Kaizen, archived** |
| 23 | 08-22 | #2382 — a comment on the work | done | **line on #2382** |
| 25 | 08-23 | #2384, #2383 — « the same artwork, 2 stages? » | done | **line on both** |
| 27 | 08-25 | « To-do ; Housekeeping » — review the Strong's word tests | open | **Kaizen · Opérations** (it is upkeep) |
| 28 | 09-10 | « Inputs » — notes for images with a skull | open | **Idée · Petite** |
| 32 | 10-21 | « Meet » — a meeting | open | **Kaizen · Opérations** |

Count: 6 → Idées (3 Recherche, 3 Petite), 10 → work lines (`note_line`, title ideas flagged for Pem), 2 → Kaizen Opérations, 2 → archived in Kaizen.

## What changes in the app (after the moves)

- Menu: the Kaizen group keeps **Audit** + **Opérations & Stratégie**; « Création » leaves (its badge too). `/atelier/kaizen` redirects to Idées.
- New team input with a creative subject goes through « Proposer une idée » (R1, built) — no « Création » choice in the Kaizen form.
- The Fil keeps reading open Kaizen entries (now only Opérations) and the new idea / work lines.
- The one Kaizen entry kept with the What's new title / button `{v}` (lead's edit of 2026-11-18 in `Kaizen.tsx`) stays as it is.

## Needs Pem

1. The table above — change any line (« this one is a Petite », « keep this in Kaizen »…), or « OK as is ».
2. Then one OK for the data writes (insert ideas / lines, mark the 20 Kaizen rows moved — no delete). The code change follows in the same batch.

## Done 2026-11-18 (Pem: « OK as written »)

- **Data** — [`kaizen_creation_to_ideas.sql`](../../../supabase/sql/kaizen_creation_to_ideas.sql) applied live (migration `kaizen_creation_to_ideas`) after a rolled-back dry run: 6 ideas in `concept` (weight as in the table; the author, the date and the works in its notes; dated as the entry), 18 work lines in `note_line` (#6 → 7 works, #18 → 2, #25 → 2; the 4 title-idea lines flagged for Pem; « (Kaizen Création #id) » at the end), #27 and #32 → Business (open), every Création row kept and marked done. Checked after: 0 Création entries open.
- **App** (worktree `pem-kaizen-1118`): « Création » out of the Kaizen menu group (desktop + phone) and its badge; `/atelier/kaizen` redirects to Idées (`?whatsnew=1` / `?view=…` → Opérations & Stratégie); the What's new popup link goes to `/atelier/kaizen-ops?whatsnew=1`; no « Création » choice for new Kaizen entries (default Business); the « Création (Kaizen) » fold left Aujourd'hui (always empty now); a past Journal day still shows its old Création entries, its link opens Idées; the System ledger link opens Système.
- **Not done**: `CLAUDE.md` « Narrow Atelier sidebar » still describes the Kaizen group with Création (lead's file); the Fil lists the 18 new work lines (the 4 flagged first), to sort like any line.
