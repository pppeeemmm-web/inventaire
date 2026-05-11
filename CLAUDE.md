# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

🦖 CAVE-CLAUDE: STRICT RULES
CAUTION > SPEED.
THINK FIRST: <thinking> block mandatory. Plan steps. Surgical edits only.
NO AUTONOMY: No "GO" = No file edit.
KISS: Minimal code. 50 lines > 200 lines. No bloat.
CONFIRM DELETE: Always ask.
COMMIT COMPLETE: Before every commit, run git diff --stat. Stage ALL modified source files. Never partial-commit. Exclude only build artifacts (tsconfig.tsbuildinfo, .next/).
WORKTREE CLEANUP: At session end, remove all claude/* worktrees and branches except the active one. git worktree remove --force + git branch -D + git worktree prune.
CAVEMAN CHAT: Stop verbosity. No "I've updated..." or "Here is...". Code only. 1-3 word status max.
UI: bilingual only — obey 🌐 UI COPY when touching user-facing text.
RESPONSIVE: any UI change must work on small-screen phones (≈360px width). No horizontal scroll, no clipped controls, preserve core actions in compact layouts.

🛠️ CMDS
Next.js 15 (port 3000). npm dev | build | lint. No tests.
Real app path: C:\Users\pppee\Documents\Claude\Projects\Art db\app
Worktree edits → copy to real app (dev server runs from real app).

🏗️ ARCHITECTURE
- Next.js 15 App Router + Supabase + Cloudflare R2 (images)
- Server Components fetch data, pass to Client Components
- Mutations: Server Actions ('use server') in app/**/actions.ts only. No API routes.
- Auth: Supabase SSR middleware enforces auth on all /atelier /hub /galerie routes
- i18n: see **🌐 UI COPY** below (non-negotiable for anything user-facing)
- Image upload: Sharp → 400px AVIF thumb → R2 via AWS S3 SDK
- Supabase clients: createClient() (anon, RLS enforced) · createServiceClient() (service_role, admin bypass)

🌐 UI COPY (bilingual — non-negotiable)
All user-visible copy → `useI18n().t(key)` + `lib/i18n/dictionary.ts` (**DictKey** + **`dict.fr` + `dict.en`** each time). Exceptions: DB text, proper nouns, immutable data. **Scrutiny:** before finish, sweep the diff for JSX string literals & `alert`/`confirm`/titles/placeholders — hardcoded FR/EN = fix.
**Locale:** `toLocale*` / Intl → drive from **`lang`** (`fr-FR` vs `en-GB`), not a hardcoded locale.
**Label maps:** if UI showed one static language map → wrong; use **`lang`** branch or paired dict keys (see `pipelineTypeLabel`).
**Server Components:** no `useI18n` → pass translated strings down, client leaf, or `dict[lang][key]` at read time. **Speed:** add all keys for the feature in one edit; copy patterns from `TeamPortalClient` · `PipelineTab`.

📱 MOBILE FIELD-TOOL CONTRACT (iPhone SE / small viewport)
Phone is an **atelier tool**: capture + update in the field. PR/public relations stays desktop/web.
- **Breakpoints**: treat `<= 767px` as mobile; iPhone SE baseline `<= 375px`.
- **No desktop-only fixed layout**: any `width: 460`, `padding: 60px`, multi-column grids, or side-rails must have a narrow branch (use `useMediaQuery('(max-width: 767px)')`).
- **Tap targets**: minimum 44px hit area for primary actions (buttons, toggles, image-add).
- **Sticky primary action on forms**: Save must be reachable without scrolling; respect `env(safe-area-inset-bottom)`.
- **Safe-area always**: top/bottom bars must pad for `env(safe-area-inset-*)`.
- **Capture-first uploads**: on mobile image inputs may use `capture="environment"` when appropriate.
- **Downstream check**: if `/hub` adds/changes a mobile entrypoint, verify downstream screens remain usable on small viewport (`WorkForm`, `WorkDrawer`, and at least open Inventory).

📁 KEY FILES
- lib/i18n/dictionary.ts · context.tsx — all UI strings (fr/en)
- lib/data.ts — imageUrl(), thumbUrl(), yearOf(), statusOf(), makeFilename()
- lib/supabase/client.ts — browser client
- lib/supabase/server.ts — server + service client
- app/atelier/page.tsx — loads all reference data in parallel (up to 5000 rows), builds lookup maps
- components/atelier/TeamPortalClient.tsx — main orchestrator (tabs, selection, drawer)
- components/atelier/InventoryTab.tsx — inventory list + panel
- components/atelier/WorkDrawer.tsx — detail/edit panel with pipeline bar, anonymity gate, zoom (hub overlay + inventory panel; same `saveWork`; re-sends current Catalogué/NeedsPhotograph so pipeline flags are not wiped)
- components/atelier/WorkForm.tsx — full-page create/edit (`/atelier/works/new`, `/atelier/works/[id]/edit`); simplified prod + ownership UI; same `saveWork`. Hub list pencil opens this route, not the drawer.
- app/atelier/works/actions.ts — image upload, delete, work CRUD

💾 DATA LOGIC
Status: Oeuvres.statusId (FK → OeuvreStatus.id).
Themes: OeuvreTheme junction table. Oeuvres.theme = READ-ONLY/DEAD.
Images: tblImage → trigger updates Oeuvres auto.
Dates: Oeuvres.Année = DATE (YYYY-01-01). Use yearOf() in lib/data.ts.
Sort: UI dropdowns = Alphabetical.
Image URLs: imageUrl() / thumbUrl() from lib/data.ts. Never build R2 URLs manually.

🚫 CEMETERY (instant fail)
DEAD COLUMNS: Oeuvres.Statut, Oeuvres.StatutID, tags, txtImageName, Emballage, DocsValidated, UniteDimension
ORPHAN COLS: NomOriginal (→ Titre), Poids, Tirage
DEAD TABLES: tblRelations (→ tblrelations), OeuvreRelationships
NEVER WRITE: Oeuvres.is_public (trigger), Oeuvres.txtImageNameLink (trigger tblimage_cover_sync)
NEW TABLES: snake_case only. No tbl prefix. No CamelCase.

📄 PORTFOLIO PDF
Engine: app/atelier/portfolio/pdf-action.ts → generatePortfolioPdf(opts).
Self-contained: server action loads R2 config (portfolio_sections.json) + Supabase public works internally. No client data prep.

SOURCE PRIORITY for sections (try in order, keep FIRST that claims ≥1 work):
1. raw.sections                       (Atelier > Portfolio tab)
2. raw.works_modes[0].collections     (Atelier > Site public tab) ← user's real config lives here
3. raw.works_collections              (legacy mirror)
If all 0 claims → fallback __all__ virtual section with all public works in DB order.
DIAGNOSTIC: server logs '[portfolio-pdf] source "X": N collections → Y works claimed'. Watch dev console.

WORK ORDER inside a section: manual_work_order[] first (atelier drag order, public+image-bearing only), then theme-matched residual.

LAYOUT by orientation (page aspect × artwork H/W from DB):
- match (P/P or L/L) → full bleed + slim 22% bottom band, 60% black opacity
- mismatch P+L      → image top ~55% on off-white, text panel below
- mismatch L+P      → image left ~55% on off-white, text panel right

COVER WORK: first work whose image actually loaded. EXCLUDED from work pages (no duplication).

🪦 PDFKIT GOTCHAS
ALPHA HEX UNSUPPORTED: `#RRGGBBAA` is parsed wrong → pdfkit takes the last 6 bytes as RGB. `#00000066` → navy, `#000000aa` → royal blue, `#000000cc` → bright blue. SOLUTION: always `doc.fillOpacity(N).rect(...).fill('#RRGGBB').fillOpacity(1)`. Always reset to 1 after, else bleeds into subsequent draws.
NEVER use 8-char hex with pdfkit. Period.
TEXT OVERFLOW: doc.text(longBody, x, y, { width }) without `height` auto-paginates. New auto-pages have no background fill — re-fill if needed.

📦 SHARP / AVIF
sharp 0.34.5 has libheif 1.20 → AVIF input works via the `heif` format key. No special config. AVIF is NOT a problem for portfolio image processing.
