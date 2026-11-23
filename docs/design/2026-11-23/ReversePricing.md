# Reverse pricing — design draft (2026-11-23)

Status: **local draft**, design only, no code, no SQL. Asked by Pem 2026-11-23 (« Ok for the draft on the reverse pricing »); build is after the pause (17 Dec 2026). Mockup: [`ReversePricing_Mockup.html`](./ReversePricing_Mockup.html) (invented numbers only). Source of the need: [`CatalogueGaps.notes.md` §J](../2026-11-19/CatalogueGaps.notes.md#j-reverse-pricing-new-from-question-6), [`MasterPlan.md` §3](../2026-11-20/MasterPlan.md) (row « Reverse pricing » + « Micro-BNC charges »).

Read in code by the `scout` (2026-11-23, not the live DB): file:line given below. Not read: the full `saveWork` write path, `FiscalByYear` internals, the live schema.

---

## 1. Answer first (Building Principles §2)

| Question | Answer |
|---|---|
| **Which kind of thing?** | A **read** (a derived view), not a record. Pem gives a target; the machine answers a price. Nothing in it needs to be remembered. |
| **Which home?** | The **work card's price block** (the folded « one line per channel » of notes J), plus the same function behind the order form's price line. The rates it needs live in **one small file in code** (`lib/pricing/params.ts`) shared with Fiscal — not a table. |
| **What changes?** | **Nothing is written** by the calculator. One optional button « Appliquer ce prix » writes **only `Oeuvres.Prix`**, through the existing work door (`saveWork`; a non-admin goes to `pending_changes` as today). No wholesale field (decided: it falls out). |
| **Why no existing home fits?** | There is no pricing screen or calculator in the app (the split `catalogue × (1 − discount)` is inline in `NewOrderForm.tsx:171-177`). A new table would hold only numbers Pem changes once a year; a constants file already exists in spirit (`Fiscal.tsx:32-37` hard-codes the thresholds and `URSSAF_RATE = 0.211`). So: no new table, no new door, no new screen. |

A standalone tool was rejected: the price is a property of a **work** (its size, its costs, its framing) — it belongs on the card Pem already opens. A Commandes screen was rejected: an order *records* a price already agreed; the reverse calculation is made **before**, from the work.

---

## 2. What it reads (all exists today)

| Input | Source | Note |
|---|---|---|
| List price, discount, final price, VAT rate of the work | `Oeuvres.Prix`, `Discount`, `PrixFinal`, `tva_rate` (types :2326, 2350, 2351, 2364) | Today's price, shown beside the computed one. |
| Size | `Oeuvres.Hauteur`, `Largeur`, `Profondeur` (strings, :2335, 2341, 2357) | Parsed to cm → m². No size → the rule falls back (§4). |
| Costs already spent on this work | `expense_oeuvre.amount` (:1262) via `expense` (`cost-actions.ts:43-96`) | Real materials, framing, photo… linked to the work. |
| Costs planned, not yet spent | typed in the block, **not saved** | A work not yet framed: Pem types « cadre 180 ». |
| Supplies in stock | `stock_item.cost_unit` (:3379) | Optional shortcut for materials; not in v1. |
| Gallery commission | the consignment `work_order.commission_pct` of that gallery (`orders-actions.ts:405-409`); a gallery is a `Contact` with role gallery | The % is already per order, not per gallery: the block reads the **last consignment of that contact** as the default, editable. |
| Default discount | the work's own `Discount`, else the channel default in params | |
| Running costs of the year | `expense` rows of the chosen categories, minus what is already split to works | See §4. |
| Social contributions rate | `lib/pricing/params.ts` (today `URSSAF_RATE` in `Fiscal.tsx:35`, moved there) | From the accountant. |

## 3. The formula, written out

**Under micro-BNC the « charges » are the artist-author social contributions (URSSAF), a % of the money received — not income tax.** They are owed on receipts whatever the costs: micro-BNC ignores real costs, so a € of material cost does not lower them. That is why they act as a *multiplier* on what comes in, never as a cost line. Income tax is **left out** (it depends on Pem's household; an optional « after tax » line can come later, off by default). VAT: Pem is under the franchise today (the app tracks the ceilings, `Fiscal.tsx:32-37`); VAT is a switch, off by default, applied on top of the HT price.

Symbols (per work, per channel):

- `N` — **net wanted**: what Pem keeps in his pocket for this work, after everything.
- `c` — commission of the channel, % of the price the buyer pays (gallery, platform); 0 for studio and fair.
- `d` — discount granted to the buyer, % of the list price.
- `r` — social contributions rate, % of what the studio receives.
- `M` — direct costs of the work: materials + framing + photo + …
- `X` — costs of the channel: shipping to the gallery, stand share of a fair, platform packaging…
- `S` — share of running costs (rule of §4).
- `K = M + X + S` — all costs.

Forward (what Pem receives for a sale at list price `L`):

```
price paid       = L × (1 − d)
studio receives  = price paid × (1 − c)
after contrib.   = studio receives × (1 − r)
net kept         = after contrib. − K
```

Backward (the calculator):

```
floor price  P  = (N + K) / ((1 − c) × (1 − r))     lowest price paid that still gives N
list needed  L  = P / (1 − d)                        what to ask so the discount can be given
list shown      = L rounded UP (10 € under 5 000 €, 50 € above) a human price
wholesale   W   = (N + K) / (1 − r)                  Pem sells outright to a gallery: no commission, no discount
```

Rounding is always up, and the block shows the **real net at the rounded price**, so the rounding is never a hidden loss.

**One list price.** An art price must be the same in the studio and the gallery. So two modes: *per channel* (each channel's own `L`, to see the gap) and **« un seul prix »** (default): `L = the highest rounded L` over the channels in use; the block then shows, for every channel, the net kept at that price and the **maximum discount that still keeps `N`**: `d_max = 1 − P / L`.

### Worked example (invented numbers)

Painting 80 × 100 cm (0.8 m²). Net wanted `N = 1 000 €`. `r = 21,1 %` (the app's current constant — **to confirm with the accountant**, not a fact). Materials 120 €, framing 180 €, running-cost share 150 €/m² × 0.8 = 120 € → `M + S = 420 €`. Rounding up to 10 € (under 5 000 €), VAT off.

| Channel | `c` | `d` | `X` | `K` | Floor `P` | List needed `L` | Rounded |
|---|---|---|---|---|---|---|---|
| Studio sale | 0 % | 10 % | 0 | 420 | 1 799,7 | 1 999,7 | **2 000** |
| Gallery, consignment | 40 % | 10 % | 60 (shipping) | 480 | 3 126,3 | 3 473,7 | **3 480** |
| Fair | 0 % | 0 % | 140 (stand share + trip) | 560 | 1 977,2 | 1 977,2 | **1 980** |
| Online | 15 % | 0 % | 80 (shipping) | 500 | 2 236,6 | 2 236,6 | **2 240** |

Check, studio line: 2 000 × 0,90 = 1 800 → × 0,789 = 1 420,2 → − 420 = **1 000,2 €** ✓.

« Un seul prix » → the gallery is the binding channel → **list price 3 480 €** everywhere. Net kept at 3 480 €:

| Channel | Net kept | Max discount keeping 1 000 € |
|---|---|---|
| Studio | 2 051 € | 48,3 % |
| Gallery | 1 003 € | 10,2 % |
| Fair | 2 186 € | 43,2 % |
| Online | 1 834 € | 35,7 % |

Wholesale (outright sale to a gallery, shipping 60): `(1 000 + 480) / 0,789 = 1 875,8 €` — about **54 %** of the 3 480 list. This answers « question 6 » of the gaps notes without a stored wholesale field.

What the example teaches Pem: at 3 480 € the studio sale leaves 2 051 €, so Pem knows he may give 48 % off in the studio before the work sells below his need; the gallery channel, not the studio, sets the price.

---

## 4. The running-cost share `S` — the one rule to choose

Running costs = studio rent, insurance, fees, accountant, software… (the expense categories Pem ticks as « running »; the 10 French categories are hard-coded in `Fiscal.tsx:39-50`). **Never counted twice:** an expense already split to works through `expense_oeuvre` stays a direct cost `M` and leaves the running pool.

Candidate rules (Pem picks one, a fallback is kept for works the rule cannot size):

| Rule | `S` = | Good for | Weak for |
|---|---|---|---|
| **per m²** (proposed) | rate × surface; rate = last year's running pool ÷ m² made last year (read from `expense` + `Oeuvres.Année`) | paintings, any flat work: size is already in the catalogue | sculpture, books, video, tiny drawings |
| per hour | rate × hours of the work | all works, fair to a slow drawing | needs hours typed per work — nothing stores them today |
| flat per work | pool ÷ number of works made last year | simplest | a 20 cm study carries the same as a 2 m canvas |
| % of the net | a % of `N` | trivial | hides the cost behind the target itself |

**Superseded by Pem's answers (§9): default is flat per work, all rules switchable.** Earlier proposal: **per m²** as the rule, **flat per work** as the fallback when no size is readable; the rate is **computed from last year's real expenses**, so Pem types nothing, and he can override it in the block for one work.

## 5. What writes, what reads (Flow)

**Writers:** none, by default. Optional « Appliquer ce prix »: `saveWork` → `Oeuvres.Prix` only (same door, same `pending_changes` and `oeuvre_versions` behaviour as every price edit). Nothing is written to `work_order`, `expense` or any new table. Commandment 1 (the database holds the rule) is respected by not inventing a rule: the floor is **advice**, not a constraint.

**Readers of what is computed:** the work card block (desk drawer and phone card, same function). Readers that *change* in the build:
- `NewOrderForm.tsx:171-177` and the Pipeline sale step: the inline split moves to the shared function; a price under the work's floor shows a **warning**, never a block (Pem may sell below on purpose; the order door keeps its guards).
- `Fiscal.tsx:32-37`: `URSSAF_RATE` and the thresholds move to `lib/pricing/params.ts`; the Fiscal screen reads them from there — same values, one place.
- Reports (`report-sources.ts:103-104`) and the sales screen: a later « marge » column can call the same function; **not in this draft**.
- A consignment paper (list / commission / net, notes J): reads the same function if that paper is built; not checked whether it exists.
- Public site, portfolio PDF, collector kit: **do not** read it — the floor and the net are private; only `Oeuvres.Prix` is ever shown, as today.

**Not changed:** `work_order` triggers, race guards (`order_race_guards.sql:67`), the receipts book, the sales income read (`lib/sales/income.ts`).

## 6. Faces

**Desk — a mixing desk, one block, nothing hidden** (see the mockup). Left strip: the target (net wanted) and the cost lines (materials, framing, size, running rule, rate). Right: one **column per channel** with its three knobs (commission, discount, channel cost), and under it the answer rows — floor, list needed, rounded list, **net at the chosen list**, max discount — plus the wholesale line. A switch « un seul prix / par canal ». The block starts **collapsed** on the work drawer and reads nothing until it is opened (one line: « Plancher 1 876 € · liste 3 480 € »), like every pivot or side section. Changing a knob recomputes instantly; no save.

**Phone (`/hub` work card) — read first, adjust second.** One line per channel (name, list price, net kept), folded; tap a channel to open its three knobs; the net wanted is one field at the top. Same function, same numbers; taps ≥ 44 px; « Appliquer ce prix » is the only primary action. By the principle of phone = full terminal, nothing is desk-only.

## 7. Scenario Pem can check (on the throwaway copy first, Principle 12)

1. Open a painting with a size and a price. The price block shows, folded: « plancher · liste ».
2. Type net wanted **1 000**. Costs fill from the work's expenses; type « cadre 180 » for the not-yet-spent one.
3. Rule per m²: the running share appears with its source (« 150 €/m² = frais 2025 ÷ m² 2025 »). Override it once: the answer moves.
4. Read the four channels. In « un seul prix » the gallery sets the list; each channel shows its net and its max discount.
5. Set the gallery commission from 40 to 50: list rises; the studio net rises with it; the wholesale line does not move.
6. Press « Appliquer ce prix »: only `Prix` changes; the work's history shows one price version; as a team account the change waits for approval.
7. Open a new sale of that work in the order form at a price under the floor: a warning, the sale is still possible.
8. Check on paper: take one channel, run the forward formula by hand — the net equals the target within the rounding.

## 8. What is not decided (kept out on purpose)

- Income tax after micro-BNC (34 % allowance) — not a price input.
- VAT liability — switch exists, default off while under the franchise.
- Resale right (droit de suite) — Pem is not in a collecting society; not in the price.
- Editions (a run's cost spread over prints) — waits for the Editions design; the cost `M` already accepts a per-print figure.

## 9. Pem's answers (2026-11-23, spoken) and what they change

Rule taken from them: **« I don't know » = keep every option open.** The block offers all rules and all channels as switches, with a default; nothing is locked by a database column. Nothing here needs a new table.

| # | Pem said | Decision in the design |
|---|---|---|
| 1 | Dislikes per m²; does not want to give up options | The rule is a **switch in the block** (per m², per hour, flat per work, or a typed sum). **Default: flat per work** (no size, no hours needed), per m² stays one click away. Net wanted stays a typed sum. |
| 2 | No other cost items now | Direct costs = materials, framing, photo, shipping, plus a free « autre » line typed per work. More can be added in code later. |
| 3 | All 10 expense categories are running costs | **Pool = every `expense` of the year**, minus what is already split to works (`expense_oeuvre`) — so nothing is counted twice. No category picker. |
| 4–5 | Rule and fallback: don't know | Default flat per work, also the fallback when no size is readable. The three rules stay switchable (row 1). |
| 6 | « Does it make sense? » | Yes: the rate follows what the studio really spent last year, so Pem types nothing and it self-corrects each year. A typed override stays in the block. Shown with its source (« frais 2025 ÷ N œuvres »). |
| 7 | 21,1 % ok the first year; probably does not change with turnover; not sure | Keep **21,1 %** as the one constant in `lib/pricing/params.ts`, marked **« à confirmer avec le comptable »** in the block. |
| 8 | « For value: full price. For income: net of commission » | Both views, one formula: the **value view** shows the full price paid; the **income view** (the formula of §3) applies contributions on the net of commission. Accountant to confirm for the declaration. |
| 9 | Also **mécène**, **public institutions**, and so on | Channels are **rows with free knobs**, not an enum. Starter rows: studio, gallery, fair, online, **mécène / institution** (commission 0). A row can be added in the params file. |
| 10 | Commission pattern exists but is particular to each place | Never one global %: it is read from that gallery's last consignment (`work_order.commission_pct`) and editable. |
| 11 | Discounts not decided; needs guidance from experience | Default discount **0 %** on every channel. The block's « **remise maximale qui garde le net** » line is the guidance: it shows how much can be given before the work sells under need. |
| 12 | Shipping paid by the buyer, flexible | Default channel shipping cost **0**; a knob per channel when Pem pays. |
| 13 | Fair stand fee: what is common practice? | Common practice: the fee plus travel is **one cost per fair, divided by the number of works expected to sell** (Pem types the expected count). Typed per fair; proposed default. To confirm with a gallery-owner friend. |
| 14 | **One list price everywhere** — different prices make buyers feel robbed; a gallery's work is not sold cheaper on his own site, people are redirected to the gallery | **Confirmed as the rule** (« un seul prix » on by default). Product consequence, to build later: a work held by a gallery shows no price and a « voir la galerie » link on pem's site — out of this draft, noted for R8. |
| 15 | Rounding: **10 € below 5 000 €, 50 € from 5 000 €** (confirmed) | Round up with those two steps (one constant in params). The example of §3 uses these steps. |
| 16 | « Appliquer ce prix »: no idea what it means | It is a button that **copies the computed list price into the work's Prix field** — one click, never automatic. Proposed: **keep it, off the first build** (calculator read-only first); add it when Pem has used the numbers. |
| 17 | VAT: still franchise, if understood | VAT switch stays **off**. |
| 18 | Hard to visualize; whatever is best | **Rates in a code file** edited once a year (my change, not a screen). No table. |

## 10. Still open (short)

1. **Accountant** (not Pem's to know): contributions rate for the year, and how a consignment receipt is declared — collected with the other accountant facts already waiting in TODO §2.

Closed 2026-11-23: rounding = 10 € below 5 000 €, 50 € from 5 000 €; a « suggest from hours » helper for the net wanted = yes, later (not in the first build).
