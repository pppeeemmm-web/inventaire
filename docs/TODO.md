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

## Guardrails (not tasks)

RLS + `GRANT` on new tables · EU R2 endpoint · bilingual `dict` · 375px / 44px mobile contract · extend `audit_log_prune()` for new audit tables.
