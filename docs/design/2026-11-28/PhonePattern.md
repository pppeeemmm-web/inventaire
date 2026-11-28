# One phone pattern for every list tab (design for Pem)

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

## Scenario (steps Pem can check, on the phone)

1. Stock opens on the list: title, sections, search, three chips, « 235 articles · 1 sous le seuil », rows. Nothing
   overlaps; nothing is cut.
2. Tap « Pigment » → the list shows pigments; the chip shows « Pigment ✕ ».
3. « Filtres » → the sheet; tick « Kremer » → the button reads « Voir 3 articles » → tap → the list, chips updated.
4. Scroll: the search stays at the top.
5. Tap a row → its card slides up; « Fermer » → back at the same place in the list.
6. « … » → Export, Print, Count this shelf. « + » → new item.

## Inventory of tabs (read from the code, 2026-11-28)

(Filled below from the code survey.)

## Questions for Pem

1. Sections inside a tab as pills (as in the mockup), or a segmented bar of fixed width?
2. The three one-tap chips: the most used filters (learned from use), or fixed per tab?
3. Order after Stock: Contacts, then which tabs hurt most on the phone?
