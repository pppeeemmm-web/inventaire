# Exhibitions → « Expositions & événements » (R6): design brief, 2026-11-17 (v2)

Design only, nothing built, no SQL run (reads only). Inputs: TODO R6 (Pem 2026-11-15), [RETHINK](../../RETHINK_2026-11-14.md) (« What makes an event »), [WORK_CUSTODY_MODEL](../../WORK_CUSTODY_MODEL.md), [STRATEGY](../../STRATEGY.md), and **R7 orders** — [`R7_Orders.notes.md`](./R7_Orders.notes.md) **v2** (Pem's answers; the v2 file is in the R7 worktree until the lead lands it). Mockup next to this file: [R6_Events.mockup.html](./R6_Events.mockup.html) (desktop + two 375 px phones).

## v2 — Pem's answers (2026-11-17). Where they differ from v1 below, this section wins.

- **Name: « Expositions & événements » / « Exhibitions & events »** (Q1, Pem: « Yes »). It keeps the word used most in front. Where space is short (narrow sidebar, phone title) the label is « Expositions ».
- **An open studio is an event** (Q2): works are involved even when they do not move. So an event's selection may hold works that **never leave**: they show « Studio · montrée sur place », with no order. An event whose place is Pem's own studio needs no order at all. No extra kind: it is an Exposition (or Collaboration) whose place is the studio; Pipeline « visite d'atelier » stays for visits without a show.
- **The selection is a work group** (Q3, Pem: « They are supposed to be that way »). One link from `working_group` to its event; « Montrouge restreinte », « carte sete », « Dunamis » can each become an event's selection as they are.
- **The other party: offer them all** (Q4). An event keeps **its people with a role** — lieu, commissaire, organisateur, galerie, partenaire, imprimeur… (any contact, several per event, role chosen from a list or typed). « Créer la commande » offers all of them as the order's other party, the venue first. Today `suivi_process` has one `contact_id` and a free-text `stakeholders` (filled on 1 of 6 rows) — so this needs a small list (e.g. `event_contact`: event, contact, role), own OK.
- **Editions: a fifth order kind « Confié »** (Q5–6). Pem: the work goes out « for a calibration, say » (to the printer, the photographer) and there must be a process to know **where it is** until it returns. So **not** a Prêt with a purpose: a new R7 kind **Confié / Entrusted** (order chip `C`, refs `C-2026-001`; the Collaboration event chip becomes `Co` so the two never mix): Brouillon → Signé → Sorti (chez l'artisan) → Rentré. Owner stays Pem, custodian = the craftsman (printer, photographer, framer, restorer), paper « Bon de confiage ». Not only for editions: framing, restoration and photography use it too. **This changes R7** (its kind list and status check, the custody check, which status a work shows while out — see « Needs a GO ») — hand-over note left for the R7 session.
- **One catalogue entry per edition** (Q7, Pem: one per print « would mean too many entries that don't reflect reality »). Run « 30 + 5 EA », copy numbers on order lines. Built when the first real edition comes (none in the data).
- **Collaborations are blurry, and the screen must let the blur be recorded** (Q8). So nothing is forced: a collaboration's people have free roles (above); each work in its selection has an optional free **relation** (« faite ensemble », « prêtée », « montrée », « en réponse à… », or typed); a work may carry a free **authorship note** (« avec Artiste B ») that shows on its card and its history. Ownership rules do not change: Pem stays the owner unless an order says otherwise.
- **Past events fill the About « Expositions » list** (Q9, Pem: « Excellent… a way to select them afterwards »). Every ended event gets a « sur le site » switch (off by default); the About block shows the switched-on events (year, title, venue) **plus** the rows typed by hand today, for shows from before the app. Choosing happens in the site editor's Expositions block, at display time.
- **Build after R7** (Q12, Pem: « Pipeline is quite important to make sure data doesn't get lost … after R7 »). Agreed: R7 first, including its entry points (step 4: Pipeline and Exhibitions link to orders instead of making them) and the « Confié » kind; then R6. R6 also adds Pipeline « Créer l'événement » on a won process, so an accepted application never loses its trail.
- ~~Still open: Q10, Q11~~ → answered in round 2 below. The work card « Expositions » list (Q9, first half) is taken as yes.

### Round 2 (Pem, 2026-11-17)

- Confirmed as written: open studio = event, works « montrées sur place », no order · the event's people with roles, all offered as the order's other party · collaborations recorded with their blur · the « sur le site » switch for the About list.
- **« Créer une sélection » from the event.** The Œuvres section gets two actions: **« Créer la sélection »** — makes a new work group named after the event (« Dunamis — Galerie X 2026 »), filled from the current Inventory selection or a search, already linked to the event — and **« Lier un groupe existant »** (pick « Montrouge restreinte », « carte sete »…). An event has one selection; changing it later edits that group.
- **« Confié » fixes a bigger problem** (Pem: « we can fix a bigger problem then by doing that »): today nothing says where a work is while it is at the framer, the photographer, the restorer or the printer. One order kind answers that everywhere — from the work card (« Confier… »), not only from an edition. It belongs to R7 (hand-over note left for the R7 session).
- **Q10, prep per work — suggestion (Pem: « make suggestions »).** Three moments, six default columns, each column switchable per event, defaults set by kind:

  | Moment | Column | What « done » means | Comes from |
  |---|---|---|---|
  | Before | **Présentation** | framed / mounted / hanging system ready | ticks `Oeuvres.Encadree` when « framed » |
  | Before | **Cartel** | label text checked (title, year, technique, size, price or « collection particulière ») | generated from the work; one tick = « printed » |
  | Before | **Constat ↗** | condition report out, with photos | the existing condition-report capture |
  | At the venue | **Accrochée** | hung / installed | phone tick |
  | At the venue | **Photo** | installation photo taken | a trace attached to the event |
  | After | **Constat ↙** | condition report back, compared with ↗ | condition-report capture |

  Off by default, switchable: **Emballage** (crate / packing), **Assurance** (value agreed — the column is already in the table), **Prix affiché**. Defaults by kind: Exposition = the six; Collaboration = Présentation · Cartel · Photo; Open studio = Présentation · Cartel · Photo (no constats: nothing leaves); Lancement d'édition = Constat ↗ · Constat ↙ (the Confié order carries the rest, e.g. « numérisée », « BAT validé » as event steps).
- **Q11, the phone at the venue — suggestion (Pem: « make suggestions »).** Four moments, one event screen with the works as 64 px rows:
  1. **Arrivée** — the list is the packing list: tick each work as unpacked; « Constat » opens the condition-report capture (photo of the work, issue photos). When all are checked, one sticky button: the order's next step « Marquer sorties — n œuvres » (if not already done at departure).
  2. **Accrochage** — tick « Accrochée »; « Photo » adds an installation photo to the event's traces (via the share sheet, like other phone images; a quick snapshot is a trace, not a diffusion image).
  3. **Pendant** — a **« Fiche de salle »** view: each work with title, year, technique, size, price and « disponible / vendue / réservée » — what you need when a visitor asks; a buyer's interest or a voice note recorded from the R2 input bar lands **linked to the event** (and to the work if one is open).
  4. **Décrochage** — tick « Décrochée », « Constat ↙ » (the phone shows the departure photos next to the camera to compare), then one button « Marquer rentrées — n œuvres » closes the lines on the order. A sold work shows « vendue — reste chez X » and is skipped.
  Creating an event or an order stays on the desktop.

**Pem 2026-11-17 on Q10 and Q11: « We'll go with that for now, until I see what it looks like. »** Both suggestions stand as the v1 to build; revisit once seen on screen. Drawn in the mockup's « Round 2 » part: a new event with no selection yet (« Créer la sélection » / « Lier un groupe existant »), the prep-column switches + defaults by kind, and phones 3–5 (Arrivée, Accrochage, Fiche de salle; phone 2 is Décrochage).

### Speed of the tab (Pem: « kind of clunky … there could be improvement »)

This is about **today's Exhibitions tab** (the code live on `main`), not the new design.

Read in the code (not yet measured — a build starts by measuring, per STRATEGY / usage-driven priorities), _verified against live code 2026-11-17_:

6. **Every keystroke in « Éditer » is a server call and a full reload.** The info inputs call `onUpdate` on each `onChange` ([`ExhibitionDetail.tsx`](../../../components/atelier/exhibitions/ExhibitionDetail.tsx) lines 193–249) → `updateExhibitionProcess` (server action) → `setSelected({...})` → `load` is a `useCallback` on `[selected, deepLinkId]` ([`Exhibitions.tsx`](../../../app/atelier/(portal)/exhibitions/_components/Exhibitions.tsx) lines 70–84), so the effect **re-fetches every exhibition and every step** after each change — and again on every click in the list.
7. **One step toggle rewrites every step, one after another.** `updateExhibitionProcess` loops over all steps with an awaited `insert` / `update` each ([`actions.ts`](../../../app/atelier/(portal)/exhibitions/actions.ts) lines 338–346): ticking 1 of 11 steps = 11 sequential round trips.
8. **Works come from the Atelier shell's loaded batch** (`oeuvres` prop; the shell loads the first keyset chunk, then the rest after paint): the « Œuvres » tab and the floor plan filter that array, so a work not yet loaded is missing, and the whole array is re-filtered on each render.

**How the new tab avoids it (part of the R6 build, not a separate layer):** edits kept locally and saved on blur / a short pause, one field patch per save, no list re-fetch after a save or a click (update the one row in place); a step tick = one `update` of that step; the list loads names, dates and counts only, the event loads its own selection and order lines by id (independent of the shell batch); folded sections (plan, traces, commandes) load when opened; the floor plan's canvas mounts only when its section opens. First step of the build: time today's tab (open, select, tick a step, type a field) so the gain is shown, not assumed. Fixes 6–7 are small enough for a bug batch before R6 if the clunk bothers now — own GO.

## The problem, in Pem's words

- « Exhibitions / events »: **collaborations** live there too; **editions** (prints, books… issued from a series) are « an in-between state — taken out of the inventory, then back » (2026-11-15).
- « What makes an event »: it is about **works**. An exhibition, essentially; launching a series of prints is one too (it creates the prints). What they share: **a selection of works recorded as a group**, tracked — where each work goes, when it comes back — and **what has to be prepared** around it. Without works it is not an event: PR and books / publications stay in **Pipeline**.
- Settled 2026-11-15: the tab holds what is **accepted + involves works**; applications (residencies, salons, prizes) stay in Pipeline; a residency's final show is its own event, linked back; ended events stay as history (« tracking, tracking, more tracking »).
- New since R7 (2026-11-17): **every movement of a work is an order** (sale, deposit, loan, gift), drafts first, works move at « signé / sorti ».

## What the screen is for (inputs → outputs)

**One place where a group of works is gathered for something outside the studio, sent, shown, and brought back — with everything that has to be ready around it.**

- **Inputs:** the event itself (kind, name, place = a contact + its address, dates, where it came from in Pipeline) · **the selection** of works · **the orders** that take them out (a loan to the venue, a deposit if the show sells, a loan to the printer for an edition) · **what to prepare** (dated steps, and per work: label, frame, condition report out and back, insurance value) · traces after (installation photos, press, invitation).
- **Outputs:** each work's **whereabouts** right now (in the studio / out on order X / back / sold during the show) · the R7 **orders and their papers** (the event never makes a paper itself) · a **prep list** with dates in the calendar (existing export) · a line in each work's history « exposée à X, dates » — **exhibition history = provenance** (STRATEGY aims 3–4) · past events as history, and optionally the public About « Expositions » list (question 9).

It is a **tracking** screen, not a planning tool for applications: applying, waiting and losing stay in Pipeline.

## Measured (live DB, read-only, 2026-11-17)

| What | Count |
|---|---|
| Pipeline processes (`suivi_process`), all types | **6**: salon « perdu » (1), résidence « perdu » (1) + « en cours » (1), correspondance « gagné » (1), autre (2) |
| …of type `exposition` — the only type the Exhibitions tab lists (`EXHIBITION_LIST_TYPES`) | **0** → **the tab is empty today** |
| …of type `collaboration` or `livre` | 0 |
| Processes linked to an exhibition (`exhibition_process_id`) | 0 |
| Floor plans (`exhibition_layout`) | 3 — **none linked to an exhibition**, **0 works placed** in any; 2 with a plan image (Sept. 2026), 1 « Morphology Exhibit… » without (12 Nov.) |
| Work groups (`working_group`) | 5 — « 1411. δύναμις (dunamis) » 33 works, « Montroupge restreinte » 18, « Liquid » 10, « carte sete » 8, « Groupe du 26/04/2026 » 1 |
| `work_order` (R7, live since today) | 7 gift orders (reconstituted) + 4 test orders from the R7 line test (P-2026-001 cancelled, D-2026-001 closed, V-2026-001 delivered, P-2026-002 signed) — **none linked to an event** (`process_id` empty) |
| Old `sale_order` / `consignment_order` | 0 / 0 |
| Works in « Consigné » / « Prêt » | 0 / 0 |
| **Editions** — no table, no field; technique « Gravure » | **0 works**; 1 work on support « Gravure/Photo offset »; no print run anywhere |

So: **no exhibition, collaboration or edition has ever been tracked in the app**. The working groups are the only real trace of « works gathered for an event » (Montrouge, Sète, Dunamis). Like R7, the design aims to be small and ready for the first real case (STRATEGY: commercial tools get effort when a case comes).

## Today's map

_Verified against live code 2026-11-17_ (worktree HEAD `fb702c6`, on `origin/main`).

| Piece | Where | What it does |
|---|---|---|
| Tab | Studio group, `exhibitions` → `/atelier/exhibitions` ([`Exhibitions.tsx`](../../../app/atelier/(portal)/exhibitions/_components/Exhibitions.tsx)); deep link `?exhibition=<id>` | List left ([`ExhibitionsListPanel.tsx`](../../../components/atelier/exhibitions/ExhibitionsListPanel.tsx)), detail right ([`ExhibitionDetail.tsx`](../../../components/atelier/exhibitions/ExhibitionDetail.tsx)) |
| An exhibition | a Pipeline row: `suivi_process` with `type = 'exposition'`, statut not `perdu` / `annule` ([`actions.ts`](../../../app/atelier/(portal)/exhibitions/actions.ts) `listExhibitionsWithSteps`) | name, type, statut, dates, contact (the venue), place text, URL, notes |
| « Vue d'ensemble » | detail sub-tab | steps (`suivi_etape`: add, rename, toggle, delete) + info fields (edit mode) |
| « Calendrier » | sub-tab | start, steps by deadline, end; export to Google / Microsoft calendar ([`CalendarExportStrip.tsx`](../../../components/atelier/exhibitions/CalendarExportStrip.tsx)) |
| « Œuvres (n) » | sub-tab | **works whose custodian (`LocalisationID`) = the venue contact**; with an Inventory selection: kind select Prêt / Dépôt + « Envoyer » → `sendWorksToExhibition` → **old** `createConsignmentOrder` (works move at once, no draft) |
| « Plan » | sub-tab | floor plan tool ([`FloorPlanTool.tsx`](../../../components/atelier/exhibitions/FloorPlanTool.tsx)): `exhibition_layout` (walls, placements, plan image), works picked from « exposables » or a **work group** (« groups gather the works for an event », Pem 2026-11-15) |
| Pipeline link | [`PipelineProcessModal.tsx`](../../../components/atelier/pipeline/PipelineProcessModal.tsx) creates an exhibition from a process and sets `exhibition_process_id`; the drawer shows the link | the « residency → its show » link exists, used 0 times |
| Graph | view `exhibition` over `suivi_process` type `exposition` (Constellation node type) | — |
| Public site | About block « Expositions » ([`lib/site-blocks/expositions`](../../../lib/site-blocks/expositions/index.tsx)): rows typed by hand (year, title, venue) | not linked to the tab |
| R7 | `work_order.process_id` (uuid) exists — an order can point to any `suivi_process` | no screen sets it yet |

### Things found while reading (not fixed — each needs a GO)

1. **Two status vocabularies.** A new exhibition is created `prevue`; the header select offers « À confirmer / Prévue / En cours / Passée »; the list filter and footer count `en_cours / gagne / termine`; Pipeline knows `en_cours / gagne / perdu / annule / termine`. So a new exhibition shows only under « Tous » and in no footer count, and « Passée » / « À confirmer » mean nothing to Pipeline.
2. **« Œuvres » is not the exhibition's works.** It lists every work held by the venue's contact: two shows at the same venue share one list, a work deposited there for another reason shows up, and a work that came back **disappears** — no history of what was shown.
3. **« Envoyer » uses the old order path** (moves works at once, no draft, old tables) — already in R7 build step 4.
4. **Floor plans float:** the tool lists every unlinked layout as a candidate for any exhibition; the 3 existing ones are linked to none.
5. **Hard-coded French** in `ExhibitionDetail.tsx` / `exhibitions-types.ts` (« Étapes », « + Ajouter », « Infos », « Type / Lieu / Début / Fin », « Du … au … », « étapes », the double-click hint, « ⚠ Non public », status labels, `fmtDate` fixed to `fr-FR`) — against the i18n rule.

## The proposal

### One tab: « Événements / Events » (Studio group, where Exhibitions is)

It lists every **accepted** thing that gathers works — three kinds, one look:

| Kind | Chip | Example | Its orders (R7) | Specific block |
|---|---|---|---|---|
| **Exposition** (solo, group, fair accepted, a residency's final show) | `E` | « Dunamis », Galerie X | a **Prêt** to the venue (default); a **Dépôt** for the works the venue may sell | Plan d'accrochage |
| **Collaboration** (with an artist, a brand, an institution — when works are involved) | `C` | a performance, a set, a joint show | Prêt to the partner (or none, if the works stay here) | — |
| **Lancement d'édition** (a print series, a portfolio of prints) | `É` | « 1411 — tirages » | a **Prêt « pour édition »** to the printer / photographer (the source works go out and come back) | Édition: the run (see below) |

Without works, it stays in Pipeline (PR, book, application). A Pipeline process that is won and involves works gets « **Créer l'événement** » (the link `exhibition_process_id` is kept and shown both ways).

**The life of an event** (one vocabulary, replaces both, found issue 1): **À confirmer → Prévu → En cours → Terminé**. « En cours » starts when its first order goes out; « Terminé » when the end date is past **and** every work is back (or sold / given). An ended event stays forever as history.

### The event (desktop, mockup left)

- **Left: the list**, grouped « En cours » / « À venir » / « Passés » (passés folded), kind chip, name, place, dates, a small line « 6 œuvres · 4 sorties · retour 15 déc. ». Filter chips E · C · É.
- **Top strip, one line:** works out now (and with whom) · returns due in 14 days · prep items late · editions in progress.
- **Right: the event**, sections folded except the first two (house rule):
  1. **Header** — kind, name, place (the contact + **the address the works go to**, from R7), dates, status, « depuis Pipeline : … » link, calendar export.
  2. **Œuvres (the selection)** — the heart of it. A dense table, one row per work: thumb, #, title, **where it is** (Studio · Commande P-2026-003 « signée » · Sortie 1 oct. · Rentrée 16 déc. · Vendue V-2026-004), then the per-work prep as small ticks (**cartel · cadre · constat départ · constat retour · photo d'accrochage**), insurance value. Actions: « + Œuvres » (search, an Inventory selection, a work group), and **« Créer la commande »** for the ticked rows → the R7 form prefilled (kind Prêt, the venue, its address, the event dates, `process_id` = the event) → a **draft** in Pem's feed. Works move only when the order is signed / out (R7 rule).
  3. **À préparer** — the dated steps (today's `suivi_etape`), started from a **template per kind** (exposition: transport aller, constats départ, assurance clou-à-clou, cartels, accrochage, vernissage, photos d'accrochage, démontage, transport retour, constats retour) — editable, each with a date, in the calendar export.
  4. **Commandes** — the orders that point to this event (`work_order.process_id`): ref, kind chip, party, step dots; a click opens it in Commandes. The event never makes papers; the orders do.
  5. **Plan d'accrochage** (expositions) — today's floor plan tool, now fed by **this selection** and owned by this event (found issue 4).
  6. **Traces** — installation photos, invitation, press (Vault folder `Événements/<année> <nom>`), notes.

**What each work keeps:** a line in its history « Exposée — Dunamis, Galerie X, 1 oct.–15 déc. 2026 (P-2026-003) », and the work card gets an **« Expositions »** list read from the events it was part of. This is the exhibition history a gallery, a buyer or an estate asks for.

### Editions — an in-between state

Reading Pem's « taken out of the inventory, then back »: an edition has **two parts**.

1. **The source works go out and come back.** A painting or a set of drawings leaves the studio to be scanned / photographed / printed from, then returns. That is a custody move with no sale and a certain return — exactly R7's **Prêt** (« a loan always comes back »). **Proposal: no new order kind.** The Prêt gets a **purpose** — `exposition` (default) · `édition` · `prise de vue` · `encadrement` · `restauration` — and the paper changes with it: « Contrat de prêt » for a show, « **Bon de confiage** » for a printer / photographer / framer (works, purpose, dates, insurance value, « retour en l'état »; no credit line, no public display). While out, the work's card reads « Prêt · chez <printer> · pour édition ». (Alternative, question 6: a fifth kind « Confié » for any craftsman; I think a purpose on Prêt is enough.)
2. **The edition itself** — the prints it produces. Proposal: **one catalogue entry per edition**, not one per print: title, source work(s) or series, technique, size, **tirage N + EA / HC**, printer, date, price per copy. It sits in the catalogue like a work (so Inventory, the site, Constellation see it), marked « Édition ». Copies leave through R7 orders like any work, with a **copy number** on the order line (« 3/30 »); the edition shows « 30 · 7 vendus · 2 offerts · 21 au studio ». Single statuses (« Vendu ») do not fit a multiple, so an edition stays « Disponible » until its last copy goes.

A **Lancement d'édition** event holds both: the source works (selection + their Prêt « pour édition ») and the edition it produces (a block « Édition » with the run). A book stays in Pipeline (Pem); if works go out to be photographed for it, that is a Prêt « prise de vue » linked to the Pipeline process (`work_order.process_id` takes any process).

**When:** nothing in the data is an edition today. Proposal: build part 1 (the purpose on Prêt) with the events, and part 2 (the edition entry + copy numbers) **when the first real edition comes** (question 7).

### Phone (375 px) — at the venue

The phone is the field tool, so it does what happens **while hanging or taking down a show**:
- **Événements:** cards of events « en cours » and « à venir », each with « 4/6 sorties · retour 15 déc. ».
- **The event:** the works as 64 px rows with their state and **big prep ticks** (accrochée · constat · photo); « constat » opens the existing condition-report capture (photo of the work, issue photos); the **sticky button** is the order's next step for the whole group (« Marquer sortis — 6 œuvres », later « Rentrés »), safe-area padding. Prep steps of the day below.
- Creating an event or an order stays on the desktop (R7 phone question still open: how papers are sent).

### What happens to today's pieces

| Today | Proposal |
|---|---|
| Tab « Expositions » (Studio) | « Événements » in the same place, three kinds |
| `suivi_process` type `exposition` | stays the event's row (no new table): types `exposition`, `collaboration`, `edition` listed; status words unified (found issue 1) |
| « Œuvres » = works held by the venue | the event's **selection** + where each one is, from its order lines (found issue 2) |
| « Envoyer » Prêt / Dépôt | « Créer la commande » → R7 draft linked to the event (found issue 3) |
| Floor plan (layouts float) | owned by the event, fed by its selection (found issue 4) |
| Work groups (« Montrouge », « Sète »…) | stay; an event's selection **is** a work group linked to it (question 3), so Inventory filters, the floor plan and Constellation keep working |
| Pipeline « exhibition » link | « Créer l'événement » on a won process; link shown both ways |
| About « Expositions » block (typed rows) | optionally filled from past events (question 9) |
| Graph node `exhibition` | widened to the three kinds |

### Field map — today → new place

| Today (table · field, or screen) | New place |
|---|---|
| `suivi_process.nom`, `type`, `date_debut`, `date_fin`, `url`, `notes` | Event header (type → kind E / C / É) |
| `suivi_process.statut` (`prevue`, `a_confirmer`, `en_cours`, `passee`, `gagne`, `termine`) | Event status À confirmer · Prévu · En cours · Terminé (one list) |
| `suivi_process.contact_id` (the venue) + `localisation` (free text) | Place = contact + **its address** (R7 `address_id` on the order; the event keeps the contact) |
| `suivi_process.exhibition_process_id` | « depuis Pipeline » link (both ways) |
| `suivi_etape` (nom, statut, date_echeance, position, notes) | À préparer (+ templates per kind) |
| works with `LocalisationID` = venue (computed) | Œuvres → the selection (`working_group` + `working_group_work`, linked to the event) |
| `sendWorksToExhibition` kind loan / consignment | Œuvres → « Créer la commande » (R7 `work_order`, `process_id` = event) |
| `work_order.process_id`, `work_order_work.line_status`, `start_date` / `end_date` | Œuvres → « where it is »; Commandes section; return dates |
| `work_order_work.insurance_value` | Œuvres → insurance value column |
| constat (condition report) photos | Œuvres → constat départ / retour ticks (phone capture) |
| `Oeuvres.Encadree`, `NeedsPhotograph` | Œuvres → prep ticks « cadre », « photo » (read; cartel and accrochée are new per-event ticks) |
| `exhibition_layout` (walls, placements, floorplan, `process_id`) | Plan d'accrochage, owned by the event |
| `calendar_event_link` / CalendarExportStrip | Header → calendar export (dates + prep steps) |
| — | Prêt **purpose** (`exposition` / `édition` / `prise de vue` / `encadrement` / `restauration`) — new, on `work_order` |
| — | Édition entry: run N + EA / HC, printer, price per copy; copy number on the order line — new, later |
| — | Work history line + work card « Expositions » list — new (read from events) |
| About block « Expositions » rows | optionally generated from past events |

## Open questions (for Pem)

1. **The name.** « Événements / Events », or « Expositions & événements » so the word you use most stays visible?
2. **The kinds.** Exposition · Collaboration · Lancement d'édition — enough? An **open studio** shows works without moving them: an event (a selection, prep, history) or Pipeline (« visite d'atelier »)?
3. **The selection is a work group.** Reuse `working_group` (one link to the event), so « Montrouge restreinte » or « Dunamis » can become an event's selection as they are? Or a separate list per event?
4. **Several orders per event.** A Prêt to the venue by default, plus a Dépôt for works the venue may sell (and a Vente when one sells) — right? Who is the other party in a group show: the venue, or the curator / organiser?
5. **Editions, your sentence.** Is « taken out of the inventory, then back » the **source works going to the printer / photographer and returning** (my reading), or something else — e.g. works held back from sale while an edition is made?
6. **Editions, the order.** Source works going to a printer: a **Prêt with purpose « édition »** (paper « Bon de confiage ») — or a fifth kind « Confié » (printer, framer, restorer, photographer)?
7. **Editions, the prints.** One catalogue entry per edition with its run (« 30 + 5 EA ») and copy numbers on orders — or each print its own work? And: build that now, or when the first real edition comes (none today)?
8. **Collaborations.** What moves in a collaboration — your works lent to the partner? Is a work made **together** (shared authorship / ownership) a case you have, or out of scope?
9. **History.** Each work gets « Exposée — …» in its history and an « Expositions » list on its card — yes? And should the public About « Expositions » list be filled from past events (you'd still choose which show), instead of typed by hand?
10. **Prep per work.** Cartel · cadre · constat départ · constat retour · photo d'accrochage — the right columns? Anything you always forget (transport crate, hanging system, insurance certificate)?
11. **Phone at the venue.** Ticking « accrochée », the condition-report photo, and one button « Marquer sortis / rentrés » for the whole group — is that what you do there?
12. **Order.** Build after R7's entry points (step 4: work card, Pipeline, Exhibitions link to orders), since an event's moves *are* orders? TODO says « R4 and R6 later ».

## Needs a GO before building

- Pem's GO on this design and the answers above.
- **v2 additions (each SQL its own OK):** in **R7** — kind `entrust` on `work_order` (status check: draft · signed · out · closed · cancelled; ref letter `C`), the custody check accepting a craftsman as custodian under an open Confié order, and **which status a work shows while confié** (keep « Disponible » with « chez <artisan> », or a new « Confié » stage — to decide with the R7 build); in **R6** — `event_contact` (event, contact, role), a free `relation` per work in the selection, a free authorship note on a work, an « on the site » switch per event read by the About « Expositions » block. `work_order.purpose` below is **dropped** (replaced by the Confié kind).
- **SQL (own OK, RLS + explicit `GRANT`, then `npm run gen:types`), small and additive:** a link from a work group to its event (e.g. `working_group.process_id`); ~~`work_order.purpose` (loan only)~~; per-event per-work prep ticks (e.g. `event_work_prep`: process, work, cartel / accrochée flags) or kept in the selection junction; status words unified on `suivi_process` (0 exhibition rows, so a cheap moment). **Later**, with the first edition: an edition entry (run, EA / HC, printer) + `work_order_work.copy_no`.
- R7 entry points first (orders created with `process_id`); then the tab (list, event, Œuvres table, prep templates, Commandes section), floor plan ownership, work card « Expositions », i18n of the old detail (found issue 5), rename FR + EN, What's new item.
- Each « found issue » fix is its own GO.

## Not in this brief

- Applications (prizes, residencies, salons, open calls), PR, books / publications — **Pipeline** (Pem 2026-11-15).
- The papers themselves (loan contract, bon de confiage text) — R7 « Papers per kind »; this brief only asks for the purpose.
- Works **coming in** (a collector lending a work back for a show) — R7 « later » (`work_order.direction`); a show with borrowed-back works will need it.
- Sales made at a show — they are R7 Ventes, shown in the event's Commandes section.
