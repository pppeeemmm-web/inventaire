# R7 — Open decisions for Pem (2026-11-17)

**Status: decision document. No code, no SQL, nothing built.** One section per open question, each with 2–3 options, what each does in the app and the data, and a recommendation. Context: [`R7_Orders.notes.md`](./R7_Orders.notes.md) (v2 section: « Still open »), [`R6_Events.notes.md`](./R6_Events.notes.md) (v2: the fifth kind « Confié »), the wording review [`R7_Papers_Wording.md`](./R7_Papers_Wording.md).

> Legal and tax remarks are **not legal or tax advice**: they are public rules read from service-public, impots.gouv, notaires.fr and the codes, listed with their source in the wording review. Anything that depends on Pem's own status needs the accountant or a lawyer.

Facts below were read in the live code of this worktree on 2026-11-17 (file named each time). Nothing was clicked or written.

## What to decide first

| # | Decision | Why first |
|---|---|---|
| 1 | **Gift: does the owner change at signature or at handover?** (not the price — the *legal* shape of the gift paper) | A gift without a notary is only valid as a hand-to-hand gift (*don manuel*). The app moves the owner at « signed ». Ask a lawyer before the first real gift paper goes out. See Q1, point « What to settle before the price ». |
| 2 | **Gift price: keep the price + a reference value on the gift line (option B)** | Cheap, reversible, stops the old « price = 0 » behaviour for good. See Q1. |
| 3 | **How papers are sent: share-sheet PDF + signed copy back (option B) now; e-signature only on demand** | Defines what the phone does. Nothing to build for e-signature yet. See Q2. |
| 4 | **« Confié »: a fifth kind, the work keeps its stage (option A)** | It changes R7's kind list, the custody check and the Orders form — settle before R6 builds on it. See Q3. |
| 5 | **Two points that sit outside this file but block the Vente paper:** Pem's VAT status (franchise or not) and whether the cooling-off row prints for every sale | Both are in the wording review (§6.1, §2.5). The accountant / lawyer answer them. |

---

## Q1 — The gift price

### Today (verified in code)

- A signed gift **keeps the work's price**: `advanceWorkOrder` (`app/atelier/(portal)/sales/orders-actions.ts`, the « gift signed » branch) moves the work to « Gift » with owner = recipient and writes **no** price (comment: « The price is kept (gift price still an open question, brief Q8) — the old dialog set it to 0 »). The old dialog zeroed `Prix` and `PrixFinal` (`app/atelier/works/gift-actions.ts:112–113`); the 7 reconstituted gift orders were not touched (« prices unchanged »).
- **The gift paper prints no value**: `VALUE_HEAD.gift = null`, and `makeOrderPaper` passes `value = null` for gifts (`orders-actions.ts:532`). The gift order form has no price field (only a sale form takes `price_final`).
- **A gift never counts as income**: Fiscal « recettes » is `fetchSalesIncome` = rows of `payments` dated in the year + completed **sale** orders with no payment row (`lib/sales/income.ts`); « Par année » uses the same entries. A gift order has neither.
- **Where a gift's price can still show up**: the Reports « sales » source includes works whose status is `gift` (`Reports.tsx`, `SALE_STATUSES = sold, reserved, consigned, gift`), and the Inventory pivots sum `PrixFinal ?? Prix` (`Inventory.tsx`, lines ~957–963). Whether they total gifts with the rest was not checked — to look at when the choice is made.
- The order line (`work_order_work`) already has `price` and `insurance_value` columns; **no screen fills `insurance_value`** (it is the same gap that makes the loan paper print the list price).

### What each side of the question means

- **Insurance.** Between *signature* and *handover* the work belongs to the recipient but is still in Pem's studio (custody table, `WORK_CUSTODY_MODEL.md`: « Gift, deed signed, not handed over — owner recipient, custodian Pem »). Who insures it in that gap, and at what value, is not stated anywhere. After handover the recipient insures it; a value on the paper helps them. A museum recipient will ask for one.
- **Donation tax** ([V] [notaires.fr](https://www.notaires.fr/fr/donation-succession/donation/le-danger-des-dons-manuels), [impots.gouv.fr](https://www.impots.gouv.fr/particulier/dons-exoneres)). The gift is the **recipient's** to declare, within one month, once the tax office knows of it (declaration online since 1 Jan 2026); a *don manuel* is not taxed while unknown, but the recipient's declaration, a later gift or inheritance (15-year look-back), or an audit reveals it. Duties depend on the **relationship** (e.g. 100 000 € allowance parent → child; the page does not list the others, check the official table) and the value is the **market value at the gift date**. For an artist's own work that value is arguable (studio price, gallery price, last sale). A printed figure becomes a **written, dated piece of evidence** either way. Gifts to qualifying non-profits and public bodies follow other rules [R].
- **The price on the gift paper.** Today none. A museum, a foundation or a relative may want one; a friend may not want a figure at all.
- **Revenus & dépenses.** A gift is not income. The risk is not today (no payments, no completed sale order) but **tomorrow**: Fiscal still reads the old `payments.order_id` / `sale_order`; when it moves to `work_order`, gift orders must stay out and `price_final` must stay empty for them.

### Options

**A. Keep the work's price, say nothing (today).**
- *App / data:* the work stays « Gift » with its `Prix`; nothing is printed, no value on the order. Nothing to build.
- *For:* simplest; no figure leaves the studio. *Against:* no value as it was **on the gift day** (the list price will change later); the recipient has nothing to insure or declare from; the gap between signature and handover has no value either.

**B. Keep the price, and add a « reference value » on the gift line (recommended).**
- *App / data:* the work keeps `Prix` untouched. Each gift line gets an editable **valeur de référence** (default = the work's price at the time of signing, can be emptied), stored in the existing `work_order_work.insurance_value` — no SQL needed — or a clearer column later if wanted (own OK). The gift paper prints `VALEUR DE RÉFÉRENCE / REFERENCE VALUE` **only when filled**, with a short line « indicative, non contractuelle ». The same per-line field also fixes the loan paper (it prints the list price silently today). Revenue stays out: no payments row, `price_final` null for gifts.
- *For:* a dated snapshot; works for insurance, museum, estate; Pem chooses per gift whether a figure appears. *Against:* a printed figure is evidence in a tax discussion — the accountant should say which basis (price list, gallery price) to use for her own works. One small form change (gift + loan line value).
- *Reports / Inventory:* label the value column « valeur » for gifts or leave gifts out of revenue-style totals (a few lines each; to verify when built).

**C. Set the price to 0 (the old dialog).**
- *App / data:* `Prix = PrixFinal = 0` on signing.
- *For:* no figure anywhere; a gift can never look like a sale. *Against:* the work **loses its value** for any later appraisal, estate or insurance; found issue 3 in the R7 brief; not reversible without the history (version snapshots exist, but a zeroed field is easy to miss).

### Recommendation

**B.** Keep `Prix`; store a per-gift **reference value** on the order line, printed only if Pem fills or keeps it; never write it to income. Ask the accountant one thing: which basis to quote for her own works (and whether she wants a figure on every gift). C is the one option to rule out. Add a note in R7 that Fiscal's move to `work_order` must **exclude `kind = 'gift'`**.

### What to settle before the price — the paper's legal shape (from the wording review §5)

The gift paper says « La propriété passe au bénéficiaire à la signature ; la garde, à la remise ». Without a notary, a gift is valid as a **don manuel**, completed by **handing over** the object ([V] notaires.fr). A signed deed with the work still in Pem's studio is neither a notarial deed nor yet a don manuel. The app mirrors the paper (owner at « signed », custodian at « handed over »), so **the paper and the data change together**. Options to put to the lawyer: (i) keep as is, as a *promise* then handover; (ii) make the **handover the gift** — the paper becomes a *reçu de remise* dated on the day, the owner changes at « handed over »; (iii) for a high-value gift, a notarial deed. Not a build question yet; a question for the lawyer before the first real gift.

---

## Q2 — How the papers are sent, and what the phone does

### Today (verified in code)

- The order panel makes the paper (« Faire / Refaire le papier »), opens it through a signed link (« Ouvrir »), and takes **a signed copy** back (« Ajouter la copie signée », not on a draft): a PDF or a photo up to 4 MB; photos are shrunk to 2400 px in the browser first (`attachSignedCopy`). Naming: `…_signe.<ext>`, same Vault folder.
- **Nothing sends a paper.** There is no « send » button, no email from the app, no share sheet on the paper. Marking the order « signed » is a separate manual step from attaching the signed copy.
- `CLAUDE.md`: **no transactional email** without the owner's GO. The phone's canonical image path is the PWA share *target* (receiving), not sharing out.
- Zero real orders so far: whichever way is chosen is the way of the first real case.

### Options

**A. Print, sign by hand, scan or photograph (today).**
- *Flow:* Pem downloads the PDF, prints, both sign, photograph the page, upload as the signed copy. Phone: photograph and upload; mark signed.
- *For:* no tool, no cost, no third party, works anywhere. *Against:* needs a printer (or the other party's); the other party must be in the room or mail it; slow for a gallery abroad.

**B. Share the PDF, the counterpart signs and returns it; Pem uploads the result (recommended).**
- *Flow:* the paper is sent from **Pem's own mail or messaging** (desktop: download + attach; phone: the **share sheet**, i.e. `navigator.share` with a PDF file — supported in Safari / installed PWAs on recent iOS and Android [R], to be tested on Pem's phone). The other party **prints and signs, or signs the PDF with a free reader tool, or replies « bon pour accord »**; the returned PDF/photo is uploaded as the signed copy. Optionally the order records a « sent » date.
- *App / data:* a « Partager le papier » button (phone) and « Télécharger » (desktop); an optional `sent_at` stamp on the order (SQL, own OK — or no stamp at all in v1); the signed-copy slot already exists. **No email service, no third-party processor.**
- *For:* nearly free, reuses what is built, Pem stays in control of what leaves; fits a gallery or a collector who already emails. *Against:* the proof of a reply « bon pour accord » or a typed name is weaker than a signature service (it is still evidence: [R] Code civil art. 1366–1367 — an electronic writing is admissible, but the signing process's reliability may have to be proven unless it is a *qualified* signature [R]).
- *Two-original rule and identity:* ask the lawyer if two originals or an identity line are needed (wording review §1.4).

**C. E-signature service (Yousign, DocuSign, Adobe Acrobat Sign, …) driven by the app.**
- *Flow:* the app uploads the PDF to the service; the counterpart signs on their phone; the service returns the signed PDF plus an evidence file; the order moves to « signed » by itself.
- *App / data:* an API key, a webhook (or polling), a table for the envelope state, stored evidence file; GDPR: a **processor** that receives the counterpart's data (prefer an EU-hosted one). Recurring cost and a vendor dependency. Legal weight: simple / advanced / **qualified** levels under eIDAS (EU 910/2014) and Code civil art. 1366–1367; only the qualified signature has the presumption of reliability [R: [ANSSI guide](https://cyber.gouv.fr/sites/default/files/document/anssi-eidas-guide-niveau-signature.pdf); [Yousign — signature électronique et Code civil](https://yousign.com/fr-fr/blog/signature-electronique-code-civil)]. Check each vendor's current price and EU hosting before choosing — not looked up here.
- *For:* clear audit trail, automatic « signed » step, convenient for distant parties. *Against:* a new subsystem for zero real orders; `CLAUDE.md` rule against deferred features; and **a museum or gallery often sends its own contract** to sign anyway.

*Variant of B — signing on the phone's screen* (Pem's phone, the buyer signs with a finger at an open studio): quick, but a weak proof; can be added later on top of B for small sales. Not recommended as the base.

### What the phone does under the recommended option (B)

| On the phone | Does | Already built? |
|---|---|---|
| Open orders as cards | each shows the next step and « awaiting signed copy » | the card list is built (R7 slice 1); the « awaiting copy » badge is not |
| **Partager le papier** | opens the share sheet with the PDF (mail, WhatsApp, AirDrop, print) | **no** — to build; needs a test on Pem's phone, and a fallback « Télécharger » where `navigator.canShare({ files })` is false |
| **Photographier la copie signée** | file input with the camera, shrunk to 2400 px, stored as `…_signe` | uploading a photo works today; the camera shortcut on the phone is a small addition (`CLAUDE.md` allows native capture for scans, not on work-image paths) |
| **Marquer signé** | explicit step, with a confirmation | built (works move at « signed » — confirm first) |
| Warn when **signed but no copy** | a chip on the order and on the Today list | not built |

### Recommendation

**B now; C only on demand.** Build « Partager le papier » (phone) and « Télécharger » (desktop), keep the signed-copy upload as it is, add a « signed but no copy » chip, and treat an institution's own convention as the **signed copy** or an extra paper on the order (the slot must accept a PDF Pem did not make). Revisit C when a counterpart *requires* it or the real orders pass a handful a year. One question for the lawyer: for each kind, is an emailed PDF returned with a scanned signature enough, or is a stronger signature needed (high-value sale, deposit with a gallery, loan to an institution)?

---

## Q3 — « Confié »: a fifth order kind

### The question (R6 v2, Pem 2026-11-17)

Works leave the studio for a **job** — a **printer** (edition calibration), a **photographer**, a **framer**, a **restorer** — and Pem needs to know where each one is until it comes back. Today nothing says so: the work stays « Disponible » at Pem's, and if it is lent, the loan paper is for a public display. R6 v2 proposes a fifth kind **Confié / Entrusted** (chip `C`, refs `C-2026-001`, paper « Bon de confiage »), steps draft → signed → out (chez l'artisan) → back; owner stays Pem, custodian = the craftsman.

### Today (verified in code)

- The four kinds are hard-coded: `WorkOrderKind` and the steps in `orders-actions.ts`, `PaperKind` / `PAPER_SLUG` / `PAPER_TITLE` in `lib/orders/order-paper.ts`, the step lines in `Orders.tsx`, `VAULT_ORDER_FOLDERS`, the kind buttons of `NewOrderForm.tsx`, plus the SQL kind check, the ref trigger (V / D / P / G), the custody check (`oeuvre_holder_check`, `oeuvre_order_exists`) and the destroyed / lost closing (`oeuvre_fate_close_orders`).
- **A work can only sit with someone other than Pem under an order of kind sale, consignment or loan**; the DB refuses « custody_order_required » otherwise (line test of 2026-11-17).
- A Prêt closes with the works back « Disponible » at Pem's, with a « rentrée » line — which is exactly what a Confié needs.

### Options

**A. A fifth kind « Confié »; the work keeps its stage (recommended).**
- *App / data:* kind `entrust` in `work_order` (status check unchanged: draft · signed · out · closed · cancelled; ref letter `C`); the custody check accepts a craftsman as custodian under an **open Confié order** while the **stage stays whatever it was** (« En production », « Disponible », « Catalogué »…). The work card shows a derived chip « Confié · chez <artisan> · C-2026-001 » and links to the order; the order closes → custodian back to Pem. Paper « Bon de confiage », folder `Commandes/Confiés`; destroyed / lost closes it like the others.
- *For:* answers « where is it » for every case (framing, restoration, photography, printing) without touching the stage vocabulary, the public-site flag (`is_public` is set by trigger on public stages) or the many lists keyed on stages (production scope, reports, inventory). A work in production can go to the framer and come back as it was. *Against:* the work card needs one derived chip; DB check and the Orders form change (the same size as adding any kind).

**B. A fifth kind plus a new stage « Confié ».**
- *App / data:* as A, and a new row in `OeuvreStatus` that the work takes while out and leaves when back.
- *For:* visible in every stage filter and dot. *Against:* the work **loses its real stage** while out (is it « En production » or « Disponible » when it returns?), needs a rule for the public flag, the production scope and every stage switch (`PRODUCTION_EXCLUDED_STATUSES`, reports, workflow) — wide, and unnecessary: where it is is custody, not stage.

**C. No new kind: a Prêt with a purpose (R6 v1).**
- *App / data:* a `purpose` on the loan (`exposition`, `édition`, `prise de vue`, `encadrement`, `restauration`) and a second paper title for the non-exhibition ones; the stage « Prêt » is used.
- *For:* least change. *Against:* Pem rejected it (« not a Prêt with a purpose »): the work would read « Prêt » while at a framer; the Prêt paper carries a credit line and display wording that make no sense for a craftsman; the purpose is not a field the paper prints today.

### Recommendation

**A.** It is what Pem asked for, it is the cheapest way to answer « where is it », and it needs no new stage. Resolve R6's open sub-question this way: **no stage change; the work keeps its stage and shows « chez <artisan> »**.

### Draft of what the « Bon de confiage » should say (for a later wording review, not in code)

| Part | Content |
|---|---|
| Header | Bon de confiage / Entrustment slip · ref `C-YYYY-NNN` · date |
| Parties | L'ARTISTE · LE PRESTATAIRE (printer / photographer / framer / restorer) with address |
| Works | as the other papers, with **insurance value** and the **job to do** per work |
| Terms rows | Nature of the job (a free line or a short choice: encadrement · restauration · prise de vue · tirage / impression) · Période (out → back by) · Prix convenu / devis (optional) |
| Conditions (to word) | The works remain the artist's property. The provider holds them only to carry out the described job. **No other intervention, sale, loan or sub-contracting without written agreement.** Insured by the provider while in its custody (at the stated value). Condition report on departure and return. Returned in the state agreed at the end date. |

Points the lawyer should read before this paper exists:
- **Intervention on the work** (restoration, framing changes): it is covered by the artist's **moral right** (integrity of the work, CPI L121-1 [R]); the paper should state exactly what the provider may do.
- **A photographer's pictures are protected too**: the copyright in a photograph belongs to the photographer unless assigned; the paper should settle the **licence or assignment** for Pem's use of the images (site, press, catalogue) — a point for the photographer and printer cases.
- **Right of retention**: a craftsman who is owed money may **keep the work** until paid (Code civil art. 2286 [R]) — a Confié « always comes back » only if the job is paid as agreed. Say who pays and when.
- **Money out, not in**: what Pem pays the provider is an **expense** (Revenus & dépenses), not income; nothing on the Confié order should write to `payments`.
- **A lost or damaged work at the provider** closes through the existing destroyed / lost flow; the paper's value line is what the claim rests on.

### What it changes in R7 (so the build is sized)

SQL (own OK): the kind check and ref letter; the custody check; the destroyed / lost closing; a Vault folder key. Code: `WorkOrderKind` + `PaperKind` + steps + labels (FR + EN) + the new-order form (kind button, « job » line, no price fields) + the work card chip. R6 then uses it for editions. It is one more kind in a list that is already written for four.

---

## Summary table

| Question | Recommended | Needs |
|---|---|---|
| Gift price | **B** — keep `Prix`; a per-gift reference value on the order line, printed only if filled; gifts never income | Pem's GO; a form field (gift + loan lines); the accountant's view on the basis for her own works |
| Gift paper vs *don manuel* | ask the lawyer: handover-based gift / receipt | a lawyer's read before the first real gift |
| How papers are sent | **B** — share sheet / download, signed copy uploaded; e-signature only on demand | Pem's GO; a test of `navigator.share` with a file on her phone |
| « Confié » | **A** — fifth kind, work keeps its stage, « chez <artisan> » chip | Pem's GO; SQL (own OK) when R7 step 4 / R6 starts |

Not decided here and **not** in this file: Pem's VAT status and the invoice (wording review §6.1–6.2) — they come from the accountant.
