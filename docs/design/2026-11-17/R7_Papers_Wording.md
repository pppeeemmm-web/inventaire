# R7 — The four order papers: wording for a lawyer / accountant to read (2026-11-17)

**Status: review document. No code, no SQL, nothing sent.** Written for Pem to hand to a lawyer or an accountant (or to read alone). It reproduces what [`lib/orders/order-paper.ts`](../../../lib/orders/order-paper.ts) prints today for the four papers, then, clause by clause, says what it commits Pem to and what is usually expected but is not there.

> **This is not legal or tax advice.** It is a reading aid prepared from public texts, by someone who is not a lawyer or an accountant. Where a rule depends on Pem's status (VAT-registered or not, artiste-auteur / BNC / company, buyer a consumer or a business), the document says so and asks. Every legal point needs a professional's confirmation before a paper is sent to a third party.

How to read the source tags:
- **[V]** the page was opened and read on 2026-11-17 (service-public, impots.gouv, notaires.fr).
- **[R]** a reference from general knowledge, or seen only in a search snippet: not re-read. Check the article on Légifrance before relying on it.
- Code home pages on Légifrance: [CPI](https://www.legifrance.gouv.fr/codes/texte_lc/LEGITEXT000006069414) · [Code de la consommation](https://www.legifrance.gouv.fr/codes/texte_lc/LEGITEXT000006069565) · [Code civil](https://www.legifrance.gouv.fr/codes/texte_lc/LEGITEXT000006070721) · [CGI](https://www.legifrance.gouv.fr/codes/texte_lc/LEGITEXT000006069577) · [Code de commerce](https://www.legifrance.gouv.fr/codes/texte_lc/LEGITEXT000005634379).

Source of the wording: `CONDITIONS`, `PARTY_ROLE`, `SIGN_ROLE`, `VALUE_HEAD`, the terms rows and the footer of `buildOrderPaper`, as of the current worktree. The file's own comment says it: « a plain draft for Pem to review — not legal advice ».

---

## 0. The short version — what stands out

| # | Point | Where | Why it matters |
|---|---|---|---|
| 1 | **No VAT line anywhere.** Prices print as « PRIX / PRICE » with no HT / TTC, no rate, no « TVA non applicable, art. 293 B du CGI ». | Vente (and Dépôt prices) | The first thing an accountant or a B2B buyer looks for. Pem's VAT status is not in the app (the works carry a `tva_rate`, the papers ignore it). See §2.2 / §6.1. |
| 2 | **A « bon de commande » is not an invoice.** The planned « Facture when paid » does not exist; there is no generator for it. | Vente | A business buyer needs an invoice with legal mentions; a consumer can ask for one. The legal mentions (SIREN, payment date, late penalties…) are absent. §6.2 |
| 3 | **The gift paper says « la propriété passe à la signature ».** A *don manuel* (a gift without a notary) is only valid if the work is **handed over** — it is the handover that completes it, not the signature. | Don | The app moves the owner at « signed » and the custody at « handed over ». That is a custody-model choice that may not match the law for a work given without a notary. Ask a lawyer first. §5 |
| 4 | **The cooling-off row prints whatever the channel.** In French law the 14-day right applies to *distance* and *off-premises* sales to consumers — not to a sale in Pem's studio, nor to a business buyer. | Vente | Printing it commits Pem to a right the law may not give (generous, but then the work is not « sold » for 14 days). §2.5 |
| 5 | **Reproduction rights and the moral right are not mentioned.** In French law the buyer of the object gets none of the author's rights unless a contract says so (CPI L111-3). | Vente, Don (Prêt partly) | One line protects Pem and prevents « I bought it, I can print it ». §6.4 |
| 6 | **Dépôt: no payment terms, no sales report, no price floor, no end-of-mandate rule beyond « returned ».** The paper does not say when the gallery pays Pem after a sale. | Dépôt | The most common dispute with a gallery. The notes say the paper « must say how and when Pem is paid » — it does not. §3 |
| 7 | **Insurance « clou à clou » is stated for the loan, but the deposit prints no insurance value** and neither paper says who pays or what happens on loss. | Dépôt, Prêt | §3.4, §4.3 |
| 8 | **Droit de suite is not Pem's to pay** (it is a levy on *resales* by art-market professionals), but nothing on the papers prepares it (e.g. a note that the first sale is by the artist). | Vente, Dépôt | Informational only. §6.3 |
| 9 | **Artist identity is name + address only.** No SIRET / SIREN, no VAT number or franchise mention, no artist-author number. | All four | Needed on an invoice, usual on a contract. §1 |
| 10 | **Only the labels are bilingual.** The conditions, terms rows and « Fait à Marseille » are French only. | All four | A foreign buyer or museum signs a French text. §1 |

---

## 1. The frame shared by the four papers

Every paper is one A4 page (or more if many works), made with the same layout. What changes is the title, the other party's role, the value column, the terms rows and one paragraph of « CONDITIONS ».

### 1.1 Header and footer, on every page

| Printed | Notes — what it commits / what is missing |
|---|---|
| `THE PEM WORKSHOP` (small), the paper title in FR (large) and EN (below), then `<ref> · <date> · page n / N` | The date is the **creation date** of the order (`createdAt`), not the signature date. The signature date is a blank line at the bottom. The ref is the order's series number (`V-`, `D-`, `P-`, `G-` + year + number). |
| Top right: `BROUILLON / DRAFT` while the order is a draft | The mark goes away when the order is marked « signed » (the paper is redone). A paper printed from a signed order carries no mark, even before the other party has signed — the status is Pem's, not both parties'. |
| Footer: `THE PEM WORKSHOP · <ref>` | No legal name, no SIRET. « The Pem Workshop » is a trade name; the legal person is Pem. See « Parties ». |

Titles (`PAPER_TITLE`):

| Kind | FR | EN |
|---|---|---|
| Vente | Bon de commande | Purchase order |
| Dépôt | Bordereau de dépôt-vente | Consignment agreement |
| Prêt | Contrat de prêt | Loan agreement |
| Don | Acte de don | Deed of gift |

*Note:* « Bordereau » (delivery slip) and « Acte » (deed, a formal term) are French words with a specific weight. A *bordereau de dépôt-vente* is a list-and-receipt; a real consignment is a **mandat de vendre** (Code civil, art. 1984 s. [R]) with duties on both sides. The paper is closer to a contract than its title says — worth aligning (see §3).

### 1.2 Parties (two columns)

Printed: `L'ARTISTE / THE ARTIST` — Pem's name and Pem's « Principal » address from the contact card (city + country if no address is stored). Right column, the role by kind:

| Kind | Right-column label (printed) |
|---|---|
| Vente | `ACHETEUR / BUYER` |
| Dépôt | `DÉPOSITAIRE / CONSIGNEE` |
| Prêt | `EMPRUNTEUR / BORROWER` |
| Don | `BÉNÉFICIAIRE / RECIPIENT` |

Below: the name (institution name, else first + last name) and the address chosen on the order.

| Commits Pem to | Missing — usually expected |
|---|---|
| Her name and address as the contracting artist. | **Legal identification:** SIREN / SIRET, status (« entrepreneur individuel »), VAT number or the franchise mention, artist-author affiliation if any. The service-public invoice sheet lists seller identity (name, « EI », address, SIREN) among the invoice mentions [V: [F31808](https://entreprendre.service-public.gouv.fr/vosdroits/F31808)]. A contract between businesses normally carries them too. |
| The other party's name and address. | For a company: legal form, registered office, representative (who signs, in what capacity). For a consumer: nothing more than name + address. For a minor or an association as recipient of a gift: the representative. The signature block has **no printed name or capacity** line. |

### 1.3 The works table

Header: `ŒUVRE / WORK` (or `ŒUVRES / WORKS (n)`). Per work: picture (thumbnail), title and year, medium · dimensions, `Réf. œuvre #<id>`, and **a value column that depends on the kind**:

| Kind | Column header printed | Value taken from |
|---|---|---|
| Vente | `PRIX / PRICE` | the order line's price, else the work's list price |
| Dépôt | `PRIX CONVENU / AGREED PRICE` | the order line's price, else the work's list price |
| Prêt | `VALEUR D'ASSURANCE / INSURANCE VALUE` | the line's insurance value, else the work's list price |
| Don | *(no value column)* | — |

| Commits Pem to | Missing |
|---|---|
| Describing each work by title, year, medium, size and the internal number. | **Edition / signature details** a buyer or a museum expects: edition number (« 2/8 »), signed / dated / where, support, framed or not, certificate reference. For prints and sculptures in editions the nature of the work (original, numbered edition) is something the rules on art transactions care about (décret n° 81-255 of 3 March 1981 [R]; confirm applicability to direct sales by the artist). The internal `Réf. œuvre #id` is the app's number, meaningless to the buyer. |
| A price per work (Vente, Dépôt) or an insurance value (Prêt). | No currency/VAT qualifier: is the number HT, TTC, or « TVA non applicable »? |

### 1.4 Signatures (last page, bottom)

Printed: `Fait à Marseille, le ______________________` then two signature lines: `POUR L'ARTISTE / FOR THE ARTIST` and the other party's role by kind:

| Kind | Printed |
|---|---|
| Vente | `POUR L'ACHETEUR / FOR THE BUYER` |
| Dépôt | `POUR LE DÉPOSITAIRE / FOR THE CONSIGNEE` |
| Prêt | `POUR L'EMPRUNTEUR / FOR THE BORROWER` |
| Don | `POUR LE BÉNÉFICIAIRE / FOR THE RECIPIENT` |

| Commits Pem to | Missing |
|---|---|
| A signed paper = the agreement, and the app's « signed » step moves the works (e.g. sale → reserved, gift → owner changes). The place « Marseille » is fixed. | **Number of originals** (« fait en deux exemplaires originaux »): for a two-party contract under private signature the Code civil asks for as many originals as parties, each stating the number (art. 1375 [R]). **Printed name, capacity, « lu et approuvé » are not required** but are customary. **Governing law and competent court** are absent (see §6.7). |

---

## 2. VENTE — « Bon de commande / Purchase order »

Used for: a work sold, by Pem, to a buyer (collector, company, gallery buying outright). Ref `V-YYYY-NNN`. Steps in the app: draft → signed (works reserved) → deposit paid → paid (owner = buyer) → delivered (custody = buyer, cooling-off starts).

### 2.1 What the sheet looks like

```
THE PEM WORKSHOP                                        [BROUILLON / DRAFT]
Bon de commande
Purchase order
V-2026-001 · 17 novembre 2026 · 1 / 1

L'ARTISTE / THE ARTIST                 ACHETEUR / BUYER
<Pem, address>                         <name, address>

ŒUVRE / WORK                                                  PRIX / PRICE
[img] <Titre> (<année>)                                          <1 000 €>
      <technique sur support> · <H × L cm>
      Réf. œuvre #<id>
----------------------------------------------------------------------------
Prix catalogue / List price                                       <1 250 €>
Remise / Discount                                                   <20 %>
Prix final / Total                                                <1 000 €>
Acompte / Deposit (30 %)                                            <300 €>
Délai de rétractation / Cooling-off          14 jours après la livraison

CONDITIONS
<text below>

NOTES          (only if filled)

Fait à Marseille, le ______________
POUR L'ARTISTE / FOR THE ARTIST        POUR L'ACHETEUR / FOR THE BUYER
```

### 2.2 The terms rows (as printed)

| Row (FR / EN, printed) | Printed when | Commits Pem to | Usually expected, missing / to check | Source |
|---|---|---|---|---|
| `Prix catalogue / List price` | a catalogue price exists | Nothing alone; it is the reference for the discount. | Whether the price is **HT, TTC or « TVA non applicable »**. | §6.1 |
| `Remise / Discount` — `<n> %` | discount > 0 | A concession on the list price, written. | — | — |
| `Prix final / Total` | always (« — » if empty) | **The price the buyer owes**. | **HT / TVA / TTC split** or the franchise mention; the currency is printed with the amount only. For a business buyer, a price without VAT mention is ambiguous (is VAT added?). | [V] [service-public F32113](https://entreprendre.service-public.gouv.fr/vosdroits/F32113): invoices excluding VAT carry « TVA non applicable – article 293 B du CGI » when in franchise; sales of an original work by its author are at **5.5 %** (VAT-registered case). [V] [BOFiP BOI-TVA-SECT-90-40](https://bofip.impots.gouv.fr/bofip/1285-PGP.html/identifiant=BOI-TVA-SECT-90-40-20250514): reduced rate extended to all art deliveries from 1 Jan 2025. |
| `Acompte / Deposit (n %)` | a deposit % and a final price exist | A deposit amount (rounded to the euro) due before delivery. | **Balance due date, payment method, bank details, late-payment terms**. Not printed. For **off-premises** sales to a consumer, the Code de la consommation limits taking a payment in the first days after signing (art. L221-10 [R] — to confirm; it does not apply to a sale in the studio). | §2.5 |
| `Délai de rétractation / Cooling-off` — `<n> jours après la livraison` | `return_window_days` set on the order | **A right for the buyer to cancel within n days of delivery** — whether or not the law gives it. | See §2.5: the legal right is for consumers in **distance / off-premises** sales; a studio sale and a business buyer do not have it by law. The paper does not say how to exercise it, who pays the return, or that a made-to-order work is excluded. | [V] [service-public F10485](https://www.service-public.gouv.fr/particuliers/vosdroits/F10485) (verified 1 Jan 2026). |

### 2.3 CONDITIONS — the printed text

**FR (printed):**
> La propriété des œuvres listées passe à l'acheteur au paiement complet du prix ; jusque-là elles restent la propriété de l'artiste. La garde passe à l'acheteur à la livraison ou à la remise en main propre.

**EN (reading translation, *not* printed — the paper prints French only):**
> Ownership of the listed works passes to the buyer on full payment of the price; until then they remain the artist's property. Custody passes to the buyer on delivery or hand-over.

| Clause | Commits Pem to | Usually expected, missing / to check | Source |
|---|---|---|---|
| **« Propriété … au paiement complet »** | A **reservation of title** (clause de réserve de propriété): Pem stays owner until fully paid. The app mirrors it (« Vendu », owner = buyer only when paid). | A reservation of title must be agreed in writing, at the latest at delivery (Code civil art. 2367 s. [R]) — this paper is that writing once signed. It also usually says **who bears the risk** meanwhile (below). | [R] Code civil art. 2367–2372. |
| **« La garde passe … à la livraison »** | From delivery the buyer holds the work. | **Risk of loss / damage**: for a consumer, the law puts the risk on the seller until the buyer takes physical possession (Code de la consommation L216-4 [R]). The paper does not say who insures or pays transport. | [R] C. conso. L216-4. |
| *(absent)* **Delivery** | — | Date or place of delivery, who pays transport / packing / installation. Today the delivery address is stored in the order but not printed. | — |
| *(absent)* **Payment terms** | — | Method, bank details (IBAN), balance due date, late penalties; for professional buyers the €40 recovery fee and a penalty rate are *mandatory invoice mentions* [V: [F31808](https://entreprendre.service-public.gouv.fr/vosdroits/F31808)]. | — |
| *(absent)* **Authenticity / certificate** | — | A line that a **certificate of authenticity** comes with the work (the app makes COAs separately in the Vault). | — |
| *(absent)* **Moral right and reproduction** | — | See §6.4: one line that the sale of the object transfers no reproduction right and that the moral right (name, integrity) stays with the artist. | CPI L111-3, L121-1 |
| *(absent)* **Consumer information** | — | For a consumer: the legal guarantee of conformity (2 years — the service-public invoice sheet lists it for B2C [V]), the consumer mediator (C. conso. L612-1, L616-1 [R]), and the withdrawal information where it applies. | §2.5 |
| *(absent)* **Governing law / court** | — | §6.7. | — |

### 2.4 What Pem is committing to, in plain words

By signing a Vente paper, Pem promises to deliver the listed works for the final price, keeps them as hers until paid in full, accepts a cancellation right if one is printed (**by default the cooling-off row is only printed when a number is set**), and — because the app moves the works at « signed » — the works are **reserved** for that buyer from signature.

### 2.5 Cooling-off (« délai de rétractation ») — what the law actually says

- **Consumer, distance sale** (internet, phone, mail) **or off-premises**: 14 calendar days from the day after receipt of the goods; goods **made to the consumer's specification or clearly personalised are excluded** (C. conso. L221-18, L221-28). **A sale in the seller's own premises is not covered.** [V] [service-public F10485](https://www.service-public.gouv.fr/particuliers/vosdroits/F10485) (« does not mention a withdrawal right for purchases made in a shop »; period starts the day after receipt).
- **Business buyer:** no statutory right.
- **At a fair or salon:** a consumer buying on a stand has no right but must be told so in writing (art. L224-59 [R]); relevant if Pem sells at a salon.
- **Open studio / in the atelier sale:** no right by law. Printing 14 days anyway is generous and means the sale is not final for 14 days after delivery.
- Where the right *does* apply, the buyer must be informed of it and of how to exercise it (a model form exists, C. conso. L221-5, R221-1 s. [R]); the paper prints one line, no form, no return-cost rule. Not informing extends the period up to 12 months [V, same page].

*Question for the lawyer:* keep the row for every sale, only when the sale is at a distance, or never (and state « pas de droit de rétractation » for studio sales)? The app already stores `return_window_days` per order, so the choice is a form default, not a rebuild.

---

## 3. DÉPÔT — « Bordereau de dépôt-vente / Consignment agreement »

Used for: works placed with a gallery or dealer to sell, Pem staying owner. Ref `D-YYYY-NNN`. Steps: draft → signed → out (works « Consigné », custodian = gallery) → closed (works back, or sold through the deposit).

### 3.1 The sheet

```
Bordereau de dépôt-vente / Consignment agreement          [BROUILLON / DRAFT]
D-2026-001 · date · 1 / 1

L'ARTISTE / THE ARTIST                 DÉPOSITAIRE / CONSIGNEE
ŒUVRES / WORKS (n)                                  PRIX CONVENU / AGREED PRICE
[img] title (year) / medium · dims / Réf. œuvre #id               <price>
----------------------------------------------------------------------------
Commission du dépositaire / Commission     <40 % du prix de vente>
Période / Period                           du <date> au <date>

CONDITIONS · NOTES · signatures (POUR LE DÉPOSITAIRE / FOR THE CONSIGNEE)
```

### 3.2 The terms rows

| Row printed | Printed when | Commits Pem to | Missing / to check |
|---|---|---|---|
| `Commission du dépositaire / Commission` — `<n> % du prix de vente` | commission set | **The gallery keeps n % of the sale price.** | **Of the HT or the TTC price?** Is it computed after the gallery's discount? Does the gallery's commission carry VAT (it is a service; the gallery's VAT status matters)? **When and how Pem is paid** after a sale (delay, statement). Not printed. |
| `Période / Period` — `du <date> au <date>` | always (dates now required by the form) | The deposit has a fixed period (out → back by). | What happens at the end: **renewal, tacit or not; notice to withdraw early**; the gallery's **duty to return** by a date. The text says « rendues … à la fin du dépôt ». |

### 3.3 CONDITIONS — printed text

**FR (printed):**
> Les œuvres listées sont confiées au dépositaire en vue de leur vente, aux prix convenus ci-dessus, pour la période indiquée. L'artiste en reste propriétaire jusqu'à leur vente. Le dépositaire en assure la garde et l'assurance pendant toute la durée du dépôt, et ne peut ni les prêter ni les céder autrement que par une vente aux conditions convenues. Les œuvres non vendues sont rendues à l'artiste à la fin du dépôt.

**EN (reading translation, *not* printed):**
> The listed works are entrusted to the consignee with a view to their sale, at the agreed prices above, for the stated period. The artist remains the owner until they are sold. The consignee keeps custody and insurance for the whole deposit, and may neither lend nor transfer them other than by a sale on the agreed terms. Unsold works are returned to the artist at the end of the deposit.

| Clause | Commits Pem to | Usually expected, missing / to check | Source |
|---|---|---|---|
| **« confiées … en vue de leur vente, aux prix convenus »** | Authorises the gallery to sell **at the agreed prices only** (so no discount without Pem?). | **Discount authority** (how much the gallery may concede without asking), **exclusivity / territory**, whether the gallery may sell to its own network, **who invoices the buyer** (the gallery in its own name, or Pem). Legally a *dépôt-vente* is a mandate to sell (and a deposit): the mandatary must **account for** what it did (Code civil art. 1993 [R]). | [R] C. civ. art. 1915 s. (dépôt), 1984 s. (mandat). |
| **« L'artiste en reste propriétaire jusqu'à leur vente »** | Pem stays owner. | **Why the signed paper matters:** in the gallery's insolvency, deposited works can be **claimed back** (revendication) if still identifiable — a dated, signed list of works is the evidence (Code de commerce L624-9 s. [R]). Ask whether the paper should say « les œuvres ne font pas partie des stocks du dépositaire ». | [R] C. com. L624-9 s. |
| **« assure la garde et l'assurance »** | The gallery carries the risk of loss, theft, damage while it holds the works. | **Insured value**: none is printed (no insurance-value column for a deposit; no screen sets an insurance value at all). **Whether the gallery's policy covers the works of third parties « clou à clou »** (transport to and from the gallery). Whether Pem is the named beneficiary. | [R] see §4.3. |
| **« ne peut ni les prêter ni les céder … »** | No loan, no sale outside the terms; no pledge. | Usually also: **no framing, restoration, cleaning without consent**, **no sub-consignment**, **display conditions** (not in direct sun, etc.), condition reports out and back (the app has « constat »). | — |
| **« Les œuvres non vendues sont rendues … à la fin du dépôt »** | Return at the end of the period, at whose cost? | **Costs** of transport, packing, framing, promotion, fairs. **Sales report** (relevé) at a frequency, **payment delay** after a sale (30 days is common — to ask), **what happens if the work is sold to an exhibition buyer after the end date**. | — |
| *(absent)* **Price to buyer vs. Pem's net** | — | The paper lists « agreed price » and the commission, not the **net to Pem**. Worth a computed line. | — |
| *(absent)* **Droit de suite** | — | Informational: the **first sale** of a work by (or on behalf of) the artist does not trigger it; the dealer's **later resales** do (§6.3). | [R] CPI L122-8. |
| *(absent)* **Moral right, image rights** | — | The gallery's right to photograph and publish the works (website, fairs, press) and the credit line. | §6.4 |
| *(absent)* **VAT on the sale** | — | Which VAT regime the gallery applies when it sells (the artist's 5.5 % rate or the dealer's rules); invoice mentions between artist and gallery. | §6.1 |
| *(absent)* **Governing law / court** | — | §6.7. | — |

---

## 4. PRÊT — « Contrat de prêt / Loan agreement »

Used for: works lent for a period and a purpose (exhibition, institution, borrower), **never for sale**. Ref `P-YYYY-NNN`. Steps: draft → signed → out → closed (back).

### 4.1 The sheet

```
Contrat de prêt / Loan agreement                          [BROUILLON / DRAFT]
P-2026-001 · date · 1 / 1

L'ARTISTE / THE ARTIST                 EMPRUNTEUR / BORROWER
ŒUVRES / WORKS (n)                    VALEUR D'ASSURANCE / INSURANCE VALUE
[img] title (year) / medium · dims / Réf. œuvre #id               <value>
----------------------------------------------------------------------------
Période / Period                           du <date> au <date>

CONDITIONS
OBJET DU PRÊT, NOTES / PURPOSE, NOTES      (only if filled; the purpose is written here)

Fait à Marseille, le ______________
POUR L'ARTISTE / FOR THE ARTIST        POUR L'EMPRUNTEUR / FOR THE BORROWER
```

### 4.2 The terms rows

| Row printed | Commits Pem to | Missing / to check |
|---|---|---|
| `Période / Period` — `du <date> au <date>` | A fixed lending period (dates required by the form). | Place of display (**address of the venue**; the order stores an address, the paper does not print it); **extension procedure**. |
| Value column `VALEUR D'ASSURANCE / INSURANCE VALUE` | States each work's agreed value for insurance. **No screen sets a per-work insurance value today** (checked in the new-order form and `orders-actions.ts`), so the paper prints the **work's current list price** — silently. | **Which value** (replacement cost, market value, agreed value « valeur agréée »)? A museum asks for a value *per work*, in an agreed currency. A work with no list price prints « — ». The same holds for the Dépôt « agreed price »: it is the list price unless a line price is set by other means. |
| Notes block `OBJET DU PRÊT, NOTES / PURPOSE, NOTES` | The **purpose** typed in the notes. | The purpose is not a field of its own: if the notes are empty the paper has no purpose at all. |

### 4.3 CONDITIONS — printed text

**FR (printed):**
> Les œuvres listées sont prêtées pour la période et l'objet indiqués ; elles ne sont pas à vendre et reviennent à l'artiste à la fin du prêt. L'emprunteur les assure, à la valeur indiquée, du départ de l'atelier jusqu'à leur retour (« clou à clou »), et s'engage à les présenter avec la mention « Collection de l'artiste / Courtesy of the artist ». Un constat d'état est fait au départ et au retour.

**EN (reading translation, *not* printed):**
> The listed works are lent for the stated period and purpose; they are not for sale and return to the artist at the end of the loan. The borrower insures them, at the stated value, from the moment they leave the studio until their return (« nail to nail »), and undertakes to display them with the credit « Collection de l'artiste / Courtesy of the artist ». A condition report is made on departure and on return.

| Clause | Commits Pem to | Usually expected, missing / to check | Source |
|---|---|---|---|
| **« ne sont pas à vendre »** | The works are not offered for sale during the loan; Pem will not accept a sale offer from the borrower through this paper. | Usually: **the borrower must not pass on enquiries as a sale**, a **contact line** for any buyer interest. | — |
| **« reviennent à l'artiste à la fin du prêt »** | Return at the end date. | **Who pays transport** both ways, **packing and handling by qualified people**, **who may open the crate**. | — |
| **« L'emprunteur les assure … clou à clou »** | The borrower insures at the stated value **from departure to return**, which is the standard for loans to institutions. | **The insurance certificate or the policy number to be sent before departure**, who pays the premium, the cover (« tous risques »), whether Pem is the insured beneficiary, and **what happens on loss or damage** (compensation at the agreed value). Museums' own conventions state that insurance covers the works from removal to return, at the borrower's expense, and that a condition report is made on departure and on return [R]: e.g. the [Ministry of Culture circular 2005/006 on loans](https://www.culture.gouv.fr/Media/Thematiques/Circulation-des-biens-culturels/Files/Legislation-et-reglementation/Circulaire-2005-2006-du-6-avril-2005-relative-au-pret-d-objets-classes-au-titre-des-monuments-historiques-ou-propriete-de-l-Etat-affectes-a-la-dir) (national collections; a model, not a rule for a private artist). | [R] Ministry circular, see left; sample municipal loan conventions (Metz, Avignon, Rouen) found in search. |
| **Credit line « Collection de l'artiste / Courtesy of the artist »** | The borrower must show that credit. | The credit **wording to use** (« Courtesy of the artist » vs « Collection particulière »), where it shows (label, catalogue, press). The credit is the artist's **right to be named** (CPI L121-1 [R]). | [R] CPI L121-1. |
| **« Un constat d'état est fait au départ et au retour »** | A condition report both ways. | **Who writes it, in whose presence, signed by both.** The app already has a « constat » flow; the paper does not link it. Museum models have it **contradictory**, in presence of both parties at unpacking and repacking [R]. | — |
| *(absent)* **Display conditions** | — | Light, humidity, security, no modification of the work, **no reproduction** beyond documentation (§6.4). | — |
| *(absent)* **Photography / catalogue** | — | May the borrower photograph and reproduce the works for communication, and under what credit? Not covered — no right is granted. | CPI L111-3 [R] |
| *(absent)* **Early return / cancellation, force majeure** | — | A right for Pem to recall the work, a notice period. | — |
| *(absent)* **State aid / guarantee** | — | For institutional exhibitions the borrower sometimes benefits from a state guarantee instead of insurance — not for a private artist. | — |

---

## 5. DON — « Acte de don / Deed of gift »

Used for: works given, for nothing, to a recipient. Ref `G-YYYY-NNN`. Steps: draft → deed signed (**owner = recipient**, status « Gift ») → handed over (custodian = recipient). The paper prints **no value column**; the works' price is kept in the data (the open question, see R7_Open_Decisions).

### 5.1 The sheet

```
Acte de don / Deed of gift                                [BROUILLON / DRAFT]
G-2026-001 · date · 1 / 1

L'ARTISTE / THE ARTIST                 BÉNÉFICIAIRE / RECIPIENT
ŒUVRES / WORKS (n)                                   (no value column)
[img] title (year) / medium · dims / Réf. œuvre #id

CONDITIONS
NOTES   (only if filled)

Fait à Marseille, le ______________
POUR L'ARTISTE / FOR THE ARTIST        POUR LE BÉNÉFICIAIRE / FOR THE RECIPIENT
```

### 5.2 CONDITIONS — printed text

**FR (printed):**
> Le présent acte atteste du don, à titre gracieux, des œuvres listées au bénéficiaire désigné. Aucune contrepartie n'est due. La propriété passe au bénéficiaire à la signature ; la garde, à la remise des œuvres.

**EN (reading translation, *not* printed):**
> This deed attests to the gift, free of charge, of the listed works to the named recipient. No consideration is due. Ownership passes to the recipient on signature; custody, on hand-over of the works.

| Clause | Commits Pem to | Usually expected, missing / to check | Source |
|---|---|---|---|
| **« atteste du don, à titre gracieux … Aucune contrepartie n'est due »** | The gift is free and final once effective: Pem cannot ask for anything back. | A gift is *irrevocable* in principle (Code civil art. 894 [R]); exceptions are limited (ingratitude, non-performed charges, birth of a child). **If Pem wants a right of return, a charge (« must be exhibited / not sold ») or a condition, it must be written.** | [R] C. civ. 894, 953 s. |
| **« La propriété passe … à la signature ; la garde, à la remise »** | **Ownership at the signature**; the recipient holds it from the handover. | **This is the delicate point.** A gift has to be made before a notary, *except* the **don manuel**, which is made by **handing over the movable object** [V] [notaires.fr — le don manuel](https://www.notaires.fr/fr/donation-succession/donation/le-danger-des-dons-manuels): « Toute donation doit faire l'objet d'un acte notarié sous peine de nullité », the don manuel being the exception, which takes effect through the **physical handover**. A signed paper *without* handover is neither a notarial deed nor a completed don manuel. Ask the lawyer whether the paper should say that **the gift is made by the hand-to-hand delivery of the works on <date>**, and print a **handover date** line (a « remise » receipt) — the app stores the handover date separately. The notaires.fr page also describes a later **written acknowledgment (« pacte adjoint »)** to prove the gift and set conditions [V]. | [V] notaires.fr; [R] Code civil art. 931 and the manual-gift case law. |
| *(absent)* **Value** | — | The recipient may have to **declare the gift** to the tax office with a value (§5.3). The paper states no value; the gift price is the open question. | R7_Open_Decisions, Q1 |
| *(absent)* **Recipient's identity** | — | For an association or a museum: the legal body and **acceptance by the competent organ** (a museum may only accept after its committee). For a minor: the legal representative. For a company: capacity of the signer. | — |
| *(absent)* **Reproduction rights, moral right** | — | A gift of the object gives no reproduction right (§6.4) — worth saying, as recipients often assume otherwise. | CPI L111-3 |
| *(absent)* **Condition and authenticity** | — | A certificate of authenticity and a condition report at handover. | — |

### 5.3 Gift tax — what the recipient meets (informational)

- A *don manuel* is **not taxed while the tax authorities do not know of it**; it becomes known when the recipient declares it, in a later gift or inheritance (**rappel fiscal**, 15 years back), in an audit or a dispute [V: notaires.fr]. Once known, it must be **declared within one month** (online since 1 Jan 2026 in most cases) [V: notaires.fr; search results on the 2026 online obligation]. The **allowances (abattements)** depend on the relationship donor / recipient — for example **100 000 € from a parent to a child**, renewable every 15 years [V: [impots.gouv.fr — dons exonérés](https://www.impots.gouv.fr/particulier/dons-exoneres)]; the page does not list the siblings / nephews / others amounts, to be taken from the current official table [R: CGI art. 779, 777].
- A gift to a **non-profit / foundation / public body** follows other rules (exemption from gift duties for qualifying bodies, possible tax receipt for the donor) [R: CGI art. 795, 200, 238 bis] — not covered here, and for **Pem as donor** whether a gift of Pem's *own* work gives any deduction is an accountant's question.
- **If Pem is VAT-registered**, a gift of goods from the business may count as a taxable supply with a small-gift exemption [R: CGI art. 257]; if Pem is in franchise, nothing. Accountant's question (§6.1).

---

## 6. Points that cross all four papers

### 6.1 VAT — « TVA non applicable, art. 293 B du CGI » or the art-work rate

What the public pages say:
- **Franchise en base**: an artist-author whose artistic turnover of the previous year is under **50 000 €** is exempt from declaring and paying VAT on that income; the exemption ends on 1 January of the next year above 50 000 € in the previous year, or in the current month if the current year passes **55 000 €**. [V] [service-public F32113](https://entreprendre.service-public.gouv.fr/vosdroits/F32113) (verified 20 Feb 2026). *Conflicting figures exist on other sites (37 500 / 85 000 € general-regime thresholds; an older BOFiP reading that the franchise does not cover deliveries of the artist's own works): the official page above is the one to use; the accountant confirms.*
- **Invoice mention** in franchise: « TVA non applicable – article 293 B du CGI » [V: same page; also the [invoice sheet F31808](https://entreprendre.service-public.gouv.fr/vosdroits/F31808): « TVA non applicable, art. 293 B du code général des impôts »].
- **If VAT-registered**: sale of an original work by the author or his / her heirs at **5.5 %**; copyright assignment 10 %; other operations 20 % [V: F32113]. The 5.5 % rate was extended on 1 Jan 2025 to all art deliveries [V: BOFiP BOI-TVA-SECT-90-40].
- The option for VAT even below the threshold exists (written request to the SIE; 2 years) [V: F32113].

What the papers do: **nothing** — no VAT mention, no HT / TTC. The works have a `tva_rate` in the database (Fiscal expenses use one too); the order does not. The Fiscal « recettes » counts payments **as received**, without splitting VAT.

**To ask the accountant:** (a) Pem's status today (franchise / VAT-registered / BNC regime); (b) the exact mention to print on each paper; (c) whether the Dépôt price is HT or TTC; (d) whether gifts have any VAT consequence.

### 6.2 Invoice mentions — what a « facture » needs

[V] [service-public F31808](https://entreprendre.service-public.gouv.fr/vosdroits/F31808) (verified 11 Aug 2026): issue date, a **unique sequential invoice number**, date of sale; seller identity (name, « EI », address, **SIREN**); buyer identity (for a business, company name, VAT number if applicable); product detail, quantity, unit price HT, **VAT rate or exemption**; totals HT / TTC; **payment due date, early-payment discount (or « néant »), late-payment penalty rate**; the **€40 fixed recovery fee** (claimable from a professional only); the franchise mention if in franchise; for consumers, the **legal guarantee of conformity** for listed product categories. [V] A **purchase-order number** if the buyer issued one.

The « bon de commande » (the Vente paper) carries **none of these** apart from the identity and price. The R7 notes plan a **« Facture when paid »** — not built. A business buyer (gallery, company) needs the invoice; a consumer can ask for it.

**E-invoicing:** from **1 September 2026** all businesses must be able to *receive* e-invoices; **issuing** becomes mandatory for SMEs / micro-enterprises from **1 September 2027** (large companies and mid-caps from Sept 2026). [R] [entreprendre.service-public.gouv.fr A18953](https://entreprendre.service-public.gouv.fr/actualites/A18953?lang=fr) (published 14 Aug 2026, seen in a search result; the invoice sheet notes that the micro-entrepreneur case has its own guidance). Whether and when it concerns Pem is an accountant's question; the app's Vault holds PDFs, not structured e-invoices.

### 6.3 Droit de suite

- A levy on **resales** of an original graphic or plastic work in France **in which an art-market professional takes part** (seller, buyer or intermediary), at a declining scale from 4 % of the price HT (floor **750 €**, cap **12 500 € per sale** in the sources found), paid by the **seller**, collected by a collecting society (ADAGP / CAA); protection lasts 70 years after death [R: [CPI L122-8](https://www.legifrance.gouv.fr/codes/texte_lc/LEGITEXT000006069414), R122-3 s.; summary pages: [ADAGP — droit de suite](https://www.adagp.fr/fr/utilisateur/droit-de-suite) (the page says professionals must declare the resale to ADAGP; no scale shown)]. Sources disagree on the tier breakpoints — check R122-5.
- **The first sale by the artist is outside it**, as are resales by a private seller with no professional involved. **A sale by Pem, or by a gallery acting for Pem, is a first sale.** So the Vente and Dépôt papers do not owe it. The relevant points for Pem: **registration with the collecting society** if Pem wants to collect on later resales, and a line in a Vente paper that the buyer is informed that later resales through a professional trigger the right (informational; it is the seller's duty).
- The exemption for a seller who bought the work directly from the artist **less than 3 years earlier** at no more than 10 000 € (an older source; confirm) means a gallery that buys outright from Pem and resells quickly may be exempt — a point for the Vente paper to a gallery.

### 6.4 Reproduction rights and the moral right

- **The object and the author's rights are separate**: the author's intangible property is independent of ownership of the object; the buyer of the object acquires **none** of the author's rights by that act [R: CPI L111-3] — so a buyer, a borrower or a recipient may not reproduce the work (catalogue, website, merchandise, NFT…) without a written licence. A licence must state the **scope, purpose, place and duration** (CPI L131-3 [R]). Exceptions exist (e.g. information about current events, private copying) — CPI L122-5 [R].
- **Moral right** (CPI L121-1 [R]): the right to be named and to the **integrity** of the work; perpetual and inalienable. The owner must not modify or mutilate the work (a frame change is usually fine, painting over it is not).
- The papers say **neither**. Usual one-liners for a lawyer to polish: « La vente de l'œuvre ne transfère aucun droit de reproduction ni de représentation (art. L111-3 CPI) ; toute reproduction exige l'accord écrit de l'artiste. Le droit moral de l'artiste est inaliénable. » and, for the Prêt / Dépôt, an authorisation limited to documentation and communication about the event, with the credit.

### 6.5 Distance sales — cooling-off

See §2.5 [V: F10485]. Also: a distance sale must be confirmed on a durable medium (C. conso. L221-13 [R]) and the pre-contract information given (L221-5 [R]); the 14-day right does not apply to made-to-order works (L221-28 3° [R]). An **online enquiry that becomes a sale** (the site's enquiry form) is a distance contract; a studio visit is not.

### 6.6 Personal data and records

- The papers carry the name and address of private individuals (buyers, recipients, borrowers). Keeping them in the Vault is an **ongoing processing** under the GDPR: a retention period and a purpose (contract + legal obligation). Accounting records are usually kept **10 years** (Code de commerce L123-22 [R]); the right of the tax office to audit runs 6 years (LPF L102 B [R]). Ask whether the papers should state the controller and the rights (a short line or a privacy page).
- The signed copy is stored beside the order (R2 vault, 4 MB limit for photos).

### 6.7 Language, governing law, disputes

- The papers print **bilingual labels**, but the conditions and terms rows are French only. For foreign parties, a French-only contract binds, but the other party must be able to read it; a bilingual body (FR + EN, with a « the French text prevails » clause) is usual.
- No **applicable law**, **competent court**, **mediation** clause. For consumers a **mediator** must be named (C. conso. L612-1, L616-1 [R]); between businesses, a jurisdiction clause is usual.
- No **force majeure**, **partial invalidity**, **entire agreement** — boilerplate a lawyer adds.

---

## 7. Questions to take to the lawyer / accountant

1. **Pem's tax status** and the exact **VAT mention** and **HT/TTC wording** to print on Vente and Dépôt (and who invoices on a deposit sale).
2. Is a **Vente paper** enough for a **business** buyer, or must an **invoice** be issued? What mentions must it carry, and from when does e-invoicing concern Pem?
3. **Cooling-off row**: keep for all sales, distance only, or never? What to print for studio sales and salon sales?
4. **Gift**: can the owner change **at signature** while the work is still with Pem? Should the paper become a **handover receipt** (« remis le … ») for a *don manuel*? Add a **value** line? Right of return / charges?
5. **Dépôt**: a mandate-to-sell clause set (discount authority, exclusivity, payment delay, sales report, insurance value, insolvency, end of mandate).
6. **Prêt**: insurance wording (agreed value, certificate before departure, loss), who pays transport and condition reports, display and reproduction limits, credit line.
7. **Reproduction and moral right** lines for all four.
8. **Governing law, court, mediator, language**, number of originals, signer's capacity.
9. **Data and retention** line.

## 8. Sources

Read on 2026-11-17 **[V]**:
- Artiste-auteur : fiscalité (déclaration de revenus, TVA et CFE), service-public Entreprendre, [F32113](https://entreprendre.service-public.gouv.fr/vosdroits/F32113), verified 20 Feb 2026 — franchise thresholds, 5.5 % rate, 293 B mention.
- Mentions obligatoires sur une facture, service-public Entreprendre, [F31808](https://entreprendre.service-public.gouv.fr/vosdroits/F31808), verified 11 Aug 2026.
- Achat à distance : droit de rétractation du consommateur, service-public, [F10485](https://www.service-public.gouv.fr/particuliers/vosdroits/F10485), verified 1 Jan 2026.
- Tout savoir sur le don manuel, notaires.fr, [le-danger-des-dons-manuels](https://www.notaires.fr/fr/donation-succession/donation/le-danger-des-dons-manuels) (the page does not address works of art; its examples are money, jewellery, cars, securities).
- Dons exonérés, impots.gouv.fr, [dons-exoneres](https://www.impots.gouv.fr/particulier/dons-exoneres) (modified 28 Nov 2025).

Seen in search results only or known, to confirm **[R]**:
- BOFiP [BOI-TVA-SECT-90-40](https://bofip.impots.gouv.fr/bofip/1285-PGP.html/identifiant=BOI-TVA-SECT-90-40-20250514) (5.5 % on art deliveries; 2025 extension).
- E-invoicing calendar: entreprendre.service-public.gouv.fr [A18953](https://entreprendre.service-public.gouv.fr/actualites/A18953?lang=fr).
- ADAGP [droit de suite](https://www.adagp.fr/fr/utilisateur/droit-de-suite); CPI L122-8, R122-3 s.
- Ministry of Culture [circular 2005/006 on loans](https://www.culture.gouv.fr/Media/Thematiques/Circulation-des-biens-culturels/Files/Legislation-et-reglementation/Circulaire-2005-2006-du-6-avril-2005-relative-au-pret-d-objets-classes-au-titre-des-monuments-historiques-ou-propriete-de-l-Etat-affectes-a-la-dir) — a model for « clou à clou » and condition reports in public loans.
- Code articles named in the text: CPI L111-3, L121-1, L122-5, L131-3; Code de la consommation L216-4, L221-5, L221-10, L221-18, L221-28, L224-59, L612-1, L616-1; Code civil 894, 931, 953 s., 1375, 1915 s., 1984 s., 1993, 2367 s.; Code de commerce L123-22, L624-9; CGI 200, 238 bis, 257, 293 B, 777, 779, 795; décret n° 81-255 of 3 March 1981.
- Electronic signature: Code civil art. 1366–1367, décret n° 2017-1416 of 28 Sept 2017, eIDAS regulation (EU) 910/2014 (see R7_Open_Decisions).

*None of this replaces a lawyer or an accountant.*
