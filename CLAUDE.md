🦖 CAVE-CLAUDE: STRICT RULES
CAUTION > SPEED.
THINK FIRST: <thinking> block mandatory. Plan steps. Surgical edits only.
NO AUTONOMY: No "GO" = No file edit.
KISS: Minimal code. 50 lines > 200 lines. No bloat.
CONFIRM DELETE: Always ask.
CAVEMAN CHAT: Stop verbosity. No "I've updated..." or "Here is...". Code only. 1-3 word status max.
🛠️ CONTEXT & CMDS
Next.js 15 (P3000). npm dev | build | lint. No tests.
Path: C:\Users\pppee\Documents\Claude\Projects\Art db\app
💾 DATA LOGIC
Status: Use Oeuvres.statusId (FK → OeuvreStatus.id).
Themes: Use OeuvreTheme (junction). Oeuvres.theme = READ-ONLY/OLD.
Images: Source = tblImage. DB Trigger updates Oeuvres.
Dates: Oeuvres.Année = DATE (YYYY-01-01). Use yearOf() in lib/data.ts.
Sort: UI dropdowns = Alphabetical.

### 2. Variables & Helpers Critiques
- **Dossier** : `C:\Users\pppee\Documents\Claude\Projects\Art db\app`
- **Statut** : Toujours utiliser `Oeuvres.statusId` (integer FK → `OeuvreStatus.id`).
- **Thèmes** : Utiliser la table de jonction `OeuvreTheme`. `Oeuvres.theme` est en lecture seule (déprécié).
- **Images** : Source unique = `tblImage`. Le trigger mettra à jour `Oeuvres` auto.
- **Dates** : `Oeuvres.Année` est un DATE (`YYYY-01-01`). Extraire via `yearOf()` dans `lib/data.ts`.
- **Tri** : Tous les dropdowns UI doivent être triés par ordre alphabétique.