# Review tool — the window that stays on top (design for Pem's GO, 2026-11-28)

Status: **design, not built.** Pem 2026-11-28: « it's the best tool we need right now ». Origin: the « debug window »
of the scope interview (`docs/design/2026-11-20/ScopeInterview.notes.md` §51, §68, §94), master plan « Now » §3.1,
Journal design step 5 / build step 4. Mockup: [`ReviewTool_mockup.html`](./ReviewTool_mockup.html).

## Pem's answers (2026-11-28)
1. **Where:** desk pop-out over Chrome first (Document Picture-in-Picture, no install); the phone button right after,
   same capture.
2. **What goes in:** words · voice · screenshot · pointing at the element. All four.
3. **How it reaches Claude:** each report is a Kaizen item; every session starts by reading the open ones.
4. **Scope and after:** one window, a switch « Bug / Idée » (bug → Kaizen, idée → today's Journal page); the loop
   open → fixed in version X → Pem confirms on the preview, or reopens.
5. **Who:** the team can report too, but **everything comes back to Pem before anything is done** (Pem 2026-11-28).
6. **Section:** bugs go to a new Kaizen section **« App »** (Pem 2026-11-28).

## What kind, which home (Building principles §2)
| Report | Home | Door (exists) | Change |
|---|---|---|---|
| Bug / improvement to the app | Kaizen (`kaizen_item`) | `createKaizen`, `addKaizenScreenshot` (6 shots, R2 AVIF) | 3 columns, see below |
| Idée | Today's Journal page (`journal_entry`) | `createJournalEntry` (desk + phone already use it) | none |

No new table, store or door. The window is a new face on two existing doors.

## The window (desk, Chrome)
- **Opens:** a small « ⚑ Revue » button in the Atelier header (Pem and the team), or `Ctrl+Shift+K`. Chrome opens a
  always-on-top window (~360 × 480) that stays while Pem keeps clicking in the app.
- **Switch:** `Bug` | `Idée` (Bug by default).
- **Words:** one text box; the first line is the title.
- **Voice:** 🎙 — live dictation into the text box (`startLiveDictation`, exists), keeps listening while Pem clicks
  in the app. No audio file kept (v1).
- **Screenshot:** 📷 — the tab as it is now (`getDisplayMedia`, Chrome asks once per review « share this tab »;
  real pixels, no new library). Up to 6.
- **Point:** 🎯 — the app page dims; hover outlines an element; click → its box is drawn on the next screenshot and
  its label (`data-testid`, else the visible text, else the tag) goes in the report.
- **Filled by itself:** page address, build (`x-build-sha` read with one HEAD request: « live a1b2c3d » or « preview
  a1b2c3d »), time, screen size and browser.
- **Envoyer:** Bug → `createKaizen` + each shot through `addKaizenScreenshot`; Idée → `createJournalEntry` on today
  with the page address as the last line (a work page → `#id` link). Answer shown in the window: « Kaizen #42 » /
  « Journal, aujourd'hui ». A refusal says so (principle 3); the text stays in the box.

## The loop (Kaizen)
`kaizen_item` today: open (`done_at` null) / done. Added — **SQL, its own GO, throwaway copy first:**
- `context jsonb` — page, build, device, pointed element (written once by `createKaizen`).
- `fixed_sha text` — the build that fixes it (set with « done »).
- `verified_at timestamptz` — Pem confirms on that build.
- `approved_at timestamptz` — Pem's OK to act: set at creation when Pem files it; a team member's report stays
  **proposé** until Pem approves (or ticks it done without acting). Only Pem (admin) can set it — the database holds
  that rule (principle 1).
- Section check gains `'app'`.

States, read from these columns (no state column): **proposé** (team, waiting for Pem) → **ouvert** → **à vérifier** (done, not verified; shown on top
with « Ouvrir la version » + `Confirmer` / `Rouvrir`) → **confirmé**. `Rouvrir` clears `done_at` and `fixed_sha`.
« Seen » is left out (v1): Claude reads every open one at session start.

## Claude's side
- Session start (added to `CLAUDE.md` read order): one read-only query — approved open and « à vérifier » items with their
  `context`, newest first. A « proposé » item is never acted on.
- A fix commit names the item (`Kaizen #42`); after the merge Claude sets « done » with the build sha.
- Screenshots: Claude in the cloud needs the R2 public host allowed in the environment to look at them (one host,
  approval prompt) — or reads the text only.

## Phone (step after)
Same two doors. A ⚑ in the phone menu bar opens a sheet: switch, text, 🎙, « Joindre une capture » (iOS screenshot
from Photos — Safari cannot capture the screen), context filled the same way. No pointing on the phone.

## Flow trace
Input: the window → `createKaizen` / `addKaizenScreenshot` / `createJournalEntry` (writers, exist). Triggers: none on
`kaizen_item` beyond the feed (`r1_feed.sql`, item kind `kaizen_item`). Readers of `kaizen_item`: Kaizen list
(`Kaizen.tsx`, `listKaizen` `select *` → picks the new columns), Journal day fold « Création » (`entry-actions.ts`
:112, :241 — section `creation` only, reports go to `app` → unchanged), tab badge
(`TeamPortalClient.tsx` :831), phone counts (`app/hub/menu-actions.ts`), `atelier-open-actions.ts`, the feed. Which
change: the Kaizen list (« App » tab, states + buttons) only; the section filters that list `creation` / `website` /
`business` (`lib/kaizen.ts` `parseKaizenSection`) gain `app`. Journal readers: unchanged (an ordinary note).

## Build steps (each Pem can check)
1. SQL on the throwaway copy → live with Pem's OK; doors take `context` / `fixed_sha`, new `verifyKaizen` / reopen.
2. The desk window: words + voice + context + Envoyer (Bug and Idée). Pem files one of each on the preview.
3. Screenshot + pointing. Pem files a bug with a pointed button; the box shows on the Kaizen card.
4. Kaizen « à vérifier » + Confirmer / Rouvrir. Claude fixes one report end to end; Pem confirms it.
5. Phone sheet.

## Points to settle
- none — waiting for Pem's GO on step 1.
