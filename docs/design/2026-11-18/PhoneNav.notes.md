# Phone navigation: design notes, 2026-11-18 (v1, answered)

**Pem chose option A (2026-11-18); all six questions answered — see « Pem's answers » at the end.**

Design only, nothing built, no SQL. Mockup: [PhoneNav.mockup.html](./PhoneNav.mockup.html), two options at 375 px. Pem 2026-11-18: « We need to make navigation more mobile straightforward among screens »; « Fil rows: unclear ». Inputs: [PhoneToday.notes.md](../2026-11-17/PhoneToday.notes.md) (R2), [R1_InputsFeed.notes.md](../2026-11-17/R1_InputsFeed.notes.md), [RETHINK](../../RETHINK_2026-11-14.md) R2 part, [SITE_MAP.md](../../../SITE_MAP.md).

Seen live 2026-11-18 at 375 px (localhost:3000, main at `d4e9db1`, a non-admin account, so the Fil and Audit were seen from code only). Code read: `components/hub/TodayClient.tsx` (header 118–131, Bureau 135–146), `components/shared/PhoneInputBar.tsx` (Écrire → `/atelier/journal?today=1&write=1`), `components/atelier/TeamPortalClient.tsx` (narrow header 1218–1302, drawer header 1387–1435, top block 1482–1490, `GROUPS` 1127–1145, counts in `TABS_RAW` 1034–1068), `components/hub/FilClient.tsx` (card 174–250), `app/atelier/page.tsx` (bare `/atelier` → Overview).

## The problem, in plain words

1. **The same day lives in two places with two looks.**
   - **Aujourd'hui** (`/hub`): light header, date, ‹ ›, counters, one « À revoir » card at a time.
   - **Journal day** (`/atelier/journal?today=1`): the Atelier header (☰ JOURNAL · 1176 ŒUVRES · HUB), « ← JOURS », « JOURNAL DE TERRAIN », a big serif date, all three « À revoir » cards stacked, then the entries.
   - You fall from one into the other without choosing: **Écrire** on Aujourd'hui opens the Journal day; « Ouvrir la journée complète » too; « Ouvrir la journée » on an « À revoir » card too.
2. **☰ on Aujourd'hui does not open a menu.** It loads the Atelier on **Overview** (the desktop board: Catalogue gaps, Money…), about 2 s, and you press ☰ a second time to see the menu. Every place outside the day is 3 taps away, with a desktop page in the middle.
3. **Home has four names.** « HUB » (boxed button in the Atelier header), « Studio / HUB » (top of the menu), « Aujourd'hui / Today » (menu), « ← Aujourd'hui » (Fil). Same place.
4. **Commandes is buried.** It sits in the 5th group of the menu (Commercial), below the fold of a 780 px screen: 3 taps and a scroll, though it now has a count.
5. **No way to find a work by its number on the phone.** The ⌘K search is desktop only; on the phone you open Inventaire and filter.
6. **The Fil is unclear** (Pem). Each card starts with a small grey line that mixes kind, author and date (« Commande en brouillon R-12 · Léa · 12 nov. »); it doesn't say in a sentence who did what where, nor what the two swipes do. The Fil line in the menu has no count and no hint of what it holds.

## Inventory: phone screens and how you reach them today

Taps counted from Aujourd'hui, admin, at 375 px. « Load » = a page in between.

| Screen | Route | Today from Aujourd'hui | Way back |
|---|---|---|---|
| Aujourd'hui (the day) | `/hub`, `?day=` | landing (PWA `start_url`) | HUB (Atelier) · Today (menu) · ← Aujourd'hui (Fil) |
| Journal day (same day, other look) | `/atelier/journal?today=1` | 1 (Écrire / Ouvrir la journée complète) | HUB |
| Journal: list of days | `/atelier/journal` | 1 (📅) | HUB, or ‹ › don't exist there |
| Fil (admin) | `/hub/fil` | 1 (pulse « n Fil ») | ← Aujourd'hui |
| Inventaire | `/atelier/inventory` | 3 (☰ → Overview loads → ☰ → Inventaire) | HUB |
| A work by number | `/atelier/inventory?work=` | 3 + filter, or tap a chip on the day | the card's ✕ |
| Production | `/atelier/production` | 3 | HUB |
| Idées | `/atelier/concepts` | 3 | HUB |
| Commandes | `/atelier/sales` | 3 + scroll | HUB |
| Logistique / Événements | `/atelier/logistics`, `/exhibitions` | 3 + scroll | HUB |
| Kaizen · Opérations | `/atelier/kaizen-ops` | 3 | HUB |
| Bureau rows (Pipeline, Vente, Triage, Contact, Document, Problème) | various | 2 (open the fold at the bottom of the day, tap) | HUB / back |
| Sheets: Vocal, Œuvre, Photo · doc | on the page | 1 (input bar) | ✕ |

## Two options

Both options share four fixes. They are the core of the answer; the options differ only in **where the places live**.

**Shared by A and B**
1. **One day screen.** Aujourd'hui (the light `/hub` route) is *the* day, today or any other. The phone Journal day page goes: on the phone, `/atelier/journal?day=` opens `/hub?day=`. Its content moves into the day screen in Aujourd'hui's look: « À revoir » as one deck (1 / 3), Œuvres du jour, Écrits et notes du jour, ✦ suggestions, folds (Attributs modifiés, Création, Photographiées ce jour), admin « Modifier la séance ». « Ouvrir la journée complète » goes: this *is* the full day.
2. **Écrire stays on the day.** It opens a writing sheet over the day (like Vocal), saved as an entry of that day; no jump into the Atelier.
3. **The phone Journal = the list of days** (📅 on the day header). Tapping a day opens it in the day screen. Desktop Journal unchanged.
4. **One name for home: « Aujourd'hui ».** « HUB », « Studio / HUB », « Today » go. The Bureau fold leaves the bottom of the day for the menu (it is navigation, not the day).

### Option A — « Le Jour, et un vrai menu » (recommended)

The input bar stays as Pem approved it (Écrire · Vocal · Œuvre · Photo · doc, 1 tap each). Navigation is **one menu sheet**, the same on every phone screen.

- **☰ opens the menu at once, over the page** (no Overview detour). The sheet is in the first HTML of every phone screen; counts stream in.
  - Top: a search field « #numéro ou titre » → the work card (the phone gets the ⌘K it lacks).
  - Then **9 tiles, 3 × 3**, each with its count (grey when 0): Aujourd'hui · Œuvres 1176 · Production 141 · Idées 22 · Fil 4 à trier · Commandes 2 · Logistique · Événements · Journal (jours).
  - Then « Tout le reste », folded: Kaizen, Studio, Catalogue, Commercial, Public (today's groups, minus the tiles).
  - Then « Actions », folded: Vente, Contact (carte), Document, Problème, Pipeline, Triage (the old Bureau).
  - Bottom: the account (name, language, sign out). The floating « DP » badge leaves the phone header (it costs 48 px of every header).
- **Every phone screen gets the same header row:** ☰ · title · its own tools · « Aujourd'hui » chip (right). The chip replaces the boxed HUB. On the day itself: ☰ · date · ‹ › · 📅.
- **Fil, clearer** (the « other screen » in the mockup): see « Fil cards » below.

| Place | Today | A |
|---|---|---|
| Aujourd'hui (from anywhere) | 1 (HUB) | **1** (chip) |
| Œuvres / a work by number | 3 (+ filter) | **2** (☰ → tile) / **2 + typing** (☰ → search) |
| Production | 3 | **2** |
| Idées | 3 | **2** |
| Fil | 1 (pulse) | **1** (pulse) / 2 (menu) |
| Commandes | 3 + scroll | **2** |
| Écrire, Vocal, Œuvre, Photo · doc | 1 (Écrire changes page) | **1**, all stay on the page |

What goes away: ☰ → Overview; HUB button; drawer header « Studio / HUB · Fermer » (the sheet has one ✕ and closes on a swipe down); phone Journal day page (← JOURS, eyebrow, serif date); « Ouvrir la journée complète »; Bureau fold on the day; « Today »; the phone header badge.
What moves: Bureau → menu « Actions »; account → menu bottom; Journal day content → the day screen; Commandes / Logistique / Événements counts → tiles.

### Option B — « Une barre de lieux »

A bottom **tab bar** replaces the input bar: **Aujourd'hui · Œuvres · ＋ · Idées · Plus**. The ＋ in the middle opens « Saisir », a sheet with the four inputs as big buttons (Écrire · Vocal · Œuvre · Photo · doc).

- « Plus » opens the same menu as A without the bar's places: search, 6 tiles (Production · Fil · Commandes · Logistique · Événements · Journal), then folded groups, Actions, account.
- Header: title + the screen's tools only; no ☰, no HUB chip.
- The active place is lit in the bar, so you always see where you are.

| Place | Today | B |
|---|---|---|
| Aujourd'hui | 1 (HUB) | **1** (bar) |
| Œuvres / a work by number | 3 (+ filter) | **1** (bar) / 2 + typing (Plus → search) |
| Production | 3 | **2** (Plus → tile) |
| Idées | 3 | **1** (bar) |
| Fil | 1 (pulse) | **1** (pulse) / 2 |
| Commandes | 3 + scroll | **2** |
| Écrire, Vocal, Œuvre, Photo · doc | 1 | **2** (＋ → choice) |

What goes away: everything A removes, **and** the input bar as a bar of four (it becomes the ＋ sheet), and ☰.
What moves: as A, plus the four inputs into « Saisir ».

### Recommendation: A

- Pem's first rule for the phone is **capture first** (« a thought caught in two seconds »). B makes every capture 2 taps; A keeps them at 1.
- The real faults are the ☰ → Overview detour, the two looks of one day, and four names for home. A fixes all three without adding a second bar; B's gain is 1 tap instead of 2 for three places.
- A keeps the bar Pem already approved and lives with; the change is the menu and the header, not his habits.
- If, after living with A, Pem finds he opens Œuvres many times a day, B's bar can come later: the menu tiles and the one-day screen are the same in both.

## Fil cards (both options)

- **First line = one sentence:** who, did what, where. « Anna a écrit dans les notes de #2233 », « Léa a préparé une commande (prêt) pour M. Dupont », « Marc propose une idée », « Anna a modifié la fiche de #1420 : prix, lieu », « Le tore · 3 nouvelles lignes ». Date at the end, grey.
- **Then** the work (thumb + #id + title) or the order (ref + party), then the text.
- **Two buttons under each card say what each swipe does**: « ← Retirer » · « Garder → » (Création, Kaizen); « ← Refuser » · « Valider → » (Fiches); for a draft order, « Ouvrir la commande ». The swipe keeps working; the buttons are the legend.
- **The menu tile says what it holds:** « Fil · 4 à trier ».

## Speed

- The menu sheet is plain HTML in each phone page; opening it loads nothing. Counts come from one cheap read after first paint (the Fil count is the costly one: `countFil` reads the whole Fil today, so the tile shows « Fil » without a number until a cheap count exists).
- Tiles that open Atelier screens (Œuvres, Production, Idées, Commandes…) still load the Atelier shell (~1.8 s measured 2026-11-17). Removing the Overview detour saves one full load and one tap on every trip; making those screens lighter is a separate step (not in this design).

## Questions for Pem

1. **A (a real menu, input bar unchanged) or B (a bar of places, inputs behind ＋)?** Suggested: **A**.
2. **Home is called « Aujourd'hui » everywhere** (chip, menu tile), and « Hub » / « Today » go? Suggested: **yes**.
3. **The 9 menu tiles: Aujourd'hui · Œuvres · Production · Idées · Fil · Commandes · Logistique · Événements · Journal**, the rest folded below? Suggested: **yes**; swap one if a place is never used on the phone.
4. **« Fil rows unclear »: the cards in the Fil, or the Fil line in the menu?** Suggested: **both** get a plain sentence (card: « Anna a écrit dans les notes de #2233 »; menu: « Fil · 4 à trier »), and each card shows what left / right do.
5. **Écrire writes on the day (a sheet), the phone Journal = list of days, a day opens in the day screen?** Suggested: **yes**; desktop Journal unchanged.
6. **A search « #numéro ou titre » at the top of the menu?** Suggested: **yes** (the phone has no way to jump to a work today).

## Pem's answers (2026-11-18)

1. **A** — the real menu; the input bar stays (Écrire · Vocal · Œuvre · Photo · doc, 1 tap). Option B is set aside.
2. **Yes** — home is « Aujourd'hui » everywhere; « Hub », « Studio / HUB », « Today » go.
3. **Yes** — the 9 tiles as listed; the rest folded below.
4. **« idk »** — so the suggested answer stands: **both** get the fix (Fil card = one sentence + « ← Retirer · Garder → » / « ← Refuser · Valider → » buttons; menu tile « Fil · n à trier »). To check with Pem once he sees it built.
5. **Yes** — Écrire is a sheet on the day; the phone Journal = the list of days, a day opens in the day screen; desktop Journal unchanged.
6. **Yes** — « #numéro ou titre » search at the top of the menu.

All six answered. **Design GO only, not a build GO**: building needs Pem's separate GO (the lead's call).

## For the build (after Pem's say)

- No SQL. A cheap Fil count (for the tile and the pulse) is a read, not a schema change.
- Touches: `TodayClient.tsx` (header, Bureau out, Écrire sheet), `PhoneInputBar.tsx` (Écrire on the page), a new shared phone menu sheet + phone header used by `/hub`, `/hub/fil` and the Atelier narrow shell (`TeamPortalClient.tsx` header + drawer), phone redirect of `/atelier/journal?day=` → `/hub?day=`, `FilClient.tsx` card sentence + legend buttons.
- Copy: new keys FR + EN (`hub.messages.ts` / `today.messages.ts`, `fil.messages.ts`).
- Docs in the same change: `CLAUDE.md` « Narrow Atelier sidebar » line, `SITE_MAP.md` (`/hub`, `/atelier/journal`), What's new.
- Smoke at 375 px: the day, menu, Fil, Inventaire + WorkDrawer, WorkForm (`/hub` entry rule); `npm run test:e2e:field`.
