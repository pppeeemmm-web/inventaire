# Agent state — read first, update last

Owner 2026-11-27: « the repository must remember everything to ensure continuity and pace ». Every session in Claude's
roles (`ROLE.md`) **reads this file first** and **updates it before ending** (what changed, what is next), and adds
the day's decisions to `LOG.md`. Nothing here overrides `CLAUDE.md`; the rule on reaching outside (`ROLE.md`, Hard
Rules) holds for every line below.

Last updated: 2026-11-28 evening (cloud session, Pem in Madrid).

## Where things stand
- **Roles:** data system strategist · art business developer / agent · R&D advisor for the PEM Hub — `ROLE.md`
  (merged #6, #7).
- **Trial (30 days, 2026-11-27 → 2026-12-27), judged by Pem on results:**
  1. Week 1 — data-quality report (read only) + Documents d'Artistes PACA: what it takes to be in it, dossier draft.
  2. Week 2 — drawing plan: 5 priority venues (Saison du dessin / galleries doing Paréidolie), 10–15 drawings selected
     from the catalogue, draft messages (nothing sent).
  3. Week 3 — R&D note: capture in the field (pause / screen-off recording via Voice Memos, offline), cost + small proof.
  4. Week 4 — Pem's review: what was used, what it cost (time, tokens).
- **Calendar of deadlines:** [`CALENDAR.md`](./CALENDAR.md) — SIRET decision (31 Dec), Paréidolie via a gallery, DRAC AIC, CoG 2027, Montrouge 2028, Arts at CERN, Récits de Paysages, Saison du dessin. **All also in the Pipeline with reminders** (6 entries entered 27/11 with Pem's OK).
- **Pem's artistic line (27/11):** « Expansion de la rêverie (Bachelard) dans et depuis la fabrique d'images. Rêver le monde et vivre le monde rêvé. » — the thread for statements and dossiers.
- **Active cases:** [`cases/2027_drac.md`](./cases/2027_drac.md) · [`cases/2027_pareidolie.md`](./cases/2027_pareidolie.md) · [`cases/2027_therapeia.md`](./cases/2027_therapeia.md) (dossier drafts ready for Pem; email leaves only on written OK).
- **Series that speak (data 27/11):** ἀβαρής « abarés » 205 drawings, strephó 124, Oikeios 63, Purinos 6; selections « Montrouge » 36, « CoG 26 » 8. Gap: 2025 drawings — 4 of 98 have dimensions.
- **Series meanings (Greek New Testament words with Strong's numbers) and which application each serves:** [`SERIES.md`](./SERIES.md). Meanings are in each theme's notes in the Hub.
- **Lead lists (sources + date inside):** [`leads/2026-11-27_art-worlds-sud.csv`](./leads/2026-11-27_art-worlds-sud.csv)
  (54 curated, 49 verified) · [`leads/2026-11-27_pac-members.csv`](./leads/2026-11-27_pac-members.csv) (70 PAC venues,
  19 in « Saison du dessin 2026 »). Import into Contacts: waits for Pem's GO.

- **Laboratoire (28/11):** a field in the Hub (idea « Laboratoire », artistic, research) to extract ordered knowledge
  — conjectures, goals, praxis — into a book (English, French alongside; order of the treatises: Cennini, Pacheco,
  Mayer, Doerner). Two conjectures in: « Oil: refractive index and saturation » and « Temperone (Kremer) —
  Tintoretto's way? » (Kremer sheet filed, Thyssen visit 26/11). Designs: [`Laboratoire.md`](../design/2026-11-28/Laboratoire.md),
  [`Equipment.md`](../design/2026-11-28/Equipment.md); research copies in [`research/`](./research/).

## What the data say (keep, re-check monthly)
- Catalogue ≈ 1 180 works; ≈ 70 % on paper (Crayons 251, Graphite 62, Pierre noire 49, Encre noire 75, Pastel 41…),
  Huile 333 — lead with drawing, then oil.
- Contacts: few art-world cards (4 galleries / gallerists, 5 institutions, 1 collector, 1 adviser).
- **No selling or promotion yet (Pem 27/11):** Pem has never tried to sell or promote — no sales, campaigns or CRM
  strategy exist, so the sales side (payments, invoices, shipments, orders) is empty by design, not a data gap. `moment`: empty.
- **The word « collection »** (Pem 27/11: « we don't use the term collection »): in the system it only means a
  collector's private page (`/collection/[id]`) and the groups of the public site (`/works`). Series and dossier
  selections are both kept as themes (« Selection: Oikeios », « Montrouge », « CoG 26 »): one label doing two jobs.
  A dossier selection's home is the working group of its Pipeline entry. To discuss with Pem.
  Loans / consignments / exhibition checklists (`event_work`): 0. Pipeline: 5 processes, 24 steps, 11 reminders.
- `nodes.created_at` holds real creation days for works (usable for « added on »).

## Open threads (detail in `docs/TODO.md` and the design notes)
- « Œuvres ajoutées » SQL (not applied; throwaway copy first) — `docs/design/2026-11-26/WorksAddedMoments.md`.
- Provenance box (parked on 5 rules; Maroselli #2410–#2412 wait here) — `docs/design/2026-11-27/ProvenanceInput.md`.
- « c. » everywhere + its tracking count · virtual moments view · `@name` → proposed card · (recorder pause / Voice Memos: built).
- Waiting on Pem: Supabase redirect tidy · one Lightroom export (darker image).

## How we work (learned 2026-11-26/27)
- Work Pem does not watch: branch → draft PR (CI) → Vercel preview (live database) → Pem tries → merge (Pem, or
  Claude when Pem says « merge when green »). `x-build-sha` proves a deploy; docs-only merges may not redeploy.
- SQL prompts (found 28/11 in the session log): the hook ran and said « allow » every time; the prompt came from
  the claude.ai Supabase connector's own tool permission (`mcpServerPolicy`), which overrides the hook — « fresh
  session » was a wrong fix. Pem set `execute_sql` to always allow in the connector 28/11 (not yet in effect in the
  session that changed it; the next session's first read proves it or not). The hook now answers « ask » for
  anything not proven read-only, so writes still ask.
  **Not proven (28/11, later session):** the first read (`information_schema.columns`, `kaizen_item`) was still
  refused — log `toolDenialKind: permission-rule`, no `mcpServerPolicy`. The connector first loaded under an id
  name (`mcp__45c2b1ae…__execute_sql`), which the hook matcher `mcp__.*[Ss]upabase.*__execute_sql` misses — the hook
  never ran; it later reconnected as `mcp__Supabase__…` (matched). Docker works in the cloud container: the review
  tool's step 1 SQL can be proved on a throwaway copy there before any live read. Kremer's and the Prado's sites sit behind Cloudflare: Pem drops the PDF instead.
- Live SQL is always rebuilt from the live body (md5 guard), never from the repo copy: twice on 27–28/11 the repo
  copy was older (oeuvre_history lacked « Volée », save_contact differed).
- The Journal never edits or deletes: a day move = `journal_move_entry`'s writes; a change = a correction entry.
- Cloud environment « Research (Prado collection) » allows: `www.thepemworkshop.com`, `p-a-c.fr`, `botoxs.fr` (did not
  answer), `www.museodelprado.es` (blocked by Cloudflare). Supabase Auth accepts preview logins
  (`https://inventaire-git-*-pppeeemmm-webs-projects.vercel.app/**`).

## Next actions (in order)
- **Branch `claude/awesome-keller-jgcusv` (2026-11-28 eve), pushed, NOT merged, draft PR #14:** review window
  « ⚑ Revue » (Kaizen « App », proposé → ouvert → à vérifier → confirmé), phone pattern on Coffre / Rapports /
  Fiscal « par année » / Audit / Contacts, « Dire » → « Envoyer au PC » (Ollama), Laboratoire screens (tree, recipe
  card, « Essai »). Its SQL is **live** (« Apply sql »: kaizen_review_tool, ai_job_equipment, laboratoire_essai_label).
  Next: Vercel preview of PR #14 → Pem tries on desk + phone → Pem merges. None of the screens was opened in a
  browser (no login in the cloud); the 375 px phone guard was not run — its PENDING tabs (reports, vault, contacts,
  fiscal) should now pass and turn the run red until removed from PENDING. `gen:types` not run.
- **Done on Pem's « go » (28/11):** session start in Node (`.claude/hooks/session-start.mjs`: lists every
  unmerged `origin` branch and the docs it touches); SQL guard allows catalog reads (`pg_get_expr`, `has_*_privilege`
  …); read-only Supabase tools allowed in `.claude/settings.json`; project id in `supabase/CLAUDE.md`. **Still true:**
  `pwsh` is missing in cloud sessions, so the commit / push / agent guards (`.ps1`) do not run there — port to Node
  (parked, its own GO). If a read still prompts, the claude.ai Supabase connector's own setting is the cause.
- Then batch C — the system overview + data-quality report (read only).
- PR #12 (batches A / B, phone pattern, Laboratoire + equipment SQL, Équipement, one Stock door, place rules, the
  Atelier voice import) merged at Pem's « Finish merge and close session »; all its SQL was applied live before.
  `gen:types` not run in the cloud (no token): the equipment / lab columns are read through a loose client.
- Pem's word needed: delete Journal #53 / #54 by switching off the no-delete guard, or keep them hidden.
- Doerner's own rye-flour recipe: not found online yet (his tempera chapter, 1934 English edition).
0. **Pem: SIRET decision by 31 Dec** (no SIRET → no DRAC AIC 2027). Session reminder 1 Dec, Pipeline reminder 15 Dec.
0b. **Pem (Therapeia, open since 27/11):** title ὄναρ / ὕπαρ or « Paxos, l'île rêvée » · Reel length (22 s planned) ·
   shoot the six shots of `video/2026-11-27_onar-upar.md` · (Pipeline dated + reminder 15/12 + contact #975: done 27/11) · verify Journal #57 · merge PR #9.
1. Claude: one selection for Therapeia + Paréidolie proposed 27/11 → [`selections/2027_therapeia-pareidolie.md`](./selections/2027_therapeia-pareidolie.md) (Pem chooses; years missing on 11 of 15). Gallery shortlist by 20 Dec.
2. Claude: week-1 **system overview** (every table: what it holds, used / empty and why) + data-quality report on it; Documents d'Artistes PACA requirements + dossier draft.
3. Claude: shortlist of galleries for Paréidolie 2027 + drawing selection (case file).
