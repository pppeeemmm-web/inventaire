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
- **Audit** : le journal du système, la validation, ce qui a été retiré du Fil, et la vérification des règles.
- **Revenir en arrière** : les versions d'une œuvre, les corbeilles, la suppression définitive.
- **Diffusion** : la file des œuvres prêtes à être publiées sur les réseaux.
- **Les comptes** : donner ou retirer l'accès à l'atelier.
- Quelques gestes réservés : déclarer une destruction, une perte ou un vol ; mettre à la corbeille une œuvre vendue ou donnée ; marquer un contact « Privé » ; modifier plusieurs œuvres d'un coup (statut, contact, prix…).

## Où sont les écrans réservés

- **À l'ordinateur** : [Audit Log](/atelier/audit) (Audit) en tête du groupe Kaizen (son badge compte les propositions en attente), suivi de [Bureau IA](/atelier/ai) ; [Diffusion](/atelier/broadcast) dans le groupe Public. Vue d'ensemble montre deux signaux de plus : **Tâches locales** et **Système**.
- **Au téléphone** : la tuile **Fil** du menu ☰ et le compteur « Fil » d'Aujourd'hui n'apparaissent qu'aux administrateurs ; « Modifier la séance » sur une journée aussi.
- **L'aide** : à l'ordinateur, le « ? » d'un écran réservé ouvre ce guide-ci.

## Ce qui ne se fait pas dans l'application

Les clés des services, les sauvegardes et les comptes de connexion se règlent hors de l'application (Vercel, GitHub, Cloudflare, Supabase). Ce guide dit où, chapitre par chapitre ; le détail technique est dans le dépôt (dossier docs).
`,
  },
  {
    id: 'admin-week',
    title: 'La semaine de l\'administrateur',
    verified: '2026-11-18',
    md: `
Une routine courte garde l'application juste. Rien ici ne presse au jour près ; ce qui reste longtemps sans réponse finit par manquer à l'équipe.

## Chaque jour, ou presque

1. **Le Fil** (téléphone : ☰ → Fil) : gardez ou retirez les lignes, idées et entrées ; validez ou refusez les propositions.
2. **Audit → Validation** si le badge d'Audit montre un chiffre : ce sont des œuvres, des photos ou des modifications que l'équipe attend.

## Une fois par semaine

1. **Vue d'ensemble** : lisez les signaux du haut. **Système** donne les erreurs des 7 derniers jours et le résultat de la dernière vérification des règles (rouge = une règle enfreinte : ouvrez Audit → Règles). **Tâches locales** donne les notes vocales à transcrire et l'âge de la dernière copie de l'archive sur le PC (rouge = plus de 14 jours sans copie).
2. **Tâches locales** : sur votre PC, « Lancer sur ce PC » transcrit les notes vocales puis indexe la recherche.
3. **Audit → Règles** → **Vérifier** : chaque règle doit répondre OK.
4. **Kaizen → Opérations & Stratégie → À valider** : les entrées en attente de votre choix.
5. **Diffusion → File** : une œuvre qui reste avec plusieurs tentatives est sans doute bloquée (voir Diffusion).
6. **Commandes** et **Logistique** : un brouillon de commande préparé par l'équipe reste dans le Fil jusqu'à sa signature ou son annulation.

## Une fois par trimestre

- **L'exercice de restauration** : vérifier qu'une sauvegarde se relit vraiment (voir Sauvegardes).
- **Les comptes** : retirez l'accès de qui ne travaille plus à l'atelier (voir Comptes et accès).

## Les courriels à ne pas ignorer

GitHub vous écrit quand une tâche de nuit échoue : la sauvegarde de la base (03:17 UTC) ou la vérification des règles (03:47 UTC). Un tel courriel demande une réponse le jour même (voir Dépannage).
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
- Valider une proposition de fiche l'applique à l'œuvre, comme Audit → Validation (voir Valider le travail de l'équipe).
- Une commande en brouillon reste dans le Fil tant qu'elle n'est ni signée ni annulée : « Garder » la laisse, « Retirer » annule le brouillon.
- Ce qui reste plus de 14 jours sans tri passe dans « Refroidies » : lisible, jamais perdu. Les propositions de fiche et les commandes en brouillon ne refroidissent jamais : elles attendent votre choix.

**Attention :** ce qui est retiré n'est pas effacé. Audit → **Retirés du Fil** le liste, et « Rappeler » le remet dans le Fil (sauf une image refusée).
`,
  },
  {
    id: 'admin-approve',
    title: 'Valider le travail de l\'équipe',
    verified: '2026-11-18',
    md: `
Ce qu'un membre de l'équipe enregistre sur une œuvre ne s'applique pas tout de suite : une nouvelle œuvre, une modification enregistrée avec **Enregistrer** sur une fiche, une photo ajoutée. Chacune devient une proposition, qui attend votre accord. Le reste de leur travail (journal, lignes de notes, constats, historique de création, contacts…) compte tout de suite.

## Où sont les propositions

- **Audit → Validation** → « Propositions en attente » : la liste complète, la plus récente en haut. Le badge d'Audit dans la barre latérale les compte.
- **Le Fil**, section Fiches : les mêmes, une par carte, à glisser.

## Lire une proposition

1. Chaque ligne dit le genre et l'œuvre : « Nouvelle œuvre : titre », « Nouvelle image : #… · titre », ou « #… · titre » pour une modification ; puis qui l'a envoyée, quand, et combien de champs changent (« champ(s) modifié(s) »).
2. ▸ ouvre le détail : champ par champ, **Avant** et **Proposé**. Pour une nouvelle image, l'image elle-même.

## Approuver

1. **Approuver**, puis confirmez (« Approuver et appliquer cette proposition ? »).

**Ensuite :**
- **Nouvelle œuvre** : l'œuvre est créée et reçoit son numéro ; si elle venait de « Réception partage », ses images s'y attachent. Les photos, le lieu, la période et la source choisis au téléphone n'ont pas suivi : la personne les ajoute maintenant.
- **Nouvelle image** : la photo rejoint la bande d'images de l'œuvre.
- **Modification** : la fiche est enregistrée comme la personne l'a envoyée, en son nom.

**Attention :**
- **Avant** montre la fiche au moment où la personne a enregistré, pas la fiche d'aujourd'hui. Approuver renvoie toute sa fiche : si vous avez modifié la même œuvre entre-temps, vos valeurs sur ces champs sont remplacées. Regardez la fiche d'abord ; au besoin, revenez à votre version (voir Revenir à une version d'une œuvre). Les lignes de l'historique, elles, ne se perdent jamais.
- Les règles de l'œuvre s'appliquent à l'approbation comme à vos propres enregistrements : une proposition qui en enfreint une est refusée avec le message de la règle (voir Dépannage).

## Rejeter

1. **Rejeter**, une raison si vous voulez (« Raison du rejet (optionnel) »), puis **Confirmer le rejet**.

**Ensuite :** rien ne change sur l'œuvre. Une image rejetée est jetée.

**Attention :** la raison est gardée avec la proposition, et son auteur la voit dans sa Vue d'ensemble, « Pour vous » : « Refusée le … », puis « Raison : … », ou « Refusée sans raison. » si vous n'en avez pas écrit. Un rejet depuis le Fil (glisser à gauche) n'a jamais de raison : si elle compte, rejetez depuis Audit → Validation.

## Les photos de séance

Plus bas dans Validation, **« Sessions terrain (photos) »** : les séances de l'équipe avec des photos à rattacher. Les photos restent dans la séance jusqu'à ce que vous les appliquiez.

1. **Appliquer** rattache les photos à l'œuvre (« Rattacher les photos de la session à cette œuvre ? »).
2. **Rejeter** demande un motif, gardé avec la séance ; il s'affiche sur la fiche de l'œuvre, partie Sessions de terrain (« Motif du refus : … », ou « Refusée sans motif. »).

## Le Kaizen

Kaizen → Opérations & Stratégie → **À valider** : des entrées reprises avec une rubrique proposée. Rien ne bouge avant votre validation (« Valider », ou « Tout valider »).

## Combien de temps tout cela reste

Une proposition en attente reste jusqu'à votre choix. Une proposition traitée (approuvée ou rejetée) est effacée de la base après 180 jours.
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

**Attention :** des photos sans œuvre liée empêchent d'appliquer ; choisissez l'œuvre d'abord.
`,
  },
  {
    id: 'admin-audit',
    title: 'Audit, onglet par onglet',
    verified: '2026-11-18',
    md: `
[Audit](/atelier/audit) (Kaizen → Audit Log ; au téléphone : ☰ → Tout le reste → Kaizen) a cinq onglets en haut : **Journal**, **Validation**, **Retirés du Fil**, **Règles**, **Corbeille**.

## Journal

Le journal du système : les 200 dernières actions enregistrées par l'application, la plus récente en haut. Colonnes : Timestamp (la date et l'heure), Event (le genre d'action), User (qui ; « Système » quand c'est l'application elle-même), Table (où), Details.

- Les pastilles du haut filtrent par genre. On y voit par exemple : PRICE CHANGE (un prix modifié), STATUS CHANGE (un statut), LOCATION MOVE (un déplacement), ORDER CREATED (une commande créée), PAYMENT GRAIN (un paiement), VAULT UPLOAD (un document ajouté au Coffre), VISIBILITY GATE (une œuvre qui devient visible ou non sur le site), ARCHIVE RUN (une copie de l'archive sur le PC), SYSTEM CONFIG (des réglages et saisies diverses : colonnes de Production, carte de visite, partage…), RUNTIME ERROR (une erreur de l'application). Seuls les genres présents dans les 200 dernières lignes ont leur pastille.
- Les simples visites d'écran n'y figurent pas.

**Faire le ménage :**
1. Cochez des lignes, ou « Tout sélectionner » (dans le filtre en cours).
2. **Supprimer (n)**, puis confirmez.

**Attention :** les lignes écrites à la main (le registre de Kaizen → Opérations & Stratégie → Système) ne sont jamais supprimées d'ici. Chaque dimanche, une tâche automatique efface aussi les lignes de plus d'un an.

## Validation

Les propositions de l'équipe et les photos de séance (voir Valider le travail de l'équipe).

## Retirés du Fil

« Tout ce qui a été retiré reste ici et peut revenir. » Colonnes : Retiré le, Type, Quoi.

1. **Rappeler** remet l'élément dans le Fil (« Rappelé : de retour dans le Fil. »).
2. Une image refusée ne peut pas revenir (« Image refusée : ne peut pas revenir »).

## Règles

Les règles d'une œuvre, vérifiées sur toute la base. Lecture seule : rien n'est modifié ici.

1. **Vérifier**.
2. La réponse : « … œuvres vérifiées · aucune règle enfreinte », ou le nombre d'écarts, avec l'heure.
3. Une ligne par règle : OK, ou le nombre d'œuvres en cause. Ouvrez la ligne : chaque œuvre s'affiche avec sa vignette et ce qui ne va pas ; un clic ouvre sa fiche.

**Ensuite :** corrigez chaque œuvre sur sa fiche, puis vérifiez à nouveau. Le détail des règles est au chapitre Les règles et les vérifications.

## Corbeille

Les œuvres mises à la corbeille, la plus récente en haut, avec leur vignette, leur numéro, leur titre et la date (« Mise à la corbeille le … »). « Restaurer » les remet dans les listes ; « Supprimer définitivement » efface la fiche (voir Supprimer : corbeilles et suppression définitive).
`,
  },
  {
    id: 'admin-versions',
    title: 'Revenir à une version d\'une œuvre',
    verified: '2026-11-18',
    md: `
Chaque fois qu'une fiche d'œuvre change, la base garde la version d'avant. Les versions se lisent et se restaurent sur la fiche, par un administrateur seulement.

## Lire les versions

1. Ouvrez la fiche → Développé → **Objet** → Historique / provenance → **Historique des données**.
2. Chaque version montre combien de champs ont changé ; ouvrez-la : **Champ**, **Précédent**, **Cette version**.

## Restaurer

**Quand :** une modification était une erreur (la vôtre, ou une proposition approuvée trop vite).

1. Sur la bonne version : **Restaurer**.
2. Confirmez (« Restaurer cette version ? Les valeurs actuelles seront remplacées (et conservées dans l'historique). »).

**Ensuite :** la fiche reprend les valeurs de cette version. Les valeurs d'avant la restauration deviennent elles-mêmes une version : on peut revenir en arrière une seconde fois.

**Attention :**
- La restauration ne touche que les champs de la fiche. Les photos, les thèmes, les groupes, les commandes et les constats ne reviennent pas.
- Ne reviennent pas non plus : ce que la base décide d'elle-même (la visibilité sur le site, la photo de couverture, le sort d'une œuvre détruite, perdue ou volée).
- L'historique (Historique / provenance) n'est jamais raccourci : la version restaurée garde toutes les lignes écrites depuis.
- Une œuvre avec un constat de destruction, de perte ou de vol encore ouvert ne se restaure pas : « Cette œuvre a un constat de destruction / perte ouvert : clore ou supprimer le constat avant de restaurer une version. »
- Les versions de plus d'un an sont effacées chaque dimanche.
`,
  },
  {
    id: 'admin-delete',
    title: 'Supprimer : corbeilles et suppression définitive',
    verified: '2026-11-18',
    md: `
L'application a deux corbeilles : celle des **œuvres**, dans la base, et celle du **stockage** (photos et fichiers, 90 jours). Seule la suppression définitive efface vraiment.

## Mettre une œuvre à la corbeille

1. Fiche → **Corbeille** → **Mettre à la corbeille…** ; ou, dans l'Inventaire, cochez des œuvres → **Supprimer**, puis confirmez.
2. Le message « Œuvre(s) placée(s) à la corbeille. Vous pouvez annuler. » offre « Annuler » pendant quelques secondes.

**Ensuite :** l'œuvre disparaît des listes, du site et de la Production ; ses étapes se mettent en pause. Toute l'équipe peut mettre une œuvre à la corbeille ; une œuvre vendue ou donnée, l'administrateur seulement.

**Attention :** passé ces quelques secondes, la fiche reste dans la base, cachée : seul un administrateur la fait revenir, depuis la corbeille des œuvres.

## La corbeille des œuvres

1. [Audit](/atelier/audit) → **Corbeille** : les œuvres mises à la corbeille, la plus récente en haut (vignette, numéro, titre, « Mise à la corbeille le … »).
2. **Restaurer** : « Œuvre #… restaurée : de retour dans les listes. »
3. Ou **Supprimer définitivement**, puis confirmez (le même message que depuis la fiche, ci-dessous). Une œuvre sur une commande, un envoi, un lien du Journal ou une déclaration de sinistre est refusée et reste dans la corbeille.

**Ensuite :** une œuvre restaurée revient dans les listes, sur le site si son statut l'y montre, et en Production ; ses étapes reprennent (sauf pour une œuvre en archive, détruite ou perdue). Elle garde son numéro, ses photos, ses thèmes et son historique.

**Attention :** la corbeille des œuvres n'a pas de durée : une œuvre y reste jusqu'à ce que vous la restauriez ou la supprimiez définitivement.

## Supprimer définitivement une œuvre

1. Fiche → **Zone admin** → **Supprimer définitivement…**
2. Confirmez : « Supprimer définitivement l'œuvre #… ? La fiche, ses thèmes et ses liens seront effacés, les photos iront à la corbeille R2 (90 j). Impossible d'annuler. »

**Ensuite :** « Œuvre supprimée définitivement. » La fiche, ses thèmes et ses liens avec d'autres œuvres sont effacés. Ses photos partent dans la corbeille du stockage.

**Attention :**
- Impossible d'annuler dans l'application, et les versions ne servent plus à rien (il n'y a plus de fiche à restaurer). Seule une sauvegarde de la base la ferait revenir (voir Sauvegardes). Préférez la corbeille, sauf pour un doublon ou une erreur de saisie.
- La suppression définitive est refusée tant que l'œuvre figure sur une commande, un envoi, un lien du Journal ou une déclaration de sinistre : « Suppression définitive refusée : l'œuvre figure sur … Rien n'a été effacé. » Dans ce cas, laissez-la à la corbeille.

## Supprimer une photo

1. Dans la bande d'images de la fiche, sur la photo : « Supprimer cette photo (admin) ».

**Ensuite :** la photo quitte l'œuvre et part dans la corbeille du stockage. Si c'était la couverture, la suivante prend sa place.

## La corbeille du stockage

- Tout fichier supprimé (photo d'œuvre, photo de constat, audio d'une note vocale, document du Coffre) est d'abord copié dans un dossier « recycle » du stockage (Cloudflare R2), à la date du jour.
- Il y reste **90 jours**, puis Cloudflare l'efface.
- Aucun écran de l'application ne la montre : retrouver un fichier se fait dans le tableau de bord Cloudflare (R2 → le dossier recycle → la date), puis on le remet à sa place. C'est un travail technique.

## Les déclarations de sort

Une destruction, une perte ou un vol ne se « suppriment » pas : on les déclare par un constat (réservé aux administrateurs), et l'œuvre reste au catalogue avec son histoire (voir le guide d'équipe, Œuvres → Faire un constat d'état). « Retrouvée » clôt une perte ou un vol.
`,
  },
  {
    id: 'admin-rules',
    title: 'Les règles d\'une œuvre et les vérifications',
    verified: '2026-11-18',
    md: `
Vos règles pour une œuvre sont écrites dans le dépôt (docs/WORK_RULES.md) et tenues, pour la plupart, par la base elle-même : chaque écran, le téléphone et les scripts les suivent. Le guide d'équipe les raconte au chapitre « Ce que l'application fait d'elle-même ».

## Les règles vérifiées

Audit → Règles, la vérification de nuit et la vérification avant chaque mise en ligne testent les mêmes règles, avec ces noms :

- **Règle 2** : Catalogué demande au moins une photo.
- **Règle 3** : Disponible demande la photo validée.
- **Règle 4** : Archive : cataloguée, tâches en pause.
- **Règle 5** : À l'atelier, le statut suit l'étape.
- **Règle 6** : Les tâches suivent l'étape.
- **Règle 7** : Une tâche cochée garde son jour.
- **Règle 8** : Fin de production seulement quand Prête.
- **Règle 9** : Propriétaire, dépositaire, adresse suivent l'étape.
- **Règle 10** : Une œuvre ne quitte Pem que par un ordre.
- **Règle 12** : Détruite / perdue : constat, tâches, ordres.
- **Règle 13** : Publique = statut public, sans sort.
- **Règle 14** : Chaque changement de statut a sa ligne datée.
- **Règle 17** : Détruite / perdue : jamais « Exposable ».

Sans vérification d'état : 1 (un retour en arrière est un mouvement), 11 (le don = statut 11, vérifié par 9 et 10), 15 (garde sur la suppression), 16 (une seule définition dans le code).

## Trois vérifications, une seule liste

1. **À la main** : Audit → Règles → **Vérifier**, quand vous voulez.
2. **Chaque nuit, à 03:47 UTC** (après la sauvegarde) : une tâche automatique passe les mêmes règles. Si l'une revient avec des œuvres, la tâche échoue et GitHub vous écrit ; Vue d'ensemble → **Système** montre le résultat (« règles : OK », « n écart(s) », ou « à vérifier (Audit) » quand aucune vérification n'est enregistrée).
3. **Avant chaque mise en ligne** : la session de développement lance les vérifications de données (règles des œuvres, plus la cohérence des commandes, des paiements et des envois). Elles avertissent sans bloquer.

Aucune de ces vérifications ne modifie quoi que ce soit.

## Quand une règle est enfreinte

1. Audit → Règles → **Vérifier** pour voir les œuvres en cause.
2. Ouvrez chaque œuvre et corrigez-la sur sa fiche ou par sa commande. La raison est écrite à côté de chaque œuvre (par exemple « cataloguée, aucune photo »).
3. Vérifiez à nouveau.

**Attention :** un écart qui revient sans qu'on y touche vient d'un chemin qui contourne une règle ; signalez-le dans Kaizen avec le numéro de l'œuvre, pour qu'une session de développement le ferme dans la base.
`,
  },
  {
    id: 'admin-privacy',
    title: 'Contacts : confidentialité et fusion',
    verified: '2026-11-18',
    md: `
Deux réglages de confidentialité différents existent : l'un sur la **fiche d'une œuvre**, l'autre sur la **fiche d'un contact**.

## Sur la fiche d'une œuvre : « Confidentialité du contact »

Fiche → Développé → **Objet** → **Confidentialité du contact** : « Comment le nom du propriétaire s'affiche (public, masqué, confidentiel). » Trois niveaux :

- **Public** : « Contact visible publiquement ».
- **Masqué** : « Contact masqué — nom seul visible admin ».
- **Privé** : « Contact confidentiel — admin seulement ». La fiche affiche « CONFIDENTIEL ».

**Ce que le niveau Privé change aujourd'hui :** les exports et les PDF de sélection marquent l'œuvre « ⚠ NON PUBLIC », l'export prévient avant, et la Constellation et les expositions la signalent. Le niveau se change comme le reste de la fiche (une proposition, pour l'équipe).

## Sur la fiche d'un contact : « Privé »

1. Business → Contacts → le contact → **Privé** : « Contact privé (visible uniquement par l'admin) ». La case n'apparaît qu'aux administrateurs.
2. Les contacts importés par « Google CSV » ou « URL » arrivent déjà marqués Privé.

**Attention :** aujourd'hui, la case marque le contact ; elle ne le cache pas encore à l'équipe, qui le voit dans Contacts et dans les listes. Ne comptez pas sur elle pour garder un contact secret. Donner l'accès à l'atelier à un contact retire la marque Privé.

## Fusionner deux contacts

**Quand :** la même personne existe deux fois (un import, une carte de visite, une faute de frappe).

1. Business → Contacts : cochez les deux contacts.
2. **Fusionner** (dans la barre qui apparaît).
3. « Fusionner deux contacts » : choisissez celui à **conserver**.
4. **Fusionner**.

**Ensuite :** « Contacts fusionnés. » L'autre contact est supprimé, après le transfert de ses œuvres, commandes et documents ; ses champs remplissent les champs vides du contact conservé.

**Attention :** la fusion ne s'annule pas. Toute l'équipe peut fusionner. Un contact qui a l'accès à l'atelier garde son compte : si les deux en ont un, l'application refuse et le dit.
`,
  },
  {
    id: 'admin-accounts',
    title: 'Comptes et accès',
    verified: '2026-11-18',
    md: `
Chaque personne de l'atelier a un compte de connexion, relié à sa fiche de contact. Il n'y a pas d'inscription publique : c'est vous qui donnez l'accès.

## Donner l'accès à quelqu'un

1. Business → Contacts : ouvrez (ou créez) la fiche de la personne, avec son e-mail dans la partie E-mails, puis enregistrez.
2. La partie **Accès atelier** (administrateurs seulement) : si la personne s'est déjà connectée une fois (par exemple avec Google), son compte existe : **Connecter l'accès atelier**. Sinon : **Envoyer une invitation (nouveau compte)** ; elle reçoit un e-mail pour choisir son mot de passe.
3. Vérifiez que **Membre équipe** est coché (« Autorise la connexion à l'atelier (avec compte lié) ») et que « Compte lié » s'affiche.

**Ensuite :** « Accès atelier connecté. » La personne se connecte sur www.thepemworkshop.com/login et voit l'Atelier comme membre de l'équipe : ses œuvres, modifications et photos vous arrivent en validation.

**Attention :**
- Un compte = une fiche. « Ce login est déjà lié à la fiche #… » : ouvrez l'autre fiche, ou fusionnez les deux contacts.
- « Ajoutez un e-mail avant d'inviter. » : l'invitation part à l'e-mail de la fiche.

## Retirer l'accès

1. La fiche de la personne → **Accès atelier** → décochez **Membre équipe**.

**Ensuite :** elle n'a plus accès à l'Atelier ni au téléphone. Son compte de connexion existe toujours ; le supprimer pour de bon se fait dans Supabase (Authentication), un travail technique.

## Administrateur

Le rôle d'administrateur est une case de la fiche de contact, sans bouton dans l'application : il se donne ou se retire dans la base (une session de développement). Gardez le moins d'administrateurs possible.

## Mot de passe et réglages personnels

- **Changer le mot de passe** et **Se déconnecter** : dans l'en-tête à l'ordinateur, en bas du menu ☰ au téléphone. Un compte Google seul n'a pas de mot de passe à changer.
- Mot de passe perdu : « Mot de passe oublié ? » sur la page de connexion.
- **FR / EN** et le soleil ☀ (thème clair ou sombre) : dans l'en-tête.

## Il n'y a pas d'écran « Réglages »

Ce qui se règle hors de l'application :

- **Vercel** (l'hébergement du site) : les clés des services (IA, Diffusion…), dans Settings → Environment Variables.
- **GitHub** (le code) : les tâches de nuit et leurs secrets (sauvegarde, vérification des règles).
- **Cloudflare R2** : le stockage des photos, des documents et des sauvegardes, et la corbeille du stockage.
- **Supabase** : la base de données et les comptes de connexion.

Changer l'un d'eux est un travail technique : demandez-le à une session de développement.
`,
  },
  {
    id: 'admin-broadcast',
    title: 'Diffusion',
    verified: '2026-11-18',
    md: `
[Diffusion](/atelier/broadcast) (Public → Diffusion) suit la publication des œuvres sur les réseaux. La publication elle-même est faite hors de l'application, par un scénario Make.com (Make → Buffer → Slack) qui lit la file de l'application.

## Comment une œuvre part

1. Sur la fiche : Objet → **Présentation** → **Prêt pour diffusion** (« Prête pour une publication (Diffusion) : photo validée, texte de légende relu. »), et si vous voulez une **Note de diffusion** : « Une phrase, un souvenir, un repère — destiné au passage IA en aval. Pas un argumentaire de vente. »
2. Ou, dans l'Inventaire, la colonne **Diffusion** coche plusieurs œuvres d'un coup.
3. L'œuvre est proposée à Make quand elle est publique, qu'elle a une image de couverture, qu'elle n'est pas à la corbeille, et que « Prêt pour diffusion » est coché.
4. Make prend l'œuvre (elle passe dans la **File**), écrit la légende avec son IA à partir du titre, de la technique, des dimensions et de votre note, et prépare la publication dans Buffer. Une œuvre déjà en File n'est plus proposée.
5. Une fois publiée, Make le dit à l'application : l'œuvre passe dans **Publiés**.

## Les trois onglets

- **File** : les œuvres prises par Make et pas encore publiées, avec la date de mise en file et le nombre de tentatives.
- **Publiés** : l'historique, avec la date ; « Voir » ouvre la publication.
- **Activité** : les événements remontés par Make (Tout ou VIP).

**Attention :**
- Une œuvre qui reste dans la File avec plusieurs tentatives est bloquée : **Libérer** (« Libérer cette mise en file ? ») la rend de nouveau disponible pour Make.
- Si rien ne bouge du tout, le scénario Make est arrêté ou sa clé ne correspond plus : c'est à vérifier dans Make, pas dans l'application.
- Ce qui part chez Make : le titre, l'année, la technique, le support, les dimensions, l'image et la note de diffusion. Jamais un prix ni un contact.
- Les événements d'Activité de plus de 180 jours sont effacés chaque dimanche, sauf les erreurs.
`,
  },
  {
    id: 'admin-ai',
    title: 'Bureau IA : les moteurs et les travaux locaux',
    verified: '2026-11-18',
    md: `
Le site public n'utilise aucune IA. Dans l'Atelier, l'IA est facultative et **locale** : tout tourne sur votre PC, rien n'est envoyé à un service d'IA extérieur. Quand le PC est éteint, la fonction fait moins, rien ne casse.

## Où voir ce qui attend

[Bureau IA](/atelier/ai) (Kaizen, à côté d'Audit ; au téléphone : ☰ → Kaizen → Bureau IA) montre :

- **Les moteurs**, tels que le serveur du site les voit : l'agent du PC (« vu il y a n min » et ses modèles), une clé OpenAI posée ou non sur ce serveur (oui / non), le moteur qui lit une photo de carte et nettoie le texte des cartes et des pages web, les modèles Ollama. Sur le site en ligne, Ollama est toujours hors d'atteinte (le serveur ne voit pas votre PC) : c'est normal.
- **Ce qui attend** : les notes vocales à transcrire (Whisper), les éléments à indexer pour la recherche, les œuvres dont l'image n'est pas encore décrite (gemma3:4b), les cartes de visite gardées avec leur photo (on n'enregistre pas encore si leur passe IA a eu lieu ; la phase 3 les lira et proposera les champs, à accepter ou refuser).
- **Les derniers travaux** : en attente, en cours, terminés ou échoués ; un échec montre son journal.

Vue d'ensemble → **Tâches locales** reste un coup d'œil rapide (notes vocales, indexation, âge de l'archive).

## Qui fait quoi

- **La recherche par le sens (⌘K) et les suggestions ✦ du Journal** : nomic-embed-text transforme les textes en repères, gardés dans la base. Sur le site en ligne, une phrase nouvelle se cherche en texte simple.
- **Les notes vocales** : au téléphone, le navigateur écrit les mots pendant qu'on parle (Safari → Apple, Chrome → Google) ; la transcription complète est faite sur votre PC par faster-whisper large-v3.
- **La description des images** : gemma3:4b décrit les images des œuvres.
- **La carte de visite et l'adresse web** : le texte est lu sans IA (Live Text sur l'iPhone, lecture de la page) ; llama3.2:1b peut ensuite nettoyer le texte, mais seulement quand l'application tourne sur votre PC : sur le site en ligne, « Améliorer avec l'IA » n'a pas d'IA tant que la phase 3 (la carte lue par l'agent du PC) n'est pas faite.
- **Les légendes de Diffusion** : l'IA de Make.com (OpenAI ou Anthropic), hors de l'application.

## Lancer les travaux

1. Dans [Bureau IA](/atelier/ai), cliquez **Lancer** sur la file voulue : le travail est mis en attente.
2. L'**agent du PC** le prend dans les 15 secondes, un travail à la fois (la carte graphique ne peut pas tenir Whisper et les modèles Ollama ensemble).
3. « ou à la main » affiche la commande à lancer vous-même.

**Première installation, une fois** : sur le PC, lancez pwsh scripts/register-ai-agent.ps1. L'agent (npm run ai:agent) démarre ensuite avec Windows.

**Attention :** si l'agent est éteint (« vu il y a » très ancien), les travaux restent en attente jusqu'à son retour.

## Local seulement

- L'agent utilise la clé de service du fichier .env.local de votre PC ; gardez ce fichier privé.
- Rien ne part vers un service d'IA extérieur.
- Si une clé OPENAI_API_KEY est encore posée sur Vercel, le site en ligne enverrait encore les photos de carte à OpenAI. Supprimez-la : Vercel → le projet → Settings → Environment Variables. La ligne « Clé OpenAI sur ce serveur » de Bureau IA doit alors dire « non ».
- Les autres réglages (CONTACT_CARD_VISION, CONTACT_ENRICH_LLM) sont inutiles sans clé OpenAI. INVENTORY_BROADCAST_SECRET reste : c'est la clé que Make présente pour lire la file de Diffusion ; la même valeur dans Make.

## Ce qui sort de vos machines

- Vers **Make.com** et son IA : les titres, techniques, dimensions et notes de diffusion des œuvres « Prêt pour diffusion ».
- Tout ce que font Ollama et Whisper reste sur votre PC.
`,
  },
  {
    id: 'admin-backups',
    title: 'Sauvegardes et exercice de restauration',
    verified: '2026-11-18',
    md: `
## Ce qui est sauvegardé, et quand

- **La base de données**, chaque nuit à 03:17 UTC : une copie complète (toutes les tables) part dans un espace de stockage séparé (Cloudflare R2, dossier daily). Une tâche GitHub s'en charge ; si elle échoue, GitHub vous écrit.
- **Les liens du catalogue**, chaque dimanche à 04:30 UTC : deux fichiers CSV lisibles dans un tableur, même sans l'application (dossier weekly).
- **L'archive sur le PC** : une copie lisible de tout (images, Coffre, une page index.html qui s'ouvre sans application ni réseau, les tableaux, le Journal) dans le dossier PEM-Archive de votre PC. Elle se fait chaque dimanche à 10:00 si la tâche Windows est installée, ou à la main. Vue d'ensemble → Tâches locales montre son âge ; rouge après 14 jours.
- **Les photos et fichiers supprimés** restent 90 jours dans la corbeille du stockage.

**Attention :** l'archive contient les prix, les notes et les contacts : gardez le dossier privé. Une copie sur un second disque, ou chez une personne de confiance, reste à faire à la main.

## Ce que chaque copie permet

- La copie de nuit de la base : **restaurer** la base entière, ou retrouver une seule ligne effacée par erreur.
- Les CSV du dimanche : lire les liens du catalogue quand l'application est indisponible.
- L'archive du PC : lire et transmettre ; elle ne restaure pas la base, mais ses images sont celles qu'une restauration remettrait en ligne.

## L'exercice de restauration

Une sauvegarde qu'on n'a jamais relue n'est qu'un espoir. Une fois par trimestre, vérifiez qu'une copie de nuit se relit.

1. Demandez-le à une session de développement : « exercice de restauration, docs/BACKUP_RECOVERY.md ».
2. Elle télécharge la dernière copie depuis Cloudflare R2 et la charge dans une base **neuve et jetable** (jamais dans la base réelle).
3. Elle compte les lignes des tables principales (œuvres, contacts, propositions, versions) et vous donne les chiffres.
4. Comparez-les aux nombres de l'application (par exemple le nombre d'œuvres de l'Inventaire).
5. La base jetable est ensuite supprimée.

**Ensuite :** notez la date de l'exercice dans Kaizen. Si la copie ne se relit pas, c'est urgent : la sauvegarde de nuit ne sert à rien tant que ce n'est pas réglé.

## En cas de vrai accident

- **Une ligne ou une fiche effacée par erreur** : une session de développement la retrouve dans la copie de la nuit d'avant et la remet, sans toucher au reste.
- **Une modification de fiche à défaire** : pas besoin de sauvegarde, utilisez les versions (voir Revenir à une version d'une œuvre).
- **Une photo supprimée** : moins de 90 jours, elle est dans la corbeille du stockage (voir Supprimer).
- **La base entière** : restaurer toute la base efface ce qui a été fait depuis la copie. C'est votre décision, jamais celle d'une session seule.
`,
  },
  {
    id: 'admin-trouble',
    title: 'Dépannage',
    verified: '2026-11-18',
    md: `
Les messages ci-dessous sont ceux de l'application, mot pour mot.

## Une œuvre refuse un statut

- « Une œuvre ne peut pas être cataloguée sans photographie. » : ajoutez une photo d'abord.
- « Décochez "Photo requise" pour confirmer la validation photo avant de passer en Disponible. » : validez la photo (✓ dans Production → Photographie), le statut suit.
- « Archive : cataloguez d'abord l'œuvre (une fiche partielle suffit). »
- « Sortie d'archive vers Disponible : la photo doit être faite. Sinon, repassez l'œuvre en production. »
- « Une œuvre ne quitte l'atelier que par une commande (dépôt, prêt, vente) » : passez par Commandes ; la fiche suivra.
- « Vendu / don : choisir l'acquéreur (pas Pem). Consigné / prêt : choisir le dépositaire (pas Pem). »
- « Œuvre hors circulation (vendue, donnée, archivée, détruite, perdue ou déjà en dépôt) » : elle ne peut pas être réservée, vendue ou déposée.

Ces refus viennent des règles de la base : une approbation d'une proposition de l'équipe les reçoit aussi.

## Une œuvre n'apparaît pas sur le site

1. Son statut est-il public (Disponible, Réservé, Vendu, Consigné, Prêt, Don) et sans destruction, perte ni vol ?
2. Est-elle à la corbeille ?
3. Audit → Règles → **Vérifier** : la règle 13 (Publique = statut public, sans sort) doit dire OK.

## Le signal Système est rouge

1. Audit → Règles → **Vérifier**, puis corrigez les œuvres listées (voir Les règles d'une œuvre et les vérifications).
2. Des erreurs seulement (orange) : Audit → Journal, pastille RUNTIME ERROR. Une erreur qui se répète, signalez-la dans Kaizen avec l'heure.

## Les Tâches locales sont rouges

- L'archive a plus de 14 jours : lancez la copie sur votre PC (ou vérifiez la tâche du dimanche).
- Des notes vocales attendent : **Lancer sur ce PC**.

## GitHub a écrit qu'une tâche de nuit a échoué

- **Daily Supabase backup** : la copie de la nuit n'existe pas. Relancez-la (GitHub → Actions → la tâche → Run workflow) ou demandez-le à une session de développement, le jour même.
- **Nightly work rule checks** : une règle a des œuvres en cause. Audit → Règles.

## Une personne ne peut pas se connecter

1. Sa fiche de contact → **Accès atelier** : « Membre équipe » coché, « Compte lié » affiché ?
2. Mot de passe oublié : « Mot de passe oublié ? » sur la page de connexion.
3. Elle s'est connectée avec Google sous une autre adresse : connectez l'accès avec cette adresse.

## Restaurer une version est refusé

« Cette œuvre a un constat de destruction / perte ouvert » : clôturez le constat (« Retrouvée ») ou supprimez-le, puis restaurez.

## « Améliorer avec l'IA » ne répond pas

Normal hors de votre PC sans clé OpenAI : « Analyser » suffit (voir Les moteurs d'IA et leurs clés).

## Modifier plusieurs œuvres d'un coup est refusé à l'équipe

« Modifier statut, contact, prix… sur plusieurs œuvres est réservé aux admins. » Les thèmes et les groupes restent modifiables par l'équipe ; le reste passe par la fiche, donc par votre validation.

## Rien ne correspond à ce guide

L'écran a raison. Signalez l'écart dans Kaizen → Opérations & Stratégie (+ Nouvelle entrée) : le guide sera corrigé.
`,
  },
]
