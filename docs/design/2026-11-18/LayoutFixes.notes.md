# Layout fixes — Inventory title, Production cards, phone bottom chrome (2026-11-18)

TODO §3 « Needs a layout design » (Pem GO). Finding from `StressTest.notes.md` (look issues, shots 04 + 06):
Inventory title column (panel open) and Production cards cut titles to 2–3 letters at 1280; phone selection bar
and the « Écrit enregistré » toast over the bottom bar. Side session, **local draft** (uncommitted, worktree).

Measured on the dev server (port 3100, live data, read only: navigation, a client-side selection, a fake toast
node) with Playwright at 1024 / 1280 / 1440 × 800 and 375 / 360 × 812. Shots: `layout/` (numbers below).

## What was cut and why

| Screen | Measured before | Cause |
|---|---|---|
| Inventory, panel open | list pane 701 px at 1280 (503 at 1024, 805 at 1440); **Titre 22 px, Médium 22 px**; table 720 px → 19–217 px sideways scroll inside the pane | Below 1100 px the list goes « tight »: `tableLayout: fixed`, `minWidth: 720`, every column fixed (tick 30, ID 44, picture 44, dims/year 70, period 74, price 68, contact/location 124, state 116, broadcast 104 = 674) and only Titre + Médium auto → they share 720 − 674 = 46 px. Shot 01. |
| Production board | card 132 px at 1024 / 1280, **title 36 px** (58 at 1440) | 7 columns `flex: 1, minWidth: 120` — 5 of them empty — share the board equally; inside a card the title sits between a 40 px picture and the ✓ ✎ column. Shot 05. |
| Phone selection | dock 303 px tall, floating mid-screen, **bottom 792 under the bar's top 743**; 11 controls under 44 px | `CurationDock` is the desktop floating bar (`bottom: 20`, wraps) on every width. Shot 08. |
| Phone toast | toast host `bottom: 24px` → 740–788, **over the bar** (743–812) | `.pem-toastHost` knows nothing of the bottom bar. Shot 08. |

## Proposal (built)

**Inventory — the title keeps a minimum, other columns drop in a set order.** Narrow list only (pane < 1100 px;
the wide list is unchanged). Always shown: tick, ID, picture, **Titre (≥ 160 px)**, dimensions / year, state.
The rest drops, lowest value first, until what is left fits the pane:

1. Diffusion (104) — also on the card in the panel
2. Période / lieu (74)
3. Médium (100, fixed when shown) — joins the title's hover text when dropped
4. Prix (68)
5. Contact / Emplacement (124)

Result: 1440 + panel → drops 1–2, Titre 207, Médium 100 (shot 04) · 1280 + panel → drops 1–3, Titre 203 (shot 02) ·
1024 + panel → drops 1–5, Titre 197 (shot 03). No sideways scroll left in the pane at these sizes. Nothing dropped
silently: the Titre header shows **« +n »**, its hover names the hidden columns (« Colonnes masquées faute de place :
Diffusion, Période, Médium. Fermez le panneau ou élargissez la fenêtre pour les revoir. »). Division lines and the
sticky header are kept. Rule in code: `INV_DROP_ORDER` / `invHiddenColumns` (`Inventory.tsx`) — to change the
order, change that array.

**Production — empty columns fold, cards put the title on its own line.** Desktop board: a column with no work
folds to a **44 px strip** (« + » on top as a 44 × 44 tap, count, its name written upwards; still a drop target;
« + » unfolds it while the search is open). If every column is empty none fold. Columns with works share the rest
(`flex: 1 1 0`, min 140 px). In a column wider than two cards the cards sit **side by side** (grid, 176 px min) instead
of stretching. Card: row 1 = picture · « #id · year » + technique · ✓ ✎; row 2 = **title over the full card width**,
2 lines then the full title on hover. 1280: card 190, title 174 px (shot 06); 1024: 257 / 241 (shot 07); 1440: 230 / 214.
Phone keeps its scrolling columns (72vw); the card change applies there too (title 210 px, shot 11).
Busy studio (all 7 columns full) at 1024: 7 × 140 > the board → the board scrolls sideways inside itself, as on the phone.

**Phone — one measured height for the bottom chrome; everything else sits above it.**
- `useBottomChromeHeight(ref, var)` (`components/shared/BottomStack.tsx`) writes an element's real height (safe-area
  padding included, ResizeObserver) on `<html>`: `--pem-phone-bar-h` (the input bar, `PhoneInputBar`, 69 px on a
  phone without a home bar) and `--pem-selection-bar-h` (the phone selection bar). `globals.css`: both 0px by
  default, `--pem-bottom-chrome-h` = their sum.
- **Toasts**: `bottom: calc(24px + var(--pem-bottom-chrome-h))`; phone: full width (12 px gutters), 8 px above the
  chrome. Shot 09: toast 634–682 above the selection bar 690–743 above the input bar 743–812.
- **Selection bar on the phone**: a slim full-width bar docked on top of the input bar
  (`bottom: var(--pem-phone-bar-h)`): « Sélection n » · ✕ (44 × 44) · « Actions ▴ ». « Actions » opens a tray above it —
  the 7 actions in 2 columns, the group name + « + », « Cartographier → » — every tap 44 px (shot 10, 360 px).
  Desktop dock unchanged (shot 12).
- The Atelier page's bottom padding uses `calc(12px + var(--pem-bottom-chrome-h))`, so the last rows scroll clear of
  both bars. Any new sticky bar or toast on the phone: use the variable, never a hard-coded 68 px.

## Not done / open

- `/hub` and `/hub/fil` keep their own bottom padding (`max(80px, 76px + safe area)`, already clear of the bar).
- The desktop selection dock still floats over the list (unchanged design); the phone bar still follows the
  selection onto every page (now one slim row, not a 303 px panel).
- Real iPhone (home bar safe area, share sheet) not checked: measured in Chromium mobile emulation only.

## Shots (`layout/`)

01 Inventory 1280 before · 02 / 03 / 04 Inventory 1280 / 1024 / 1440 after · 05 Production 1280 before · 06 / 07
Production 1280 / 1024 after · 08 phone 375 selection + toast before · 09 after · 10 phone 360 selection tray open ·
11 phone 375 Production + toast · 12 desktop dock 1280 after.
