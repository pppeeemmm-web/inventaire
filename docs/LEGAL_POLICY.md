# Politique juridique de l'atelier / Studio legal policy

**Status: policy draft, 2026-11-17. Documents only — no code, no SQL, nothing sent.** It sets the rules the studio's papers follow (which law, which court, how a paper is signed and kept, gifts, what stays open for the accountant) and lists the contract templates the studio needs. It builds on [`design/2026-11-17/R7_Papers_Wording.md`](design/2026-11-17/R7_Papers_Wording.md) (what the four papers print today, clause by clause) and [`design/2026-11-17/R7_Open_Decisions.md`](design/2026-11-17/R7_Open_Decisions.md) (Pem's answers).

> **Ce n'est pas un avis juridique ni fiscal. / This is not legal or tax advice.** It is a reading of public texts by someone who is not a lawyer or an accountant, so that Pem can brief one. Every rule below is a *proposal* until a lawyer (law, contracts) or the accountant (VAT, invoices, tax) confirms it. Nothing here should be printed on a paper sent to a third party before that read.

**How to read the source tags**
- **[V]** read on 2026-11-17 by the R7 wording review (page opened; see that file's §8).
- **[S]** seen today in an official page's search result or excerpt, not read in full — check the page.
- **[R]** from general knowledge or a secondary source — **to confirm** on the official text (Légifrance, EUR-Lex, irishstatutebook.ie, Revenue, legislation.gov.uk, uscode.house.gov) before relying on it.
- « **to confirm** » = the answer depends on a fact or a reading this draft could not check.

**Decisions already taken by Pem (2026-11-17)** — this policy follows them:
1. The **gift paper never shows a price**.
2. A **gift's owner changes at handover** (*don manuel*), not at signature.
3. **« Confié »** (a work left with a printer, framer, photographer, restorer) is a **fifth order kind**.
4. **Sending = share the PDF** (share sheet / download); the other side signs and returns it; Pem uploads the signed copy. Extra formality **only where the law, or the other party, requires it**.
5. **Status (Pem, 2026-11-17, evening):** sole entrepreneur, **artiste peintre** — an *artiste-auteur* (arts plastiques), with its own VAT, social and income-tax thresholds. Treat a sale as a **professional sale** by default; below the thresholds some obligations may not apply — to check against the French framework (lawyer / accountant).
6. **14-day return right and buyer information on every sale, as a house rule** (Pem: « to make sure we don't go into deep trouble »), whether or not the law requires it for that sale. The money received is **kept aside, not counted as definitive**, until the period is over and the sale is settled.
7. **Originals or e-signature** for gallery deposits, business sales above €5 000 and rights contracts: **a default, not a rule** — Pem stays flexible per partner (« if I appear very rigid from the onset, this is not the way to build a good relationship »). The app suggests, never blocks.
8. **Gifts may carry a resale restriction** (Pem's idea): a clause forbidding resale for a period. French law allows a temporary inalienability clause in a gift if it serves a serious and legitimate interest (Code civil art. 900-1 [R]); in a *don manuel* without a deed it is hard to prove — the gift paper would have to carry it. For the lawyer.

---

## 0. En bref / At a glance

| Topic | The studio's rule (proposed) | Confirm with |
|---|---|---|
| Law named on every paper | **French law**, CISG excluded (§1.7) | lawyer |
| Court named | **Marseille**, except where the other party is a consumer (their protections win) | lawyer |
| Consumer abroad (EU, UK) | French law still named, but the consumer keeps the mandatory protections of their own country; they can only be sued at home | lawyer |
| 14-day return | **every sale, as a house rule** (decision 6), money kept aside until the period ends. The *legal* right covers only consumer sales at a distance or off the studio premises; elsewhere the paper must word it as the studio's own promise, not as the statutory right | lawyer |
| Signing | share PDF → signed copy back → upload. Stronger form (two paper originals or a real e-signature) for the cases in §2.3 | lawyer |
| Gift | owner changes at **handover**; paper = a dated handover record, **no price**; internal reference value kept in the app, never printed, never income | lawyer + accountant |
| Who declares a gift | the **recipient** (France: form 2735; Ireland: CAT return IT38 when over 80 % of the threshold) — Pem gives them nothing to declare *from* unless asked | notary / accountant |
| VAT and invoices | **open** — the accountant's call (§4) | accountant |
| Keeping papers | Vault `Commandes/…` per kind; signed copy beside the paper; keep **for the life of the work** (title and provenance); accounting pieces ≥ 10 years | accountant |
| Templates | 4 exist in code (sale, deposit, loan, gift); 6 to write (§6) | lawyer |

---

## 1. Droit applicable et tribunal / Which law and which court

### 1.1 The default clause / La clause par défaut

Every paper the studio makes ends with one governing-law line. Proposed wording (for the lawyer to polish; **not in code today** — [`lib/orders/order-paper.ts`](../lib/orders/order-paper.ts) prints no law or court line, see R7 wording §6.7):

> **FR** — Le présent contrat est soumis au droit français, à l'exclusion de la Convention des Nations unies sur les contrats de vente internationale de marchandises (Vienne, 11 avril 1980). Tout différend relève des juridictions compétentes de Marseille, sous réserve des règles impératives protégeant le consommateur. La version française fait foi.
>
> **EN** — This agreement is governed by French law, excluding the United Nations Convention on Contracts for the International Sale of Goods (Vienna, 11 April 1980). Any dispute falls within the competent courts of Marseille, subject to the mandatory rules protecting consumers. The French text prevails.

Three limits to keep in mind:
- **Inside France, a court clause often does not bind.** A clause choosing a court's *place* is « réputée non écrite » unless both parties contracted as *commerçants* (Code de procédure civile art. 48 [R]). Pem, as an artist-author, is usually not a *commerçant*, so with a French buyer, borrower or gallery the clause is mostly informational: the normal rules (the defendant's home, the place of delivery — CPC art. 42 and 46 [R]) decide. **To confirm** with the lawyer, including whether the clause still helps against a gallery.
- **A consumer keeps their own protections** (§1.3, §1.5), whatever the clause says.
- **« French law » includes the CISG** for international sales between businesses, unless it is excluded by name (§1.7).

### 1.2 France / France

French law applies by default; nothing to add. Consumer law (Code de la consommation) applies **only if Pem sells as a « professionnel »** to a consumer. The code's preliminary article defines a *professionnel* as a person acting for the purposes of their commercial, industrial, craft, liberal or agricultural activity [R]. Whether an artist selling their own works is caught is **the first question for the lawyer** — it decides whether the 14-day right is a legal one or only the house rule (decision 6), the consumer mediator (C. conso. L612-1 [R]), the legal guarantee of conformity (L217-3 s. [R]) and the information duties. The civil-law guarantee against hidden defects (Code civil art. 1641 s. [R]) applies to every sale either way.

Language: a sale to a consumer in France must be offered in French (loi n° 94-665 « Toubon », art. 2 [R]). Bilingual is fine; the French text prevails.

### 1.3 Another EU country / Un autre pays de l'UE

**Which law — Rome I** (Regulation (EC) No 593/2008, [EUR-Lex CELEX 32008R0593](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32008R0593)) [R]:
- **Art. 3:** the parties may choose the law. The French-law clause is valid.
- **Art. 4(1)(a):** with no choice, a sale of goods is governed by the law of the **seller's** habitual residence — France. A loan, deposit or service follows art. 4(1)(b) / 4(2) (the characteristic performer's residence — often Pem's, to confirm per kind).
- **Art. 6 — consumers:** if Pem **pursues or directs activities** to the consumer's country (an English-language site that ships there, an enquiry form open to that country — to confirm what counts), the choice of French law **cannot deprive the consumer of the mandatory protections of their own country**; without a choice, their country's law applies. In practice: name French law, and assume the buyer's home rules still protect them.

**Which court — Brussels I bis** (Regulation (EU) No 1215/2012, [EUR-Lex CELEX 32012R1215](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32012R1215)) [R]:
- **Art. 25:** between businesses (Pem ↔ a gallery in Berlin), a written court clause choosing Marseille is valid; an electronic record that keeps the clause counts as writing (art. 25(2)).
- **Art. 7(1)(b):** with no clause, a sale of goods may also be sued at the **place of delivery**.
- **Arts. 17–19 — consumers:** a consumer may sue Pem at home or in Marseille; **Pem can only sue a consumer in the consumer's country**; a court clause signed before the dispute does not bind the consumer (art. 19 exceptions aside).
- **Arts. 36 and 39:** a French judgment is recognised and enforced in other EU states with no extra procedure.
- **Small debts:** European Small Claims Procedure (Regulation (EC) No 861/2007, ceiling €5 000 since Regulation (EU) 2015/2421) and the European order for payment (Regulation (EC) No 1896/2006) — written procedures, useful for an unpaid sale abroad [R].
- The EU **ODR platform** link once required on consumer sites is gone: Regulation (EU) 2024/3228 repealed Regulation 524/2013 from **20 July 2025** [S: [EUR-Lex 2024/3228](https://eur-lex.europa.eu/eli/reg/2024/3228/oj/eng)].

**14-day withdrawal — Consumer Rights Directive** (Directive 2011/83/EU, [EUR-Lex CELEX 32011L0083](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32011L0083)) [R]:
- The same rule in every EU country (full harmonisation, art. 4): **14 days** for **distance** contracts (art. 2(7): no simultaneous physical presence, e.g. email, phone, website) and **off-premises** contracts (art. 2(8): concluded away from the trader's business premises) — art. 9. French version: C. conso. L221-18 [V via service-public F10485].
- **Not** for a sale concluded in the studio, **not** for a business buyer.
- **Excluded:** goods made to the consumer's specifications or clearly personalised (art. 16(c)) — a **commissioned** work is likely out; a finished work chosen from the catalogue is in. To confirm per case.
- The trader must give the withdrawal information on a durable medium before the contract (art. 6) and confirm the contract on a durable medium (art. 8(7)) — the shared PDF can be that medium. **If the information is missing, the period stretches up to 12 months** (art. 10).
- Consequence for the papers: the law requires the row **only on distance / off-premises consumer sales**, with the model withdrawal form and the return-cost rule (R7 wording §2.5). **House rule (decision 6): the 14-day return right and the buyer information print on every sale**, and the money stays aside until the period ends. Where the law does not give the right (studio sale, business buyer), the paper should word it as the studio's own contractual promise — how to return a work, in what state, who pays transport — so it is not read as the statutory right with its 12-month extension. Lawyer to word both versions.

**Signatures — eIDAS** (Regulation (EU) No 910/2014 as amended by Regulation (EU) 2024/1183, [EUR-Lex CELEX 32014R0910](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32014R0910)) [R]: art. 25 — an electronic signature cannot be refused as evidence only because it is electronic; a **qualified** electronic signature has the effect of a handwritten one and is **recognised in every member state**. A simple e-signature (typed name, a PDF-reader signature, a scanned signature) stays admissible, but its reliability may have to be proven.

**Resale right — Directive 2001/84/EC** ([EUR-Lex CELEX 32001L0084](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32001L0084)) [R]: a royalty on **resales** involving an art-market professional, paid by the seller; **the artist's own first sale is outside it**. Each state sets its threshold (max €3 000): France **€750** (CPI L122-8, R122-… [R]); Ireland **€3 000** [S: S.I. No. 312/2006]. Informational only on Pem's papers; Pem collects through a society (ADAGP in France, IVARO in Ireland) if a member.

**VAT on cross-border sales** — §4 (accountant).

### 1.4 Ireland / Irlande

Ireland is in the EU: everything in §1.3 applies (Rome I, Brussels I bis, the directive's 14 days through the Consumer Rights Act 2022 [R], eIDAS).

Specific points:
- **CISG: Ireland has not ratified it** [S: [UNCITRAL status page](https://uncitral.un.org/en/texts/salegoods/conventions/sale_of_goods/cisg); secondary sources list Ireland, the UK, Portugal and Malta as the non-contracting EU-area states — check the status table]. A sale to an Irish gallery is still caught by the CISG if a court applies **French** law to it (CISG art. 1(1)(b) — France made no art. 95 reservation [R]). Excluding the CISG by name (§1.7) removes the doubt.
- **Writing for a sale of goods:** section 4 of the Sale of Goods Act 1893, as it applies in Ireland, may still require a note in writing for goods above a small value unless the goods were accepted or part-paid [R — **to confirm**; it was repealed in England in 1954]. The signed PDF covers it either way.
- **Resale right:** S.I. No. 312/2006, threshold €3 000, extended to heirs from 2012 [S: [irishstatutebook.ie](https://www.irishstatutebook.ie/2006/en/si/0312.html)].
- **Copyright assignment** must be in writing signed by the assignor (Copyright and Related Rights Act 2000, s. 120(3) [R]).
- **E-signature:** Electronic Commerce Act 2000 + eIDAS [R].
- **Gift tax for an Irish recipient:** §3.3.

### 1.5 United Kingdom / Royaume-Uni

Not in the EU since 2021; not a CISG state [S: UNCITRAL; secondary sources].
- **Law:** the UK kept Rome I as domestic law (now « assimilated law ») [R], so a French-law clause is respected and the consumer rule of art. 6 still protects a UK consumer.
- **Court:** Brussels I bis **no longer applies**. Two Hague conventions take its place:
  - the **2005 Choice of Court Convention** (UK a party in its own right since 1 January 2021 [R]) — an **exclusive** clause choosing Marseille is respected and the judgment enforced;
  - the **2019 Judgments Convention**, in force for the UK since **1 July 2025** for proceedings started after that date, and for the EU since 1 September 2023 [S: [HCCH news](https://www.hcch.net/de/news-archive/details/?varevent=1085); law-firm notes].
  A Marseille judgment against a UK gallery is therefore enforceable in the UK under conditions — **to confirm** case by case. Consumer matters are largely outside the 2005 convention.
- **Consumers:** Consumer Contracts (Information, Cancellation and Additional Charges) Regulations 2013 — 14 days for distance and off-premises sales, as in the EU [R].
- **Writing:** no general writing rule for a sale of goods (repealed 1954 [R]); a **copyright assignment** must be signed in writing (CDPA 1988 s. 90(3) [R]).
- **Resale right:** Artist's Resale Right Regulations 2006 (threshold set in the regulations — **to confirm**, a secondary source quotes €1 000) [R].
- **Shipping:** an export from the EU; UK import VAT and customs are the buyer's (§4).

### 1.6 United States / États-Unis

No EU-style framework; **one state's law** (where the buyer or gallery is) is the other side of the table.
- **Law:** courts usually honour a contractual choice of law with a reasonable link (UCC § 1-301; Restatement (Second) of Conflict of Laws § 187 [R]). A French-law clause is reasonable for a French seller.
- **CISG:** the **US is a party** (in force 1 January 1988, with an art. 95 reservation [R]). A sale by Pem to a **US gallery or business** falls under the CISG by default (art. 1(1)(a): both states are parties) **unless excluded by name**.
- **Writing:** UCC § 2-201 — a sale of goods for **$500 or more** is not enforceable without a writing signed by the party against whom it is enforced (exceptions: goods accepted, paid for, specially made) [R]. The signed PDF covers it. E-signatures are valid (ESIGN Act, 15 U.S.C. § 7001; state UETA) [R].
- **Court and enforcement:** **no treaty** between France and the US on judgments; a French judgment must be recognised under the state's law (most states have the Uniform Foreign-Country Money Judgments Recognition Act) [R] — slow and costly. In practice: **payment in full before shipping**, and for a consignment, the gallery's own state rules.
- **Consignment to a US gallery:** several states protect artists who consign: e.g. **New York Arts and Cultural Affairs Law art. 12** — consigned works and their proceeds are **trust property** of the artist, out of reach of the gallery's creditors [R]. Other states have similar statutes (California and others — **to confirm** for the state concerned).
- **Copyright:** selling the object transfers no copyright (17 U.S.C. § 202); a transfer of copyright or an exclusive licence needs a **signed writing** (§ 204(a)); moral rights are narrow (VARA, § 106A) [R].
- **Consumers:** no federal 14-day right for a distance sale; the FTC Cooling-Off Rule (16 CFR part 429) covers sales at the buyer's home or a temporary location [R] — not a sale from France at a distance. State rules vary.
- **Resale right:** none federally; California's Resale Royalty Act was largely held preempted (9th Cir., 2018) [R].
- **Import:** original paintings and drawings enter duty-free (HTS 9701 [R]); state sales / use tax is the buyer's.

### 1.7 The CISG (Vienna sales convention) / La Convention de Vienne (CVIM)

[UNCITRAL text and status](https://uncitral.un.org/en/texts/salegoods/conventions/sale_of_goods/cisg) [S]; France a party since 1 January 1988 [R].

**When it applies to Pem's papers**
- Only to a **sale of goods** between parties whose places of business are in **different states**, when both states are parties (art. 1(1)(a)) or when the conflict rules lead to a party's law (art. 1(1)(b)) [R].
- **Not to consumer sales** — goods bought for personal, family or household use (art. 2(a)), unless the seller neither knew nor ought to have known [R]. A collector buying for their home is outside it.
- **A commissioned work counts as a sale** (« goods to be manufactured », art. 3(1)) unless the buyer supplies most of the materials [R].
- **Not to a deposit, loan, gift or Confié** — they are not sales. A deposit with a foreign gallery becomes a sale only if the gallery **buys** the work.
- It does **not** govern who owns the goods (art. 4(b)): a reservation of title is decided by the law of where the work is [R].

**So, a B2B sale to a gallery abroad:** to a German, Italian, Spanish, Dutch, Belgian or US gallery, **yes by default**; to an Irish or UK gallery, possibly through art. 1(1)(b) once French law applies.

**Exclude it or not?** Proposed: **exclude it on Pem's papers** (art. 6 allows it; the exclusion must be express — naming « French law » alone does *not* exclude it [R]). Reasons: the papers are written in French civil-law terms (réserve de propriété, garantie des vices cachés, délai de paiement); one law for every paper is easier to explain; volumes are small. Against: a foreign gallery's lawyer may prefer the neutral CISG and send their own contract. **Rule:** Pem's own papers exclude it; when a gallery sends its contract naming the CISG, accept it if the lawyer sees no problem. **To confirm.**

---

## 2. Signature et preuve / Signature and proof

### 2.1 The rule / La règle (Pem, 2026-11-17)

1. Pem **shares the PDF** (phone share sheet or desktop download) from Pem's own mail or messaging.
2. The other party **signs and returns it** — printed and signed then scanned / photographed, or signed in a PDF reader.
3. Pem **uploads the signed copy** to the order (`…_signe.<ext>`, see §5) and then marks the order « signed ».
4. **Paper originals or a real e-signature only where the law, or the other party, requires it** — the list in §2.3. When an institution sends its own convention, *that* convention is the signed copy (or an extra paper on the order).

What the app does today (R7_Open_Decisions, Q2): « Ajouter la copie signée » exists; « Partager le papier » and a « signed but no copy » warning do not. Not a build request here.

### 2.2 Why this holds in France — and why the € 1 500 rule is French only

- **A sale, a deposit, a loan need no form to exist**: agreement on the thing and the price makes the sale (Code civil art. 1582–1583 [R]). The paper is **proof**, not a condition — except for the cases in §2.3.
- **Proof by writing above € 1 500** (Code civil art. 1359 and décret n° 80-533 du 15 juillet 1980 [R]): above that amount, a legal act between private persons is proven by a signed writing. Below it, any evidence works (emails, messages, payment). Exceptions: when obtaining a writing was materially or morally impossible (art. 1360 — e.g. within a family [R]), and the « commencement de preuve par écrit » completed by other evidence (art. 1362 [R]).
- **Against a *commerçant* (a gallery), proof is free** whatever the amount (Code de commerce L110-3 [R]); the € 1 500 rule then protects only the non-commerçant side.
- **Copies and e-signatures:** a reliable copy has the same force as the original (art. 1379 [R]); an electronic writing is admissible like paper (art. 1366) and an electronic signature is valid, **presumed reliable only if qualified** (art. 1367 and décret n° 2017-1416 [R]). A « bon pour accord » email or a typed name is evidence, but Pem may have to prove its reliability if disputed.
- **Number of originals:** a two-party contract on paper should be made in as many originals as parties, each saying how many (art. 1375 [R]); for an electronic contract the rule is met when each party can get a copy (art. 1375 last para. [R]).
- **The € 1 500 rule is French only.** Ireland, the UK and the US have their own (narrower or different) writing rules — §1.4–1.6. Do not print « au-delà de 1 500 € » reasoning on an English paper.

### 2.3 Where the simple rule is not enough / Quand il faut plus

Legend: **B** = the default (shared PDF, signed copy back). **B+** = B, but the returned copy must carry a **real signature** (handwritten scan or e-signature), not a reply email. **Originals** = two signed paper originals, or a qualified / advanced e-signature for that one order. **Notary** = deed before a notary.

| Paper | France | EU (other) | Ireland | UK | US | Why |
|---|---|---|---|---|---|---|
| **Vente** ≤ € 1 500, consumer, in the studio | B | B | B | B | B | no writing rule |
| **Vente** > € 1 500, private buyer | **B+** | B+ (proof rules vary — to confirm) | B+ (SoGA 1893 s. 4 — to confirm) | B | **B+** from $500 (UCC 2-201) | proof by writing |
| **Vente** at a distance to a consumer | B + withdrawal info + model form on a durable medium | same (CRD art. 6, 8(7)) | same | same (2013 Regs) | B | information duty |
| **Vente** to a gallery / business | B+ ; **Originals** above a value Pem sets (proposed € 5 000 — to decide) | same | same | same | B+ ; prepayment | dispute risk; CISG exclusion must be signed |
| **Dépôt** with a gallery | **Originals** (or e-sign) | **Originals** | **Originals** | **Originals** | **Originals** + check the state's consignment statute | the signed, dated list is the evidence to claim works back in the gallery's insolvency (C. com. L624-9 s. [R]; NY ACAL art. 12 [R]) |
| **Prêt** to an institution | the institution's own convention, signed by its competent person; often **Originals** or its e-sign platform | same | same | same | same | the other party requires it |
| **Prêt** to a private person | B+ | B+ | B+ | B+ | B+ | value at risk |
| **Don** (handover gift) | B — the paper records the handover; **Notary** only for a gift not handed over, a gift with conditions (charges) Pem wants enforceable, or a high-value gift (to confirm) | the recipient's country may ask a deed — to confirm | a gift of a chattel is made by **delivery** or by **deed** [R] | same as Ireland [R] | delivery + intent [R] | a gift without handover needs a notarial deed in France (C. civ. 931 [R]; *don manuel* exception [V notaires.fr]) |
| **Confié** (bon de confiage) | B, with photos / condition report at departure | B | B | B | B | low legal risk; the value line and photos carry a claim |
| **Commission** (commande d'œuvre) | **B+** (price + rights) | B+ | B+ | B+ | B+ | rights clauses need writing (below) |
| **Reproduction licence / rights assignment / photographer's assignment / edition** | **B+ — written and signed**, each right listed (CPI L131-2, L131-3 [R]) | B+ (national copyright law) | **signed writing** (CRRA 2000 s. 120(3) [R]) | **signed writing** (CDPA s. 90(3) [R]) | **signed writing** (17 U.S.C. § 204(a) [R]) | copyright transfers need writing almost everywhere |
| **Exhibition agreement** | B+ ; the venue's own contract if it has one | same | same | same | same | value at risk, rights clause |

### 2.4 The proof pack kept with each order

For every order, the Vault keeps together: the paper as sent, the **signed copy** (and any second copy), the **email / message thread** that carried it (save as PDF), the **payment proof** for sales, and the **condition report / photos** at departure and return (loans, deposits, Confié). Together they prove more than any single signature.

---

## 3. Dons / Gifts

### 3.1 The rules / Les règles (Pem, 2026-11-17)

1. **The owner changes at handover.** Without a notary, a gift of a movable is valid as a *don manuel*, made by **handing over** the object [V: [notaires.fr](https://www.notaires.fr/fr/donation-succession/donation/le-danger-des-dons-manuels)]; the general rule requires a notarial deed (Code civil art. 931 [R]). So the gift happens at « remis », and the paper is a **dated record of the handover** (« remis le … »), signed at or after the handover.
   - The current gift wording (« La propriété passe au bénéficiaire à la signature ») and the app's step (owner = recipient at « signed ») contradict this decision; both change together when built (R7). **Lawyer to read the new wording before the first real gift.**
   - A *pacte adjoint* (a later written acknowledgment) can prove the gift and set conditions [V: notaires.fr].
   - A gift is irrevocable in principle (C. civ. 894; exceptions 953 s. [R]): a **condition or charge** (« not to be sold », « to be exhibited », a right of return) only binds if written — and may push the gift towards a notarial deed (to confirm).
2. **No price on the gift paper.** Ever. The paper lists the works (title, year, medium, size) and the handover.
3. **An internal reference value** is kept in the app on the gift line (default = the work's price that day; stored in `work_order_work.insurance_value` or a later column — R7_Open_Decisions Q1). It serves insurance, estate and Pem's own records. **It is never printed on the gift paper and never counted as income.** If a recipient (a museum, a relative) asks for a value, Pem gives it **separately** (a letter or an insurance valuation), as a choice per gift.
4. A **certificate of authenticity** and a **condition note** at handover are good practice.
5. A gift transfers **no reproduction right** (CPI L111-3 [R]); one line on the paper should say so.

### 3.2 Who declares — France / Qui déclare — France

- **The recipient** declares a *don manuel* — on form 2735, **online since 1 January 2026** in most cases — within **one month** of the moment the gift becomes known to the tax office (the recipient's own declaration, a later gift or inheritance within 15 years, an audit) [V: notaires.fr; impots.gouv]. Duties are the recipient's, on the **market value at the gift date** (CGI art. 757 [R]).
- **Allowances depend on the relationship** (CGI art. 779 [R]): €100 000 parent → child [V: [impots.gouv dons exonérés](https://www.impots.gouv.fr/particulier/dons-exoneres)]; secondary sources give €31 865 grandparent → grandchild, €15 932 between siblings, €7 967 to a nephew or niece [S: [service-public F36656](https://www.service-public.gouv.fr/particuliers/vosdroits/F36656) and others — check the official table]. Between unrelated people the gift duties are high (to confirm the rate on the official table). Allowances renew every **15 years** (CGI 784 [R]).
- **French tax reaches the gift because Pem lives in France:** when the donor is domiciled in France, French gift duty applies to the gifted movables **wherever the recipient lives** (CGI art. 750 ter [R]).
- **A present, not a gift:** a *présent d'usage* — a gift for a customary occasion (birthday, wedding, holidays) **in proportion to the donor's means** — is not a donation and is not taxed or recalled (case law [R]). A small work given to a friend on an occasion may be one; a significant work is not. **Ask the notary / accountant where the line sits for an artist's own work**, whose « value » is Pem's own price.
- **Gifts to public bodies and qualifying non-profits** follow other rules: the State and public bodies are exempt (CGI 794 [R]), approved non-profits too (CGI 795 [R]); a possible tax receipt for the donor (CGI 200, 238 bis [R]) — and whether a gift of Pem's **own** work gives Pem any deduction is the accountant's question.
- **Pem's side:** if Pem is VAT-registered, a business gift may be a taxable supply (CGI 257 [R]); in VAT franchise, nothing. Accountant (§4).

### 3.3 Who declares — Ireland / Qui déclare — Irlande

For a recipient living in Ireland (Tooreeney, Waterford ties):
- Irish **Capital Acquisitions Tax (CAT)** is the **recipient's** (beneficiary's) tax. A gift is within Irish CAT when the disponer **or** the beneficiary is resident or ordinarily resident in Ireland at the gift date, or the property is in Ireland (Capital Acquisitions Tax Consolidation Act 2003, s. 6 [R]). **An Irish-resident recipient is therefore within Irish CAT even though Pem lives in France** (non-domiciled persons are treated as resident only after 5 years — to confirm for the recipient's own case).
- **Small gift exemption:** the first **€3 000 per donor per calendar year** is exempt and needs no return [S: [Revenue — small gift exemption](https://revenue.ie/en/gains-gifts-and-inheritance/cat-exemptions/small-gift-exemption/index.aspx)].
- **Group thresholds** (lifetime totals by relationship): €400 000 (A, child) / €40 000 (B, e.g. sibling, nephew, niece, grandchild) / €20 000 (C, others) for gifts **before 7 October 2026**; Budget 2027 raised them for gifts **on or after 7 October 2026** [S: [Revenue — CAT thresholds](https://www.revenue.ie/en/gains-gifts-and-inheritance/cat-thresholds-rates-and-aggregation-rules/cat-thresholds.aspx); the new figures (a secondary source gives €420 000 for group A) **to confirm** on Revenue's page once the Finance Act is enacted].
- **Return:** a self-assessment return **IT38** is due once the taxable value exceeds **80 % of the group threshold** [S: Revenue]; filing and payment dates on [Revenue — important dates for CAT](https://www.revenue.ie/en/gains-gifts-and-inheritance/cat-thresholds-rates-and-aggregation-rules/important-dates-for-cat.aspx) (**to confirm**). Value = **market value** at the gift date.
- **Double charge:** a gift from France to Ireland can be within **both** French gift duty (donor in France) and Irish CAT (recipient in Ireland). France and Ireland have **no gift-tax treaty** that this draft found (to confirm); Irish law gives a credit for foreign tax on the same gift in some cases (CATCA 2003 s. 107 [R]). **Before a significant gift to someone in Ireland, ask the accountant (French side) and an Irish adviser / the recipient's accountant.**

### 3.4 Other countries, in one line each

- **UK:** no tax on the recipient; inheritance tax concerns UK-linked donors — not Pem (to confirm). **US:** gift tax is the donor's and concerns US persons — not Pem; a US recipient of large gifts from a foreigner may have to **report** them (IRS Form 3520; threshold to confirm) [R]. **Moving the work:** a living artist's own works are outside the EU export-licence rules for cultural goods (Regulation (EC) No 116/2009, annex I, « which do not belong to their originators » [R]); import VAT / duty abroad is the recipient's.

---

## 4. TVA et factures / VAT and invoices — open, the accountant's call

Nothing here is decided. The papers print **no VAT mention** today and the « invoice when paid » is **not built** (R7 wording §0 items 1–2, §6.1–6.2). Facts already gathered [V via R7 wording]: VAT franchise for artist-authors under **€50 000** artistic turnover (cut-over at €55 000 in the year), mention « TVA non applicable – article 293 B du CGI »; if registered, **5.5 %** on an original work sold by its author, 10 % on copyright assignments, 20 % otherwise; e-invoicing reception from 1 September 2026, issuing from 1 September 2027 for small businesses [R].

**Questions for the accountant** (also in §7):
1. **Pem's status** today: artiste-auteur in BNC? VAT franchise or registered? Since when, and the turnover figures for the last two years.
2. **The exact mention** to print on each paper (sale, deposit price, commission, licence) and whether prices are shown HT, TTC or « TVA non applicable ».
3. **Invoice:** must Pem issue one for every sale or only on request (consumer) / always (business)? From which number series? Does the « bon de commande » need to become an invoice, or both exist?
4. **Deposit (dépôt-vente):** who invoices the final buyer — the gallery in its own name (then Pem invoices the gallery) or Pem? Is the gallery's commission a service invoiced to Pem, with VAT? HT or TTC basis for the commission?
5. **Cross-border, EU:** sale to an EU gallery (VAT number, exempt intra-EU supply?) and to an EU consumer at a distance (OSS, €10 000 EU-wide threshold [R]) — what changes if Pem is in franchise?
6. **Export (UK, US):** export exemption, the proof of export to keep, who handles customs.
7. **Gifts:** any VAT consequence; any income-tax consequence or deduction for a gift of Pem's own work (to a museum, to an approved body).
8. **Reference value basis** for gifts and loans: list price, last sale, gallery price?
9. **Licence and commission income:** copyright income vs sale income, VAT rate, the right « régime » for royalties.
10. **E-invoicing:** does the September 2027 obligation reach Pem, and what does it mean for PDFs made by the app?
11. **Records:** how long Pem must keep each piece (§5) under Pem's regime.
12. **Expenses paid to craftsmen (Confié):** what proof to keep; VAT recovery if registered.

---

## 5. Conservation des papiers / Keeping papers

### 5.1 Where and how they are named (R7, verified in code 2026-11-17)

| Kind | Vault folder | R2 prefix | Paper file | Signed copy |
|---|---|---|---|---|
| Vente | `Commandes/Ventes` | `commandes/ventes/` | `<REF>_bon-de-commande.pdf` | `<REF>_bon-de-commande_signe.<ext>`, then `_signe-2`, … |
| Dépôt | `Commandes/Dépôts` | `commandes/depots/` | `<REF>_bordereau-depot.pdf` | `…_signe.<ext>` |
| Prêt | `Commandes/Prêts` | `commandes/prets/` | `<REF>_contrat-pret.pdf` | `…_signe.<ext>` |
| Don | `Commandes/Dons` | `commandes/dons/` | `<REF>_acte-de-don.pdf` | `…_signe.<ext>` |
| Confié (decided, **not in code** in this read) | `Commandes/Confiés` (planned, R7_Open_Decisions Q3) | to define | `<REF>_bon-de-confiage.pdf` (proposed) | `…_signe.<ext>` |

Sources: `VAULT_ORDER_FOLDERS` and `ORDER_KEY_PREFIX` in [`lib/vault/folder-routing.ts`](../lib/vault/folder-routing.ts); `PAPER_SLUG` in [`lib/orders/order-paper.ts`](../lib/orders/order-paper.ts); naming policy comment in `app/atelier/(portal)/sales/orders-actions.ts` (« `<REF>_<paper>.pdf`, signed copy `<REF>_<paper>_signe.<ext>` »). `<REF>` = `V-`, `D-`, `P-`, `G-` (+ `C-` planned) + year + number.

**Proposal (no code, own GO):** the contracts that are not orders (commission, licence, photographer, exhibition, edition — §6) get a `Contrats/<type>` folder each, named `<YYYY-MM-DD>_<party>_<type>.pdf` and `…_signe.<ext>`, and are linked to the works they concern. Also keep the **proof pack** of §2.4 next to the signed copy.

### 5.2 How long

| What | Keep at least | Basis |
|---|---|---|
| Sale, deposit, gift and loan papers + signed copies | **For the life of the work** (in practice: permanently) | they are the **title and provenance** of the work — needed for a later sale, an insurance claim, the estate, a catalogue raisonné, a resale-right claim. Legitimate interest under GDPR art. 6(1)(f) — keep the personal data to what the paper needs [R] |
| Invoices and accounting pieces | **10 years** (safe default) | Code de commerce L123-22 (10 years, for *commerçants*) [R]; the tax office's audit right runs 6 years (LPF L102 B [R]); accountant to confirm for Pem's regime. Irish Revenue: 6 years for Irish tax records [R] |
| Contracts with ongoing duties (deposit, loan, Confié) | end of the contract **+ 5 years**, then as above if they prove title | civil limitation 5 years (C. civ. 2224 [R]); commercial 5 years (C. com. L110-4 [R]) |
| Rights contracts (licence, assignment, photographer, edition) | **as long as the rights last + 5 years** (author's rights last 70 years after death, CPI L123-1 [R]) — i.e. permanently, for the estate | — |
| Paper originals, where one exists | keep the original as well as the scan | an original beats a copy if the copy is disputed (C. civ. 1379 [R]) |
| Personal data of people who did **not** sign anything (enquiries, abandoned drafts) | delete or anonymise when no longer needed (proposal: 3 years after the last contact) | GDPR art. 5(1)(e) storage limitation [R] |

A short privacy line on the papers (who keeps the data, why, how to ask) is a lawyer's point (R7 wording §6.6).

---

## 6. Modèles de contrats / Template list

Status as read on 2026-11-17: four papers exist in [`lib/orders/order-paper.ts`](../lib/orders/order-paper.ts) (`PaperKind` = sale, consignment, loan, gift). Everything else is **to write**, and every text — existing or new — needs a lawyer's read before it is sent.

| # | Template (FR / EN) | Status | Main clauses | What the lawyer must check |
|---|---|---|---|---|
| 1 | **Bon de commande / Purchase order** (Vente) | **exists in code** | works, price, discount, deposit, reservation of title until paid, custody at delivery, cooling-off row | VAT mention; invoice vs order; 14-day return on every sale (house rule, decision 6): statutory wording + model form for distance / off-premises consumers, contractual wording for the others; payment terms, delivery, risk (C. conso. L216-4 [R]); hidden-defect / conformity guarantees; reproduction + moral right line (CPI L111-3, L121-1 [R]); COA; law / court / CISG exclusion; whether consumer law applies to Pem at all; bilingual body |
| 2 | **Contrat de dépôt-vente / Consignment agreement** (Dépôt) — title today « Bordereau de dépôt-vente » | **exists in code** | agreed prices, commission, period, gallery keeps custody + insurance, no loan / transfer, unsold works returned | it is a **mandate to sell** (C. civ. 1984 s., 1993 [R]): discount authority, exclusivity / territory, who invoices, **payment delay after a sale**, sales report, **insured value per work**, « not part of the gallery's stock » (insolvency, C. com. L624-9 [R]), end / renewal / early withdrawal, costs, images for promotion, VAT on commission; foreign gallery: law, court, the state's consignment statute (US) |
| 3 | **Contrat de prêt / Loan agreement** (Prêt) | **exists in code** | period, purpose (in notes), insurance « clou à clou » at the stated value, credit line, condition reports | **per-work agreed value** (today the list price prints silently); insurance certificate before departure, beneficiary, loss settlement; transport / packing; display conditions; reproduction limited to documentation; early recall; venue address printed; institution's own convention takes over |
| 4 | **Reçu de don / Gift record** (Don) — title today « Acte de don » | **exists in code; wording must change** | today: gift free of charge, ownership at **signature** | rewrite as a **handover record** (*don manuel*, owner at handover — Pem's decision); **no price**; title « Acte » vs « Reçu de remise »; conditions / charges in writing (or notary); recipient's capacity (museum committee, minor's representative); no reproduction right; COA + condition at handover |
| 5 | **Bon de confiage / Entrustment slip** (Confié) | **to write** (decided as fifth kind; draft table in R7_Open_Decisions Q3; not in code as read) | job to do per work, insurance value, period, agreed price / quote, provider insures while in custody, condition report out and back, no other intervention / sale / loan / sub-contracting | contract type (contrat d'entreprise, C. civ. 1787 s. [R]); **moral right — exactly what the provider may do** to the work (CPI L121-1 [R]); **right of retention** if unpaid (C. civ. 2286 [R]); liability for loss (C. civ. 1789 [R]); photographer / printer cases: who owns the images and proofs (→ #8) |
| 6 | **Contrat de commande d'œuvre / Commission agreement** | **to write** | description, size, deadline, price and instalments (non-refundable deposit?), sketch / approval stages, delivery, what happens if the client refuses the final work | **the artist decides when the work is finished** (droit de divulgation, CPI L121-2 [R]); commissioning gives **no rights** (CPI L111-1 al. 3 [R]); any rights granted listed one by one (L131-3 [R]); preparatory sketches stay Pem's; cooling-off excluded for made-to-order (CRD art. 16(c)); CISG (art. 3) for a foreign business client |
| 7 | **Licence de reproduction / Image licence** | **to write** | which works, which uses (print, web, merch, press), medium, territory, duration, number of copies, fee, credit, exclusivity, approval of proofs | CPI L122-4, L131-2, **L131-3** (each right named, scope, purpose, place, duration) [R]; **proportional remuneration** rule and its exceptions (L131-4 [R]); **is Pem an ADAGP member?** — if so ADAGP may grant / collect for some uses, not Pem directly (to confirm); VAT on copyright (§4); foreign licensee: written signed licence (US § 204(a), UK s. 90(3), IE s. 120(3) [R]) |
| 8 | **Cession de droits du photographe / Photographer's rights assignment** | **to write** | photos of Pem's works: the photographer assigns (or licenses) to Pem the rights to use them on the site, press, catalogue, social media, books; credit; fee; files delivered | photographs are protected works (CPI L112-2 [R]); assignment in writing, each right listed (L131-2, L131-3 [R]); **flat fee** allowed only in listed cases (L131-4 [R]); the photographer's **moral right** (credit); the photographer's own portfolio use needs **Pem's** permission (the photos reproduce Pem's works); people visible in shots — image right (C. civ. 9 [R]) |
| 9 | **Convention d'exposition / Exhibition agreement** (venue) | **to write** | dates, place, works list, transport / installation, insurance clou à clou, sales during the show and the venue's commission, communication images and credit, condition reports, opening costs | **fee for the « droit de présentation publique »** — the Ministry of Culture recommends paying artists for exhibiting in publicly funded venues (to confirm the current scale) [R]; reproduction limited to the event; who invoices sales (→ #2 rules); venue's own convention usually wins |
| 10 | **Contrat d'édition / Edition agreement** (prints, books) | **to write** | for **prints**: number of copies, artist's proofs, numbering and signing, paper / technique, printer, plates destroyed, price split; for **books**: publisher's rights, print run, royalty, accounts | **book:** *contrat d'édition* has mandatory content (CPI L132-1 s., digital L132-17-1 s. [R]); **prints:** to count as **original works** (5.5 % VAT, resale right) editions must stay within the legal limits — e.g. engravings / lithographs / screen prints and photographs **≤ 30 copies**, signed and numbered; sculpture casts ≤ 8 (CGI annexe III art. 98 A [R]); descriptions per décret n° 81-255 (« épreuve d'artiste »…) [R]. If the printer only **manufactures** for Pem (Pem publishes), it is a service + a Confié (#5), not an edition contract |

---

## 7. Questions à envoyer / Questions to send (one page)

*Texte en français, prêt à envoyer tel quel. Contexte à joindre : ce fichier + `R7_Papers_Wording.md` (texte actuel des papiers). / French, ready to send; attach this file and the wording review.*

**Pour l'avocat·e (droit des contrats, propriété intellectuelle, consommation)**

1. **Statut :** un artiste-auteur qui vend ses propres œuvres est-il un « professionnel » au sens du Code de la consommation ? (Conséquences : rétractation, médiateur, garantie légale de conformité, information précontractuelle.)
2. **Clause de loi et de tribunal :** « droit français, à l'exclusion de la CVIM, tribunaux de Marseille, sous réserve des règles impératives protégeant le consommateur » — valable et utile ? Portée de l'art. 48 CPC si je ne suis pas commerçant ; et face à une galerie française, européenne, irlandaise, britannique, américaine ?
3. **CVIM :** l'exclure sur mes papiers, ou l'accepter quand une galerie étrangère la demande ?
4. **Rétractation :** j'accorde 14 jours de retour sur toutes mes ventes, par choix (les sommes reçues restent de côté jusqu'à la fin du délai). Rédiger deux versions : le droit légal (vente à distance / hors établissement à un consommateur, avec le formulaire type) et l'engagement contractuel de l'atelier pour les autres ventes (atelier, salon, acheteur professionnel) — modalités de retour, état de l'œuvre, frais de transport. Et les œuvres commandées ?
5. **Signature :** envoi du PDF, retour signé (scan ou signature dans un lecteur PDF) — suffisant pour quelles opérations et jusqu'à quel montant ? Quand faut-il deux originaux papier ou une signature électronique avancée / qualifiée (vente importante, dépôt chez une galerie, prêt) ?
6. **Don :** relire le papier réécrit en « reçu de remise » (*don manuel*, propriété à la remise, aucun prix imprimé). Conditions ou charges possibles sans notaire ? Où passe la limite du présent d'usage pour une œuvre de l'artiste ? Don à un musée ou à une association : forme et acceptation.
7. **Dépôt-vente :** jeu de clauses de mandat (pouvoir de remise, exclusivité, délai de paiement, relevé des ventes, valeur d'assurance, « hors stock » en cas de procédure collective, fin du mandat). Et pour une galerie aux États-Unis (lois d'État sur la consignation) ?
8. **Prêt :** valeur agréée, attestation d'assurance avant départ, sinistre, transport, conditions de présentation, reproduction, rappel anticipé.
9. **Droit d'auteur :** une ligne type « la vente / le prêt / le don ne transfère aucun droit de reproduction ; droit moral inaliénable » pour tous les papiers. Suis-je tenu·e de passer par l'ADAGP pour les licences si j'y adhère ?
10. **Nouveaux modèles :** relire les six modèles à écrire — bon de confiage, commande d'œuvre, licence de reproduction, cession de droits du photographe, convention d'exposition, contrat d'édition (estampes et livres, limites de tirage).
11. **Mentions communes :** nombre d'originaux, identité et qualité du signataire, langue (« la version française fait foi »), médiateur, données personnelles et durée de conservation.
12. **Irlande et Royaume-Uni :** l'article 4 du Sale of Goods Act 1893 (écrit pour une vente de biens) est-il encore en vigueur en Irlande ? Exécution d'un jugement de Marseille au Royaume-Uni (Conventions de La Haye 2005 / 2019).

**Pour l'expert-comptable**

1. Mon statut fiscal et social aujourd'hui (artiste-auteur, BNC, franchise de TVA ou non), chiffres des deux dernières années.
2. La mention TVA exacte à imprimer sur chaque papier (vente, prix de dépôt, commission, licence) ; prix affichés HT, TTC ou « TVA non applicable, art. 293 B du CGI ».
3. Facture : obligatoire quand, avec quelle numérotation ; le bon de commande suffit-il ? Facturation électronique (réception 2026, émission 2027) : me concerne-t-elle ?
4. Dépôt-vente : qui facture l'acheteur final ; la commission de la galerie (base HT ou TTC, TVA) ; ce que je dois recevoir de la galerie.
5. Ventes dans l'UE (galerie avec n° de TVA ; particulier à distance, guichet OSS) et hors UE (Royaume-Uni, États-Unis : exportation, preuves).
6. Dons : base de la valeur de référence d'une de mes œuvres (prix catalogue, dernière vente, prix galerie) ; conséquence TVA ou impôt ; déduction possible pour un don à un musée ou à un organisme agréé.
7. Don à une personne résidant en Irlande : double imposition (droits de donation français + CAT irlandais) — que faut-il prévoir, qui consulter côté irlandais ?
8. Revenus de licences, de commandes et de cessions de droits : régime, taux de TVA.
9. Durée de conservation de chaque pièce (factures, contrats, papiers de vente, preuves de paiement).
10. Dépenses chez les artisans (encadreur, photographe, imprimeur) : justificatifs à garder, TVA récupérable.

---

## 8. Sources

**Read on 2026-11-17 [V]** (through the R7 wording review, see its §8): service-public [F32113](https://entreprendre.service-public.gouv.fr/vosdroits/F32113) (artist-author VAT), [F31808](https://entreprendre.service-public.gouv.fr/vosdroits/F31808) (invoice mentions), [F10485](https://www.service-public.gouv.fr/particuliers/vosdroits/F10485) (distance withdrawal); notaires.fr [don manuel](https://www.notaires.fr/fr/donation-succession/donation/le-danger-des-dons-manuels); impots.gouv [dons exonérés](https://www.impots.gouv.fr/particulier/dons-exoneres).

**Seen today in official pages' search results [S]** (open and read before relying):
- Regulation (EU) 2024/3228 (end of the ODR platform, 20 July 2025): [EUR-Lex](https://eur-lex.europa.eu/eli/reg/2024/3228/oj/eng).
- CISG text and status: [UNCITRAL](https://uncitral.un.org/en/texts/salegoods/conventions/sale_of_goods/cisg).
- 2019 Hague Judgments Convention in force for the UK on 1 July 2025: [HCCH news](https://www.hcch.net/de/news-archive/details/?varevent=1085).
- Ireland, resale right: [S.I. No. 312/2006](https://www.irishstatutebook.ie/2006/en/si/0312.html).
- Ireland, CAT: [small gift exemption](https://revenue.ie/en/gains-gifts-and-inheritance/cat-exemptions/small-gift-exemption/index.aspx); [thresholds](https://www.revenue.ie/en/gains-gifts-and-inheritance/cat-thresholds-rates-and-aggregation-rules/cat-thresholds.aspx); [important dates](https://www.revenue.ie/en/gains-gifts-and-inheritance/cat-thresholds-rates-and-aggregation-rules/important-dates-for-cat.aspx); Revenue eBrief [149/26](https://www.revenue.ie/en/tax-professionals/ebrief/2026/no-1492026.aspx) (Budget 2027 thresholds — figures to confirm).
- France, gift allowances: [service-public F36656](https://www.service-public.gouv.fr/particuliers/vosdroits/F36656).

**To confirm on the official text [R]:**
- EU: Rome I — [Reg. 593/2008](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32008R0593) arts. 3, 4, 6; Brussels I bis — [Reg. 1215/2012](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32012R1215) arts. 7, 17–19, 25, 36, 39; Consumer Rights Directive — [Dir. 2011/83/EU](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32011L0083) arts. 2, 4, 6, 8, 9, 10, 16; eIDAS — [Reg. 910/2014](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32014R0910) art. 25, as amended by Reg. 2024/1183; resale right — [Dir. 2001/84/EC](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32001L0084); small claims Reg. 861/2007 (+ 2015/2421); order for payment Reg. 1896/2006; cultural goods export Reg. 116/2009.
- France ([Légifrance](https://www.legifrance.gouv.fr)): Code civil 9, 894, 931, 953 s., 1359–1362, 1366–1367, 1375, 1379, 1582–1583, 1641 s., 1787 s., 1789, 1984 s., 1993, 2224, 2286; décret n° 80-533 du 15 juillet 1980; décret n° 2017-1416; Code de procédure civile 42, 46, 48; Code de commerce L110-3, L110-4, L123-22, L624-9; Code de la consommation article préliminaire, L216-4, L217-3 s., L221-5, L221-13, L221-18, L221-28, L612-1; CPI L111-1, L111-3, L112-2, L121-1, L121-2, L122-4, L122-8, L123-1, L131-2, L131-3, L131-4, L132-1 s.; CGI 200, 238 bis, 257, 293 B, 750 ter, 757, 779, 784, 794, 795, annexe III art. 98 A; LPF L102 B; décret n° 81-255 du 3 mars 1981; loi n° 94-665 (Toubon).
- Ireland ([irishstatutebook.ie](https://www.irishstatutebook.ie)): Sale of Goods Act 1893 s. 4; Consumer Rights Act 2022; Copyright and Related Rights Act 2000 s. 120; Electronic Commerce Act 2000; Capital Acquisitions Tax Consolidation Act 2003 ss. 6, 107.
- UK ([legislation.gov.uk](https://www.legislation.gov.uk)): retained Rome I; Consumer Contracts Regulations 2013; CDPA 1988 s. 90; Artist's Resale Right Regulations 2006; Hague Choice of Court Convention 2005.
- US: UCC §§ 1-301, 2-201; Restatement (Second) Conflict of Laws § 187; 15 U.S.C. § 7001 (ESIGN); 17 U.S.C. §§ 106A, 202, 204; 16 CFR part 429; New York Arts and Cultural Affairs Law art. 12; Uniform Foreign-Country Money Judgments Recognition Act; HTS 9701.

*Rien de ce qui précède ne remplace un·e avocat·e ou un·e expert-comptable. / None of this replaces a lawyer or an accountant.*
