# PEM Hub — TODO

_Open items only. Closed → [`DONE.md`](./DONE.md). History → [`archive/`](./archive/). Aims → [`STRATEGY.md`](./STRATEGY.md)._

**Last refresh: 2026-11-13** — done items moved to `DONE.md`; each open item re-checked against code where one grep could tell.

## Live workstream

- [ ] **Mobile rationalization 2.2** — share-triage as canonical photo funnel. Blocked on: 2–3 owner painting sessions with friction notes.
- [ ] **Phase 3 decision (owner)** — regroup hub tiles by verb, or keep 10-tile layout?
- [ ] Follow-ups from 2.x (Commentaires ungated, reorder/replace image gating, `attachShareInboxFilesToWork` audit) — tracked in the plan doc.

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

- [ ] **App review, 2026-11-13** (Fable; verified against live code + DB 2026-11-13).
  - [ ] Security, remaining: `anon` write grants on most tables (RLS only); `system_log` + `studio_task` open to any signed-in account; no content security policy (start report-only); `xlsx` 0.18.5 usage to check; `storage_object_ledger` table does not exist (`lib/storage-object-ledger.ts` writes to it).
  - [ ] Restore drill (O4) never run. Archive: no in-app reminder when the last run is old; no second-disk copy.
  - [ ] Image descriptions by the local vision model: 20-work test run 2026-11-13 (`scripts/transcribe/describe_images_test.py`, nothing saved) — owner to judge before any batch.
  - [ ] Ideas agreed in principle, not built: work ↔ work links from the drawer (task E of `HANDOFF_2026-11-13_OPUS.md`). Built 2026-11-13: "see again" card (Journal today + Overview; `see_again_dismissed.sql`), transcript audio + ✦ engine mark on the journal day.
  - [ ] Cold load: Overview figures are fetched before first paint on every tab — owner unsure of the gain; measure before any change.

- [ ] **Owner bug review, 2026-11-12** — done parts in [`DONE.md`](./DONE.md).
  - [ ] Journal phase 2 — proposal [`JOURNAL_PROPOSAL.md`](./archive/JOURNAL_PROPOSAL.md); each build step needs a GO. Steps 1–3 and 5 built 2026-11-12 (What's new up to 3.0.9: entries, day page = main field tab, capture inside the day, ✦ suggestions with the stricter rule, entries in ⌘K search and in the Constellation work panel). Empty "Day opened" sessions of 11 + 12 Nov deleted (owner GO); capture opened and closed with nothing added now discards its own empty session. Phone review 2026-11-12 done: drawer themes compact + ⋯ bar, inventory "Filtres & vues" + grid default. Kaizen #34 (bounce work → contact) built 2026-11-12: ↗ in the drawer's Ownership fields → `/atelier/contacts?contact=&from_work=` → "← back to work". Next batch handed to Fable 2026-11-12: [`HANDOFF_2026-11-12_FIELD_UX.md`](./HANDOFF_2026-11-12_FIELD_UX.md) — Production drag-back, ✦ banner, contact pop-up (replaces the back-to-work round trip), `#1234` hover/hold preview, Système site tools cleanup. Open: step 4 transcription batches (instructions [`TRANSCRIPTION_BATCHES.md`](./TRANSCRIPTION_BATCHES.md); handwriting test reminder 2026-11-13); journal entries as Constellation canvas nodes (canvas is keyed by work id — needs a redesign, no GO).
  - [ ] From the proposal (archived 2026-11-13), still open: **work or version** rule — partial rework (glaze, scumble, pentimento) = new photo + version row on the same number; full cover = new work + "painted on" link; new support = new work + "derived from" link (work ↔ work links: HANDOFF_2026-11-13_OPUS task E).

- [ ] **Production start: partial date input** (owner 2026-11-03) — text input with year / month / day like the fate date; also fixes the half-typed date carried between works.
- [ ] **Custody follow-ups** — orders do not store the custodian's address (picked in the drawer when the custodian has several); a cancelled sale of a consigned work returns it to Pem, not to the gallery; none of the order paths clicked through yet (no orders in the data).

- [ ] **Concept documents — UI not yet clicked through** (was blocked by the browser-pane loading issue, see `DONE.md`; unblocked 2026-11-03, it was the test browser). DB constraint, server actions, typecheck/lint/i18n verified 2026-11-01.

- [ ] **E2E suites fail against a DEV_AUTO_LOGIN dev server** (2026-07-30). `playwright.config.ts` has `reuseExistingServer: true`, so a running `npm run dev` with `DEV_AUTO_LOGIN_*` set makes `/` and `/login` render the authenticated shell — 7 public-shell specs fail (public-seo, login-i18n ×3, landing-mobile-nav ×2, command-palette). `test:e2e:field` fails 10 more (hub-field-launcher ×7, atelier-shell-tab-hop, atelier-mobile-action-bar, hub-mobile-capture, session-new). `session-new.spec.ts` fails at line 17 with `session-new-root` visible but no `session-date-input` — i.e. the `!sessionId` branch, session never opened. Needs a clean run (auto-login off, or a dedicated Playwright server) to separate real regressions from environment. Not attributed to the 2026-07-30 session refactor: 9 of the 10 field failures are in specs that refactor never touched.
- [ ] **Verify two session write paths on the next real capture** (2026-07-30). Both are code-complete but unexercised, because each needs a photo uploaded from a device: (a) `Technique`/`Support` written to `Oeuvres` when a new work is committed from the field — check with `select "OeuvreID","Titre","Technique","Support" from "Oeuvres" order by "OeuvreID" desc limit 5;`, (b) applied-photo removal (`removeAppliedSessionImage` → `deleteWorkImage` → `recycle/`). No lossless test image exists — the catalogue has zero duplicate-sha rows — so (b) should be tested on a throwaway photo, not a real one. The `sha256` duplicate guard IS verified: it skipped 4 of 10 shots during the 2026-07-30 apply.
- [ ] **Four works whose last image is older than their cover** (2026-07-30) — #272, #1434, #2103, #2339. The app's rule is "highest `SeqNo` = cover", but on these the highest-SeqNo row predates the current cover by `DateAdded`: three carry a foreign `W_xxxx_01_` prefix inside their filename (imported from another work), and #2339 has `SeqNo` and filename seq swapped. [`cover_follows_newest_image.sql`](../supabase/sql/cover_follows_newest_image.sql) deliberately skips them. Needs eyes on the actual pictures to say which one should be the cover.
- [ ] **Warn when a session photo is staged but never applied** (2026-07-30) — root cause of the 10 stranded photos: a shot can sit in `payload.items[].shots[]` indefinitely with no signal on the work or in the journal. Wants a visible "staged, not applied" marker.
- [ ] **Session flow follow-ups** (2026-07-19, after apply-passthrough + auto-apply + busy-count shipped): Lightroom-return loop: `lib/mobile/lightroom-return.ts` is now imported by `ShareTriageClient.tsx` (checked 2026-11-13; end-to-end not re-tested) (was: never called → triage "Add to work session" unreachable; CLAUDE.md documents it as canonical); parallelize/paginate `applyWorkSessionToOeuvre` for true per-shot progress; defer `consolidateSessionsForCalendarDay` off the session-open critical path; index-backed `searchWorksForSession` (full-table scan per keystroke).
- [ ] **Photothèque ~4000 photos** — parked ("on verra plus tard"). Recommendation on file: parallel table reusing R2/AVIF pipeline, optional link to Oeuvres; blocked on owner clarifying documentation-vs-library nature.
- [ ] **Statuts FR en mode EN** — chips "DISPONIBLE / EN PRODUCTION" come from `OeuvreStatus` DB labels, not UI copy; decide data-side translation.

- [ ] **Circadian sky leftovers** (2026-10-31, after the landing sky shipped). Three known gaps, none blocking: (a) `applyCircadianToKnobs` still ignores `circ.auto` and `circ.manual_minute`, so the KnobsPanel Auto toggle and manual-time slider do nothing — there is no in-app way to preview another hour; (b) `circadianShadowGeometry` ([`lib/landing-text-shadow.ts`](../lib/landing-text-shadow.ts)) still uses the synthetic 06:00-21:00 arc for shadow *direction* while colour and light now come from real solar elevation — the real azimuth is already computed in [`lib/solar-position.ts`](../lib/solar-position.ts) and just needs wiring; (c) the `atm` knob family (`sky_top` / `sky_bottom` / `tint_opacity`) is inert on landing now that the veil is gone — either repoint it at the sky keyframes or drop it from `KnobsPanel` for the landing scope.

- [ ] **Production span follow-ups** (2026-11-01, after `oeuvres_production_span.sql` shipped). Rule lives in the trigger `trg_oeuvre_production_span`: Catalogué ticked → `production_completed_on` = today (Paris), unticked → end cleared + Historique "Reprise en production" line, empty `Année` follows the end year; session new-work items carry a *new / found* choice (`production_origin`, start = session day for *new*). Open: (a) no UI to set or correct the dates by hand — the drawer shows the span read-only; editing needs state + dirty baseline + `saveWork` + pending allow-list; (b) WorkForm "new work" has no new/found choice yet, only sessions do; (c) no backfill — the only catalogue transitions in `oeuvre_versions` are a 2-minute bulk script on 2026-10-31, not real events, so existing works start with no span.
- [ ] **Money pipeline follow-ups** (2026-11-01, after `sales_payments_and_commission.sql` applied). Live now: `payments` table (RLS team read/write, admin delete, no anon) and the commission columns from `commission_tracking.sql`. Overview income + Fiscal recettes read `lib/sales/income.ts` `fetchSalesIncome` (payments by `payment_date`, plus completed orders with no payment rows at `prix_final` by `completed_at`) — no longer `Oeuvres.statusId === 4` (4 is Réservé, not Vendu). Open: (a) a real sale order + payment has not been created end-to-end yet — 0 `sale_order` rows exist; (b) `Oeuvres.is_paid` is still hand-editable (drawer, batch edit) and not derived from payments; (c) recettes count the gross `prix_final` even for consignment sales with `commission_amount` — decide gross vs net for BNC; (d) `lib/sales/sales-client.ts` still carries hand-written extras (incl. a `sale_order.updated_at` that does not exist) now covered by generated types.
- [ ] **Semantic search on pgvector — follow-ups** (2026-11-01, after `semantic_search_pgvector.sql` applied). Qdrant Cloud retired (free cluster deleted for inactivity): vectors live in `nodes.embedding` (vector 768, HNSW cosine), searched via `match_nodes()` (service-role only) from `app/atelier/search/actions.ts`; worker writes the vector with the `ok` status. (a) ~~Qdrant leftovers~~ done 2026-11-02 (owner OK): [`drop_qdrant_leftovers.sql`](../supabase/sql/drop_qdrant_leftovers.sql) applied (table + column dropped, `graph_mark_nodes_pending` no longer writes the column), `qdrant-client.mjs` deleted, `QDRANT_*` removed from `.env.local` — **still to remove from Vercel env** (owner, in the Vercel dashboard). Open: (b) Vercel still has no Ollama — a new phrase queues in `pending_query_embeddings` until the desktop worker runs; (c) ~~widen search text~~ done 2026-11-13 (`oeuvre_search_text_wider.sql`); was: 919 of 1177 works are untitled, so their search text is often just the technique (`node_search_text` = title + comments + technique) — widen it (themes, support, year, location) for useful matches; hits for untitled works show `#OeuvreID`.
- [ ] **Fournitures / Supplies — follow-ups** (2026-11-02). Shipped locally: one Studio tab `/atelier/stock` with sub-views Stock (SupplierHub) · Comptage (StockTake; `/atelier/stock-take` redirects) · Réassort / Commande (out of stock or below `min_stock`, grouped by supplier, per-device order draft, copy order). Live data: 235 items, **0 with a minimum set**, 98 without a supplier. Open: no orders table (an order is a copied text, not tracked); a placed order could become an expense (and feed cost per work); the Stock list still lists suppliers first — rename its heading if it still reads as "contacts".
- [ ] **S6 leftovers** (2026-11-01 block moved to [`DONE.md`](./DONE.md)): photo background / frame counts as a colour; storage cost as a per-day rate; re-check the iOS share-sheet → PWA path (iPhone share menu may not list PWAs); audit `/atelier/site` controls before changes.

- [ ] **R2 assets** — upload panorama + video for map/motion_interior layouts (`site/forest-panorama.avif`, `site/interior-loop.webm`), paste keys in site editor.
- [ ] **`/works` gallery** — cm-scaled wall scroll (WIP on hold).
- [ ] Procession layout "not working" — reopen only with repro steps (browser + OS + input + scenario).
- [ ] Carousel outro card on mobile — needs a design decision (own slide? collapse below?). Desktop done 2026-06-01.
- [ ] (optional) Ratchet `no-silent-catch` `warn`→`error` — ~258 sites, large triage.

## Roadmap (no GO without decision)

- [ ] **Idea (owner 2026-11-12, no GO): VAT per sale** — today `Oeuvres.tva_rate` is typed by hand. Wanted: rate resolved from the transaction itself (date, buyer country, buyer VAT number, artist-author 5.5 %, EU B2C distance-sale threshold €10k → OSS, intra-EU B2B reverse charge, export exempt), with a running total against the thresholds. Rules to confirm with the accountant before any build.
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


## Guardrails (not tasks)

RLS + `GRANT` on new tables · EU R2 endpoint · bilingual `dict` · 375px / 44px mobile contract · extend `audit_log_prune()` for new audit tables.
