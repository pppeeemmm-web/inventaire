# R8 — public site vs the Atelier « Site » module

Verified against live code 2026-11-17 (worktree at `4db1bb8` = production `X-Build-Sha`). Assessment only: no code, SQL or content changed.

Sources: [`SITE_REVIEW_2026-11-16.md`](../../SITE_REVIEW_2026-11-16.md) (the 10 items + feed), live site read-only (`curl` headers / HTML, built-in browser at 1440 px and 375 px), and the code below. Admin screens read from code, not signed in.

## What the module is

Atelier sidebar → **Public** group: `site` (« Site web »), `portfolio` (PDF), `analytics`, `broadcast` (admin) — `components/atelier/TeamPortalClient.tsx:1101`. The `site` tab renders `PortfolioConfigShell` → [`SiteEditorPanel`](../../../components/atelier/site/SiteEditorPanel.tsx) (1,014 lines) + `PagesEditor` (block composition) + `KnobsPanel` (light / shadow / frame / bg / mat / type / atm / motion / circadian / a11y).

Everything it edits is **one JSON file in R2** (`vault/portfolio_sections.json`, `lib/portfolio-sections-from-r2.ts`), saved by `savePortfolioConfig` → `revalidateTag('portfolio')` + `revalidatePath('/', '/works', '/about', '/practice', '/enquiry')`. No database table.

What the JSON holds: `general` (artist name, public email, Instagram, phone, medium tagline FR/EN) · `landing` (hero work + caption FR/EN, sky gradient, gloss, bevel) · `about.intro` FR/EN · `practice` (statement, themes, materials) · `works_modes[]` (sequences: label, layout among 11, collections = theme + intro/description FR/EN + manual order, outro, light, shadow, mobile fallback, map panorama) · `site_blocks` (5 legacy blocks: visible / order → nav, page background) · `pages` (block lists for landing / works / about: biographie, expositions, presse, contact, cv, text, image, quote, gallery strip…) · `knobs` (site → page cascade).

Which public page reads it, and how:

| Page | Reads the JSON | Render | Live headers 2026-11-17 |
|---|---|---|---|
| `/` | server, cached (`loadPortfolioSectionsCached`) | static, revalidated on save | `HIT`, TTFB 0.10 s, 32 KB |
| `/works` | server, **fresh R2 read every request** + `createClient()` (cookies) | dynamic | `private, no-store`, `MISS`, **TTFB 2.0 s, 246 KB** |
| `/about`, `/practice` | **client only** (`loadPortfolioConfig()` server action in `useEffect`) | prerender of the fallback | `PRERENDER`, 0.34 s, but the HTML holds the hard-coded fallback bio, not the saved one |
| `/enquiry` | server (landing shadows) + client (email, phone) | prerender | `PRERENDER` |
| `/works/[id]`, `/journal` | — | do not exist | 404 |

## Item by item

Effort: S ≤ half a day · M 1–2 days · L more.

| # | Item | What the module controls today | State | Waits on a look decision | Effort |
|---|---|---|---|---|---|
| 1 | Paintings big | Layout per sequence (carousel, grid, procession, salon, vitrine, timeline, letter, map, motion interior; constellation + diptych are « coming soon » placeholders), mobile fallback, light / shadow / bevel / voile / grain / vignette / glow knobs. **No size control**: the work box is a code constant (`worksCardViewport`: 25 % of width, 42 % of height on desktop; true-scale ref 70 cm, `lib/physical-art-display-size.ts`). | **Missing.** Measured live: 119 px wide at 1440 px, 108 px at 375 px. The haze / shadow can already be turned down from the knobs (voile, shadow opacity) — that part works. | **A. Big vs true scale** (see below) | M (a « Grand » view as default, true scale kept as « Accrochage ») |
| 2 | One page per work | Nothing. The Enquiry form already reads `?oeuvre_id=` and stores it on `inquiry` — that end works. | **Missing** (`/works/1` → 404; zoom keeps `/works`). | **B. Work page layout** (image size, what sits beside it) — follows A | M (route + metadata + sitemap entries + « Enquire » button) |
| 3 | Landing in 3 s | Hero work picker, caption FR/EN, sky gradient, gloss, bevel, nav order + hide via blocks, landing blocks (hero, identity, text, statement…), artist name. | **Partly works.** Content is editable and reaches `/`. Missing / broken in code: the hero is always a circle (`WavingCircle`), clock + « Hz » counter not switchable, empty-text `/hub` link, inline `<style>` inside the `/works` link. In the pane at 1440 px the hero had not painted after 4 s (may be the pane's known no-rAF quirk — not proven on a real browser). | **C. Landing layout**: circle disc vs full uncropped work; keep the clock or not | S once C is decided |
| 4 | Social previews | Indirect: `og:image` = the landing hero picked in the module. | **Broken for sharing**: `og:image` is a 400×400 AVIF on `r2.dev`; `/works`, `/about`, `/practice` have none. | No (a 1200×630 JPEG crop rule only, follows A/C lightly) | S (OG image route per page; per-work once #2 exists) |
| 5 | Speed + images off `r2.dev` | Nothing (hosting is env + code). | **Broken**: `/works` 2.0 s TTFB, no cache, 246 KB HTML; images from `pub-…r2.dev` with **no `Cache-Control`** (checked: 249 KB AVIF, no header). Image URLs all go through `imageUrl()` (`NEXT_PUBLIC_R2_PUBLIC_URL`), so a custom domain is an env change + `next.config.ts` `remotePatterns` + Cloudflare setup. | No | M (`/works` → cached read + `revalidateTag` already fired on save; custom image domain is owner setup in Cloudflare) |
| 6 | One name | `general.artist_name` (live: « pierre emmanuel moulin », feeds `og:site_name`, the landing ring, the About `<h1>`) + an identity block that can override it. | **Partly.** `<title>` / descriptions come from fixed i18n keys (« the pem workshop — painter »), About footer is hard-coded « the pem workshop ». No JSON-LD `Person`. So the module name and the page titles disagree. | **D. The name** (Pem picks the one form) | S |
| 7 | FR / EN done properly | Every text field is FR + EN side by side (`DualField`) — the content side exists. | **Broken for search**: `<html lang="en">`, `og:locale=en_GB` on French pages, `?lang=en` alternates serve the same HTML; language is a client toggle. EN bio text quality + facts differ = content, Pem's. | No (D helps) | M (server-rendered language, e.g. `/en/…` or `?lang` read on the server) |
| 8 | About / Practice content | About intro FR/EN, Practice statement / themes / materials, About blocks (biographie, expositions, presse, cv, contact, image…). | **Wired but only after hydration**: `/about` and `/practice` fetch the JSON in the browser, so Google reads the hard-coded fallback bio. Practice content is thin (heading only, per review). Nav: the module can show / hide / order About and Practice (`site_blocks` → `hiddenNavRoutes` / `orderedNavRoutes`); on the landing, About / Practice are drawn as « satellite » orbs around the hero rather than inline links (`lib/site-block-visibility.ts`) — so their weak presence is partly the landing design (C), not only a module setting. | **E. Merge Practice into About?** (the type comment already says « /practice is folded into /about ») | S (server-render both) + Pem's text / photo |
| 9 | Calls to action | `general.contact_email`, `general.phone`, `general.instagram`; a `contact` block on About. | **Partly / control nothing reads**: email + phone show on `/enquiry`; **`general.instagram` is read by no public page**; enquiry reasons are hard-coded in `EnquiryClient` (general / question / complaint / shipping / other) — no buy / commission / show / press. No newsletter. | Minor (where the footer sits — part of C) | S (reasons, Instagram link, footer); newsletter = external tool, needs GO (no transactional email) |
| 10 | Captions + small copy | Collection heading / intro / show-text per collection; « Accroche médiums » tagline (not shown on `/works` captions). | **Missing**: captions show title, year, size only — `/works` selects `Support` but only uses it for « round »; no medium, series, availability. Touch wording « Pincer ou toucher » on desktop (key `pub_works_zoom_hint_enter_mobile`). | No | S |
| F | Public journal feed | Nothing. | **Missing**: `journal_entry.visibility` allows `team` / `private` only (per review; not re-queried — no SQL in this pass). | **F. Carnet page design** | M + SQL GO |

### Also found (not in the 10)

- **Live bug on `/works`** (seen at 375 px, also present at 1440 px): the collapsed sequence text shows `Fire &amp; Brilliance, Chaos &amp; Order` — HTML entities not decoded in the teaser (`richTextToPlain` in [`WorksSectionTextCard.tsx`](../../../components/public/WorksSectionTextCard.tsx)). And the visitor sees the label « CLOSING TEXT — PREVIEW » / « Texte de clôture — aperçu » (`pub_works_text_preview_hint`) — reads like an editor note. S, no look decision.
- **Controls nothing reads** in `KnobsPanel`: `type.scale_pct` (« taille du texte ») and `motion.parallax_mult` are read by no public file (grep of `components`, `lib`, `app`). Several `light` / `mat` fields are labelled « future » in `lib/site-blocks/knob-types.ts`. Either wire or hide — S.
- The module is large (11 layouts, ~40 knobs, 3 block systems: `site_blocks`, `pages`, legacy fields). Most of R8 is not « add a control » — it is choosing a default look and removing choices that don't serve it.

## The presentation knobs (Pem 2026-11-17: « crazy… looks like the 70s »)

Count, from code: `KnobsPanel` has **28 controls** (light kelvin / direction / intensity, shadow on / distance / blur / opacity, bevel px / profile, grain, voile, vignette, sky tint top / bottom / opacity, work glow, sway, parallax, text size / weight, circadian auto + minute + 4 « drives », a11y size / contrast…), each settable site-wide and again per page (landing / works / about). On top: the landing gradient (2–6 stops, blend position, hardness), hero gloss (blend, strength, position, falloff), hero bevel, a background editor per page (About, Practice, Works), 11 `/works` layouts and a map pin editor. Roughly **45 dials, times 3 pages**.

What actually reaches the site (grep of `components/public`, `app/page.tsx`, `app/works`, `lib/public-site-theme*`):

| Group | Read by the public site? |
|---|---|
| light, shadow, frame (bevel), mat (grain / voile / vignette), atm (sky tint, glow), sway, circadian | Yes — `WorksModeGallery` (carousel / grid) only |
| `bg` family in the knobs (stops, blend, angle, opacity) | **No** — page backgrounds come from the separate landing gradient + per-page background editors |
| `type.scale_pct`, `type.weight`, `motion.parallax_mult` | **No** |
| Per-sequence light / shadow (`works_modes[].light_*`, `cast_shadow_*`) | **Still read** by the salon / procession / timeline / letter layouts, but **no longer editable** in the module — they keep whatever was saved before the knob panel replaced them |

So: two sets of light controls for the same thing, some dials wired to nothing, and the look they produce — grey voile, heavy cast shadow, gloss on a disc, coloured sky tint — is exactly what the review says dulls the paintings (item 1).

**Pem 2026-11-17:** no decision yet — the final look is open. The site can be a creative work in itself (light, motion, atmosphere), not only a neutral catalogue. Direction he is weighing: big images of **details**, moving images, very simple, minimal writing. He doesn't want to throw away what the knobs can do.

**Way to keep both (proposal, decision G, ties to A):** split the two jobs instead of choosing one.
- **Reference view** (one page per work, captions, previews, search): the painting as it is — no tint, voile, glow or gloss. This is what a buyer, a curator or Google needs.
- **The stage** (landing, sequences on `/works`): Pem's creative layer — light, sky, motion, details. Keeps the knobs, but cleaned: remove the ones wired to nothing, merge the two light systems, so every dial left does something visible.
Nothing is deleted either way. Effort: S to drop the dead dials, M to merge the duplicate light values. Neither needs A to be decided first.

**Looks drawn 2026-11-17** → [`R8_SiteLooks.html`](./R8_SiteLooks.html) (images load from the live `r2.dev` URLs; private viewing copy with embedded images: https://claude.ai/artifact/2m1S6PNfBmscCCYJD4wgBR). Three stages with real works at 1440 px and 375 px, plus the shared work page: **1 Détail** (big details of the paint, slow motion, almost no words — Pem's idea; needs a detail picker on the work card, M–L) · **2 Plein cadre** (whole work big on a plain wall, review's proposal, M) · **3 Scène** (today's lit wall and sky, works ~3× bigger, dials cut from ~45 to ~10, S–M) · **work page** (same for all, M — can be built first). Mixing is allowed (e.g. Détail on the landing, Plein cadre for browsing, Scène as « Accrochage »). Only the landing and the default works view need choosing first.

## Look decisions Pem takes first, in order

1. **A. Big painting vs true-scale wall** — what a visitor sees first on `/works`: the work filling ~75 % of the screen height on a plain ground (review), or today's lit wall at true relative scale. Proposal from the review: big by default, the wall kept as an « Accrochage » view. This sets #1 and the frame for #2 and #4.
2. **B. One work's page** — image size and what sits with it (caption lines, detail shots, « Enquire », next / previous). Follows A.
3. **C. Landing** — keep the circle disc or show a full uncropped work; keep the clock / Hz counter or drop it; which nav items show (Works · Journal · About · Contact). The circadian sky can stay either way.
4. **D. One name** — « Pierre Emmanuel Moulin (Pem) », « Pem », or « the pem workshop » as the main form.
5. **E. Practice** — fold into About or keep its own page.
6. **G. How much look-tweaking stays** — with A: which few dials survive (see « The presentation knobs »); the rest leave the panel.
7. **F. Carnet (journal) page** — later, after A–C; needs its own screen design + SQL GO.

Items 5, 7, 10 and the bugs above need no look decision.

## Recommended first batch (no look decision needed)

1. `/works` text card: decode entities + replace the « preview » label (S). Bug, visible today.
2. Speed: `/works` reads the cached JSON (save already revalidates) and stops depending on cookies → static + revalidated (M). Custom image domain with long cache: Pem / owner sets it up in Cloudflare, then one env change.
3. Server-render `/about` and `/practice` from the JSON so search sees the real bio (S).
4. Social previews: 1200×630 JPEG `og:image` for `/`, `/works`, `/about` (S).
5. Captions: medium (from `Support`) + desktop zoom wording (S); enquiry reasons buy / commission / show / press + the Instagram link the module already stores (S).
6. Hide or wire the two dead knobs (S).

Then, after Pem's A–C: big view (#1), one page per work (#2) with per-work OG + sitemap, the landing (#3), FR / EN on the server (#7). Then the Carnet (F).

Not checked: Lighthouse / real-phone timings, the module's own screens rendered (read from code only), the live `portfolio_sections.json` contents beyond what the public HTML shows.

## First batch — built

Side session, worktree `epic-hellman-22e516`, 2026-11-17. Uncommitted, for the lead to land. Verified against live code 2026-11-17.

What changed:

1. **`/works` text card** — `richTextToPlain` (`components/public/works-utils.ts`) now decodes HTML entities (`&amp;`, `&nbsp;`, `&rsquo;`, numeric…), so « Fire & Brilliance » reads right in teasers and collection labels. The « Texte de clôture — aperçu » / « Déclaration — aperçu » line is gone (it read like an editor note); the teaser + « Lire le texte » stay. Keys `pub_works_text_preview_hint`, `pub_practice_text_preview_hint` removed.
2. **`/works` speed** — reads the cached JSON (`loadPortfolioSectionsCached`, tag `portfolio`) and a cookie-free anon client (`createPublicAnonClient` in `lib/supabase/server.ts`, same rows a logged-out visitor sees), plus `export const revalidate = 900` as a safety net. Saving the Site module and work edits already call `revalidatePath('/works')`. Image domain untouched.
3. **`/about`, `/practice` server-rendered** — the page loads the cached JSON and passes a slice (`PublicAboutConfig`, `PublicPracticeConfig`) to the client; no more `loadPortfolioConfig()` server action in `useEffect`. The saved CV / bio is now in the HTML (checked: « CURRICULUM VITAE » in the `/about` response). `/practice`'s statement is in the HTML as the collapsed teaser + RSC payload (the card collapses long text — full text visible after « Lire le texte »).
4. **Social previews** — `app/opengraph-image.ts`, `app/works/opengraph-image.ts`, `app/about/opengraph-image.ts` → `lib/seo/og-image.ts`: 1200×630 JPEG (sharp), the landing hero work whole on the page's own sky gradient, no text, `revalidate = 3600`. The old 400×400 AVIF `og:image` on `/` is removed. `/practice` and `/enquiry` have none (not in scope).
5. **Captions + enquiry** — medium from `Oeuvres.Support` on the carousel cartel, grid lightbox and letter layout (`lib/public-work-medium.ts`: FR/EN label per Support id, unknown ids show the Atelier label). Zoom hint now follows the input (mouse → « Cliquer pour zoomer », touch → « Pincer ou toucher ») instead of window width. Enquiry reasons: Acquérir une œuvre / Commande / Exposition / Presse / Question / Autre (+ Livraison / Réclamation only with an order ref); « Acquérir » preselected when `?oeuvre_id=` is set. Email, phone and the new Instagram link (`general.instagram`, handle or URL → `lib/public-instagram.ts`) come from the server page, no client action.
6. **Dead knobs hidden** — `type.scale_pct` and `motion.parallax_mult` rows removed from `KnobsPanel`; values stay in the JSON.

New copy: `lib/i18n/messages/public-site.messages.ts` (FR + EN).

Checks: `npm run typecheck`, `npm run lint` (0 errors; new `no-silent-catch` warnings on the about / practice page catches, same pattern as the existing enquiry / home pages), `npm run i18n:check` (0 hotspots), `npm run atelier:chrome:check` pass. Dev server (port 3001) in the built-in browser: `/works` desktop + 375 px (medium « Papier huile » shown, right zoom wording, no « aperçu », no horizontal scroll), `/enquiry?oeuvre_id=…` 375 px (reasons, preselect), `/about` 375 px, `/practice` desktop; the three `opengraph-image` URLs return `image/jpeg` 1200×630.

Not checked / open:

- **`/works` static**: local `next build` lists `○ /works` (Static, revalidate 15 m) — was dynamic. Real TTFB / cache headers only provable after deploy.
- **Instagram, email, phone are empty in the saved JSON** (`general.contact_email`, `phone`, `instagram` all ""), so `/enquiry` shows no contact block today — Pem fills them in Site → Général. The Instagram link was not seen rendered (no test row written; prod DB / R2).
- **New reasons are stored as `category = 'general'`** with « Motif : … » as the message's first line: `inquiry_category_check` only allows general / question / complaint / shipping / other. Adding buy / commission / show / press to the check = SQL, needs Pem's OK.
- Medium labels for « P. huile » (→ Papier huile / Oil paper) and « Yupo/Legion » (→ Papier Yupo) are my reading — Pem to confirm. Map / motion / procession / timeline layouts still show year only.
- No real enquiry submitted (would write a production row).
- `KnobsPanel` not seen rendered (Atelier needs sign-in); typecheck only.
- **Bigger finding, not fixed:** `loadPortfolioSectionsFromR2` rebuilds `config` from a fixed key list that drops `pages` and `knobs`. So the editor and every public page always get `migrate()` defaults: knob changes are lost on reload and never reach the site, and the next save writes the defaults back (live JSON's `knobs.site` = defaults, `pages` = derived defaults). Passing the two keys through is two lines, but it changes what the PagesEditor's « auto_ » blocks mean (they carry copies of the bio / statement that would then go stale against `about.intro_*`) — a decision for Pem / the lead before wiring. Until then every knob in the panel is effectively dead, not only the two hidden here.
