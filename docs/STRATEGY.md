# Strategy — owner intent

The filter for new work: a request that serves none of the aims below gets parked, not built. Open items live in [`TODO.md`](./TODO.md); this file only says why.

## What this is for (Pem, 2026-11-13)

> Keep trace of my work in all its forms — paintings, writings, anything that has to do with my wondering at the world in that existence of mine — to transmit affections and hopes; to create links between nodes and extract meaningful insights. To help me value the oeuvre against all odds.
>
> I hope somebody, now or in the future, will be able to extract from my painting some joy, emotion, mystery — anything that creates true value to other humans.

## Aims, in order

1. **Trace** — nothing lost; intake is easy on the phone, in the field.
2. **Links and mapping** — search, suggestions, journal ↔ work, Constellation, map.
3. **Transmission** — reaching other people, now and later: the public site, portfolios, diffusion; and the archive that stays readable without this app.
4. **Value** — follows from 3: what the work gives to others. Records that support it (provenance, condition reports, certificates) serve this.

Commercial tools (sales, logistics, fiscal, stock) hold almost no data: nothing is spent there until a real case needs it.

## Intentions (Pem, scope interview 2026-11-20)

- **Ready to go, then wind down.** « I want to wind down my subscription for the Claude one because it's very expensive and I need everything to be ready to go and tested. » Wind-down date: 2026-12-17; feature freeze around 2026-12-10, then only tests, fixes and a runbook so the app runs without Claude. The build phase has an end: finish and test before adding.
- **Quick fire.** Ideas, photos, voice notes, tasks and links recorded fast, from the desk and the phone, into one inbox sorted later: « I don't take time to select the type. »
- **Straightforward and fast.** « I find loading times are a waste of time and I want functions to be straightforward. » No going back and forth between tabs that reload the catalogue.
- **Journal as a sketchbook.** One window that flows; pills as criteria.
- **Links take shape.** Constellation is the map: « the links will appear and the map will take shape ». It grows into the overview of all ideas: a map, and a click opens a digest written by a local AI. A 3D version has always been the idea.
- **Concepts in my words.** World view kept as short distilled concepts, « conjectures that are supposed to fashion my view of the world », linked to works where it fits.
- **Independence and learning.** Commercial follow-up stays last (no case in the next two months), but when it comes it is a learning exercise: « I want to be independent if I can. »
- **An assistant, not an order-taker.** « You need to behave more like an assistant to me, to not design only the function I'm asking you, but to put it in perspective and offer the full picture. » Before building: consequences, scope, pluses and minuses, written for Pem.
- **Reporting made easy.** Quick capture and the debug window are one window that stays on top, with an « idea / bug » switch: a screenshot, a few words or a voice note, into one inbox; bug items become reports Claude can act on.

## What I don't want (Pem, scope interview 2026-11-20)

- « Pem Hub is not for wasting my time. Pem Hub is not a toy. Pem Hub is not for amateurs. »
- Tools « just built and displayed and maybe it will never be used. … if they are poorly made, might just as well not build them. »
- UX that is « needlessly obscure », untested, with strange buttons and copy — the AI desk as first built; until the wind-down, what does not work there is hidden, not redesigned.
- Loading times; tabs that reload the catalogue.
- Slow loading dressed up as layout: containers inside sub-containers are fine when they fit the purpose, « it's just the way the data is exchanged from the server to my machine and back … you have to be careful ».
- Design references (website, exhibitions) mixed with creative ideas: « two separate places, never mixed ».
- Private tasks shown as a wallpaper: « too risky », dropped.
- Building first and redesigning from scratch after (« built, then redesigned from scratch » is the pattern to stop).

## Standing decisions

- 2026-07-15 — `NeedsPhotograph` is a manual quality gate, never cleared by adding an image (phone photos are journal references, not diffusion-grade).
- 2026-07-15 — Phone images: capture in Lightroom → export → library picker → new or existing work.
- 2026-07-16 — Changes follow lived friction (felt at least twice); problems stated, not solutions prescribed; fixes batched.
- CLAUDE.md — no background queues, wider OCR or transactional email without a GO.
- 2026-11-14 — **design first, not tweaks** (Pem: "adding layers and layers … implementing things that don't bring anything"): whole screens are designed and agreed before building; remove or merge rather than add a layer. Inputs (images / documents, voice notes, writings) nourish the practice; outputs are the works, entered through sessions → [`RETHINK_2026-11-14.md`](./archive/RETHINK_2026-11-14.md).
