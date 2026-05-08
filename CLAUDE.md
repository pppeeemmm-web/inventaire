# CLAUDE.md — PEM Art Database
*Conventions et politiques pour toutes les sessions futures*
*Mis à jour : 07 mai 2026*

---

## 🛑 RÈGLES D'INTERACTION DE L'IA (STRICT)
**COMPROMIS MAJEUR : Prioriser la PRUDENCE absolue sur la vitesse.**

1. **Phase de Réflexion Obligatoire (`<thinking>`)** : 
   Avant d'écrire ou de modifier du code, tu DOIS ouvrir un bloc `<thinking>`. Dedans, tu dois :
   - Énoncer tes hypothèses.
   - Lister les fichiers à toucher (modifications chirurgicales uniquement).
   - Proposer les compromis/choix s'il y a ambiguïté.
2. **Zéro Autonomie de Modification & d'Exécution** : Interdiction formelle de modifier un fichier OU d'exécuter une migration/requête SQL sur la base de données sans une commande "GO" ou "Execute" de l'artiste. Même si un artefact est auto-approuvé, attends la confirmation pour les actions critiques.
3. **Contrôle de Sécurité Ciblé (Adversarial Check)** : Avant de soumettre du code lié à la sécurité, aux permissions ou aux règles RLS, tu dois explicitement :
   - Lister au moins 3 façons dont un utilisateur malveillant pourrait contourner ta propre solution (ex: mise à jour de colonnes non protégées).
   - Prouver comment ta proposition bloque ces vecteurs d'attaque.
4. **Simplicité & Code Minimal** : Zéro fonctionnalité spéculative. Pas de rustines. Si tu écris 200 lignes et que 50 suffisent, réécris. 
5. **Exécution Orientée Objectifs** : Pour les tâches complexes, ton bloc `<thinking>` doit inclure un plan strict :
   - `1. [Étape précise] → vérifier: [Critère de succès précis]`
   - `2. [Étape précise] → vérifier: [Critère de succès précis]`
6. **Confirmer avant de supprimer** : Toujours.

---

## 🚫 LE CIMETIÈRE (ANTI-PATTERNS & DÉPRÉCIATIONS)
**NE JAMAIS utiliser, lire, ou écrire ces éléments sous peine d'échec critique :**

* **Colonnes droppées/interdites :** `Oeuvres.Statut`, `Oeuvres.StatutID`, `tags`, `txtImageName`, `Emballage`, `DocsValidated`, `UniteDimension`.
* **Colonnes orphelines (Ne pas utiliser) :** `NomOriginal` (utiliser `Titre`), `Poids`, `Tirage`.
* **Tables droppées :** `tblRelations` (utiliser `tblrelations`), `OeuvreRelationships`.
* **Écritures Interdites :** * Ne JAMAIS écrire dans `Oeuvres.is_public` (géré par trigger).
  * Ne JAMAIS écrire dans `Oeuvres.txtImageNameLink` (géré par trigger `tblimage_cover_sync`).
* **Formatage Interdit :** * Jamais de préfixe `tbl` pour les nouvelles tables (ex: utiliser `contact_note`, pas `tblContactNote`).
  * Jamais de CamelCase pour les tables (utiliser `snake_case`).

---

## ⚙️ COMMANDES

```bash
npm run dev    # serveur dev Next.js 15 (port 3000)
npm run build  # build production
npm run lint   # ESLint
```

Pas de suite de tests configurée.

---

## 🔑 PATTERNS CLÉS (runtime)

- **Mutations** : Server Actions Next.js (`'use server'`) — pas d'API routes
- **Config portfolio** (about, practice, collections) : JSON dans R2 `portfolio/config.json` via `loadPortfolioConfig()` / `savePortfolioConfig()` dans `app/atelier/portfolio/actions.ts`
- **Supabase** : `createClient()` côté client (anon) · `createServiceClient()` dans Server Actions (service_role, bypass RLS)
- **Import docx/txt** : `extractDocumentText()` dans `app/atelier/portfolio/actions.ts` — mammoth pour DOCX → HTML
- **URLs images** : toujours `imageUrl()` / `thumbUrl()` depuis `lib/data.ts` — ne pas construire les URLs R2 manuellement

---

## 🗄️ ARCHITECTURE & SCHÉMA CANONIQUE

### 1. Règle "DB d'abord" (Absolue)
Toute table ou colonne référencée dans le code DOIT exister en base via `execute_sql` avant de construire l'UI. Ne jamais avaler les erreurs Supabase.

### 2. Variables & Helpers Critiques
- **Dossier** : `C:\Users\pppee\Documents\Claude\Projects\Art db\app`
- **Statut** : Toujours utiliser `Oeuvres.statusId` (integer FK → `OeuvreStatus.id`).
- **Thèmes** : Utiliser la table de jonction `OeuvreTheme`. `Oeuvres.theme` est en lecture seule (déprécié).
- **Images** : Source unique = `tblImage`. Le trigger mettra à jour `Oeuvres` auto.
- **Dates** : `Oeuvres.Année` est un DATE (`YYYY-01-01`). Extraire via `yearOf()` dans `lib/data.ts`.
- **Tri** : Tous les dropdowns UI doivent être triés par ordre alphabétique.