# A more human « What's new » — design draft (TODO 24)

Pem 2026-11-17: the team doesn't read the list — too many updates, too complex, impersonal. Pem 2026-11-18: « go ».
Draft by the lead, 2026-11-18. No code yet: Pem picks, then build.

## What is wrong today

- One popup per release with every item since (3.1.53 alone has 120+ items in the archive), written for Pem.
- Most items are admin tools or fixes the team never meets.
- Nothing points at the place that changed: the reader has to find it.

## The idea: news where it happened, in Pem's voice

1. **A dot on the thing that changed.** A small accent dot on the menu entry or button that is new or different
   (e.g. « Commandes », the « + Nouveau contact » button). First tap → one plain sentence in a bubble
   (« Nouveau : créer un contact sans quitter la commande »), then the dot is gone for that person. No popup.
2. **Pem's word per batch (optional).** When Pem records a short voice note and marks it « pour l'équipe »,
   the team sees one card on Aujourd'hui: Pem's name, the audio, at most 3 one-line highlights. Seen once, gone.
3. **The list stays the archive.** Kaizen → Nouveautés keeps everything, as now; the popup goes away.

## Who sees what

| Item kind | Dot | Card highlight | Archive |
|---|---|---|---|
| Team-facing (a screen the team uses) | yes | if Pem picks it | yes |
| Pem-only / admin | no | no | yes |
| Invisible fix | no | no | yes |

## How it works (build sketch)

- `lib/whats-new.ts`: each item gains `audience: 'team' | 'pem'` and an optional `spot` (a short key such as
  `nav:sales`, `btn:new-contact`). A `<NewDot spot="…">` wrapper reads the unseen team items for that spot.
- « Seen » per person: start in the browser (localStorage, no SQL). If Pem wants it to follow people across
  devices: one small table later (needs its own SQL OK).
- Pem's card: a voice note with a « pour l'équipe » mark. Either a tag in the note's subject (no SQL) or a
  column on `voice_note` (SQL OK). The card shows the release's team highlights under the audio.
- The popup (`WhatsNewDialog`) is removed; the release number stays in Kaizen.

## Questions for Pem

1. Dots alone, or dots + your voice card?
2. « Seen » per browser (simple, a phone and a computer each show it once) or per person (needs a small table)?
3. Who is « the team » today — which accounts?
4. Keep any popup at all (e.g. only for a big change), or none?
