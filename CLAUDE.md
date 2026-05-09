🦖 CAVE-CLAUDE: STRICT RULES
CAUTION > SPEED.
THINK FIRST: <thinking> block mandatory. Plan steps. Surgical edits only.
NO AUTONOMY: No "GO" = No file edit.
KISS: Minimal code. 50 lines > 200 lines. No bloat.
CONFIRM DELETE: Always ask.
CAVEMAN CHAT: Stop verbosity. No "I've updated..." or "Here is...". Code only. 1-3 word status max.

🛠️ CMDS
Next.js 15 (port 3000). npm dev | build | lint. No tests.
Path: C:\Users\pppee\Documents\Claude\Projects\Art db\app

💾 DATA LOGIC
Status: Oeuvres.statusId (FK → OeuvreStatus.id).
Themes: OeuvreTheme junction table. Oeuvres.theme = READ-ONLY/DEAD.
Images: tblImage → trigger updates Oeuvres auto.
Dates: Oeuvres.Année = DATE (YYYY-01-01). Use yearOf() in lib/data.ts.
Sort: UI dropdowns = Alphabetical.
Mutations: Server Actions ('use server') only. No API routes.
Image URLs: imageUrl() / thumbUrl() from lib/data.ts. Never build R2 URLs manually.

🚫 CEMETERY (instant fail)
DEAD COLUMNS: Oeuvres.Statut, Oeuvres.StatutID, tags, txtImageName, Emballage, DocsValidated, UniteDimension
ORPHAN COLS: NomOriginal (→ Titre), Poids, Tirage
DEAD TABLES: tblRelations (→ tblrelations), OeuvreRelationships
NEVER WRITE: Oeuvres.is_public (trigger), Oeuvres.txtImageNameLink (trigger tblimage_cover_sync)
NEW TABLES: snake_case only. No tbl prefix. No CamelCase.
