# Collector share kit — a private link for one collector (design draft, 2026-11-18)

Draft only. No code, no SQL. Pem 2026-11-18: « draft ». TODO 11b, F5 in [`archive/STATUS.md`](../../archive/STATUS.md) (« one-click `/c/<token>` + printable PDF + enquiry CTA »).
Mockup: [`Collector_ShareKit.mockup.html`](./Collector_ShareKit.mockup.html). Builds on [`R7_Orders.notes.md`](../2026-11-17/R7_Orders.notes.md) (orders), [`LEGAL_POLICY.md`](../../LEGAL_POLICY.md) §5 (keeping data).

## What is true today (read in code and live DB, 2026-11-18)

Half of it already exists, and nothing uses it.

- **The page exists.** [`app/c/[token]/page.tsx`](../../../app/c/[token]/page.tsx): service-role read of `private_link` by token, 404 when unknown or past `expires_at`, adds 1 to `view_count` and stamps `viewed_at`, lists the works of one working group (photo, title, year, size, « Prix sur demande »), FR / EN by `?lang=en`. `noindex`; `robots.txt` blocks `/c/`.
- **The table exists.** `private_link`: `token, group_id, recipient_name, recipient_email, expires_at, view_count, viewed_at, created_by, created_at`. RLS: team all (`is_team()`); anon has a SELECT grant but no policy, so reads nothing. **0 rows ever.**
- **Nothing makes a link.** `createPrivateLinkForGroup` (nanoid 12, [`app/atelier/curation/actions.ts`](../../../app/atelier/curation/actions.ts)) is only called by [`CurationPanel.tsx`](../../../components/atelier/CurationPanel.tsx), and **no screen mounts that panel**.
- Weak spots in the page: every load counts as a view, including the link preview WhatsApp / iMessage fetch when the link is pasted (so « opened » can be true before the collector looked); a page load writes to the DB; no revoke, only expiry; no PDF; no enquire; brand text and copy in the old dictionary.
- **PDF engine:** [`generatePortfolioPdf`](../../../app/atelier/(portal)/portfolio/pdf-action.ts) takes an explicit `workSequence` and has a `collectionneur` preset (cover, about, contact, 8 works; max 16). But it loads **public works only** (`is_public = true`), so a private work in the list is silently dropped, and it prints **no prices**.
- **Enquiries:** `inquiry` (`name, email, message, category, oeuvre_id, work_order_id, status`). The public form `/enquiry` inserts as anon (now with real categories `buy / commission / show / press`). Open enquiries show in the **Triage deck** (`/atelier/triage`) and the field inbox.

## In one line

A **kit** = a frozen list of works + one collector (a Contact) + a private link + a PDF made at the same moment. Made from a **selection**, sent by Pem through Pem's own channel (WhatsApp, mail), and every enquiry from it lands in Triage tagged with the collector's name.

## 1. Who makes the link, and from where

| Start from | Fits? |
|---|---|
| An R7 **order** | No. The order comes **after** the collector decides; the kit comes before. The link goes the other way: an enquiry from a kit can become an order (§5). |
| A **contact** | It answers « for whom ». Good second door: the contact card lists the kits sent to that person, with « + Nouveau kit ». |
| A **selection** | It answers « what ». **Main door.** Works already get gathered into working groups (Thèmes / Groupes, Inventory multi-select). |

**Flow (proposal):** on a working group (Thèmes / Groupes row, or Inventory selection) → **« Partager à un collectionneur… »** → one sheet:
1. Collector — pick a Contact (required; « + nouveau contact » inline).
2. Works — the group's works in order; untick or drag to reorder. The kit **freezes** this list: editing the group later does not change what the collector sees (what was offered, when, at what price stays true — it is provenance).
3. Prices — « Prix sur demande » by default; tick per work to show a price (snapshot at creation, TTC).
4. Language FR / EN, and an optional short message from Pem.
5. Valid until — 30 days by default.
6. **« Créer le lien »** → the PDF is made in the same step → the sheet shows the link with **Copier** and **Partager** (the phone's share sheet: WhatsApp, Mail, Messages).

The app sends nothing itself: emailing from the app is a deferred feature (CLAUDE.md). On the phone, the same sheet works from a group (one column, sticky « Créer le lien »).

## 2. What the collector sees on the phone

See the mockup, frames B1–B4. One calm page, no atelier chrome, no menu to the rest of the app:

- Top: « Sélection pour Marie » (the name Pem chose to show — see questions), Pem's message, « valable jusqu'au 18 déc. ».
- One work per screen: the photo full width (tap → zoom), title, year, technique, size, then either the price or « Prix sur demande », and availability (« Disponible » / « Réservée »).
- On each work: **« Cette œuvre m'intéresse »**. A sticky bar at the bottom: **« Écrire à l'atelier »** + **« PDF »** — both reachable with the thumb, safe-area padding.
- Footer: who keeps the data and why (one line), « lien personnel — merci de ne pas le transférer », link to the public site.
- FR / EN switch at the top; the default is the kit's language.

A sold work: shown greyed with « Vendue » rather than removed, so the collector is not puzzled by a missing work (question 7).

## 3. Expiry and revocation

- **Expiry is required.** Default 30 days; « Prolonger » in one tap keeps the same link with a new date.
- **Revoke** (« Retirer le lien ») stamps `revoked_at`. Revoked or expired → a neutral page: « Ce lien n'est plus actif — écrivez à l'atelier », with the public enquiry link. Not a bare 404, and it never shows the collector's name.
- The PDF is served **through the link** (`/c/<token>/pdf`), not as a public R2 address, so revoking also stops the PDF. A PDF already downloaded stays with the collector — say so plainly in the sheet.
- Photos stay on the public R2 addresses (keys carry a hash, not listed anywhere). Revoking does not un-show a photo already seen.
- Token: today 12 characters (about 71 bits). Proposal: 22 characters (about 128 bits), as the admin guide suggests.
- Pem's list of kits shows « expire dans 3 j » ahead of time.

## 4. What is tracked

Little, useful, and said on the page.

| Tracked | How |
|---|---|
| First opened, last opened, number of opens | counted on the server; known link-preview robots (WhatsApp, iMessage, Slack, Facebook, Twitter user-agents) and `HEAD` / prefetch requests are not counted; at most one count per 30 minutes |
| PDF downloaded | date + count |
| Enquiries sent | which works, when (they are `inquiry` rows) |

**Not tracked:** time per work, scrolling, IP address, place, device. **No cookie**, so no consent banner (see §7).

Shown on the kit row (contact card and the kit list): « Ouvert 3 fois · dernier 12 nov. · PDF téléchargé · 1 demande ».

## 5. How « enquire » lands in the Inquiries

- Tapping « Cette œuvre m'intéresse » or « Écrire à l'atelier » opens a sheet on the page: a message box prefilled « Je souhaite en savoir plus sur *Titre* (#1234) », the works ticked, and « Comment vous répondre ? » (optional email / phone — the collector's email is **never shown** on the page, since anyone holding the link would see it).
- It is saved by a server action that checks the token (service role) — not an anon insert like `/enquiry`. Row: `category = 'buy'`, `oeuvre_id` = the first work, the others listed in the message (or one row per work — question 6), name from the Contact, email from the Contact unless the collector typed one, a new column **`private_link_token`** pointing to the kit, `status = 'open'`.
- It then shows like any enquiry in the **Triage deck** and the field inbox, with a chip « Kit · Marie Dupont » that opens the kit.
- Limit: 10 enquiries per kit per day, to stop a forwarded link being abused.
- Next step (later, R7): from the enquiry, « Créer une commande » with the contact and the works filled in; the order keeps the kit token → kit → enquiry → order, one chain of provenance.

## 6. The PDF reuses the portfolio engine

- Call `generatePortfolioPdf` with preset `collectionneur` and `workSequence` = the kit's works in order (cap 16 = `MAX_WORKS`).
- **Two changes in the engine**, both small:
  1. A works source for an explicit list: load exactly those ids, private ones included, instead of `loadPublicWorks()` (team session only — the person making the kit is signed in).
  2. An optional price line per work (only the prices ticked in the kit, TTC), and a closing line « Préparé pour Marie Dupont · 18 nov. 2026 · valable jusqu'au 18 déc. 2026 ».
- **When:** made once when the kit is created (signed-in team session; well inside the 60 s Vercel limit for ≤ 16 works), stored in R2 under `kits/<token>/<hash8>.pdf`, served by a small route `app/c/[token]/pdf/route.ts` that checks the token, expiry and revoke, counts the download, and streams the file. **Reason for a new route** (CLAUDE.md asks for one): a binary download behind a token check cannot be a Server Action.
- « Refaire le PDF » on the kit if prices or works changed; the kit shows the PDF's date.

## Data sketch (no SQL yet)

`private_link` has 0 rows, so it can be reshaped freely; keep its name.
- `private_link` + `contact_id` (FK `Contact`), `lang`, `message`, `revoked_at`, `pdf_key`, `pdf_made_at`, `pdf_downloads`, `first_opened_at`, `last_opened_at` (replaces `viewed_at`), `view_count` kept; `group_id` kept as « made from ».
- New `private_link_work` (`token`, `oeuvre_id`, `position`, `price` snapshot or null, `show_price`).
- `inquiry` + `private_link_token` (FK, nullable).
- RLS: team all on both; anon nothing (the page and the PDF route use service role after the token check). New table: revoke the default TRUNCATE etc. from authenticated, then explicit GRANT.

## 7. Privacy and legal points for `LEGAL_POLICY.md`

To add as a short §, with `[R]` = to confirm with the lawyer.

1. **Personal data in a kit:** the collector's name (Contact link), opens, PDF downloads, enquiries. Lawful basis: steps taken at the person's request before a contract (GDPR art. 6(1)(b)) when they asked to see works; otherwise legitimate interest (6(1)(f)) for an existing contact [R].
2. **Information (art. 13):** one line on the page and the PDF: who keeps the data (the atelier), why (to follow up your interest in these works), how long, how to ask for deletion.
3. **Counting opens without a cookie:** nothing is stored on or read from the collector's device, so the ePrivacy consent rule (art. 5(3)) should not apply; say on the page that the atelier sees when the link is opened [R].
4. **Keeping:** opens and downloads deleted 12 months after the kit ends; the kit itself (what was offered, when, at what price) kept with the order when one follows (provenance, §5.2); otherwise follow the 3-year rule for people who signed nothing (§5.2).
5. **A price shown to one person may read as a firm offer.** Wording: « prix indicatif, sous réserve de disponibilité, valable jusqu'au … » [R]. To a consumer the price is shown TTC (Code de la consommation L112-1) [R].
6. **Copyright line** on page and PDF: « Reproduction interdite » (CPI L122-4).
7. **Distance sale:** if an enquiry from the kit becomes a sale without meeting, it is a distance sale — the pre-contract information (L221-5) and the 14-day withdrawal belong to the R7 order paper, not to the kit; the kit must not read as an order form [R].
8. **Forwarding:** the link is the key. The page says « lien personnel — ne pas transférer » and shows no one else's data.

## Not in this kit (deferred)

Email sent by the app · a collector account / login · paying or reserving online · watermarked photos · per-work « seen » tracking.

## Questions for Pem

1. Start a kit from a **group** of works (main door) and also from the **contact card** — right?
2. Who may make a kit: **any team member**, or **only you**?
3. Prices: **sur demande** by default, shown only where you tick — or never shown?
4. Name on the collector's page: **full name**, **first name**, or **nothing**?
5. Valid **30 days** by default?
6. An enquiry about three works: **one message**, or **one per work**?
7. A work sold while the link is open: shown **« Vendue »**, or **hidden**?
8. May a kit include **private works** (not on the public site)? That needs the PDF engine change in §6.

## Pem's answers (2026-11-18, form in the lead session)

1. Start a kit from a **group of works** and from a **contact card** — both.
2. **Any team member** may make a kit.
3. Prices **« sur demande »** by default, shown only where ticked.
4. The collector's page shows their **full name**.
5. Links valid **14 days** by default.
6. An enquiry about several works arrives as **one message**.
7. A work sold while the link is open shows **« Vendue »**.
8. **Public works only** — no change to the PDF engine.

Next: build on Pem's GO (TODO 11b).
