# PEM Hub — master plan (design, 2026-11-20)

Design only: no code, no SQL, no commit. Written from a full read of `STRATEGY.md` (with the new « Intentions » / « What I don't want »), `ScopeInterview.notes.md`, `SystemMap.draft.md`, `TODO.md`, the design notes listed in the brief (CatalogueGaps, ContactsReview, Collector_ShareKit, Products_Engine, Supplies_Orders, AiDesk, R6, R7, R8), `WORK_CUSTODY_MODEL`, `CONSTELLATION`, `COMMERCIAL_GUIDELINES`, `ARCHITECTURE`, `WHERE_WE_STOPPED`, the speed measurements of 2026-11-18, and the live database (read only, 2026-11-20). Questions for Pem are in the chat, numbered.

---

## 0. The scenario in one page (read this first)

**What the airport really is.** Three halls, not five pillars:

| Hall | What it holds | Who lives there | Speed it needs |
|---|---|---|---|
| **The studio** (Works) | every work, its pictures, its state, where it is | Pem + team, every day | instant |
| **The notebook** (Ideas) | journal, concepts, themes, links between works — the map | Pem, alone mostly | flowing, no friction |
| **The office** (People and their Moments) | who, which works, when, what paper | the team, for Pem | correct, rarely fast |

Gates bring things in (phone, desk, calendar, mail, payments); papers and pages take things out (site, kits, PDFs, receipts book). The two creative halls never mix with the office: themes ≠ groups, ideas ≠ design references.

**What the puppeteer must hear, before any figure moves:**

1. **The office has no real case yet, by Pem's choice.** Live today: 9 orders (7 are reconstituted gifts), 0 payments, 0 kits sent, 0 people on events. Testing happens on the throwaway Docker copy, as Pem set it up. Consequence for the design, not a reproach: the office tools are proven by **a full mock year on the Docker copy**, and the first real case will show what the mock missed — so the office is built in slices that fit the whole design, each tested before the next. (Corrected 2026-11-20 after Pem's reply: an earlier wording called the empty data the cause of « built, then redesigned »; Pem's own diagnosis — quick design from a short request, untested — stands.)
2. **The map is mostly a mirror.** `tblrelations` holds 3,772 links, but 3,720 are copies of themes, owners, places and groups. **52 links were made by a human** (23 influence, 20 proximity, 9 series). Constellation « taking shape » depends on those, not on more code.
3. **The app is too big for one person without Claude.** ~30 Atelier tabs, ~90 tables, ~30 triggers on works, 424 commits since 1 November, 27 files writing `Oeuvres`. After 2026-12-17 the risk is not a missing feature; it is a broken one nobody can fix. **The most valuable thing before the freeze is subtraction and a runbook, not a build.**
4. **Speed is an architecture fact, not a tuning task.** Measured 2026-11-18: Next.js runs a page's Server Actions **one at a time**; Atelier reads go through actions, so a cold Inventory is ~15 actions in a queue and the whole catalogue (~1 MB) travels on tab changes. Each tab fix helps; the cure is « reads are not actions » and « the catalogue lives on the device » (§5).

Everything below follows from these four facts.

---

## 1. My vision against the drafts

### 1.1 The Moment spine — keep the idea, change the shape

The SystemMap's insight is right: the same fact (« this person met these works on this date, for this reason ») is stored ten ways, and CRM features should be **views**, not tabs. Three changes:

**a. Two tiers, not one table.** Some records have a **life** (steps, rules, papers, money): an order, an event, a shipment. They keep their tables — they already carry the DB guards that took a week to get right (`work_order_line_one_open`, `payments_within_price`, `oeuvre_holder_check`, the step cascade). Folding them into a generic Moment would throw that away. The rest are **touches**: one dated fact with no life — a call, a studio visit, a mail in or out, a kit sent, an introduction, a press mention, a « thank you », a birthday card. Today touches have **no home at all**. So:
- **Lifecycles** stay: `work_order` (+ lines, payments, shipment), `suivi_process` (events, calls, Pipeline), `private_link` (kits).
- **One new table for touches**, later (after the pause, first office build): `moment` — people (with role), works, date + precision, kind, channel / gate, a short summary, a paper (`document`), private flag, source id (so a gate never writes twice), created by. Kinds are a fixed, short list, each added only when a real case needs it.
- **The timeline is a read**: touches ∪ order steps ∪ event membership ∪ kits ∪ enquiries ∪ validated journal links, per person or per work. One SQL function, written when there is something to read — not now (a union over nine empty tables proves nothing).

**b. Places — one shared resource (revised after Pem's reply).** Today a place lives in two tables: custody addresses under people (`contact_addresses`, 34 rows) and creation places (`place`). Pem's Access instinct — a place has its own id and other tables point to it — is the better long-term shape: a storage loft, a venue with several people, a landscape painted, all become one row that people, works, events and the risk watch (H2) can all point to. Not a pillar with its own screens: a resource, like an address book of places. **Not now:** after the pause, one `place` table with an optional owner (a contact), the two current stores moved into it in one migration (Flow trace: custody triggers, papers, map, orders). Until then nothing changes.

**c. The Moment contract is a rule, not a table.** Any new office table must answer *who (with role) × which works × when × kind × which paper*, or it is not built. That one line, put in `CLAUDE.md` / the brief template, does more against « one table per feature » than any migration.

### 1.2 What I would throw out or shrink

| In the drafts | My view |
|---|---|
| Moment view now, « no migration needed to start » | **Not now.** Nothing to view. Write the function with the first touches. |
| Care rules engine | **No engine.** Two rules, written as plain queries, when there are touches: « enquiry unanswered 3 days », « birthday in 7 days ». A third only when one is felt missing twice. |
| Approval folder « the director signs page by page » | **Not a new screen.** The Fil already holds Pem's to-check items (draft orders by others, pending work changes). The folder = the Fil filtered to « à signer ». |
| Spheres (contacts) + tags + work groups + themes | **Spheres = contact tags** with a short starter list (thinker, press, gallery, curator, artist, collector) and free additions. One mechanism, not two. |
| Care tasks (a 5th task store) | **No fifth store.** There are already four: `work_action`, `studio_task`, `suivi_reminder`, `kaizen_item`. Care tasks go into `studio_task` (it has kind, due date, priority, status, work) + a contact link. Later: fold `suivi_reminder` into it. |
| Works ↔ people matching on embeddings (« forefront ») | **Right idea, wrong year.** It needs people with works-touches; there are none. Park until ~20 people have touches. The cheap forefront is elsewhere (§1.3). |
| Kit display switches (catalogue step 6) | **Park.** The kit exists and has been used 0 times; Pem chose public works only. Switches come after the second real kit. |
| Products engine / licences | **Park** (Pem already: « how would I know? »). Design kept. |
| Interactive background | Parked idea, agreed. |

### 1.3 Where the real forefront is — cheap, and on data that exists

1. **Link harvest for the map.** 1,320 nodes are already embedded; the journal → work proposal (`journal_propose_links`, measured on Pem's 17 accepted / 18 rejected) is a working pattern. The same for **work ↔ work**: the PC agent proposes, say, five « these two belong together » per evening; Pem accepts or rejects in Constellation's side panel, one tap each. This is what turns 52 human links into 500 and makes « the map take shape » without Pem drawing every edge. Small SQL function + one queue kind on the existing `ai_job`. After the pause (the AI desk must work first).
2. **Digests by a local AI** — a digest per cluster / theme / concept, written by Ollama on the PC, as an `ai_job` kind « digest » with « before → suggested » acceptance like the cards. No new infrastructure. After link harvest (digests of an empty map are noise).
3. **One record behind every output** — already mostly true for works (site, PDF, kits, papers read `Oeuvres`). The gap is the CV / exhibition history / press list: generate them from events and publications instead of typing them twice. That is real value for Transmission, and small.
4. **The readable archive** (`npm run archive`) as the legacy backbone: it already exports the catalogue without the app. The introduction package (FR + EN) should point to it. This is the most durable thing the hub can produce.

### 1.4 What I agree with, fully

Themes = creation / groups = business · design references in their own place · no outside access, outsiders get files · drafts, a person sends · gates in the order calendar → mail → Instagram / WhatsApp → payments · receipts book as the legal paper · one on-top window for idea / bug · hide what doesn't work in the AI desk · freeze + runbook.

---

## 2. Target structure (after the pause — the scenario, not a build list)

### 2.1 Data

| Hall | Tables (exist unless marked) | Rule |
|---|---|---|
| Works | `Oeuvres` + images, versions, themes junction, condition reports, `work_action` | Unchanged spine. Catalogue gaps steps 1–2 add columns, not tables. |
| People | `Contact` + addresses / emails / phones / links; **`contact_tag`** (new: spheres and tags as one) | Display layer first (ContactsReview phase 1 — no SQL). |
| Moments — lifecycles | `work_order` (+ lines, payments, shipment), `suivi_process` (+ steps, `event_work`, `event_contact`), `private_link` | Keep; they hold the guards. |
| Moments — touches | **`moment`** (new, one table) | Every gate writes here for known people; unknown senders go to the inbox. |
| Ideas | `journal_entry` (+ links), `concept`, `theme`, `tblrelations` (human types), `constellation_map` | Never mixed with the office. |
| Inbox | **`inbox_item`** (new) — replaces `share_inbox` | **The one landing zone for every input** (§3.1). Sorting moves an item to its home. |
| Tasks | `studio_task` (+ contact link), `work_action` (production) | Two, not four. |
| Papers | `document` (Vault) with the naming policy (R7) | Every paper points to its record. |
| Money | `payments`, `expense`, `invoice` | Receipts book = a read on payments (§2.4). |

### 2.2 Gates (each is one writer with one contract)

Contract for every gate: an external id (never writes twice) · a source tag · **never creates a contact by itself** (proposes in the inbox) · a known contact → a touch on that person · private / unknown → inbox only, summary + link, never the full message body · a log line in `system_log`.

| Gate | Exists | First version |
|---|---|---|
| Phone `/hub` | yes | unchanged; share target → inbox |
| Desk on-top window | no | §3, before the freeze |
| Site enquiry / kit enquiry | yes (`inquiry`) | an enquiry becomes a touch when answered |
| Calendar | OAuth + `calendar_event_link` (0 rows) | export works; read-in of events with known people → touches |
| Studio mailbox | no | read only, known contacts only, summary + link; **after GDPR notice + security review** |
| Instagram / WhatsApp | no | manual « forward to inbox » first (share sheet), no API |
| Payments (SumUp) | manual « Encaisser » | import of the provider's statement, matched to orders |

### 2.3 Roles

Admin (Pem) · team · nobody else. « Agents » (Pem 2026-11-20) = the stakeholders of the business side, not AI agents and not a role: they receive files, kits and papers, never an account. No guest accounts, ever, until Pem says so. Basic hygiene: two-step sign-in for admin accounts, a « leaver » checklist (untick team, rotate the R2 key if a laptop leaves).

### 2.4 Outputs, each a read

| Output | Reads |
|---|---|
| Public site, per-work page | `Oeuvres` (public columns), events « on site », public text |
| Kit, portfolio PDF, tear sheet, inventory list | `Oeuvres`, `private_link` |
| Order papers, COA | `work_order` |
| CV, exhibition history, press list | events + publications (generated) |
| Provenance line | order steps (sale, gift) per work |
| **Receipts book** (livre des recettes) | definitive payments by date, one line each: date, payer, work, amount, means, ref — export CSV / PDF per year |
| Thresholds watch | receipts per year vs micro-BNC and VAT ceilings — one line on Revenus & dépenses |
| Timeline (person / work) | §1.1 function |

---

## 3. The two « Now » builds, as I would shape them

### 3.1 One input system: one hotkey, one inbox, every gate (revised after Pem's reply)

**The principle: one landing zone for everything, then homes.** Today an input can land in six places depending on where you typed it: `share_inbox` (phone share sheet), `kaizen_item` (system upkeep), `studio_task`, `voice_note`, `journal_entry`, `concept` (ideas). That is the multiplication Pem wants stopped. Target:
- **Every input lands first in one table, `inbox_item`** — idea, bug, photo, voice note, task, link, screenshot; from the desk hotkey, the phone, the share sheet, and later the gates (an unknown mail sender, a calendar invite with an unknown person).
- **Sorting moves it to its home**, once, by a person (later an AI proposal): a journal entry, an idea (`concept`), a task, a work note, a bug report, a touch on a contact. The inbox row keeps a pointer to where it went, so nothing is lost and nothing shows twice.
- The homes are not new landing zones; they are where things live after sorting. `share_inbox` is retired into `inbox_item`. Kaizen stays what it is (system upkeep), fed from the inbox when an item is sorted as a bug or an upkeep task.
- Earlier wording here proposed reusing `kaizen_item` as the inbox: dropped. Kaizen means « system upkeep »; creative ideas landing there would mix the two halls.

**Inbox row (sketch, SQL later with its own OK):** id · created at / by · source (desk, phone, share, mail…) · kind as guessed (idea / bug / unknown — the hotkey's switch) · text · attachments (screenshot, photo, audio → R2 keys) · link / window title · works mentioned (`#1234`) · status (new / sorted / dropped) · sorted to (table + id) · source id (a gate never writes twice).

**The desk side — AutoHotkey (Pem's choice):** one hotkey works over any application (a browser on another site, a PDF, Lightroom):
- it grabs what is at hand: the selected text, the active window's title and the browser address when there is one, and a screenshot (region or window);
- it opens a small capture window prefilled with all that, kept on top, with a few words, a voice-note button and the idea / bug switch; Enter sends.
- The capture window is a tiny page that **never loads the Atelier shell or the catalogue**; AutoHotkey hands it the grabbed data. On the phone: a `/hub` capture tile + the share sheet, writing the same table.
- **Bug items → reports for Claude:** a « Copier pour Claude » button that builds one markdown block (words, screenshot links, URL, time, build sha). This is also the after-the-pause support path (§6).
- Consequences / scope / pluses / minuses: + one path for every input, + friction reported while it happens, + the gates later reuse the same table; − one new table and the phone share path moved onto it; − AutoHotkey runs on the PC only (the phone uses the tile); − an inbox needs a sorting habit, or it fills up — the Fil shows its count. Readers to check (Flow): `/hub` share target, Kaizen, Fil, Overview badges, sidebar counts, Journal (sorted entries), Idées, What's new. Cost without Claude: one AutoHotkey script on the PC, documented in the runbook.

### 3.2 Speed — measure on production, one fix, then the real design

- **Before the freeze:** time the live site as admin (TODO §6 already lists it: Inventory baseline 22–27 s, work cards 5.5–10 s). Then **one** fix with the biggest gain from the measured list (likely: reads that don't need to be actions moved out of the action queue on the tabs Pem opens most).
- **After the pause (design now, build later):** « the catalogue lives on the device » — the 1,182 works kept in the browser's storage, refreshed by « what changed since » (`edited_at`), so a tab change never refetches 1 MB. This is the design under the Journal sketchbook too: the sketchbook flows when its works are already on the device.
- **The Journal sketchbook ships before the freeze** (Pem 2026-11-20: « the thing I use the most »). To keep it from becoming the next « built, then redesigned »: whole-screen mockup first (this week, Pem's OK), the new Journal loads its own day data and never the catalogue (this is its speed fix), built behind a switch with today's Journal kept until the new one has been used for a few days, then the old one hidden. Journal entries are append-only in the database — the redesign touches the screen, not that rule.

---

## 4. Every open design against this plan

Verdicts: **keep** · **reshape** · **merge** · **park** · **drop**. Where my verdict differs from SystemMap §6, it is in bold.

| TODO item | Verdict | Why |
|---|---|---|
| §3 Contacts as relationships | **reshape → « People »**, design before freeze, build after | Display layer + tags (= spheres) + who-knows-whom as a touch « introduction » + timeline read. ContactsReview phases 1–2 (no SQL) are the first build. |
| §3 Reverse pricing | keep, **after the pause** | A pure calculator; needs Pem's inputs (cost items, charges rate). Under micro-BNC the « charges » are the artist-author social contributions, not income tax — say so in the design. |
| §3 Phone outbox | merge with §3.1 | One capture path; the outbox's one-time id per item is the gate contract. |
| §3 R8 public site | keep, after the pause | Per-work page first (independent of look decisions B–C partly). Look decisions A–D wait on Pem. |
| §3 Editions | **park; design settled** | Three drafts disagreed (`copy_no` text, `edition_run`, `edition_copy` rows). **Pem 2026-11-20: one row per numbered copy, every number tracked.** A copy sold through a bookshop or a publisher: holder = that seller, buyer left blank unless known. So `edition_copy` rows within runs; `copy_no` text dropped. Built at the first real edition. |
| §3 AI desk, web addresses | park | Hide what doesn't work. |
| §4 Step 1 condition + chips | keep | Read only, small; can fit before the freeze if time remains. |
| §4 Step 2 work fields | keep, after the pause | One SQL file; no business overlap. |
| §4 Step 3 papers | keep | Reads works / orders; tear sheet + inventory list first. |
| §4 Step 4 events and calls | keep (columns on `suivi_process`) | Already a lifecycle; R6 tables live. |
| §4 Step 5 contact fields | merge into People | |
| §4 Step 6 kits, CV, video, press | **split**: CV + press = generated reads (keep); kit switches = **park**; video links = keep (work fields) | |
| §4 Step 7 insights | keep, after data exists | Already partly in Reports / Map. |
| §4 Step 8 « Volée » | keep, at the first case | Fate SQL, high effort. |
| Public site small items, panorama, S6 | keep, low priority | |
| Speed 17–19 | keep — now | §3.2 |
| Storage / Vault naming | keep | Housekeeping; helps the runbook. |
| Trace (handwriting, voice > 4 MB, R1 score) | keep as is | Waits on Pem's tests. |
| §5 « Journal entries as Constellation nodes » | **promote to Later** | The map overview Pem wants needs journal ↔ work links visible; the nodes exist (32 `journal_entry` nodes). |
| §5 Progress dashboard | **drop** as a build | `WHERE_WE_STOPPED.md` does the job as a page. |

---

## 5. The order

Today 2026-11-20 → freeze 2026-12-10 → wind-down 2026-12-17. Three weeks of build at most; the last one is tests.

### Before 2026-12-10 — builds (each with its card: aim, consequences, readers, test)

1. **Batch A** (in progress in the main session).
2. **One input system:** `inbox_item` + AutoHotkey capture + phone tile (§3.1).
3. **Journal sketchbook** — mockup this week, then build behind a switch, its own data loading (§3.2). Pem: must ship.
4. **Usage count per tab** (Pem: yes) — one quiet counter per tab open, read once a month.
5. **AI desk: hide the broken parts.**
6. **Receipts book export** (small; §10) and **manual « posted » record** for Instagram (small; §11).
7. **Speed: measure live as admin, one fix** beyond the Journal (§3.2).
8. If time remains: catalogue step 1 (read only).

This is tight for three weeks. If something must slip, it is 7 and 8, never the tests.

### Before 2026-12-10 — design only (no build)

- This plan agreed (or corrected).
- People (contacts as relationships) on one page, reshaped as above.
- Places as one shared resource (§1.1 b), sketched for after the pause.
- Gate contract (§2.2) and the `moment` table sketched, not applied.

### 2026-12-10 → 2026-12-17 — tests, fixes, runbook

- **Full-scale test on the Docker copy**, one mock year: every order kind end to end (sale with deposit, deposit → sale by a gallery, loan out / back, gift, return within 14 days, refund), a kit, papers, payments → Revenus & dépenses → receipts book export, contact merge, the stress round (`scripts/stress/README.md`). Failures listed, fixed only if small.
- **Restore drill** (O4, 20 min with Pem) and **R2 key rotation** (O2) — both on Pem's list since before this plan; the runbook is worth little without them.
- **Runbook « without Claude »** (§6).
- **Subtraction list**: tabs and buttons to hide in January, from the usage count and Pem's « infuriates me » list.

### After the pause (when building resumes — Pem learning, or a short subscription)

1. Receipts book + thresholds line (small, legal value, reads existing payments).
2. People: display layer → tags → the `moment` table → timeline → two care rules → care tasks in `studio_task`.
3. Calendar gate (read-in of events with known people).
4. Catalogue steps 2–3 (work fields, papers), CV / press generated.
5. R8: per-work page, then look decisions.
6. Link harvest → digests → (3D later).
7. GDPR notice for contacts + mail; then the mailbox gate.
8. Editions / products / licences at the first real case. Matching when ~20 people have touches.

**What I would tell Pem plainly:** commercial follow-up « as a learning exercise » on this codebase is a hard place to learn — 90 tables, ~30 triggers on works, order guards in SQL. If Pem wants to learn by building, the receipts book (one read, one export) is a good first exercise; People + touches is a good second. The order engine should not be the place to learn.

---

## 6. The runbook « without Claude » (outline — written in the last week)

1. **What runs where, and what it costs per month:** Vercel (site + app), Supabase (DB, auth), Cloudflare R2 (images, Vault), domain, Google OAuth (calendar), the PC (Ollama, Whisper, embed worker, AI agent). Each with its account owner and renewal date.
2. **Daily / weekly / monthly:** what to check (backups ran, the PC agent heartbeat on Bureau IA, the retention cron, storage size).
3. **When something breaks:** symptom → first check → who to call. The « Copier pour Claude » report from §3.1 is the hand-off format for any future helper, human or AI.
4. **Deploy and roll back:** a push to `main` deploys; how to roll back on Vercel by clicking the previous deployment (no git needed).
5. **Backups and restore:** the drill done in December, written step by step.
6. **People:** add / remove a team member; the leaver checklist.
7. **What not to touch:** triggers on works, order guards, RLS — with the reason in one line each.
8. **Restart the PC jobs** after a Windows update.

---

## 7. Risks and gaps (beyond SystemMap §10–11)

| Risk | Why it matters | Proposal |
|---|---|---|
| **Maintenance after the pause** | 27 writers of `Oeuvres`, 18 browser components writing tables directly (ARCHITECTURE « Found later »); a Supabase / Next.js upgrade or an expired key can break a screen with nobody to read the code. | Runbook §6; pin versions; no dependency upgrades after 12-10; Vercel instant rollback documented. |
| **The PC is a single point of failure** | Search index, transcription, descriptions, card reading all run on one laptop. | Runbook: what stops if the PC dies, what still works (everything except AI jobs); where the agent's config lives. |
| **Features built, never used** | 0 kits, 0 payments, 0 events with people — and each has had design + build + review. | Usage count (§5); « first real case drives the slice »; the card template asks « what real case uses this in the next month? » |
| **Surface too large** | ~30 tabs; Pem's anger at the AI desk will come back for the next obscure tab. | January subtraction from usage data; hide, don't delete. |
| **Status words drift in a long pause** | Uncommitted worktrees and parked branches (`wt-themes-push`) rot. | Before 12-17: every worktree landed or removed; `release-truth.ps1` output pasted into `WHERE_WE_STOPPED.md`. |
| **Droit de suite / rights** | Resale right only reaches Pem through a collecting society; reproduction fees are income. Pem is not an ADAGP member today (2026-11-20). | Resale and licence = touches / payments with a kind; joining a society is Pem's decision, noted for after the pause. |
| **Micro-BNC charges** | Social contributions (artist-author, URSSAF) are owed on receipts too; reverse pricing must use them. | Receipts book feeds both declarations; rates from the accountant. |
| **GDPR before any gate** | Read-in mail and who-knows-whom are personal data about third parties. | Reuse the site's policy; retention per kind of touch; « forget me » = delete the person's touches + anonymise orders kept for tax. |
| **Legacy** | The archive must outlive the app. | Introduction package FR + EN for **whoever takes charge** (family or someone else — Pem 2026-11-20), pointing to the readable archive export; private details stay with Pem (not in the repo). |
| **Constellation stays empty** | The map is Pem's own labour; 1,176 works is a lot of linking. | Link harvest (§1.3) after the pause; until then, 10 minutes of linking per session is the cheapest « build ». |

---

## 8. Pushback on the drafts (short)

1. **SystemMap §3 « no migration needed to start »** — true but empty: the view would show nothing. Start with the contract (§1.1 c), not the view.
2. **SystemMap §6 « reshape — first » for contacts** — agreed on the reshape, not on « first » before the freeze: it is design-only until the pause.
3. **ScopeInterview « Speed + Journal sketchbook »** as one Now item — speed yes; the sketchbook is a mockup, not a December build.
4. **« Care runs without Pem »** — the intention is right; before there are touches it is a rule with nothing to read. The first care tool is simpler: the inbox + the Fil seen by the whole team.
5. **« The system must be ready before the first case »** — ready = **proven on the throwaway copy with a mock year**, not « more features ». That is already in the freeze plan; it should be the definition of ready.
6. **Brief template** — Pem's « consequences, scope, pluses, minuses » becomes a fixed card on every build brief, with one new line the pause makes essential: **« cost to keep it running without Claude »**.
7. **Places as a pillar, a fifth task store, a new approval screen, a Moment table for lifecycles, three edition designs** — each is one more layer; each is removed or merged above.

---

## 9. Pem's answers (2026-11-20, chat) — folded in above

1. « Agents » = the business stakeholders, not AI agents → §2.3.
2. Claude after 12-17: « I will keep everything, we're not gonna erase anything » — read as: all data and accounts stay. Whether a Claude plan stays is not settled; the runbook assumes none.
3. Places: Pem thinks in shared records with an id (Access) → kept as one shared resource, after the pause (§1.1 b).
4. ADAGP: not a member now → §7.
5. Why one table for touches: asked → answered in the chat (lifecycles keep their guards; one-off facts get one home instead of one table each).
6. Editions: one row per copy, every number tracked; bookshop as holder when the buyer is unknown → §4.
7. Journal sketchbook: must ship before the freeze → §3.2, §5.
8. Desk capture: AutoHotkey, grabbing from any app → §3.1.
9. Usage count per tab: yes. 10. Restore drill + R2 rotation this week: yes. 11. Introduction package: for whoever takes charge. 12. « Cost to keep it running without Claude » line on every brief: yes.
13. Input system: one landing zone for everything, not a debug-only inbox → `inbox_item` (§3.1); the `kaizen_item` reuse is dropped.

---

## 10. A year without Claude — the « 95 % » line (Pem 2026-11-20)

Pem: hard deadlines; be ready to switch off for a while « with a product that works at 95 % », Pem handles the rest; someone else may take over the cost later. Pem's question: « if I had everything cut off next year, would I need something else? »

**95 % means:** every screen Pem uses every week works and is tested; whatever does not work is hidden; nothing half-built is visible. It does **not** mean every design in TODO is built.

What a year alone needs, aim by aim (checked against live code 2026-11-20):

| Aim | Needed next year | State | Before 12-17? |
|---|---|---|---|
| Trace | quick capture (desk + phone), Journal, voice notes, photos into works | `/hub`, voice, photos exist; inbox + hotkey + sketchbook planned | **yes** (§5 items 2–3) |
| Trace | the catalogue itself | exists | — |
| Links | Constellation linking by hand | exists | — (Pem's own work) |
| Transmission | the website, readable and fast | live; R8 first batch built; per-work page and look decisions not done | no — the site works as it is; R8 is after the pause |
| Transmission | Instagram (§11) | Make chain exists, used twice; **no way to record a post by hand** | **yes, small**: a manual « posted » record (link + works) so the trace holds without Make |
| Transmission | the archive readable without the app | `npm run archive` exists | run it once before 12-17; the copy kept off-line |
| Value | a sale, a loan, a gift with their papers | built, to prove on the Docker copy | **yes** (the full mock year) |
| Value | **receipts book** (the legal paper under micro-BNC from the first sale) | **not built** (no code found) | **yes, small**: a yearly export from Revenus & dépenses (date, payer, work, amount, means, ref) — built with the mock year: the Docker copy's mock payments are its test data, and the export is checked line by line against them (Pem 2026-11-20) |
| Ops | backups + restore, keys, costs, what to do when it breaks | drill and rotation pending; runbook not written | **yes** (§5, §6) |

**Not needed next year** (can wait without loss): contacts timeline and care rules, mail / calendar gates, editions, reverse pricing (a spreadsheet does it), matching, digests, 3D, kit switches, catalogue steps 2–8, products / licences. Each stays designed in its note; nothing is lost by waiting.

**So, answering Pem:** with the five « yes » rows done and tested, nothing else is needed for a year. Everything Pem thinks of after that goes into the inbox as an idea — it is scope drift only if it gets built.

---

## 11. Social media (Pem 2026-11-20)

- **Accounts:** Instagram only (followers, no posts yet); Substack « eventually »; plus the website.
- **Tool:** Make (the Broadcast chain: work marked « Diffusion » → Make → caption by AI → Buffer draft → Slack). Lives outside the repo; not checked.
- **Who posts:** Pem; a team member with Pem's GO (fits « drafts, a person sends »).
- **Content:** finished works, details, studio and process photos, journal texts — **mostly reels**.
- **Record:** every post recorded in the hub, linked to the works it shows (Pem: yes).

**What it means for the plan:**
1. **A post is an output, a reel is made outside.** Video editing stays in the phone / Adobe; the hub does not store or edit video (Pem already chose video links only, CatalogueGaps A3). The hub's role: choose what to show, hold the caption draft, and **record what went out** (date, link, works, kind: post / reel / story).
2. **The record must not depend on Make.** Today a post is recorded only when Make calls the hub. Small build before the freeze: « Ajouter une publication » on a work and in Broadcast — paste the Instagram link, tick the works, done. With Make running, nothing changes.
3. **Each post is a line in the work's history** — transmission is trace too; later it feeds the work's « diffusion » list and the site.
4. **Comments and messages coming in** stay a gate for later (§2.2): forward to the inbox from the phone's share sheet, no Instagram API.
5. **Substack:** when it comes, the site's journal stays the source and the letter points back (R8 note); not before the pause.
6. **Cost without Claude:** Make, Buffer and the AI caption are three paid services; posting by hand from the phone works with none of them. The runbook says which can be switched off.

---

## 12. Is every field covered? Is the base solid? (Pem 2026-11-20)

### 12.1 Fields of the practice — built, designed, not tackled

**Built** (live): catalogue, images, versions + restore, custody (owner / holder / address), statuses and fate, condition reports, production board, journal, voice notes, ideas / concepts, themes and groups, Constellation, map, orders in five kinds with papers, payments, 14-day return, kits, portfolio PDF, COA, labels with QR, public site, site analytics, Broadcast (Instagram via Make), supplies and stock, expenses and Revenus & dépenses, Vault, Pipeline, events, AI desk, phone `/hub`, readable archive export, legal pages part 1, Aide.

**Designed, not built:** listed in §4 and §10 — none needed for next year beyond the §10 rows.

**Not tackled anywhere** (no note, no table — found in this pass):

| Field | Why it matters | Proposal |
|---|---|---|
| **Insurance of the collection at the studio** | Works stored under an old roof (H2); after a leak an insurer asks for the list, values and photos. `insurance_claim` exists, no policy or insured value. | A saved report « liste pour l'assureur » (works at a place, value, photo, condition) — a read, after the pause; the policy itself as a Vault document. |
| **Where in the studio** (rack, shelf, box) | 1,182 works; the address says « Atelier », not where to find #1234. | **Pem 2026-11-20: « Yes, often ».** Design in §12.3. |
| **Other income** (fees, prizes, grants, teaching, royalties, resale right) | The receipts book must hold **all** receipts, not only sales. | The receipts book export reads every payment, with or without an order; a payment « hors commande » with a kind. Checked in the mock year. |
| **Original files** (RAW, high-res masters for printing) | They live outside the hub under Pem's naming system; an heir must find them. | Runbook + introduction package: where they are, the naming rule. No build (Photothèque stays parked). |
| **Materials record for conservation** | A future restorer or the estate needs the exact materials (paints, varnish, support preparation); `Technique` / `Support` are coarse. | After the pause: a free « matériaux » text on the work, or a line type in the work notes. |
| **Mailing list and consent** | Substack « eventually »; whoever holds the list holds the consent. | When Substack comes, it holds the list; the hub keeps none. No build. |
| **Accounts and succession** (domain, Supabase, Vercel, R2, Instagram, Google, Make) | Without access the archive is locked. | Runbook lists accounts (no passwords); the private legacy plan holds the rest — with Pem, not in the repo. |
| **Authentication after Pem** | Catalogue raisonné, signature specimens, COA verification. | COA verify exists; the introduction package says how authenticity is checked. |

### 12.2 Is the base solid? (live DB, read only, 2026-11-20)

**Solid:**
- Work rules, custody and fate are enforced **in the database** (triggers), not only in screens — every writer goes through them.
- Orders: one table for five kinds, guards against double sale and overpayment, old order tables dropped, « Confié » live.
- Signed-out visitors can write only an enquiry and a page view (checked: `anon` write grants on `inquiry`, `page_view` only). `ARCHITECTURE.md` §7 still says « open » — stale, for the lead to correct.
- Versions on every work change; contact merge in one transaction.

**Weak, known:**
1. **Stale save on the work card** (TODO §1: a card left open can post an old status / owner / price) — the database stamp is written, not live. Should close before the freeze: it is a data-safety item.
2. **Speed architecture** (§3.2).
3. **Many writers of `Oeuvres`** (27 files) — safe because the triggers guard, hard to maintain alone.
4. **Duplicate stores**: places in two tables, tasks in four, inputs in six (the inbox fixes inputs; the rest after the pause).

**Verdict:** the structure is sound where it matters most (works, custody, money). The weak points are speed, one data-safety item, and duplication — none needs a rebuild.

### 12.3 Where a work is in the studio (« emplacement ») — sketch

Felt often (Pem 2026-11-20). Card for the brief:
- **Aim:** Trace (nothing lost — physically too).
- **What:** one short field on the work, `emplacement` (« Rack A · 3 », « Boîte 12 », « Mezzanine »), with suggestions from the values already used, so the same place is always written the same way. A place is a text, not a new table (it lives inside the studio address; a full place table comes with §1.1 b after the pause).
- **Where it shows:** work card (next to the address), Inventory column + filter (« everything in Boîte 12 »), ⌘K search, phone work view, inventory list paper.
- **The phone is the tool:** scan a work's label QR → work view → « Emplacement » with the last values as one-tap chips. A tidy-up session = scan, tap, next.
- **Rules:** meaningful only while Pem holds the work; when an order takes the work out, it is cleared (the version history keeps the old one); when it comes back, the phone asks for it. Versioned like every work field.
- **Consequences / scope / pluses / minuses:** + finding any of 1,182 works in seconds, + the insurer's list (§12.1) gets a real « where »; − 1,182 works to place the first time (done gradually, as works are touched; Inventory shows « sans emplacement »); − one SQL column (own OK, Flow trace: `saveWork` + pending keys, versions, Inventory, phone, papers, search index, archive export).
- **Cost without Claude:** none beyond the field.
- **When:** small enough for before the freeze if Pem wants it there; it competes with the speed fix (§5 item 7).

---

## 13. Assessment — strong and weak points (as observed, no direction)

Pem 2026-11-20: a record of what this is, not a to-do. Observed in live code and the live DB, 2026-11-20.

**Strong points**
- The rules of a work (status, stage, fate, custody, address, history line, tasks) are enforced by the database; every screen and script goes through them.
- Every change to a work is versioned (11,489 versions) and can be restored.
- Orders: one table for five kinds, with database guards against a double sale, an overpayment and a move without an order; the old order tables are gone.
- Custody model: owner, holder and address are separate and always filled.
- Signed-out visitors can write only an enquiry and a page view; Pem's private data is not readable from outside.
- Contact merge runs as one transaction: all or nothing.
- The catalogue is complete in volume: 1,182 works, 1,237 images, 1,173 descriptions, 1,297 theme links.
- A readable archive export exists that works without the app.
- Bilingual copy (FR + EN) is enforced by checks; phone layout rules (375 px, 44 px) are written and checked.
- Search by meaning (embeddings) covers works, contacts, concepts and journal entries.
- A throwaway Docker copy exists for full-scale tests.
- Design notes exist for every open area, with Pem's answers recorded.

**Weak points**
- Speed: Atelier reads go through Server Actions that run one at a time; a cold Inventory is ~15 actions in a queue; the whole catalogue (~1 MB) can travel on a tab change.
- A work card left open can save an old status, owner or price over a newer one (the database stamp is written, not live).
- 27 files write to `Oeuvres`; 18 browser components write tables directly.
- Duplicate stores: places in two tables, tasks in four, inputs in six.
- Surface: ~30 Atelier tabs, ~90 tables; several screens built ahead of use (Broadcast used twice, kits 0, events with people 0, payments 0).
- The AI desk: purpose right, screen obscure and not fully working.
- The human-made map is thin: 52 links made by hand out of 3,772.
- Original image files exist in **one copy only** (Pem 2026-11-20).
- The PC is a single point for search indexing, transcription, image descriptions and card reading.
- Operations depend on Claude: no runbook yet; restore drill and key rotation not done.
- The public site works but its redesign (R8) is open; legal pages are not on the site.
- Pace: 424 commits in 20 days; docs drift behind code (e.g. `ARCHITECTURE.md` §7 on signed-out writes).

---

## 14. Proposals for the fields nobody had tackled (Pem 2026-11-20)

### 14.1 Original image files — one copy only (risk accepted by Pem)

**Pem 2026-11-20:** the works themselves remain; re-photographing would be a big job but high-res files are not needed soon; « I'll take the risk for now ». Recorded as an accepted risk. The proposal below stays for when Pem wants it; not in the §5 order.
- **Rule 3-2-1:** three copies, two kinds of storage, one away from the studio.
- **Proposal:** (1) an external drive, copied now, then once a week (Windows File History or a sync tool does it unattended); (2) one copy off-site in the cloud — Cloudflare R2 is already paid and in the EU (a separate bucket, never public, not the app's), or any backup service Pem prefers; (3) the computer itself.
- Size first: how many GB the originals and the bulk photos weigh decides cost (R2 is about €0.015 per GB per month: 500 GB ≈ €7.5 / month).
- Runbook: where each copy is, how to check it, how to restore one file.
- The photo database Pem alluded to (the ~4,000-photo « Photothèque », parked) is a separate later project; the backup does not wait for it.

### 14.2 Insurance of the works at the studio

- **Today:** `insurance_claim` (after a damage, with police report), insurance values on loan / deposit order lines, condition reports, the storage-risk idea (H2). No record of the policy, no insured value per work at the studio, no list for an insurer.
- **Proposal (after the pause, small):**
  1. The policy as a Vault document (insurer, number, what it covers, ceiling, renewal date → a reminder).
  2. A value per work for insurance — not a new field: the price, or the value written on its last order line, with a manual override only when they differ.
  3. One saved report « Liste pour l'assureur »: works at a place (and an emplacement, §14.3), value, photo, last condition, total — as PDF and CSV.
  4. Later, with H2: risk notes per storage place.
- To ask the insurer (Pem): does the policy cover works stored at home / studio, at what value (price or replacement), and what list do they want?

### 14.3 Where a work is in the studio — groupings and actual place

Two different needs, both real:
- **Actual place** (physical): rack, shelf, box, plan chest, roll. Answers « where is #1234 ». → the `emplacement` field of §12.3, set from the phone by scanning the label QR, with suggestions so the same place is always written the same way.
- **Groupings** (logical): the works of a show, a series, a selection. They exist already as themes (creation) and working groups (business); they say nothing about where a work physically is. When a group is also stored together (« everything for Montrouge is in box 4 »), that is a fact about emplacement, not a new grouping.
- **Proposal:** emplacement only, as in §12.3; a group can be given one emplacement in one action (« move this group to Boîte 4 ») from Inventory. Later, with the one `place` table (§1.1 b), an emplacement becomes a child place of the studio.
- To settle with Pem: how works are stored (racks, flat files, boxes, rolls, wrapped), and whether a box itself gets a label with a QR.

### 14.4 Every receipt, not only sales

- The receipts book lists **all money received**: sales, fees (talks, workshops, teaching), prizes and grants, residencies paid, reproduction / licence fees, resale right, anything else. Under micro-BNC all of it is receipts (the accountant confirms what counts and how).
- **Proposal:** a payment can exist **without an order**, with a kind (sale, fee, prize / grant, licence, resale right, other), a payer (contact or typed name) and optionally the event or the work it relates to. « Encaisser » on an order stays as it is; a new « + Recette » in Revenus & dépenses covers the rest.
- To check in code at build: whether `payments` already accepts a row with no order (schema reading only).
- Tested in the mock year: a sale, a fee, a prize, a cash payment; the export checked line by line.

### 14.5 Materials record for conservation — by voice

- **Proposal:** no form. A voice note on a work, tagged « Matériaux », transcribed by the PC as today (Whisper); the transcript shows in a « Matériaux » block on the work card. A few records over time, from the phone at the easel, are enough.
- Later, if useful: the local AI pulls a short list (support, preparation, paints, medium, varnish) from the transcript, as a suggestion Pem accepts.
- Uses what exists: `voice_note` already links to a work; only a tag and a block on the card are new.

### 14.6 Noted for later (no proposal needed now)

- **Mailing list:** held by Substack when it comes; the hub keeps no list.
- **Accounts and succession:** the runbook lists every account and its owner (no passwords); the rest goes in Pem's private legacy plan.
- **Authentication after Pem:** COA verification exists; the introduction package explains how authenticity is checked; a signature specimen sheet could join the Vault.

---

## 15. Revisions after Pem's replies (2026-11-20) — these win over §12.3, §14.3, §14.4

### 15.1 Receipts: money with no paper, and gifts

**Money received with no trace** (cash handed over, a transfer with no invoice): the receipts book *is* the trace, if each entry is made the day it happens. Three habits make it hold:
1. **A receipt paper for every entry with no other paper.** « + Recette » makes a numbered receipt (« Reçu n° R-2026-007 »: date, payer, amount, means, reason, Pem's signature), filed in the Vault; Pem gives a copy to the payer when possible and keeps one. The receipts book line points to it.
2. **Cash goes to the bank** soon after, with the receipt number noted; the bank statement then confirms the entry.
3. **Never backdated, never deleted**: a wrong entry is corrected by a new line, like the Journal.
The accountant confirms this is enough (it is the usual practice for a micro-entrepreneur; not legal advice).

**Gifts and support.** Kinds of money and help coming in, each recorded, each classified by the accountant:

| Kind | Example | Likely tax reading (to confirm) |
|---|---|---|
| Sale | a work, a copy | receipt |
| Fee | talk, workshop, teaching | receipt |
| Prize / grant / residency paid | | receipt (some grants have their own rules) |
| Licence / reproduction | image for a book | receipt (copyright income) |
| Resale right | via a society | receipt |
| **Support in money** (patronage, regular help « almost like a salary ») | a patron pays monthly | depends on whether it pays for the art activity (then receipt) or is a private gift between people (then not) — **accountant** |
| **Gift in money**, private | a relative's gift | usually not a receipt; recorded, not in the receipts total |
| **Gift in kind** | materials given, a studio lent, framing offered | recorded with an estimated value; usually not cash receipts — **accountant** |

Proposal: one list of these kinds on « + Recette »; the receipts book total counts only the kinds the accountant marks as receipts; the others are kept in the record (trace, thanks, provenance of support) and shown apart. Tested in the mock year with one line of each kind.

### 15.2 Where a work is — the storage map (replaces §12.3 and §14.3)

**Pem 2026-11-20:** works are stored « a bit of everything » (racks, flat files, boxes, rolls); fragile ones separated or wrapped in rice paper; **every box / location / grouping gets its own QR label**; the real friction is « I need that 5 × 7 in work and I don't know where it is »; be smart: tools to find it fast, ways to group, a **map**, and tricks that need no device.

**Model: locations as a tree, each with a QR.** Because a box needs its own label and a place in a map, a location is a record, not a text:
- Studio → zone (room, mezzanine, wall) → furniture (rack, plan chest, shelf) → container (box, folder, roll, drawer). Any depth; each has a short code (« A-3-12 » = zone A, rack 3, box 12), a name, a kind, an optional photo, a QR label.
- A work points to **one** location (the deepest one it is in). Moving a box moves everything inside it at once.
- This is the start of the one `place` table (§1.1 b): studio locations are child places of the studio address.

**Finding a work fast (with a device):**
1. Work card / ⌘K / phone search → the location path « Atelier › Mezzanine › Meuble à plans 2 › Tiroir 4 », with the box's photo.
2. The **studio map**: a simple floor plan of the studio with zones and furniture drawn once (the Exhibitions floor-plan tool already draws walls and placements — reuse it); tap a zone → its boxes → their works as thumbnails.
3. Filters in Inventory by location, size (« small works under 20 cm »), and « without location ».
4. Scan a box's QR → its contents with thumbnails; scan a work's label → set or confirm where it is. A tidy-up session = scan the box, scan the works going in.

**Finding a work fast (no device — the tricks):**
1. **The location code on the work itself**, on the back label next to the number (pencil or a small sticker), so a work out of place shows where it belongs.
2. **A contents sheet in every box**, printed from the hub (thumbnails + numbers + titles), taped inside the lid — reprinted when the box changes.
3. **The code on the outside of every box**, large, and the same code on the studio map pinned to the wall.
4. **One printed studio map** with zones and codes on the wall at the entrance.
5. **Sort small works by number inside a box** (or by year), so the eye finds #1234 without unpacking.
6. **Colour by zone** (a coloured dot on boxes of one zone) — optional.
7. **Fragile works**: their own boxes, marked « fragile — papier de riz », never mixed with others; the hub flags them so they are opened with care.

**Groupings vs places:** themes and groups stay what they are (creation / business). A group can be sent to a location in one action (« everything for Montrouge → box A-3-12 »); the location then answers « where », the group answers « why together ».

**Consequences / scope / pluses / minuses:** + any work found in seconds, from the card, the map or the box; + the insurer's list (§14.2) per location; + moves of whole boxes in one action; − a first labelling of every location and gradual placing of 1,182 works (done as works are touched; « sans emplacement » filter shows the rest); − one new table (locations, with parent, code, kind, photo) + one column on the work, SQL with its own OK and a Flow trace (`saveWork` + pending keys, versions, Inventory, phone, papers, labels, search, archive export, orders clear the location when a work leaves Pem's hands); − label printing for boxes (labels with QR already exist for works).

**Cost without Claude:** labels and sheets print from the hub; no service.

**When:** Pem 2026-11-20: « There is no in place. We do what we can. And we shall see. » → designed now (this section); built when it fits — not promised before the freeze. The no-device tricks need no build and can start any day.
