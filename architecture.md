# Architecture — ruthlessness audit vs shipped work

Sources:

- Desktop `perform-ruthless-analysis-and-optimized-sifakis.md` (“Ruthless Analysis — Art DB”) — analysis + direction.
- Security-first implementation plan (upload MIME / pending allow-list / calendar HKDF / broadcast timing-safe + RLS; SQL applied on DB).
- Follow-up medium items from that audit (OAuth redirect leakage, audit enrichment path, dev login log masking).

The numbered sections below quote **without rephrasing** from the ruthless analysis. Under **Accomplished** or **Not accomplished** is the current repo state.

---

## Context (verbatim)

> Solo-artist studio CRM on Next.js 15 + Supabase + R2. Three audits (security, architecture, UX) ran in parallel against the worktree at `C:\Users\pppee\Documents\Claude\Projects\Art db\app\thirsty-dhawan-af5c3c`. Verdict: solid bones, but production-risky in security, fragile under growth in architecture, and inconsistent on the mobile field-tool contract in UX. This document is **analysis + direction**, not an implementation plan — pick what to do next.

---

## 1. SECURITY — what is actually exploitable

> Severity = realistic blast radius for this app (small team, ~thousands of works, R2 EU bucket, daily off-site dumps).

### CRITICAL — fix soon

> - **Image upload accepts anything.** [app/atelier/works/actions.ts](app/atelier/works/actions.ts) `uploadImage()` only labels `file.type`; no MIME allow-list, no magic-byte check. Sharp will mostly reject non-images, but R2 ends up with whatever the client sent before Sharp runs.
> - **Filename extension passes through.** `makeFilename()` in [lib/data.ts](lib/data.ts) preserves caller-supplied extension → double-extension trick (`x.php.jpg`) survives. Hash the content and force `.avif`/`.jpg`.

**Accomplished:** `uploadImage()` validates bytes with Sharp (`lib/image-upload.ts` `validateWorkImageBuffer`, allow-listed formats); R2 `PUT` uses detected MIME, not `file.type`. Storage keys use content hash + forced extension (`makeImageStorageFilename` in `lib/image-upload.ts`); `makeFilename()` removed from `lib/data.ts` for this path.

### HIGH — load-bearing for the "admin last word" story

> - **Pending-changes replay is unvalidated.** [app/atelier/audit/pending-actions.ts](app/atelier/audit/pending-actions.ts) `approvePendingChange` replays raw `payload` through `saveWork(fd)` with `__skip_review=1`. An editor crafting a payload that mutates fields not exposed in their UI (e.g. `is_admin`-adjacent flags, ownership stages, R2 keys) gets that change applied on admin click. Re-validate against an allow-list of editable columns *before* approve, not just on submit.

**Accomplished:** `lib/work-pending-keys.ts` — allow-listed enqueue from `saveWork`; `filterPendingPayloadForReplay` + `formDataFromPendingPayload` before `saveWork` on approve.

> - **Calendar token KDF is `sha256(env)`.** [lib/calendar/token-crypto.ts](lib/calendar/token-crypto.ts) — no salt, no HKDF. Tokens at rest in `calendar_account` are recoverable from a DB leak + the env var. Switch to HKDF-SHA256 with a per-account salt column.

**Accomplished:** HKDF-SHA256 (`encryptCalendarRefreshToken` / `decryptCalendarRefreshToken`), `calendar_account.token_salt`, legacy decrypt when salt null; `supabase/sql/calendar_token_salt.sql` + column in `supabase/sql/calendar_sync.sql`.

> - **`broadcast_events` / queue write path bypasses RLS.** Bearer-token routes in [app/api/inventory/broadcast/*](app/api/inventory/broadcast) use service-role and have no rate limit. Token leak = full broadcast spam. Add timing-safe comparison (`crypto.timingSafeEqual`) in [lib/inventory-broadcast-secret.ts](lib/inventory-broadcast-secret.ts) and an `is_team()` RLS policy as defense-in-depth.

**Accomplished:** `validateInventoryBroadcastSecret` compares SHA-256 digests with `crypto.timingSafeEqual`; `supabase/sql/broadcast_events_team_rls.sql` policy `broadcast_events_team_select` using `is_team()`. **Rate limit:** shared helper [`lib/inventory-broadcast-rate-limit.ts`](lib/inventory-broadcast-rate-limit.ts) → HTTP 429 on `app/api/inventory/broadcast/{feed,queue,confirm,event}`.

### MEDIUM

> - OAuth callbacks at [app/api/calendar/google/callback/route.ts](app/api/calendar/google/callback/route.ts) and the Microsoft sibling leak failure detail through `?calendar_detail=` querystrings — fine for dev, noisy in prod logs/referrers. Log internally, return generic codes.

**Accomplished:** redirects use `calendar_err_code` only; detail logged server-side; `components/atelier/ExhibitionsTab.tsx` reads `calendar_err_code` (fallback `calendar_detail` for old URLs).

> - [app/atelier/audit/actions.ts](app/atelier/audit/actions.ts) uses service-role to enrich audit rows with `auth.users` emails. Prefer `Contact.email` joined via `auth_user_id` so service-role isn't reached for read-only enrichment.

**Accomplished:** audit log enrichment loads `Contact.Email` in one query where `Contact.auth_user_id` ∈ distinct `user_id` values from the batch (RLS-scoped read; no service-role `getUserById` per row).

> - Dev auto-login in [middleware.ts](middleware.ts) — confirmed `NODE_ENV==='development'` gated, but the failure log leaks the email. Mask before `console.error`.

**Accomplished:** email-shaped substrings masked in the dev auto-login failure log.

### Not actually a finding (verbatim)

> - "R2 secrets hardcoded in 20 files" — they read `process.env.R2_*` per file, which is normal for serverless edge bundles. Rotation is the real control; the `.env.local` is gitignored.

**No code change** (unchanged).

---

## 2. ARCHITECTURE — where it bends, where it will break

### Scaling cliffs (verbatim)

> - **Hard `.range(0, 4999)` in [app/atelier/page.tsx](app/atelier/page.tsx)** for `Oeuvres` plus 12 parallel lookups. Silent truncation at 5001 rows; the UI looks complete. Move Atelier loading to cursor/paged fetches and let each tab fetch what it needs (server actions, not one mega-load). Inventory should virtualize.
> - **[WorkDrawer.tsx](components/atelier/WorkDrawer.tsx) is 2 194 lines** — image zoom, form, audit panel, version history, undo, drafts, save lifecycle, all in one client component. State soup + prop drilling forces `(p: any)` casts (~line 890). Split into: `ImageViewer`, `WorkFormPanel`, `VersionHistoryPanel`, `OwnershipPipe`. Use the work-editor-model contract you already have.
> - **Type erosion.** `(supabase as any).from('Oeuvres')` in [app/atelier/page.tsx](app/atelier/page.tsx:20) plus `as any[]` on addresses. Re-generate Supabase types and remove the casts — they hide schema drift at exactly the wrong layer.

**Accomplished (partial) — WorkDrawer:** Shell [WorkDrawer.tsx](components/atelier/WorkDrawer.tsx) owns zoom/wheel + `tblImage` fetch; inner editor under [components/atelier/work-drawer/](components/atelier/work-drawer/) — typed [drawer-content-props.ts](components/atelier/work-drawer/drawer-content-props.ts), [DrawerContent.tsx](components/atelier/work-drawer/DrawerContent.tsx), [WorkDrawerImageArea.tsx](components/atelier/work-drawer/WorkDrawerImageArea.tsx), [WorkDrawerPipelineSection.tsx](components/atelier/work-drawer/WorkDrawerPipelineSection.tsx), [DrawerContentFinanceSection.tsx](components/atelier/work-drawer/DrawerContentFinanceSection.tsx), [DrawerContentNotesVersionSection.tsx](components/atelier/work-drawer/DrawerContentNotesVersionSection.tsx), [drawer-widgets.tsx](components/atelier/work-drawer/drawer-widgets.tsx). **Remaining:** core form / themes / images / save lifecycle still concentrated in `DrawerContent`; optional smaller hooks (e.g. image zoom) not extracted.

**Accomplished (partial) — œuvres mega-load:** [app/atelier/page.tsx](app/atelier/page.tsx) loads a **first chunk** of `Oeuvres` (`order` + `limit`, with exact **total count** for the UI). [TeamPortalClient.tsx](components/atelier/TeamPortalClient.tsx) calls server action [`fetchOeuvresKeysetPage`](app/atelier/works/actions.ts) for “load more” (keyset by `OeuvreID`) — no silent “everything loaded” at 5000 rows. Other parallel lookups still bounded (e.g. exhibitions `limit(500)`); not full lazy per-tab fetch.

**Accomplished (partial) — page.tsx typing:** `Oeuvres` select uses generated `Oeuvre` typing (`as unknown as Oeuvre[]`). **`addresses` prop** still cast `as any[]` at the loader boundary.

### Good and worth keeping (verbatim)

> - Server-action mutation discipline; route handlers reserved for OAuth and external callers — matches the rule in CLAUDE.md.
> - Three-phase admin protection (soft-delete + pending queue + version snapshots + R2 recycle) is genuinely strong for a solo studio.
> - `work-editor-model.ts` is correctly shared between Create and Edit.

**No change required** (documented as-is).

### Smells (verbatim)

> - [components/atelier/TeamPortalClient.tsx](components/atelier/TeamPortalClient.tsx) polls reminder count via the **client** Supabase (RLS round-trip on every mount, ~line 222). Move to a tagged server fetch with `revalidateTag('reminders')` after writes.
> - Status/label mapping (FR strings) baked into [lib/data.ts](lib/data.ts) `STATUS_LABEL_MAP`. Drive from `dictionary.ts` or the `OeuvreStatus` table with bilingual columns.
> - Constellation / world-map tabs not audited in depth — likely candidates for `StageProduction` (dead enum?) leakage; quick grep before touching.

**Accomplished (partial) — reminders:** Initial unread badge count comes from the server ([`getUnreadReminderCountCached`](app/atelier/reminders-actions.ts) on Atelier load); [`revalidateRemindersTag()`](app/atelier/reminders-actions.ts) runs after pipeline reminder writes. **Still client-fetched:** overview tab pulls `suivi_reminder` rows (list widget) via browser Supabase alongside other pulse queries.

**Accomplished (partial) — status labels:** [lib/data.ts](lib/data.ts) maps `OeuvreStatus.label` → `StatusKey` with a **bilingual** `STATUS_LABEL_MAP` (FR + EN spellings). **Not** wired through `dictionary.ts` — intentional: `lib/data.ts` is imported in many **client** bundles; importing the full dictionary graph previously broke webpack/RSC init (see comment in `data.ts`).

**Accomplished (process):** Backlog grep of constellation / map / pipeline tabs for inappropriate `StageProduction` vs [`lib/work-editor-model.ts`](lib/work-editor-model.ts) — closed without code changes.

---

## 3. UX — biggest delta between intent and reality

Ruthless file bullets under **Mobile contract violations**, **Coherence**, **Discoverability**, **Bilingual leaks**, **States** — largely **still open** as a full audit pass.

**Accomplished (incremental UX pass):** narrow-viewport branches and safe-area aware patterns in the Atelier shell (`TeamPortalClient` / sidebar), **admin pending-review badge** on Audit entry, **i18n** additions for œuvres paging UI + drawer-adjacent copy, **Playwright** smoke [`tests/atelier-oeuvres-paging-bar.spec.ts`](tests/atelier-oeuvres-paging-bar.spec.ts). Inventory list/grid uses **virtualization** ([`InventoryTab.tsx`](components/atelier/InventoryTab.tsx) + `@tanstack/react-virtual`). This is not a claim that every ruthless UX bullet is closed.

---

## 4. DATA FLOW — short read

Quoted verbatim:

> Read path: Server Component (`app/atelier/page.tsx`, parallel queries, anon client) → `TeamPortalClient` (client orchestrator, fans data into tabs as props) → leaf tabs (mostly presentational, some inline RLS reads for counters).
>
> Write path: leaf form → server action in `app/**/actions.ts` → branches on admin: admin writes directly to Postgres (RLS allows), editor writes to `pending_changes`. `Oeuvres` UPDATE triggers `oeuvre_versions` snapshot. Image writes go through Sharp → R2 with `r2SoftDelete` recycle prefix. External: calendar push via Google/Microsoft Graph one-way, inventory broadcast via Bearer-token API consumed by Make/n8n.
>
> What's load-bearing and currently fragile:
> - The **single-load atelier page** is the spine; everything depends on it. It's also the scaling cliff. *(œuvres row cap removed in favor of counted first chunk + keyset “load more”; other reference tables still loaded in one round-trip.)*
> - The **pending-changes payload** on approve is filtered to an allow-list before replay — residual risk is any bug in that filter, not arbitrary JSON injection.
> - **R2 keys + Calendar tokens** are the secrets-at-rest story; one is rotated yearly; calendar refresh tokens use HKDF + per-row salt (see §1 HIGH).

**Accomplishment delta vs “replay verbatim” / “weak KDF”:** pending payload allow-list + replay filter; calendar HKDF + per-row salt + legacy decrypt.

---

## 5. POTENTIALITIES — directions worth considering (not commitments)

Ranked list quoted verbatim from ruthless analysis §5:

1. **Cursor-paged Atelier load + per-tab fetch.** Removes the 5 000-row cliff, halves time-to-interactive, makes the app future-proof. Highest leverage refactor.
2. **WorkDrawer decomposition.** Cuts the largest source of bugs and type erosion. Pair with regenerated Supabase types.
3. **Pending-changes allow-list + image MIME check.** Closes the two real elevation paths in the admin protection story. Small, surgical, big credibility win.
4. **Mobile-primary shell for Atelier.** A handful of `useMediaQuery('(max-width:767px)')` branches in `TeamPortalClient`, `WorkForm`, image inputs. Unlocks the "field terminal" promise that's already half-built.
5. **Audit / pending badge in sidebar.** Tiny effort, massive admin-attention gain.
6. **Bilingual sweep.** One grep + dictionary additions. Eliminates the small embarrassments.
7. **HKDF for calendar tokens + timing-safe broadcast secret.** Cheap cryptography hygiene before either feature gets external eyeballs.
8. **Outbox + background jobs** for portfolio PDF, bulk geocode, large broadcasts — already flagged "deferred" in CLAUDE.md, becomes pressing once Atelier load is paged (latency surfaces faster).
9. **Vision/OCR field capture** (label scanning → draft fields, human confirm) — natural next step once mobile shell exists; aligns with the field-tool concept.
10. **Reports/analytics pivot** could ride on the same paged-fetch infrastructure — saves duplicated heavy queries.

**Accomplished from this list:** **3**, **7**; **1** (œuvres paging + total count + keyset continuation, not full per-tab lazy fetch); **2** (WorkDrawer): **partial** — shell + work-drawer modules + finance/notes/version sections; **4** / **5** / **6** (incremental — see §3 UX pass). **8**+ remain deferred per CLAUDE.md.

Quoted verbatim:

> What I'd not chase yet: RTL i18n, full design-system rewrite, multi-tenant. Premature for this audience.

**No action.**

---

## Verification (verbatim from ruthless analysis)

> For each direction picked: smoke the golden path on a real iPhone-SE viewport, run `npm run lint && npm run build`, then exercise WorkForm + WorkDrawer + Inventory on mobile and PendingQueue + AuditTab as admin. The on-demand QA checklist PDF in Atelier > System is the existing canonical test list — use it before claiming any of these "done".

**Build / lint:** `npm run build` and `npm run lint` have been run in the backlog wave that added paging, broadcast rate limit, audit Contact enrichment, and drawer splits; full Atelier **QA checklist PDF** pass is still manual — not recorded here.

---

## Repo documentation updated

`CLAUDE.md` reflects: `lib/image-upload.ts`, `lib/work-pending-keys.ts`, Phase B allow-list, calendar HKDF + `token_salt`, broadcast validation + RLS + **rate limit** (`lib/inventory-broadcast-rate-limit.ts`), OAuth opaque codes, audit **Contact** batch enrichment (not `getUserById`), dev login log masking, **chunked œuvres load + `fetchOeuvresKeysetPage`**, `lib/data.ts` **no dictionary import** + bilingual status map, Inventory virtualization, reminders server initial count + `revalidateRemindersTag`, Playwright / lint cmds, dev **404 on `/_next/static`** troubleshooting.

**This file:** Keep **Accomplished / partial / not** in sync when closing ruthless-audit items; §2–§5 updated May 2026 for the paging + UX + security follow-ups above.
