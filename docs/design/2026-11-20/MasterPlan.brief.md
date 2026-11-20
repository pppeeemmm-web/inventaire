# Master plan — brief for a fresh session (Fable), 2026-11-20

You are asked for a **master plan** for PEM Hub, and for **your own vision and pushback**, not a copy of ours. Design only: no code, no SQL, no commits. House rules: repo `CLAUDE.md` (terse; status words exact; design first).

## Who and what

Pem is the artist and owner. PEM Hub (Next.js 15 + Supabase + R2, live at thepemworkshop.com) archives the practice: ~1,180 works, journal, concepts, contacts, orders, events, the public site, a phone terminal (`/hub`). Mission, in Pem's words: keep trace of the work in all its forms, create links and insight, transmit, and value the oeuvre — « I hope somebody, now or in the future, will be able to extract from my painting some joy, emotion, mystery ». Aims in order: Trace → Links → Transmission → Value.

## The scenario (Pem's way of thinking — talk at this level first)

« The airport », « the black box »: things come in through many gates (phone, desk, people, email, calendar, payments) and go out in many forms (site, kits, PDFs, papers, reports); « it's all organisms ». « The puppeteer knows where it's going. He knows the scenario. » The plan is the scenario; screens and gates are the figures.

## The problem to solve

Pem's diagnosis: things get **built, then redesigned from scratch**. Each feature got its own table and screen, so the next one needs a rewrite to talk to it. Pem wants « solid things that just need tweaks, not rewritings » — design the whole first, then build and test.

## Read, in this order

1. `docs/STRATEGY.md` — aims, « Intentions », « What I don't want » (new, 2026-11-20).
2. `docs/design/2026-11-20/ScopeInterview.notes.md` — the interview: answers, rulings Now / Later / Never, the order to the wind-down.
3. `docs/design/2026-11-20/SystemMap.draft.md` — our proposal: five pillars (Works, People, Places, Moments, Ideas); **every business record is a Moment** (who × which works × when × kind × paper); CRM features as views; TODO builds confronted (§6); the hub as airport (§7); money and tax (§8–9); gaps (§10–11).
4. `docs/TODO.md` §3–§5 — the open builds.
5. Every existing design note it touches, **in full** (we only read their headings): `docs/design/2026-11-19/CatalogueGaps.notes.md`, `2026-11-18/ContactsReview.notes.md`, `Collector_ShareKit.notes.md`, `Products_Engine.notes.md`, `Supplies_Orders.notes.md`, `AiDesk.notes.md`, `2026-11-17/R6_Events.notes.md`, `R7_Orders.notes.md`, `R8_SiteAssessment.notes.md`; `docs/WORK_CUSTODY_MODEL.md`, `docs/CONSTELLATION.md`, `docs/COMMERCIAL_GUIDELINES.md`, `docs/ARCHITECTURE.md`, `docs/WHERE_WE_STOPPED.md`.
6. The live schema (read only): ~90 tables; `nodes` (1,673) + `tblrelations` (3,772) are the existing graph spine; business data is tiny (62 contacts, 14 orders, 4 enquiries).

## Fixed by Pem (do not reopen without a reason)

- Wind-down of the build phase **2026-12-17**; feature freeze around **2026-12-10**, then tests (full scale, on the throwaway Docker copy), fixes and a runbook.
- First build after the current batch: **one on-top window for quick capture + debug report**, one inbox. AI desk: **hide what doesn't work**.
- Themes = creation; working groups = business. Design references never mixed with creative ideas.
- **Care runs without Pem:** rules create tasks for the team (« all of us for now »); the app drafts, a person sends; automatic sending only after a GO. An approval folder « the director signs page by page ».
- Gates, in build order: calendar → email (studio address, read only first) → Instagram / WhatsApp → payments.
- **No outside access** to the hub: outsiders get kits, PDFs, files.
- Tax: micro-BNC (to confirm); the receipts book is the legal paper; Pem pays tax « only on what I get » (gallery commission treatment to confirm with the tax office). A self-filed declaration is kept locked.
- Legacy: a plan exists and is **private — ask Pem**; an introduction package FR + EN is wanted.

## What we ask of you

1. **Your vision.** Does the five-pillar / Moment spine hold? What would you change, add, or throw out? Where is the real forefront (we suggest works ↔ people matching on existing embeddings, care without Pem, one record behind every output, idea digests by a local AI)?
2. **The master plan:** the target structure (data, gates, roles, outputs), what becomes a view vs a table, and how each open design (§3 / §4 of TODO) reshapes against it.
3. **The order:** what fits before 2026-12-10 (design work, independent builds, the full-scale test, the runbook) and what comes after the pause.
4. **Risks and gaps** we missed (we listed: life after the wind-down, legacy, rights / ADAGP / resale right, GDPR, artist-author status and thresholds, hub security, usage measurement).
5. **Pushback** on anything in our drafts that looks like one more layer.

## Output

`docs/design/<date>/MasterPlan.md` in a worktree, uncommitted, plus a short list of questions for Pem as numbered plain text in the chat (Pem answers by voice; no forms or widgets). Do not edit `docs/TODO.md`, `docs/DONE.md`, `lib/whats-new.ts` or `whats-new*.messages.ts` — the main checkout lands it.
