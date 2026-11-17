# Work rulebook — states, moves, and what must follow

**Pem's rules for a work, 2026-11-17. Build batch 1 applied (Pem's GO, SQL included): rules 5–8, 12, 14, 16 now enforced by the database. Verified against the live DB 2026-11-17 — every check in §2 at 0.**

Pem's rules for a work, one place. Each rule says where it is **enforced** — the database (every screen, phone, script obeys it), one screen only, or nowhere — and how many works **break it**. A rule enforced in one screen only is a rule that leaks: every break found on 2026-11-17 came from one.

Goal: every rule here enforced once, in the database (guard or automatic consequence), and checked by a query that must come back empty (`ship.ps1`, nightly, Audit — next). Custody details: [`WORK_CUSTODY_MODEL.md`](./WORK_CUSTODY_MODEL.md). Triggers in run order: [`ARCHITECTURE.md`](./ARCHITECTURE.md). SQL: [`archive_shelf.sql`](../supabase/sql/archive_shelf.sql), [`work_state_rules.sql`](../supabase/sql/work_state_rules.sql), [`work_state_repairs.sql`](../supabase/sql/work_state_repairs.sql), [`work_state_drop_duplicates.sql`](../supabase/sql/work_state_drop_duplicates.sql).

## 1. Two separate questions about a work

- **Where is the making?** — the production stage: **Atelier** (not catalogued) → **Catalogué · photo à faire** → **Prêt** (catalogued, photo done). Stored as `Catalogué` + `NeedsPhotograph`, with one task per open step (`work_action`: Cataloguer, Photographier).
- **Who has it, where is it shown?** — the status (`statusId`): 1 En production · 2 Disponible · 3 Archive · 4 Réservé · 6 Vendu · 7 Consigné · 8 Prêt · 9 Détruite · 10 Perdue · 11 Don.

In the studio (status 1 / 2, no fate), 1 / 2 are not chosen: the database sets them from the stage (rule 5).

## 2. The rules

| # | Rule (Pem) | Enforced | Breaks (2026-11-17, after batch 1) |
|---|---|---|---|
| 1 | The stage moves Atelier → Catalogué · photo à faire → Prêt; going back is allowed (Pem 2026-11-12) | Work card, Production board (through the server); everything that follows a move is in the database (rules 5–8) | — |
| 2 | Catalogué needs at least one photo | Work card, Production board. **Batch edit skips it** — next | 0 |
| 3 | Disponible needs the photo validated | **Database** (rule 5: no photo validated → En production) | 0 |
| 4 | Archive = the shelf: catalogued first, tasks paused, back out by choice (Pem 2026-11-17) | **Database** | 0 |
| 5 | In the studio, the status follows the stage: Prêt → Disponible, otherwise En production | **Database** (`oeuvre_status_follows_stage`) | 0 (#2381 repaired → Disponible, public) |
| 6 | Tasks follow the stage: Cataloguer open ⇔ not catalogued; Photographier open ⇔ catalogued with the photo to take | **Database** (`oeuvre_tasks_follow_stage`) | 0 (21 Cataloguer closed, #2264's photo task opened) |
| 7 | A ticked task keeps the day it was ticked | **Database** (`work_action_before_write`) | 95 old ticks keep no date (the day is unknown) |
| 8 | Finished = the day the work becomes Prêt; leaving Prêt clears it + a history line (Pem 2026-11-17) | **Database** (`oeuvre_production_span`) | 0 (23 dates cleared: 22 were the cataloguing day of works still waiting for their photo, + #2112). 1 076 Prêt works with no end date: unknown, kept empty |
| 9 | Owner / custodian / address follow the stage ([custody model](./WORK_CUSTODY_MODEL.md), Pem 2026-11-03; « Confié » R7 2026-11-17) | **Database** | 0 |
| 10 | A work leaves Pem only through an order: sale, deposit, loan, gift, « Confié » (R7) | **Database** + orders | 0 |
| 11 | A gift is status 11 | Status only; `is_gift` no longer written, dropped once the code is live | — |
| 12 | Destroyed / lost only through a constat; open orders close; destroyed closes its open tasks, lost pauses them (they come back if found, or if the report is removed as a mistake) | **Database** | 0 (#2112's task closed) |
| 13 | Public = Disponible, Réservé, Vendu, Consigné, Prêt, Don, with no fate | **Database** (now also when only the stage changes) | 0 |
| 14 | Every change of status, owner or custodian leaves a dated line in Historique and a status event | **Database** (`oeuvre_history`, `oeuvre_status_event`); the screens' copies removed | from now on, every change |
| 15 | Deleting a sold / given work: admin only | **Database** | 0 |
| 16 | « In production » means one thing everywhere | One function, by status id (`lib/production-scope.ts`): Production board, its report, the work-session picker. Display chips (`statusOf`) and the address rule keep their own job | 0 (#2112 no longer offered) |

## 3. Who writes a work's state

| Writer | Runs | Writes | Notes |
|---|---|---|---|
| Work card (`saveWork`) | server | everything | Sends one stage (#2381's cause gone); status, tasks, history, event, finished date: database |
| Production board | **server** (`production-board-actions.ts`) | the stage, tasks of other kinds | A refused save is shown and the board redraws from what the database kept. ✓ Photographier no longer forces Disponible on a Réservé / Consigné / Prêt work |
| Batch edit (`batchEdit`) | server (+ master key for themes) | status 1 / 2 / 3, Catalogué, photo flag… | Still skips rule 2 — next |
| Portfolio « rendre publique » | server, **master key** | status 1 / 2 → 2 | The database now turns it back to En production unless the photo is validated |
| Orders (R7) | server | status, owner, custodian | — |
| Constat (`condition-actions`) | server → database | fate → status, orders, tasks, history | — |
| Phone session / share-triage | server | new works (status 1) | The database opens their Cataloguer task |
| Old gift dialog (`gift-actions.ts`), old consignments (`consignments/actions.ts`) | server | status, owner, custodian | **No screen uses them since R7 step 2** — to delete (Pem's OK) |

Beyond the work's state: 27 files write the works table and 18 browser screens write tables directly; they come in the next walks (orders, sessions + Journal, contacts, supplies + accounts, public site).

## 4. Found on the way (not rules, but wrong)

- **Test works in the live database.** Five « TEST R7 … » works (#-911 to #-915) from the R7 step 2 session; three are not deleted (#-913, #-914, #-915). Their test orders took the first real numbers: V-2026-001 (delivered), D-2026-001, D-2026-002, P-2026-001 (signed, still open). The first real sale paper will be V-2026-002 (Q4).
- **The same fact stored twice:** `is_gift` beside status 11; the old `StageProduction` / `commercial_status` columns (305 / 63 works wrong, read by no screen, seen by exports and anyone querying the table).
- **The history you read is plain text** appended by 5 writers and 1 database rule; the database also snapshots every change (`oeuvre_versions`), but that is not what the card shows.

- **Why #2381 Pot chinois is half-moved** (traced 2026-11-17 from its snapshots, `oeuvre_versions`): on 16 Nov at 00:09 one save set « Catalogué » with the photo done but left the status at En production; one second later the card's task sync created « Photographier » already ticked (no date). The work card keeps the stage twice — the step you pick, and a separate « photo needed » switch — computes the status from the first and saves the photo flag from the second. When the two disagree (a restored unsaved draft does that: `applyDraftContentToForm` restores both apart), the status and the flags split. The card then shows both halves: the Production row lit on « Disponible » (read from the flags), « Studio (Pem) » and « Non public » (read from the status). Still possible today. Cure: rule 5 in the database + one stage state in the card.

## 5. Pem's answers (2026-11-17)

- **#2381**: the card shows it ready but it is still En production — a bug (above), to repair.
- **End of production** (was Q2): the work is finished the day it becomes **Prêt** — catalogued and its photo validated (for a studio work, the day it goes Disponible). Going back into production clears it, with a history line. The 1 076 catalogued works with no end date keep it empty: the day is unknown (their year stays).
- **Destroyed / lost** (was Q3): destroyed is forever → its open tasks are closed. Lost can be found → its tasks are paused, and come back if it is found. (If a destruction report was a mistake and is removed, its tasks come back too.)
- **Test works and orders** (was Q4): kept while R7 is still being built and tested; removed, with their numbers freed, when R7 closes — so the first real papers are V-2026-001, D-2026-001, P-2026-001.
- **History** (was Q5): Historique stays what you read, written **only by the database** on every change of status, owner or custodian; the screens stop writing it.
- **Duplicates** (was Q6): Claude's call — `is_gift` goes (status 11 says it); `StageProduction` and `commercial_status` go once nothing reads them (exports checked first).
- **Photo validation** (open, Pem 2026-11-17: « I decide if one picture is good enough to go ahead for broadcast or print »): proposal — validating the photo always means « good enough to show and communicate », whoever holds the work; it moves the status only from En production to Disponible. A Réservé / Consigné / Prêt work keeps its status (its order decides that). **To confirm.**

## 6. Next

- **The check queries** of §2 as one file run by `ship.ps1`, nightly and in Audit (must come back empty).
- Batch edit: rule 2 (catalogue needs a photo).
- Drop `is_gift`, `StageProduction`, `commercial_status` once the new code is live ([`work_state_drop_duplicates.sql`](../supabase/sql/work_state_drop_duplicates.sql)).
- Photo validation (§5) once Pem confirms it — today it already keeps a Réservé / Consigné / Prêt work's status.
- The work card writes back the Historique text it loaded: a line the database added after the card was opened can be lost when the card is saved. To fix with rule 14's follow-up.
- Delete the two dead writers (§3), Pem's OK.
