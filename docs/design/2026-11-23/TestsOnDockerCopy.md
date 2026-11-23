# Tests that write run on the throwaway copy, not live

Status: §2A + §3 steps 1, 2, 5, 6, 7 built 2026-11-23 (`npm run test:e2e:stress`; auto-login on the copy only for the server that command starts). Open: §2B (B1 / B2 — B2 would also stop the LAN phone's real-account auto-login on live: Pem decides), §3 step 4 (`e2e:writes:check`, with the first `@writes` spec), step 8 (seeded snapshot). Was `local draft` (design only, no code). Pem 2026-11-23 « Move to test copy ». Evidence = live DB read-only (Supabase MCP), repo read; nothing applied, Docker copy not touched.

## 1. What the live DB shows (read only)

The « Dev profile » = auth user `cc9ca818-f57c-4117-a518-d5aafed075e8`, `dev@local.test`, created 2026-05-12, **last sign-in 2026-11-22 22:46** (still in use last night). It exists on **live**; the middleware signs it in on any `next dev` that has `DEV_AUTO_LOGIN_EMAIL/PASSWORD` in `.env.local` (`middleware.ts:96-125`, only `NODE_ENV=development`). So *every* dev server run on this PC, every Playwright run (`reuseExistingServer`, base `127.0.0.1:3000`), every browser check by a Claude session acts as this login against the live Supabase project.

### 1a. Version rows — 18 rows on **8 works** (the brief said 18 works: it is 18 rows)

| Rows | When (UTC) | Works | Changed keys (diff vs previous snapshot) | Matches |
|---|---|---|---|---|
| 83–86 (4) | 2026-05-25 20:08 | 2190 | `txtImageNameLink` (cover swapped to `W_2190_02_…avif`), then 2 no-op rows | a photo added to a real work from the drawer by hand — no spec does this |
| 10236, 10237, 10239, 10240 (4) | 2026-11-13 22:34:34–36 | 2407, 2406, 2404, 2403 | `Prix null→0`, `Discount`, `PrixFinal`, `NeedsPhotograph true→false`, (2406 `Largeur`→35), `Historique` `\n→\r\n` | a **full-form save** of field-captured works (new on 8–9 Nov): form normalises nulls and line ends |
| 10238 (1) | same | 2405 | none (no-op row) | same pass |
| 10241, 10242 (2) | 22:34:37 | 2402, 2401 | `localisation_address_id → 61` | a place set on those two |
| 10243–10249 (7) | 22:34:44–48 | 2407…2401 | `broadcast_ready false→true` | **batch modify « broadcast ready = Yes »** on the 7 works |

Reading: one operator, one browser session, two Apply clicks 10 s apart on works 2401–2407 (a block of consecutive new works), at 23:34 CET — six minutes before commit `60d8be9` (« batch modify rebuilt as a mixer », B2, 23:40 CET): the new batch UI was being tried on the live dev server before it was committed. **Not a committed spec**: `tests/batch-edit-broadcast-ready.spec.ts` clicks the tri-field then « Annuler » and never applies. Confidence: medium (timing + keys + commit time; the server log has no per-action trace to prove who clicked).

### 1b. Other live traces of the same login (not versions)

- `pending_changes`: 4 rows (2026-10-31 ×2, 11-14, 11-16) on works 2402, 2397, 2407 (« …R3test »); 2 approved → replayed `saveWork` on live works. The dev login is team, **not admin**, so its work edits go through the review queue.
- `system_log` (68 rows): 2026-05-12 vault upload on work 2342; 05-26/27 five `STATUS_CHANGE sale_order`; **2026-11-17 ≈ 60 rows of `ORDER_CREATED` / `STATUS_CHANGE` / `PAYMENT_GRAIN` / `VAULT_UPLOAD` on ~13 `work_order`s** (the order chain tried on live the day before the Docker copy existed). Today live holds 9 orders: 7 are the real « Reconstitué » gifts (G-R-001…007, other author), 2 are cancelled leftovers (`G-2026-001`, `V-2026-001`). The other ~11 test orders are gone (deleted afterwards); their order numbers were consumed.
- No rows by this login in `work_session`, `journal_entry`, `voice_note`, `note_line`, `share_inbox`, `kaizen_item`, `studio_task`, `saved_report`, `Oeuvres.created_by/edited_by` (never set for it).

### 1c. The committed specs are not the culprit

`npm run test:e2e:field` runs 8 specs (`scripts/run-atelier-e2e.mjs`); `ATELIER_E2E=1` only un-skips them. 56 specs use the login. Read of all that fill / click:
- **Read-only / validate-only** (no server call that saves): `session-new` (opens shell, `session-add-painting` is client state), `mobile-sale` (first-step validation only), `batch-edit-broadcast-ready` (cancel), `work-drawer-add-photo`, `atelier-shell-tab-hop`, `hub-*`, tab specs, the rest.
- **Types text, then discards**: `work-drawer-unsaved-guard` (`E2E UNSAVED GUARD`, Discard), `contacts-unsaved-guard` (`E2E CONTACT UNSAVED`), `capture-card`.
- **Writes mocked in the browser** (`page.route`, server actions answered with fake data, unknown actions aborted — the file comment says « the dev DB is production »): `note-lines-overview`, `journal-voice-notes`, `fil-log-audit`, `fil-deck`, `triage-swipe-deck`, `hub-today-days`.
- One to re-check by eye before calling it clean: `atelier-stock-tabs` (stock-take **Apply** buttons; spec only asserts visibility).

So **no committed spec writes today** (zero rows by this login in the tables those specs would touch). What wrote on live is *hand-driven / agent-driven use of the dev server* (1a, 1b). The risk is the next writing spec, and the dev server itself.

## 2. Design

Two separate leaks, two switches.

### A. Writing tests run on the copy: one env switch

`E2E_TARGET` = `stress` | `live` (default `live`, read-only specs).

1. **Server for `stress`:** the copy's app server must be `next dev` (auto-login only works in `NODE_ENV=development`; `--prod` disables it). `run-stress-dev.mjs` without `--prod` already starts `next dev` on 3077 against the local Supabase. Add, to its `env` block only: `DEV_AUTO_LOGIN_EMAIL=team.stress@example.test`, `DEV_AUTO_LOGIN_PASSWORD=stress-team-2026` (the fake **team, non-admin** account — same role as the live dev login; `atelier-shell-tab-hop` relies on « dev login is not admin »). The existing guard (refuses `.env.local`, refuses a production value) stays. The login therefore « exists » on the copy as a seeded fake account; nothing is created.
2. **Runner:** `run-atelier-e2e.mjs --target stress` sets `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3077`, `E2E_TARGET=stress`. `playwright.config.ts`: when `E2E_TARGET=stress`, **no `webServer`** (today it would start / reuse a server on :3000 = live `.env.local`). The runner first probes `http://127.0.0.1:3077` and checks a marker that proves it is the copy (a `x-stress-copy` header set by `run-stress-dev` env `STRESS_COPY=1`, or the page's `NEXT_PUBLIC_SUPABASE_URL` host is `127.0.0.1`); refuses otherwise.
3. **Live default can't write:** with `E2E_TARGET` unset/`live`, specs tagged `@writes` in their `describe` title are filtered out (`--grep-invert @writes`), and the runner refuses `--target live` together with a spec path that contains `@writes`. One tag, one place.
4. **Which specs move to `stress` (+ `@writes`):** none *today* (see 1c). Move now, as a precaution: `atelier-stock-tabs` (Apply) after a read, and every future spec that saves, creates, applies, uploads or deletes for real — this is the first writing spec's home: e.g. a real `batch edit → Apply`, `new work → Save`, session capture → Apply, order chain (the `scripts/stress/run-chains.mjs` chains stay there). The mocked-writes specs may stay on live (they cannot write); they keep their `page.route` guard.
5. **Check, enforced (Principle: enforced beats documented):** `npm run e2e:writes:check` — a tiny script that fails if a spec under `tests/` with a click on `/save|apply|enregistrer|appliquer|créer|supprimer/i`, `setInputFiles`, or a `request.post` is **not** tagged `@writes` and does not `page.route` server actions. Added to `ship.ps1` / CI beside `principles:check` only if Pem says yes (Q4).

### B. The live dev server must not act as a real login

The bigger leak is manual (1a). Options:
- **B1 (recommended):** stop auto-login from pointing at live. Remove `DEV_AUTO_LOGIN_*` from the live-pointing `.env.local`. A dev server on live is then used signed in as Pem's real account (Google OAuth works on `localhost`; the LAN phone case in `app/hub/CLAUDE.md` uses the real PEM email on purpose — unchanged). The dev login then lives only on the copy (A.1). Cost: one sign-in per browser profile.
- **B2:** keep it, and have `middleware.ts` / `lib` refuse `DEV_AUTO_LOGIN_*` when `NEXT_PUBLIC_SUPABASE_URL` host is the production ref (`mcrzsxrcoexnlwmaunte`) — enforced in code, the same string check `run-stress-dev.mjs` already uses. The dev server then prints « auto-login refused: production project ». Same effect as B1 but cannot come back through a stale `.env.local`.
- **B3 (not recommended):** read-only dev login on live via DB — writes go through `createServiceClient()` after the team check, so RLS cannot stop them; would need a per-action list.
- Delete the live auth user `dev@local.test` / Contact 964? Leave for Pem (Q3): it also owns 68 log rows and 4 `pending_changes`.

### Not done by this design
- No revert of the 18 version rows or the 8 works (history is history; the badges design should treat the dev login as a person of its own or hide it — see Q2).
- No SQL, no Docker command, no change to `docs/TODO.md`, `DONE.md`, `lib/whats-new.ts`. The Docker copy is untouched (main session may be on it for Places phase B).

## 3. Smallest build, in order (after Pem's GO)
1. `run-stress-dev.mjs`: add `DEV_AUTO_LOGIN_*` for the fake team account + `STRESS_COPY=1` header (≈6 lines). *Needs the copy restarted → ask main session first.*
2. `playwright.config.ts`: `webServer` only when not `stress`; `run-atelier-e2e.mjs`: `--target`, probe, refuse rules (≈30 lines).
3. B2 guard in `middleware.ts` (≈6 lines) or B1 = delete two lines from `.env.local` (Pem's file, not in repo).
4. `e2e:writes:check` + tag convention in `tests/` header comment (optional, Q4).
5. `scripts/stress/README.md` « Tests » block gets `node scripts/run-atelier-e2e.mjs --target stress`; `CLAUDE.md` Commands line.
6. **One command** `npm run test:e2e:stress` (Pem GO 2026-11-23): start the copy in dev mode (no build), reseed only when the data is stale, run the specs with `--target stress`, stop. Needs the copy restarted → ask the main session first.
7. **Result file** written to the shared notes folder after each run: sha + hash of the uncommitted diff, pass / fail per spec, and a read-only count of live `oeuvre_versions` (and `work_order`) rows before and after, to show nothing leaked. The main session reads this file, not terminal output.
8. **Seeded snapshot** (Pem « yes, if it improves the process »): dump the freshly seeded copy once, restore it in seconds before a run instead of a full `seed.mjs` wipe. Rebuilt when the schema or `seed.mjs` changes (the dump records their hash).
Verify: `lint` + `typecheck`, then one `@writes` canary spec (create a work, Save) run on the copy and shown **absent** from live via a read-only `oeuvre_versions` count.

## 4. Questions for Pem
1. Who made the 2026-11-13 22:34 batch Apply on works 2401–2407 (and the 11-17 orders): you at the keyboard, or a Claude session driving the dev server? (decides whether B1/B2 is enough or a spec is also needed)
2. The 18 version rows / 8 works: leave as history (recommended), or hide the dev login's rows in the new work-change badges?
3. Live auth user `dev@local.test` (Contact 964): keep it (used by the LAN phone), or retire it once the copy has its own?
4. B1 (remove auto-login from live `.env.local`) or B2 (the code refuses it on the production project) — or both?
5. Add `e2e:writes:check` as a blocking check in `ship.ps1` and CI, or only the tag convention?
6. The copy's fake accounts: team non-admin (`team.stress@…`) is the default dev login on the copy; some field specs (session capture) are admin-only in the app — OK to give those specs `pem.stress@…` (admin) through a second env var?
7. Order numbers consumed by the 11-17 tests (≈11 orders): is a gap in the live sequence acceptable, or should the sequence be repaired?

## 5. Pem's answers (2026-11-23)
1. Unknown who clicked; « if the data is sound, put my name » — the rows stay attributed to the dev login in the data; in prose they are Pem's test use. No action.
2. (not answered — default: leave as history.)
3. (not answered — default: keep `dev@local.test` for now.)
4. B1 + B2 both (« do what's best »).
5. `e2e:writes:check` joins `ship.ps1` / CI in the same change as the first `@writes` spec (« do what's best »).
6. (not answered — default: admin account through a second env var, only for admin-only specs.)
7. Gap accepted. A real first order may start a **different number series** than the test one (live `G-2026-001`, `V-2026-001` are cancelled test leftovers) — design of the series left for the order-number work.
