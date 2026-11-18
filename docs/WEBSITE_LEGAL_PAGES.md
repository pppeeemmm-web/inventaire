# Pages légales du site / Website legal pages — drafts

**Status: drafts, 2026-11-17. Documents only — no code, no SQL, nothing published.** Four texts the public site (www.thepemworkshop.com) needs, plus the facts they rest on and what the site must change to match them. Companion to [`LEGAL_POLICY.md`](LEGAL_POLICY.md) (same tags, same decisions).

> **Ce n'est pas un avis juridique. / This is not legal advice.** Drafts to brief a lawyer. The **French text is the one to publish** (the English is a reading version, also publishable with « the French text prevails »). Nothing goes online before the lawyer has read it and Pem has filled the `[[…]]` fields.

**Tags:** **[V]** read on 2026-11-17 · **[S]** seen today in an official page's search result, not read in full · **[R]** to confirm on the official text · `[[…]]` = a fact only Pem has (left blank on purpose — no personal details are copied into this file).

**The four pages**
1. **Mentions légales / Legal notice** — who runs the site and who hosts it. Required on every professional site [S: [service-public F37351](https://entreprendre.service-public.gouv.fr/vosdroits/F37351), verified 13 Oct 2026; LCEN loi n° 2004-575, art. 1-1 as amended by loi SREN 2024 / art. 6 — numbering to confirm].
2. **Confidentialité / Privacy notice** — what personal data the studio keeps, why, how long, with whom, and people's rights (GDPR art. 13–14 [R]).
3. **Cookies et mesure d'audience / Cookies and audience measurement** — what the site stores on a visitor's device (ePrivacy rule, loi Informatique et Libertés art. 82 [R]; CNIL guidelines).
4. **Conditions générales de vente / General terms of sale** — the studio's sale rules in one public text, referred to by every bon de commande (C. conso. L221-5, L111-1 for consumers [R]; LEGAL_POLICY §1–2.5).

Proposed place on the site: a small footer line on every public page — « Mentions légales · Confidentialité · Cookies · CGV » — and a privacy line under the enquiry form. **Building these pages is code: its own GO.**

---

## A. What the site actually does (verified in code, 2026-11-17)

The privacy and cookie pages must describe the real site. Read in the live code of the main checkout; nothing was clicked or changed.

### A.1 Data and where it goes

| Data | Collected by | Stored in | Run by (region) | Purpose | Kept today |
|---|---|---|---|---|---|
| **Enquiry**: name, email, message, reason; the work or order asked about, if any | `/enquiry` form (`components/public/EnquiryClient.tsx` → table `inquiry`) | Supabase database | Supabase, **eu-north-1 (Stockholm)** | answer the person; follow a sale | **3 years** unless followed up (email of a contact, an order, a kit sent to a contact or still live) once `retention_page_view_inquiry.sql` is applied |
| **Page views**: page, referrer, country (from the host's IP lookup), an **anonymous visitor ID**; for signed-in team members, a team flag and their contact | public pages (`lib/track.ts` → table `page_view`) | Supabase database | Supabase, Stockholm | count visits, exclude the team | **25 months** once `retention_page_view_inquiry.sql` is applied (monthly cron `/api/cron/retention`); « Ne pas être compté·e » stops it on that browser |
| The **visitor ID** itself | browser **localStorage**, key `pem_public_vid` (`lib/public-visitor-id.ts`), a random UUID | the visitor's device | — | tell repeat visits apart | **13 months**, then a new ID (`pem_public_vid_at`, since 2026-11-18) |
| ~~Vercel Analytics~~ | **removed 2026-11-18** (A.2 part 1) | — | — | — | — |
| Site hosting and server functions | every request (IP address in server logs) | Vercel | Vercel, functions in **arn1 (Stockholm)** (`vercel.json`); company in the USA | serve the site | Vercel's terms [R] |
| Images of works | public pages | Cloudflare R2, **EU endpoint** | Cloudflare | show the works | — (no personal data) |
| Google Fonts | the private portals (`/collection/…`, `/galerie/…`, the atelier) and `/card` load fonts **from Google's servers** (`components/portals/PortalLayout.tsx`, `app/card/page.tsx`) | — | Google (USA) | typography | **removed 2026-11-18**: the fonts come from the site itself (`next/font`, `public/fonts/`) |
| QR image on `/card` | `api.qrserver.com` | — | third party | QR code | **removed 2026-11-18**: drawn on the server (`qrcode`) |
| Sign-in (team, collectors' portals) | Supabase Auth cookies | browser + Supabase | Supabase, Stockholm | log in | session — strictly necessary |

**Behind the login (team only), for the record of processing:** contacts and collectors (CRM); **business-card reading and contact enrichment sent to OpenAI** (`lib/contact-card-vision.ts`, `lib/contact-url-enrich.ts` — USA); address lookup by OpenStreetMap Nominatim and `api-adresse.data.gouv.fr`; weather by Open-Meteo (a place, no person); calendar sync with Google / Microsoft; **voice notes use the browser's own speech recognition** (`lib/voice/web-speech.ts` — in Chrome the audio is processed by Google, in Safari by Apple [R]); order papers and signed copies in R2 (EU); daily database backup to R2 (EU, `docs/BACKUP_RECOVERY.md`). No email is sent by the app.

### A.2 Gaps to close before the pages can be true

| # | Gap | Why it matters | Fix (code — own GO) |
|---|---|---|---|
| 1 | No legal notice, privacy, cookie or terms page; no footer links (none found in the app's routes) | legal notice required for a professional site; information duty (GDPR art. 13) | four pages + footer line |
| 2 | Enquiry form has no privacy line | the person must be told at collection (GDPR art. 13 [R]) | one line under the button, linking the privacy page |
| 3 | `pem_public_vid` never expires; `page_view` and `inquiry` rows are never deleted | the CNIL exemption for audience measurement expects a tracker of **13 months max** and data kept **25 months max** [S: CNIL guidance via secondary sources]; enquiries must have a retention period | store a creation date with the ID and renew after 13 months; delete `page_view` rows > 25 months; delete enquiries with no follow-up after 3 years (§C.3) |
| 4 | Two audience tools (own counter + Vercel Analytics) | each must meet the exemption, or ask consent; two counters for one small site is redundant | keep the own counter (data stays in the EU) and **drop Vercel Analytics**, or check Vercel against the CNIL conditions [R] |
| 5 | No way to **opt out** of counting | an exempt measurement must let people object [R] | an « Ne pas être compté·e » switch on the cookie page (sets a flag, no ID) |
| 6 | Google Fonts loaded from Google on portals and `/card` | sends the visitor's IP to Google in the USA; a German court fined a site for it (LG München, 2022 [R]); safest is to self-host | serve the two fonts from the site (Next.js `next/font` does it) |
| 7 | Team page views linked to a named team member | fine internally, but say it in the team notice | one line in the in-app team guide (`lib/aide/team.*.ts`) |
| 8 | OpenAI receives business-card images and contact data | a transfer outside the EU to a processor: needs a contract (OpenAI's data processing terms) and a transfer basis (EU–US Data Privacy Framework or standard clauses) [R] | check the OpenAI account's DPA; name it in the record of processing |

Until gaps 3–5 are closed, the honest options are: **(a)** publish the cookie page saying what is stored and close the gaps quickly, or **(b)** add a consent banner. Proposal: (a), then (3)(4)(5) in one small batch — no banner on an artist's site.

---

## B. Les quatre textes / The four texts

### B.1 Mentions légales / Legal notice

**FR (à publier)**

> **Mentions légales**
>
> **Éditeur du site.** Le site www.thepemworkshop.com est édité par [[Prénom Nom]], entrepreneur individuel (EI), artiste-auteur, exerçant sous le nom « The Pem Workshop ».
> Adresse : [[adresse professionnelle]], Marseille, France.
> SIREN : [[SIREN]] · SIRET : [[SIRET]]. [[Si assujetti·e : N° de TVA intracommunautaire : FR…]] [[Sinon : rien ici ; la mention « TVA non applicable, art. 293 B du CGI » figure sur les factures.]]
> Contact : [[adresse e-mail]] · [[téléphone, facultatif]].
> **Directeur·rice de la publication :** [[Prénom Nom]].
>
> **Hébergement.** Vercel Inc., [[adresse postale de Vercel Inc. — à reprendre de vercel.com/legal]], États-Unis — site hébergé sur des serveurs situés dans l'Union européenne (Stockholm). Base de données : Supabase Inc. (serveurs à Stockholm). Images : Cloudflare, Inc. (stockage dans l'Union européenne).
>
> **Propriété intellectuelle.** Les œuvres, leurs reproductions, les textes et photographies de ce site sont protégés par le droit d'auteur. Toute reproduction, représentation ou adaptation, totale ou partielle, sans l'autorisation écrite de l'artiste est interdite (Code de la propriété intellectuelle, art. L122-4). [[Si membre de l'ADAGP : « Les droits de reproduction sont gérés par l'ADAGP. »]] Crédits photographiques : [[noms des photographes]].
>
> **Données personnelles et cookies :** voir la page Confidentialité et la page Cookies.

**EN (reading version)** — *Legal notice.* Publisher: [[First Last name]], sole trader (EI), artist-author, trading as « The Pem Workshop », [[address]], Marseille, France; SIREN / SIRET [[…]]; [[VAT number if registered]]; contact [[email]]. Publication director: [[name]]. Host: Vercel Inc., [[address]], USA, servers in the EU (Stockholm); database Supabase (Stockholm); images Cloudflare (EU storage). The works, reproductions, texts and photographs are protected by copyright; no reproduction without the artist's written permission (CPI L122-4). Photo credits: [[…]]. Personal data and cookies: see the Privacy and Cookies pages.

*Notes for the lawyer:* the exact list follows service-public F37351 [S] — name + « EI », address, SIREN, VAT number if any, contact, publication director, host's name, address and phone [R: the host's phone number is listed by some guides — to confirm]. The trade name alone is not enough. Pem's home address appears if it is the professional address — a domiciliation address avoids that (to consider).

### B.2 Confidentialité / Privacy notice

**FR (à publier)**

> **Politique de confidentialité**
>
> **Qui est responsable ?** [[Prénom Nom]], EI, « The Pem Workshop », [[adresse]], [[e-mail]] — ci-après « l'atelier ».
>
> **Quelles données, pourquoi, sur quelle base, combien de temps ?**
>
> | Vous… | Données | Pourquoi | Base légale (RGPD art. 6) | Durée |
> |---|---|---|---|---|
> | écrivez via le formulaire « Enquiry » | nom, e-mail, message, œuvre concernée | vous répondre, préparer une éventuelle vente | mesures précontractuelles à votre demande / intérêt légitime | **3 ans** après le dernier échange, sauf si une vente suit |
> | achetez, empruntez, recevez en don, déposez ou confiez une œuvre | nom, adresse, coordonnées, œuvres, paiements, papiers signés | exécuter le contrat ; tenir l'historique (provenance) de l'œuvre ; obligations comptables | contrat ; obligation légale ; intérêt légitime (provenance) | papiers et factures : **10 ans** ; historique de propriété de l'œuvre : **durée de vie de l'œuvre**, limité au nom et aux dates |
> | êtes en relation avec l'atelier (collectionneur·se, galerie, partenaire) | coordonnées, échanges, préférences | suivre la relation, vous inviter | intérêt légitime | **3 ans** après le dernier contact [R : recommandation CNIL pour les prospects] |
> | visitez le site | pages vues, page d'origine, pays, identifiant anonyme | mesure d'audience | voir la page Cookies | **25 mois** |
> | utilisez un espace privé (collection, galerie) | identifiant de connexion | vous connecter | contrat / nécessité | durée de votre accès |
>
> **Avec qui ?** Les données ne sont ni vendues ni louées. Elles sont confiées, pour le fonctionnement du site et de l'atelier, à des sous-traitants : Supabase (base de données, Stockholm), Vercel (hébergement, serveurs à Stockholm ; société américaine), Cloudflare (stockage, Union européenne), OpenAI (lecture de cartes de visite, États-Unis) [[, Google / Microsoft (agenda) — si concerné]]. Les transferts hors de l'Union européenne reposent sur [[le cadre de protection des données UE–États-Unis / les clauses contractuelles types — à vérifier par prestataire]]. Une galerie ou un transporteur reçoit ce qui est nécessaire à une vente, un dépôt ou un transport.
>
> **Vos droits.** Accès, rectification, effacement, limitation, opposition, portabilité (RGPD art. 15 à 21), et directives sur le sort de vos données après votre décès. Écrivez à [[e-mail]]. Réponse sous un mois. Vous pouvez aussi saisir la CNIL (www.cnil.fr).
>
> **Sécurité.** Accès réservé à l'atelier, connexions chiffrées, sauvegardes quotidiennes dans l'Union européenne.
>
> Mise à jour : [[date]].

**EN (reading version)** — *Privacy notice.* Controller: [[name]], EI, « The Pem Workshop », [[address, email]]. Enquiries (name, email, message, work): to answer you and prepare a possible sale; kept 3 years after the last exchange unless a sale follows. Buyers, borrowers, recipients, galleries, craftsmen: what the contract needs; papers and invoices 10 years; the ownership history of a work for the life of the work, limited to names and dates. Contacts and relationships: 3 years after the last contact. Site visits: see Cookies; 25 months. Private portals: login, for as long as access lasts. Data is never sold. Processors: Supabase (Stockholm), Vercel (servers in Stockholm, US company), Cloudflare (EU storage), OpenAI (business-card reading, USA) [[, Google / Microsoft calendar]]; transfers outside the EU under [[DPF / standard clauses]]. Rights under GDPR art. 15–21; write to [[email]]; answer within a month; complaint to the CNIL.

*Notes for the lawyer:*
- **Provenance « for the life of the work »** is the unusual point: justify it as a legitimate interest (title of the work, insurance, estate, resale right) with minimisation — keep the name and dates, drop the rest after 10 years. To confirm.
- **Team members** (staff, assistants, volunteers using the app) need their own short notice (journal, voice notes, page views linked to them, calendar). Proposal: a chapter in the in-app team guide (`lib/aide/team.*.ts`).
- **Record of processing** (GDPR art. 30): the table above, plus the team's data, is the record. The small-business exemption does not apply to regular processing [R].
- **Processors' contracts** (GDPR art. 28): Supabase, Vercel, Cloudflare and OpenAI publish data processing terms; check they are accepted on each account [R].
- **Voice notes** through the browser's speech service send audio to Google or Apple — say so to the team, or prefer an on-device mode where the browser offers one.

### B.3 Cookies et mesure d'audience / Cookies and audience measurement

**FR (à publier — une fois les écarts A.2 n° 3 à 5 corrigés)**

> **Cookies et mesure d'audience**
>
> Ce site n'utilise **ni publicité, ni réseaux sociaux intégrés, ni pistage d'un site à l'autre**.
>
> **Ce qui est déposé sur votre appareil**
> - **Mesure d'audience de l'atelier** : un identifiant aléatoire (« pem_public_vid ») enregistré dans votre navigateur, pour compter les visites sans savoir qui vous êtes. Il sert uniquement à l'atelier, n'est partagé avec personne, et expire au bout de **13 mois**. Les statistiques (page vue, page d'origine, pays) sont conservées **25 mois**. Ce traceur est dispensé de consentement au titre des lignes directrices de la CNIL sur la mesure d'audience ; vous pouvez néanmoins vous y opposer : [[bouton « Ne pas être compté·e »]].
> - **Connexion** (espaces privés et atelier uniquement) : cookies strictement nécessaires pour rester connecté·e ; aucun consentement requis.
>
> **Ce qui n'est pas déposé** : aucun cookie publicitaire, aucun bouton de réseau social qui vous suit.
>
> Questions : [[e-mail]].

**EN (reading version)** — *Cookies and audience measurement.* No advertising, no embedded social networks, no cross-site tracking. The studio's own visit counter stores a random ID (« pem_public_vid ») in your browser to count visits without knowing who you are; it is used only by the studio, shared with no one, expires after 13 months; statistics are kept 25 months. It is exempt from consent under the CNIL's audience-measurement guidelines; you can still object: [[« Don't count me » button]]. Signed-in areas use strictly necessary login cookies. Questions: [[email]].

*Notes:*
- **The CNIL exemption conditions** (as summarised by several sources [S]; read the CNIL guidelines « Cookies : solutions pour les outils de mesure d'audience » on cnil.fr before relying): purpose strictly limited to audience measurement **for the site's own publisher**; anonymous statistics only; **no cross-referencing** with other data and **no transfer to third parties**; no tracking across sites; **tracker lifetime ≤ 13 months**; **data kept ≤ 25 months**; IP truncated or not stored; people informed and able to object. A secondary source says the CNIL's public list of exempt tools ended on 1 January 2026 and each publisher must show compliance itself [S — to confirm on cnil.fr].
- **Today the site does not meet** the 13 / 25-month and objection conditions (A.2 n° 3, 5), and **Vercel Analytics** is a second tool to assess or drop (n° 4). The text above is true only after those fixes.
- localStorage counts as « reading or writing on the terminal » just like a cookie [R].
- The **country** comes from Vercel's IP lookup; the IP itself is not stored by the studio's counter (verified: `lib/track.ts` stores `x-vercel-ip-country`, not the IP).
- **Team sessions** linked to a team member are not public-visitor tracking; cover them in the team notice.

### B.4 Conditions générales de vente / General terms of sale

Built from the house rules in `LEGAL_POLICY.md` (decisions 5–7, §1–2.5). **Accountant first** for article 4 (VAT) and article 10 (invoice); **lawyer** for the whole. Commissioned works follow their own contract (LEGAL_POLICY §6, template 6).

**FR (à publier)**

> **Conditions générales de vente — The Pem Workshop**
>
> **1. Objet.** Les présentes conditions régissent la vente d'œuvres originales par [[Prénom Nom]], EI, artiste-auteur, « The Pem Workshop », [[adresse]], SIRET [[…]], [[e-mail]] (« l'artiste »), à tout acheteur, particulier ou professionnel. Elles complètent le bon de commande signé, qui prévaut en cas de différence. Les œuvres réalisées sur commande font l'objet d'un contrat distinct.
>
> **2. Les œuvres.** Chaque œuvre est une pièce originale de l'artiste, décrite sur le bon de commande (titre, année, technique, dimensions, [[tirage et numéro pour une estampe ou une photographie]]). Elle est livrée avec un certificat d'authenticité vérifiable en ligne. Les reproductions à l'écran peuvent différer de l'œuvre (couleurs, matière).
>
> **3. Commande.** La vente est conclue par la signature du bon de commande par les deux parties (signature manuscrite ou électronique, copie numérique acceptée). L'œuvre est alors réservée à l'acheteur.
>
> **4. Prix.** Les prix sont en euros. [[Mention TVA à fixer avec l'expert-comptable : « TVA non applicable, art. 293 B du CGI » ou « TVA 5,5 % incluse » ; HT / TTC.]] Les frais d'emballage, de transport, d'assurance du transport et, hors Union européenne, de douane et taxes d'importation sont indiqués sur le bon de commande et, sauf accord contraire, à la charge de l'acheteur.
>
> **5. Paiement.** Par virement bancaire [[ou autre moyen]]. Un acompte de [[30]] % peut être demandé à la signature ; le solde est dû avant la remise de l'œuvre, sauf accord écrit. Les paiements en espèces sont limités par la loi [R]. Pour un professionnel, tout retard entraîne des pénalités au taux de [[…]] et l'indemnité forfaitaire de 40 € pour frais de recouvrement (C. com. L441-10).
>
> **6. Propriété.** L'œuvre reste la propriété de l'artiste jusqu'au paiement complet du prix (réserve de propriété).
>
> **7. Remise et livraison.** L'œuvre est remise à l'atelier ou livrée à l'adresse convenue, à la date indiquée sur le bon de commande. Un état de l'œuvre est noté à la remise. Pour un acheteur consommateur, l'artiste supporte le risque de perte ou d'endommagement jusqu'à la prise de possession matérielle de l'œuvre (C. conso. L216-4).
>
> **8. Délai de retour de 14 jours.** L'acheteur dispose de **14 jours à compter de la remise de l'œuvre** (prise de possession par lui-même ou un tiers qu'il désigne, autre que le transporteur) pour la retourner, sans avoir à se justifier.
> – **Vente à distance ou hors établissement à un consommateur :** il s'agit du droit de rétractation légal (C. conso. L221-18 et suivants). L'acheteur informe l'artiste par une déclaration claire ou au moyen du formulaire ci-dessous. L'artiste rembourse toutes les sommes versées, y compris les frais de livraison initiaux au tarif standard, dans les 14 jours suivant la décision de l'acheteur, et peut différer le remboursement jusqu'à la récupération de l'œuvre ou la preuve de son expédition. [[Frais de retour : à la charge de l'acheteur / de l'artiste.]]
> – **Toute autre vente (à l'atelier, en salon, acheteur professionnel) :** la loi ne prévoit pas ce droit ; l'artiste l'accorde **par engagement contractuel**, aux mêmes conditions de délai, dans les conditions suivantes : œuvre rendue dans l'état de la remise, dans son emballage d'origine, [[frais de retour à la charge de …]] ; remboursement dans les 14 jours suivant le retour.
> – Les sommes reçues sont conservées par l'artiste sans être considérées comme définitives jusqu'à la fin du délai. Les œuvres réalisées sur commande ou personnalisées sont exclues (C. conso. L221-28 3°).
>
> **9. Garanties.** L'œuvre bénéficie de la garantie des vices cachés (Code civil art. 1641 et suivants) et, pour un acheteur consommateur, de la garantie légale de conformité (C. conso. L217-3 et suivants) [R : application à une œuvre d'art originale à confirmer]. Les marques du travail de l'artiste (matière, traces, variations) font partie de l'œuvre et ne sont pas des défauts.
>
> **10. Facture.** Une facture est établie [[au paiement complet / à la remise / à la fin du délai de 14 jours — à fixer avec l'expert-comptable]] et remise à tout acheteur professionnel, et à tout particulier qui la demande.
>
> **11. Droit d'auteur.** La vente de l'œuvre ne transfère aucun droit de reproduction ou de représentation (CPI L111-3) : toute reproduction exige l'accord écrit de l'artiste [[ou de l'ADAGP]]. Le droit moral de l'artiste (nom, intégrité de l'œuvre) est perpétuel et inaliénable. L'acheteur est informé que les reventes ultérieures faisant intervenir un professionnel du marché de l'art donnent lieu au droit de suite (CPI L122-8).
>
> **12. Données personnelles.** Voir la politique de confidentialité.
>
> **13. Médiation.** En cas de litige, l'acheteur consommateur peut recourir gratuitement au médiateur de la consommation : [[nom, site et adresse du médiateur auquel l'artiste adhère]] (C. conso. L612-1).
>
> **14. Droit applicable et litiges.** Les présentes conditions et les ventes qu'elles régissent sont soumises au droit français, à l'exclusion de la Convention de Vienne du 11 avril 1980 sur la vente internationale de marchandises. Tout différend relève des juridictions compétentes de Marseille, sous réserve des règles impératives protégeant le consommateur, notamment celles de son pays de résidence. La version française fait foi.
>
> Version du [[date]].
>
> ---
> **Formulaire de rétractation** *(à compléter et renvoyer uniquement si vous souhaitez vous rétracter d'une vente à distance ou hors établissement)*
> À l'attention de [[Prénom Nom]], The Pem Workshop, [[adresse]], [[e-mail]] :
> Je/nous (*) vous notifie/notifions (*) par la présente ma/notre (*) rétractation du contrat portant sur la vente de l'œuvre ci-dessous :
> Commandé le (*) / reçu le (*) :
> Nom du (des) consommateur(s) :
> Adresse du (des) consommateur(s) :
> Signature du (des) consommateur(s) (uniquement en cas de notification du présent formulaire sur papier) :
> Date :
> (*) Rayez la mention inutile.
> *(Modèle de l'annexe à l'article R221-1 du Code de la consommation [R — reprendre le texte exact de Légifrance].)*

**EN (reading version)** — *General terms of sale.* 1. Scope: sales of original works by [[name]], EI, artist-author, « The Pem Workshop », to any buyer; the signed purchase order prevails; commissions have their own contract. 2. Works: originals described on the purchase order, with a certificate of authenticity verifiable online. 3. Order: concluded when both sign the purchase order (handwritten or electronic signature, digital copy accepted); the work is then reserved. 4. Prices in euros [[VAT mention — accountant]]; packing, transport, transit insurance and import duties outside the EU at the buyer's cost unless agreed. 5. Payment by bank transfer; a [[30]] % deposit may be asked; balance before handover unless agreed in writing; cash limited by law; late-payment penalties and the €40 recovery fee for business buyers. 6. Title stays with the artist until full payment. 7. Handover at the studio or delivery to the agreed address; condition noted; for a consumer, risk passes on physical possession. 8. **14-day return from handover:** for distance / off-premises consumer sales this is the statutory withdrawal right (refund within 14 days, may wait for the work or proof of dispatch); for every other sale the artist grants it **as a contractual undertaking**, work returned as handed over, in its original packing, [[return costs]]; money held, not definitive, until the period ends; made-to-order works excluded. 9. Hidden-defect guarantee and, for consumers, legal conformity guarantee [R]; marks of the making are part of the work. 10. Invoice [[timing — accountant]], always for business buyers, on request for others. 11. No reproduction right passes with the work; moral right inalienable; later professional resales trigger the resale right. 12. Personal data: privacy page. 13. Consumer mediator: [[name]]. 14. French law, CISG excluded, Marseille courts, subject to consumers' mandatory protections; French text prevails. Model withdrawal form attached.

*Notes for the lawyer / accountant:*
- **Mediator (art. 13):** a professional selling to consumers must offer a consumer mediator and name it (C. conso. L612-1, L616-1 [R]); Pem has to **join one** (a paid membership) — only if Pem counts as a « professionnel » (LEGAL_POLICY §1.2; decision 5 says treat sales as professional by default).
- **Conformity guarantee for an original artwork** (art. 9): whether and how L217-3 s. applies to a unique work is a point to settle; the wording « marks of the making are not defects » needs the lawyer.
- **Cash** (art. 5): the French cap on cash paid to a professional (C. monét. fin. L112-6, D112-3 [R]) — confirm the amount and whether it reaches Pem.
- **Late-payment terms** (art. 5): mandatory between professionals (C. com. L441-10 [R]); rate to fix.
- **Distance-sale information** (C. conso. L221-5, L111-1 [R]): these terms plus the purchase order should carry it all; check the list.
- **The house rule's two-tier wording** (art. 8) is new: the lawyer must make sure the contractual return right is not read as the statutory one (no 12-month extension, no forced refund of return costs unless chosen).
- **Online acceptance:** the site sells by enquiry, not by checkout. The terms are accepted by signing the purchase order, which must say « J'ai lu et j'accepte les conditions générales de vente » and attach or link them — a change to the sale paper (R7, own GO).

---

## C. Ce que Pem doit faire / What Pem has to do

### C.1 Facts to fill in (only Pem has them)

| Field | Where | Note |
|---|---|---|
| Legal name + « EI » | B.1, B.2, B.4 | as registered |
| Professional address | B.1, B.2, B.4 | consider a domiciliation address if it is home |
| SIREN / SIRET | B.1, B.4 | from the INSEE / guichet unique registration |
| VAT status and mention | B.1, B.4 art. 4 | accountant |
| Contact email (+ phone, optional) | all | one address for privacy requests too |
| Publication director | B.1 | normally Pem |
| Photo credits | B.1 | photographers of the works |
| ADAGP member? | B.1, B.4 art. 11 | changes who licenses reproductions |
| Consumer mediator | B.4 art. 13 | to join |
| Deposit %, payment means, late-payment rate, return costs, invoice timing | B.4 | Pem + accountant |
| Vercel's postal address | B.1 | from vercel.com/legal |
| Transfer basis per processor | B.2 | check each account's data processing terms |

### C.2 Changes to the site (code — each with its own GO)

1. Four pages + a footer line « Mentions légales · Confidentialité · Cookies · CGV » (FR / EN through `useI18n`, new messages module).
2. A privacy line under the enquiry form.
3. Visitor ID: expiry after 13 months; « Don't count me » switch.
4. Retention: delete `page_view` rows older than 25 months; enquiries with no follow-up after 3 years (a scheduled job or an admin button — the app already has a cron route pattern).
5. Drop Vercel Analytics, or assess it against the CNIL conditions.
6. Self-host the two Google fonts on the portals and `/card`; replace the external QR service on `/card` with the `qrcode` package already in the dependencies.
7. Sale paper (R7): « J'ai lu et j'accepte les CGV » + link, and the two-tier 14-day wording.

### C.3 Retention periods proposed (to confirm)

Enquiries and contacts without a sale: **3 years** after the last exchange (CNIL's usual period for prospects [R]). Page views: **25 months**. Visitor ID: **13 months**. Contracts and invoices: **10 years**. Ownership history of a work: **life of the work**, names and dates only (LEGAL_POLICY §5.2).

---

## D. Sources

- **[S]** service-public, *Mentions obligatoires sur le site internet d'une entreprise*, [F37351](https://entreprendre.service-public.gouv.fr/vosdroits/F37351) (verified 13 Oct 2026, seen in search).
- **[S]** CNIL, cookies FAQ and audience-measurement guidance: [cnil.fr — FAQ cookies](https://cnil.fr/fr/cookies-et-autres-traceurs/regles/cookies/FAQ); conditions (13 / 25 months, own-use, anonymous, no transfer, objection) as summarised by [donneespersonnelles.fr](https://donneespersonnelles.fr/matomo-rgpd) and CNIL configuration guides (e.g. [Eulerian guide, cnil.fr](https://www.cnil.fr/sites/cnil/files/atoms/files/eulerian_-_guide_de_parametrage.pdf)); end of the public list of exempt tools on 1 Jan 2026 — one secondary source, **to confirm**.
- **[V]** via LEGAL_POLICY: service-public F10485 (withdrawal), F31808 (invoice mentions), F32113 (artist-author VAT).
- **[R]** to confirm on Légifrance / EUR-Lex: loi n° 2004-575 (LCEN) art. 1-1 / 6 as amended by loi n° 2024-449 (SREN); loi n° 78-17 art. 82; GDPR (Reg. (EU) 2016/679) art. 6, 13, 15–21, 28, 30, 44–46, 77; Code de la consommation L111-1, L216-4, L217-3 s., L221-5, L221-18 s., L221-28, L612-1, L616-1, R221-1 and annex (model withdrawal form); Code civil 1641 s.; Code de commerce L441-10; Code monétaire et financier L112-6, D112-3; CPI L111-3, L121-1, L122-4, L122-8.

*Rien de ce qui précède ne remplace un·e avocat·e. / None of this replaces a lawyer.*
