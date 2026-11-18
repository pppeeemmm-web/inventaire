# Lignes commerciales de l'atelier / Studio commercial guidelines

**Status: first draft, 2026-11-18 (Pem: « go »). Nothing decided, nothing printed, nothing in the app changed.** Every `[[…]]` is a choice only Pem makes; lines tagged *lawyer* / *accountant* wait for them ([`LEGAL_POLICY.md`](./LEGAL_POLICY.md) §7). The small open points live in [`POLICY_NOTES.md`](./POLICY_NOTES.md).

**What these guidelines are for** ([`STRATEGY.md`](./STRATEGY.md), aim 4 « Value »): one way of selling that is fair to every buyer, protects the value of the work over time, and keeps galleries' trust. The rules are few on purpose — Pem stays free per case, but a departure is a decision written on the order, not a habit.

---

## 1. Prices

1. **One price per work, everywhere.** The studio, a gallery, a fair, the website and a private sale show the same price for the same work. A gallery's commission comes out of that price, never on top of it. (This is what galleries check first.)
2. **How a price is set:** [[method — e.g. by size (height + width in cm × a coefficient per medium), by series, or case by case]]. Coefficients: oil on canvas [[…]], oil on paper [[…]], works on paper [[…]], editions §5.
3. **Prices go up, never down.** Reviewed once a year in [[month]]; a typical step is [[5–10 %]] when works sell. A work's price is never lowered in public; a work that does not sell can leave the public list (Archive artiste) rather than be marked down.
4. **Shown or « on request »:** [[prices shown on the website / on request only / shown for editions only]].
5. **Currency:** euro. A foreign buyer pays in euro; conversion costs are theirs.
6. **The price on the paper** is the work alone; framing, shipping and insurance are separate lines, shown before signature ([`POLICY_NOTES`](./POLICY_NOTES.md) D5, I3).

## 2. Discounts

1. **Only Pem grants a discount.** A gallery holding works on deposit may grant up to [[x %]] without asking, shared [[50/50]] between gallery and studio; above it, Pem's written OK (deposit paper — *lawyer*).
2. **Ceiling:** [[10 %]] on a single work, [[15 %]] on several works bought together. Above the ceiling = an exception, its reason written on the order.
3. **Usual cases:** a public collection / museum ([[10–15 %]]); a collector's [[second / third]] work (§3); several works in one order; a fellow artist or a friend of the studio [[case by case]].
4. **Never discounted:** [[editions? / commissions? / works under [[€…]]]].
5. **Recorded, never shown:** the discount is on the order (`discount_pct`, exists) and the paper shows catalogue price, discount and final price; the public price never changes.
6. A discount is never offered to close a sale under pressure, nor time-limited (« -20 % this week only ») — it would lower the work's value for everyone who bought before.

## 3. Collectors and loyalty

The aim is a relationship, not a points scheme.

1. **The collectors' circle** — anyone who has bought or received a work:
   - **first look** at new works before they go public ([[48 h / a week]]), by a private link (TODO 11b « collector share kit »);
   - invitations to openings and to **studio visits**;
   - **priority on editions** (§5) and on commissions (§4);
   - a yearly letter / news of the works they own (exhibited, published, lent).
2. **Loyalty discount:** from the [[second]] work, [[5 %]]; never stacked with another discount beyond the §2 ceiling.
3. **Payment in instalments** for a collector: up to [[3 / 6 / 10]] monthly payments, no interest; ownership passes at the last payment (house rule, LEGAL_POLICY decision 6), the work leaves the studio [[at the first / last payment]].
4. **Provenance care:** each buyer receives the COA and the work's history; the studio keeps the record for the life of the work (LEGAL_POLICY §5).
5. **Resale:** a collector who wants to sell is asked to offer the work to the studio first ([[right of first refusal — wording for the lawyer]]). The artist's resale right (*droit de suite*) applies to professional resales above a threshold [R: €750 in France — *lawyer*].
6. **Lending back:** a collector may be asked to lend a work for an exhibition (loan « reçu », R7 « Works coming back in », parked).

## 4. Commissions (commandes particulières)

1. A brief in writing: subject, size, medium, delivery date, price.
2. **Deposit** [[30 %]] at signature, [[non-refundable / refundable minus the work done]]; balance before delivery.
3. **One sketch / study approval** step; [[one]] round of changes included.
4. Pem keeps the right to refuse a commission that does not fit the practice, and the copyright on the work (always — reproduction rights are a separate licence, §6).
5. The 14-day return on a commission: [[applies / does not apply to a work made to the buyer's specification — *lawyer*: the legal right excludes made-to-order goods]].

## 5. Editions (prints, books, other products)

1. An edition is numbered: [[30]] + [[5]] artist's proofs (« 30 + 5 EA », R6), one catalogue entry, the copy number on the order line, one COA per copy.
2. **Price steps:** the price rises as the edition sells ([[e.g. +10 % after a third, +20 % after two thirds]]) — the first buyers are rewarded.
3. An edition is never re-printed under the same number; a new size or paper is a new edition.
4. Books and other products (not unique, sold by quantity): their own price list; discounts §2 do not apply [[or apply?]].
5. Digital files are sold as a **licence**, never as the work ([`POLICY_NOTES`](./POLICY_NOTES.md) C2).

## 6. Galleries and partners

1. **Deposit (dépôt-vente):** commission [[40–50 %]] of the public price; price parity (§1.1); payment to the studio within [[30]] days of the buyer's payment; a sales report [[monthly / per sale]]; insurance on the gallery (« clou à clou »).
2. **Exclusivity:** [[none / by city / by country]], for [[a year]], written on the deposit paper.
3. **Reproduction rights** for the gallery's promotion of the works it holds: free, credit « © Pem … » [[wording]], no other use.
4. **Institutions:** loans on their own convention when they have one (LEGAL_POLICY §6), insurance and transport on them.

## 7. Gifts and support

1. Gifts of works ([[n]] a year at most): to people and causes Pem chooses; the paper never shows a price (LEGAL_POLICY §3).
2. **Charity auctions:** [[yes / no]]; if yes, a reserve price at [[x %]] of the public price, so the market price is not undercut.

## 8. In the app — today and to build

| Rule | Today | To build |
|---|---|---|
| Discount on an order | `discount_pct`, catalogue → final price on the paper | ceiling warning (§2.2) |
| Deposit / balance / instalments | `deposit_pct`, `deposit_due`, `balance_due`, several payments | instalment schedule on the order |
| Collector circle | contacts + their works | « collector » mark, first-look link (TODO 11b) |
| Editions | design R6 (one entry, copy numbers) | the products engine |
| Shipping + insurance as lines | — | R7b order cascade |
