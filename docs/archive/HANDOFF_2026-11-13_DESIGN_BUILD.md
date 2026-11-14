# Handoff — build the three redesigned surfaces (B1 Overview · B2 Batch modify · B3 Export)

**For:** Claude Code (build session). **From:** design pass, 2026-11-13.
**State when written:** `origin/main` = `c3d8ff7`; this handoff + `docs/design/2026-11-13/` are local, not committed. **Re-checked 2026-11-13:** `origin/main` = `bddc428`; build order readjusted in [`HANDOFF_2026-11-13_NEXT.md`](./HANDOFF_2026-11-13_NEXT.md) "Order" — **B2 first, then B1, B3 last (after D2)**; follow that order, not §5 below.
**Rules:** `CLAUDE.md` (auto-loaded) wins over this file. Plan in one message, build in the order below, one commit per surface, What's new item per surface (FR/EN), checks once per batch. No new feature beyond what is listed without Pem's GO (see "Decisions for Pem").
**Verified against live code 2026-11-13** (file paths, live fields and export options below were read from the code on that date; the mocks were not checked in a browser).

---

## 0. What you get

| Source | What it is |
|---|---|
| [`docs/DESIGN_BRIEF_2026-11-13.md`](./DESIGN_BRIEF_2026-11-13.md) | The owner's brief — goals and "wrong means" rules |
| [`docs/design/2026-11-13/`](./design/2026-11-13/) | Mock sources (`.dc.html`, plain HTML + inline styles). **The exact values (sizes, colours, spacing) are in these files** — open them in a browser or read them |
| Design canvas (claude.ai, private to Pem) | `https://claude.ai/artifact/URnNhkKhxL6Po99mQVSNMC` — the same mocks, interactive. Not needed to build |

Files in `docs/design/2026-11-13/`:
- `Overview.dc.html` — desktop 1440×900 (long hover on a panel marked "+ more" opens it in place — "liquid grid"; hover a latest work = full-screen loupe)
- `OverviewPhone.dc.html` — phone 390
- `Batch.dc.html` — desktop 1440×900
- `BatchPhone.dc.html` — phone 390, full scroll length (header + Apply bar sticky)
- `Export.dc.html` — desktop 1440×900 (type tabs switch the preview)

Mock data is **sample** (numbers, `[Title]`, `[Group A]`, `[Gallery]` …). Never ship it — every value comes from the existing loaders.

## 1. Shared rules for all three

**Tokens — the mocks use raw hexes; map them to the existing CSS variables** (`app/globals.css`, so light / mid-grey themes keep working):

| Mock hex | Use |
|---|---|
| `#080809` / `#101011` / `#19191b` | `--bg0` / `--bg1` / `--bg2` |
| `#2d2d32` / `#3f3f46` / `#52525b` | `--bd` / `--bd2` / `--bd3` |
| `#f8f7f3` / `#b4afa1` / `#807c72` | `--tx` / `--tx2` / `--tx3` |
| `#d4b886` | `--ac` (gold = "will change", active tab, primary button) |
| `#ee7a52` (wrong) | `--rust` |
| `#e6c04a` (attention) | `--yellow` |
| `#8fb070` (OK) | `--sage` |

Tinted backgrounds in the mocks (`rgba(…, 0.07–0.09)`) → `color-mix(in srgb, var(--rust) 9%, transparent)` etc.
`--tx3` passes contrast on `--bg0`/`--bg1` only (4.57:1) — never put `--tx3` text on `--bg2`.

**Signal = colour + shape, never colour alone** (brief: readable from 2 m):
■ square = wrong · ▲ triangle = needs attention · ● filled circle = OK · ○ outline circle = informative.
One small shared component, e.g. `components/atelier/SignalMark.tsx` (`kind: 'wrong' | 'attention' | 'ok' | 'info'`, CSS shapes, `aria-hidden`; the parent carries the text/`aria-label`). Reused by B1 and anywhere else that needs a state mark.

**Copy:** every string through `useI18n().t()`, new keys in one `lib/i18n/messages/*.messages.ts` module per surface (FR + EN together). French labels are ~30 % longer — the 132 px label column in Batch is sized for them; check FR at 1280.

**Type:** UI stays `--font-ui` (Sofia Sans). Titles use the existing serif (`--font-instrument-next`). Numbers `font-variant-numeric: tabular-nums`.

**Density:** rows 26–30 px desktop, ≥ 44 px tap targets on phone. 1 px dividers, no card padding, no decorative space (memory: mixing-desk rule).

**Check every surface at** 1440×900 and 1280×800 (no scroll, nothing clipped), and phone surfaces at 375 and 360 (no sideways scroll, sticky bars with `max(…, env(safe-area-inset-bottom))`).

---

## 2. B1 — Overview tab (build first)

**Status — built 2026-11-13 (verified against live code 2026-11-13, committed locally, not pushed):** `OverviewTab.tsx` rewritten (header with tally + legend · signal row · 4 columns · status bar; phone = signal rows worst first + reminders list, keeping `#atelier-field-reminders` for the mobile bar); `components/atelier/SignalMark.tsx`; `EmbeddingIndexCard.tsx` now exports `useLocalJobs` (counts feed the signal) + `LocalJobsControls`; copy in `lib/i18n/messages/overview-dash.messages.ts`. The tab measures the window and fills it (no page scroll) when its width is ≥ 900 px; narrower desktop windows stack the columns two by two and scroll. Non-admins: 6 signals (no Integrity / Local jobs, no approvals). Liquid grid: Pipeline (> 5 deadlines), Reminders (items not yet due), Burning ideas (> 3), Latest works (> 4) open after ~0.7 s rest, switch after 0.25 s, close 0.3 s after leaving; the "+N" in the header also toggles by click. "See again" gives up height first and scrolls inside. Defaults while Pem decides: **D1** = backlog ▲, archive > 14 d or never ■; **D3** = net < 0 ▲ (no cash-low threshold exists). Not built (no data today, no new query): monthly income/expense bars, "cash 4.2 months", active-projects list (Pipeline uses the deadline list). Checked on dev (non-admin account): 1440×900 and 1280×800 — page height = window, no sideways scroll; hover opened Latest works in place; phone 375 — no sideways scroll. Not checked: admin view (Integrity / Local jobs cells) on the live site, EN copy, a dev account with deadlines (dev has none).

**Files:** `components/atelier/overview/OverviewTab.tsx` (635 lines; has `ConsoleRow`, mounts `SeeAgainCard` and `EmbeddingIndexCard`), `components/atelier/overview/EmbeddingIndexCard.tsx`, route `app/atelier/(portal)/overview/page.tsx` → `portal-tab-page`. Start by listing every block the tab renders today and where its data comes from; **keep the data, change the layout**. No new queries unless a block below has no data today — then say so before adding one.

**Desktop grid (top to bottom, fills the viewport, no page scroll):**
1. Header 44 px — serif title, date/time, overall count pill (`3 wrong · 3 attention · 1 OK`), shape legend, refresh.
2. **Signal row 112 px — 8 equal cells, fixed positions** (the eye learns where each signal lives; do not re-sort by state): Needs you · Catalogue · Integrity · Deadlines · Reminders · Money · Local jobs · Collection. Each cell: 3 px top bar in the signal colour + light tint (wrong/attention only), shape + label, big number (34 px), one detail line. The whole cell is a link to the block's detail below / the fixing tab.
3. Detail area — 4 columns `1.15fr 1.1fr 1fr 0.9fr`, panels stacked, 30 px panel headers (shape · label · count · "Open X →" link to the fixing tab):
   - Col 1 "act": Needs you (6 rows, zero rows greyed with ●) · Catalogue health worst-first with a bar per gap, **Integrity merged as the first row** of this panel.
   - Col 2 "time": Pipeline & deadlines (overdue row tinted rust, today amber) · This week (7-day strip, today underlined gold) · Reminders (4 counters: overdue / today / tomorrow / next 7 days + the today items).
   - Col 3: Money (income / expenses / net BNC, monthly paired bars, cash health + pulse) · Collection (6 counters + technique stacked bar).
   - Col 4 "studio": Local jobs (voice notes, index backlog, days since PC archive as a bar to the 14-day alarm) · Burning ideas (energy 1–5 pips) · See again (`SeeAgainCard`, compact) · **Latest works** (the existing recent-documentation thumbnails: click opens the work, hover shows the whole picture full screen — keep today's loupe behaviour, `components/atelier/ImageLoupe.tsx`; long press on phone).
4. Status bar 24 px — hint text + last sync.

**Admin-only blocks (live, missed by the mock):** Integrity, Local jobs and pending approvals render only for `isAdmin` in `OverviewTab.tsx`. Non-admins get a 6-cell signal row (no Integrity, no Local jobs; the others keep their order), no Integrity row in Catalogue health, no Local jobs panel, and "Needs you" without approvals. Keep that gate.

**Signal rules** (from the brief): Needs you any > 0 → ▲ (all zero → ● "all clear") · Catalogue any gap → ■ · Integrity any collision → ■ · Deadlines any overdue → ■ · Reminders overdue → ■, else today > 0 → ▲ · Money negative trend or cash low → ■ (thresholds: ask Pem; until then use whatever the current "cash health" already flags) · Local jobs: see decision D1 · Collection always ○.

**Liquid grid — per panel, not per column (owner, 2 comments on the mock):** only panels that have more to show expand; they carry a quiet "+N more" in their header. Today: **Pipeline & deadlines** (later deadlines + the active projects list), **Reminders** (every item behind the counters), **Burning ideas** (all ideas), **Latest works** (more thumbnails). Panels with nothing more (Integrity, Needs you, Catalogue, Money, Collection, This week, Local jobs, See again) never expand.
- Resting the pointer ~700 ms on such a panel opens it in place, inside its own column: the extra rows slide in (`max-height` + opacity, ~380 ms) and the panel takes the column's free height; the other panels of that column shrink (they clip from the bottom, header always visible). The open panel scrolls if its content is still taller (sticky panel header). Gold 2 px inset line on top while open.
- Moving to another expandable panel while one is open switches after ~250 ms; leaving restores after ~300 ms, and it stretches back the same way it opened.
- Columns keep their widths; the signal row never moves. Desktop pointer only (`(hover: hover)`); under `prefers-reduced-motion` open/close without animation. Implementation hint: column = flex column; open panel `flex: 1 1 auto; min-height: 220px; overflow-y: auto`; other panels `flex: 0 50 auto; min-height: 30px; overflow: hidden` (they give up height first).

**1280×800:** rows 26 → 22 px, panel headers 30 → 26, Latest works may drop to 3 thumbnails. Still no scroll (an opened panel may scroll inside itself).

**Phone (`useMediaQuery('(max-width: 767px)')`):** `OverviewPhone.dc.html` — header, 3-cell summary (wrong / attention / OK), then signal rows grouped **Wrong → Needs attention → OK → info**, each row 46 px: shape · label · count · chevron, tap = open the fixing tab. No charts, no Ideas / See again / documents.

**Done when:** no scroll at 1440×900 and 1280×800; every block links to its fixing tab; all-zero shows ● "all clear"; phone has no charts; What's new item.

---

## 3. B2 — Batch modify dialog

**Status — built 2026-11-13 (verified against live code 2026-11-13, committed locally, not pushed):** `BatchEditModal.tsx` rewritten as the mixer (header · selection strip · 3 columns · footer listing the changes), copy in `lib/i18n/messages/batch-edit.messages.ts`; `CurationDock` passes `oeuvres`, `isAdmin` and the theme map (`oeuvreThemeMap`) — no new query. Non-admins see only what `batchEdit` lets them change in bulk (period, ready to broadcast, themes, groups) in a 2-column layout. Theme chips show `n/N`; group chips have no counts (memberships not loaded). "+ New group" uses `createWorkingGroup`. Checked on dev: 1440×900 and 1280×800 (FR, admin layout forced locally for the screenshot only — not applied; non-admin layout as the dev account), phone 375 (sticky header + Apply bar, no sideways scroll). Not checked: admin view on the live site (Chrome, after deploy), EN copy at 1280, Apply end-to-end (nothing was applied on dev). Place made: waits for A3.

**File:** `components/atelier/BatchEditModal.tsx` (541 lines; opened from `components/atelier/CurationDock.tsx`). Keep the existing save path (`batchEdit` in `app/atelier/selection/actions.ts`), the note-append behaviour (`YYYY-MM-DD — text`, never overwrite) and `createTheme` / `createWorkingGroup`.

**Layout (desktop 1392×648 dialog, centred over the dimmed Inventory):**
- Header 52 — serif "Modify N works", one-line rule ("Every field starts unchanged — only what you set is applied"), Reset all, ✕.
- Selection strip 40 — up to 20 tiny thumbs + "+N", right: "N selected · techniques · year range · status mix".
- Body: 3 columns.
  - Col 1: **Identity** (status, year, title, technique, support, **format**, period) · **Price** (price, discount) · **Location** (location detail, Pem address + its help text under the field).
  - Col 2: **Flags matrix** — one row per yes/no field, columns `— / Yes / No` (tri-state, like mute/solo buttons) · **Note to append** with a live preview of the dated line it will add.
  - Col 3: **Themes** (search, + New theme, chips showing `n/N` = how many of the selection have it now; click cycles add-to-all → remove-from-all → unchanged; added = gold fill `n→N`, removed = rust outline + strikethrough `n→0`) · **Working groups** (same chip behaviour, + New group).
- Footer 56 — "**K** fields will change:" + one chip per change (`Status → Available`, `Themes +2 −1`, `Groups +1`, `Note appended`) · Cancel · **Apply to N works** (gold).

**States (the point of the redesign):** unchanged = grey label (`--tx3`), no fill, faint border, em dash — nothing to read. Will change = gold dot + gold bold label + gold-bordered value + faint gold row tint + ✕ to reset that field. A glance at the gold tells what Apply does; the footer repeats it.

**Mock vs live — follow the live fields, not the mock, where they differ:**
- **Commission** is a yes/no flag in live code (`TriField` `isCommission`), **not** a percentage. Put it in the Flags matrix; drop the mock's "Commission (%)" input.
- **Format** exists live (`FieldWrap label="Format"`) and is missing from the mock — add it to Identity.
- **"Location notes"** in the mock is not a live field (live has the section title `locationNotes` over location detail / address / period / note). Drop that textarea.
- **Place made** depends on A3 (`made_at_place_id`, not built). Leave it out until A3 ships, then add it to Identity.
- **Admin-only fields**: the brief says they are hidden for non-admins, but `BatchEditModal.tsx` has no `isAdmin` check today. Find where (if anywhere) the gate lives before relying on it; Price + paid/gift are the mock's admin set (lock tag). Hide, don't disable.
- Status keeps its live help text (`batch_status_studio_help`), Pem address keeps `batch_pem_address_help`.
- Live flags: needs photo, catalogued, exhibitable, mounted, framed, commission, gift, paid, ready to broadcast — all go in the matrix.
- Theme / group `n/N` counts: compute from the selected works already in memory; if they are not loaded, show chips without counts rather than add a query.
- **The modal receives only `ids` today** (`CurationDock.tsx` → `BatchEditModal`). For the selection strip and counts, pass the selected rows `CurationDock` already holds (it passes `oeuvres` to `ExportModal`) — no new query.
- `label="Format"` is hardcoded live → give it an i18n key in the B2 messages module.

**Phone:** `BatchPhone.dc.html` — one column, same sections in the same order, rows 46 px (label 140 px · control), flags as three 44 px segments, chips 36 px. Header and Apply bar sticky; the Apply bar repeats "K fields will change · names".

**Done when:** every live field visible without scrolling at 1440×900 and 1280×800 (FR copy); unchanged vs will-change readable at a glance; footer count matches what `batchEdit` receives; phone has sticky Apply; existing Playwright for batch edit (if any) still passes; What's new item.

---

## 4. B3 — Export dialog (from the batch dock)

**Files:** `components/atelier/ExportModal.tsx` (812 lines), opened from `CurationDock.tsx`; server `generateExport` in `app/atelier/selection/actions.ts` (returns HTML, ~line 473–551); CSV route `app/api/export/csv`. Separate engine, **do not merge**: Portfolio PDF (`app/atelier/(portal)/portfolio/pdf-action.ts`).

**Layout (desktop only, full window):** top bar 52 (serif "Export N works", type tabs, "Preview with: my N works ▾", Cancel, primary button naming the real output, e.g. "Export PDF (26 pages)") · left pages panel 132 px (page thumbnails, active one gold-outlined) · centre live preview on `--bg2` at real page ratio + bottom bar (page n / N, format, zoom −/+ , Fit) · right options dock 320 px (Page → type-specific → Fields with drag order + admin lock → Output: file name + size estimate).

**The mock's four tabs are not today's export types.** Live `ExportModal` has: format **HTML / PDF**; layouts **cards (`fiches`) / grid (`grille`) / quick list (`listeRapide`)**; grid columns; cards per page; rows per page; image size / embedded-or-linked / crop; paper (`screen` for HTML, A4 / A3 for PDF); orientation; "append list"; field checkboxes; **saved themes** (named presets in localStorage). Build the redesign on those:
- Tabs = the live layouts: **Cards** (≈ the mock's "Catalogue sheet") · **Grid** (≈ "PDF portfolio" page) · **Quick list** (≈ "Table"). HTML/PDF = a control in the dock's Page section, not a tab.
- CSV stays where it is unless Pem says to add it as a tab (D2).
- **Labels** is a new export type → only with Pem's GO (D2).
- Saved themes must stay: a "Preset ▾ / Save as…" row at the top of the dock.

**Faithful preview — the core of B3:** the preview must be the real output, not a lookalike. Preferred: call the same HTML builder `generateExport` uses (factor it so it can run on N sample works) and show it in a sandboxed `<iframe>` scaled to the page, debounced ~300 ms on option change; PDF uses the same HTML with print CSS, so the paper size / orientation / margins drive the page box. "Preview with" = the selection, or 3 sample works when nothing is selected. Pages panel = the iframe's pages (CSS `break-after`) as thumbnails. If the builder is server-only, a server action returning preview HTML for ≤ 6 works is fine (state the reason in the commit).

**Done when:** switching tab / any option updates the preview within ~0.5 s; the exported file matches the preview (check one PDF and one HTML by eye against it); no scroll at 1440×900 and 1280×800; themes still save/load; What's new item.

---

## 5. Order, commits, checks

1. `SignalMark` + B1 Overview → commit.
2. B2 Batch modify → commit.
3. B3 Export (live layouts + preview) → commit. Anything from D2 only after Pem's GO.

Per commit: `npm run i18n:check`, `npm run lint`, `npm run typecheck`; screenshots of the changed surface at 1440×900, 1280×800 (+ 375 for B1/B2) — memory: verify visuals in a real browser; admin views in Chrome on the live site after deploy. Update `docs/TODO.md` (B1–B3 lines), `docs/HANDOFF_2026-11-13_NEXT.md` part B, `SITE_MAP.md` if routes change (none expected), and this file's status line. Push only when Pem says.

## 6. Decisions for Pem (ask before building the part they block)

**Pem's answers 2026-11-14:** D1 keep (backlog ▲, archive > 14 d or never ■) · D2 **all tabs: the three live layouts + Labels + CSV/XLSX** · D3 **net < 0 → ■** (built 2026-11-14) · D4 keep ~0.7 s.
- **D1 — Local jobs signal.** Brief: any backlog = wrong. Mock proposes backlog > 0 = attention ▲, PC archive > 14 days = wrong ■.
- **D2 — Export types.** Keep the three live layouts as the tabs, or also add **Labels** (new: label-sheet presets, start position) and/or **CSV/XLSX** as a tab? Both are new work, not in the live dialog.
- **D3 — Money thresholds.** What counts as "cash low" and "negative trend" for the ■?
- **D4 — Liquid grid.** Per-panel opening is Pem's own spec (comments on the mock) — confirm the ~0.7 s delay and which panels count as "has more" once built.
