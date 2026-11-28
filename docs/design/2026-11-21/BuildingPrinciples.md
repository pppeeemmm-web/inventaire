# PEM Hub — how anything is built (draft for Pem, 2026-11-21)

Now (verified against `main` 2026-11-28): **Committed and in force** (summarised in root `CLAUDE.md` § Building principles). The status line below is the original.
Status: **local draft**, not committed. Written by the architect session after reading the schema, `ARCHITECTURE.md`, a scan of 918 code files, the stress-test report (2026-11-18), the speed measurements (2026-11-18), the Journal's data code, and the master plan of 2026-11-20. Not read: the live database, the screens in a browser, `/hub`, the public site, the PC scripts.

Purpose: one fixed picture to hold every request against, so a new feature lands as a tweak and not as a new door. Every session (Opus included) builds from this page. Nothing here throws existing work away: the database, the rules, the screens and the shell stay; the wiring is corrected where a screen is next touched, and every new screen follows the page from day one.

---

## 1. The commandments

Each one comes from something the tests or the code showed. « Check » says how it is held: a check that blocks a push, or review only. **None of the checks exists yet** — building them is code, with its own GO.

| # | Commandment | Why (seen) | Check |
|---|---|---|---|
| 1 | **The database holds the rule.** What must always be true is enforced there; the screen only explains a refusal. | A work sold twice, a payment recorded twice, stock doubled: the rule was checked in the app, then written. | Review + a race script on the throwaway copy for every new rule. |
| 2 | **One door per record, on the server.** It checks who is asking and writes all or nothing. | Contacts: the editor writes six tables from the browser; 12 browser files write tables. A team member could skip the review; any signed-in account could rewrite themes. | Lint: no table write in a browser file (today's 12 files listed as the debt, the list may only shrink). |
| 3 | **A door tells the truth.** Refused, or nothing changed, is never « ok ». | Eight deletes answer « ok » when nothing was deleted. | One shared helper for writes that returns what changed; review. |
| 4 | **Only doors are exposed.** Helpers cannot be called from outside. | Internal helpers are callable by id; 52 crash on a bad call. | Check: every exported function of a `'use server'` file starts with the shared guard. |
| 5 | **A screen asks for what it shows.** Lists come in pages, never whole. | Sales tab dies at about 200 orders; nearly 1 MB of catalogue travels; the Journal index reads up to 5,000 rows of three tables and merges them in the app. | Lint on unbounded id lists; review. |
| 6 | **Reading is not saving.** Reads do not queue behind saves; a save returns the one thing that changed. | Reads go through Server Actions, which run one at a time (12 in a row on a cold Overview); 69 saves ask for a refresh of the whole Atelier. | Lint: no new « refresh `/atelier` » (69 today, the count may only shrink). |
| 7 | **Counts are asked of the database,** never computed from a loaded list. | The catalogue was loaded to show numbers. | Review. |
| 8 | **One home per kind of thing.** A new table must show why no existing one fits (§2). Office facts answer: who × which works × when × kind × paper. | Four task stores, two place stores, six places an input can land. | A line in every build brief; review. |
| 9 | **One stream.** The Journal is the full stream of records, read as pages by day from one ordered feed. The phone writes into it; the desk reads and connects it. | A day is assembled from about eight stores at each opening and fetched again after every change; there is nothing to flick through. | Review. |
| 10 | **Same doors, two designs.** Every function is reachable from phone and desk through the same door; each device gets its own face, led by what it does best (§3). | Each function was built twice, and the two drifted apart. | Review. |
| 11 | **Look before building.** What already exists — in the device, in the field, in the system — is surveyed first (§4). | Features discovered late (hotkeys, existing patterns). | A line in every build brief. |
| 12 | **Scenario before build, proof before live.** The build is first told as steps Pem can check; anything visual gets a mockup; it is proven on the throwaway copy. | Discussions that never reached a shared understanding; the AI desk. | The brief carries the scenario; `ship.ps1` already asks for the Flow line. |
| 13 | **One way to link, everywhere.** Wherever text is typed, `#` links a work or an idea and `@` links a person, through one shared picker; picking writes a real link in that record's link table, never only text. A name that matches nothing offers « + Personne » / « + Œuvre » through their doors, never a silent new record. (Pem 2026-11-22/23, [`People.md`](../2026-11-22/People.md) §8.) | Links typed three ways (`#1234` in the Journal, pickers on the work card, free text in notes); a person named in a note was never linked to them. | Review; one picker component, its use listed per screen. |

---

## 2. The map of homes (draft — Pem corrects by voice)

When Pem asks for something, the machine answers first: « this is that kind, it lives there, here is what changes ». If it cannot, it says why a new home is needed before building. Tables named below exist (read in the schema); which screens write each has not been re-checked line by line.

| Kind of thing | Home | Notes |
|---|---|---|
| A moment of the day: a line, a voice note and its transcript, a photo, a scan | The day's page of the Journal (`journal_entry`, `voice_note`, `inspiration_photo`) | A capture is home the moment it is taken. Sorting later = adding a link or a kind, never moving it. |
| An idea, a conjecture | Idées (`concept`) | A moment can become an idea; the idea keeps the link to its moment. |
| A remark on a work | The work's notes (`note_line`) | Also shows on the day's page it was written. |
| A change to a work (size, technique, a new image) | The work (`Oeuvres`, `tblImage`) through `saveWork` | The day's page shows it from the version history. |
| A condition or restoration point (damage, state on a date) | `condition_report` (kind examination) | About what happened to the work. |
| How a work was made: materials, special making a restorer must know | A remark on the work (`note_line`) with the kind « materials / making », said by voice at the easel | Proposed 2026-11-21 (Pem unsure): museums keep « materials and technique » apart from « condition ». A condition report or a restorer's sheet reads it; it is not one. To check in the museum-standards survey (§4). |
| A link between two things | `tblrelations` (work ↔ work), `journal_entry_link` (moment ↔ work / idea) | Human links and AI proposals stay told apart. |
| Studio work to do on a work | `work_action` | |
| Any other task | `studio_task` | `suivi_reminder` folds into it later. |
| An improvement to the app, a bug | Kaizen (`kaizen_item`) | Upkeep. Never on the creative side. |
| A thought on the creative process itself (method, the inner life of the work) | The day's page, with its own kind « process » — and its own view that gathers them | Pem 2026-11-21: « not an idea like the others ». Not in Idées, not in Kaizen. No new table: a kind and a read. |
| A person, an organisation | `Contact` (+ addresses, emails, phones, links) | Needs its door (`saveContact`) before any People build. |
| A dated fact about a person with no life (call, visit, mail, thank you) | `moment` — **does not exist yet** | The master plan's one new office table. |
| A sale, loan, deposit, gift | `work_order` (+ lines, `payments`, `shipment`) | Keeps its guards. |
| An event, a call for entries | `suivi_process` (+ `event_work`, `event_contact`) | |
| A paper | The Vault (`document`) | Every paper points to its record. |
| A place | `contact_addresses` and `place` today | One store later (master plan §1.1 b). |
| A design reference (site, exhibition look) | **No home yet** | Its own place, never mixed with ideas (Pem). |

**Decided (Pem 2026-11-21): a capture goes onto the day's page; no separate inbox.** The master plan's `inbox_item` (« land first, then move to a home ») is dropped: land on the day's page, sort by adding a kind or a link. A bug report goes to Kaizen.

**Things change (Pem 2026-11-21).** What Pem asks tomorrow may contradict today. The map is built for that: a kind is a label and a view is a read, so a change of mind costs a label or a view, not a table or a rebuild. A request that cannot be met that way is the signal to stop and redraw the map with Pem before building.

**Open design point found while writing this (from `ARCHITECTURE.md` §6b, not re-read in SQL):** a journal entry's `kind` can never change after it is written (append-only guard), and its links point only to a work or an idea. So « sort later by adding a kind » is not possible as the table stands. To design before the capture build, with its own OK because it is SQL: either the kind becomes changeable by its author, or kinds become labels beside the entry (which also lets one moment carry two).

### 2b. How an input is stored (read in the schema, 2026-11-21)

**Today — split by medium, four stores, each with its own links:**

| Store | Holds | Its own links |
|---|---|---|
| `journal_entry` | a text; `kind` mixes the medium (voice, handwriting) and the nature (spark, trigger, reflection, note, atlas) | via `journal_entry_link` → a work or an idea |
| `voice_note` | the audio file + transcript, its own `kind` | columns → work, idea, condition report, process, sketchbook |
| `inspiration_photo` | an image + caption, a day | columns → work, idea |
| `note_line` | a remark (+ optional image) | columns → work or idea |

**Target shape (Pem's own picture, 2026-11-21 — the sound one):** one row per input = when, who, the text (typed or transcribed), the medium, a pointer to its file if any. Beside it: **labels** for its nature (process, spark, materials… several allowed, changeable) and **links** to what it is about (a work, an idea, a person, a condition report). Everything is then recollected by filtering one stream: the day's page (date), a work's page (link), the process view (label), search (the text index).

**Path without a rebuild:** first one feed that reads the four stores as one stream (a read, no data moved) — the Journal proof of §5; new captures write one store; the old stores are folded in only if and when it pays. To design with the Journal, SQL with its own OK.

**Corrections (Pem 2026-11-21: a wrong transcript must be correctable).** The database already has the mechanism — a correction is a new entry that points to the one it corrects (`corrects_id`), the original kept underneath — but no screen uses it (no code reads or writes `corrects_id`). Rule: the author or Pem corrects; the page shows the corrected text; the original stays reachable. Hiding exists (admin). A true « trim » button for Pem alone: possible, not built, not asked for now.

---

## 3. Phone and desk

- **The phone is a full terminal, not a trimmed version.** Anything can be done from it when needed (a dimension, a transaction, a restoration note). Its design is led by what a thing in the hand does best: taking in — picture, voice, writing, remark.
- **The desk** is led by room, a mouse, search: reading the pages, seeing at a glance, connecting, reviewing suggestions.
- **Two icons on the phone:** one opens the whole app; one opens « right now » — recorder, camera or a line, already on today's page.
- **iPhone SE 2020 (Pem's phone) — to verify on the device, from general knowledge:**
  - No Action Button. « Back Tap » (double or triple tap on the back) can run a Shortcut that opens the capture page: the nearest thing to a key combination.
  - A second home-screen icon is possible. On iOS each installed web-app icon may keep its own sign-in; if so, the second icon is a Shortcut that opens the capture page inside the one installed app.
  - A lock-screen widget (iOS 16 and later) can launch the same Shortcut.
  - iOS does not offer the web « share target » that Android has; the share sheet reaches the hub through a Shortcut. How the hub's existing share path behaves on this phone is not checked.
  - Recording continues only while the page is in front; a note taken with no signal needs a queue on the phone that sends later.

---

## 4. Look before building — surveys to run before each domain is designed

Run 2026-11-21 — one page each beside this file (`Survey_MuseumStandards`, `Survey_JournalCapture`, `Survey_LegacyArchive`, `Survey_ContactsCare`, `Survey_LinksDigests`, plus `Survey_DelacroixJournal`); contacts and links were run early and are re-read when their design starts. Each is web research plus a read of the hub's own code, and gives one page: what the best systems do, what the hub already has, what is missing, what is not worth copying.

| Domain | What to look at |
|---|---|
| Records of works, custody, loans, condition | The museum standards: CIDOC-CRM (records built on events — who, which object, when, where: Pem's « Moment »), Spectrum (procedures for loans, location, condition, valuation); studio and gallery software (catalogue raisonné tools). |
| The sketchbook | « Daily notes with backlinks » (one page per day; each work or idea page shows every day that mentioned it); timelines; how such tools flick and search. |
| Capture | iOS Shortcuts, Back Tap, widgets, share sheet, offline queue; Windows hotkey tools (PowerToys, AutoHotkey). |
| People and care | What small studios and galleries use for relations; what is view and what is data there. |
| Map of links, digests | Graph tools, local AI digests, link suggestion and its acceptance. |
| Legacy | Archive formats that outlive software; how estates and foundations hand over a catalogue. |

---

## 5. What comes first (no build list — the order of proof)

The full marching order is in [`MasterPlan.md` §5](../2026-11-20/MasterPlan.md) (revised 2026-11-21); it wins over the list below where they differ.

1. The museum-standards survey (§4, first row): Pem 2026-11-21 — the proven systems are the base to build on. The hub's records, custody and orders are set against them; gaps and differences on one page.
2. One proof of commandments 5, 6 and 9 on the screen Pem uses most: the Journal reads one ordered feed, by pages; loading time measured before and after on the live site.
3. The checks of §1 (lint rules with today's debt listed), so the page cannot drift.
4. `saveContact` — the door for people — before any People build.
5. Then the master plan's builds, each with its survey, its scenario and its proof.
