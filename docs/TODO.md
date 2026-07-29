# PEM Hub — TODO

_Live checklist. History → [`archive/`](./archive/). Current workstream → [`MOBILE_RATIONALIZATION_PLAN.md`](./MOBILE_RATIONALIZATION_PLAN.md)._

**Last refresh: 2026-07-16** — V5 programme closed 2026-05-29 (slices 1–8, details in archive). Mobile rationalization: Phases 0–2.1 done, next 2.2 (gated on owner field notes).

## Live workstream

- [ ] **Mobile rationalization 2.2** — share-triage as canonical photo funnel. Blocked on: 2–3 owner painting sessions with friction notes.
- [ ] **Phase 3 decision (owner)** — regroup hub tiles by verb, or keep 10-tile layout?
- [ ] Follow-ups from 2.x (Commentaires ungated, reorder/replace image gating, `attachShareInboxFilesToWork` audit) — tracked in the plan doc.
- [ ] **STRATEGY.md** — fill with owner (dedicated exchange planned; skeleton in place).

## Operations — time-sensitive

- [ ] **O2** R2 access key rotation; document rotation date in `CLAUDE.md` Phase D.
- [ ] **O4** Quarterly DB backup recovery drill (per [`BACKUP_RECOVERY.md`](./BACKUP_RECOVERY.md)).
- [ ] **Vercel** `NEXT_PUBLIC_SITE_URL` / `NEXT_PUBLIC_APP_URL` on production (metadataBase / OG / sitemap).

## Manual Supabase / Cloudflare

- [ ] Re-run **`npm run gen:types`** after each new `public` table migration.
- [ ] GH secret `SUPABASE_DB_URL` for `audit-prune.yml`; sanity-check `audit_log_prune()` before enabling workflow.
- [ ] Staging AVIF upload smoke (R2 objects + thumbs).
- [ ] Verify views such as `OeuvresComplete` after `dead_columns_drop.sql`.
- [ ] Run `grant_audit_queries.sql` after schema changes.

## Product — open

- [ ] **E2E suites fail against a DEV_AUTO_LOGIN dev server** (2026-07-30). `playwright.config.ts` has `reuseExistingServer: true`, so a running `npm run dev` with `DEV_AUTO_LOGIN_*` set makes `/` and `/login` render the authenticated shell — 7 public-shell specs fail (public-seo, login-i18n ×3, landing-mobile-nav ×2, command-palette). `test:e2e:field` fails 10 more (hub-field-launcher ×7, atelier-shell-tab-hop, atelier-mobile-action-bar, hub-mobile-capture, session-new). `session-new.spec.ts` fails at line 17 with `session-new-root` visible but no `session-date-input` — i.e. the `!sessionId` branch, session never opened. Needs a clean run (auto-login off, or a dedicated Playwright server) to separate real regressions from environment. Not attributed to the 2026-07-30 session refactor: 9 of the 10 field failures are in specs that refactor never touched.
- [ ] **Apply the 10 stranded staged photos** (found 2026-07-30): photos live in R2 and in `work_session.payload`, but no `tblImage` row, so the works render nothing. 2026-07-29 → #2364, #2365, #2366, #2367, #2369, #2370 (1 each) + #2368 (2); 2026-06-20 → #2356 (2). Tap Apply on both pending sessions. Missing R2 objects are skipped with a warning, so it is safe to retry.
- [ ] **Warn when a session photo is staged but never applied** (2026-07-30) — root cause of the 10 stranded photos above: a shot can sit in `payload.items[].shots[]` indefinitely with no signal on the work or in the journal. Wants a visible "staged, not applied" marker.
- [ ] **`Support` lookup has "Carton" twice** (IDs 1 and 8, found 2026-07-30) — shows as a duplicate option in the session Support select. Merging needs a decision on which ID survives plus a repoint of any `Oeuvres.Support` references.
- [ ] **24 works have images but no `is_cover` flag** (found 2026-07-30, incl. #2357; 0 works have multiple covers) — `tblImage` cover trigger gap. Touches public-site covers, so needs owner GO before a backfill.
- [ ] **Session flow follow-ups** (2026-07-19, after apply-passthrough + auto-apply + busy-count shipped): wire or delete the dead Lightroom-return loop (`lib/mobile/lightroom-return.ts` never called → triage "Add to work session" unreachable; CLAUDE.md documents it as canonical); parallelize/paginate `applyWorkSessionToOeuvre` for true per-shot progress; defer `consolidateSessionsForCalendarDay` off the session-open critical path; index-backed `searchWorksForSession` (full-table scan per keystroke).
- [ ] **Photothèque ~4000 photos** — parked ("on verra plus tard"). Recommendation on file: parallel table reusing R2/AVIF pipeline, optional link to Oeuvres; blocked on owner clarifying documentation-vs-library nature.
- [ ] **Statuts FR en mode EN** — chips "DISPONIBLE / EN PRODUCTION" come from `OeuvreStatus` DB labels, not UI copy; decide data-side translation.

- [ ] **R2 assets** — upload panorama + video for map/motion_interior layouts (`site/forest-panorama.avif`, `site/interior-loop.webm`), paste keys in site editor.
- [ ] **`/works` gallery** — cm-scaled wall scroll (WIP on hold).
- [ ] Procession layout "not working" — reopen only with repro steps (browser + OS + input + scenario).
- [ ] Carousel outro card on mobile — needs a design decision (own slide? collapse below?). Desktop done 2026-06-01.
- [ ] (optional) Ratchet `no-silent-catch` `warn`→`error` — ~258 sites, large triage.

## Roadmap (no GO without decision)

- [ ] **F2–F10** — preview token, quick-add, saved searches, share kit, flags, digest, outbox, OCR, `concept_themes` (detail in [archive/STATUS.md](./archive/STATUS.md)).

### Near-term product / data loading

- [ ] Per-tab lazy Atelier reference fetch (junction + lookups still on RSC `Promise.all`).
- [ ] Reports / analytics aligned with keyset catalogue totals (Rapports tab ships on loaded batch only).
- [ ] Overview pipeline pulse → server + tags (remove remaining client Supabase widgets).
- [ ] Status labels via `dictionary` vs `STATUS_LABEL_MAP` (needs thin shared layer).

### Deferred integrations (explicit no-GO in CLAUDE.md)

- [ ] Background jobs / queues — prefer outbox + idempotency if DB webhooks fire side effects.
- [ ] Broader field OCR (business-card capture shipped 2026-05-15; no silent expansion).
- [ ] Transactional email (Resend/Postmark-class).

### Post-V5 optional

- [ ] Per-route bundle size check (aspirational ≤ 250 kB).
- [ ] Slim RSC cold-start for Audit/Logistics only.

## Done (compressed — evidence in archive/ + git)

- **V5 refactor** (slices 1–8, PWA/offline, tab segmentation, i18n `resolveMessage`, graph + atlas + embeddings) — closed 2026-05-25/29.
- **Blocks A/C** (agility + decomposition), **O1** GRANT audit, **O3** token rotation runbook, lifecycle rules, dictionary modularization, a11y sweeps — 2026-05.
- **Mobile field-tool Phases 1–8** (rings A/B, verbs 1–8, share target, a11y) — 2026-05.
- **Mobile rationalization Phases 0–2.1** + owner UX pass + field-session fixes (silent taps, AVIF passthrough, journal deep link) — 2026-07, see plan doc.
- **Field session capture refactor** — 2026-07-30. Photo-first painting panel (picture → title → dimensions → support → technique → notes) with a single commit button; per-item "create work & link" deleted (`applyWorkSessionToOeuvre` already created new works); `instantUpload` always on; Technique/Support captured in the field and written to `Oeuvres`; applied photos visible + removable per painting (`removeAppliedSessionImage` → admin `deleteWorkImage` → `recycle/`); committed items become review-only with an `#id` link to the work form; `sha256` duplicate-photo guard + advisory duplicate-title warning. Bugs fixed: "Add painting" persisted an invisible orphan slot on every tap (8 pruned via [`work_session_prune_empty_items.sql`](../supabase/sql/work_session_prune_empty_items.sql)); `refreshDraft` had no generation guard so overlapping reads repainted the previous day's items; the commit button falsely read "APPLYING…" off the shared `busy` flag; the capture-admin gate was unreachable behind an earlier `!sessionId` return.

## Guardrails (not tasks)

RLS + `GRANT` on new tables · EU R2 endpoint · bilingual `dict` · 375px / 44px mobile contract · extend `audit_log_prune()` for new audit tables.
