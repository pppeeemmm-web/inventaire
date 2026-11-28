# Laboratoire — recipes, trials and the book (design for Pem)

Status: **design + mockup (`Laboratoire.mockup.html`), nothing built.** Pem « GO design », 2026-11-28.

Pem, 2026-11-28: « extract ordered knowledge through conjectures, ideas, goals, praxis if possible: a book in other
terms » · « for the laboratoire add a recipe engine and steps » · « the studio equipment that leans also into this
endeavour, a list will make sense — a messy job, completely overwhelming » · the old treatises as the model for the
structure (Cennini, Pacheco, Mayer, Doerner) · Temperone (Kremer): it worked, but adhesion, conservation,
flexibility, compatibility, layering, maximum thickness and supports are the limits to know.

## Which kind of thing, which home, what changes

| Thing | Kind | Home | Change |
|---|---|---|---|
| The field, its chapters, goals, conjectures, rules, recipes, material pages | An idea with a role in the Laboratoire | Idées (`concept`), tree by `parent_id` (exists: « Laboratoire » → « Huile : indice de réfraction et saturation ») | Two columns: `lab_role` (chapitre · but · conjecture · regle · recette · matiere) and `position` (order inside a chapter) — SQL |
| A recipe's ingredients | Lines with an amount or ratio | **New** `recipe_ingredient` | Why no existing home: an idea holds text, not quantities to scale |
| A recipe's steps | Ordered lines with a time and equipment | **New** `recipe_step` | Why: order, times and tools are not text |
| A recipe's limits (adhesion, flexibility…) | One value per criterion, by source | **New** `lab_assessment` | Why: the same grid for every recipe, so they compare; literature and trials side by side |
| A trial (made it, what happened) | A moment | The Journal (`journal_entry`) with the label « essai », linked to the recipe (`journal_entry_link`) | Nothing new: a label and a link. The trial can carry a photo (inspiration photo) |
| Materials and equipment on the shelf | Stock | `stock_items` | One more category, « Équipement » (code); ingredients and steps point to Stock items |
| The book | A read | A page that walks the tree in order (later a PDF) | No data copied: written once in the Hub, read as a book |

Every write goes through doors on the server (principle 2): `save_recipe` (ingredients + steps + limits, all or
nothing, stale-checked like `save_contact`) and the existing idea and Journal doors. Phone and desk use the same
doors (principle 10): the phone records a trial at the bench; the desk writes recipes and reads the book.

## The book's order (from the treatises)

Order of the book = order of learning (Cennini's apprenticeship, Pacheco's *Arte de la pintura*):
**Fonds → Pigments → Liants → Médiums → Procédés → Praxis.** Pem renames and reorders chapters freely: a chapter
is an idea, its place is `position`.

Each chapter, in the same order:
1. **But** — what the chapter aims at (« garder la saturation dans les clairs »).
2. **Règles qui tiennent** — praxis, each with its evidence (trials, sources).
3. **Recettes** — cards (below).
4. **Conjectures ouvertes** — graine / pousse, the next test written under each.
5. **Ce qui n'a pas marché** — refuted conjectures and failed trials, with why (Mayerne: crossed out, kept).

A conjecture's life uses what ideas already have: maturity (graine → pousse → mûre) and status (exploration → en
cours → abandonné / devenu règle).

## The recipe card (Theophilus' order)

- **Ingrédients** — each a Stock item (PW6, huile de lin pressée à froid, calcite…) or free text; an amount + unit,
  or a ratio. « Échelle : 50 g » recomputes every line. « Fait » can deduct the amounts from Stock (asked each time).
- **Étapes** — ordered; each with an optional time (« repos 24 h »), the equipment it needs (a Stock item in
  « Équipement »), and a warning.
- **Résultat attendu** — one line.
- **Limites** — the fixed grid, two columns per criterion: **literature** (with its source: Doerner, Mayer,
  Pacheco, Kremer's sheet) and **trials** (from the linked « essai » entries). Empty = open question; a disagreement
  stays visible.
- **Essais** — the dated trials, newest first (who, version, result, photo).
- **Version** — a change of an ingredient or step makes « v2 »; trials say which version they used. (First build:
  versions as a number on the card; the old lines kept in the history.)

### The grid of limits (same for every recipe)

Adhésion · Souplesse · Conservation / vieillissement · Compatibilité (dessus / dessous) · Superposition (gras sur
maigre, nombre de couches) · Épaisseur maximale par couche · Supports (panneau, toile, papier, carton) · Séchage
(toucher, recouvrable) · Effet optique (saturation, brillant / mat, transparence) · Solubilité / réversibilité ·
Maniement (temps ouvert, pinceau / couteau) · Conservation du mélange · Santé / coût.

Value per cell: ✓ tient · ~ sous condition (+ the condition) · ✗ ne tient pas · ? inconnu — plus a short note.

## Material pages (Mayer / Doerner)

One page per pigment, binder, filler: refractive index, behaviour in oil, toxicity, warnings, which recipes use it,
which Stock items are it. A material page is an idea with `lab_role = matiere`; the book's index lists them.

## Equipment — the overwhelming list made small

1. Stock gets the category **« Équipement »** (molette, plaque de broyage, balance, plaque chauffante, lampes…);
   a recipe step points to it.
2. **Laboratoire first**: list what a recipe needs or what limits one — likely 30–50 items, not every brush.
3. **Walk and talk**: one shelf at a time, a voice note; its transcript becomes proposed Stock lines Pem ticks
   (the voice recorder exists; « transcript → proposed lines » is new, its own GO).
4. Later, if the voice walk proves useful: a photo per shelf, the AI proposes lines. QR labels on boxes (the scanner
   exists).

## Scenario (steps Pem can check)

1. Desk, Idées → « Laboratoire »: the chapters in order; « Transparence » shows its goal, 3 rules, 1 recipe,
   2 open conjectures, 0 failures yet.
2. « + Recette » in « Transparence »: « Budget de blancs ». Ingredients from Stock: zirconium (5 %), lithopone
   (au besoin), pâte de calcite (masse). Steps. Expected result. Limits: literature filled from the oil doc;
   trials empty (?).
3. Phone, at the bench: Journal → « Essai » → picks « Budget de blancs v1 » → photo of the strips + « zinc fissure à
   3 mois » → saved on the day, linked to the recipe. The recipe's « Conservation » trials cell shows ✗ with that
   note.
4. Desk: the conjecture « le voile de calcite s'efface » gets a trial → stays pousse; « silice pyrogénée » is
   abandoned after a failed trial → moves to « Ce qui n'a pas marché » with the reason.
5. « Livre » → the book in order, chapter by chapter; « Transparence » reads goal → rules → recipe card → open
   conjectures → failures. Later: « PDF ».
6. Stock → « Équipement »: the voice walk's lines ticked; the recipe step « broyer 10 min » shows « molette en
   verre ».

## Build steps (each its own GO; SQL on the throwaway copy first, live on Pem's OK)

1. **Equipment category** in Stock (code + FR/EN) — no SQL.
2. **SQL**: `concept.lab_role`, `concept.position`; tables `recipe_ingredient`, `recipe_step`, `lab_assessment`
   (RLS + grants, team read, writes only through `save_recipe`); the Journal label « essai ».
3. **Screens**: the Laboratoire tree in Idées (desk), the recipe card (desk edit, phone read), « Essai » on the
   phone's Journal.
4. **The book** (a read, then PDF).
5. **Voice walk → proposed Stock lines** (after 1–4 prove useful).
6. Move today's material in: chapter « Transparence » (goal, rules and conjectures from the oil doc), the
   white-budget recipe, Temperone from Pem's own trials, material page « Calcite ».

## Questions for Pem

1. Chapter order and names (Fonds → Pigments → Liants → Médiums → Procédés → Praxis)?
2. The grid of limits — anything to add or drop? The ✓ / ~ / ✗ / ? scale, or a 1–5 score?
3. « Fait » deducts the recipe's amounts from Stock — yes, asked each time, or never?
4. Temperone: its ingredients and steps as you used them (or Kremer's sheet), to fill the first real card.
5. The book in French only?
