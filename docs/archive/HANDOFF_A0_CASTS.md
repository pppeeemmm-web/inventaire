# Handoff — A0 load-bearing Supabase cast cleanup

**Date:** 2026-05-28 · **For:** Sonnet (or any implementer) · **Track:** TODO.md Block A → A0 (`Remove remaining as any Supabase casts`)

## TL;DR

The *inert* cast sweep is **done and pushed** (`origin/main` @ `7acecd0`). What's left is **47 load-bearing casts in 21 files** that will NOT erase silently — each needs a real type-modeling fix, gated by `npm run typecheck` per file. This doc inventories them, sorts them into buckets, and tells you which are worth doing and how.

Do **not** blanket-remove these. Removing any one without the matching fix produces a real `tsc` error (proven for the Pipeline + works cases below).

## Context you need

- Next.js 15 App Router + Supabase (PostgREST) + Cloudflare R2. Mutations live in `app/**/actions.ts` server actions.
- **The key distinction** that drove the inert sweep:
  - `createClient()` / `createServiceClient()` in `lib/supabase/server.ts` are declared **without** a `<Database>` generic → **untyped** (`any` schema). On these, `.from(string)`, `.insert(x)`, `.update(x)` accept anything, so `as never` was compile-erased and freely removable. **All of those are already gone.**
  - The **typed** path is `lib/pipeline/suivi-client.ts`: `fromSuiviProcess(sb)` / `fromSuiviEtape(sb)` cast to `SupabaseClient<Database>` and `.from('suivi_process'|'suivi_etape')`. Casts on these are **real** — the generated Insert/Update types are enforced.
- Generated types: `lib/types/supabase.generated.ts` (regenerated this session; 3 RPCs now typed). Re-run `npm run gen:types` only after a new migration.

## Discipline (CLAUDE.md — non-negotiable)

- **No edit without owner GO** beyond what's already scoped; **never push without explicit "push"** from owner. `origin/main` is the only push target.
- CAUTION > SPEED. Surgical edits, small diffs, no bloat. One file at a time.
- After each file: `npm run typecheck` must stay green. Lint the touched file(s): `npx eslint <path>` — pre-existing `no-silent-catch` *warnings* are fine (0 errors required).
- Commit via current shell (not nested `pwsh -File`):
  `& .\scripts\commit-push-main.ps1 -Message '…' -Paths @('path1','path2')`
  It sets unrelated WIP aside, commits exactly those paths, pushes, restores.
- Status wording must match evidence: `local draft` / `committed locally` / `pushed to origin/main`. If a tool is blocked, say `I cannot prove this; treat it as not done.`
- Untracked `CLAUDE.original.md` and `docs/HANDOFF_SITE_BLOCKS_2.md` are unrelated WIP — leave them out of every commit.

## Verification commands

- `npm run typecheck` — `tsc --noEmit`. The gate.
- `npm run lint` / `npx eslint <path>`.
- `npm run i18n:check` — only if you touch UI copy (Bucket D).
- Do NOT need `gen:types` unless you add a migration.

---

## The buckets

### Bucket A — Supabase partial-select → domain type  *(A0 core; medium effort)*

A `.select('a,b,c')` returns a row missing computed/extra fields the domain type declares, so `as unknown as Oeuvre[]` bridges the gap. **Proven load-bearing:** removing `works/actions.ts:1457` errors with *"missing properties Dimensions, ImageURL from Oeuvre"*.

- `app/atelier/works/actions.ts:1457` — `(data ?? []) as unknown as Oeuvre[]`
- `app/atelier/(portal)/reports/actions.ts:81` — `(oeuvresRes.data ?? []) as unknown as Oeuvre[]`
- `lib/atelier/load-atelier-shell-props.ts:97` — `row as unknown as Oeuvre`
- `app/api/export/csv/route.ts:36` — dynamic `.select(string)` → `GenericStringError[]`; `as unknown as Record<string, unknown>[]`
- `app/atelier/(portal)/inventory/_components/Inventory.tsx:120,402` — index a domain object by dynamic key

**Fix strategy:** define a precise *row* type matching the actual `select()` columns (e.g. `OeuvreRow = Pick<...>` or a dedicated select-shape type), type the query result as that, and map to the domain type explicitly where the extra fields are computed. Where the value is genuinely a dynamic-key bag (Inventory, csv dynamic select), a typed `Record<string, unknown>` accessor helper is the honest model — keep the cast but localize it behind one named helper rather than inline `as unknown as`.

### Bucket B — typed-client payload vs generated `Json` columns  *(A0 core; the highest-value fix)*

The `suivi_process` / `suivi_etape` tables have `jsonb` columns (`responsables`, `walls`, `placements`, `payload`) typed as `Json` in generated types. Hand-built payloads hold structured arrays (`Responsable[]`, `LayoutWall[]`) that aren't assignable to `Json` (missing string index signature). **Proven:** removing `PipelineProcessModal.tsx:251/282` errors on *"`Responsable[]` is not assignable to `Json`"*.

- `components/atelier/pipeline/PipelineProcessModal.tsx:251,282` — `payload as never`
- `app/atelier/(portal)/exhibitions/actions.ts:321,339,343` — `as unknown as Record<string, unknown>` into `toSuiviProcessUpdate/Insert` / `toSuiviEtapeUpdate/Insert`
- `lib/exhibitions/exhibition-client.ts:19` `value as unknown as Json`; `:55,56` `row.walls/placements as unknown as LayoutWall[]/LayoutPlacement[]`
- `app/atelier/session/actions.ts:373,1531,2045` — `payload as unknown as Record<string, unknown>`

**Fix strategy:** the structured types (`Responsable`, `LayoutWall`, `LayoutPlacement`) are JSON-serializable at runtime — the mismatch is purely the missing index signature. Two clean options: (1) make those interfaces satisfy `Json` by adding `[k: string]: Json | undefined` (intrusive), or (2) add one tiny typed helper `toJson<T>(v: T): Json` colocated with `exhibition-client.ts` (where `value as unknown as Json` already lives at :19 — reuse/extend it) and cast only the offending jsonb field, leaving the rest of each payload fully typed. Option 2 is the surgical, recommended path: it shrinks each escape hatch from "whole payload" to "one field" and keeps real type-checking on every other column.

### Bucket C — genuine type divergence  *(investigate; likely a real latent bug)*

- `app/atelier/(portal)/vault/actions.ts:33` — `row as unknown as VaultDoc`. **Root cause:** `DocumentRow.id` is `string`, `VaultDoc.id` is `number`. A single `as VaultDoc` fails (TS2352 "not comparable"). This is NOT cosmetic — the id type genuinely diverges. **Action:** decide the real id type (DB column is the source of truth via generated types), align `VaultDoc.id` to it, and map explicitly. Don't paper over with `as unknown as`. Treat this as a small bugfix, not cleanup.

### Bucket D — i18n dynamic `t(key as any)`  *(separate sub-track; only with GO)*

`useI18n().t` is typed to known message keys; template-literal/dynamic keys need `as any`. Not a Supabase cast — arguably out of A0 scope.

- `components/public/works-layouts/WorksPlaceholderLayout.tsx:38,41`
- `components/atelier/BatchEditModal.tsx:481-493` (`t as any` passed to `TriField`)
- `components/atelier/site/SiteEditorPanel.tsx:646,677,680,745,763,1003`

**Fix strategy (optional):** add a typed dynamic-key accessor, e.g. `tDynamic(key: string)` on the i18n hook, or widen `TriField`'s `t` prop to the real `t` signature. **Touches UI copy path → run `npm run i18n:check`.** Confirm with owner before starting; it's a different concern from the DB casts.

### Bucket E — `window as any` / DOM globals  *(low value; mostly leave)*

App-specific window augmentation + legit feature detection.

- `components/atelier/WorldMapInner.tsx:21,23,28,29,50`, `components/atelier/TeamPortalClient.tsx:754` — could be fixed with a `declare global { interface Window { … } }` block, but these are deliberate escape hatches for imperative bridge callbacks. Low ROI.
- `components/atelier/ContactEditorPanel.tsx:1172` — already narrowed (`as unknown as { setSelection?: … }`). Leave.
- `app/atelier/scan/page.tsx:45` — `BarcodeDetector` feature detection. **Legit. Leave.**

### Bucket F — library / runtime interop  *(legit; leave)*

- `components/ui/AsyncButton.tsx:26,27` — `CSSProperties` optional access. Leave.
- `lib/export/zip-archive.ts:20` — `archiver` module shape. Leave.
- `lib/r2-s3-object.ts:77` — `Buffer` → `BodyInit` for `fetch`. Leave.
- `lib/site-blocks/registry.ts:99` — block descriptor registration. Leave (or type the registry generically if you're already in the file).

---

## Recommended order

1. **Bucket C (vault id divergence)** first — smallest, and it surfaces a real type bug worth fixing regardless.
2. **Bucket B** — highest safety value; do the `toJson` helper (option 2), then convert sites one file at a time. Start with `exhibition-client.ts` (the helper's home), then `PipelineProcessModal.tsx`, `exhibitions/actions.ts`, `session/actions.ts`.
3. **Bucket A** — define select-shape row types; convert `works`, `reports`, `load-atelier-shell-props`, then the dynamic-bag ones (`csv`, `Inventory`) behind a named helper.
4. **Bucket D** — only with explicit owner GO (UI copy track; `i18n:check`).
5. Leave **E** and **F**.

Each file: edit → `npm run typecheck` green → `npx eslint <file>` (0 errors) → commit that file (or a tight related group) with `commit-push-main.ps1`. **Push only on owner instruction.** Update TODO.md A0 line as buckets close.

## What's already done (do not redo)

- `origin/main` @ `7acecd0`. Inert `as never` removed from: `works/actions.ts` (insert/update), `error-reporter/server.ts`, `log-error/route.ts`, `notes/actions.ts`, `sync-exhibition.ts`, both calendar OAuth callback routes, `atelier/calendar/actions.ts`.
- `gen:types` regenerated; `lib/types/supabase.generated.ts` current.
- `PipelineProcessModal.tsx:251,282` were tested for removal and **reverted** (load-bearing — Bucket B). Don't re-test blindly; apply the Bucket B fix instead.
