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
RESPONSIVE: obey **📱 MOBILE FIELD-TOOL** below (concept + contract; authoritative).

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

📱 MOBILE FIELD-TOOL
**Concept**: Handset = **atelier field terminal** — photograph works, fix metadata, nudge pipeline on site. Desktop = primary home for heavy PR/CRM, wide dashboards, and dense boards (e.g. Concepts/constellation); phone must still **not break** there, but need not duplicate desktop power-user layout.
**Contract** (SE-class viewports):
- **Breakpoints & QA**: Use `max-width: 767px` for mobile layout branches (`useMediaQuery('(max-width: 767px)')`). Verify at **375px** (iPhone SE). Treat **~360px** as the minimum width that must not break; do not rely on narrower viewports without justification.
- **Layout**: No horizontal page scroll; no clipped controls; preserve core actions in compact layouts. No desktop-only fixed widths (`width: 460`, `padding: 60px`), multi-column grids, or side-rails without a narrow branch.
- **Touch & forms**: Minimum **44px** tap targets on primary actions (buttons, toggles, image-add). **Save** (or primary commit) must stay reachable without scrolling. Top/bottom bars and sticky footers pad for `env(safe-area-inset-*)`; use `max(..., env(safe-area-inset-bottom))` on sticky actions where needed.
- **Capture-first uploads**: On mobile, image inputs may use `capture="environment"` when appropriate.
- **Downstream check**: If `/hub` adds or changes a mobile entrypoint, smoke **WorkForm**, **WorkDrawer**, and at least **Inventory** on a small viewport.
- **Atelier sidebar (narrow)**: First group **Terrain / Field** — tabs `inventory` → `production` → `stock-take` → `overview`, then existing buckets (`TeamPortalClient` `GROUPS` when `atelierNarrow`).

**Drawer / panel edit guard (modals & side editors)**  
- Serialize form + nested lists → baseline string; `isDirty` when current payload ≠ baseline.  
- **Save** persists then proceeds; **Discard** proceeds without saving (loses edits); **Cancel** only closes the dialog.  
- Reuse `hooks/useUnsavedActionGuard.tsx` for any deferred navigation (`activeId`, tab, route); `useUnsavedCloseGuard` wraps it for “close overlay” (`onProceed` = `onClose`).  
- Narrow viewports: same sticky primary actions + safe-area padding as **📱 MOBILE FIELD-TOOL** contract above; `max(..., env(safe-area-inset-bottom))`. Do not stack read-only text and inputs in the same table cell (overlap).  
- Reference: `components/atelier/ContactsTab.tsx` + `ContactEditorPanel.tsx`.

📁 KEY FILES
- lib/i18n/dictionary.ts · context.tsx — all UI strings (fr/en)
- lib/data.ts — imageUrl(), thumbUrl(), yearOf(), statusOf(), makeFilename()
- lib/supabase/client.ts — browser client
- lib/supabase/server.ts — server + service client
- lib/work-editor-model.ts — shared prod/ownership stages + `computeStatusId` for WorkForm + WorkDrawer
- app/atelier/page.tsx — loads all reference data in parallel (up to 5000 rows), builds lookup maps
- components/atelier/TeamPortalClient.tsx — main orchestrator (tabs, selection, drawer); reads `?work=` on load (`runGuarded`); dirty drawer → unsaved prompt on Hub + `beforeunload` on tab close
- components/atelier/InventoryTab.tsx — inventory list + panel
- components/atelier/WorkDrawer.tsx — **canonical edit** for existing works: prod/ownership pipes, finance, notes, themes/groups, images (incl. delete), gift flow, `saveWork` + guards (`runGuarded`, `?work=` deep link via `TeamPortalClient`). Overlay + inventory panel modes.
- components/atelier/WorkForm.tsx — full-page **create only** at `/atelier/works/new` (shared `saveWork`). `/atelier/works/[id]/edit` redirects to `/atelier?work=<id>` (drawer).
- components/atelier/ContactEditorPanel.tsx — Hub Contacts full editor in the right column / stacked on mobile (`ContactsTab` orchestrates selection, `useUnsavedActionGuard` on row switch / batch / merge).
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
