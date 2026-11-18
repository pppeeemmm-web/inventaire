import type { AideChapter } from './types'

/** Guide admin — français. Same chapters, same order as `admin.en.ts`. Only what an admin does beyond the team guide. */
export const ADMIN_FR: AideChapter[] = [
  {
    id: 'admin-scope',
    title: 'Ce guide',
    verified: '2026-11-18',
    md: `
Ce guide ne couvre que ce qui est réservé aux administrateurs. Pour tout le reste (œuvres, journal, commandes…), le guide d'équipe vaut aussi pour vous.

## Ce que l'administrateur a en plus

- **Le Fil** : tout ce que l'équipe ajoute arrive chez vous à trier.
- **La validation** : les nouvelles œuvres, les modifications de fiches et les photos proposées par l'équipe attendent votre accord.
- **Les séances de terrain** : capturer et appliquer les photos d'une séance.
- **Revenir en arrière** : historique des versions d'une œuvre, journal d'audit, vérification des règles, suppressions définitives.
- **Diffusion** : la file des œuvres prêtes à être publiées sur les réseaux.
- Quelques gestes réservés : déclarer une destruction, une perte ou un vol ; mettre à la corbeille une œuvre vendue ou donnée ; voir les contacts privés.

Au téléphone, la tuile **Fil** du menu ☰ et le compteur « Fil » d'Aujourd'hui n'apparaissent qu'aux administrateurs. À l'ordinateur, **Audit** ouvre le groupe Kaizen et Diffusion est dans Public.
`,
  },
  {
    id: 'admin-fil',
    title: 'Le Fil',
    verified: '2026-11-18',
    md: `
Le Fil rassemble ce que les autres ont ajouté et que vous n'avez pas encore vu.

## Trois sections

- **Création** : les lignes écrites dans les notes d'une œuvre, les lignes ajoutées à une idée, les idées proposées.
- **Fiches** : une fiche modifiée, une nouvelle œuvre ou une nouvelle image proposées, une commande préparée en brouillon.
- **Kaizen** : les entrées ajoutées au Kaizen.

## Trier

1. Ouvrez le Fil (☰ → Fil, ou le compteur « Fil » sur Aujourd'hui).
2. Glissez une carte vers la droite pour **garder** (ou **Valider** une proposition), vers la gauche pour **retirer** (ou **Refuser**).
3. Vous avez 6 secondes pour « Annuler ».

**Ensuite :**
- Valider une proposition de fiche l'applique à l'œuvre, comme dans Audit → Validation.
- Une commande en brouillon reste dans le Fil tant qu'elle n'est ni signée ni annulée : « Garder » la laisse, « Retirer » annule le brouillon.
- Ce qui reste plus de 14 jours sans tri passe dans « Refroidies » : lisible, jamais perdu.

**Attention :** ce qui est retiré n'est pas effacé. Audit → **Retirés du Fil** le liste, et « Rappeler » le remet dans le Fil (sauf une image refusée).
`,
  },
  {
    id: 'admin-approve',
    title: 'Valider le travail de l\'équipe',
    verified: '2026-11-18',
    md: `
## Les propositions

1. Audit → **Validation** → « Propositions en attente » (ou le Fil, section Fiches).
2. Chaque proposition montre le genre (nouvelle œuvre, nouvelle image, modification) et, champ par champ, **Avant** et **Proposé**.
3. **Approuver** applique la proposition ; **Rejeter** la refuse, avec une raison si vous voulez.

## Les photos de séance

« Sessions terrain (photos) », dans la même vue : les séances de l'équipe avec des photos à rattacher. **Appliquer** les met sur l'œuvre ; **Rejeter** demande un motif, visible dans la séance.

## Le Kaizen

Kaizen → Opérations & Stratégie → **À valider** : des entrées reprises avec une rubrique proposée. Rien ne bouge avant votre validation (« Valider », ou « Tout valider »).
`,
  },
  {
    id: 'admin-session',
    title: 'Les séances de terrain',
    verified: '2026-11-18',
    md: `
Une séance de terrain garde les photos d'une séance de travail et les rattache aux œuvres.

## Capturer une séance au téléphone

1. Barre du bas → **Œuvre** → **Photos de la séance**.
2. « Ajouter peinture », puis les photos : « Prendre une photo » ou « Choisir dans la galerie », puis « Envoyer ».
3. Choisissez **Nouvelle œuvre** (un titre est obligatoire) ou **Œuvre existante** (son numéro), puis « Enregistrer l'association ».
4. **Appliquer à l'œuvre**.
5. Si vous voulez : « Enregistrer lieu et météo », et des notes terrain.

**Ensuite :** les photos sont sur l'œuvre ; vous pouvez ajouter une autre peinture à la même séance. La séance apparaît dans le Journal du jour ; « Modifier la séance » y est réservé aux administrateurs.

**Attention :** des photos sans œuvre liée bloquent l'application ; choisissez l'œuvre d'abord.
`,
  },
  {
    id: 'admin-undo',
    title: 'Corriger et revenir en arrière',
    verified: '2026-11-18',
    md: `
## Revenir à une version d'une œuvre

Chaque modification d'une œuvre garde l'ancienne version.

1. Fiche → Développé → **Objet** → Historique / provenance → **Historique des données**.
2. Chaque version montre ce qui a changé (Précédent / Cette version).
3. **Restaurer** remet cette version ; les valeurs actuelles restent dans l'historique.

## Le journal d'audit

Audit → **Journal** liste les actions du système. Vous pouvez sélectionner des entrées et les supprimer ; le registre manuel (Système) n'est pas touché.

## Vérifier les règles

Audit → **Règles** → « Vérifier » passe les règles d'une œuvre (voir « Ce que l'application fait d'elle-même » dans le guide d'équipe) sur toute la base. Lecture seule : chaque règle doit revenir vide ; sinon, les œuvres en cause sont listées.

## Supprimer

- **Une photo** : dans la bande d'images de la fiche, « Supprimer cette photo (admin) ». Elle part dans la corbeille de stockage (90 jours).
- **Une œuvre** : « Mettre à la corbeille… » (tout le monde ; annulable quelques secondes ; une œuvre vendue ou donnée : administrateur seulement). **Supprimer définitivement…** (administrateur) efface la fiche, ses thèmes et ses liens ; les photos vont dans la corbeille de stockage (90 jours). Impossible d'annuler.
- **Une destruction, une perte, un vol** : un constat de ce type, réservé aux administrateurs (voir Œuvres → Faire un constat d'état).
`,
  },
  {
    id: 'admin-broadcast',
    title: 'Diffusion',
    verified: '2026-11-18',
    md: `
Diffusion (Public → Diffusion) suit la publication des œuvres sur les réseaux, faite par un outil extérieur (Make / n8n).

## Quelles œuvres partent

Une œuvre entre dans la file quand elle est publique, qu'elle a une image de couverture, qu'elle n'est pas à la corbeille, et que « Prêt pour diffusion » est coché sur sa fiche (Objet → Présentation).

## Les trois onglets

- **File** : les œuvres en attente de publication, avec le nombre de tentatives.
- **Publiés** : l'historique ; « Voir » ouvre la publication.
- **Activité** : les événements remontés par l'outil de publication (Tout ou VIP).

**Attention :** une œuvre bloquée dans la file se débloque avec **Libérer**.
`,
  },
  {
    id: 'admin-privacy',
    title: 'Confidentialité des contacts',
    verified: '2026-11-18',
    md: `
Sur la fiche d'une œuvre (Objet → **Confidentialité du contact**), trois niveaux disent qui peut voir le contact lié :

- **Public** : « Contact visible publiquement ».
- **Masqué** : « Contact masqué — nom seul visible admin ».
- **Privé** : « Contact confidentiel — admin seulement ».

**Attention :** un contact privé n'est visible que des administrateurs ; la fiche l'indique par « CONFIDENTIEL ».
`,
  },
  {
    id: 'admin-backups',
    title: 'Sauvegardes',
    verified: '2026-11-18',
    md: `
- Chaque nuit à 03:17 UTC, une copie complète de la base part dans un espace de stockage séparé (Cloudflare R2).
- Les photos et fichiers supprimés restent 90 jours dans la corbeille de stockage avant d'être effacés.
- Restaurer une sauvegarde est un travail technique : la marche à suivre est dans le dépôt, docs/BACKUP_RECOVERY.md. Un exercice de restauration est prévu (liste des tâches).
`,
  },
]
