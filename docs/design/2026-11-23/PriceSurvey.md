# Price survey — price by kind of work (2026-11-23)

Status: **local draft**, survey only. No code, no SQL written, nothing changed. Asked by Pem 2026-11-23 (Building Principle 11 « Look before building »: the reverse-pricing slice, `254e7d2`, went out without this survey). Feeds the next pricing build; companion of [`ReversePricing.md`](./ReversePricing.md).

Read: code on this branch (file:line below), live DB read only (Supabase `mcrzsxrcoexnlwmaunte`, SELECT only, 2026-11-23, aggregates, no names of people), web (sources in §3).

---

## 0. The one finding that shapes everything

**The catalogue holds almost no prices.** Of 1 177 live works, **4 have `Prix > 0`**, and 3 of those 4 are not credible prices. So « the rule Pem's prices imply » (§4) cannot be measured from the data: there is nothing to measure. The rule lives in Pem's head. The next pricing build must **capture** the rule from Pem (questions, §5), not **derive** it from the catalogue.

The reverse-pricing block that is live answers a different question (floor from cost and target net) and **ignores kind of work and size entirely**. What is missing is the other half: a **market price by kind of work** that the floor is compared with.

**Pem's own framing (spoken, 2026-11-23):** pricing practices are only practices; everything depends on the person and many other things, so the field's numbers are context, not rules. His general understanding: **at equal size, a watercolour is cheaper than an oil on canvas, unless the artist is exceptional at watercolour.** Consequence for a build: a medium/support/size rule may only **suggest a starting point** per kind; it never fixes a price, and the artist's judgment on a single work overrides it.

**Status of §5:** parked by Pem (travelling). Not answered; ask again when he is back.

---

## 1. The system

### 1.1 Price fields on a work

| What | Where | Note |
|---|---|---|
| `Oeuvres.Prix` (real, list price) | `lib/types/supabase.generated.ts:2350` | form default is the string `'0'` when null: `DrawerContent.tsx:234` — a save of an unpriced work writes `0` (explains 982 zeros, §2.1) |
| `Oeuvres.PrixFinal` (real) | `supabase.generated.ts:2351` | in the data it always equals `Prix`; readers prefer it: `lib/collector-kit.ts:104-105`, `lib/reports/works-table.ts:202`, `:254` |
| `Oeuvres.Discount` (double) | `supabase.generated.ts:2326`; form `DrawerContent.tsx:236` | **0 or null on every work** (§2.1) |
| `Oeuvres.tva_rate` | `supabase.generated.ts:2364` | franchise today, VAT off |
| Pending-change keys for the three | `lib/work-pending-keys.ts:195-197` | a non-admin price edit goes to `pending_changes` |
| Sale-time prices (not on the work) | `work_order.price_catalogue`, `price_final`, `commission_pct`, `commission_amount`; `work_order_work.price`; `work_order_demand.price`; `private_link_work.price` (frozen kit snapshot) | live: 9 orders, 1 with a price (`4`, a test value), 0 kit lines, 0 demands |
| Costs (admin) | `expense_oeuvre.amount`; `stock_item.cost_unit` | `expense_oeuvre` empty today |

### 1.2 Kind-of-work fields

| What | Where | Live values |
|---|---|---|
| `Oeuvres.Technique` → `Technique` (24 rows) | FK int; lookup `Technique.TechniqueID / Technique` | see §2.2 |
| `Oeuvres.Support` → `Support` (20 rows) | FK int; lookup `Support.SupportID / Support` | see §2.3 |
| `Oeuvres.Format` → `Format` (9 rows: A1…A7, « 10x8 », « Carnet 10x8 ») | FK int | paper formats, **not** a canvas format list; 471 works have one |
| `Oeuvres.Hauteur`, `Largeur`, `Profondeur` | text, cm; `supabase.generated.ts:2335, 2341, 2357`; edit `WorkCardIdentity.tsx:129-135` (one field for round works at :129; px for Digital at :133-135) | all parseable as numbers; 355 have no height; depth is `0`-like on all |
| `Oeuvres.Année` | DATE `YYYY-01-01` (`yearOf()`) | 579 works have none |
| `Oeuvres.Encadree` (framed) | boolean | **0 true** |
| `Oeuvres.IsCommission` | boolean | 0 true |
| `Oeuvres.statusId` → `OeuvreStatus` | FK | 826 Disponible, 203 Archive artiste, 139 En production, 7 Gift, 2 Destroyed; **0 Vendu / Consigné / Prêt / Réservé** |
| **Edition / multiple** | **no field exists** anywhere (no column, no table: grep of the generated types finds nothing) | `ReversePricing.md §8` parks editions « until the Editions design » |

**A multiple has no home.** Proxies only: Technique « Photographie » (8), « Digital » (22), « Gravure » (0); Support « Gravure/Photo offset » (1), « P. photo » (2), « Tee shirt » (1). 33 works touch one of them. One work mentions a tirage / édition word in title or comments. Whether those are prints or one-offs is not recorded.

### 1.3 The reverse-pricing code (live)

| What | Where |
|---|---|
| Constants: contributions 21,1 %, channels (studio 0 / gallery 40 / fair 0 / online 15 / patron 0 % commission), rounding 10 € below 5 000 €, 50 € above | `lib/pricing/params.ts:6, 13-19, 22-24` |
| Pure function `reversePrice`: floor `P = (N+K)/((1−c)(1−r))`, list `L = P/(1−d)`, wholesale, max discount | `lib/pricing/reverse.ts:40-82`; rounding `:35-38` |
| Admin block on the work card (folded, read only) | `components/atelier/work-drawer/WorkReversePriceBlock.tsx:65` (call), `:94` (folded `<details>`), `:134` (shows today's `Prix`) |
| Mounted | `DrawerContent.tsx:2081`; sibling cost block `:2078` |

**What it takes in:** net wanted, costs, running-cost share, channel knobs. **What it never takes in:** Technique, Support, Format, size, edition. So today nothing in the app links a kind of work to a price. The only size-aware idea in the design is the optional running-cost rule « per m² » (`ReversePricing.md §4`), which Pem disliked (§9 row 1) and which prices a *cost*, not a *value*.

---

## 2. The data (live, 2026-11-23, read only)

Population: 1 177 live works (`deleted_at is null`).

### 2.1 Where prices are missing

| `Prix` state | Works |
|---|---|
| `0` and `PrixFinal` `0` | 961 |
| null / null | 171 |
| `Prix` 0, `PrixFinal` null | 21 |
| `Prix` null, `PrixFinal` 0 | 20 |
| **`Prix > 0`** | **4** |
| `Discount` not 0 / not null | **0** |

The four priced works (all aggregates, no titles):

| Technique | Support | Size (cm) | Year | `Prix` | Credible? |
|---|---|---|---|---|---|
| Huile | P. huile | 42 × 29,7 | 2022 | 2 000 | **yes** (the only one) |
| Pastel | Kraft | 15 × 21 | none | 6 000 000 | no (looks typed twice) |
| Huile | Toile | 37 × 45 | 2026 | 180 000 000 | no |
| Pastel | Kraft | 15 × 21 | 2026 | 20 002 000 000 | no |

→ Three look like entry slips or test values. A guard (plausible range per kind) is a cheap by-product of the future rule.

### 2.2 By technique (medium)

| Technique | Works | Priced | With size | Mean surface cm² | Max cm² |
|---|---|---|---|---|---|
| Huile | 332 | 2 | 220 | 2 227 | 8 500 |
| Crayons | 251 | 0 | 219 | 326 | 1 247 |
| Mixte | 145 | 0 | 100 | 479 | 4 996 |
| Encre noire | 75 | 0 | 64 | 292 | 624 |
| (none set) | 64 | 0 | 9 | 345 | 1 247 |
| Graphite | 62 | 0 | 59 | 394 | 624 |
| Pierre noire | 49 | 0 | 34 | 322 | 624 |
| Pastel | 41 | 2 | 34 | 491 | 4 996 |
| Acrylique | 26 | 0 | 17 | 1 550 | 8 680 |
| Digital | 22 | 0 | **0** | — | — |
| Acrylique (gouache) | 17 | 0 | 0 | — | — |
| Feutre | 14 | 0 | 14 | 575 | 4 996 |
| Aquarelle | 13 | 0 | 4 | 322 | 353 |
| Scratchboard | 11 | 0 | 10 | 241 | 338 |
| Gouache | 10 | 0 | 4 | 311 | 311 |
| Encre couleur | 9 | 0 | 4 | 339 | 624 |
| Photographie | 8 | 0 | 8 | 431 | 864 |
| Marker | 8 | 0 | 8 | 139 | 624 |
| Tempera | 6 | 0 | 5 | 646 | 2 000 |
| Sanguine | 5 | 0 | 4 | 311 | 311 |
| Lavis brun | 4 | 0 | 3 | 314 | 315 |
| Sculpture | 2 | 0 | 2 | 108 | 200 |
| Fusain liquide | 2 | 0 | 0 | — | — |
| Collage | 1 | 0 | 0 | — | — |
| Gravure | 0 | — | — | — | — |

What it shows: **the catalogue is two populations.** Oil (332) is large (mean ≈ 47 × 47 cm). Everything dry or on paper (crayons, ink, graphite, pierre noire, pastel, watercolour…) is small: mean 140–500 cm², i.e. A5 (311) to about A4 (623). The 311 cm² repeated across gouache, sanguine, lavis brun, aquarelle = **A5 exactly**. Aquarelle is only 13 works (4 sized) — too few to price by.

### 2.3 By support

| Support | Works | of which oil | Note |
|---|---|---|---|
| Papier | 691 | 27 | the bulk |
| Toile | 137 | 122 | canvas |
| P. huile (oil paper) | 113 | 111 | oil on paper |
| Kraft | 97 | 0 | |
| (none set) | 71 | 43 | |
| Carton | 17 | 12 | |
| Yupo/Legion | 13 | 4 | |
| Papier rond | 8 | 5 | |
| P. argenté | 7 | 0 | |
| P. doré | 4 | 1 | |
| Bois | 3 | 3 | |
| P. transparent, Papier japonais | 3 + 3 | 0 | |
| P. photo, P. Canson | 2 + 2 | 0 | |
| Toile ronde | 2 | 2 | |
| Aluminium, Tee shirt, Gravure/Photo offset, Carton rond | 1 each | | |

**Oil is on three supports with different meaning for price:** canvas (122), oil paper (111), others (≈ 99). Pem's « oil on linen costs more » needs the support, not only the medium. The lookup says « Toile », not « lin » (linen vs cotton is not recorded).

### 2.4 By size band (surface = H × W, cm²)

| Band cm² | Roughly | Works | Priced | Oil | Canvas (Toile + ronde) | Paper-like |
|---|---|---|---|---|---|---|
| no size / zero | — | 368 | 0 | 118 | 61 | 234 |
| < 200 | smaller than A6 | 122 | 0 | 7 | 1 | 116 |
| 200 – 600 | A5 to A4 | 399 | 2 | 36 | 5 | 360 |
| 600 – 1 500 | to about 35 × 40 | 208 | 1 | 102 | 12 | 111 |
| 1 500 – 4 000 | to about 60 × 65 | 25 | 1 | 20 | 12 | 6 |
| 4 000 – 10 000 | to about 100 × 100 | 55 | 0 | 49 | 48 | 4 |
| ≥ 10 000 | larger than 1 m² | 0 | 0 | — | — | — |

(« Paper-like » = Papier, Papier rond, Carton, Kraft, Canson, Yupo, Papier japonais.) **Large canvases exist (55 works over 4 000 cm², almost all oil on canvas) and none has a price.** 368 works (31 %) have no usable size; 118 of them are oil.

### 2.5 By year

| Year | Works | Priced | Oil | Toile | Disponible |
|---|---|---|---|---|---|
| (none) | 579 | 1 | 33 | 18 | 412 |
| 1999 – 2000 | 2 | 0 | 0 | 1 | 1 |
| 2020 | 24 | 0 | 24 | 2 | 21 |
| 2021 | 25 | 0 | 25 | 0 | 22 |
| 2022 | 44 | 1 | 44 | 13 | 39 |
| 2023 | 27 | 0 | 24 | 4 | 25 |
| 2024 | 116 | 0 | 58 | 28 | 112 |
| 2025 | 154 | 0 | 58 | 28 | 114 |
| 2026 | 206 | 2 | 66 | 43 | 80 |

Year is empty on half the catalogue (the dated papers are mostly undated). The dated series 2020–2023 is all oil; the volume jump is 2024–2026. **No price history by year can be read.**

### 2.6 Unique vs multiple

No field. 33 works carry a print-like technique or support (§1.2); none is priced. Cannot be split from the data.

---

## 3. The field (how artists and galleries price)

Sources are mostly artist-advice and dealer pages; none is a market dataset. Treat as direction, not norm.

### 3.1 Size

| Method | Rule | Behaviour | Source |
|---|---|---|---|
| **Per square inch / cm²** | `price = rate × H × W` | price grows with area: doubling both sides quadruples the price; small works cheap, large works expensive | [Seattle Artist League](https://www.seattleartistleague.com/2017/03/07/how-to-price-your-artwork/), [Artwork Archive calculators](https://www.artworkarchive.com/blog/pricing-your-artworks-isn-t-a-mystery-with-these-simple-pricing-calculators) |
| **Per linear inch / cm** | `price = rate × (H + W)` | gentler curve: doubling both sides doubles the price | [vCalc](https://vcalc.com/wiki/vcalc/artwork+pricing+by+linear+inch+calculator) |
| **Rate is per medium** | one artist: a stated rate per square inch for oil | each medium gets its own rate | Seattle Artist League (above) |
| **Formula is a start, not a law** | the rate has no objective source; artists adjust for effort, reputation, comparables | [ArtBusiness](https://artbusiness.com/artists-why-art-pricing-formulas-dont-work.html), [Artwork Archive](https://www.artworkarchive.com/blog/how-to-price-consistently-for-art-sales-success) | |
| **Framing is added on top** | not inside the size rate | Seattle Artist League | |

### 3.2 Paper vs canvas, medium

- Works on paper are generally priced below paintings on canvas; same dimensions are often priced differently and « buyers generally understand why »; larger works command more. [Affordable Art Fair](https://affordableartfair.com/inspiration/understanding-art-pricing-how-are-art-prices-calculated/), [Houzz](https://www.houzz.in/magazine/lets-put-a-price-on-art-your-guide-to-art-costs-and-buying-stsetivw-vs~12119893), [Creative Spark thread](https://creativespark.art/threads/prices-for-paper-vs-canvas-and-panel.915).
- Part of the gap is perception and the fact that paper works are smaller; framing a paper work is an extra cost that the lower price does not recover. (Creative Spark thread.)
- **No source gives a coefficient** for paper ÷ canvas or watercolour ÷ oil. A dealer example: a gallery's works on paper at $2 500 – $7 500 as an « entry point » ([Guy Hepner](https://www.guyhepner.com/sage-barnes/works-on-paper)) — one dealer, not a benchmark. **Honest conclusion: the coefficient is the artist's own, set against his comparables.** That is exactly what §5 asks.

### 3.3 France: la « cote »

- The Akoun cote (*La Cote des peintres*, since 1985) is built on **sales results**, referenced to a **standard 65 × 50 cm** format (= 3 250 cm²), so that artists compare at equal size. [ArtMajeur — Akoun certification](https://artmajeur.com/en/official-artist-certification-akoun), [Artsper](https://blog.artsper.com/fr/artstyle/fixer-le-prix-dune-peinture).
- A cote needs at least three sales results; an unknown artist's prices follow the format (size) of the canvas. (Same sources.)
- French canvas formats are numbered (F figure, P paysage, M marine; e.g. 3 F = 22 × 27 cm; 15 P ≈ 65 × 54): a price is quoted **per format number**, not per cm². The Artsper example cited there: 3 F sold at 500 € → cote 2 500 € for a 15 P — a worked illustration, not a coefficient.
- **Not found:** an official point system with a coefficient for paper versus canvas. The cote's own coefficients sit in the paid book/database. Do not invent them.

### 3.4 Editions (multiples)

- A limited-edition print is commonly priced at **10 – 20 % of a comparable original** (a single-source rule of thumb). [Arthelper thread](https://www.arthelper.com/community/artbusiness/post/pricing-prints-when-the-same-image-can-be-reprinted-forever) and the artist-advice pages above.
- **Step pricing**: the price rises as the edition sells out, rewarding early buyers. Worked example from a London print publisher: copies 1–20 £800, 21–40 £1 000, 41–60 £1 250, 61–80 £1 500 (about +25 % per tier). [Unit London](https://editions.unitlondon.com/products/jacky-tsai-floral-horse); the mechanism and rationale: [Ivana George](https://ivana-george.squarespace.com/blog/2015/5/28/learn-why-tiered-pricing-of-limited-edition-fine-art-prints-is-good-for-everyone-involved), [CreativeHub](https://creativehub.io/help/how-do-i-price-limited-editions-over-time-to-build-value/), [Artfolio](https://www.artfolio.com/article/editioned-print-add-ons-use-scarcity-tiers-to-upsell-hesitant-collectors).
- Integrity rule: never re-issue a sold-out edition in the same format; it breaks the value of the earlier copies. (Same sources.)
- What a design would need to store: edition size, number sold (the tier), the price per tier, the original the print refers to. **None exists today** (§1.2).

---

## 4. Pem's rule as the data shows it

| Pem's statement | What the data can say | Verdict |
|---|---|---|
| Paper works (watercolour, drawing, ink, graphite) cheaper than paintings | 0 priced works in those techniques | **cannot be measured** |
| Oil on linen dearer than watercolour at equal size | oil priced: 2 (1 credible); watercolour priced: 0 | **cannot be measured** |
| Large canvases dearer | 55 works > 4 000 cm², 0 priced; the only priced oil sizes are 1 247 and 1 665 cm² | **cannot be measured** |
| Multiples cheaper | no multiple field; 0 priced | **cannot be measured** |

The single credible point: **oil on oil paper, 42 × 29,7 cm (1 247 cm²), 2022, 2 000 €** → 1,60 €/cm², or 27,9 € per linear cm of `H + W` (71,7 cm). One point fixes one number, not a coefficient.

### What the data does tell us about the *shape* of the work

1. **Two tiers by volume**: ≈ 800 small works on paper (mean ≈ 300 – 500 cm², A5 – A4) and ≈ 330 oils (mean ≈ 2 200 cm²). A price rule that treats them with one rate would be wrong for both.
2. **Oil splits three ways by support**: canvas 122, oil paper 111, others ≈ 99. The oil-paper group is the closest thing to a « between » tier.
3. **A5 is a unit** (311 cm²): 250 works are format A5. Many paper works would be priced as « one A5 » rather than by cm².
4. **Break in pattern to watch for**: 4 prices out of range (§2.1); 71 works with no support, 64 with no technique and 368 with no size — a kind-based price cannot be computed for 31 % of the catalogue until those are filled.
5. The 21 + 20 half-null combinations (`Prix` 0 with `PrixFinal` null and the reverse) show `PrixFinal` is not always written with `Prix`: a pricing build must pick one source (readers use `PrixFinal ?? Prix`).

### A candidate shape to test with Pem (not a decision)

A price rule that matches how he describes it needs only three small things, all lookups the app already has except the last:

- **a kind** = Technique group × Support group (e.g. « oil on canvas », « oil on paper », « drawing on paper », « watercolour »): a grouping of the existing 24 × 20 lookups, not a new table of works;
- **a rate and a size curve per kind** (€ per A5-unit, per cm², or per linear cm; and how fast it rises with size);
- **a multiple flag** with edition size and tier steps (new; no home today).

Everything is a read computed from existing fields, in the spirit of Principle 1: the rule in code/params, the screen shows a suggested market price beside the floor. Whether the rule becomes a table is a later question; Pem edits it « once a year » (ReversePricing §9 row 18), so the same code-file approach fits.

---

## 5. Questions for Pem (answer by voice, short)

1. Do you have a price list somewhere (sheet, notebook, a gallery's price list, a recent sale) that I may see? Without one I have only one real price in the app.
2. The 3 odd prices (6 000 000 / 180 000 000 / 20 002 000 000) — typing errors? Can I list them for you to correct?
3. Give me three real prices you would ask today: a 30 × 40 oil on canvas, an A4 pencil or ink drawing, an A5 watercolour. Framed or not?
4. Same size, same subject: oil on canvas versus oil on oil paper versus a drawing — roughly what fraction of the canvas price is each?
5. Do you price **per size** (a rate times cm², or times length), by **format steps** (A5 / A4 / 40 × 50…), or by **feeling**? Which one is closest?
6. At what size does a canvas jump a class? (for example above 80 × 100, or above 1 m²)
7. Is oil on **canvas** (Toile) always dearer than oil on **paper** (P. huile) at the same size? Is linen worth more than cotton to you, and should we record it?
8. Which techniques are in the **same price family**? (Crayons, graphite, pierre noire, encre noire, sanguine: one drawing family? Gouache, aquarelle, tempera: another?)
9. A **multiple**: do you make prints or editions today, or plan to? Edition size, and one price or a price that rises as copies sell?
10. How much of the original's price should a print be: 10 %, 20 %, other?
11. Does the **same price** hold for every size of the same kind, or are some works « priced by sentiment » that no rule should touch? Should the rule only suggest, never fill?
12. The 368 works with no size and 71 with no support: may the phone ask you to fill them as you go, or do you want them left?
13. When a work sells, is the price you ask in the studio today **the list price**, or do you already give a discount to friends / patrons? (Discount is 0 everywhere in the data.)

---

## 6. Gaps in this survey

- Prices read only from `Oeuvres` and sales tables; any price list kept **outside the app** (paper, sheets, a gallery's own list) is invisible to this survey.
- Sources in §3 are practitioner pages, not sales data; they give no coefficient for paper ÷ canvas or watercolour ÷ oil. The Akoun cote coefficients are behind the paid book/database and were not read.
- Linen vs cotton, framed vs unframed (`Encadree` is false on every row) and edition status are not recorded, so even a perfect price list could not be split on them yet.
- Surface uses `Hauteur × Largeur` as typed; round works (one field at `WorkCardIdentity.tsx:129`) are not corrected for π/4, so their surface is overstated by about 27 %. 8 + 2 + 1 round-support works only.
