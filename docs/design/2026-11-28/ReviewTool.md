# Review tool — the window that stays on top (to discuss first, 2026-11-28)

Pem 2026-11-28: « it's the best tool we need right now » — discuss before any design or build; re-ask the questions
below at the start of the next session. Origin: the « debug window » of the scope interview
(`docs/design/2026-11-20/ScopeInterview.notes.md` §51, §68, §94), master plan « Now » build §3.1
(`MasterPlan.md`), Journal design step 5 and build step 4 (`docs/design/2026-11-22/JournalDesign.md`). **Not built:**
no capture window, no AutoHotkey script, no « Copier pour Claude » exist in the code (checked 2026-11-28).

## What it is for (Claude's reading, to confirm)
While Pem uses or reviews the app (live or a preview), a problem or a thought is reported the moment it is seen,
without leaving the screen, and reaches Claude already holding what is needed to act. Each report carries by itself
the page address, the build seen (live or which preview, `x-build-sha`), the time and the device.

## Questions for Pem (with Claude's recommendation)
1. **Where it lives.** Desk: over every app (AutoHotkey) or over Chrome only (Document Picture-in-Picture pop-out);
   phone: a button always on screen. *Rec.: desk pop-out first (no install, reviews happen in Chrome), the phone
   button right after, same capture.*
2. **What goes in.** Words · a voice note (keep clicking while talking) · a screenshot · pointing at the thing on the
   page (click an element → marked on the screenshot). *Rec.: all four; voice + screenshot is the core, pointing saves
   the most back-and-forth.*
3. **How it reaches Claude.** Not copy-paste: each report is a Kaizen item; every session starts by reading the open
   ones (« look at the reports »). *Rec.: this; « Copier pour Claude » only as the after-the-pause fallback (§6).*
4. **What happens after.** open → seen → fixed in version X → Pem confirms on the preview or reopens; fixed items
   come back as « à vérifier ». *Rec.: this loop — or lighter if Pem prefers.*
5. **Bugs only, or ideas too.** The interview said one window, a switch « idée / bug »: ideas on today's Journal page,
   bugs in Kaizen. *Rec.: one window, the switch.*
6. **Who uses it.** Pem only, or the team too (their reports to Pem first)?

After the answers: one-page design + mockup for Pem's GO (Building principles: which home — Kaizen for bugs, the
Journal for ideas; no new store unless neither fits; one door each).
