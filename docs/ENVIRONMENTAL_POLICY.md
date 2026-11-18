# Politique environnementale de l'atelier / Studio environmental policy

**Status: first draft, 2026-11-18 (Pem: « go »). Nothing published.** Every `[[…]]` is a fact or a choice only Pem can give — the draft does not guess what the studio already does. Before any sentence of this goes on the website: only claims the studio can show (EU rules on environmental claims are strict about vague « green » wording — [R], *lawyer*).

**Why** ([`STRATEGY.md`](./STRATEGY.md)): the practice is about wonder at the world; the studio tries to take as little from it as it can while making, keeping and sending the works. The policy is short and measurable on purpose: a few habits, a yearly look at the numbers, honest wording.

---

## 1. Making — materials and the studio

1. **Paints and supports:** [[current materials — oils, papers (Yupo is a synthetic paper), canvases, panels]]; preference for [[suppliers / brands]] that publish their pigments and solvents; [[local suppliers where possible]].
2. **Solvents:** [[which ones today]]; aim: the least toxic that works ([[e.g. odourless mineral spirit, or solvent-free mediums]]), used sparingly, rags and used solvent kept in closed containers and taken to the **déchetterie** (hazardous waste) — never poured down the drain or into the ground.
3. **Paint waste:** dried paint and soiled rags → hazardous waste collection; brushes cleaned [[with oil, then soap]] to cut solvent use.
4. **Energy:** [[heating / lighting of the studio — supplier, any renewable contract]].
5. **Re-use:** stretchers, panels and frames re-used where the work allows; studies and failed supports re-used as grounds [[if Pem does]].

## 2. Packing

1. **Re-usable first:** crates and boxes are kept and re-used; a gallery or institution returns them for the next transport.
2. **Materials:** [[cardboard corners, recycled board, paper honeycomb, glassine]] before plastic; bubble wrap only where the work needs it (glazed frames), and re-used.
3. **Return of packing:** a buyer can send the crate back [[at the studio's cost / not offered]].
4. In the app (R7b order cascade): the « Packed » step records what was used, so a yearly count is possible.

## 3. Sending

1. **Pick-up offered** on every sale (POLICY_NOTES D2): no transport at all.
2. **Grouped shipments:** works going to the same address travel together (R7b « several orders in one shipment »); a gallery deposit is sent in one crate rather than piece by piece.
3. **Road and sea before air** when the date allows; air only on request [[or when the buyer pays the difference]].
4. **Carriers:** [[preference for art shippers / carriers with consolidated routes]] — choice recorded on the shipment (R7b), so the yearly count shows it.

## 4. Exhibitions and events

1. Works shown close to where they are kept when possible; a travelling show goes in one transport.
2. Printed material ([[cartels, invitations, catalogues]]) in small runs, on [[recycled / certified]] paper; digital invitations first.
3. Hanging hardware and plinths re-used.

## 5. Digital

What is true today (verified in the project's own settings, 2026-11-18):
- The app's servers run in **Stockholm** (Vercel region `arn1`) and the database in `eu-north-1`, Stockholm [R: the Swedish electricity mix is among the lowest-carbon in Europe — check the source before quoting].
- Images are stored **once**, compressed to AVIF at upload (about 6× smaller than a phone's JPEG export), never re-encoded on display (`CLAUDE.md` « Image upload »); deleted files are kept 90 days, then removed.
- Transcription and image description run **on the studio's PC** (local GPU), not on a cloud service.

To do: keep page weight low (the site's speed work already does), no autoplay video, [[a yearly look at storage size]].

## 6. Measuring (once a year, in [[month]])

A short table, from the app where it can:

| Measure | Source |
|---|---|
| Shipments sent, by mode (road / air / pick-up) | R7b shipments |
| Crates re-used vs new | « Packed » step |
| Hazardous waste taken to the déchetterie (trips, litres) | [[noted by hand]] |
| Works sold to buyers within [[300 km]] | orders + addresses |
| Storage used (images, backups) | R2 |

One goal per year, chosen from the table ([[e.g. « no new bubble wrap », « half the sales shipments grouped »]]).

## 7. Wording for the public (draft — only once §1–§6 are true)

> FR — L'atelier réutilise ses caisses, regroupe ses envois et propose le retrait sur place ; les solvants usagés partent en déchetterie. Chaque année, un bilan simple dit ce qui a été fait.
>
> EN — The studio re-uses its crates, groups its shipments and offers collection in person; used solvents go to hazardous-waste collection. Once a year, a short review says what was done.

No « eco-friendly », « carbon neutral » or « green » claims without a measured basis (*lawyer*).
