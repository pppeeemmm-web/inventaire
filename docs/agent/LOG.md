# Agent log — decisions and sends, newest first

One line per decision or authorised send: date · what · who decided · where it lives. Sends outside (authorised in
writing by Pem) also become a moment in the Hub. Nothing in this file authorises anything by itself.

## 2026-11-28
- PR #14 merged on Pem's « Merge and go for all the rest » (`1f1f055`); then: design notes' « now » lines (`9bb461e`),
  photo-key rule proved on the throwaway copy (`d5687a9`, not live), week-1 data-quality report (read only).
- Pem on the PR #14 preview, phone (« All good », ~10:50 UTC): the floating ⚑ (`d963497`) and the phone builds of the
  day. Desk parts (⚑ window, Kaizen Approuver / Confirmer, recipe edit) not tried yet. Not merged.
- Evening, Pem « Build feedback tool and other designs as well in parallel »: review window, Laboratoire step 3,
  phone pattern on the other tabs, Ollama for « Dire » (choosing it = « GO Ollama ») built on
  `claude/awesome-keller-jgcusv`; the review tool's design branch (`claude/eloquent-johnson-zlbeqx`) merged into it
  first. Flow review found 11 gaps; fixed in `8dd747b` (approval held by the database, failed walks kept, no double add).
- SQL live on Pem's « Apply sql »: `kaizen_review_tool.sql`, `ai_job_equipment.sql`, `laboratoire_essai_label.sql`
  (each proved on a throwaway Postgres first; live re-read: 33/33 Kaizen items approved, trigger, kinds, label).
- Pem, angry: a fresh session must know everything from the start (the unmerged branch was missed) and SQL reads
  keep asking → fix proposed (Node session start listing unmerged branches; SQL guard + read-only Supabase tools);
  waits for GO.
- PR #11 merged (`c4a22b4`) on Pem's « Merge »: found work, contacts on the phone, themes refresh, voice pause +
  import, contact door + phone numbers, phone bar tap / hold.
- Live data on Pem's word: phone one-off + duplicates (« Apply phone », « Ok to delete duplicates »); countries for
  Eileen Dalton (IE), Eric Petr (FR), Pem's own (IE); the four « 0 » numbers deleted; Marie Vecchioli's broken home
  number dropped, her death recorded (June 2025), Mobile → Home and main; 14 labels corrected by type (« Go labels »).
- `found_work_history_line.sql` applied (« apply the found line ») — rebuilt from live first.
- Batch A applied (« Apply A »): `save_contact` private-card check, `append_contact_notes`. Batches A / B code on the
  next pull request (« Pr »).
- Laboratoire: field « Laboratoire » (name chosen by Pem over « Bricolage technique »), conjectures oil / refractive
  index and Temperone; Journal #61 (oil doc, AI, verified via correction #63), #62 (Thyssen, 26/11). Book in English.
  Designs Laboratoire + Equipment (« GO design », « Go design the equipment system »); Stock « Équipement » built.
- Pem: batch C (system overview) waits for a fresh session; Journal #53 / #54 « Delete them » — needs the guard
  switched off, asked.
- Phone pattern (« GO build », « Go build the others if ready »): shared pieces, Stock, Comptage, Fiscal; « Careful
  with the code make sure it stays tidy ».
- Laboratoire: only Pem writes (« Only me »); `laboratoire.sql` live (« apply lab »). Equipment: `equipment.sql` live
  (« apply equipment »); steps 3–4 built (« GO equipment 3-4 »): Équipement view, voice walk, every Stock save
  through the door.
- « Dire » sends nothing to an outside AI (admin guide: nothing leaves for an outside AI); Pem chose Ollama → design
  proposed (PC job queue), waits « GO Ollama ».
- « Ok and ok »: `equipment_place_rules.sql` live (door only takes studio-tree places, names ≤ 120, a place holding
  Stock lines is not archived). The three studios (Marseille, Tooreeney, Waterford) already exist: no place marked.
- Voice import missing on the Atelier phone bar (Pem) → fixed on « GO »; Pem stopped the flow review before it ran.
- PR #12 merged on « Finish merge and close session ».
- SQL prompts, real cause (session log): the claude.ai Supabase connector's tool permission overrides the repo
  hook's « allow »; Pem set `execute_sql` to always allow there; the hook now answers « ask » for anything not proven
  read-only (`174a296`). Not yet proven in a new session.
- Review tool answers (Pem): Chrome pop-out first, then phone; words + voice + screenshot + pointing; each report a
  Kaizen item read at session start; switch Bug → Kaizen « App » / Idée → today's Journal; loop open → to verify →
  confirmed; the team can report but everything waits for Pem's OK → `docs/design/2026-11-28/ReviewTool.md` (+ mockup).
  Build waits for Pem's GO on step 1 (SQL).
- SQL prompt fix **not proven** (later session): the first read was still refused (`permission-rule`, no
  `mcpServerPolicy`); the hook never ran — the connector loaded as `mcp__45c2b1ae…`, which its matcher misses.
  Pem stopped the session to restart fresh; nothing else changed → `STATE.md` (`393dd97`).

## 2026-11-27
- PR #10 merged (`34656a2`) on Pem's « All good for me to merge »: phone menu (Pipeline, Ventes), « Tous les champs » ↔ « ← Formulaire court », SQL hook fix. Notes #53 / #54: delete refused by the database (« journal_no_delete », the Journal keeps everything); they stay hidden — Pem to choose a « masqués » toggle or nothing.
- Work group « Sélection 2027 — Therapeia + Paréidolie (proposition) » created on live (15 works, attached to Pipeline « Therapeia ») at Pem's request.
- PR #9 merged (`4c48873`) on Pem's « Merge ».
- Pem: no selling or promotion ever tried → no sales, campaigns or CRM: empty by design, not a data gap; the data strategist keeps a complete overview of the system → `ROLE.md`, `STATE.md`. Pem noticed the term « collection » is not used → `STATE.md` (to discuss).
- One selection for Therapeia + Paréidolie proposed (15 drawings) → `selections/2027_therapeia-pareidolie.md` (Pem « Try one selection »); nothing entered.
- Pipeline « Therapeia » dated (film 10/12, dossier 15/12, submission 15/01), reminder 15/12, contact #975 named « Astrid — Therapeia Art Residency » (Pem « OK Therapeia »).
- Nightly check red (rule 8 on #2410–#2412) → rule 8 skips found works (nightly + Audit panel); trigger `found_work_end_kept.sql` tested on a throwaway Postgres (5/5) and applied on live (Pem « GO 1+2 », then « Apply + merge PR »). PR #9.
- Film « ὄναρ / ὕπαρ »: script + storyboard, a Reel and a short video (Pem); « do not post anything » → `video/2026-11-27_onar-upar.md`. Pem's Instagram: 120 followers, photos removed.
- Series meanings added to each application file (Therapeia, Paréidolie, DRAC, CoG, CERN) → `SERIES.md` (Pem « Add it to each relevant application process »).
- Live Hub, on Pem's request: theme « Nouveau: Dumanos » = δύναμις G1411 (Pem confirmed); its 33 works moved to « 1411. δύναμις (dunamis) », the empty theme deleted (Pem « Delete the empty theme »); Greek meanings written in the notes of 8 themes (3 with existing meanings left as they were).
- Live Hub, on Pem's request: Journal #56 (Homer ὄναρ / ὕπαρ) linked to the new idea « Rêverie — Bachelard »; Journal #57 (Greek New Testament summary, AI-written, « à vérifier ») and idea « Testament grec — séries au lexique de Strong » (pousse), both authored as Terena Gill (Pem).
- Therapeia: case opened, drafts (project « Paxos, l'île rêvée », motivation, email) for Pem; nothing sent. CoG = Denmark and/or Germany (Pem).
- Pipeline: 6 entries entered with Pem's OK (« Yes ») and reminder request — DRAC AIC 2027, Récits de Paysages 2027, Paréidolie 2027 — galerie, CoG 2027, Arts at CERN 2027, Salon de Montrouge 2028 (16 steps, 6 reminders).
- Pem: no SIRET; 2027 project = Bachelard's reverie into and from image making; galleries known by name only; no drawing series in mind.
- Correction: « cog » = Center of Gravity (CoG) Arts & Science residency, not COAL; Montrouge 2027 was applied for in April 2026 (interview June, not retained) — the call is not open now.
- Pem asked to be reminded of the CERN residency, « the cog » (COAL? to confirm) and Montrouge → `CALENDAR.md`; reminder set for 1 Dec (Montrouge).
- Roles set: data system strategist, art business developer / agent, R&D advisor (Pem) → `ROLE.md`, PR #6 #7.
- Hard Rule: nothing reaches outside without Pem's written authorisation for that exact action (Pem) → `CLAUDE.md`.
- Repository memory: `STATE.md` read first / updated last, this log (Pem: « remember everything »).
- Cases opened: DRAC 2027 and Paréidolie 2027 (Pem « Ok for drac and pareidolie ») → `cases/`.
- Lead lists made (research only, nothing sent): art worlds South (54) + PAC members (70) → `leads/`.
- Read-only SQL auto-approved by a hook (Pem) → PR #5.
- Provenance parked until 5 rules are clarified; « c. » for every date; imperfect data recorded as it is (Pem) →
  `docs/design/2026-11-27/ProvenanceInput.md`, TODO.
- Found-work flow decided: line « Retrouvée — œuvre oubliée, jamais cataloguée (année) », « Terminée ? » required,
  rule 2 kept (Pem) → `docs/design/2026-11-27/FoundWorkFlow.md`.
- #2410, #2411 set like #2412 on live (found, 1999, catalogued, photo to take; stamped as Pem's edit) at Pem's request.

## 2026-11-26
- PR #4 merged and live (`fcc52e3`): phone Journal shows writes / voice notes at once; « Ancienne — retrouvée »;
  inspiration photo feedback. Pem tried it on the preview.
- Rule: work Pem does not watch lands through a draft PR (Pem) → `CLAUDE.md`.
- One « Œuvres ajoutées » card per day; one-off since the Journal exists (Pem) → `WorksAddedMoments.md`.
