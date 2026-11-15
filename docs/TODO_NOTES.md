# TODO — notes

_Details of the open items in [`TODO.md`](./TODO.md), text as it was on 2026-11-13 (sections added 2026-11-15 say so). A reference, not a list: the list and the order are in `TODO.md`. When an item closes, move its note to [`DONE.md`](./DONE.md)._

## security

**Security, remaining.** Security, remaining: `anon` write grants on most tables (RLS only); `system_log` + `studio_task` open to any signed-in account; no content security policy (start report-only); `xlsx` 0.18.5 usage to check; `storage_object_ledger` table does not exist (`lib/storage-object-ledger.ts` writes to it).

## restore-drill-and-archive

**Restore drill and archive.** Restore drill (O4) never run. Archive: no in-app reminder when the last run is old; no second-disk copy.

## journal-phase-2

**Journal phase 2.** Journal phase 2 — proposal [`JOURNAL_PROPOSAL.md`](./archive/JOURNAL_PROPOSAL.md); each build step needs a GO. Steps 1–3 and 5 built 2026-11-12 (What's new up to 3.0.9: entries, day page = main field tab, capture inside the day, ✦ suggestions with the stricter rule, entries in ⌘K search and in the Constellation work panel). Empty "Day opened" sessions of 11 + 12 Nov deleted (owner GO); capture opened and closed with nothing added now discards its own empty session. Phone review 2026-11-12 done: drawer themes compact + ⋯ bar, inventory "Filtres & vues" + grid default. Kaizen #34 (bounce work → contact) built 2026-11-12: ↗ in the drawer's Ownership fields → `/atelier/contacts?contact=&from_work=` → "← back to work". Field UX batch ([`HANDOFF_2026-11-12_FIELD_UX.md`](./archive/HANDOFF_2026-11-12_FIELD_UX.md)) built 2026-11-13: Production drag-back, ✦ bar, contact pop-up over the drawer, `#1234` hover/hold preview, Système tools cleanup. Open: step 4 transcription batches (instructions [`TRANSCRIPTION_BATCHES.md`](./TRANSCRIPTION_BATCHES.md); handwriting test reminder 2026-11-13); journal entries as Constellation canvas nodes (canvas is keyed by work id — needs a redesign, no GO).

## work-or-version

**Owner 2026-11-13:** a partial rework is a new version of the same work (same number) — record it in the work's history (date, new photo, what changed). Full cover / new support = new work + "painted on" / "derived from" link (built 2026-11-13).

**Work or version.** From the proposal (archived 2026-11-13), still open: **work or version** rule — partial rework (glaze, scumble, pentimento) = new photo + version row on the same number; full cover = new work + "painted on" link; new support = new work + "derived from" link (work ↔ work links: HANDOFF_2026-11-13_OPUS task E).

## production-start-date

**Production start: partial date input** (owner 2026-11-03) — text input with year / month / day like the fate date; also fixes the half-typed date carried between works.

## custody

**Custody follow-ups** — orders do not store the custodian's address (picked in the drawer when the custodian has several); a cancelled sale of a consigned work returns it to Pem, not to the gallery; none of the order paths clicked through yet (no orders in the data).

**Where the papers are made (checked 2026-11-15, for TODO R7).** Sale: Sales tab → « Créer la commande + PDF » (`createSaleOrder` → `buildOrderPdf`; commission taken from an active consignment that covers the works, `detectActiveConsignment`). Consignment / loan: Pipeline → new process (`PipelineProcessModal` → `createConsignmentOrder`, `app/atelier/consignments/actions.ts`) → `BORDEREAU_<ref>.pdf` / `BORDEREAU_PRET_<ref>.pdf`, registered in the Vault; regenerate / close from `PipelineProcessDrawer`. Gift: work card gift dialog (`markAsGift`, `app/atelier/works/gift-actions.ts`) → `gifts/BORDEREAU_DON_<id>_<date>.pdf` in the Vault, no order. Live 2026-11-15: 0 `sale_order`, 0 `consignment_order`, 6 works `is_gift`.

## concept-documents

**Concept documents — UI not yet clicked through** (was blocked by the browser-pane loading issue, see `DONE.md`; unblocked 2026-11-03, it was the test browser). DB constraint, server actions, typecheck/lint/i18n verified 2026-11-01.

## session-write-paths

**Verify two session write paths on the next real capture** (2026-07-30). Both are code-complete but unexercised, because each needs a photo uploaded from a device: (a) `Technique`/`Support` written to `Oeuvres` when a new work is committed from the field — check with `select "OeuvreID","Titre","Technique","Support" from "Oeuvres" order by "OeuvreID" desc limit 5;`, (b) applied-photo removal (`removeAppliedSessionImage` → `deleteWorkImage` → `recycle/`). No lossless test image exists — the catalogue has zero duplicate-sha rows — so (b) should be tested on a throwaway photo, not a real one. The `sha256` duplicate guard IS verified: it skipped 4 of 10 shots during the 2026-07-30 apply.

## staged-photos

**Warn when a session photo is staged but never applied** (2026-07-30) — root cause of the 10 stranded photos: a shot can sit in `payload.items[].shots[]` indefinitely with no signal on the work or in the journal. Wants a visible "staged, not applied" marker.

## session-flow

**Session flow follow-ups** (2026-07-19, after apply-passthrough + auto-apply + busy-count shipped): parallelize/paginate `applyWorkSessionToOeuvre` for true per-shot progress; defer `consolidateSessionsForCalendarDay` off the session-open critical path; index-backed `searchWorksForSession` (full-table scan per keystroke).

## phototheque

**Owner 2026-11-13:** a library — 99 % standalone photographs, not linked to a painting or drawing, though they sometimes serve one. So: its own table, search and browsing; an optional link to a work, never required.

**Photothèque ~4000 photos** — parked ("on verra plus tard"). Recommendation on file: parallel table reusing R2/AVIF pipeline, optional link to Oeuvres; blocked on owner clarifying documentation-vs-library nature.

## status-labels

**Statuts FR en mode EN** — chips "DISPONIBLE / EN PRODUCTION" come from `OeuvreStatus` DB labels, not UI copy; decide data-side translation.

## circadian

**Circadian sky leftovers** (2026-10-31, after the landing sky shipped). Three known gaps, none blocking: (a) `applyCircadianToKnobs` still ignores `circ.auto` and `circ.manual_minute`, so the KnobsPanel Auto toggle and manual-time slider do nothing — there is no in-app way to preview another hour; (b) `circadianShadowGeometry` ([`lib/landing-text-shadow.ts`](../lib/landing-text-shadow.ts)) still uses the synthetic 06:00-21:00 arc for shadow *direction* while colour and light now come from real solar elevation — the real azimuth is already computed in [`lib/solar-position.ts`](../lib/solar-position.ts) and just needs wiring; (c) the `atm` knob family (`sky_top` / `sky_bottom` / `tint_opacity`) is inert on landing now that the veil is gone — either repoint it at the sky keyframes or drop it from `KnobsPanel` for the landing scope.

## production-span

**Production span follow-ups** (2026-11-01, after `oeuvres_production_span.sql` shipped). Rule lives in the trigger `trg_oeuvre_production_span`: Catalogué ticked → `production_completed_on` = today (Paris), unticked → end cleared + Historique "Reprise en production" line, empty `Année` follows the end year; session new-work items carry a *new / found* choice (`production_origin`, start = session day for *new*). Open: (a) no UI to set or correct the dates by hand — the drawer shows the span read-only; editing needs state + dirty baseline + `saveWork` + pending allow-list; (b) WorkForm "new work" has no new/found choice yet, only sessions do; (c) no backfill — the only catalogue transitions in `oeuvre_versions` are a 2-minute bulk script on 2026-10-31, not real events, so existing works start with no span.

## money

**Decided 2026-11-13 (owner):** consignment sales count **gross** (`prix_final`) in Revenus — (c) below is closed.

**Money pipeline follow-ups** (2026-11-01, after `sales_payments_and_commission.sql` applied). Live now: `payments` table (RLS team read/write, admin delete, no anon) and the commission columns from `commission_tracking.sql`. Overview income + Fiscal recettes read `lib/sales/income.ts` `fetchSalesIncome` (payments by `payment_date`, plus completed orders with no payment rows at `prix_final` by `completed_at`) — no longer `Oeuvres.statusId === 4` (4 is Réservé, not Vendu). Open: (a) a real sale order + payment has not been created end-to-end yet — 0 `sale_order` rows exist; (b) `Oeuvres.is_paid` is still hand-editable (drawer, batch edit) and not derived from payments; (c) recettes count the gross `prix_final` even for consignment sales with `commission_amount` — decide gross vs net for BNC; (d) `lib/sales/sales-client.ts` still carries hand-written extras (incl. a `sale_order.updated_at` that does not exist) now covered by generated types.

## semantic-search

**Semantic search on pgvector — follow-ups** (2026-11-01, after `semantic_search_pgvector.sql` applied). Qdrant Cloud retired (free cluster deleted for inactivity): vectors live in `nodes.embedding` (vector 768, HNSW cosine), searched via `match_nodes()` (service-role only) from `app/atelier/search/actions.ts`; worker writes the vector with the `ok` status. (a) ~~Qdrant leftovers~~ done 2026-11-02 (owner OK): [`drop_qdrant_leftovers.sql`](../supabase/sql/drop_qdrant_leftovers.sql) applied (table + column dropped, `graph_mark_nodes_pending` no longer writes the column), `qdrant-client.mjs` deleted, `QDRANT_*` removed from `.env.local` — **still to remove from Vercel env** (owner, in the Vercel dashboard). Open: (b) Vercel still has no Ollama — a new phrase queues in `pending_query_embeddings` until the desktop worker runs; (c) ~~widen search text~~ done 2026-11-13 (`oeuvre_search_text_wider.sql`); was: 919 of 1177 works are untitled, so their search text is often just the technique (`node_search_text` = title + comments + technique) — widen it (themes, support, year, location) for useful matches; hits for untitled works show `#OeuvreID`.

## supplies

**Fournitures / Supplies — follow-ups** (2026-11-02). Shipped locally: one Studio tab `/atelier/stock` with sub-views Stock (SupplierHub) · Comptage (StockTake; `/atelier/stock-take` redirects) · Réassort / Commande (out of stock or below `min_stock`, grouped by supplier, per-device order draft, copy order). Live data: 235 items, **0 with a minimum set**, 98 without a supplier. Open: no orders table (an order is a copied text, not tracked); a placed order could become an expense (and feed cost per work); the Stock list still lists suppliers first — rename its heading if it still reads as "contacts".

**Invoice → stock (2026-11-15, TODO 11d).** Pem asked how a supplier invoice feeds stock and suppliers. Today it does not: Income & Expenses (`Fiscal.tsx`) records a bill / ticket by hand (type, amount, `receipt_ref`) with no link to `stock` items or to the supplier contact; stock quantities change only through Count (`/atelier/stock?view=count`). A design would tie: invoice (expense) → its lines → stock items (+ quantity) → supplier contact, and the order of item 11 → that invoice. Reading the invoice by itself = OCR (needs Pem's GO, `CLAUDE.md`). Suppliers section of Stock starts open (`SupplierHub.tsx` `suppliersOpen` = true) — TODO B8.

## s6

**S6 leftovers** (2026-11-01 block moved to [`DONE.md`](./DONE.md)): photo background / frame counts as a colour; storage cost as a per-day rate; re-check the iOS share-sheet → PWA path (iPhone share menu may not list PWAs); audit `/atelier/site` controls before changes.

## vat

**Idea (owner 2026-11-12, no GO): VAT per sale** — today `Oeuvres.tva_rate` is typed by hand. Wanted: rate resolved from the transaction itself (date, buyer country, buyer VAT number, artist-author 5.5 %, EU B2C distance-sale threshold €10k → OSS, intra-EU B2B reverse charge, export exempt), with a running total against the thresholds. Rules to confirm with the accountant before any build.

## notes-transcript

**Notes: transcript not shown (2026-11-15, TODO B1 — fixed same day, see DONE).** `scripts/transcribe/voice_batch.py --write` adds each transcript as a `journal_entry` (`voice_note_id`, `engine` « faster-whisper large-v3 ») and never writes `voice_note.transcript`. The Notes list, the right panel and the triage panel (`app/atelier/(portal)/notes/_components/Notes.tsx`, `NoteTriagePanel.tsx`) read only `voice_note.transcript` → empty for both audio notes (« Couleur » 2026-11-14: 272 characters in the Journal; « Light study figure sur cadre noir » 2026-08-08: 1 400). Overview « Voice notes to transcribe » counts notes with audio and no linked entry → 0, correct. Fix: when `transcript` is empty, show the linked entry's text (marked « ✦ transcript · engine · unverified », as in the Journal); « Save transcript » then writes `voice_note.transcript` (Pem's version) and leaves the machine entry alone. Typed-but-unsaved text is lost on leaving (TODO B2).

## inputs

**Inputs (R1) — Notes, 2026-11-15.** Kinds `memo / dictation / meeting / field` and projects (buckets) `terrain / studio / commercial / general` come from `lib/voice-note-domain.ts`; set only in the record sheet (`components/shared/VoiceNoteSheet.tsx`, defaults memo · general); the Notes screen filters by them but cannot change them. Pem wants the tab called « Notes » — a sketchbook / notebook plus voice. Idea (Pem): say keywords at the start or end of a recording (« projet X », « œuvre 2357 », « recherche… ») so the PC transcript routes the note by itself — a rule list matched after transcription, suggestions to confirm, not silent moves.

## previews

**`#1234` previews everywhere (R4) — from the closed handoff NEXT §5 ([archive](./archive/HANDOFF_2026-11-14_NEXT.md)).** The hover / hold card exists (`components/atelier/WorkRef.tsx`). Plain `#id` links without it (2026-11-14): AI suggestion rows, Kaizen works row and changes list in `JournalDayExtras.tsx`; `NoteTriagePanel.tsx` (`#{note.oeuvre_id}`, Pem screenshot 2026-11-15 « #2357 · Les mortes marguerites »), `Notes.tsx` labels, `Production.tsx`, `Sales.tsx`, `DrawerWorkSessionsSection.tsx`. Sweep: grep `#{` and `#${` in `.tsx`, keep work ids only. Then thumbnail + loupe like Inventory (`WorkThumb` 40 px in `ImageLoupe`), AI suggestion rows first; those queries likely lack the cover file and the title.

## voice-limits

**Voice notes, limits (1c).** A note longer than one upload (~4 MB, auto-stopped today; the owner starts a new one) → browser → R2 direct upload (needs a CORS PUT rule on the public bucket); a note recorded with no network is kept only while the sheet is open → keep it on the phone (IndexedDB) and send later.

## docket-scan

**Batch scan of expenses / dockets (2026-11-15, TODO 11e).** Pem pasted a proposal (written by another assistant): Google Drive app on the iPhone → « + » → Scan (several dockets → one PDF) into a Drive folder « To Import » → Google Drive for Desktop shows it on the PC (`G:\My Drive\To Import`) → a PC processor reads it. Facts (2026-11-15): Google Drive for Desktop is **not installed** on the studio PC (no `C:\Program Files\Google\Drive File Stream`, no `G:`); nothing was set up. Other paths to weigh in the design: the iPhone's own « Scan Documents » (Files / Notes) → Share → the PWA share target (`/atelier/share-receive`), which lands in R2 without a third-party drive; or OneDrive / a synced folder. Processing fits the existing pattern: a PC batch on the local GPU like `scripts/transcribe/*` (no server queue — `CLAUDE.md` no-GO), one PDF page per docket, fields proposed and confirmed by hand in Income & Expenses, never written silently. Reading dockets = OCR beyond business cards → **needs Pem's explicit GO** (`CLAUDE.md` Hard Rules). Linked: 11 (orders → expense), 11d (invoice lines → stock + supplier).

## palette-main-colours

**Palette = the work's main colours, not a measure of area** (Pem 2026-11-15, B9 #6): "it's a matter of identifying the main colors. Even if the amount of red is small, this is a work with black, gray, white, and red." #2233's stored palette is grey 84 % / black 16 %.

Measured on #2233's cover with `lib/image-palette.ts` (2026-11-15, debug copy, nothing changed):
- The red is there, ≈ 0.9 % of the picture, but **split across three families** — red-orange 0.29 %, brown 0.36 %, red 0.23 % — each far under `MIN_SHARE` (1.5 %).
- It is **not "vivid" by the accent rule**: highest Lab chroma 30–35, the rule asks ≥ 35 (`ACCENT_CHROMA`) on ≥ 0.15 % of pixels.
- **White = 0 %**: the colour is read on a copy shrunk to `SAMPLE_EDGE` 160 px, where the thin white chalk lines blur into grey (grey's light share 1 %).

Fix ideas (to agree, then re-run the palette backfill `scripts/backfill-image-palette.mjs` on all covers):
1. Judge an accent by the **warm / cool group**, not one wheel family (red + red-orange + rust-brown together = 0.9 %).
2. Judge "vivid" **against the picture itself**: in a near-neutral picture (most pixels chroma < 10), any hue at chroma ≥ ~20 stands out.
3. Read neutrals on a **larger sample** (e.g. 480 px) so thin white lines stay white; or name "white" when a grey has a strong light share.

**Done in code 2026-11-15 (not yet applied to stored palettes).** Pem 2026-11-15: what matters is the **presence** of red — « just the touch of red », his Photoshop red selection + threshold shows patches in the face; the swatch may be its average. The white is chalk: grey in pixels, white in the work. His wheel: red, yellow, blue (+ black, white); orange, green, violet where two meet; an in-between hue is its primary with a lean — « primary always takes » (orange-ish red = red, greenish blue = blue); brown is a dark orange (a painter's convenience, dropped). `lib/image-palette.ts`: sample = the 400 px thumb whole (was 160); rule 6 white relative to the picture (neutral L ≥ max(65, median L + 30), 82 at most); rule 7 near-neutral picture (≥ 90 % neutral) → touch chroma 20 (was 35); rule 8 small hues gathered by their main colour on Pem's wheel (red-orange, red-violet → red; yellow-orange, yellow-green → yellow; blue-green, blue-violet → blue; brown → orange, except a dark red filed as brown → red) and kept as one touch (accent) of that colour unless it is already a main colour, swatch = average of its vivid pixels, border band 3 % of the shot ignored (#1263's top-edge strip). Measured on #2233 at 400 px: neutral L ≥ 60 = 5.5 %, warm chroma ≥ 20 = 0.20 %. Result #2233: grey 80 %, black 16 %, **white 3.5 %**, **red touch 0.9 %**. Dry run on 39 covers (every 40th + #2233 / #2357 / #2366, nothing written): 17 differ — white added to dark drawings with white marks (#1504, #1263, #2087, checked by eye), red touches (#1534 toenails, #1568, #1323, #2357), #345 ochre swirl → orange touch, ±0.1 % noise at the 1.5 % edge (#1283 loses blue 1.7, #2028 brown / red-orange). ~70–110 ms per image. Main families still use the 13 names — regrouping them on Pem's wheel (filter « Rouge » = every red, lean shown as a word) is the next design step (touches the colour filter, Inventory, the work card). Next for this step: Pem's OK → `node scripts/backfill-image-palette.mjs --all`.

