# The Journal — design (draft for Pem, 2026-11-22)

Status: **approved by Pem 2026-11-22** (chat: « Approve »), with his answers of §9 folded in. Local draft, not committed. MasterPlan step 3 closed; the build is step 5 (after step 4, the checks), starting with Step A on the throwaway copy. Step B SQL still needs its own OK. Mockup beside this file: [`Journal_Mockup.html`](./Journal_Mockup.html) (desk and phone, clickable).

Read before writing: root `CLAUDE.md`; [`BuildingPrinciples.md`](../2026-11-21/BuildingPrinciples.md); [`MasterPlan.md`](../2026-11-20/MasterPlan.md) §3.1 and §5; the « First: » item of `docs/TODO.md`; the six surveys of 2026-11-21. Live code read (2026-11-22): `app/atelier/(portal)/journal/entry-actions.ts`, `components/atelier/SessionJournalTab.tsx`, `components/atelier/journal/*`, `app/hub/today/page.tsx`, `components/hub/TodayClient.tsx`, `DayTools.tsx`, `lib/journal-corrections.ts`, `ARCHITECTURE.md` §6b. Live database read only (counts and columns below). Not done: nothing tried on Pem's phone; the screens not opened signed in.

---

## 0. In one paragraph

The Journal becomes **one stream of days**, newest day on top, each day a page read in the order things were noted. Every capture — a line, a voice note, a photo, a remark on a work, a work photographed or changed — is **one card**, drawn by one piece of code in two frames: the phone (today first, a record bar always at the thumb) and the desk (the same stream, wide, with a side rail that shows what the selected card is connected to). Days load as you scroll. Each day opens with a **divider line that is also its summary**; there is no separate list of days any more. A **time scale** shrinks the stream from days to months to years (pinch on the phone, a three-way switch on the desk). Each card shows **one main action** — the thing it needs now — and everything else is quiet or under « ⋯ ». Nothing is ever moved or rewritten: sorting means adding a **label** or a **link**, correcting means adding a correction beside the original.

## 1. Which kind of thing, which home, what changes (principles §2)

| Question | Answer |
|---|---|
| Kind | A moment of the day: a line, a voice note and its transcript, a photo, a remark on a work — and **an idea or a research note** (Pem 2026-11-22: the Journal is « one source, one entrance for ideas and research »). |
| Home | The day's page of the Journal (principles §2: « a capture is home the moment it is taken »). A remark on a work keeps its home on the work (`note_line`) and also shows on the day it was written — a read, not a copy: the day page reads the work's remarks of that date, nothing is moved or duplicated. **Ideas and research enter here too**: « ⋯ → En faire une idée » turns a card into an Idée (`concept`) that keeps the link to its moment; a new idea or research note made anywhere shows on the day it was made, and the labels Idée / Recherche gather them. Idées stays the place where an idea is worked on; the Journal is the one door in. |
| What changes | **Step A** (no data moved): one read that gives the stream by pages of days, and one that gives the day / month / year summary lines; one card component; two frames. **Step B** (SQL, its own OK): labels beside an entry; links that can also reach a person and another entry; a photo and a voice note become entries at once (one item per input); « place on another day » through the existing correction rule. |
| New table, store, door or screen? | One new small table for labels (§5, why no existing one fits). No new screen: the desk Journal tab and the phone « Aujourd'hui » are redrawn; the capture page for the desk hotkey is the one page that is new (a light route, no Atelier shell). No new door for writing an entry: `createJournalEntry` and `correctJournalEntry` stay the doors and gain options. |

## 2. What Delacroix's notebooks teach (Hannoosh, RIHA Journal 2010, read 2026-11-22)

The survey of 2026-11-21 could not read the article; it is read now (open access, the HTML version). The three open points of `Survey_DelacroixJournal.md` §3 are answered:

1. **What he wrote on.** From 1847 printed **agendas, one printed date per page** — he notes buying « cet agenda » on the day he resumed after twenty-three years. Around them: carnets for walks and travel (drawn from one end, written from the other, turned round), cahiers, loose sheets, press cuttings slipped between the pages, and the **flyleaves of each year's agenda: his address book for the year, accounts, colour recipes, canvas sizes**.
2. **How he reread.** He reread, recopied and commented earlier passages, proposed alternatives, sent one note to another (« voir 18 avril 1853 »). Above all he **wrote later remarks into the page of an earlier note** — a remark of 25 September 1855 sits inside the note of 23 March, the one it answers. The old editions moved it to its date and it lost its sense. His references point to the **date printed on the page**, not the day he wrote.
3. **How the dictionary points back.** In 1857 he drafted a Dictionnaire des beaux-arts in that year's agenda: each heading **refers back to a dated note** (« Romantisme, agenda [18]53, 18 mars »). Editors who misread the date sent readers to the wrong page.

Also from the article: earlier editors dropped what they judged minor — accounts, addresses, a copied line of Dante — and the dropped line turned out to explain a week of his life. He called the journal « brimborions, écrits à la volée ». Reading errors (f read as s: « Raffet » for « Rossini ») spread through every later edition until the manuscript was checked. His heir cut text leaves out of the carnets; a century later they were matched back, sometimes mid-sentence.

| Lesson | In the design |
|---|---|
| A page is a day, and a day has a printed date. | The stream is days; the day divider is the « printed date ». |
| A later remark belongs beside the note it answers, and keeps its own date. | **« Ajouter une suite »** (⋯ on any card): a new entry written today, linked to the earlier one. It shows **under the earlier card on its day** (indented, « suite · 22 nov. ») and on today's page as « suite de 23 mars ». Both dates kept; nothing moved. |
| References point to a dated note. | Entry ↔ entry links; the backlink panel shows « cité par » on the earlier card. |
| The year's flyleaf: who, what materials. | The time scale « Années »: each year line opens on its people, works and labels (a read). |
| Nothing is too small; an editor's filter destroys meaning. | No type picker at capture; no machine filtering; Kaizen « Création » items and work changes stay on the day. |
| A machine misreads (f / s). | The audio and the scan stay beside the text; « Vérifier · corriger » is the main action of every machine-read card until it is checked. |
| Never cut an item from its context. | Links are added, never moves; the archive export keeps each item with its day, its provenance and its links. |

## 3. iPhone capture limits — assumptions (MasterPlan step 2, `Survey_JournalCapture.md` §2)

Stated as assumptions; Pem checks the one real gesture on the first working prototype, two minutes, phone in hand.

1. **A Shortcut opens a URL.** Back Tap (two taps on the back) → a Shortcut → `/hub/capture?mode=voice` opens the recorder on today. The design relies on nothing more.
2. **A second home-screen icon may need its own sign-in.** So the « right now » icon is a Shortcut icon that opens the one installed app at the capture address, not a second web app.
3. **Recording stops when the page leaves the front.** The record sheet says so while recording (« garde l'écran ouvert »); a recording cut short is kept up to the cut.
4. **No lock-screen widget is relied on.**
5. **Offline: only work saves queue today** (`lib/mobile/offline-work-queue.ts`). A voice note or a photo taken with no network fails with « Pas de réseau » (`vc_err_offline`). **Pem 2026-11-22: the capture queue is part of this build** (it failed for him that morning). A voice note, a photo or a line taken with no network is kept on the phone, shown on today's page as « en attente d'envoi », and sent when the network returns, each with a one-time id so a resend never makes a double.
6. **The share sheet** reaches the hub only through a Shortcut (iOS has no web share target). The share Shortcut « Pem's workshop » is rebuilt to send to today's page; the old share-inbox route is retired after that, not before.

## 4. The scenario — steps Pem can check

**Phone (iPhone SE, 375 px wide).**

1. Tap the hub icon. Today's page is on screen first: the day divider « Aujourd'hui · sam. 22 nov. » pinned at the top, today's cards below, the record bar at the bottom (🎤 large in the middle, 📷 and ✍️ beside it, « œuvre » on the right).
2. Tap 🎤. The record sheet opens; the live words appear as you speak. Tap stop. A card lands at the bottom of today: « Note vocale · 10:42 », the audio, the live words, and one main button « Vérifier · corriger » (it is machine-read).
3. Tap the day chip « aujourd'hui ▾ » on the record sheet before stopping: pick « hier ». The card lands on yesterday's page and says « noté le 22 nov. ».
4. Scroll down. Yesterday's divider slides up and pins; then the day before. More days load as you reach the bottom; nothing jumps.
5. Pinch in (two fingers together). The stream shrinks to **Mois**: one line per day — date, a strip of the works' pictures, counts (✍ 3 · 🎤 1 · 📷 1 · ✦ 2). Pinch in again: **Années**: one line per month. Tap a month: back to its days. Pinch out: back to the cards.
6. On a card with a ✦ suggestion and nothing to check, the main button is « ✓ Relier à ‹ titre › » with the work's picture; « ✕ » beside it is small. Tap ✓: the work becomes a chip on the card; the button disappears.
7. Tap « ⋯ » on a card: Ajouter une suite · Placer sur un autre jour · Étiquettes · Relier à… · Copier le lien · (admin) Masquer · (voice note / photo, author or admin) Supprimer, in red, last, with a confirm.
8. Write a line with ✍️, type « Coquill » — the work « Coquillages » is offered with its picture. Pick it: it shows as a chip with the picture inside the text. The work's card (Inventaire) now lists this day under « Dans le Journal ».

**Desk (1280 px and wider).**

1. Open the Journal tab. The same stream, centred, wide cards; on the right a rail. No list of days on the left any more: the dividers in the stream are the list.
2. At the top: the time scale switch [Jours | Mois | Années], a date jump (« aller au… »), the search box, and the label filter (Process, Matériaux, Étincelle…).
3. Today's page opens with a composer « Écrire sur aujourd'hui… » (the shortcut is shown). Enter sends.
4. Click a card. The rail shows what it is connected to: its works (picture, title, the other days that mention them), its ideas, its people, the entries it continues or that cite it, and the ✦ suggestions to decide with their reason.
5. Over any application, the hotkey (AutoHotkey) opens the small capture window kept on top: a few words, the selected text and the page address already filled in, a 🎤 button. Enter sends; it lands on today's page with « depuis : ‹ adresse › ».
6. On a voice note's card, « Vérifier · corriger » opens the editor beside the audio, **with both readings: the words the phone heard live and the PC transcript** — on 22 Nov the phone heard « prisme » where the PC wrote « prigne », and « saturation » where the PC wrote « une situation »; Pem picks or retypes. « Confirmer » keeps the text, « Enregistrer la correction » adds the correction; the card shows the corrected text, « original » unfolds the first text. The same button is on the phone, so a windy recording is fixed on the spot, before the memory goes.
7. « ⋯ → Ajouter une suite » on a card of 23 March writes a suite today; it shows under the 23 March card and on today's page.
8. Switch to « Années »: one line per month of 2026; click « nov. » → its days.

**Speed (both).** The first page shows today and the days before it from one read, without the catalogue. Measured on the live site before and after (time to first card, phone and desk), as MasterPlan §5 step 5 asks.

## 5. Data map

**Live, 2026-11-22 (read only):**

| Store | Rows | Notes |
|---|---|---|
| `journal_entry` | 37 on 6 days | kinds atlas 18, voice 15, spark 4; provenance import 22, voice 15; 0 corrections yet |
| `voice_note` | 24 on 8 days | all have a live transcript; 15 carried by a transcript entry |
| `inspiration_photo` | 3 on 2 days | caption replaced in place, no history |
| `note_line` | 116 on 14 days | every one on a work (`oeuvre_id`), some on an idea |
| `journal_entry_link` (AI) | 91 proposed | 22 accepted, 66 rejected, 3 open |
| Field sessions | read by `loadJournalBootstrap` | the works photographed on a day |
| `oeuvre_versions` | admin only | the works changed on a day |
| `kaizen_item` section `creation` | read in place | old Création items, before Idées |

Small numbers: the stream can be one database read per page of days, ordered there, with no cost worth caching yet.

**Step A — reads only, nothing moved.**

- `journal_stream(before_day, days)` — one database function (security invoker, RLS applies): for the next N days that hold anything before `before_day`, every card of those days in order (`day`, `at`, `card_kind` = entry / voice / photo / remark / work_photographed / work_changed / creation, ids, text with the latest correction folded in, provenance, verification, the links and open ✦ of entries). Replaces the day-by-day `getJournalDayExtras` + `listJournalSourceDays` pair (up to 5,000 rows of three tables merged in the app, principle 5).
- `journal_scale(from, to, grain)` — counts per day, per month or per year, asked of the database (principle 7): the summary line of each divider and of the Mois / Années views.
- Called as plain reads from the phone route and the desk tab, never as Server Actions in the queue (principle 6).

**Step B — SQL, its own OK.**

| Change | Why | Why no existing home fits |
|---|---|---|
| A photo and a voice note write a `journal_entry` at once (`photo_id`, `voice_note_id` beside the text). | One item per input (principles §2b): labels, links, corrections, suites, placing then work the same for every capture. Today a voice note only becomes an entry when the PC transcript arrives. | — (no new table; one column on `journal_entry`) |
| `journal_entry_label` (entry, label, who, when, removed when). Labels: Process, Matériaux · façon, Étincelle, Déclencheur, Réflexion, Note — several per entry, changeable. | « Sort later by adding a label » (principles §2, open point). `kind` stays frozen as the origin (typed, voice, import, photo). | `kind` is frozen by the append-only guard and holds one value; `journal_entry_link` points at things, a label is a word. |
| `journal_entry_link` may also point to a **person** (`contact_id`) and to **another entry** (`target_entry_id`, relation `suite` / `cite`). Typing: **`#` + a title → a work or an idea; `@` + a name → a person** (Pem 2026-11-22: « all links »). | Delacroix's suites and references; « the people in it need a directory ». | Same table, two columns; the guard (one target, immutable) extended. |
| **The day of an entry can be changed by its author or an admin** — one action, « Placer sur un autre jour »; the database keeps the old day in a history line. | Pem 2026-11-22: a sketchbook must not be too stiff, and fixing a mistake must not take several steps. Changing the day in place means every reader simply follows the new day (simpler than a correction carrying the day, which every reader would have to fold). | The append-only guard on `event_on` is loosened for the author / admin, with a log; text, author and time written stay frozen. |
| (later, if it pays) old voice notes and photos without an entry get one. | One shape for the archive. | 24 + 3 rows; one script. |

## 6. Readers and Flow trace

Writers today: `createJournalEntry`, `correctJournalEntry`, `setJournalEntryHidden`, `setJournalEntryVerified`, `decideJournalLink` (`entry-actions.ts`); `scripts/transcribe/voice_batch.py` (PC transcript → entry); the atlas import; `addInspirationPhoto`, `setInspirationCaption`, `removeInspirationPhoto` (`capture/inspiration-actions.ts`); the voice note writers (`VoiceNoteSheet`, `team-voice-actions.ts`, `notes/actions.ts`, `share-triage/actions.ts`); `note_line` writers (`fil/note-lines-actions.ts`, `concepts/actions.ts`); the embed worker (`journal_propose_links`).

| Reader | Step A | Step B |
|---|---|---|
| Desk Journal tab (`SessionJournalTab`, `JournalDayExtras`) | **redrawn** on the stream | labels, suites, people, placed day |
| Phone Aujourd'hui / `/hub` (`app/hub/today/page.tsx`, `TodayClient`, `DayTools`) | **redrawn** on the stream (same cards) | same |
| Journal index counts (`listJournalSourceDays`) | **replaced** by `journal_scale` | placed day counted where the card sits |
| Work panel « Dans le Journal » (`listJournalEntriesForWork`, `works/actions.ts`) | unchanged; the card drawn in compact form | shows suites; human links removable from the work |
| Constellation side panel (`ConstellationJournalEntries`) | unchanged | same compact card |
| Idée page (`concepts/actions.ts`, `IdeaDiscussion`) | unchanged | « Dans le Journal » backlinks added |
| Contact page | — | « Dans le Journal » backlinks (new read) |
| ⌘K and ☰ search (`search/actions.ts`, `CommandPalette`) | unchanged | labels searchable; a hit opens the card in the stream |
| See-again (`see-again/actions.ts`), time / place (`time-place-actions.ts`) | unchanged | placed day respected |
| Notes tab triage (`notes/page.tsx`, `notes/actions.ts`) | unchanged | voice notes already carried by an entry: no double |
| Fil (`fil/actions.ts`, `note-lines-actions.ts`) | unchanged | — |
| Share triage / share-inbox (`share-triage`, `share-receive`, `share-inbox-actions`) | unchanged | retired once the share Shortcut lands on today |
| Embed worker, `journal_propose_links`, `journal_entry_search` view | unchanged | corrected text indexed instead of the original (TODO §1 « search by meaning still matches the uncorrected words ») |
| Archive export (`scripts/archive-export.mjs`) | unchanged | labels, suites, placed day written out |
| Overview badges, sidebar counts, What's new | unchanged | ✦ count from `journal_scale` |
| Stress script `scripts/stress/phone-journal.mjs` | rerun | rerun |

The usual failure (CLAUDE.md): the stream shows the placed day while search, see-again and the work panel still use the recorded day. Every row of « Step B » above is part of the build, not a follow-up.

## 7. Cards and buttons — the ranking rule

One card, five kinds (entry, voice note, photo, remark on a work, work photographed / changed), one component, two widths.

**Anatomy, top to bottom:** time · origin (« dicté · non vérifié », « importé », « photo », « depuis : site ») · the text (works as chips with their picture) · the media (audio, image) · labels and links as small chips · **the action row**.

**The action row — one main action, chosen by what the card needs now:**

| Card state (first that applies) | Main action (filled, accent) | Quiet beside it |
|---|---|---|
| Machine-read and not checked (dictated, imported, transcript) | « Vérifier · corriger » | ⋯ |
| An open ✦ suggestion (admin) | « ✓ Relier à ‹ titre › » with the picture | « ✕ » small; further ✦ under « +1 » |
| A voice note still waiting for its transcript | none (« transcription en attente » as text) | ⋯ |
| Nothing pending | none | « 🔗 » (Relier à…) and ⋯ |

**Under « ⋯ »:** Ajouter une suite · En faire une idée · Placer sur un autre jour · Étiquettes · Relier à… · Copier le lien · Masquer (admin) · Supprimer (voice note / photo, red, last, with a confirm). Today the card shows accept, reject, verify, hide, link and delete as six equal buttons; after: at most two visible, one of them filled.

**Day divider (sticky):** « Ven. 21 nov. » · works' pictures (up to 4, then +n) · ✍ 3 · 🎤 1 · 📷 1 · ✦ 2. Tapping it folds the day to that one line.

**Time scale:** Jours (cards) → Mois (one line per day, as the divider) → Années (one line per month: counts and the month's most-mentioned works). Phone: pinch; desk: the switch. Tap a line to zoom in on it.

**Order:** days newest first; inside a day, as noted (morning at the top). The order as written is never changed (Delacroix lesson 2).

## 8. Build order (after approval) and what stays

1. Step A on the throwaway copy: the two reads, the card, the phone frame behind a switch beside today's page; speed measured on the live site before.
2. The desk frame on the same reads; the old day list hidden behind the switch.
3. Step B SQL with Pem's OK, proven on the throwaway copy (one run for all of it, per Pem's rule), then live.
4. The capture page for the hotkey and the Shortcuts (runbook lines).
5. A few days of use, then the old screens hidden; speed measured after.

Kept as is: append-only, never deleted, admin-only hide, the AI proposal life (proposed / accepted / rejected), « Vérifier · corriger », the field sessions.

## 9. Pem's answers (2026-11-22, chat) — folded in above

1. Inside a day: **morning at the top**, as written — the stream can then be laid out as a proper book and read as usual.
2. Labels: the proposed set is fine. **Ideas and research enter through the Journal too** (one source, one entrance) → labels Idée and Recherche added; « En faire une idée » under « ⋯ » (§1, §7).
3. Links: **`#` = a work or an idea, `@` = a person** — all of them real links (§5).
4. Placing on another day: **not too stiff, one action** → the day of an entry is changeable by its author or an admin, the old day logged (§5).
5. A remark on a work: **shown on its day too** — read from the work, not copied.
6. Offline queue for voice notes and photos: **part of this build** (§3).
7. Mois view: left to the architect → **yes, up to 4 small pictures per day** (thumbnails of a few KB, loaded as the line scrolls into view; counts asked of the database). Measured with the rest; dropped to counts only if it slows the scroll.
8. Desk rail: see question A below.
9. Old desk day list: **hidden at once** when the stream ships.
10. Kaizen « Création » items: **kept on their days as cards**; ideas and research of every kind are gathered by the Idée / Recherche labels.

A. Desk rail: **always there when the window is wide** (as proposed).

### Pem's replies on the iPhone (2026-11-22, second round)

- **Back Tap (two taps) did not work** on the first try; Pem will try three taps. Steps to check on the phone: the Shortcut exists first (Raccourcis › + › « Ouvrir l'URL » › the hub address); then Réglages › Accessibilité › Toucher › Toucher le dos › Toucher deux fois (or trois) › that Shortcut. A thick case can stop it. Still the gesture to confirm on the first prototype.
- **The hub icon opens straight on the Journal**: the phone's home is today's page of the stream (it already opens on « Aujourd'hui », which becomes the Journal's today). No second icon needed.
- Recording when the page leaves the screen: unknown → tried on the first prototype.
- Lock-screen widget: not used (dropped from the design).
- Share sheet: not proven 100 % — two 2026 guides say iOS web apps cannot be a share target, and Pem's own Shortcut « goes nowhere ». The old share code is removed only after the new share Shortcut has worked on the phone.
- Microphone: allowed in Safari's settings by Pem.

### Found while answering (2026-11-22)

- **A voice note that stays « 1 en attente » forever**: 20 Nov, 16:34, 11 s of audio, no live words; the PC heard nothing (`voice_batch.py`: « empty transcript, no phone dictation either — nothing written »), so no entry is ever made and it waits forever. In the design: a voice note the PC could not read becomes a card « rien entendu » with the audio, and its main action is « Écrire ce qui a été dit » (Supprimer under « ⋯ »). The count of waiting notes counts only notes the PC has not tried yet.

### Fidelity to the mockup (Pem 2026-11-22)

« I like what I see, and I will be disappointed if I don't see what I was proposed. » The build follows `Journal_Mockup.html` as the spec: the same parts in the same places (sticky day divider with pictures and counts, one filled action per card, « ⋯ » menu items in that order, rail sections, Jours / Mois / Années, the record bar with 🎤 in the middle). Each build step ends with screenshots of the real screen at 1280 px and 375 px set beside the same view of the mockup; a difference is either fixed or named to Pem before landing.
