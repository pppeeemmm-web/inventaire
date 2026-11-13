# TODO — notes

_Details of the open items in [`TODO.md`](./TODO.md), text as it was on 2026-11-13. A reference, not a list: the list and the order are in `TODO.md`. When an item closes, move its note to [`DONE.md`](./DONE.md)._

## security

**Security, remaining.** Security, remaining: `anon` write grants on most tables (RLS only); `system_log` + `studio_task` open to any signed-in account; no content security policy (start report-only); `xlsx` 0.18.5 usage to check; `storage_object_ledger` table does not exist (`lib/storage-object-ledger.ts` writes to it).

## restore-drill-and-archive

**Restore drill and archive.** Restore drill (O4) never run. Archive: no in-app reminder when the last run is old; no second-disk copy.

## journal-phase-2

**Journal phase 2.** Journal phase 2 — proposal [`JOURNAL_PROPOSAL.md`](./archive/JOURNAL_PROPOSAL.md); each build step needs a GO. Steps 1–3 and 5 built 2026-11-12 (What's new up to 3.0.9: entries, day page = main field tab, capture inside the day, ✦ suggestions with the stricter rule, entries in ⌘K search and in the Constellation work panel). Empty "Day opened" sessions of 11 + 12 Nov deleted (owner GO); capture opened and closed with nothing added now discards its own empty session. Phone review 2026-11-12 done: drawer themes compact + ⋯ bar, inventory "Filtres & vues" + grid default. Kaizen #34 (bounce work → contact) built 2026-11-12: ↗ in the drawer's Ownership fields → `/atelier/contacts?contact=&from_work=` → "← back to work". Field UX batch ([`HANDOFF_2026-11-12_FIELD_UX.md`](./archive/HANDOFF_2026-11-12_FIELD_UX.md)) built 2026-11-13: Production drag-back, ✦ bar, contact pop-up over the drawer, `#1234` hover/hold preview, Système tools cleanup. Open: step 4 transcription batches (instructions [`TRANSCRIPTION_BATCHES.md`](./TRANSCRIPTION_BATCHES.md); handwriting test reminder 2026-11-13); journal entries as Constellation canvas nodes (canvas is keyed by work id — needs a redesign, no GO).

## work-or-version

**Work or version.** From the proposal (archived 2026-11-13), still open: **work or version** rule — partial rework (glaze, scumble, pentimento) = new photo + version row on the same number; full cover = new work + "painted on" link; new support = new work + "derived from" link (work ↔ work links: HANDOFF_2026-11-13_OPUS task E).

## production-start-date

**Production start: partial date input** (owner 2026-11-03) — text input with year / month / day like the fate date; also fixes the half-typed date carried between works.

## custody

**Custody follow-ups** — orders do not store the custodian's address (picked in the drawer when the custodian has several); a cancelled sale of a consigned work returns it to Pem, not to the gallery; none of the order paths clicked through yet (no orders in the data).

## concept-documents

**Concept documents — UI not yet clicked through** (was blocked by the browser-pane loading issue, see `DONE.md`; unblocked 2026-11-03, it was the test browser). DB constraint, server actions, typecheck/lint/i18n verified 2026-11-01.

## session-write-paths

**Verify two session write paths on the next real capture** (2026-07-30). Both are code-complete but unexercised, because each needs a photo uploaded from a device: (a) `Technique`/`Support` written to `Oeuvres` when a new work is committed from the field — check with `select "OeuvreID","Titre","Technique","Support" from "Oeuvres" order by "OeuvreID" desc limit 5;`, (b) applied-photo removal (`removeAppliedSessionImage` → `deleteWorkImage` → `recycle/`). No lossless test image exists — the catalogue has zero duplicate-sha rows — so (b) should be tested on a throwaway photo, not a real one. The `sha256` duplicate guard IS verified: it skipped 4 of 10 shots during the 2026-07-30 apply.

## four-covers

**Four works whose last image is older than their cover** (2026-07-30) — #272, #1434, #2103, #2339. The app's rule is "highest `SeqNo` = cover", but on these the highest-SeqNo row predates the current cover by `DateAdded`: three carry a foreign `W_xxxx_01_` prefix inside their filename (imported from another work), and #2339 has `SeqNo` and filename seq swapped. [`cover_follows_newest_image.sql`](../supabase/sql/cover_follows_newest_image.sql) deliberately skips them. Needs eyes on the actual pictures to say which one should be the cover.

## staged-photos

**Warn when a session photo is staged but never applied** (2026-07-30) — root cause of the 10 stranded photos: a shot can sit in `payload.items[].shots[]` indefinitely with no signal on the work or in the journal. Wants a visible "staged, not applied" marker.

## session-flow

**Session flow follow-ups** (2026-07-19, after apply-passthrough + auto-apply + busy-count shipped): parallelize/paginate `applyWorkSessionToOeuvre` for true per-shot progress; defer `consolidateSessionsForCalendarDay` off the session-open critical path; index-backed `searchWorksForSession` (full-table scan per keystroke).

## phototheque

**Photothèque ~4000 photos** — parked ("on verra plus tard"). Recommendation on file: parallel table reusing R2/AVIF pipeline, optional link to Oeuvres; blocked on owner clarifying documentation-vs-library nature.

## status-labels

**Statuts FR en mode EN** — chips "DISPONIBLE / EN PRODUCTION" come from `OeuvreStatus` DB labels, not UI copy; decide data-side translation.

## circadian

**Circadian sky leftovers** (2026-10-31, after the landing sky shipped). Three known gaps, none blocking: (a) `applyCircadianToKnobs` still ignores `circ.auto` and `circ.manual_minute`, so the KnobsPanel Auto toggle and manual-time slider do nothing — there is no in-app way to preview another hour; (b) `circadianShadowGeometry` ([`lib/landing-text-shadow.ts`](../lib/landing-text-shadow.ts)) still uses the synthetic 06:00-21:00 arc for shadow *direction* while colour and light now come from real solar elevation — the real azimuth is already computed in [`lib/solar-position.ts`](../lib/solar-position.ts) and just needs wiring; (c) the `atm` knob family (`sky_top` / `sky_bottom` / `tint_opacity`) is inert on landing now that the veil is gone — either repoint it at the sky keyframes or drop it from `KnobsPanel` for the landing scope.

## production-span

**Production span follow-ups** (2026-11-01, after `oeuvres_production_span.sql` shipped). Rule lives in the trigger `trg_oeuvre_production_span`: Catalogué ticked → `production_completed_on` = today (Paris), unticked → end cleared + Historique "Reprise en production" line, empty `Année` follows the end year; session new-work items carry a *new / found* choice (`production_origin`, start = session day for *new*). Open: (a) no UI to set or correct the dates by hand — the drawer shows the span read-only; editing needs state + dirty baseline + `saveWork` + pending allow-list; (b) WorkForm "new work" has no new/found choice yet, only sessions do; (c) no backfill — the only catalogue transitions in `oeuvre_versions` are a 2-minute bulk script on 2026-10-31, not real events, so existing works start with no span.

## money

**Money pipeline follow-ups** (2026-11-01, after `sales_payments_and_commission.sql` applied). Live now: `payments` table (RLS team read/write, admin delete, no anon) and the commission columns from `commission_tracking.sql`. Overview income + Fiscal recettes read `lib/sales/income.ts` `fetchSalesIncome` (payments by `payment_date`, plus completed orders with no payment rows at `prix_final` by `completed_at`) — no longer `Oeuvres.statusId === 4` (4 is Réservé, not Vendu). Open: (a) a real sale order + payment has not been created end-to-end yet — 0 `sale_order` rows exist; (b) `Oeuvres.is_paid` is still hand-editable (drawer, batch edit) and not derived from payments; (c) recettes count the gross `prix_final` even for consignment sales with `commission_amount` — decide gross vs net for BNC; (d) `lib/sales/sales-client.ts` still carries hand-written extras (incl. a `sale_order.updated_at` that does not exist) now covered by generated types.

## semantic-search

**Semantic search on pgvector — follow-ups** (2026-11-01, after `semantic_search_pgvector.sql` applied). Qdrant Cloud retired (free cluster deleted for inactivity): vectors live in `nodes.embedding` (vector 768, HNSW cosine), searched via `match_nodes()` (service-role only) from `app/atelier/search/actions.ts`; worker writes the vector with the `ok` status. (a) ~~Qdrant leftovers~~ done 2026-11-02 (owner OK): [`drop_qdrant_leftovers.sql`](../supabase/sql/drop_qdrant_leftovers.sql) applied (table + column dropped, `graph_mark_nodes_pending` no longer writes the column), `qdrant-client.mjs` deleted, `QDRANT_*` removed from `.env.local` — **still to remove from Vercel env** (owner, in the Vercel dashboard). Open: (b) Vercel still has no Ollama — a new phrase queues in `pending_query_embeddings` until the desktop worker runs; (c) ~~widen search text~~ done 2026-11-13 (`oeuvre_search_text_wider.sql`); was: 919 of 1177 works are untitled, so their search text is often just the technique (`node_search_text` = title + comments + technique) — widen it (themes, support, year, location) for useful matches; hits for untitled works show `#OeuvreID`.

## supplies

**Fournitures / Supplies — follow-ups** (2026-11-02). Shipped locally: one Studio tab `/atelier/stock` with sub-views Stock (SupplierHub) · Comptage (StockTake; `/atelier/stock-take` redirects) · Réassort / Commande (out of stock or below `min_stock`, grouped by supplier, per-device order draft, copy order). Live data: 235 items, **0 with a minimum set**, 98 without a supplier. Open: no orders table (an order is a copied text, not tracked); a placed order could become an expense (and feed cost per work); the Stock list still lists suppliers first — rename its heading if it still reads as "contacts".

## s6

**S6 leftovers** (2026-11-01 block moved to [`DONE.md`](./DONE.md)): photo background / frame counts as a colour; storage cost as a per-day rate; re-check the iOS share-sheet → PWA path (iPhone share menu may not list PWAs); audit `/atelier/site` controls before changes.

## vat

**Idea (owner 2026-11-12, no GO): VAT per sale** — today `Oeuvres.tva_rate` is typed by hand. Wanted: rate resolved from the transaction itself (date, buyer country, buyer VAT number, artist-author 5.5 %, EU B2C distance-sale threshold €10k → OSS, intra-EU B2B reverse charge, export exempt), with a running total against the thresholds. Rules to confirm with the accountant before any build.
