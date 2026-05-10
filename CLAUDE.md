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

🛠️ CMDS
Next.js 15 (port 3000). npm dev | build | lint. No tests.
Real app path: C:\Users\pppee\Documents\Claude\Projects\Art db\app
Worktree edits → copy to real app (dev server runs from real app).

🏗️ ARCHITECTURE
- Next.js 15 App Router + Supabase + Cloudflare R2 (images)
- Server Components fetch data, pass to Client Components
- Mutations: Server Actions ('use server') in app/**/actions.ts only. No API routes.
- Auth: Supabase SSR middleware enforces auth on all /atelier /hub /galerie routes
- i18n: useI18n() hook from lib/i18n/context.tsx (fr/en via localStorage)
- Image upload: Sharp → 400px AVIF thumb → R2 via AWS S3 SDK
- Supabase clients: createClient() (anon, RLS enforced) · createServiceClient() (service_role, admin bypass)

📁 KEY FILES
- lib/data.ts — imageUrl(), thumbUrl(), yearOf(), statusOf(), makeFilename()
- lib/supabase/client.ts — browser client
- lib/supabase/server.ts — server + service client
- app/atelier/page.tsx — loads all reference data in parallel (up to 5000 rows), builds lookup maps
- components/atelier/TeamPortalClient.tsx — main orchestrator (tabs, selection, drawer)
- components/atelier/InventoryTab.tsx — inventory list + panel
- components/atelier/WorkDrawer.tsx — detail/edit panel with pipeline bar, anonymity gate, zoom
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
