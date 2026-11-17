# Phone « Aujourd'hui » (R2): mockup notes, 2026-11-17 (v1)

Design only, nothing built. Mockup: [PhoneToday.phone.html](./PhoneToday.phone.html), six phones at 375 px. Inputs: Pem's priorities and annotated mockups in [RETHINK](../../RETHINK_2026-11-14.md) (« Mobile terminal (R2) », 2026-11-14 eve), TODO R2. Live code read 2026-11-17: `app/hub/page.tsx` + `components/hub/HubLauncherClient.tsx` (launcher, Field pulse), `components/atelier/SessionJournalTab.tsx` (day page 580–665, « ← Jours » 1216), `components/atelier/journal/JournalDayExtras.tsx` (quick row 241–285, « À revoir » 287, entries, folds 532–625), `components/atelier/SeeAgainCard.tsx`, `components/atelier/TeamPortalClient.tsx` (`MobileActionBar` 244+), `app/manifest.ts` (`start_url: '/hub'`).

## What the screen is for

The phone opens on **today's page**, in Pem's order:
1. **Capture inputs**: a voice note, a writing, a picture for inspiration.
2. **Scan documents**, handwritten or typed. The photo is taken now; the PC reads the text later.
3. **Today's work**: the works of the day, what to write about (« À revoir »), and which works could be linked.

Sales, pipeline and the other desktop work leave the first screen and go to the menu.

## The six phones

1. **Aujourd'hui, top (landing).**
   - One header row: ☰ · date · ‹ › · 📅.
   - A pulse line: 4 counters in one 32 px row (was a 4-tile block, « too big »).
   - **À revoir aujourd'hui**: one card at a time.
   - **Œuvres du jour.**
   - The input bar is sticky at the bottom.
2. **Aujourd'hui, scrolled.**
   - **Écrits et notes du jour**: writings and voice notes in one timeline (Pem: « what about writings »).
   - The ✦ suggestion rows carry a thumbnail + title.
   - Two folds, closed: **Attributs d'œuvres modifiés** (was « Fiches modifiées ce jour ») and **Création (Kaizen)**.
3. **Vocal sheet.** One spoken input: Dictate folds into it (Pem: « Dictate goes into Vocal »).
   - Tap = record. Live words show while recording when the phone can, and are kept as a first draft. The audio is always kept and transcribed on the PC as today.
   - The kind / project choice stays as it is today (default Mémo · Général). Changing it is R1's question, not R2's.
4. **Photo · doc sheet.** The new separate input button (Pem: « add photo / doc capture with scan capability »). Four choices:
   - **Inspiration**: a photo added to today's entries.
   - **Document**: a scan, several pages, text read later on the PC (`/atelier/capture?mode=doc`, today's « Scan doc » launcher row).
   - **Carte de visite**: today's `?mode=card`.
   - **Étiquette QR**: the bar's « Scanner QR » today.
5. **Œuvre sheet.** « Capture » is renamed **Œuvre** (Pem). Its first step is the choice:
   - **Nouvelle œuvre**: the R3 recording drawer.
   - **Reprise d'une œuvre**: R3 too.
   - **Photos de la séance**: today's session capture, Lightroom → Share.

   Because the sheet starts with the choice, « Nouvelle / Ancienne » can't be skipped any more (closes the R2 question). Mockup [WorkCard.phone.html](../2026-11-16/WorkCard.phone.html) phones 1–2: not redrawn here.
6. **Menu (☰).**
   - **Aujourd'hui** first, then the Field group in today's order (Inventaire, Production, Journal = the list of days, Notes).
   - Then **Kaizen**.
   - Then **Bureau**, folded by default (collapse-by-default rule). It holds the old launcher rows (Pipeline, Vente, Triage, Contact, Document, Problème) and the desktop groups (Studio, Catalogue, Commercial, Public).

## Rules shown

- **One input bar, sticky, everywhere on the phone:** Écrire · Vocal · Œuvre · Photo · doc.
  - 4 × 25 % wide, 56 px tall, safe-area padding.
  - Hidden while a work card is open, like today's bar.
  - It **replaces** today's `MobileActionBar` (Capture session · Scanner QR · Note · Rappels): Scanner QR moves into Photo · doc; Rappels moves to the pulse line.
  - One bar = one place for inputs: the phone side of R1.
- **Tighter page** (Pem: « generally tighten up the space »).
  - The day header is one line; the big serif date drops to 22 px.
  - The day summary (« 2 entrées · 1 œuvre · 3 notes ») is a small line under it.
  - « ← Jours » leaves the top: ‹ › step through days, 📅 opens the list of days (Pem: « move ← Days below »; it moved into the header icons instead, which takes no height).
- **Pulse line:** `10 en retard · 1 aujourd'hui · 0 à valider · 0 boîte`.
  - Zeros are grey; the whole line opens the field inbox.
  - Overdue in rust when > 0.
  - The « next card » block of the Hub goes away. The inbox already lists those cards.
- **À revoir rotates, nothing is final** (Pem: « Ne plus montrer » too harsh, « keep the ball rolling »).
  - **Plus tard** replaces « Ne plus montrer »: the work comes back in a few days.
  - If Pem doesn't answer, it simply comes back another day.
  - « Sans rapport » stays for the two-works slot. It is an answer, not a hide.
  - One slot is shown at a time; « 1 / 3 » with a swipe or › shows the next.
- **Thumbnails everywhere a work number shows** (`#1316` → thumb + title), as R4 asks for elsewhere.
- **Empty sections stay one grey line** (« Aucune œuvre aujourd'hui — Œuvre ↓ »), never a big empty box.
- Phone contract: 375 px drawn, no horizontal scroll, taps ≥ 44 px, sticky bar with `max(…, env(safe-area-inset-bottom))`.

## Speed first (Pem 2026-11-17: « emphasize page loading speed on the mobile »)

The phone screen is used standing up, often on 4G. **The input bar must work before anything else has loaded**: a thought caught in two seconds is worth more than a full page in six.

### What the phone loads today

Read from code 2026-11-17, **not measured yet**:

`/atelier/journal?today=1` goes through the whole Atelier shell:

1. **Server**: `app/atelier/(portal)/layout.tsx` is `force-dynamic` and awaits `loadAtelierShellProps` before sending anything:
   - auth;
   - reminders (up to 100);
   - `is_admin`;
   - the `Oeuvres` count;
   - `fetchAtelierOverviewBootstrap`: 9 queries for the desktop Overview (expenses, sales, pipeline, concepts, approvals…), run even for the journal;
   - the pending-changes count.

   The journal already skips the 50-work catalogue chunk (`ATELIER_TABS_WITHOUT_CATALOGUE_CHUNK`).
2. **Browser**: `TeamPortalClient` (1,943 lines plus every tab it imports) is `ssr: false`, so the phone shows only « Chargement Atelier » until that JS is downloaded and run.
3. **Then** the journal tab fetches the day, and `JournalDayExtras` fetches again (entries, folds, « À revoir »).
4. **Then** the thumbnails.

That is four steps in a row before the page is usable. The bar's buttons don't exist until step 3.

### Design rules for speed

1. **Aujourd'hui is its own light route**, not a tab inside the Atelier shell.
   - It is a server-rendered page whose HTML already holds the header, the pulse line, the bar and the first sections.
   - The Atelier shell loads only when the menu opens another tab.
   - No Overview bootstrap, no reminders list, no catalogue count on this route.
2. **The bar is in the first HTML and works at once.** Each sheet (Vocal, Photo · doc, Œuvre) is its own small chunk, preloaded after first paint, so a tap never waits on the network.
   - A note taken offline goes to the existing offline queue.
   - This is safe for the work card; it would only be a problem for long voice notes (TODO 1c).
3. **One request for the day.** The header, pulse, « À revoir » card, works of the day and the first entries come from one server query, not three fetches in a row.
   - Folds (« Attributs modifiés », « Création ») load **only when opened**.
   - Entries past the first screenful load on scroll.
4. **Images: thumbnails only, lazy.**
   - `thumbUrl()` 44 px everywhere on this page; never the 2100 / 4000 px picture.
   - `loading="lazy"` below the fold, fixed width / height so nothing jumps.
5. **Stale-while-revalidate for today.** The service worker (Serwist, already in place) keeps the last copy of Aujourd'hui: the phone shows it instantly, with a small « mis à jour il y a 5 min » line, then swaps in the fresh one.
6. **Every phone route gets a budget, and the build checks it.** On a mid-range phone with throttled 4G:

   | Measure | Target |
   |---|---|
   | Bar usable | < 1.5 s |
   | LCP (Largest Contentful Paint: when the main content shows) | < 2 s |
   | JS for the first screen | < 150 kB gzipped |
   | CLS (Cumulative Layout Shift: how much the page jumps while loading) | 0 |

   A number that comes out worse than today blocks the ship.

### Baseline: measured 2026-11-17 on production, as admin

**How it was measured.** Pem's Chrome on the PC, signed in as admin. Chrome wouldn't shrink its window, so each page loaded in a 390 px same-origin frame (phone layout: viewport 386 px).

**Warm load.** The service worker served every JS file from cache: 0 bytes of JS downloaded. The PC's CPU and home network were used, with **no 4G or phone-CPU throttling** (not possible from the extension). A real phone on 4G will be slower than these numbers. They are a floor, not the phone's real time.

| `/atelier/journal?today=1` | Run 1 | Run 2 | Run 3 | Run 4 |
|---|---|---|---|---|
| Server first byte | 0.89 s | 1.27 s | 1.09 s | — |
| « Chargement Atelier » splash gone; header + quick row shown | 1.74 s | 1.75 s | 1.83 s | 1.88 s |
| Day still empty (« Nothing yet ») at that moment | yes | yes | yes | yes |
| « À revoir » card shown | 4.88 s | 3.50 s | 3.55 s | 3.83 s |
| LCP (main content shown) | 4.89 s | 3.49 s | 3.55 s | — |
| Last server call done | 5.93 s | 4.44 s | 4.65 s | 7.21 s |
| JS (uncompressed, 23 files) | 1.84 MB | 1.84 MB | 1.84 MB | 1.84 MB |

**Run 4, server calls traced.** Next.js runs a page's server actions **one at a time**, so they wait on each other:

| Order | Server call | Start → end |
|---|---|---|
| 1 | `getSeeAgain` | 1.37 → 2.78 s |
| 2 | `getJournalDayExtras` (the day's entries) | 2.78 → 3.69 s |
| 3 | `loadJournalBootstrap` | 3.69 → 5.28 s |
| 4 | `loadAtelierShellOpen` (the shell's post-paint load) | 5.35 → 7.23 s |

The slow « À revoir » query runs first and holds back the day's own entries.

| `/hub` (today's launcher) | Run 1 | Run 2 | Run 3 |
|---|---|---|---|
| Server first byte | 1.67 s | 1.69 s | 0.95 s |
| Launcher shown | 1.73 s | 1.87 s | 1.09 s |
| JS (uncompressed) | 1.03 MB | 1.03 MB | 1.03 MB |

**Not measured.**
- A real phone, 4G throttling, a cold cache.
- Compressed JS size: Vercel sends no content-length, so it can't be read from the frame.

**What it says for the build:**
1. The Atelier shell costs about 1.8 s before anything shows.
2. The day's real content arrives at 3.5–4.9 s, behind a queue of server calls.
3. Two of those calls (`loadJournalBootstrap`, `loadAtelierShellOpen`) aren't needed for « Aujourd'hui » at all.
4. One server query for the day (rule 3) and no shell (rule 1) attack exactly these.

### How we prove it

- **Baseline:** done 2026-11-17, warm and unthrottled (above). Still to do once: the same pages on Pem's real phone over 4G, for the true floor-to-ceiling gap.
- **After each build step:** the same measure, the same phone profile, next to the baseline. « Faster » is said only with both numbers.
- Other phone screens (Inventaire, Production, Notes, the work card) also go through the Atelier shell. The same light-route idea could apply to them later, but **not in R2** without Pem's GO: measure first.

## Field map: today → new place

| Today | New place |
|---|---|
| `/hub` launcher (`start_url`) | `/hub` on the phone shows **Aujourd'hui** (= Journal at today); desktop still redirects to Overview |
| Hub title « PEM Hub » + « Entrer dans l'Atelier » | Gone from the first screen; the menu is the way into the Atelier |
| Field pulse block (4 tiles + next card + « Ouvrir ») | Pulse line, one row (phone 1) |
| Launcher rows: Journal · Scan doc · Pipeline · Vente · Triage · Contact · Document · Problème | Journal = the screen itself; Scan doc → Photo · doc; Contact → Photo · doc › Carte de visite; the rest → Menu › Bureau |
| « Plus » (Field / Studio / Commercial / Kaizen tiles) | Menu |
| Journal day: eyebrow + 32 px date + summary + « ← Jours » | One header row + summary line |
| Quick row: Écrire · Dicter · Note vocale · Capture (not sticky) | Sticky bar: Écrire · Vocal · Œuvre · Photo · doc |
| `MobileActionBar` (Capture session · Scanner QR · Note · Rappels) | Same sticky bar; QR → Photo · doc; Rappels → pulse line |
| « À revoir aujourd'hui » (3 slots stacked, « Ne plus montrer ») | One card at a time, « Plus tard » |
| « Œuvres du jour » + « 📷 Capturer des photos ce jour » | « Œuvres du jour »; adding = the Œuvre button |
| « Entrées du jour » + fold « Notes vocales du jour » | One list « Écrits et notes du jour » |
| ✦ AI suggestion rows (`#1316` text only) | Thumb + `#1316` + title, ✓ / ✕ |
| Fold « Fiches modifiées ce jour » | Fold « Attributs d'œuvres modifiés » |
| Fold « Création (Kaizen) » | Unchanged, folded |
| Admin « Modifier la séance » (date / notes / delete) | Unchanged, under the day's summary line |
| `/atelier/works/new` two columns at 375 px (old 4b) | On the phone it opens the R3 recording drawer instead |

## Pem's answers (2026-11-17)

1. **Bar** — on **every** phone screen (replaces today's Capture / QR / Note / Rappels bar). Hidden only while a work card is open.
2. **Live words** — **yes**, kept while recording when the phone can; audio always kept, PC transcript as today.
3. **Inspiration photo** — joins the day, and **can also join a work or a concept** (optional pick in the sheet). Needs a home → SQL GO at build.
4. **Bureau** — Pem asked what it is: the folded bottom group of the phone menu, holding what the phone rarely needs (Pipeline, Vente, Triage, Contacts, Documents, Studio, Catalogue, Commercial, Public). Pem: **all folded**. (Name « Plus » kept as an option if « Bureau » reads unclear in use.)
5. **Plus tard** — Pem: no preference → default **7 days**, one constant, easy to change after use.

**All five questions answered 2026-11-17.** Speed added as a first rule the same day (section above). Baseline measured 2026-11-17 (Speed › Baseline). Waiting on Pem's GO to build.

## For the build (after Pem's say)

- No SQL for the screen itself. A « Plus tard » with a return date needs a column on the see-again dismissal (SQL GO).
- An inspiration photo needs a home: a journal entry with an image, linkable to a work and / or a concept (answer 3). Likely SQL.
- Copy: new keys in `journal-entry.messages.ts` / `hub.messages.ts`, FR + EN.
- What's new item when it ships.
- Smoke: WorkForm, WorkDrawer and Inventory at 375 px (`/hub` entry rule in `CLAUDE.md`).
