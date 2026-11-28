# One phone pattern for every list tab (design for Pem)

Now (verified against `main` 2026-11-28): **Built, on `main` (PR #14):** steps 1–4 — shared pieces; Stock, Comptage, Coffre, Rapports, Fiscal « par année », Audit, Contacts, Kaizen, Production; a row opens its card over the list (Contacts, Stock). Système unchanged (its selects are form fields). The 375 px guard (`tests/phone-pattern.spec.ts`) not re-run since: its PENDING list should shrink. The status line below is the original.
Status: **design + mockup (`PhonePattern.mockup.html`, Stock), nothing built.** Pem « Go phone pattern design »,
2026-11-28, after the Stock screenshot (« as usual always the same UX problems ») and « you need the latest
techniques to make it agile and usable instinctively ». Pem's standing rule: « avoid clutter and offer collapsible
and interactive presentation ».

## Which kind of thing, which home, what changes

- **Kind:** the phone face of existing screens (principle 10: same doors, two designs). No data, no door, no table.
- **Home:** one shared set of components under `components/shared/phone/` (toolbar, chips, filter sheet, row,
  item sheet), used by every list tab; the Contacts phone work (2026-11-27) is folded into it.
- **What changes:** each list tab's phone layout moves onto the shared pieces; the Atelier header stops
  overlapping; a phone check guards it.

## The problems, once (seen on Stock, Contacts before it)

1. The header puts the tab title and the works count on one line → they overlap at 375 px.
2. The desk toolbar (search, two selects, a checkbox, an export button) is squeezed onto the phone: the search
   field is cut, the controls fill the first screen, the list starts below the fold.
3. In-page tabs run off the right edge with no sign there is more.
4. The list is the desk table, or rows too dense to tap.
5. Each screen solved its phone layout alone (`useMediaQuery` branches), so fixes drift and come back.

## Looked at first (principle 11, 2026-11-28)

- Apple HIG / WWDC26: one primary search entry; a field with clear and Cancel; partial-height sheets inset, opening
  from the control that summons them; a floating bottom bar.
- Web platform (2026 Baseline): container queries (a component lays out by its own width — one component serves
  phone and desk), native `<dialog>` and popover (sheets and menus with Escape / back / screen reader for free),
  view transitions (a row opens into its card), scroll-state queries (an edge fade only when a row scrolls).

## The pattern

| Part | Phone | Desk |
|---|---|---|
| Title row | ☰ · the tab name · « … » (secondary actions, a popover menu) · « + » (the main action) | Unchanged header |
| Sections inside a tab | Pills that scroll sideways, the edge fading while there is more (« Articles · Comptage · Réassort · Commandes ») | Tabs as today |
| Search | Alone, full width, sticks to the top while the list scrolls; ✕ clears | In the toolbar |
| Filters | A chip row under the search: « Filtres n » + each active filter as a chip with ✕; with none active, 2–3 frequent ones as one-tap chips | Selects as today |
| « Filtres » | A bottom sheet (`<dialog>`): every filter as chips / switches, « Tout effacer », and the button **« Voir 42 articles »** — the result count before closing | — |
| Counts | One quiet line above the list (« 235 articles · 1 sous le seuil »), never in the header | Unchanged |
| Rows | Name · one grey line · a value on the right (red when it needs attention); ≥ 60 px tall | Table |
| Opening a row | Its card slides up as a sheet over the list; the list keeps its place | Drawer as today |
| Quick input | The existing bottom bar (tap = do, hold = choose) | — |

Built on the shared components, laid out by container width (`@container`), so the same code shows the desk
version when there is room — the phone face cannot drift from the desk again.

## The header overlap

The Atelier header shows the tab title and the catalogue count side by side. On the phone: the title alone in the
header; the works count moves into the Œuvres tab's own count line (the pattern's « meta » line). Desk unchanged.

## The guard

A phone check at 375 px over every Atelier tab: no horizontal scroll, no text overlapping text, no input narrower
than 120 px, every tap target ≥ 44 px. It runs in the field e2e suite (logged-in profile) and on the preview; a
failure names the tab and the element. (Runs at the desk or on the preview — this cloud session has no login.)

## Order of work (each its own GO)

1. Shared components + Stock on them + the header fix + the guard (Stock is the screenshot).
2. Contacts moved onto the shared pieces (its phone layout exists; it becomes the same code).
3. The other list tabs, one batch per group, from the inventory below — the worst first.
4. Row → card as a sheet with a view transition, where the tab has a drawer.

## Keeping the code tidy (Pem 2026-11-28: « careful with the code, make sure it stays tidy »)

1. **Replace, never add beside.** A tab moved onto the shared pieces loses its own phone branch (its
   `useMediaQuery` layout, its hand-made toolbar) in the same commit. Each batch reports the lines removed and
   added; the count should go down.
2. **Few, small shared pieces**, one folder (`components/shared/phone/`), one job per file: toolbar (search +
   chips), filter sheet, list row, item sheet, actions menu. No per-tab copies, no options added « just in case ».
3. **The platform before code:** `<dialog>` for sheets, `popover` for menus, CSS container queries for the two
   layouts — less JavaScript to own than custom overlays and resize listeners. No new library.
4. **Data untouched:** the pieces receive what the tab already loads (principle 5 unchanged); no new reads, no new
   doors.
5. **Every batch passes:** typecheck, lint, i18n, chrome, the phone check, a code-review / simplify pass on the diff,
   and the flow review; I read every diff before it lands.

## As built — step 1 (2026-11-28), where it differs from the plan above

- **Sheets** use the app's existing overlay (`PemModalOverlay`: Escape, tap outside, the same look as every other
  sheet) through one shared `PhoneSheet`, not a new `<dialog>` layer — one sheet system, not two. The bottom bar's
  choice sheet now uses it too.
- **Phone vs desk** is the app's existing `useMediaQuery('(max-width: 767px)')` switch; container queries wait until
  a piece is shared between a phone column and a desk column.
- **Header:** on the phone the works count stays in the header on the Œuvres tab only (it was meaningless on the
  other tabs and caused the overlap); the title is one line everywhere.
- **Stock on the phone** has no −/+ steppers on rows (a row opens the editor; counting shelf by shelf is
  Comptage), no sorting (by name), no multi-select « export list » (« … » has the CSV export).
- **Guard:** each visible element is measured (the shell scrolls inside, so the page's own width proves nothing);
  short rows may scroll sideways, a frame marked `data-phone-scroll-x` too (tables of figures); pending tabs are
  expected to fail and turn the run red once they pass.

## Scenario (steps Pem can check, on the phone)

1. Stock opens on the list: title, sections, search, three chips, « 235 articles · 1 sous le seuil », rows. Nothing
   overlaps; nothing is cut.
2. Tap « Pigment » → the list shows pigments; the chip shows « Pigment ✕ ».
3. « Filtres » → the sheet; tick « Kremer » → the button reads « Voir 3 articles » → tap → the list, chips updated.
4. Scroll: the search stays at the top.
5. Tap a row → its card slides up; « Fermer » → back at the same place in the list.
6. « … » → Export, Print, Count this shelf. « + » → new item.

## Inventory of tabs (read from the code, 2026-11-28)

Read from the code only (no phone screenshots): the switch is `components/atelier/team-portal-segment-panel.tsx`;
the header title and count overlap at `components/atelier/TeamPortalClient.tsx` :1349–1373 (title :1361, count
badge :1366–1373); Stock's sections row is `components/atelier/supplies/SuppliesTab.tsx` :49–72.

**A. Desk table + desk toolbar, no real phone layout — the worst, in the pattern's order:**

| Tab | File | What the phone gets |
|---|---|---|
| Stock (Articles, Fournisseurs) | `components/atelier/SupplierHub.tsx` | tables :835, :1154; search :1006 + two selects :1022, :1042 (the screenshot) |
| Comptage (Stock) | `app/atelier/(portal)/stock-take/_components/StockTake.tsx` | table :254; toolbar :187–200 |
| Coffre (Vault) | `app/atelier/(portal)/vault/_components/Vault.tsx` | no phone flag at all; table :592; search :556 |
| Fiscal | `app/atelier/(portal)/fiscal/_components/Fiscal.tsx` | table :468; year / regime selects :335, :340 |
| Rapports | `app/atelier/(portal)/reports/_components/Reports.tsx` | report table :662; search :620; select :540 |
| Contacts | `components/atelier/ContactsTab.tsx` | phone list since 27/11 — moves onto the shared pieces |
| Audit (admin) | `app/atelier/(portal)/audit/_components/Audit.tsx` | no phone flag; table :242 |

**B. Have a phone layout already — check against the pattern, align where cheap:** Ventes (`Orders.tsx`, its own
phone list + filter chips — closest to the pattern), Inventaire (grid on the phone; a table remains at :2021),
Production (search :302), Kaizen (search :293), Système (four selects), Overview, Thèmes, Chronologie, Logistique,
Expositions, Pipeline, Idées, Journal, Aide, Bureau IA, Site.

**C. Visual screens, their own pattern (not lists):** Carte (`WorldMapTab.tsx`, no phone flag), Constellation (no
phone flag; toolbar selects in `ConstellationToolbar.tsx`), Diaporamas, Diffusion — checked on the phone one by
one; a map or a constellation is not a list.

Not checked: the rendered result at 375 px (no login here), and the children of each main file (only the main file
was read).

## Questions for Pem

1. Sections inside a tab as pills (as in the mockup), or a segmented bar of fixed width?
2. The three one-tap chips: the most used filters (learned from use), or fixed per tab?
3. Order after Stock: Comptage, Coffre, Fiscal, Rapports, Contacts, Audit (group A) — or another order from how often you use them on the phone?
