# CLAUDE.md — PEM Art Database
*Conventions et politiques pour toutes les sessions futures*
*Mis à jour : 06 mai 2026 — synchronisé sur la base de données live*

---

## Projet

**Stack** : Next.js 15 App Router · Supabase (project ID `mcrzsxrcoexnlwmaunte`) · TypeScript  
**Dossier** : `C:\Users\pppee\Documents\Claude\Projects\Art db\app`  
**Storage** : Cloudflare R2 (primaire) — bucket `paintings` (public) + bucket `vault` (privé)  
**CDN R2** : `https://pub-a352e674a992412fa243598ffd6b659c.r2.dev`  
**Client R2** : AWS SDK S3 via `eu.r2.cloudflarestorage.com` (juridiction EU)  
**Supabase Storage** : legacy / fallback uniquement  
**Deploy** : Vercel

---

## Conventions de collaboration & Style d'interaction

**Règles absolues édictées par l'artiste (Mai 2026) :**
1. **Questions & Choix multiples** : Toujours poser des questions claires et offrir plusieurs choix d'architecture ou de design avant d'implémenter des fonctionnalités lourdes.
2. **Zéro Autonomie de Modification** : Interdiction formelle de modifier tout fichier du projet sans une commande explicite "GO" ou "EXECUTE" faisant suite à une proposition détaillée et validée par l'artiste.
3. **Logiques de Maître** : Toute modification doit être précédée d'une validation de la logique métier. En cas d'incohérence, demander clarification.
4. **Tri Alphabétique** : Tous les dropdowns et listes de choix triés par ordre alphabétique systématiquement.
5. **Dates Flexibles** : Le champ "Année" supporte `YYYY`, `YYYY/MM`, ou `YYYY/MM/DD`.
6. **Pas de "Quick Fixes"** : Jamais de rustines, données fantômes, ou options nucléaires. Solutions propres, robustes, 95% de confiance minimum.
7. **Partenariat Actif** : Challenger les hypothèses, proposer des améliorations réalistes, alerter sur les faiblesses structurelles.
8. **Confirmer avant de supprimer** : Toujours.

---

## Architecture Storage — Cloudflare R2

| Bucket | Accès | Contenu |
|--------|-------|---------|
| `paintings` | Public (CDN) | Images des œuvres + thumbnails (`thumbs/<base>.avif`) |
| `vault` | Privé (signed URLs, 3600s) | PDFs, COAs, documents |

**Helpers** (dans `lib/data.ts`) :
- `imageUrl(file)` → URL CDN complète depuis nom de fichier
- `thumbUrl(file)` → URL thumbnail AVIF 400px (`thumbs/<base>.avif`)
- `yearOf(année)` → extrait l'année depuis le champ DATE
- Sharp utilisé server-side pour génération thumbnails AVIF

---

## Colonnes canoniques — règles absolues

### Statut des œuvres
- **Colonne canonique** : `Oeuvres.statusId` (integer FK → `OeuvreStatus.id`)
- `Statut` (text) : **droppée** — ne jamais référencer
- `StatutID` (integer) : **droppée** — ne jamais référencer
- Tout filtre de statut passe par `statusId`

### OeuvreStatus — 11 entrées live
| id | label |
|----|-------|
| 1 | En production |
| 2 | Disponible |
| 3 | Archive artiste |
| 4 | Réservé |
| 5 | Archive privée |
| 6 | Vendu |
| 7 | Consigné |
| 8 | Prêt |
| 9 | Destroyed |
| 10 | Lost |
| 11 | Gift |

### is_public — géré par trigger
`Oeuvres.is_public` est synchronisé **automatiquement** par le trigger `trg_sync_is_public` (INSERT + UPDATE) via `sync_is_public_from_status()`. Ne jamais écrire directement.

### StageProduction
Nouveau champ `Oeuvres.StageProduction` (text, CHECK) :  
Valeurs valides : `atelier` · `wip` · `shot` · `catalogued` · `available` · `archive` · `idea` · `drying` · `mounting` · `framing`

### Images
- **Source canonique unique** : `tblImage` (ImageID, OeuvreID, txtImageNameLink, SeqNo, is_cover, DateAdded, ImageNote)
- `is_cover = true` → image de couverture (une seule par œuvre)
- `Oeuvres.txtImageNameLink` : cache synchronisé par trigger `tblimage_cover_sync` (INSERT + UPDATE + DELETE) → `sync_cover_image_to_oeuvres()`. **Ne jamais écrire directement.**
- Toute nouvelle image → INSERT dans `tblImage`, le trigger met à jour `Oeuvres` automatiquement
- Ne pas créer de nouvelle table d'images

### Thèmes
- **Canonique** : `OeuvreTheme` (junction table, 551 entrées)
- `Oeuvres.theme` (text) : **dépréciée** — lecture seule jusqu'à migration complète

### Relations (Constellation)
- **Canonique** : `tblrelations` (lowercase !)
- `tblRelations` (uppercase R) : **droppée**
- `OeuvreRelationships` : **droppée**

### Adresses de contacts
- **Canonique** : `contact_addresses` (plusieurs adresses par contact)
- Contact normalisé en tables séparées : `contact_emails`, `contact_phones`, `contact_websites`, `contact_socials`
- `Contact.Ville` / `Contact.Pays` / `Contact.Adresse` : legacy fallback, non mis à jour

---

## Triggers actifs

| Trigger | Table | Événements | Fonction |
|---------|-------|-----------|---------|
| `tblimage_cover_sync` | `tblImage` | INSERT, UPDATE, DELETE | `sync_cover_image_to_oeuvres()` |
| `trg_sync_is_public` | `Oeuvres` | INSERT, UPDATE | `sync_is_public_from_status()` |
| `trg_sale_order_ref` | `sale_order` | INSERT | `set_sale_order_ref()` |
| `trg_concept_upd` | `concept` | UPDATE | `trg_concept_updated_at()` |
| `trg_exh_layout_upd` | `exhibition_layout` | UPDATE | `trg_exhibition_layout_upd()` |

---

## Tables actives — 36 tables (état live 06/05/2026)

### Catalogue œuvres
| Table | Rôle | Lignes |
|-------|------|--------|
| `Oeuvres` | Noyau catalogue | 1117 |
| `OeuvreStatus` | Lookup statuts | 11 |
| `OeuvreTheme` | Junction œuvre↔thème | 551 |
| `tblTheme` | Référentiel des thèmes | 17 |
| `tblImage` | Images par œuvre | 1126 |
| `Technique` | Lookup techniques | 20 |
| `Support` | Lookup supports | 15 |
| `Format` | Lookup formats | 8 |
| `tblPresentation` | Lookup présentations | 5 |
| `work_action` | Actions/tâches par œuvre | 405 |
| `work_action_type` | Lookup types d'actions | 8 |
| `concept` | Idées / pré-œuvres | 2 |

### Contacts
| Table | Rôle | Lignes |
|-------|------|--------|
| `Contact` | Contacts (galeries, acheteurs, etc.) | 33 |
| `contact_addresses` | Adresses multiples par contact | 32 |
| `contact_emails` | Emails normalisés | 7 |
| `contact_phones` | Téléphones normalisés | 14 |
| `contact_websites` | Sites web normalisés | 1 |
| `contact_socials` | Réseaux sociaux normalisés | 1 |
| `tblRole` | Rôles des contacts | 33 |

### Commerce & Logistique
| Table | Rôle | Lignes |
|-------|------|--------|
| `sale_order` | Ordres de vente | 0 |
| `consignment_order` | Ordres de consignation | 0 |
| `shipment` | Expéditions | 0 |
| `shipment_work` | Junction expédition↔œuvre | 0 |

### Exposition & Curation
| Table | Rôle | Lignes |
|-------|------|--------|
| `working_group` | Groupes de curation | 7 |
| `working_group_work` | Junction groupe↔œuvre | 97 |
| `private_link` | Tokens de partage public | 0 |
| `exhibition_layout` | Plans d'accrochage virtuel | 2 |

### Pipeline & Suivi
| Table | Rôle | Lignes |
|-------|------|--------|
| `suivi_process` | Processus commerciaux/admin | 6 |
| `suivi_etape` | Étapes de processus | 25 |
| `suivi_reminder` | Rappels pipeline | 0 |

### Finances & Stock
| Table | Rôle | Lignes |
|-------|------|--------|
| `expense` | Dépenses BNC (fiscal français) | 7 |
| `stock_item` | Stock atelier (matériel, fournitures) | 234 |

### Documents & Auth
| Table | Rôle | Lignes |
|-------|------|--------|
| `document` | Vault — fichiers joints | 15 |
| `profiles` | Auth Supabase | 1 |
| `system_log` | Journal d'audit | 3 |

---

## work_action_type — 8 types live

| id | label | field_key lié |
|----|-------|---------------|
| 1 | En cours | — |
| 5 | À expédier | — |
| 6 | Photographier | `NeedsPhotograph` |
| 7 | Encadrer | `Encadree` |
| 8 | Retoucher | — |
| 9 | Cataloguer | `Catalogué` |
| 10 | Exposer | `Exposable` |
| 31 | A monter | `Montee` |

---

## Colonnes Oeuvres — état actuel

### Actives et utilisées
`OeuvreID`, `Titre`, `statusId`, `ContactID`, `AcheteurID`, `txtImageNameLink`, `Année`, `Hauteur`, `Largeur`, `Profondeur`, `Technique`, `Support`, `Format`, `Exposable`, `Prix`, `PrixFinal`, `Discount`, `Catalogué`, `LocalisationID`, `LocalisationDetail`, `Commentaires`, `Historique`, `PresentationID`, `ReturnDate`, `DateLivraison`, `DateStatut`, `is_public`, `Encadree`, `IsCommission`, `StageProduction`, `Montee`, `anonymity_level`, `NeedsPhotograph`, `is_paid`, `is_gift`, `commercial_status`, `created_at`

### Dépréciées (lecture seule)
- `theme` (text) : remplacée par `OeuvreTheme`

### Orphelines (ne pas utiliser)
- `NomOriginal` : identique à `Titre` — non utilisé dans l'app
- `Poids` : 739 lignes, pas d'UI
- `Tirage` : réservé future fonctionnalité print-on-demand — ne pas supprimer, ne pas utiliser pour l'instant

### Droppées (ne jamais référencer)
`Statut`, `StatutID`, `tags`, `txtImageName`, `Emballage`, `DocsValidated`, `UniteDimension`

---

## Nommage des nouvelles tables

| Règle | Exemple correct | Exemple interdit |
|-------|----------------|-----------------|
| Toujours `snake_case` | `work_export` | `WorkExport`, `tblWorkExport` |
| Jamais de préfixe `tbl` | `contact_note` | `tblContactNote` |
| Jamais de majuscule | `theme_preset` | `ThemePreset` |
| Langue : anglais ou français cohérent | `suivi_process` ✓ | mix |

---

## Prévention des Défaillances Silencieuses

1. **Assertions Explicites** : après chaque action critique, pas seulement à la fin
2. **Contexte d'Erreur Riche** : logger avec entrées, environnement, étape, contexte complet
3. **Fail Fast** : échouer immédiatement sur les exceptions inattendues — ne jamais avaler les erreurs
4. **DB d'abord** : vérifier avec `execute_sql` avant tout composant UI dépendant d'une table

**Règle d'Or** : Si un processus continue après l'échec d'une étape majeure, c'est une faille de conception.

---

## Règles architecture

### DB d'abord — règle absolue
Toute table référencée dans le code doit exister en base avant le déploiement. Un composant qui écrit sans table existante échoue silencieusement côté Supabase — donnée perdue sans alerte.

### Colonnes sans UI
Toute colonne ajoutée à `Oeuvres` doit avoir un champ dans `WorkForm` ou une justification ici. Pas de colonnes "pour plus tard".

### Année
`Oeuvres.Année` est un `DATE` stocké `YYYY-01-01` par convention. Extraction via `yearOf()` dans `lib/data.ts`. Ne pas migrer en `smallint` sans vérifier tous les points de lecture.

### Geocoding
Cache Nominatim dans `WorldMapTab.tsx` : module-level `Map` + `sessionStorage` (clé `pem_geo_cache`). Ne pas ajouter d'autre mécanisme.

### Fetch côté client
- `Contact` : chargé serveur dans `page.tsx`, transmis en props → **ne pas re-fetcher**
- `contact_addresses` : fetcher une fois dans `WorldMapTab`
- `working_group` / `working_group_work` : chargés serveur, rechargeables via `handleLoadGroup`

### Statut dans les queries
```typescript
// ✅ Correct
supabase.from('Oeuvres').select('statusId')

// ❌ Interdit — colonnes droppées
supabase.from('Oeuvres').select('Statut, StatutID')
```

---

## Routes

| Route | Accès | Description |
|-------|-------|-------------|
| `/` | Public | Landing page — grille d'œuvres |
| `/portfolio` | Public | Portfolio paginé |
| `/about` | Public | Page artiste |
| `/c/[token]` | Public (token) | Partage privé via `private_link` |
| `/enquiry` | Public | Formulaire de contact |
| `/hub` | Auth | Dashboard interne |
| `/atelier` | Auth | Outil atelier complet |
| `/atelier/works` | Auth | Gestion des œuvres |
| `/atelier/vault` | Auth | Coffre (documents R2) |
| `/atelier/sales` | Auth | Commandes de vente + PDFs |
| `/atelier/portfolio` | Auth | Génération portfolio PDF |
| `/atelier/selection` | Auth | Sélections |
| `/atelier/consignments` | Auth | Ordres de consignation |
| `/atelier/exhibitions` | Auth | Expositions |
| `/galerie` | Auth | Galerie interne |
| `/collection` | Auth | Collection interne |
| `/practice` | Auth | Pratique / concepts |
| `/login` | Public | Authentification |

---

## Architecture des Pipelines (Atelier)

### ⚙️ Production
- **En production** : Public OFF. `StageProduction` suit le stade physique (wip/drying/mounting/framing…)
- **Catalogué** : `NeedsPhotograph` activé. Action "Photographier" dans `work_action` → passage auto à Disponible.
- **Disponible** : `is_public` synchro automatique via trigger selon statut.

### 🌍 Ownership & Logistique
- **Pem (Artist Atelier)** : Lieu par défaut.
- **Consignation** : via `consignment_order`. Adresse auto-dérivée du contact.
- **Vendu/Gift** : Archive. `is_paid` / `is_gift` flags sur `Oeuvres`.
- **Expédition** : via `shipment` + `shipment_work`.

### 🛡️ Condition & Archive
- **Destroyed / Lost** : statuts 9/10. Verrouille ownership.

### 💰 Financials
- `sale_order` : prix, remise, acompte, calendrier paiement, livraison, PDF (R2 vault).
- `expense` : dépenses BNC (Micro-BNC / Déclaration contrôlée France).
- `anonymity_level` : 0=public, 1=anonyme (œuvre visible, acheteur masqué), 2=privé.

---

## Bugs connus résolus

| Bug | Fichier | Fix |
|-----|---------|-----|
| Portfolio lisait `StatutID` | `app/portfolio/page.tsx` | 27/04/2026 |
| InventoryTab filtrait sur `StatutID` | `components/atelier/InventoryTab.tsx` | 27/04/2026 |
| WorldMapTab re-fetchait Contact | `components/atelier/WorldMapTab.tsx` | 27/04/2026 |
| Document PDF thumbnails (AVIF + AWS4) | `app/atelier/sales/actions.ts` | 03/05/2026 |
| Sales Tab UI squashing | `components/atelier/SalesTab.tsx` | 03/05/2026 |

---

## Bugs TS pré-existants (non bloquants)

`ExportModal.tsx` · `BatchEditModal.tsx` · `CurationDock.tsx` · `ConstellationCanvas.tsx` · `WorkForm.tsx` · `actions.ts` (works) · `WorldMapInner.tsx` ligne 138

---

## Tâches en suspens

- [ ] `Oeuvres.Poids` — 739 lignes, pas d'UI. Décider si on garde ou drop
- [ ] `Oeuvres.Tirage` — présent mais usage non clarifié dans l'app
- [ ] **PipelineTab** : Refonte complète du formulaire création/édition processus
- [ ] `Contact.IsTeamMember` vs `Contact.is_team_member` — deux colonnes pour le contrôle d'accès admin/team. Auditer les RLS policies avant de toucher.

---

## Backlog actif

### 🔴 Bugs

1. **Confusion Statut / Localisation panneau preview** : affiche "ATELIER" dans STATUT — c'est la localisation. Afficher STATUT et LOCALISATION séparément.
2. **Production tab — thumbnails manquants** : vérifier que `txtImageNameLink` est passé aux cards et que `thumbUrl` est appelé correctement.
3. **Carte (WorldMap) mode Œuvres** : popups sans thumbnail — vérifier `workThumbs` dans les pins.

### 🟠 Court terme

4. **Constellation — filtre thème** : affiche toutes les œuvres au lieu du thème sélectionné. Filtrer via `OeuvreTheme`.
5. **Constellation — "+libre"** : drag-and-drop réel, nommage groupe, sauvegarde canvas, bouton retrait.
6. **Production — étapes manuelles** : `StageProduction` existe en DB mais les étapes doivent être enregistrables manuellement, pas seulement inférées.
7. **Inventaire — utilisation espace** : drawer gauche trop vide. Ajouter localisation, commentaires, thèmes. Vue galerie : colonnes configurables.
8. **Contacts — détail** : liste des œuvres associées, historique interactions, adresses multiples visibles.
9. **Gestion des thèmes** : pas de vue CRUD dédiée pour `tblTheme`.

### 🟡 À planifier

10. **Workflow soumission** : dossier candidature → statut `suivi_process` → document vault.
11. **Assets numériques** : fichiers production (print-ready, sources) liés à `OeuvreID`, distinct de `tblImage`.
12. **`/hub` liens internes** : vérifier que les liens "← Retour" depuis `/atelier` pointent vers `/hub`.

### 🟢 Long terme

13. **Accrochage virtuel** : `exhibition_layout` existe en DB (2 entrées). UI à construire.
14. **Galeries / Expositions** : espace dédié avec œuvres, contacts, documents.

---

## Notes conceptuelles artiste

- **Étapes de production** : non-linéaires. Une œuvre peut rester en WIP des années. "Available" est une décision artistique.
- **Digital vs physique** : œuvres digitales sur HD physique → localisation "Atelier" correcte.
- **Constellation** : outil de curation visuelle, pas de saisie de données.
- **`StageProduction`** : champ technique reflétant l'état physique — distinct du statut commercial (`statusId`).
