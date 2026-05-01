# PEM Art Database — Debugging Session Rules
*Conversation: da557737 · Créé: 2026-05-01 · Langue de travail: FR/EN mixte*

---

## 0 — ARCHITECTURE RÉELLE (mémoriser)

| Couche | Technologie | Rôle |
|--------|-------------|------|
| **Base de données** | Supabase / PostgreSQL | Tables, RLS, auth, magic-link |
| **Stockage images publiques** | Cloudflare R2 (`paintings` bucket) | URLs `pub-a352e674…r2.dev` |
| **Stockage vault privé** | Cloudflare R2 (`vault` bucket) | Accès signé via S3 API |
| **Auth** | Supabase Auth | Magic-link OTP, sessions, RLS |
| **Deploy** | Vercel | Next.js 15 App Router |

> [!IMPORTANT]
> **Supabase = base de données + auth uniquement.**
> **Cloudflare R2 = tout le stockage binaire (images, vault).**
> Ne jamais écrire un nouveau chemin de stockage vers Supabase Storage. Toujours R2.

---

## 1 — AUDIT SUPABASE STORAGE : résultats

### ✅ Correctement implémentés (R2)
- `app/app/atelier/works/actions.ts` — upload R2 via S3 API ✓
- `app/app/atelier/vault/actions.ts` — vault R2 ✓
- `app/lib/data.ts` `imageUrl()` / `thumbUrl()` — R2 en priorité, Supabase Storage en fallback ✓

### ⚠️ RÉSIDUS SUPABASE STORAGE — à nettoyer
Ces mentions utilisent encore `NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET` pour construire des URLs de stockage. Elles ont une logique de fallback R2→SB mais le fallback ne devrait jamais déclencher en production :

| Fichier | Ligne | Problème |
|---------|-------|---------|
| `app/lib/data.ts` | L6–L14 | `STR` construit une URL Supabase Storage comme fallback |
| `components/atelier/WorldMapInner.tsx` | L105–L106 | Même logique fallback |
| `app/app/atelier/selection/actions.ts` | L164 | Idem |
| `app/app/atelier/vault/actions.ts` | L205 | Idem |
| `.env.local` | L18 | `NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET=paintings` encore défini |

> [!WARNING]
> `NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET` et la variable `STR` (Supabase Storage URL) ne devraient plus être utilisées. En production, `NEXT_PUBLIC_R2_PUBLIC_URL` est défini, donc le fallback ne déclenche pas — mais ces lignes mortes créent de la confusion.
> **Action : les supprimer progressivement pendant le debug, panneau par panneau.**

### ✅ Supabase correctement utilisé (base de données / auth)
Tous les fichiers qui font `createClient()` / `createServiceClient()` utilisent Supabase pour :
- Requêtes DB (`from('Oeuvres').select(...)`)
- Auth (`supabase.auth.getUser()`, `signInWithOtp`)
- RLS automatique

C'est **correct et attendu**. Supabase = DB. Ne pas toucher.

---

## 2 — VARIABLES D'ENVIRONNEMENT ACTUELLES

```
# R2 Storage (canonique)
R2_ACCOUNT_ID=d44d14dbd5c00d2875be7cf16c42f01a
R2_ACCESS_KEY_ID=fa705c6b678992132c6c7788dd2b29b0
R2_SECRET_ACCESS_KEY=b285f327517480aa05a032f676b3b011cba4405fd8d5afa9df1dfb53c0156919
R2_BUCKET=paintings
R2_VAULT_BUCKET=vault
NEXT_PUBLIC_R2_PUBLIC_URL=https://pub-a352e674a992412fa243598ffd6b659c.r2.dev

# Supabase DB + Auth (canonique)
NEXT_PUBLIC_SUPABASE_URL=https://mcrzsxrcoexnlwmaunte.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# À supprimer progressivement (résidu)
NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET=paintings
```

---

## 3 — RÈGLES DE DEBUGGING (PERMANENTES)

### R1 — DB d'abord
Avant de modifier un composant UI, vérifier que la table/colonne existe en base.
Toute requête qui échoue silencieusement (pas d'erreur visible) = signe d'un problème DB.
**Si doute sur l'intégrité de la DB → le signaler immédiatement.**

### R2 — Colonnes droppées (ne jamais référencer)
`Statut`, `StatutID`, `tags`, `txtImageName`, `Emballage`, `DocsValidated`,
`tblOeuvreImages`, `tblRelations` (uppercase R), `OeuvreRelationships`,
`tblContactAddress`, `Adresses`, `DetailAdressesContactID`

### R3 — Colonnes canoniques
- Statut : `Oeuvres.statusId` (FK → `OeuvreStatus.id`)
- Images : `tblImage` (trigger sync vers `Oeuvres.txtImageNameLink`)
- Relations : `tblrelations` (lowercase r)
- Adresses contacts : `contact_addresses`
- Thèmes : `OeuvreTheme` (junction table)

### R4 — Stockage (rule absolue)
- Images → R2 `paintings` bucket, URL via `NEXT_PUBLIC_R2_PUBLIC_URL`
- Vault → R2 `vault` bucket, URL signée via S3 API
- **Jamais d'écriture vers Supabase Storage**
- `imageUrl()` et `thumbUrl()` dans `lib/data.ts` sont les seules fonctions autorisées pour construire des URLs d'image

### R5 — Détection de boucle
Signes qu'on tourne en boucle :
- On modifie le même fichier 3 fois sans tester entre les deux
- On ajoute un fix qui annule le fix précédent
- On re-explique une règle déjà dans CLAUDE.md

→ Si boucle détectée : **stopper, relire CLAUDE.md, poser une question.**

### R6 — Efficacité
- Lire le fichier entier avant de proposer un patch
- Un patch = un problème clairement identifié
- Ne pas refactoriser hors scope du bug actuel
- Signaler si une approche plus efficace existe (ex: déplacer logique côté serveur)

### R7 — Confiance minimale
Procéder si **≥ 95% de confiance** de résoudre le bug sans casser autre chose.
En dessous : poser une question ciblée avant d'agir.

### R8 — Intégrité de la base
Si une requête retourne 0 résultats alors qu'on en attend, ou si une mutation ne persiste pas → **signaler une suspicion de problème DB** avant de continuer le debug UI.

---

## 4 — BACKLOG DE DEBUG (ordre de priorité)

### 🔴 Panel 1 — Inventaire (`components/atelier/InventoryTab.tsx`)
- [x] Filtres vérifiés : utilisent bien `statusId` — OK
- [x] Preview drawer STATUT/LOCALISATION : code correct, confusion reportée dans CLAUDE.md probablement déjà fixée en avril
- [x] Thumbnails manquants Production — fallback `onError` ajouté dans `ProductionTab.tsx`
- [x] `TeamPortalClient.tsx` fixé : props `themeWorkCount`/`groupWorkCount` rendues optionnelles (ne venaient pas de `page.tsx`)

### 🔴 Fiscal — Dépenses (`components/atelier/FiscalTab.tsx`)
- [x] Bug diagnostiqué : table `expense` manquante en DB → silent failure confirmé
- [x] Fix code : `FiscalTab.tsx` — fetch et save défensifs (error surfacé, null guard)
- [ ] **ACTION USER** : exécuter `fix_expense_and_document.sql` dans Supabase SQL Editor

### 🟠 Vault — COA et document (`components/atelier/VaultTab.tsx`)
- [x] Bug : `document.kind='coa'` viole CHECK constraint
- [x] Bug : colonnes `notes`, `file_size`, `mime_type`, `doc_date`, `cert_id`, `cert_hash` manquantes
- [ ] **ACTION USER** : même SQL que ci-dessus, déjà inclus
- [ ] R2 CORS : pas bloquant actuellement (tout R2 est server-side ou via `<img src>`)

### 🔴 Panel 2 — Contacts (`components/atelier/ContactsTab.tsx`)
- [x] Panneau détail : espace blanc → ajouter liste œuvres associées (déjà en place avec WorkMini)
- [x] Adresses multiples (`contact_addresses`) visibles dans le détail : les colonnes frontend (adresse, ville, pays) mappées sur les mauvaises colonnes (street, city, country) de la DB → corrigé
- [x] Vérifier que la sauvegarde écrit bien dans `contact_addresses` : le save de `ContactsTab` mis à jour pour utiliser les bonnes colonnes anglaises

### 🔴 Panel 3 — Constellation (`components/atelier/ConstellationCanvas.tsx`)
- [ ] Mode "theme" : filtrer par `OeuvreTheme`, pas afficher tout
- [ ] "+libre" : drag-and-drop réel
- [ ] Bouton retirer une œuvre du canvas (absent)
- [ ] Nommage de groupe, sauvegarde → `working_group`

### 🟠 Panel 4 — Production (dans InventoryTab ou séparé)
- [ ] Thumbnails manquants (`thumbUrl` → `txtImageNameLink`)
- [ ] Étapes enregistrables manuellement (pas seulement inférées)
- [ ] Trier commissions par deadline imminente

### 🟡 Résidus Supabase Storage
- [ ] Supprimer `NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET` de `.env.local`
- [ ] Nettoyer variable `STR` et fallback dans `lib/data.ts`
- [ ] Nettoyer `WorldMapInner.tsx` L105–106
- [ ] Nettoyer `selection/actions.ts` L164
- [ ] Nettoyer `vault/actions.ts` L205

---

## 5 — SOUPÇONS DB ACTUELS

Aucun soupçon actif au démarrage de la session. À remplir si un composant retourne des données inattendues.

| Date | Composant | Symptôme | Statut |
|------|-----------|---------|--------|
| 2026-05-01 | `FiscalTab` | Table `expense` absente du schema → insert échoue silencieusement | ✅ SQL correctif écrit: `fix_expense_and_document.sql` |
| 2026-05-01 | `VaultTab` COA | `document.kind='coa'` viole le CHECK constraint → insert échoue | ✅ SQL correctif écrit: `fix_expense_and_document.sql` |
| 2026-05-01 | `VaultTab` | Colonnes `notes`, `file_size`, `mime_type`, `doc_date`, `cert_id`, `cert_hash` absentes de la table `document` | ✅ SQL correctif écrit |
| 2026-05-01 | `ProductionTab` | Tables `work_action_type` + `work_action` absentes du schema → kanban vide silencieusement | ✅ SQL correctif ajouté |
| 2026-05-01 | `TeamPortalClient` | Props `themeWorkCount`/`groupWorkCount` requises mais non passées depuis `page.tsx` → TS error | ✅ Rendues optionnelles |
| 2026-05-01 | `ContactsTab` / `WorldMapTab` | La table `contact_addresses` existe avec `street, city, country` mais le frontend interrogeait `adresse, ville, pays` → 400 Bad Request silencieux | ✅ Code mis à jour avec les vraies colonnes DB |

---

## 6 — QUESTIONS OUVERTES (pour l'utilisateur)

1. **Cloudflare R2 — politiques d'accès** : Le bucket `paintings` est configuré en accès public (URL `r2.dev`). Le bucket `vault` est privé (accès signé). Est-ce que les politiques actuelles sur le dashboard Cloudflare permettent l'écriture depuis Vercel (via les clés R2 dans `.env.local`) ? Dois-je vérifier une politique CORS ou IAM spécifique ?

2. **Par quel panel veux-tu commencer ?** (Inventaire recommandé en priorité 1)

3. **Fiscal / Dépenses** : La table `expense` — sais-tu si elle a été droppée ou si elle s'appelle autrement ? Je peux vérifier en DB si tu me donnes accès à un outil `execute_sql`.
