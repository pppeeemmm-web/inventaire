# Agent state — read first, update last

Owner 2026-11-27: « the repository must remember everything to ensure continuity and pace ». Every session in Claude's
roles (`ROLE.md`) **reads this file first** and **updates it before ending** (what changed, what is next), and adds
the day's decisions to `LOG.md`. Nothing here overrides `CLAUDE.md`; the rule on reaching outside (`ROLE.md`, Hard
Rules) holds for every line below.

Last updated: 2026-11-27 (cloud session, Pem in Madrid).

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

## What the data say (keep, re-check monthly)
- Catalogue ≈ 1 180 works; ≈ 70 % on paper (Crayons 251, Graphite 62, Pierre noire 49, Encre noire 75, Pastel 41…),
  Huile 333 — lead with drawing, then oil.
- Contacts: few art-world cards (4 galleries / gallerists, 5 institutions, 1 collector, 1 adviser).
- Sales side nearly empty of dates (payments, invoices, shipments: none dated; 1 signed order). `moment`: empty.
  Loans / consignments / exhibition checklists (`event_work`): 0. Pipeline: 5 processes, 24 steps, 11 reminders.
- `nodes.created_at` holds real creation days for works (usable for « added on »).

## Open threads (detail in `docs/TODO.md` and the design notes)
- Retrouvée flow (decided, to build) — `docs/design/2026-11-27/FoundWorkFlow.md`.
- « Œuvres ajoutées » SQL (not applied; throwaway copy first) — `docs/design/2026-11-26/WorksAddedMoments.md`.
- Provenance box (parked on 5 rules; Maroselli #2410–#2412 wait here) — `docs/design/2026-11-27/ProvenanceInput.md`.
- « c. » everywhere + its tracking count · virtual moments view · `@name` → proposed card · recorder pause / Voice Memos.
- Waiting on Pem: phone « Tous les champs » screenshot · Supabase redirect tidy · one Lightroom export (darker image).

## How we work (learned 2026-11-26/27)
- Work Pem does not watch: branch → draft PR (CI) → Vercel preview (live database) → Pem tries → merge (Pem, or
  Claude when Pem says « merge when green »). `x-build-sha` proves a deploy; docs-only merges may not redeploy.
- Read-only Supabase SQL runs without a prompt (`.claude/hooks/sql-readonly.mjs`); any write asks.
- Cloud environment « Research (Prado collection) » allows: `www.thepemworkshop.com`, `p-a-c.fr`, `botoxs.fr` (did not
  answer), `www.museodelprado.es` (blocked by Cloudflare). Supabase Auth accepts preview logins
  (`https://inventaire-git-*-pppeeemmm-webs-projects.vercel.app/**`).

## Next actions (in order)
0. **Pem: SIRET decision by 31 Dec** (no SIRET → no DRAC AIC 2027). Session reminder 1 Dec, Pipeline reminder 15 Dec.
0b. **Pem (Therapeia, open since 27/11):** title ὄναρ / ὕπαρ or « Paxos, l'île rêvée » · Reel length (22 s planned) ·
   shoot the six shots of `video/2026-11-27_onar-upar.md` · OK to date the Therapeia Pipeline steps, add the reminder and
   the film step, and name contact #975 (proposed 27/11, not entered) · verify Journal #57 · merge PR #9.
1. Claude: propose a drawing series from the catalogue for Paréidolie (Pem has none in mind) + gallery shortlist by 20 Dec.
2. Claude: week-1 data-quality report; Documents d'Artistes PACA requirements + dossier draft.
3. Claude: shortlist of galleries for Paréidolie 2027 + drawing selection (case file).
