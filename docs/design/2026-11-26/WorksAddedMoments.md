# Works added, shown in the Journal as moments

Status: **proposal — nothing built, SQL not applied.** TODO §1 « Journal: each added work is a moment « Œuvre ajoutée » ».
Pem 2026-11-24: « Show in journal new / found again works — they are moments as well in essence. »

## What kind of thing, which home, what changes
- **Kind:** a dated fact with no life of its own — « on this day, this work entered the catalogue ». That is a
  moment (People.md §4), not a Journal entry (Pem's notebook) and not a work field.
- **Home:** `moment` (exists) + `moment_work` (exists). One new kind, `work_added`. No new table, store, door or screen.
- **What changes:** the database writes the moment itself when a person creates a work (trigger, one transaction with
  the work); the Journal day already reads moments and shows them. « Nouvelle / retrouvée » is read from the work
  (`Oeuvres.production_origin`), so correcting the work (« Retrouvée » in the drawer) corrects the Journal.
- **Why not a column `Oeuvres.created_at`:** it would give a date but no Journal card; the Journal would need a new read
  of `Oeuvres` by day. The moment is the record of the event and the Journal already reads it (principle 9).

## Scenario Pem can check (throwaway copy first)
1. On the phone, « Œuvre » → « Nouvelle œuvre », title « Test retrouvée », tap « Ancienne — retrouvée », Enregistrer.
2. Open the Journal on the phone: today shows one card « Œuvre ajoutée · retrouvée » with the work's picture and
   number. No reload needed (the Journal fix of the same batch).
3. Add a second work without choosing: the card shows « nouvelle ».
4. Open the first work on the desk → drawer → « Nouvelle »: the Journal card now says « nouvelle ».
5. Purge the test work (admin): its card is gone from the day.
6. A team member's new work (waiting for approval) appears on the day Pem approves it, not before.

## Mockup (phone, one day)
```
── Mer. 26 nov. ──────────── 3 notes · 2 œuvres ajoutées
 ✍️ 10:12  Prado, salles 1–6 : Reni, Poussin…
 ＋ Œuvres ajoutées
    [img] #2412 Sans titre · retrouvée
    [img] #2413 Étude bleue · nouvelle
 🎤 11:40  « dessin perdu, Saint Sébastien… »
```
Several works added the same day are one card listing them (a field session can add ten), not ten cards.

## Flow trace
- **Input:** any creation of a work by a signed-in person: desk / phone form (`saveWork`, `app/atelier/works/actions.ts`),
  field session (`createWorkFromSessionFields`, `app/atelier/session/actions.ts`), shared draft
  (`app/atelier/share-triage/actions.ts`), approval of a team member's new work (replays `saveWork` as admin). All three
  insert with the person's own client, so `auth.uid()` is set. Scripts / imports (service role): no moment.
- **Writer:** trigger `oeuvre_added_moment` → `moment_on_work_added()` ([SQL](../../../supabase/sql/moment_work_added.sql)).
  Purge: `oeuvre_purged_moment` removes it.
- **Readers and what changes (code after the SQL is live):**
  - Journal day (`lib/journal/day-read.ts` moments block): also read `production_origin` for the moment's works.
  - Journal card (`components/journal/JournalStream.tsx`, moment card): label for `work_added`, one card per day for
    all `work_added` moments, « nouvelle / retrouvée » per work.
  - Stream paging (`lib/journal/stream.ts`): days whose only content is moments are not paged today
    (`journal_scale` does not count moments — true for calls and visits too). Add a `momentDays` read like
    `ideaChangeDays`, or count moments in `journal_scale` (SQL). « Mois » / « Années » counts: same gap.
  - Person timeline (`app/atelier/(portal)/contacts/person-timeline.ts`): reads moments through `moment_person`
    (inner join) — a `work_added` moment has no person, so it never shows there. Unchanged.
  - Moment sheet / `save_moment` door: their kind list stays the same, so `work_added` cannot be typed by hand. Unchanged.
  - Day counts in the day divider: count `work_added` as « œuvres ajoutées », not as moments.
  - A work soft-deleted (`deleted_at`) keeps its moment; the card should skip works with `deleted_at` set.
- **One-off:** the works added before (Spain, studio): their day comes from `nodes.created_at` (written at creation by
  the graph index). Numbers to read on live with Pem; SQL at the end of the file.

## Open for Pem
- One card per day listing the works (proposed), or one card per work?
- Older works (before this): only Spain + studio (proposed, as asked), or every work since the graph index exists?
