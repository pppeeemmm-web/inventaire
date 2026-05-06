# CLAUDE.md — PEM Art Database
*Conventions et politiques pour toutes les sessions futures*
*Mis à jour : 27 avril 2026*

---

## Projet

**Stack** : Next.js 15 App Router · Supabase (project ID `mcrzsxrcoexnlwmaunte`) · TypeScript  
**Dossier** : `C:\Users\pppee\Documents\Claude\Projects\Art db\app`  
**Bucket storage** : `paintings` (Supabase Storage)  
**Deploy** : Vercel

---

## Conventions de collaboration & Style d'interaction

**Règles absolues édictées par l'artiste (Mai 2026) :**
1. **Questions & Choix multiples** : Toujours poser des questions claires et offrir plusieurs choix d'architecture ou de design avant d'implémenter des fonctionnalités lourdes.
2. **Zéro Autonomie de Modification** : Antigravity a l'interdiction formelle de modifier tout fichier du projet sans une commande explicite "GO" ou "EXECUTE" faisant suite à une proposition détaillée et validée par l'artiste.
3. **Logiques de Maître** : Toute modification doit être précédée d'une validation de la logique métier. En cas d'incohérence, l'IA doit demander clarification.
4. **Tri Alphabétique** : Tous les dropdowns et listes de choix doivent être triés par ordre alphabétique systématiquement.
5. **Dates Flexibles** : Le champ "Année" supporte les formats `YYYY`, `YYYY/MM`, ou `YYYY/MM/DD`.

---

## Architecture des Pipelines (Atelier)

### ⚙️ Production
- **Atelier** : Public OFF, Consignation/Vente bloquée.
- **Catalogué** : Public OFF, Checkbox "Needs Photo" activée. Si la tâche photo est faite -> Passage auto à **Available**.
- **Available** : Public ON, Logistique/Vente possible.

### 🌍 Ownership & Logistique
- **Pem (Artist Atelier)** : Lieu par défaut.
- **Consignation** : Mise à jour via l'onglet Exposition ou via un "Consignment Order". Adresse auto-dérivée du contact.
- **Sold/Gift** : Désactive le pipeline Production (Archive). Toggle Vente vs Cadeau. Si non payé -> Statut "Reserved".

### 🛡️ Condition & Archive
- **Damaged** : Génère auto une tâche de restauration dans l'onglet Production.
- **Destroyed/Lost** : Verrouille l'ownership et force l'état Archive.

### 💰 Financials
- **Gift** : Champs prix/remise grisés.
- **Sold** : Calcul du prix final, gestion du calendrier de paiement, génération de tâches de suivi si impayés.
- **Anonymat** : Toggle pour masquer les données de l'acheteur sur les documents publics.
2. **Pas de "Quick Fixes"** : Ne jamais utiliser de rustines (quick fixes), de données fantômes (ghost data), ou d'options "nucléaires" juste pour forcer un résultat à fonctionner temporairement. Les solutions doivent être propres, robustes et avec 95% de confiance.
3. **Partenariat Actif** : Agir en tant que partenaire technique. Challenger les hypothèses, proposer des améliorations réalistes basées sur les standards de l'industrie, et alerter sur les faiblesses structurelles potentielles de toute nouvelle fonctionnalité.

---

## Colonnes canoniques — règles absolues

### Statut des œuvres
- **Colonne canonique** : `Oeuvres.statusId` (integer, FK → `OeuvreStatus.id`, 1112/1112 renseignées)
- `Statut` (text) : **droppée** — ne plus référencer

---

## Prévention des Défaillances Silencieuses (Silent Failures)

### Principes de Développement & Test
1. **Assertions Explicites** : Ajouter des assertions après chaque action critique, pas seulement à la fin.
2. **Contexte d'Erreur Riche** : Logger les erreurs avec les entrées, l'environnement, le nom de l'étape et le contexte complet pour une reproduction rapide.
3. **Heartbeats / Health Checks** : Utiliser des contrôles de santé dans les flux longs pour détecter les processus bloqués.
4. **Preuves Visuelles** : Capturer des captures d'écran, vidéos ou traces réseau en cas d'échec pour exposer les points de rupture cachés.
5. **Fail Fast** : Échouer immédiatement sur les exceptions inattendues au lieu de les "avaler" (swallowing errors).
6. **Stabilité des Données** : Maintenir un état d'environnement stable pour éviter les faux positifs/négatifs.

### Règle d'Or
Si un processus continue après l'échec d'une étape majeure, c'est une faille de conception. **Détecter tôt, rapporter clairement, et escalader immédiatement.**
- `StatutID` (integer) : **droppée** — ne plus référencer
- Tout filtre de statut passe par `statusId`
- Labels lisibles via `OeuvreStatus` (10 entrées) ou le map `statusLabelMap` fourni par `page.tsx`

### Thèmes
- **Système canonique** : `OeuvreTheme` (junction table, 458 entrées)
- `Oeuvres.theme` (text) : **dépréciée** — encore présente mais en lecture seule
  - 86 œuvres migrées vers OeuvreTheme, 14 restantes ("CoG 26" — theme inexistant dans tblTheme)
  - Ne pas écrire dans cette colonne, ne pas s'y fier pour le comptage

### Images
- **Source canonique unique** : `tblImage` (ImageID, OeuvreID, txtImageNameLink, SeqNo, is_cover, DateAdded, ImageNote)
  - `is_cover = true` → image de couverture (une seule par œuvre)
  - `is_cover = false` → image additionnelle
  - `ImageID` : séquence auto via `tblImage_ImageID_seq`
- **`Oeuvres.txtImageNameLink`** : cache synchronisé automatiquement par trigger (`sync_cover_image_to_oeuvres`). Ne jamais écrire directement — passer par `tblImage.is_cover`.
- Toute nouvelle image → INSERT dans `tblImage`. Le trigger met à jour `Oeuvres` automatiquement.
- 3 œuvres sans image : OeuvreID 214 ("Autoportrait"), 2287, 2332 — genuinement non photographiées
- `tblOeuvreImages` : **droppée** (ancien système, 179 lignes archivées)
- Ne pas créer de nouvelle table d'images

### Adresses de contacts
- **Canonique** : `contact_addresses` (plusieurs adresses par contact, avec `label`, `position`)
- `Contact.Ville` / `Contact.Pays` : fallback legacy, encore présent mais non mis à jour
- `Adresses`, `DetailAdressesContactID`, `tblContactAddress` : **droppées**

### Relations (Constellation)
- **Canonique** : `tblrelations` (lowercase, 7 colonnes dont `description` et `strength`)
- `tblRelations` (uppercase R) : **droppée**
- `OeuvreRelationships` : **droppée**

---

## Nommage des nouvelles tables

| Règle | Exemple correct | Exemple interdit |
|-------|----------------|-----------------|
| Toujours `snake_case` | `work_export` | `WorkExport`, `tblWorkExport` |
| Jamais de préfixe `tbl` | `contact_note` | `tblContactNote` |
| Jamais de majuscule | `theme_preset` | `ThemePreset` |
| Langue : anglais ou français cohérent | `suivi_process` ✓ | mix |

---

## Tables actives (21 tables — état post-nettoyage)

| Table | Rôle |
|-------|------|
| `Oeuvres` | Noyau catalogue (1112 œuvres) |
| `OeuvreStatus` | Lookup statuts (10 entrées) |
| `OeuvreTheme` | Junction œuvre↔thème |
| `tblTheme` | Référentiel des thèmes |
| `tblImage` | Images additionnelles par œuvre |
| `Technique` | Lookup techniques |
| `Support` | Lookup supports |
| `Format` | Lookup formats |
| `Contact` | 14 contacts (galeries, institutions, PEM) |
| `contact_addresses` | Adresses multiples par contact |
| `tblPresentation` | Lookup présentations |
| `tblRole` | Rôles des contacts |
| `tblrelations` | Arêtes constellation (lowercase !) |
| `working_group` | Groupes de curation |
| `working_group_work` | Junction groupe↔œuvre (75 entrées) |
| `private_link` | Tokens de partage public |
| `document` | Vault — fichiers joints |
| `profiles` | Auth Supabase |
| `suivi_process` | Pipeline commercial |
| `suivi_etape` | Étapes de pipeline |
| `suivi_reminder` | Rappels pipeline |

---

## Colonnes Oeuvres — état actuel

### Actives et utilisées
`OeuvreID`, `Titre`, `statusId`, `ContactID`, `AcheteurID`, `txtImageNameLink`, `Année`, `Hauteur`, `Largeur`, `Profondeur`, `Technique`, `Support`, `Format`, `Exposable`, `Prix`, `PrixFinal`, `Discount`, `Catalogué`, `LocalisationID`, `LocalisationDetail`, `Commentaires`, `PresentationID`, `ReturnDate`, `DateLivraison`, `is_public`, `Encadree`, `IsCommission`, `created_at`

### Dépréciées (en lecture seule)
- `theme` (text) : remplacée par `OeuvreTheme` — lire seulement jusqu'à migration complète

### Orphelines (ne pas utiliser)
- `UniteDimension` : était FK vers `Mesure` (droppée) — integer sans signification
- `NomOriginal` : 1112 lignes, contenu identique à `Titre` — non utilisé dans l'app
- `Poids` : 739 lignes, pas d'UI

### Droppées (ne jamais référencer)
`Statut`, `StatutID`, `tags`, `txtImageName`, `Emballage`, `DocsValidated`

---

## Bugs connus résolus

| Bug | Fichier | Fix appliqué |
|-----|---------|-------------|
| Portfolio lisait `StatutID` (2 lignes) au lieu de `statusId` (1112) | `app/portfolio/page.tsx` | Remplacé le 27/04/2026 |
| InventoryTab filtrait sur `StatutID` au lieu de `statusId` | `components/atelier/InventoryTab.tsx` | Remplacé le 27/04/2026 |
| WorldMapTab re-fetchait Contact (déjà dans les props) | `components/atelier/WorldMapTab.tsx` | Supprimé le 27/04/2026 |
| **Document PDF (Thumbnails)** | `app/atelier/sales/actions.ts` | Fix AVIF support (via Sharp conversion) + AWS4 signatures fetch (SDK bypass) - 03/05/2026 |
| **Sales Tab UI (Overlaps)** | `components/atelier/SalesTab.tsx` | Fix UI squashing via minWidth + explicit table columns - 03/05/2026 |

---

## Bugs TS pré-existants (non bloquants)

Ces erreurs TypeScript existaient avant les sessions d'avril 2026 et ne sont pas liées aux modifications récentes :

- `ExportModal.tsx` — erreurs cascading
- `BatchEditModal.tsx` — erreurs cascading
- `CurationDock.tsx` — erreurs cascading
- `ConstellationCanvas.tsx` — erreurs cascading
- `WorkForm.tsx` — erreurs cascading
- `actions.ts` (works) — erreurs cascading
- `WorldMapInner.tsx` ligne 138 — template literal non fermé

---

## Règles architecture

### DB d'abord — règle absolue
**Toute table référencée dans le code doit exister en base avant le déploiement.** Vérifier avec `execute_sql` avant d'écrire le moindre composant UI qui dépend de cette table. Un composant qui écrit en base sans table existante échoue silencieusement côté Supabase — la donnée est perdue sans alerte visible à l'utilisateur. **L'intégrité de la base prime sur l'UI.**

### Colonnes sans UI
Toute colonne ajoutée à `Oeuvres` doit avoir un champ dans `WorkForm` ou une justification écrite ici. Pas de colonnes "pour plus tard".

### Année
`Oeuvres.Année` est un `DATE` mais stocké comme `YYYY-01-01` par convention. L'app extrait l'année avec `yearOf()` dans `lib/data.ts`. Ne pas migrer en `smallint` sans vérifier tous les points de lecture.

### Geocoding
Cache Nominatim dans `WorldMapTab.tsx` : module-level `Map` + `sessionStorage` (clé `pem_geo_cache`). Survit aux rechargements de page. Ne pas ajouter d'autre mécanisme de cache.

### Fetch côté client
- `Contact` : chargé côté serveur dans `page.tsx`, transmis en props → **ne pas re-fetcher**
- `contact_addresses` : absent du fetch serveur → fetcher une fois dans `WorldMapTab`
- `working_group` / `working_group_work` : chargés serveur, groupes rechargeables via `handleLoadGroup` dans InventoryTab

### Statut dans les queries
```typescript
// ✅ Correct
supabase.from('Oeuvres').select('statusId')
.filter(o => !EXCLUDE_IDS.includes(o.statusId))

// ❌ Interdit — colonnes droppées
supabase.from('Oeuvres').select('Statut, StatutID')
```

---

## Routes

| Route | Accès | Description |
|-------|-------|-------------|
| `/` | Public | Landing page artiste — grille d'œuvres, lien portfolio |
| `/portfolio` | Public | Portfolio paginé carte par carte |
| `/hub` | Auth | Dashboard interne (stats, images récentes) |
| `/atelier` | Auth | Outil atelier complet (inventaire, constellation, map) |
| `/galerie` | Auth | Galerie interne |
| `/collection` | Auth | Collection interne |
| `/login` | Public | Authentification |

## Tâches en suspens

- [x] Créer thème "CoG 26" dans `tblTheme` — migré (ThemeID 15, 14 œuvres)
- [x] `Oeuvres.UniteDimension` — droppée (FK brisée vers Mesure)
- [ ] `Oeuvres.Poids` — 739 lignes, pas d'UI. Garder pour l'instant
- [ ] `is_public` — 0 œuvres ont ce flag à true. Décider si on l'utilise ou si on le supprime
- [ ] Évaluer `Fournitures` (173 lignes archivées dans `archive_Fournitures.csv` sur le Desktop)
- [ ] **PipelineTab** : Refonte complète du formulaire de création/édition de processus (overhaul).

---

## Backlog — revue du 28 avril 2026

### 🔴 Bugs / confusion UX immédiate

1. **Fiscal — dépenses vides** : L'onglet Fiscal/Dépenses affiche 0 dépenses alors que des données existaient. À investiguer (table `expense` était listée comme vide dans l'audit — vérifier si elle a été droppée par erreur ou si c'est une autre table).

2. **Production tab — thumbnails manquants** : Certaines œuvres n'affichent pas leur thumbnail dans la vue Production (vue par étapes). Bug récurrent. Vérifier que `thumbUrl` est appelé correctement et que `txtImageNameLink` est bien passé aux cards.

3. **Confusion Statut / Localisation dans le panneau preview** :
   - La preview affiche "ATELIER" dans le champ STATUT — c'est en fait la localisation (champ `Chez`), pas le statut
   - Le statut réel (ex: "Reserved") n'est pas clairement distingué de la localisation ("Chez Pem · Atelier")
   - À clarifier : afficher séparément STATUT (Reserved) et LOCALISATION (Atelier, Paris France)
   - Pas d'adresse affichée dans le panneau preview — à ajouter si disponible via `contact_addresses`

4. **Carte (WorldMap) mode Œuvres** : Les œuvres apparaissent comme petits cercles mais sans thumbnail dans les popups. `mkThumb` dans `WorldMapInner` devrait fonctionner — vérifier si `workThumbs` est bien passé dans les pins `works`.

### 🟠 Pipeline — données & maintenance UI

5b. **Pipeline Production — maintenance** : L'onglet Production doit refléter l'état réel du pipeline. Points à améliorer :
   - Les commissions avec deadline apparaissent avec badge ⏱ (implémenté). Vérifier que les works existants avec `IsCommission=true` ont bien une `DateLivraison`.
   - Amélioration visuelle : trier les colonnes par deadline imminente en haut.
   - Données : audit des works `IsCommission=true` sans deadline → à compléter manuellement.
   - Statuts & étapes manuelles : enregistrer les étapes manuellement (non seulement inférées).

### 🟠 Améliorations court terme

5. **Constellation — filtre thème** : En mode "theme", affiche TOUTES les œuvres au lieu d'afficher uniquement celles qui ont le thème sélectionné. C'est "messy and daunting". Filtrer par `OeuvreTheme` pour chaque cluster.

6. **Constellation — "+libre"** :
   - Drag-and-drop réel (pas juste du placement aléatoire)
   - Possibilité de nommer le groupe (+titre, thème…)
   - Sauvegarde/export du canvas libre (→ `working_group` ?)
   - **Bouton pour retirer des œuvres du canvas** (actuellement impossible)

7. **Onglet Production — étapes vs statut** :
   - Les étapes (`stage_idea`, `stage_sketch`… `stage_catalogued`) sont inférées automatiquement, pas saisies. L'artiste ne "fait pas d'esquisse" systématiquement.
   - Le processus réel est non-linéaire : WIP → photographié → couche suivante → retour WIP → décidé disponible
   - Idée : les étapes devraient être *enregistrables manuellement* par l'artiste, pas seulement inférées depuis les champs DB
   - Concept clé : **l'œuvre est "available" quand l'artiste décide qu'elle l'est**, pas selon un algorithme

8. **Inventaire — utilisation de l'espace** :
   - Le drawer gauche (preview) ne montre que quelques champs, beaucoup d'espace vide
   - Ajouter : adresse de localisation, notes/commentaires, thèmes, tags
   - Vue galerie : nombre de colonnes configurable (2, 3, 4, 6…)
   - Vue liste : colonnes sélectionnables dans le drawer de droite

9. **Contacts — espace inutilisé** : Le panneau de détail contact a beaucoup d'espace blanc. Ajouter : liste des œuvres associées, historique d'interactions, adresses multiples visibles.

10. **Gestion des thèmes** : Pas de vue dédiée pour créer/éditer/supprimer des thèmes. Peut s'intégrer dans un onglet existant (Settings ? Vue d'ensemble ?).

### 🟡 Fonctionnalités à planifier

11. **Workflow soumission (Fiscal/Suivi)** : Pouvoir soumettre un dossier de candidature depuis l'app, mettre à jour le statut correspondant, et verser les documents dans le Coffre (vault).

12. **Assets numériques** : Espace dédié aux fichiers numériques liés à une œuvre (print-ready, fichiers sources, différentes résolutions). Lié à `OeuvreID`. Distinct de `tblImage` (photos) — pour les fichiers de production.

13. **Dashboard `/hub`** : L'ancien dashboard hub a été déplacé de `/` vers `/hub`. S'assurer que les liens internes depuis `/atelier` ("← Retour") pointent vers `/hub` et non `/`.

### 🟢 Idées long terme (roadmap)

14. **Accrochage virtuel** : Mock-up d'exposition depuis photos de salles. Placer des œuvres sur topographie (plan de sol), déplacer, exporter un plan d'accrochage. VR/AR à terme.

15. **Galeries / Expositions** : Espace dédié pour gérer les expositions passées et futures, avec les œuvres présentées, les contacts impliqués, et les documents associés.

16. **Mode debug UX** : Pas de mode debug intégré actuellement. En dev, Next.js avec Turbopack donne les erreurs browser dans le terminal. Pour stresser l'UX, utiliser directement le browser en mode responsive (DevTools F12).

---

## Notes conceptuelles artiste

- **Étapes de production** : non-linéaires. Une œuvre peut rester en WIP des années, être photographiée à plusieurs stades, sécher, recevoir de nouvelles couches. "Available" est une décision artistique, pas un état automatique.
- **Digital vs physique** : certaines œuvres sont digitales (stockées sur HD physique dans l'atelier). La localisation "Atelier" est correcte même pour ces œuvres.
- **"Esquisse"** : rarement pratiqué comme étape formelle — plutôt dans les commentaires ou la constellation.
- **Constellation** : outil de rapport et de curation visuelle, pas de saisie de données. Potentiel fort si le "+libre" devient un vrai outil de composition exportable.
