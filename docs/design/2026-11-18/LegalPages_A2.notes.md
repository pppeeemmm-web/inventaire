# Website legal pages — the A.2 batch, prepared (draft, 2026-11-18)

Pem: « prepare the legal pages for the website, the A.2 batch ». Source: [`WEBSITE_LEGAL_PAGES.md`](../../WEBSITE_LEGAL_PAGES.md) §A.2 (the 8 gaps), §B (the four texts), §C.1 (facts only Pem has), §C.2 (code changes). **Nothing built.** This note turns C.2 into a batch that can run on a GO, says what it is waiting on, and traces the data.

## Order

The batch splits in two. **Part 1 needs no legal facts** and closes the gaps that are true today whatever the texts say; it can run now. **Part 2 publishes the four pages**, and needs the C.1 facts (legal name, address, SIREN / SIRET, VAT mention, contact email, mediator) and ideally the lawyer's read.

### Part 1 — data and trackers (no facts needed)

| # | Gap (A.2) | Change | Files | Size |
|---|---|---|---|---|
| 3a | Visitor ID never expires | Store a creation date with `pem_public_vid`; a new ID after 13 months | `lib/public-visitor-id.ts` | S |
| 3b | `page_view` kept forever | Delete rows older than 25 months: one SQL function + the existing cron route pattern (`app/api/cron/*`, `CRON_SECRET`) | `supabase/sql/` (new), `app/api/cron/` (new route) | M — SQL, Pem's OK |
| 3c | Enquiries kept forever | Delete `inquiry` rows with no follow-up after 3 years, same job | same | M — SQL, Pem's OK; decide « follow-up » = a linked contact / order? |
| 4 | Two audience counters | Remove Vercel Analytics (the own counter keeps the data in the EU) | `app/layout.tsx` (`<Analytics />`), `package.json`, CSP `va.vercel-scripts.com` / `vitals.vercel-insights.com` | S |
| 5 | No opt-out | « Ne pas être compté·e » switch (on the cookie page; until it exists, a footer link): sets a flag, `lib/track.ts` skips | `lib/track.ts`, `lib/public-visitor-id.ts` | S |
| 6 | Google Fonts on portals and `/card` | Serve Sofia Sans + Instrument Serif from the site — the TTFs are already in the repo (`lib/aide/pdf/fonts/`, OFL) → `next/font/local`; replace `api.qrserver.com` on `/card` with the `qrcode` package (already a dependency); then drop those hosts from the CSP | `app/card/page.tsx`, `components/portals/PortalLayout.tsx`, `app/atelier/selection/actions.ts` (export HTML), `next.config.ts` | M |
| 8 | OpenAI receives card images | Not code: check whether an `OPENAI_API_KEY` is set on Vercel at all ([`AI_ENGINES.md`](../../AI_ENGINES.md)); if it is, the OpenAI account's DPA; name it in the privacy notice. If not set, the gap is moot | — | Pem |

**Flow trace, part 1.**
- Visitor ID: written by `lib/public-visitor-id.ts` (browser localStorage) → read by `lib/track.ts` → `page_view.visitor_id` → readers: Analytiques (`app/atelier/(portal)/analytics/actions.ts`, unique visitors), `lib/analytics-net.ts`. A new ID after 13 months counts one returning visitor as new, once a year — say so in the Analytiques footnote.
- `page_view` deletion: readers = Analytiques only (the 25-month window covers every chart range offered — check the longest range in the UI).
- `inquiry` deletion: readers = Triage (`app/atelier/triage/actions.ts`), field inbox (`app/atelier/field-inbox/data.ts`), share kits (`app/atelier/kits/actions.ts`, `private_link_token`), contact links. Keep any enquiry linked to a contact, an order or a live kit.
- Fonts / QR: readers = portal pages, `/card`, the selection export HTML. Visual check at 375 px and desktop.

### Part 2 — the four pages (needs the C.1 facts)

| # | Gap | Change |
|---|---|---|
| 1 | No legal pages, no footer links | `/mentions-legales`, `/confidentialite`, `/cookies`, `/cgv` (+ EN reading versions through `useI18n`), from §B; a footer line on the public site; SITE_MAP rows (`docs:routes:check`) |
| 2 | Enquiry form: no privacy line | One line under the button, linking `/confidentialite` (`components/public/EnquiryClient.tsx`) |
| 7 | Team page views tied to a member | One line in the team guide (Aide, `lib/aide/team.*.ts`) — not the archived guide |
| — | Sale paper (C.2 item 7) | « J'ai lu et j'accepte les CGV » + link, and the two-tier 14-day wording, on the order papers (`lib/orders/order-paper.ts`) — after the lawyer |

## What Pem decides

1. Part 1 now? (recommended: yes — it is true whatever the lawyer says).
2. Vercel Analytics: remove (recommended) or keep and assess.
3. What counts as « follow-up » for an enquiry to be kept past 3 years.
4. The C.1 facts for part 2, and whether the lawyer reads §B before it goes live.
