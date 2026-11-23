# Work-change badges — who changed a work (design, 2026-11-23)

Status: **local draft**, design only. No code, no SQL applied. TODO « Now » item 2.
Mockup: [`WorkChangeBadges_Mockup.html`](./WorkChangeBadges_Mockup.html). SQL draft: [`supabase/sql/oeuvre_version_author.sql`](../../../supabase/sql/oeuvre_version_author.sql) (NOT applied).

## 0. Which kind of thing, which home, what changes (BuildingPrinciples §2)

- Kind: a **fact about a change** (who × which work × when). Not a new record.
- Home: the existing `oeuvre_versions` row — one row per UPDATE of a work, written by the trigger. No new table, no new door: the author is learned in the one place every write passes through (principle 1).
- Changes: one column (`changed_via`) + the trigger body; the Journal read adds `changed_by` to its select and splits lines by author; three screens draw one badge.

## 1. What is live today (read 2026-11-23, read-only)

| Piece | Live state |
|---|---|
| `oeuvre_versions` | `id, oeuvre_id, snapshot (OLD row), changed_by uuid, changed_at, source`. Admin-only SELECT (`is_admin()`), inserts only from the trigger. 11 713 rows. |
| `snapshot_oeuvre()` | BEFORE UPDATE, security definer: `insert (old.OeuvreID, to_jsonb(old), auth.uid(), 'trigger')`. Same as `supabase/sql/oeuvre_versions.sql`. |
| Trigger order | `oeuvre_version_snap` sorts before every `trg_*` BEFORE trigger → it sees the writer's own `new` values. |
| `Oeuvres.edited_by / edited_at / created_by` | exist. `edited_by`: 279 rows Pem, 3 Terena, 896 NULL. Set by `saveWork` (`app/atelier/works/actions.ts:662`), `restoreOeuvreVersion` (`version-actions.ts:115`, admin), create (`lib/work-create-core.ts:63`). Sticky: other writers leave the last person there. |
| `changed_by` filled? | Last 90 days: **564 with an author, 10 881 NULL**. The NULLs sit on bulk days (11-01: 1 172, 11-02: 4 688, 11-03: 3 549, 11-15: 1 177) — service-role / script writes, where `auth.uid()` is NULL. 5 930 of the NULL rows (55 %) changed nothing but stamps / Historique. |
| Team | 3 logins: Pem (Contact 13, admin), Terena Gill (939), Contact 964 (no first / last name). |
| Parked | `oeuvre_edit_stamp.sql` (not live, replaced by `planReadGuard`) — this design does **not** revive it: it moves no `edited_at`. |

Why the brief's « else the row's `edited_by` » needs one guard: `edited_by` is sticky. A cron or a service-role update that never touches it would be blamed on the last person who saved the card. So the row's `edited_by` counts **only when the writer stamped it in this very update** (`new.edited_at` distinct from `old.edited_at`).

## 2. The rule (one place: `snapshot_oeuvre`)

« Stamped » = the writer set `edited_at` **in this update** and `edited_by` is not null.

| # | Condition at the UPDATE | `changed_by` | `approved_by` | `changed_via` | Badge |
|---|---|---|---|---|---|
| 1 | signed-in admin, stamped, `edited_by` ≠ the admin (approval replay: `saveWork` sets `edited_by` = proposer via `__pending_author_id`) | proposer | admin | `approval` | proposer's initials + ✓ |
| 2 | `auth.uid()` set (any signed-in request, also inside definer RPCs such as `merge_contacts`, `save_contact`, and the `tblImage` cover trigger) | `auth.uid()` | — | `session` | person's initials |
| 3 | no uid, stamped (`restoreOeuvreVersion`; after the app change, every service-key action a person starts — Pem « who clicked as well ») | `new.edited_by` | — | `stamp` | person's initials |
| 4 | no uid, JWT role `service_role` or no JWT (cron routes, pg_cron, scripts, imports) | NULL | — | `machine` | ⚙ |
| 5 | anything else | NULL | — | `unknown` | « ? » |
| — | rows written before the SQL | unchanged | — | NULL | none (« non enregistré » in the drawer) |

No backfill: the past is not guessed (principle 3). Rule 1 only trusts a different `edited_by` from an admin, so a team member cannot put someone else's name on a change.

## 3. Flow trace

**Input** — any UPDATE of `"Oeuvres"`.

**Writers** (all pass through the trigger; each lands in row 1–3 above):
- Signed-in client (`createClient`, row 1): `saveWork` (`works/actions.ts:694`), bin / restore from bin (`:192 / :214 / :239`), production board (`production-board-actions.ts:90 / :134`), orders (`orders-actions.ts:518 / :577`), condition, field, fil, kits, triage, journal entry, concepts, exhibitions, cascade, AI, coa-verify, `oeuvre-historique`, definer RPCs (`merge_contacts`, `save_contact`), `tblImage` cover trigger.
- Service client, with a stamp (row 2): `restoreOeuvreVersion`, pending approval replay (`saveWork` + `__skip_review`).
- Service client, a person clicked (« machine » today → **changed: they stamp `edited_by` = the signed-in user + `edited_at` = now**, Pem 2026-11-23): portfolio publish (`portfolio/actions.ts:300`), broadcast confirm / queue routes (`app/api/inventory/broadcast/*`), selection (`selection/actions.ts:177–261`), plus any other the build's scout finds. Moving `edited_at` is true (the work did change); the card plans field by field (`planReadGuard` does not guard `edited_at`), so it only makes an old no-base draft refuse, which is right. Not the card's own side writes (the reason `oeuvre_edit_stamp.sql` was parked).
- Service client, nobody clicked (stays ⚙): cron `return-window` / `retention`, scripts, imports.
- Approval (`approvePendingChange`, `pending-actions.ts:336 / :391`): already sends `__pending_author_id` → `saveWork` stamps `edited_by` = proposer; no app change, rule 1 reads it.

**Triggers** — `oeuvre_version_snap → snapshot_oeuvre` (changed here). Nothing else reads `changed_by`.

**Readers of `oeuvre_versions`** and what changes:

| Reader | File | Change |
|---|---|---|
| Journal stream / day page — change lines | `lib/journal/day-read.ts:240` (select `oeuvre_id, changed_at, snapshot`), grouping `:306–330`; screens `components/journal/JournalStream.tsx:749`, `JournalPhone.tsx`, old `components/atelier/journal/JournalDayExtras.tsx:835` | **yes** — select `changed_by, changed_via`; group per (work, author) per day; `JournalDayChange` gets `by: { initials, name, hue } \| 'machine' \| 'unknown' \| null`; names from the `Contact` read the file already does for idea lines (`contactsRes`, `:251`). |
| Phone « Aujourd'hui » fold | `components/hub/TodayClient.tsx:509` (same `JournalDayChange`) | **yes** — same badge (shared component). |
| Journal day paging | `lib/journal/stream.ts:279` (`adminChangeDays`, only `changed_at`) | no |
| Day counts (`changedWorks`) | `day-read.ts:80` | no — a work is still one changed work, however many authors |
| Work history drawer | `components/atelier/WorkVersionHistory.tsx:110` (shows `source` today), `fetchOeuvreVersions` | **yes** — show the badge + name instead of « trigger » (`source` is always « trigger »). Note: a row's snapshot is the work *before* the change at `changed_at`; the author is of that change. |
| Restore | `restoreOeuvreVersion` (`version-actions.ts`) | no — reads `snapshot` only; its own write lands as row 2 (Pem). |
| Session journal compare | `app/atelier/session/actions.ts:1697–1706` | no (optional later) |
| Contact merge | `merge_contacts` rewrites ids inside `snapshot` | no |
| Overview Fil / phone Fil « fiche » items | `team-activity-actions.ts` reads `Oeuvres.edited_by`, not versions | no — separate stream; noted only |
| Types | `lib/types/supabase.generated.ts` | regenerate after the SQL |

## 4. The badge

- **Initials** from the author's `Contact` (`contactAcronym`, `lib/session-user.ts:19`): Pem → « PM », Terena Gill → « TG ». Contact 964 (« Dev profile ») → « DEV » (see below).
- **Colour per person**: a stable hue from the `ContactID` (fixed list of 6 hues that read on both themes, `color-mix` with `--bg1` for the fill, full hue for the text). Same person, same colour on desk, phone and drawer. Pem keeps the accent (`--ac`).
- **Machine** ⚙ on `--bg3`, text `--tx3`, title « Automatique (tâche planifiée, script ou import) ». **Unknown** « ? » dashed border. **Not recorded** (old rows): no badge on Journal lines.
- Size 20 px circle on desk, 22 px on phone (inside a ≥44 px tap row; the badge itself is not a button). `title` + `aria-label` = full name.
- Placement: left of `#1234` on each change line. **One line per work per day** (fields merged, as today); each author of that day gets a badge, in order of their first change, overlapping by 3 px; more than 3 → « +n ». Pem 2026-11-23.
- **Approved proposal**: the proposer's badge with a small ✓ in the corner; title « Proposé par Terena Gill · validé par Pierre Emmanuel Moulin ». Pem 2026-11-23.
- Day summary « PM 12 · TG 3 · ⚙ 40 » with a filter: **later** (Pem 2026-11-23) — not in v1.
- Contact 964 = « Dev profile » (`dev@local.test`, private, team, no first / last name): most likely the logged-in test login (`ATELIER_E2E`, « logged-in dev profile » in CLAUDE.md) — to confirm. Private contacts are left out of the contacts search, hence « 964 returned nothing ». Badge « DEV » in grey, title « Profil de test ».

## 5. Build steps (after Pem's GO)

1. SQL on the Docker copy: apply `oeuvre_version_author.sql`, run the proof a–e at its foot.
2. `day-read.ts`: select `changed_by, approved_by, changed_via`; keep one line per work per day, collect its authors (`JournalDayChange.by: Author[]`, first change first); resolve names with the existing Contact read.
2b. Service-key writers a person starts: stamp `edited_by` (signed-in user) + `edited_at` (now) in the same write. Scout lists them; builder edits; flow-reviewer checks every caller.
3. One `AuthorBadge` component (initials / ⚙ / ?), FR + EN copy (`defineMessages`), used by `JournalStream`, `JournalPhone`, `TodayClient`, `JournalDayExtras`, `WorkVersionHistory`.
4. `npm run gen:types`, `typecheck`, `lint`, `i18n:check`; field e2e at 375 px.
5. `flow-reviewer` on the diff + this trace; `docs/ARCHITECTURE.md` row 1 of the trigger table updated (rule §2).
6. SQL live only with Pem's OK, push in the same minute.

## 6. Scenario Pem can check (after landing)

1. Open a work card on the desk, change the title, save. Journal → today: the line `#1234 Titre` carries **PM** in your colour.
2. On the phone, change the same work's location. Today's page: still one line for that work, one **PM** badge, fields merged.
3. Ask Terena to change a price on that work (a proposal). Before you approve: nothing new in the Journal. After you approve: the same line now shows **PM TG✓** — the ✓ on Terena's badge says you approved it; hover shows both names.
4. Publish a portfolio. Today's page: the works whose « portfolio » flag moved show **PM**, not ⚙.
5. Open the work's history drawer: each row shows the badge + name; rows older than today say « non enregistré ».
6. Restore an older version from the drawer: a new line with **PM**.
7. Log in as a team member: no change lines at all (unchanged — versions are admin-only).

## 7. Pem's answers (2026-11-23)

1. Same work, two people, same day → one line, two badges.
2. Colours → automatic (Pem = gold accent).
3. Service-key actions a person starts → record who clicked.
4. Day summary + filter → later.
5. Contact 964 → it is « Dev profile », the test login (see §4); badge « DEV ».
6. Approved proposal → the proposer's badge, with a ✓.
7. Saves that changed nothing → **skip them**: the trigger keeps no history row when only the edit date / editor moved (block live in the SQL draft; a hand edit of « Historique » still counts).

## 8. Still open

— nothing open in this design. Follow-up outside it (Pem 2026-11-23 « Move to test copy »): the « Dev profile » login (Contact 964) changed 18 live works (14 on 2026-11-13, 4 on 2026-05-25); tests that write must run against the throwaway Docker copy, not the live catalogue. Separate task (one-line TODO item for the lead).
