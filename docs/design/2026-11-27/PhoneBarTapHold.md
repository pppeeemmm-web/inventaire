# Phone bar: tap = do, hold = choose — design for Pem

Status: **proposal + mockup (`PhoneBarTapHold.mockup.html`), nothing built.** Pem 2026-11-27: « photo has 5 input
options and write had 1 — how about long press opens radial choice … or redistribute / rename the menu items even
from sticky bar level, taking into account the thumb. The goal is always to have less card opening to enter another
card / input with the same level of stability. »

## Which kind of thing, which home, what changes
- **Kind:** navigation to existing capture doors (no new record, no new door).
- **Home:** the phone input bar (`components/shared/PhoneInputBar.tsx`), the same four buttons.
- **What changes:** a **tap** does the most frequent action straight away (no choice card); a **hold** (≈½ s) fans the
  other choices in an arc above the thumb — slide onto one and release, or tap one; release elsewhere = nothing.

## Use (live, last 90 days)
Voice notes 22 · inspiration photos 11 · photos into the Journal 10 · typed notes 7.

## The four buttons
| Button | Tap (straight) | Hold (fan) |
|---|---|---|
| ✍️ Écrire | write today | another day · link a work / idea |
| 🎙️ Vocal | recording starts | 🎧 import (Voice Memos) · long note (pause) |
| 📷 Photo | camera → today's inspiration | document · business card · QR of a work |
| 🖼️ Œuvre | new work | reprise · field session · old — found |

« Photo · doc » becomes « Photo »: its five-choice card goes — inspiration is the tap, document / card / QR go into
its fan, the audio import goes to Vocal's fan.
(Use: the 10 « photos into the Journal » are, as far as can be seen, the inspiration photos' Journal entries.)

## Stability (the same doors)
Each choice opens exactly what it opens today (capture pages, voice sheet, write sheet, new-work form) — only the
way to reach it changes. Taps stay ≥ 44 px; the fan keeps inside the screen; nothing is saved by the fan itself.

## iPhone limits (looked at before building)
- Safari shows its own menu on a long press: the bar disables it (`-webkit-touch-callout: none`, no selection,
  `contextmenu` blocked) — the mockup does this; to check on Pem's iPhone.
- No vibration on iPhone web pages: the fan's appearance is the only signal.
- A hold is hidden by nature: each button shows « maintenir : n choix » in small text under its name (can go once
  learned), and the screen reader reaches the same choices through a « Plus » button.

## Questions for Pem (after trying the mockup)
1. Tap / hold as in the table — any tap default to change (e.g. Photo → document rather than inspiration)?
2. Keep the « maintenir : n choix » hint, or remove it once learned?
3. Same bar on the desk Journal, or phone only?
