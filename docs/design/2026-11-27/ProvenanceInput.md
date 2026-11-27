# Provenance — an input to write a work's past, cleanly

Status: **draft, parked until the rules below are clarified (Pem 2026-11-27: « draft input box for provenance to
write clean records — keep all for TODO, the rule needs clarification »).** Nothing built, nothing written to the data.

## The problem
A work entered late (found again) carries an ownership history that happened before it was in the catalogue. The
tools only record moves **as of today**: an order is handed over today, the database writes Historique lines dated
today (`oeuvre_history`), « Garde » reads its dates from the version history (today). Recording a 1999 gift that way
gives a 2026 date, or needs a hand-written data fix (the 2026-11-17 reconstituted gifts were one).

## The idea — one box in the work card: « Provenance »
« + Étape », one line per step, oldest first:
- **Quand** — day, month or year, with « c. » for a guess (« c. 1999 »).
- **Quoi** — don · vente · succession / héritage · prêt · dépôt · perdu · retrouvé · autre.
- **De → À** — the same `@` person picker as everywhere (principle 13); « + Personne » when there is no card.
- **Note** and **papier** (optional: a deed, a letter, a photo of the back of the work).
The last step decides today's owner and holder. Saved through one door, all or nothing; the screen only explains a
refusal (principles 1–3).

## Which home (to decide with the rules)
- A step is a dated fact between people and a work — the shape of a **moment** (`moment` + `moment_person` with roles
  « de » / « à » + `moment_work`; precision day / month / year already exists). Pem's own moves out also need an
  order (rule 10) — a **reconstituted** order carrying the step's date, as on 2026-11-17.
- The Journal and the person timelines would show each step on its true date (moments are read there already).

## Rules to clarify first (Pem)
1. **Rule 10 for the past:** does a move out of Pem's hands before the catalogue existed need a reconstituted order,
   or is a provenance step enough?
2. **Moves between other people** (inheritance, a resale): a step with no order — is that the record, and does it
   change today's owner by itself?
3. **Dates:** Historique and « Garde » show the step's true date (« c. 1999 »), and the day it was recorded — both, or
   only the true one? The database today writes its own line dated the day of the change; the box would need it to
   write the step's date instead.
4. **« c. »** as a precision of its own (beside day / month / year), on works, people and steps.
5. **Public:** a past gift makes the work « Don », so public by rule 13 — default yes, or ask each time?

## First case (facts from Pem, 2026-11-27 — guesses marked c.)
- **Marie Josèphe Maroselli** — family, Marseille, born 1943, died 2013. No card yet.
- **Paule Maroselli** — card #31, Madrid, born c. 1945, 17 Calle Emilio Vargas, postcode c. 28043 (to check).
- **#2410 (Huile), #2412 (Fusain liquide):** Pem → Marie Josèphe, gift c. 1999, no deed → at her death (2013) to Paule.
- **#2411 (Acrylique):** Pem → Paule, gift c. 1999, no deed.
- All three are in Madrid at Paule's; public once recorded (Pem: OK). Today they still read owner / holder = Pem and
  place « Marseille Atelier » (set by the phone).
