# Idées — research desks fed by the Journal (draft for Pem, 2026-11-23)

Now (verified against `main` 2026-11-28): **Built, on `main`:** the tree of ideas (`ideas_tree.sql` live), desk and phone (`IdeasHome`, `IdeaDesk`); open: the voice-note link case in TODO « Now ». The status line below is the original.
Status: **approved by Pem 2026-11-23** (chat: « I am happy to approve. It needs my using it to rate it and review it really. »). Local draft, not committed. Design only: no code, no SQL written; the SQL of §10 still needs its own OK. Pem judges it by using it: the first build step is put in his hands early (phone and desk), and the design is revised from that use. One rule left open on purpose (§8b).

Pem 2026-11-23: « when I capture an idea, writing or recording, it can be an idea and therefore is listed as an idea, but it also remains as a journal entry. Ideas can be input from the phone, straight from the tab, or from the desktop. I'm wondering if ideas shouldn't be almost like desktops, with places with folders, writings, almost like a deep research section. And we could use the seed system. »

Read before writing: root `CLAUDE.md`; [`BuildingPrinciples.md`](../2026-11-21/BuildingPrinciples.md); [`JournalDesign.md`](../2026-11-22/JournalDesign.md) (approved 2026-11-22); the Journal build notes (Step A + Step B part 1, live 2026-11-23). Live code read (2026-11-23): `app/atelier/(portal)/concepts/actions.ts`, `document-actions.ts`, `_components/Concepts.tsx`, `components/atelier/concepts/*`, `journal/entry-actions.ts` (`createJournalEntry` already takes `conceptIds`), the other `concept` writers (`notes/actions.ts`, `pipeline/actions.ts`, `share-triage/actions.ts`), `app/hub/menu-actions.ts`, `HubHomeClient.tsx`. Live database read only (counts below). Not done: nothing opened signed in, nothing tried on the phone.

---

## 0. In one paragraph

**An idea is a place, the Journal is the way in.** Whatever Pem notes — a line, a voice note, a photo — lands on its day in the Journal, as now. When it is an idea, one gesture (« En faire une idée ») plants it: the idea is created as a **graine**, with the moment as its first page, and the moment stays on its day. From then on the idea has its own **desk**: its moments in the order they were noted (each one also living on its day), its **text** (the one long writing that is reworked, with its history), its **documents** (the Vault), the **works** its moments name, the **people**, and its **branches** — the idea tree: an idea grows branches, and a branch is an idea. Writing or dictating *into* an idea writes a Journal entry on today, already linked to it: there is one place to write, and two ways to read it (by day, by idea). The seed — **graine → pousse → mûre** — is the idea's only mark (nothing else to rate); its author moves it, the desk shows what it has grown (moments, days, works, documents) and offers the next step when there is reason to.

## 1. Which kind, which home, what changes (principles §2)

| Question | Answer |
|---|---|
| Kind | Two kinds, already in the map: **a moment** (home: the day's page, `journal_entry`) and **an idea** (home: Idées, `concept`). A moment that *is* an idea is both: the moment stays home on its day, the idea points at it (`journal_entry_link.concept_id`, live, 39 rows). Not a copy, not a move. |
| Home of each piece of the desk | Moments, writings, voice notes, photos → the Journal (one home for everything dated). The idea's reworked text → the idea itself (`concept.description`, one per idea). Papers, PDFs, links → the Vault (`document.concept_id`, live). Works → the works (a read through the moments' `#` links, and `concept.oeuvre_id` when it became a work). People → `Contact` (a read through the moments' `@` links, Step B part 2). Branches → other ideas (`concept`). |
| What changes | **No new home.** Two columns (`concept.parent_id` for branches, `concept.created_by` for who planted it — today an idea does not record its author; the 22 ideas of today are Pem's), one small history table (`concept_change`, for the stage / text / parent history the Journal shows), one database door to create an idea with its moment, all or nothing (`idea_plant`), and `concept`'s rules redrawn: the whole team writes through the doors, **only Pem deletes** (today any team member can write *or delete* an idea straight from a browser file — commandments 1, 2). One new page: the desk of one idea, `/atelier/concepts/[id]` (the inline card cannot hold a desk; a page is also what `#idea` links and Journal chips open). The Idées list is redrawn. |
| Why no new table for folders, writings, research notes | A folder with no stage, no moments and no works is an empty idea; an idea that holds branches *is* a folder (§3.3). A writing is either a moment (dated, frozen → Journal) or the idea's text (living → the idea). A research note is a moment with the label Recherche (live since 2026-11-23). A kind is a label, a view is a read. |

## 2. One door in (question 1)

Every way in ends in the **same database door**, `idea_plant(title, body, from_entry_id, parent_id)`: in one transaction it creates the idea (graine), and either takes the existing moment or writes a new one on today, links them (`proposed_by 'pem'`, validated), and puts the label Idée on the moment. It answers with the idea and the moment, or refuses in words (commandment 3). **Everyone on the team can plant and write ideas** (Pem 2026-11-23); **nobody but Pem deletes an idea** — the database refuses it (§8).

| From | Gesture | What is written |
|---|---|---|
| Any Journal card (phone or desk) | « ⋯ → En faire une idée » (already in the approved card menu) → a small sheet: title (pre-filled with the first words), « dans : ‹ idée mère › » (optional) → « Planter » | `idea_plant(title, null, entry_id, parent)` — the moment keeps its day; the card shows the chip « 🌱 ‹ titre › ». |
| Phone record sheet / ✍️ line / desk composer, *before* sending | The target chip beside the day chip: « dans : le Journal ▾ » → « une nouvelle idée » or « l'idée ‹ … › » (search) | New idea: `createJournalEntry` then `idea_plant` on it — **one door call** (`idea_plant` with body = the capture). Existing idea: `createJournalEntry` with `conceptIds` (exists today). |
| Typing `#` in any text | `#Coquill…` offers works **and ideas** (commandment 13); « + Idée ‹ texte › » when nothing matches | Picking: a link from the entry to the idea. « + Idée »: `idea_plant(texte, null, this entry, null)`. |
| The Idées tab (phone or desk) | « + Planter une idée »: title, first lines (or 🎤) | `idea_plant(title, body, null, parent)` — **the moment is written on today**, so an idea made in the tab is also on today's page (« Idée plantée · Coquillages ») — Pem: « it also remains as a journal entry ». |
| A voice note routed in the Notes tab (« nouvelle idée ») | today `notes/actions.ts` inserts a `concept` itself | goes through `idea_plant` (the transcript entry is the moment). |
| A reminder with no project (« En faire une idée », Idées tab) | today `reminderToIdea` inserts a `concept` itself | goes through `idea_plant`, the moment on the reminder's day. |
| Share triage « ajouter à une idée » | today appends a block to `concept.notes` | writes a moment on today linked to the idea (the shared link / text as its body); `concept.notes` stops growing (Pem 2026-11-23: « let's try that »). |

**An idea is also a moment of the person who had it** (Pem 2026-11-23: « just as well as an article from a contact is a moment for that contact, an idea created by a team member or somebody becomes a moment as well »). The planting moment carries its author (`journal_entry.author_id`), so it shows on the day *and* in that person's history (People page: their moments). An idea that comes from someone outside the team (a collector, a friend) is planted by whoever notes it, and the moment links that person with `@` (person links, Journal Step B part 2): it then shows in their history too. One moment, three readings: by day, by idea, by person.

The label Idée and the idea are one thing (Pem 2026-11-23): choosing « Idée » in « Étiquettes » opens the same « Planter » sheet; there is no moment labelled Idée without its idea. A moment can feed several ideas (one link each); an idea never owns a moment.

### 2b. An article or a book: one moment ties the idea, the work, the author and the text (Pem 2026-11-23)

Pem: « if we are going to pull articles or books as ideas, and contacts from them — the author — it becomes a moment to them. So to link the object, the work and the author all together. »

When Pem reads an article or a book and takes an idea from it, **one moment** (the reading, on its day) carries every link:

| Link on the moment | To | Exists? |
|---|---|---|
| `#idée` | the idea it plants or feeds | yes (`journal_entry_link.concept_id`) |
| `#œuvre` | the work it speaks to | yes (`journal_entry_link.oeuvre_id`) |
| `@auteur` | the author, a person (found, or « + Personne » through the contact door) | **no** — links to a person are Journal Step B part 2 (`contact_id`) |
| the article / the book itself | the Vault (`document`: a PDF, a scan, or a link to the page) | **no** — a moment cannot point to a paper yet: one column `document_id` on the same link table, beside `contact_id`, same rules |

Read back, the same moment shows: on its day; in the idea's Fil; on the work's page (« Dans le Journal »); in the author's history (People); beside the paper in the Vault. Nothing is copied, nothing is a second record: the author is a person once, the article a paper once, the moment the one place where they meet.

Not in this build: pulling ideas or authors out of a text by machine (a deferred feature — its own GO). The two link columns are SQL on the Journal's link table, with their own OK, built with Journal Step B part 2.

## 3. The desk of one idea (question 2)

### 3.1 What it holds — six places, all reads except the text

| Place | Reads | Written by |
|---|---|---|
| **Fil** (the moments) | Entries linked to the idea (validated links), their suites (entry → entry, live), voice notes and photos with `concept_id` (old columns, 3 voice notes live), discussion lines (`note_line` target idea, 0 live), and the idea's own history (stage moved, text reworked, branch added). **Newest first** (Pem 2026-11-23), each with its date; a suite still shows under the moment it answers. | The Journal doors only. The composer at the bottom (phone: the record bar) writes an entry **on today** linked to the idea. |
| **Texte** | `concept.description` — the one living text of the idea (draft, synthesis, statement). | Pem edits it in place; each save writes a line in `concept_change` (old text kept) and shows on that day in the Journal as « Texte retravaillé · ‹ idée › » (a read, like a work changed). |
| **Documents** | `document` rows with `concept_id` (file, link, local — today's `ConceptDocuments`). | The Vault doors (unchanged). |
| **Œuvres** | Works named in the idea's moments (`#`), with the moments that name them; the work it became (`oeuvre_id`). | Nothing new: naming a work in a moment links it. |
| **Personnes** | People named in its moments (`@`, Step B part 2). | idem. |
| **Branches** | Ideas whose `parent_id` is this idea, each with its seed and counts. | `idea_plant(…, parent)` (« + Branche »); « Greffer sur… » (move under another idea). |
| **Idées liées** | Other ideas named with `#` in its moments (and the ideas whose moments name this one), with the moments that tie them. | Nothing new: `#idea` in a moment links it (commandment 13). |

### 3.2 Where long writing lives — one home each

- **Written once, at a moment** (a page of thought, a long dictation, a reading note): a Journal entry, as long as needed (20,000 characters today). It is dated and frozen; a later thought is a **suite** under it (Delacroix's lesson, already built).
- **Reworked over time** (the idea's statement, a project text, a draft you keep improving): **the idea's Texte**, one per idea, with every version kept in `concept_change`. A sub-question with its own text is a branch.
- **A finished paper** (PDF, a text sent to someone, a scan): the Vault, pointing to the idea.

So the desk never has « files » of its own; it shows the three homes side by side.

### 3.3 The idea tree: branches, not folders or labels — why

**The ideas form a tree** (Pem 2026-11-23: « we keep the metaphor running — it's a tree »). A seed is planted, it sprouts, it grows **branches**; each branch is an idea with its own seed (`concept.parent_id`, one parent, **as deep as necessary**; no loops — the database refuses one). The words follow the tree everywhere: « Planter » (a new idea), « + Branche » (an idea on this one), « Greffer sur… » (move it under another), the trunk (an idea with no parent). Pem: « the important thing is that everything can be linked » — so the tree says *where an idea grows*; any idea is also linked to any other through its moments (`#`), shown under « Idées liées » on both desks.

- A sub-question of a research grows on its own: its own seed (« Sel » can be mûre while « Coquillages » is still a pousse), its own moments, works and documents. A label cannot carry that; an idea can.
- One home: the folder *is* the idea's desk; nothing to keep in step.
- Grafting a branch onto another idea is one action; its moments do not move (they stay on their days).
- The desk of an idea shows its branches, and can show **everything below it** in one Fil (toggle « avec les branches »).

**Labels stay for what cuts across**: the moment labels (Recherche, Process, Matériaux…, live) and, across ideas, the existing `concept.themes` (free words today; tying them to the works' themes is the parked TODO in `Concepts.tsx`, not part of this design).

## 4. The seed system — the idea's stage (question 3)

The live seed (`concept.maturity`, 22 ideas: 21 graines, 1 pousse, 0 mûre) becomes the one stage of an idea, shown everywhere as 🌰 graine · 🌱 pousse · 🌳 mûre.

| Stage | Means | The desk offers (one main action, as on Journal cards) |
|---|---|---|
| **Graine** | Noted. One moment, maybe two. | « Écrire dedans » (composer). When a moment is added **on another day** than the first: « Passer en pousse ? » |
| **Pousse** | Pem is working on it: moments on several days, a text, documents, branches. | « Écrire dedans ». When it has a Texte and at least one work or document: « Mûre ? » |
| **Mûre** | Ready to become something. | « Devenir une œuvre » (today's `promoteConcept`) or « Devenir un projet » (today's Pipeline conversion). |

- **The stage is moved by the idea's author, never by the machine** (door `idea_set_stage`; Pem 2026-11-23: « I can move the stage for my own ideas »). Everyone can write into any idea (moments, comments). Who moves the stage of **someone else's** idea is left open by Pem (§8b): until decided, the database lets the author and Pem move it — one rule line to change later, not a rebuild. The machine only offers, never moves (the AI proposal rule). Each move is a line in `concept_change` and shows on that day in the Journal (« Coquillages → pousse »).
- **Signals beside the seed**, counted by the database (commandment 7): moments, days, last moment, works, documents, branches. « En sommeil » = no moment for 60 days — a **view**, not a stage (Pem: no preference; 60 kept, a number to change later, not a rebuild).
- **Simple and organic — nothing else to rate** (Pem 2026-11-23: « I'm not gonna spend too much time rating »). The seed is the only mark anyone sets. The old « statut » and the « weight » (petite / recherche) leave the screens: what an idea *became* is read from the facts — « devenue œuvre » when it points to a work, « devenue projet » when a project comes from it; an idea nobody feeds just rests (« en sommeil », a view). The desk shows the places that have something in them, so a small idea looks small by itself. The two old columns stay in the data, untouched (no data moved); the one idea « en cours » today shows as a pousse.

## 5. Phone face and desk face (question 4) — same doors

Every gesture below calls the doors of §2–§4 and the Journal's own doors; nothing is phone-only or desk-only.

**Phone (375 px)** — led by taking in.
- **Idées list**: **ordered by last moment** (Pem 2026-11-23), the one most recently fed on top; each row: seed · title · « dans ‹ mère › » · « 12 moments · 5 j · il y a 2 j » · a branch count. A seed filter (toutes · 🌰 · 🌱 · 🌳) above. A search line on top; « + Planter » at the thumb.
- **One idea**: header (seed, title, « dans ‹ mère › »), a segment row **Fil · Texte · Docs · Œuvres · Branches** (Personnes in Fil's chips until Step B part 2), the Fil as the Journal's cards (same component, compact), and **the Journal's record bar at the bottom, aimed at the idea**: 🎤 dictates into the idea (the entry lands on today *and* in the idea). The stage shows as a seed button in the header; tapping it opens the three stages with the signals.
- **Capture anywhere**: the record sheet's target chip « dans : le Journal ▾ / une idée ».

**Desk (1280 px)** — led by room and connecting.
- Left: **the tree of ideas** (trunks, with their branches folded under them), search, « + Planter ».
- Centre: **the Fil** of the selected idea (newest first) with the composer at the top; tabs **Fil | Texte** (the Texte opens wide to write).
- Right rail: the seed and its signals with the one main action; Documents; Œuvres (pictures, with « voir les moments »); Personnes; Branches; Idées liées. Same rail pattern as the Journal desk.
- From the Journal desk rail, an idea chip opens its desk; from the desk, a moment's date opens it in the Journal stream.

## 6. Readers and Flow trace (question 5)

**Input** → the doors: `idea_plant` (new), `idea_set_stage` (new), `idea_set_parent` (new), `updateConcept` (text / title; writes `concept_change` through a trigger), `createJournalEntry` (`conceptIds`, exists), `decideJournalLink` (AI proposals of ideas, exists), the Vault doors (`document.concept_id`, exist).

**Writers today that must move to the doors** (else two ways in): `createConcept`, `reminderToIdea` (`concepts/actions.ts`); `notes/actions.ts` (voice note → new concept); `pipeline/actions.ts` (concept → project sets `statut`; the project's link to the idea is what « devenue projet » reads); `share-triage/actions.ts` (appends to `concept.notes`); `deleteConcept` (Pem only — the database refuses it for anyone else; also refused when the idea has moments or branches — `journal_entry_link` already restricts deletes; say it in words).

**Triggers**: new `concept_change` trigger (stage, text, parent, title); graph node dirty on `concept` (exists — the idea's text feeds its embedding); `trg_journal_entry_link_guard` (exists, unchanged).

| Reader | Changes? |
|---|---|
| Idées tab (`Concepts.tsx`, `ConceptCard`, `IdeaDiscussion`, `ConceptDocuments`, `NewConceptForm`, `ProposeIdea`, `LooseReminders`) | **redrawn**: list by seed (one database read with counts, by pages — today it reads all ideas + 2,000 lines + all documents), the desk page. |
| New desk page `/atelier/concepts/[id]` (+ `SITE_MAP.md`) | **new**: `idea_fil(id, before, n)` and `idea_signals(id)` as plain reads (principles 5–7). |
| Journal stream + desk rail (`JournalStream`, `JournalDesk`, `lib/journal/day-read.ts`, `stream.ts`) | idea chips 🌱 with seed, open the desk; « En faire une idée » wired; day shows « Idée plantée », « → pousse », « Texte retravaillé » from `concept_change`. |
| Old Journal day / phone today (`JournalDayExtras`, `TodayClient`, `DayTools`) | idea chips link to the desk (until the old screens are hidden). |
| Record sheet / composer (`VoiceNoteSheet`, `CaptureInspirationClient`, desk composer, capture queue) | target chip « dans : une idée »; the queued capture keeps its idea target. |
| `#` picker (commandment 13, shared) | offers ideas with their seed; « + Idée ». |
| Hub home (`menu-actions.ts` counts all / mûre; `HubHomeClient` idea tiles) | counts unchanged; tiles open the desk. |
| Notes tab routing (`notes/actions.ts`, `VoiceNoteLinkPanel`, `LinkedVoiceNotes`) | « nouvelle idée » through `idea_plant`. |
| Fil (`fil/actions.ts`, `note-lines-actions.ts`) | idea titles unchanged; discussion lines appear in the idea's Fil. |
| Vault (`vault/actions.ts`, `Vault.tsx`) | unchanged; a document attached shows in Documents. |
| Pipeline (`pipeline/actions.ts`) | « Devenir un projet » from mûre; sets the ending, not the stage. |
| Share triage | « ajouter à une idée » writes a moment. |
| ⌘K search, `entity` view, embed worker, `journal_propose_links` | unchanged reads; a hit on an idea opens its desk. |
| Archive export (`scripts/archive-export.mjs`) | writes `parent_id`, `concept_change`, and each idea's moments by id. |
| Stress scripts | one new chain: plant from a card, plant in the tab, move stage, move under a parent, refuse a loop. |

The usual failure (CLAUDE.md): the desk shows the planted moment while the Notes tab, share triage or the reminder path still make ideas without a moment. Every writer row above is part of the build.

## 7. The scenario — steps Pem can check (mockup: [`Ideas_Mockup.html`](./Ideas_Mockup.html))

**Phone.**
1. On today, dictate « des coquillages pris dans le sel, la croûte comme une peau ». The card lands on today.
2. ⋯ → En faire une idée. The sheet shows « Des coquillages pris dans le sel » as title, « dans : — ». Tap « Planter ». The card now carries 🌰 « Coquillages dans le sel ». Today's page still shows the card where it was.
3. Open Idées. « Coquillages dans le sel » is on top (the list is ordered by last moment), 🌰: « 1 moment · aujourd'hui ».
4. Open it. Fil: the moment, its date. Tap 🎤 at the bottom, dictate a second thought. It appears in the Fil — and on today's page in the Journal, with the 🌰 chip.
5. Two days later, write a line into it. The seed button offers « Passer en pousse ? » → yes. The header shows 🌱; the Journal of that day shows « Coquillages → pousse ».
6. Segment « Branches » → « + Branche »: « La croûte de sel ». It grows under Coquillages, 🌰.

**Desk.**
1. Idées: the tree left (Mûres, Pousses, Graines; Coquillages with « La croûte de sel » folded under it).
2. Click Coquillages: the Fil in the centre (newest first), the rail right: 🌱 pousse with « 4 moments · 3 jours · 1 œuvre · 1 document », Documents, Œuvres, Branches.
3. Tab Texte: write the statement; Enregistrer. The Fil shows « Texte retravaillé »; the Journal of today shows it too; « versions » unfolds the old text.
4. Type `#Coqu` in the composer: the work « Coquillages » (picture) and the idea « Coquillages dans le sel » (🌱) are both offered.
5. In the tab, « + Planter une idée » « Lumière rasante ». It appears under Graines — and on today's Journal page as « Idée plantée · Lumière rasante ».
6. Try to move Coquillages under « La croûte de sel »: refused in words (« une idée ne peut pas être greffée sur sa propre branche »).

## 8. Pem's answers (2026-11-23, chat) — folded in above

1. Label Idée = planting an idea: **yes, one gesture** (§2).
2. The team plants ideas: **yes**. Everybody writes ideas; **nobody but Pem deletes them** (§1, §2, §9).
3. `statut`: settled in the second round (10).
4. « En sommeil »: no preference → 60 days, a view (§4).
5. The Fil: **newest first** (§3.1).
6. Share triage and `concept.notes`: settled in the second round (12).
7. Branches: **as deep as necessary; everything can be linked** → any depth, plus « Idées liées » through `#` in moments (§3.1, §3.3).
8. Phone Idées list: **by last moment** (§5).

### Second round (2026-11-23)

9. Tree: **keep the metaphor — it's a tree** → branches, « + Branche », « Greffer sur… », trunks (§3.3).
10. Progress marks: **simple and organic, no rating** → the seed is the only mark; « devenue œuvre / projet » read from the facts; weight and old statut leave the screens (§4).
11. Stage: **anyone writes; Pem moves the stage of his own ideas** → the author moves it (§4).
12. Share into an idea: **try it** → it becomes a moment of the idea on today; the old notes show once as « notes d'avant » (§2).

## 8b. Left open by Pem

- Who moves the stage of **someone else's** idea (« more a collaboration thing »). Until decided: the author and Pem. Changing it later is one rule line.

## 9. Live data (read only, 2026-11-23)

| Store | Rows |
|---|---|
| `concept` | 22: graine 21 (18 petite, 3 recherche), pousse 1 (statut en_cours), mûre 0 |
| `journal_entry_link` → idea | 39 (9 validated) |
| `note_line` on an idea / proposals | 0 / 0 |
| `document` on an idea | 0 |
| `voice_note` with `concept_id` | 3; `inspiration_photo` 0 |
| `journal_entry_label` | live, 0 rows yet (labels include `idea`, `research`) |

Found while reading: `concept` has one policy, `is_team()` for every command — any team member can edit or delete an idea straight from the browser; the admin check lives only in the server actions (commandments 1, 2). The SQL of this design keeps writing open to the team, through the doors, and makes deleting an idea Pem's alone (Pem 2026-11-23: « everybody can write ideas, but nobody can delete my ideas »).

## 10. Build order (after approval)

1. SQL (its own OK, proven on the throwaway copy in one run): `concept.parent_id` + loop guard, `concept.created_by` (today's 22 set to Pem), `concept_change` + trigger, `idea_plant` / `idea_set_stage` / `idea_set_parent`, `idea_fil` / `idea_signals` / `idea_list` reads, `concept` rules redrawn (team writes through the doors, stage by author + Pem, delete Pem only).
2. Every writer of §6 moved to the doors.
3. The desk page and the redrawn list, phone and desk, from the mockup; screenshots at 1280 / 375 beside the mockup before landing.
4. Journal side: « En faire une idée », the target chip, `#` ideas, the day lines from `concept_change`.
