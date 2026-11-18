# Work rulebook — states, moves, and what must follow

**Pem's rules for a work, 2026-11-17. Build batch 1 applied (Pem's GO, SQL included): rules 5–8, 12, 14, 16 now enforced by the database. Batch 2 (code only, no SQL applied): the Historique write-back fixed, batch edit obeys rule 2, the checks of §2 as one read-only file + an Audit « Règles » panel (§7). Verified against live code and the live DB 2026-11-17 — every check at 0. `is_gift`, `StageProduction`, `commercial_status` dropped live 2026-11-17 (Pem: « Drop them »). Photo validation decided 2026-11-17 (§5).**

Pem's rules for a work, one place. Each rule says where it is **enforced** — the database (every screen, phone, script obeys it), one screen only, or nowhere — and how many works **break it**. A rule enforced in one screen only is a rule that leaks: every break found on 2026-11-17 came from one.

Goal: every rule here enforced once, in the database (guard or automatic consequence), and checked by a query that must come back empty: [`work_rules_checks.sql`](../supabase/sql/work_rules_checks.sql) and Audit → Règles (batch 2); `ship.ps1` / nightly wait for Pem's GO. Custody details: [`WORK_CUSTODY_MODEL.md`](./WORK_CUSTODY_MODEL.md). Triggers in run order: [`ARCHITECTURE.md`](./ARCHITECTURE.md). SQL: [`archive_shelf.sql`](../supabase/sql/archive_shelf.sql), [`work_state_rules.sql`](../supabase/sql/work_state_rules.sql), [`work_rules_checks.sql`](../supabase/sql/work_rules_checks.sql) (read only), [`work_state_repairs.sql`](../supabase/sql/work_state_repairs.sql), [`work_state_drop_duplicates.sql`](../supabase/sql/work_state_drop_duplicates.sql).

## 1. Two separate questions about a work

- **Where is the making?** — the production stage: **Atelier** (not catalogued) → **Catalogué · photo à faire** → **Prêt** (catalogued, photo done). Stored as `Catalogué` + `NeedsPhotograph`, with one task per open step (`work_action`: Cataloguer, Photographier).
- **Who has it, where is it shown?** — the status (`statusId`): 1 En production · 2 Disponible · 3 Archive · 4 Réservé · 6 Vendu · 7 Consigné · 8 Prêt · 9 Détruite · 10 Perdue · 11 Don.

In the studio (status 1 / 2, no fate), 1 / 2 are not chosen: the database sets them from the stage (rule 5).

## 2. The rules

| # | Rule (Pem) | Enforced | Breaks (2026-11-17, after batch 2) |
|---|---|---|---|
| 1 | The stage moves Atelier → Catalogué · photo à faire → Prêt; going back is allowed (Pem 2026-11-12) | Work card, Production board (through the server); everything that follows a move is in the database (rules 5–8) | — |
| 2 | Catalogué needs at least one photo | Work card, Production board, batch edit (refuses and names the works without a photo, batch 2). Not in the database | 0 |
| 3 | Disponible needs the photo validated | **Database** (rule 5: no photo validated → En production) | 0 |
| 4 | Archive = the shelf: catalogued first, tasks paused, back out by choice (Pem 2026-11-17) | **Database** | 0 |
| 5 | In the studio, the status follows the stage: Prêt → Disponible, otherwise En production | **Database** (`oeuvre_status_follows_stage`) | 0. #2381 Pot chinois: a first repair set it Disponible; after Pem (« I told you this work is in production ») it was put back by SQL — `NeedsPhotograph` = true → status 1 En production, not public, Photographier open, Cataloguer done, end date cleared, Historique restored to « [2026/08/22] Session terrain ». Pem then set it earlier himself (work card, 2026-11-18 03:41): En production, not catalogued, no photo to take |
| 6 | Tasks follow the stage: Cataloguer open ⇔ not catalogued; Photographier open ⇔ catalogued with the photo to take | **Database** (`oeuvre_tasks_follow_stage`) | 0 (21 Cataloguer closed, #2264's photo task opened) |
| 7 | A ticked task keeps the day it was ticked | **Database** (`work_action_before_write`) | 95 old ticks keep no date (the day is unknown) |
| 8 | Finished = the day the work becomes Prêt; leaving Prêt clears it + a history line (Pem 2026-11-17) | **Database** (`oeuvre_production_span`) | 0 (23 dates cleared: 22 were the cataloguing day of works still waiting for their photo, + #2112). 1 076 Prêt works with no end date: unknown, kept empty |
| 9 | Owner / custodian / address follow the stage ([custody model](./WORK_CUSTODY_MODEL.md), Pem 2026-11-03; « Confié » R7 2026-11-17) | **Database** | 0 |
| 10 | A work leaves Pem only through an order: sale, deposit, loan, gift, « Confié » (R7) | **Database** + orders | 0 |
| 11 | A gift is status 11 | Status only; `is_gift` dropped live 2026-11-17 | — |
| 12 | Destroyed / lost only through a constat; open orders close; destroyed closes its open tasks, lost pauses them (they come back if found, or if the report is removed as a mistake) | **Database** | 0 (#2112's task closed) |
| 13 | Public = Disponible, Réservé, Vendu, Consigné, Prêt, Don, with no fate | **Database** (now also when only the stage changes) | 0 |
| 14 | Every change of status, owner or custodian leaves a dated line in Historique and a status event | **Database** (`oeuvre_history`, `oeuvre_status_event`); the screens' copies removed. Since batch 2 no save drops a line the database wrote (§7) | 0 from 18 Nov (checked from then on). #2381's two status changes of 17 Nov have no line on purpose: the repair put its Historique back to its first line (rule 5) |
| 15 | Deleting a sold / given work: admin only | **Database** | 0 |
| 16 | « In production » means one thing everywhere | One function, by status id (`lib/production-scope.ts`): Production board, its report, the work-session picker. Display chips (`statusOf`) and the address rule keep their own job | 0 (#2112 no longer offered) |
| 17 | A destroyed / lost work is never « Exposable » (Pem 2026-11-17: « i turn it off, make this a rule ») | **Database** (`trg_oeuvre_fate_not_showable`, [`fate_not_showable.sql`](../supabase/sql/fate_not_showable.sql): « Exposable » forced off while the work has a fate; stays off if a lost work is found). Work card: the « Exposable » chip is closed with a tooltip | 0 (#2112 was already off) |

## 3. Who writes a work's state

| Writer | Runs | Writes | Notes |
|---|---|---|---|
| Work card (`saveWork`) | server | everything | Sends one stage (#2381's cause gone); status, tasks, history, event, finished date: database. Sends the Historique it loaded (`historique_base`): an untouched Historique is not written; an edited one keeps every line written since the card opened (batch 2) |
| Production board | **server** (`production-board-actions.ts`) | the stage, tasks of other kinds | A refused save is shown and the board redraws from what the database kept. ✓ Photographier no longer forces Disponible on a Réservé / Consigné / Prêt work |
| Batch edit (`batchEdit`) | server (+ master key for themes) | status 1 / 2 / 3, Catalogué, photo flag… | Rule 2: refuses Catalogué and names the works without a photo; nothing changes (batch 2). Never writes Historique |
| Portfolio « rendre publique » | server, **master key** | status 1 / 2 → 2 | The database now turns it back to En production unless the photo is validated |
| Orders (R7) | server | status, owner, custodian | — |
| Constat (`condition-actions`) | server → database | fate → status, orders, tasks, history | — |
| Phone session / share-triage | server | new works (status 1) | The database opens their Cataloguer task. Historique: one first line on the new work only, never written back |
| Version restore (`restoreOeuvreVersion`, admin) | server, master key | the snapshot's columns | Historique: the snapshot's text plus every line written since (batch 2) |
| Old gift dialog (`gift-actions.ts`), old consignments (`consignments/actions.ts`) | — | — | **Deleted by R7** (no longer in the code) |

Beyond the work's state: 27 files write the works table and 18 browser screens write tables directly; they come in the next walks (orders, sessions + Journal, contacts, supplies + accounts, public site).

## 4. Found on the way (not rules, but wrong)

- **Test works and orders: purged 2026-11-17** (R7 step 2 session, Pem's OK). Checked live: no work with a negative number or « TEST R7 » title; the only orders left are the 7 gift orders G-R-001…G-R-007 (handed over); `sale_order` and `consignment_order` empty. The first real papers will be V-2026-001, D-2026-001, P-2026-001.
- **The same fact stored twice** (resolved): `is_gift` beside status 11; the old `StageProduction` / `commercial_status` columns (305 / 63 works wrong, read by no screen). **All three dropped live 2026-11-17** (Pem: « Drop them »; [`work_state_drop_duplicates.sql`](../supabase/sql/work_state_drop_duplicates.sql), types regenerated). Old `oeuvre_versions` snapshots still hold them; version restore skips them.
- **The history you read is plain text.** Since batch 1 only the database appends to it (status, owner, custodian, fate, leaving Prêt); a new work gets one first line from the screen that creates it; a person can still edit it by hand on the card. Until batch 2 the card wrote back the whole text it had loaded, so a line the database added meanwhile could be lost — fixed (§7). The database also snapshots every change (`oeuvre_versions`), but that is not what the card shows.

- **Why #2381 Pot chinois is half-moved** (traced 2026-11-17 from its snapshots, `oeuvre_versions`): on 16 Nov at 00:09 one save set « Catalogué » with the photo done but left the status at En production; one second later the card's task sync created « Photographier » already ticked (no date). The work card keeps the stage twice — the step you pick, and a separate « photo needed » switch — computes the status from the first and saves the photo flag from the second. When the two disagree (a restored unsaved draft does that: `applyDraftContentToForm` restores both apart), the status and the flags split. The card then shows both halves: the Production row lit on « Disponible » (read from the flags), « Studio (Pem) » and « Non public » (read from the status). Still possible today. Cure: rule 5 in the database + one stage state in the card.

## 5. Pem's answers (2026-11-17)

- **#2381**: the card showed it ready but it was still En production — a bug (above). Put back by SQL after Pem's answer (rule 5 row): En production, catalogued, photo to take, not public. Checked live 2026-11-17.
- **End of production** (was Q2): the work is finished the day it becomes **Prêt** — catalogued and its photo validated (for a studio work, the day it goes Disponible). Going back into production clears it, with a history line. The 1 076 catalogued works with no end date keep it empty: the day is unknown (their year stays).
- **Destroyed / lost** (was Q3): destroyed is forever → its open tasks are closed. Lost can be found → its tasks are paused, and come back if it is found. (If a destruction report was a mistake and is removed, its tasks come back too.)
- **Test works and orders** (was Q4): kept while R7 is still being built and tested; removed, with their numbers freed, when R7 closes — so the first real papers are V-2026-001, D-2026-001, P-2026-001.
- **History** (was Q5): Historique stays what you read, written **only by the database** on every change of status, owner or custodian; the screens stop writing it.
- **Duplicates** (was Q6): Claude's call — `is_gift` goes (status 11 says it); `StageProduction` and `commercial_status` go once nothing reads them. **Done 2026-11-17**: all three dropped (Pem: « Drop them »).
- **Photo validation — decided 2026-11-17** (Pem: « I decide if one picture is good enough to go ahead for broadcast or print », then « whatever is best » → the lead's call): the rule stays as live. Validating the photo means « good enough to show and communicate », whoever holds the work. A studio work (status 1 / 2), catalogued + photo validated, becomes Disponible and public on `/works`; a Réservé / Consigné / Prêt work keeps its status (its order decides). Safeguard (batch 2): validating the photo of a studio work asks first — « Elle passera Disponible et sera visible sur le site. » — on the work card (« Catalogué · photo requise » → « Disponible ») and on the Production board's Photographier ✓.

## 6. Next

- **How repairs are done:** a repair that changes a particular work's status, stage or public visibility waits for Pem's answer on that work. Contradictory flags are never taken as the truth (#2381: the flags said Prêt, Pem said En production).
- **The checks run on their own** (Pem's GO 2026-11-17, built in batch 2, §7): nightly in GitHub Actions ([`work-rules-checks.yml`](../.github/workflows/work-rules-checks.yml), 03:47 UTC, after the 03:17 backup) — the job fails, so GitHub emails, when a rule returns rows, and prints the work ids; and in `ship.ps1` before a push, only when a DB URL is set locally (`SUPABASE_DB_URL`), otherwise « rule checks skipped (no DB URL) ». Both read only (`set transaction read only`). A break is a warning in `ship.ps1`, never a block.
- Rule 2 in the database (a guard on `Catalogué` needing a `tblImage` row) — would cover scripts and the Portfolio master key too; SQL, so Pem's GO.
- Dead code: `appendHistoriqueForOeuvres` / `historiqueLinesForOeuvreUpdate` and the line formatters in `lib/oeuvre-historique.ts` have no caller since batch 1 (only `contactDisplayName` is used) — to delete.

## 7. Batch 2 (2026-11-17) — what it did

_Verified against live code 2026-11-17 (this worktree) and the live DB 2026-11-17 (read-only checks)._

- **Historique write-back.** The work card (drawer and `WorkForm`) sends the text it loaded as `historique_base`. `saveWork` stores it through [`historiqueToStore`](../lib/historique-merge.ts): untouched → not written; edited and nothing new in the database → the person's text; edited while the database added lines → the person's text plus those lines. A restored session draft (its base unknown) and a queued change from before batch 2 send no base: every stored line the person's text lacks is kept. Queued (`pending_changes`) edits carry the base and are merged at approval. Version restore keeps every line written after the snapshot. Batch edit, the phone session and share-triage never write Historique back (new works only).
- **Batch edit, rule 2.** `batchEdit` refuses « Catalogué » when a selected work not yet catalogued has no photo, names them (« #… »), and changes nothing — like Archive.
- **Photo validation safeguard** (§5, decided 2026-11-17). On a studio work (status 1 / 2) not yet Disponible, moving the card's stage to « Disponible » (drawer and `WorkForm`, the step or the « photo requise » switch) and ticking Photographier ✓ on the Production board ask first: « Elle passera Disponible et sera visible sur le site. » (`hooks/useConfirmStep.tsx`, no `window.confirm`). Cancel leaves everything as it was.
- **Checks run on their own** (Pem's GO 2026-11-17). [`work-rules-checks.yml`](../.github/workflows/work-rules-checks.yml) runs nightly at 03:47 UTC [`scripts/work-rules-checks.sh`](../scripts/work-rules-checks.sh): the file inside `begin; set transaction read only; … rollback`, secret `SUPABASE_DB_URL` (as `backup.yml`); any row → the job fails and prints the works. `ship.ps1`, before a push: the same, only with `SUPABASE_DB_URL` (env or `.env.local`) and `psql` present, otherwise « rule checks skipped (no DB URL) » / « (no psql) »; breaks print as a warning, never a block.
- **Checks.** [`work_rules_checks.sql`](../supabase/sql/work_rules_checks.sql): one SELECT per rule of §2 (2–10, 12–14, 17 — added the same night), each returning the breaking works, meant to come back empty; 1, 11, 15, 16 hold no state to check (said in the file). Run live 2026-11-17: all empty (rule 14 checked from 18 Nov: #2381's repair of 17 Nov removed its lines on purpose). Audit → **Règles** (admin): runs the same checks (read only, [`lib/work-rules-checks.ts`](../lib/work-rules-checks.ts), through the API — no new SQL) and lists the breaks per rule with the work's thumbnail and title.
