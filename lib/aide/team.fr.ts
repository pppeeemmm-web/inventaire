import type { AideChapter } from './types'

/** Guide d'équipe — français. Same chapters, same order as `team.en.ts`. */
export const TEAM_FR: AideChapter[] = [
  {
    id: 'scope',
    title: 'Le projet et son périmètre',
    verified: '2026-11-18',
    md: `
## À quoi sert l'application

PEM Studio est l'outil de travail de l'atelier de Pem. Elle garde la trace de l'œuvre sous toutes ses formes : les peintures, les écrits, tout ce qui touche à son regard sur le monde. Le but : transmettre, créer des liens entre les choses, et donner sa valeur à l'œuvre.

> « J'espère que quelqu'un, maintenant ou plus tard, pourra tirer de ma peinture de la joie, de l'émotion, du mystère : quelque chose qui crée une vraie valeur pour d'autres humains. » Pem (traduit de l'anglais)

## Les quatre buts, dans l'ordre

1. **Trace** : rien ne se perd. On saisit vite, au téléphone, sur le terrain.
2. **Liens et cartographie** : la recherche, les suggestions, le journal relié aux œuvres, la Constellation, la carte.
3. **Transmission** : le site public, les portfolios, la diffusion ; et une archive lisible même sans l'application.
4. **Valeur** : ce que l'œuvre apporte aux autres. La provenance, les constats d'état et les certificats la soutiennent.

Quand vous hésitez sur ce qu'il faut saisir ou sur ce qu'il faut demander, ces buts tranchent, dans cet ordre.

## Ce que couvre l'application

- **Le catalogue** : chaque œuvre, ses photos, ses dimensions, son état, son histoire, qui la possède, qui la détient et où elle se trouve.
- **La production** : les œuvres en cours, jusqu'au catalogue.
- **Le terrain** : la journée (Aujourd'hui), le journal, les notes vocales, les séances de travail photographiées.
- **Les idées** : projets et concepts.
- **Le commercial** : les commandes (vente, don, prêt, dépôt), les envois, les contacts, les revenus et dépenses, le Coffre (documents).
- **Le public** : le site www.thepemworkshop.com, les portfolios PDF, les statistiques de visite.

Les outils commerciaux restent simples : ils ne grandissent que lorsqu'un vrai cas le demande.

## Qui l'utilise

- Pem (administrateur) et l'équipe de l'atelier, chacun avec son propre compte. Il n'y a pas d'inscription publique : l'atelier crée les comptes.
- **Le téléphone sert au terrain** : saisir, corriger, faire avancer. **L'ordinateur sert au travail de fond** : le catalogue, les tableaux, le commercial.
- Un membre de l'équipe voit presque tout. Seul l'administrateur (Pem) enregistre directement une nouvelle œuvre, une modification de fiche ou une photo ; celles de l'équipe attendent sa validation (voir Premiers pas → Ce qui attend la validation de Pem). Quelques écrans sont réservés aux administrateurs.

## Ce que l'application ne fait pas

- Elle ne retouche pas les photos. Les photos du catalogue se préparent dans Lightroom, puis on les ajoute à l'œuvre (voir Œuvres → Ajouter des photos).
- Il n'y a pas d'inscription publique ni de compte visiteur : l'équipe se connecte avec les comptes créés par l'atelier.
`,
  },
  {
    id: 'start',
    title: 'Premiers pas',
    verified: '2026-11-18',
    md: `
## Se connecter

1. Ouvrez www.thepemworkshop.com/login.
2. Entrez votre e-mail et votre mot de passe, ou utilisez le bouton Google.
3. Mot de passe perdu : « Mot de passe oublié ? » sur la même page envoie un lien par e-mail.

Pour changer de mot de passe ou vous déconnecter : en bas du menu ☰ sur le téléphone, dans l'en-tête sur l'ordinateur.

## Installer l'application sur le téléphone

- **iPhone** : ouvrez le site dans Safari, touchez Partager, puis « Sur l'écran d'accueil ».
- **Android** : ouvrez le site dans Chrome, menu ⋮, puis « Installer l'application » ou « Ajouter à l'écran d'accueil ».

L'icône ouvre directement **Aujourd'hui**. Sur Android, l'application installée apparaît aussi dans le menu Partager du téléphone ; sur iPhone, non (voir Œuvres → Ajouter des photos).

## Au téléphone : Aujourd'hui

Aujourd'hui est l'écran d'accueil : la journée. On y voit ce qui a été fait, les œuvres du jour, les écrits et les notes, et « À revoir ».

- ‹ › passe au jour d'avant ou d'après.
- 📅 ouvre la liste des jours (le Journal).
- La barre du bas saisit en un geste : **Écrire** · **Vocal** · **Œuvre** · **Photo · doc**.

## Au téléphone : le menu ☰

☰ ouvre le menu par-dessus la page, sur tous les écrans.

- **En haut, la recherche** : tapez #1234 ou un morceau de titre, la fiche de l'œuvre s'ouvre.
- **Les tuiles**, avec leurs compteurs : Aujourd'hui, Œuvres, Production, Idées, Commandes, Logistique, Événements, Journal. Les administrateurs voient aussi le Fil.
- **« ? Aide pour cet écran »** : le chapitre de ce guide qui parle de l'écran ouvert sous le menu.
- **« Tout le reste »** (replié) : tous les autres écrans.
- **« Actions »** (replié) : Vente, Contact (carte de visite), Document, Problème, Pipeline, Triage.
- **En bas** : votre compte, la langue (FR / EN), la déconnexion.

Sur les autres écrans, la pastille « Aujourd'hui » en haut à droite vous ramène à la journée.

## Ce qui attend la validation de Pem

Pem (l'administrateur) enregistre tout directement. Pour un membre de l'équipe, l'application fait deux parts.

**Attend la validation** (le message « Envoyé pour validation par l'administrateur » le dit) :
- une nouvelle œuvre, au téléphone ou à l'ordinateur ;
- une modification de la fiche enregistrée avec **Enregistrer** (titre, statut, dimensions, propriétaire, thèmes, groupes…) ;
- une photo ajoutée à une œuvre, y compris celle d'une reprise ou d'un partage (« Photos en attente de validation »).

Tant que Pem n'a pas validé, rien ne change sur l'œuvre. Pem peut aussi refuser.

**Compte tout de suite :**
- les lignes de « Commentaires & notes », les écrits et les notes vocales du Journal ;
- la période, la source et l'historique de création d'une œuvre, dont la ligne « Reprise » ;
- les constats d'état (voir Œuvres → Faire un constat d'état) ;
- les idées proposées, les lignes de discussion, les contacts, les fournitures.

## À l'ordinateur : la barre latérale

Les écrans sont rangés en groupes :

- **Kaizen** : Opérations & Stratégie, et cette Aide.
- **Catalogue** : Inventaire, Rapports, Thèmes / Groupes, Constellation, Chronologie, Diaporamas.
- **Terrain** : Production, Journal.
- **Studio** : Vue d'ensemble, Suivi, Expositions, Idées, Fournitures.
- **Business** : Commandes, Contacts, Carte, Logistique, Revenus & Dépenses, Coffre.
- **Public** : Site public, Portfolio, Analytiques.

Partout :

- **⌘K** (Mac) ou **Ctrl+K** (PC) ouvre la recherche : une œuvre, un écran, une action.
- Un clic sur une œuvre ouvre sa fiche sur le côté.
- **?** dans l'en-tête (ou la touche **?**) ouvre l'aide de l'écran où vous êtes, par-dessus la page, avec une recherche. Échap la ferme.
- Les boutons **FR / EN** de l'en-tête changent la langue.

## Ce guide

- Chaque chapitre porte la date du jour où il a été vérifié dans l'application. Si l'écran ne correspond plus au guide, c'est l'écran qui a raison : signalez-le dans Kaizen → Opérations & Stratégie (+ Nouvelle entrée).
- Ce qui a changé depuis : Kaizen → Opérations & Stratégie → **Nouveautés**.
- Le guide suit la langue de l'application.
- **« Télécharger le guide (PDF) »**, sous le sommaire : tout le guide, mis en page, à lire ou imprimer hors de l'ordinateur. C'est toujours le même texte que l'Aide.

## Référence : téléphone et ordinateur

Tous les écrans s'ouvrent sur les deux. Le téléphone sert à saisir vite ; l'ordinateur, aux listes, aux tableaux et aux longs formulaires.

### Au téléphone

- **La barre du bas** : **Écrire** (une entrée du Journal), **Vocal** (une note vocale), **Œuvre**, **Photo · doc**.
- **Œuvre**, sur Aujourd'hui, propose trois choix : **Nouvelle œuvre** (« Un nouveau numéro : photo, titre, technique, format »), **Reprise d'une œuvre** (« Même numéro : une photo et une ligne « Reprise » »), **Photos de la séance** (« Lightroom → Partager vers PEM »). Sur les autres écrans, pour un membre de l'équipe, Œuvre ouvre le Journal : passez par Aujourd'hui pour enregistrer une œuvre.
- **Photos de la séance**, pour un membre de l'équipe : les photos restent dans la séance et apparaissent sur l'œuvre quand Pem les applique.
- **Photo · doc** propose : **Document** (« Scan d'une ou plusieurs pages, texte lu plus tard sur le PC »), **Carte de visite** (« Nouveau contact depuis une carte »), **Étiquette QR** (« Scanner l'étiquette d'une œuvre »). Les administrateurs ont aussi **Inspiration**.
- **Le menu ☰** : la recherche, les tuiles, « Aide pour cet écran », « Tout le reste », « Actions », votre compte et la langue.
- **« Actions »** : Vente / paiement (« Encaisser une vente », voir Commandes), Contact, Document, Signalement, Pipeline, Triage.

**Ce que seul le téléphone fait :** lire le texte d'une carte de visite (Live Text, sur iPhone), dicter une note vocale, lire une étiquette QR avec l'appareil photo, et sur Android recevoir des images d'une autre application (Partager → PEM Workshop).

### À l'ordinateur

- La barre latérale, **⌘K / Ctrl+K** et la touche **?** (voir plus haut).
- **Ce que seul l'ordinateur fait :** glisser une carte d'une colonne à l'autre dans Production, créer un événement, et pour l'administrateur lancer les tâches du PC (transcription, recherche).
- Les rapports, les exports et les tableaux croisés se lisent mieux à l'ordinateur.
`,
  },
  {
    id: 'works',
    title: 'Œuvres',
    verified: '2026-11-18',
    md: `
Chaque œuvre a un numéro (#2407) et une fiche. La fiche s'ouvre partout de la même façon : un clic ou un toucher sur l'œuvre.

## Trouver une œuvre

**Quand :** vous cherchez une œuvre précise, ou un ensemble d'œuvres.

1. **Au téléphone** : ☰, puis tapez #2407 ou un morceau du titre dans la recherche en haut du menu.
2. **À l'ordinateur** : ⌘K (Mac) ou Ctrl+K (PC), puis le numéro ou le titre.
3. **Pour un ensemble** : Catalogue → Inventaire. La case « Rechercher… » accepte un titre ou #numéro ; les listes à côté filtrent par thème, groupe, état, période, lieu et source. « Filtres + », « Couleurs » et « Périodes & sources » vont plus loin.

**Ensuite :** un clic sur une ligne ouvre la fiche. « Rapport » ouvre Rapports sur les œuvres (imprimer, XLSX, CSV, PDF).

## Lire et modifier la fiche

**Quand :** vous corrigez un titre, une dimension, un lieu, ou vous ajoutez une information.

1. Ouvrez la fiche. « Replié » montre l'essentiel, « Développé » montre tout.
2. De haut en bas : les photos ; le titre ; **Production** (En production, Catalogué, Disponible) et **Propriété** (Atelier, Réservé, Consigné, Prêt, Vendu, Don, Archive) ; propriétaire, dépositaire, technique, support, dimensions, période ; puis les parties repliables : **Création** (période et source, historique de création, notes, thèmes, liens avec d'autres œuvres, sessions de terrain) et **Objet** (provenance, logistique, présentation, valeur, groupes, constats, étiquette QR).
3. Modifiez, puis **Enregistrer** en bas. « Annuler » revient à la fiche telle qu'elle était.

**Ensuite :** si vous n'êtes pas administrateur, la modification part en validation (« Envoyé pour validation par l'administrateur ») : la fiche ne change qu'une fois que Pem l'a acceptée.

**Attention :**
- Les **lignes** de « Commentaires & notes » comptent tout de suite, sans validation : Pem les lit dans son Fil.
- Dans **Création**, la période, la source et l'historique de création s'enregistrent aussi tout de suite, sans **Enregistrer** et sans validation.
- Quitter une fiche modifiée sans enregistrer : l'application demande d'abord.

## Enregistrer une nouvelle œuvre au téléphone

**Quand :** une œuvre commence ou vient d'être faite.

1. Dans la barre du bas, touchez **Œuvre**, puis **Nouvelle œuvre**.
2. **Ajouter la photo** : choisissez l'image dans la photothèque du téléphone (plusieurs à la fois si besoin).
3. Remplissez ce que vous savez : titre, technique, support, format, dimensions (cm), lieu (« Lieu le plus proche » propose un lieu enregistré à moins de 2 km), période, source, note. « Tous les champs » ouvre le reste.
4. **Créer l'œuvre**.

**Ensuite :**
- **Pem** : l'œuvre reçoit son numéro (« Œuvre #… créée »), avec ses photos, son lieu, sa période et sa source. Une note vocale peut s'ouvrir juste après, si vous l'avez demandé.
- **Un membre de l'équipe** : la nouvelle œuvre part en validation (« Envoyé pour validation par l'administrateur »). Elle n'a pas encore de numéro. Les champs de la fiche partent avec elle ; les photos, le lieu, la période et la source, non : ajoutez-les une fois l'œuvre validée.

**Attention :** un brouillon non enregistré est gardé sur le téléphone et repris à la prochaine ouverture (« Brouillon du … repris ») ; « Effacer » le jette.

## Noter une reprise

**Quand :** Pem retravaille une œuvre qui existe déjà.

1. **Œuvre**, puis **Reprise d'une œuvre**.
2. Cherchez l'œuvre reprise (numéro ou titre).
3. Ajoutez une photo, la date de la reprise et une ligne « ce qui a changé » (fond, glacis…).
4. **Ajouter à #…**.

**Ensuite :** une ligne « Reprise » entre dans l'historique de création, tout de suite (« Reprise ajoutée à #… »). L'œuvre garde son numéro. La photo s'ajoute à la fin de la bande d'images : directement pour Pem ; pour un membre de l'équipe, elle attend la validation (« Photos en attente de validation »).

## Ajouter des photos

**Quand :** une œuvre a besoin de ses photos, ou de meilleures photos.

1. Préparez les photos dans Lightroom et exportez-les en JPEG vers les Photos du téléphone.
2. Ouvrez la fiche de l'œuvre et touchez la case **+** dans la bande d'images, puis choisissez les photos.
3. **Android seulement** : vous pouvez aussi, depuis Lightroom ou la galerie, Partager → PEM Workshop. Les images arrivent dans « Réception partage », où vous choisissez une nouvelle œuvre, une œuvre par image, ou de les joindre à une œuvre existante.
4. **iPhone** : le menu Partager ne propose pas l'application ; utilisez la case **+** de la fiche, ou le formulaire « Importer depuis cet appareil » de la page Réception partage.

**Ensuite :**
- **Pem** : les photos sont sur l'œuvre tout de suite.
- **Un membre de l'équipe** : les photos attendent la validation (« Photos en attente de validation ») et n'apparaissent sur la fiche qu'une fois acceptées. Pour une œuvre en attente de validation elle-même, attendez qu'elle soit validée avant d'ajouter ses photos.
- Dans la bande d'images, glissez ⠿ pour changer l'ordre : la première image est la couverture.

**Attention :** l'application réduit et convertit chaque image une fois, à l'envoi. Gardez les originaux dans Lightroom.

## Faire un constat d'état

**Quand :** vous examinez l'état d'une œuvre (arrivée, départ, prêt, encadrement), ou vous voyez un problème.

1. Fiche → Développé → **Constats** → **+ Nouveau constat**.
2. Type **Examen**, date, état (Excellent, Bon, Moyen, Mauvais, Critique), examiné par (vide = vous), notes ; si besoin, « Action / traitement » et son suivi (À faire, Fait).
3. Pour chaque problème : ce que c'est (craquelure, tache…), où (coin haut gauche, revers…), une photo (12 Mo au plus), puis **Ajouter le problème**.
4. **Enregistrer le constat**.

**Ensuite :** le constat compte tout de suite, sans validation. Il reste dans la fiche avec sa date et son auteur.

**Qui peut faire quoi, aujourd'hui :**
- Tout membre de l'équipe peut faire un constat d'**Examen** sur n'importe quelle œuvre, et ajouter un problème à n'importe quel constat.
- Seuls l'auteur d'un constat et l'administrateur peuvent le **Modifier** ; un problème se retire par son auteur ou par l'administrateur.
- **Supprimer le constat** est réservé à l'administrateur.
- Une **Destruction**, une **Perte** ou un **Vol** se déclarent aussi par un constat, mais seul un administrateur peut les enregistrer (« Seul un admin peut enregistrer une destruction, une perte ou un vol. »), et marquer une œuvre « Retrouvée ».

## L'étiquette QR

**Quand :** vous étiquetez une œuvre, ou vous voulez retrouver une œuvre étiquetée.

1. Fiche → Développé → **Étiquette physique** → **Imprimer** (ou « Copier le lien »).
2. Pour lire une étiquette : barre du bas → **Photo · doc** → **Étiquette QR**, ou l'appareil photo du téléphone.

**Ensuite :** l'étiquette ouvre la fiche de l'œuvre dans l'Atelier (il faut être connecté).

## Référence : la fiche, partie par partie

« Replié » montre le haut de la fiche en entier, Création et Objet fermés, les champs vides réunis en une ligne. « Développé » ouvre Création et Objet, avec les champs vides grisés à leur place.

### Le haut de la fiche

- **Les photos** : la bande d'images (« ⠿ glisser pour changer l'ordre · la 1re = couverture »). Sur une photo : « Télécharger l'original », « Remplacer par la retouche », et pour l'administrateur « Supprimer cette photo (admin) ».
- **Le titre.**
- **Production** : où en est la fiche. **En production** (« Travail en cours ») → **Catalogué** (« Photo en attente ») → **Disponible** (« Prêt pour diffusion »). Touchez l'étape suivante pour avancer ; « photo requise » se touche quand la photo est faite. Quand l'œuvre a quitté l'atelier : « Production close : l'œuvre a quitté l'atelier. Son état suit sa commande. »
- **Propriété** : qui possède l'œuvre (voir Ce que l'application fait d'elle-même → Référence).
- **Propriétaire**, **Dépositaire** (qui a l'œuvre entre les mains) et son **Adresse**, **Acheteur** pour une vente : « Géré par sa commande (vente, dépôt, prêt) : propriétaire et dépositaire changent avec elle. »
- **Année** ou **Période**, **Technique**, **Support**, **Format**, **Dimensions** (cm ; un diamètre pour une œuvre ronde).
- **Les pastilles** : « Publique » ou « Non publique » (calculé par la base, lecture seule) ; un envoi en cours ; « … photo(s) de session à valider » ; « Confié · chez … » ; le destin d'une œuvre détruite, perdue ou volée.

### Création

- **Période & source** : la période de travail (automatique d'après l'historique, ou choisie à la main) et les sources (mémoire, motif, photo…), avec une note par source.
- **Historique de création** : les étapes datées du travail (lieu, date, note), dont les lignes « Reprise ».
- **Commentaires & notes** : les lignes de notes, et les notes vocales reliées.
- **Thèmes.**
- **Liens avec d'autres œuvres** : un numéro et un « Type de lien » : Peinte sur, Dérivée de, Répond à, Même série que, Diptyque avec, Influence avec, Proche de. Le lien se lit dans les deux sens (« Recouverte par », « A donné », « A pour réponse »).
- **Sessions de terrain** : les séances photographiées de cette œuvre.
- **✦ Vu par l'IA** : une description proposée par l'IA, à juger (« Utile ? »).

### Objet

- **Historique / provenance** : le journal daté de l'œuvre (statuts, propriétaires, déplacements). L'application y écrit elle-même ; on peut y ajouter une ligne à la main. L'administrateur y voit aussi « Historique des données ».
- **Logistique** : les envois liés à l'œuvre, la date de livraison et la date de retour.
- **Présentation** : les portes : **Montée** (sur châssis / support), **Encadrée**, **Exposable** (« Physiquement prête à montrer : montée, encadrée, vernie. ≠ Disponible »), **Prêt pour diffusion** et la **Note de diffusion** ; puis la **Présentation** : Non montée, Montée, Marouflée sur carton, Marouflée sur toile, Roulée.
- **Confidentialité du contact** : comment le nom du propriétaire s'affiche (Public, Masqué, Privé).
- **Valeur** : **Prix de base (€)**, **Remise (%)**, **MONTANT FINAL (HT)**, **TVA (%)**, **Paiement reçu** (rempli par la commande quand il y en a une), **Commande** (œuvre faite sur commande, avec son client). « Coûts (admin) » pour l'administrateur.
- **Groupes.**
- **État · constats** : les constats d'état (voir plus haut).
- **Destin** : « ni détruite ni perdue — se règle par un constat ».
- **Étiquette physique** : l'étiquette QR.
- **Corbeille** : « Mettre à la corbeille… ». **Zone admin** : « Supprimer définitivement… » (administrateur).

**Attention :** certaines parties s'enregistrent toutes seules, sans **Enregistrer** : Période & source, Historique de création, Commentaires & notes, Liens, Sessions de terrain, Vu par l'IA, et les constats. Le reste de la fiche (thèmes et groupes compris) attend **Enregistrer** en bas (« ● modifications non enregistrées »).
`,
  },
  {
    id: 'production',
    title: 'Production',
    verified: '2026-11-18',
    md: `
Production (Terrain → Production) est le tableau des étapes qui restent à faire sur les œuvres de l'atelier.

## Lire le tableau

- Une colonne par étape : Catalogue, Photographie, Retoucher, À monter, Encadrer, Exposer, À expédier. Le chiffre en haut d'une colonne compte ses œuvres.
- Une œuvre pas encore cataloguée est dans Catalogue ; une fois cataloguée, dans Photographie tant que sa photo reste à faire. Les autres colonnes s'ajoutent quand une de leurs étapes est ouverte.
- Une œuvre terminée sans étape ouverte, vendue, perdue ou détruite n'y figure pas.
- La ligne du haut résume : file atelier, disponibles, archives PEM, autres statuts.
- « Vue matière » liste les signalements matériels ouverts (interventions, anomalies, points à trier).
- La case « Filtrer titre, nº, technique… » réduit le tableau.
- « Confiées hors de l'atelier » (repliée) montre les œuvres parties chez un artisan, avec leur commande.

## Faire avancer une œuvre

**Quand :** une étape est faite.

1. Sur la carte de l'œuvre, dans la colonne de l'étape, touchez **✓** (« Marquer l'étape comme faite »).
2. ✎ ou un clic sur la carte ouvre la fiche.

**Ensuite :** l'étape se ferme et la carte quitte la colonne.

**Attention :**
- ✓ dans **Photographie** valide la photo. Pour une œuvre de l'atelier déjà cataloguée, l'application demande d'abord : « Elle passera Disponible et sera visible sur le site. » Annuler ne change rien.
- À l'ordinateur, on peut glisser une carte vers une colonne précédente pour rouvrir une étape ; vers Catalogue, l'œuvre revient au stade atelier. On ne glisse pas vers Photographie : seul ✓ y mène.

## Ajouter une œuvre à une étape

1. Le **+** en haut d'une colonne : cherchez l'œuvre, elle rejoint la colonne.
2. « Colonnes » (en haut à droite, à côté de « Rapport ») gère les colonnes elles-mêmes : nom, couleur, ce que cocher l'étape change sur l'œuvre.
`,
  },
  {
    id: 'day',
    title: 'La journée et le Journal',
    verified: '2026-11-18',
    md: `
Le Journal garde une page par jour : les écrits, les notes vocales, les photos et les œuvres de ce jour-là. Au téléphone, la page du jour s'appelle **Aujourd'hui**.

## Lire la journée

- En haut : la date, ‹ › pour changer de jour, 📅 pour la liste des jours.
- Sous la date : combien d'entrées, d'œuvres et de notes ce jour-là, puis **Retard · Aujourd'hui · Revue · Inbox** : la file de terrain (rappels, sessions à revoir, partages, signalements). Un toucher l'ouvre.
- **À revoir aujourd'hui** remonte une ancienne entrée ou deux œuvres proches. « Ouvrir le jour » y va ; « Plus tard » la remet à dans 7 jours ; « 1 / 3 › » passe à la suivante.
- Puis les œuvres du jour, et les écrits et notes du jour.

## Écrire une entrée

**Quand :** une pensée, une observation, un déclic, à garder.

1. Barre du bas → **Écrire**.
2. Choisissez le genre : Étincelle, Déclencheur, Réflexion ou Note.
3. Écrivez tel quel. Tapez **#2399** dans le texte pour relier l'œuvre n° 2399.
4. **Ajouter**.

**Ensuite :** l'entrée s'ajoute à ce jour-là (« Écrit enregistré sur ce jour »).

**Attention :** une entrée ne se modifie pas. Pour corriger, ajoutez-en une nouvelle.

## Enregistrer une note vocale

**Quand :** parler va plus vite qu'écrire.

1. Barre du bas → **Vocal**. L'enregistrement commence tout de suite.
2. Parlez. Quand le téléphone le permet, les mots s'écrivent à l'écran pendant que vous parlez.
3. **Arrêter et enregistrer**.
4. Si vous voulez : ajoutez les détails ensuite (facultatif).

**Ensuite :** la note est gardée avec sa date et son heure, et apparaît dans les écrits et notes du jour. « Relier… » sur la note la rattache à une œuvre, une idée ou un projet. Une transcription plus complète arrive plus tard, faite sur le PC de l'atelier.

**Attention :**
- « Micro non disponible » : autorisez le micro pour le site dans les réglages du navigateur, puis « Réessayer » ; ou « Écrire une note » à la place.
- « Pas enregistrée » : touchez « Réessayer l'envoi » avant de fermer, l'audio est encore là.

## Retrouver un jour

1. Au téléphone : 📅 sur Aujourd'hui, ou la tuile **Journal** du menu ☰.
2. Touchez un jour pour l'ouvrir, ou « Aller au » pour choisir une date.

**Attention :** toute l'équipe lit le Journal ; seuls les administrateurs capturent ou modifient une séance de travail.
`,
  },
  {
    id: 'ideas',
    title: 'Idées',
    verified: '2026-11-18',
    md: `
Idées (Studio → Idées) rassemble les projets et les concepts de Pem. Pem décide des idées ; l'équipe les lit, en discute et en propose.

## Lire une idée

1. Les pastilles du haut filtrent par poids et par maturité ; « Rechercher une idée… » cherche dans les titres.
2. Touchez une idée pour l'ouvrir : poids, maturité, notes et discussion.

## Ajouter une ligne à la discussion

1. Ouvrez l'idée.
2. Écrivez dans « Ajouter une ligne… », puis **Ajouter**.

**Ensuite :** la ligne s'affiche sous l'idée, avec la date.

## Proposer une idée

1. **Proposer une idée**.
2. Votre idée en quelques mots ; une œuvre (#1234) si elle s'y rapporte.
3. **Envoyer à Pem**.

**Ensuite :** elle arrive directement dans le Fil de Pem, qui décide de la suite.
`,
  },
  {
    id: 'orders',
    title: 'Commandes',
    verified: '2026-11-18',
    md: `
Une commande suit chaque œuvre qui quitte les mains de l'atelier, avec ses étapes et ses papiers. Cinq genres : **Vente**, **Dépôt** (chez une galerie), **Prêt**, **Don**, et **Confié** (chez un artisan : encadreur, restaurateur…).

## Créer une commande

**Quand :** une vente se conclut, une galerie prend des œuvres, un prêt ou un don se prépare, une œuvre part chez un artisan.

1. Business → Commandes → **+ Nouvelle commande** (plus confortable à l'ordinateur).
2. **Quel genre ?**
3. **Œuvres** : numéro ou titre, puis Ajouter.
4. **Avec qui** : l'acheteur, la galerie, l'emprunteur, le bénéficiaire ou l'artisan.
5. L'adresse où vont les œuvres (ou « À préciser plus tard »).
6. Selon le genre : le prix et l'acompte (vente), la commission (dépôt), les dates de sortie et de retour (dépôt, prêt).
7. **Créer le brouillon**.

**Attention :** une œuvre déjà sur une autre commande ouverte est refusée, avec son numéro.

## Faire avancer une commande

Ouvrez la commande : ses **Étapes** se cochent dans l'ordre avec le bouton de l'étape suivante.

- **Vente** : Brouillon → Signée (réserve les œuvres) → Acompte → Soldée (l'acheteur devient propriétaire) → Livrée.
- **Dépôt** et **Prêt** : Brouillon → Signé → Sortie (chez la galerie ou l'emprunteur) → Rentré à l'atelier.
- **Don** : Brouillon → Acte signé (rien ne bouge encore) → Remise (le bénéficiaire devient propriétaire et garde l'œuvre).
- **Confié** : Brouillon → Confié (chez l'artisan) → Rentré à l'atelier.

**Ensuite :** chaque étape met à jour l'œuvre (statut, propriétaire, dépositaire) ; vous n'avez pas à le faire sur la fiche.

## L'argent

1. **Encaisser** : montant reçu, moyen, date, puis « Enregistrer le paiement ». « Reçu » et « Reste » se mettent à jour.
2. Une vente peut être retournée pendant **14 jours** après la livraison ou la remise : « Retour (droit de 14 jours) ». Jusque-là, l'argent est marqué « en attente — pas encore définitif ».

**Attention :** l'application ne vire jamais d'argent. Un retour affiche le montant à rembourser ; le remboursement se fait à la banque.

## Les papiers

1. **Faire le papier** crée le document de la commande (dans le Coffre).
2. Une fois signé : **Ajouter la copie signée** (PDF ou photo, 4 Mo au plus).

## Annuler

**Annuler la commande** la ferme ; ses œuvres sortent d'un envoi qui n'est pas encore parti.

## Référence : étapes et papiers

### Les étapes, genre par genre

Chaque bouton d'étape demande d'abord : « Passer à cette étape ? Les œuvres changent de statut, de propriétaire ou de gardien selon l'étape, avec une ligne dans leur historique. »

- **Vente** : Brouillon → **Marquer signée (réserve les œuvres)** → **Acompte reçu** → **Soldée — payée (l'acheteur devient propriétaire)** → **Livrée (l'acheteur garde l'œuvre)**. Ensuite, 14 jours de retour possible.
- **Dépôt** : Brouillon → **Marquer signé** → **Sortie — chez la galerie** → **Rentrée à l'atelier**.
- **Prêt** : Brouillon → **Marquer signé** → **Sortie — chez l'emprunteur** → **Rentrée à l'atelier**.
- **Don** : Brouillon → **Acte signé (rien ne bouge avant la remise)** → **Remise (le bénéficiaire devient propriétaire et garde l'œuvre)**.
- **Confié** : Brouillon → **Confié — chez l'artisan** → **Rentré à l'atelier**. L'œuvre garde son étape et son propriétaire ; seul le dépositaire change.

Les commandes finies s'affichent avec « + closes » : Livrée, Rentré, Remis, Retournée, Annulée.

### Ce que les étapes font d'elles-mêmes

- **Signée** (vente, dépôt, prêt) : le papier est refait sans la mention « Brouillon », et un envoi (ou un retrait) s'ouvre dans Logistique.
- **Soldée** (vente) : un certificat d'authenticité par œuvre.
- **Livrée** (vente) : les 14 jours de retour commencent ; un rappel arrive le jour où ils finissent (« Fin du délai de retour »).
- **Remise** (don) : l'acte de don est refait, daté de la remise.
- **Confié** : le bon de confiage est fait à la sortie.
- **Annuler la commande** : « Des œuvres réservées par elle redeviennent disponibles. »

### La valeur de chaque œuvre sur la commande

Selon le genre : **Prix de vente** (vente), **Prix convenu** (dépôt), **Valeur d'assurance** (prêt, Confié), **Valeur de référence (jamais imprimée)** (don). Vide = le prix de l'œuvre aujourd'hui. Après la signature, une valeur changée demande de refaire le papier et de le faire signer de nouveau.

### L'argent (vente)

- **Prix catalogue (total)**, **Remise %**, **Prix final (total)** (calculé en tapant, modifiable), **Acompte %**. Le prix final est TTC.
- La TVA est lue sur chaque œuvre (fiche → Valeur). « TVA : à définir (comptable) » tant que le taux n'est pas décidé.
- **Encaisser** : une partie du prix passe la vente en « Acompte » (œuvres réservées) ; tout le prix, en « Soldée ».
- **Emportée aujourd'hui** : « Payée et emportée à l'atelier : la vente passe « Livrée » dès qu'elle est soldée, et les 14 jours de retour commencent. »
- Un retour affiche « À rembourser : … — l'application ne vire rien ». Une fois le virement fait : **Marquer remboursé**, avec sa date.
- Une vente d'une œuvre en dépôt : la commission de la galerie est notée au paiement.

### Le papier de chaque genre

Un papier par commande, en français avec une ligne d'anglais :

- **Vente** : **Bon de commande**.
- **Dépôt** : **Bordereau de dépôt-vente**.
- **Prêt** : **Contrat de prêt**.
- **Don** : **Acte de don**.
- **Confié** : **Bon de confiage**.

1. **Faire le papier** (ou **Refaire le papier**). Tant que la commande n'est pas signée, il porte « Brouillon ».
2. **Ouvrir** le lit ; **Partager** envoie le fichier lui-même (pas un lien) ; à l'ordinateur, il se télécharge.
3. Une fois signé : **Ajouter la copie signée** (PDF ou photo JPEG, PNG, WebP, HEIC ; 4 Mo au plus).

### Facture et avoir (vente)

- « La facture s'émet une fois la vente payée. » **Émettre la facture** est réservé à l'administrateur : « Émettre la facture ? Son numéro est définitif ; une erreur se corrige par un avoir. »
- Plusieurs ventes payées au même acheteur : « Émettre une facture pour … commandes de cet acheteur ».
- La facture reprend les œuvres, les préparations payantes et l'expédition. La mention de TVA est à définir avec le comptable.
- **Faire un avoir** annule une facture (elle reste, marquée « annulée par avoir »).

### Certificats (vente)

« Faits automatiquement au paiement, à mettre dans la caisse. » Un **certificat d'authenticité** par œuvre. S'il en manque un : **Faire les certificats**.

### Autour d'une vente

- **Livraison** : **Expédition** ou **Retrait (atelier ou événement)** ; « Expédition et assurance (payées par l'acheteur) » : un montant, vide = inclus.
- **Préparation demandée** : **Encadrement**, **Montage**, **Dédicace / signature**, avec un détail et un prix (vide = inclus). Chaque demande est cochée « Fait » avant l'emballage ; sinon l'envoi refuse : « Préparation pas finie : … demande(s) ouverte(s). » Un encadrement chez un artisan se fait par une commande « Confié ».

### Pour toutes les commandes

- **Envoi** : « Préparer l'envoi », « Préparer le retrait », ou « Retour » pour une œuvre sortie (voir Logistique). Sur un envoi, **+ Déclarer un sinistre** : assureur ou transporteur, n° de dossier, n° de plainte (vol), montant demandé ; puis En cours, Indemnisé, Refusé ou Retiré.
- **Calendrier** : « Mettre les dates dans mon calendrier » (sortie, retour attendu, livraison prévue, fin du délai de retour). Il faut un calendrier relié.

### Vendre au téléphone

☰ → Actions → **Vente / paiement** (« Encaisser une vente ») : **Œuvres** → **Acheteur** → **Paiement** → **Validation**, puis **Créer et finaliser**. Sans paiement, c'est un brouillon à signer dans Commandes ; avec un paiement, la commande est signée, l'acompte réserve l'œuvre et le prix entier la passe en vendu.
`,
  },
  {
    id: 'logistics',
    title: 'Logistique',
    verified: '2026-11-18',
    md: `
Logistique (Business → Logistique) montre les envois en cours. Un envoi part d'une ou plusieurs commandes vers la même adresse.

## Préparer un envoi

1. Ouvrez la commande, puis **Préparer l'envoi** (ou **Préparer le retrait** si l'œuvre est retirée à l'atelier ou sur un événement).
2. L'envoi apparaît dans Logistique.

## Faire avancer un envoi

Les étapes se cochent dans l'ordre, avec « Passer à « … » ». Pour une expédition : Ouvert → Photos d'état → Sorties → Emballées → Assurées → Étiquette + suivi → Parties → Livrées. Un retrait finit par « Remises ».

Renseignez au passage : transporteur, n° et lien de suivi, dimensions et poids du colis, matériaux d'emballage, valeur assurée, assureur.

**Ensuite :** « Voir les envois terminés » retrouve les envois livrés.

**Attention :**
- « Annuler l'envoi » laisse les œuvres sur leurs commandes.
- Une commande annulée ou retournée retire ses œuvres d'un envoi pas encore parti ; un carton vide est annulé. Un envoi déjà en route ne bouge pas.
`,
  },
  {
    id: 'events',
    title: 'Expositions et événements',
    verified: '2026-11-18',
    md: `
Expositions & événements (Studio → Expositions) réunit les expositions, collaborations et lancements d'édition, avec leurs œuvres et leurs commandes. Au téléphone, on les consulte ; on les crée à l'ordinateur.

## Créer un événement

1. **+ Nouvel événement**.
2. Genre (Exposition, Collaboration, Lancement d'édition) et nom, puis **Créer**.
3. Remplissez : état (À confirmer, Prévu, En cours, Terminé), lieu (un contact, ou l'atelier), début et fin, lien, notes.
4. **Personnes** : + personne, avec son rôle (lieu, commissaire, organisateur, galerie, partenaire, imprimeur).

## Les œuvres d'un événement

1. **Œuvres** : créez la sélection à partir des œuvres choisies dans l'Inventaire, liez un groupe existant, ou **+ Œuvres** pour en chercher une.
2. **À préparer** : une colonne par préparation (présentation, cartel…), à cocher œuvre par œuvre.
3. **Commandes liées** : cochez des œuvres, choisissez le genre de commande et l'autre partie, puis « Créer la commande ».

**Ensuite :** « Exporter au calendrier » envoie l'événement vers un agenda. La liste groupe les événements en cours, à venir et passés, avec les œuvres sorties et les retours proches.
`,
  },
  {
    id: 'contacts',
    title: 'Contacts',
    verified: '2026-11-18',
    md: `
Contacts (Business → Contacts) réunit les collectionneurs, galeries, artisans, fournisseurs, amis et institutions.

## Trouver un contact

1. La case de recherche cherche dans le nom, l'institution, la ville, l'e-mail et les notes ; « Partout » et « Tous rôles » affinent.
2. Les colonnes **Œuvres**, **Détient** et **Achats** comptent les œuvres dont il est propriétaire, celles qu'il garde chez lui, et celles qu'il a achetées.
3. Un clic sur une ligne ouvre la fiche du contact.

## Ajouter un contact

- À l'ordinateur : **+ Nouveau contact**.
- « Google CSV » importe un export de contacts Google ; « URL » propose un contact à partir d'une page web, avec un aperçu avant de créer.

**Attention :** un e-mail déjà utilisé par un autre contact est refusé.

## Une carte de visite, au téléphone

**Quand :** on vous tend une carte, sur un salon ou dans la rue.

1. Barre du bas → **Photo · doc** → **Carte de visite**.
2. Photographiez la carte.
3. Touchez deux fois la case de texte, « Scanner le texte » (Live Text), visez la carte, puis **Analyser** : le contact se remplit tout de suite, sans IA ni réseau de l'atelier.
4. Si vous voulez : **Améliorer avec l'IA** (s'arrête après 30 s ; le contact reste tel quel si l'IA ne répond pas).
5. Vérifiez l'aperçu, puis **Créer le contact**.

**Ensuite :** la photo de la carte est gardée avec le contact, dans le Coffre (Business).

**Attention :**
- Il faut au moins un nom ou une institution.
- **Améliorer avec l'IA** ne fonctionne que lorsque l'application tourne sur l'ordinateur de Pem, où l'IA de l'atelier est installée. Au téléphone et sur les ordinateurs de l'équipe, elle n'est pas disponible (sauf installation) : passez cette étape, « Analyser » suffit.
- De même, « URL » dans Contacts lit la page sans IA (nom, e-mail, téléphone, quand la page les donne) ; l'IA ne complète l'aperçu que sur l'ordinateur de Pem. Vérifiez l'aperçu avant de créer.
`,
  },
  {
    id: 'supplies',
    title: 'Fournitures',
    verified: '2026-11-18',
    md: `
Fournitures (Studio → Fournitures) tient le stock de l'atelier : couleurs, liants, supports, matériel. Quatre onglets : **Stock**, **Comptage**, **Réassort / Commande**, **Commandes**.

## Le stock

1. Cherchez un article par nom ou notes ; filtrez par catégorie ou fournisseur ; « Stock bas seulement » montre ce qui passe sous son seuil.
2. **−** et **+** ajustent la quantité d'un geste ; **Éditer** ouvre l'article.
3. **Nouvel article** ajoute un matériau ; « Fournisseurs » (replié) liste les fournisseurs.

## Compter

1. **Comptage** : pour chaque article, la quantité enregistrée (« Système ») et la quantité comptée, à ajuster avec − et +.
2. « Écarts seulement » ne montre que ce qui diffère.
3. **Appliquer** met le stock à jour avec ce qui a été compté.

## Commander et recevoir

1. **Réassort / Commande** liste ce qui manque ou passe sous son minimum, par fournisseur. Saisissez les quantités « À commander », puis « Copier la commande » copie son texte. Le minimum se règle ici et allume le badge « Bas ».
2. **Commandes** suit les commandes de fournitures ; **+ Commande** en crée une à la main.
3. À la livraison : **Recevoir…**, avec les quantités reçues ; « Recevoir le reste… » pour une livraison en plusieurs fois.

**Ensuite :** le stock se met à jour à la réception.
`,
  },
  {
    id: 'reports',
    title: 'Rapports',
    verified: '2026-11-18',
    md: `
Rapports (Catalogue → Rapports) fait des listes à imprimer ou à exporter, à partir de six sources : Œuvres, Production, Constats, Kaizen, Ventes, Contacts.

## Faire un rapport

1. Choisissez la source (onglets du haut).
2. **Champs** : cochez ceux à afficher ; ▲ ▼ changent leur ordre ; « Filtrer » sur un champ ne garde que certaines valeurs.
3. « Rechercher dans le rapport… » réduit encore la liste.
4. **Imprimer**, **Exporter XLSX**, **CSV** ou **Exporter PDF** en bas.

## Garder un rapport

« Enregistrer sous… » le garde avec un nom ; « Rapports enregistrés » le rouvre.

## Croiser les données

- **Tableau croisé** compte et additionne par lignes et colonnes (par exemple : œuvres par année et par technique).
- « Pivot Atlas (graphe) » montre les mêmes données en graphique.

`,
  },
  {
    id: 'public',
    title: 'Site public, Portfolio, Analytiques',
    verified: '2026-11-18',
    md: `
Le groupe Public règle ce que le monde voit : le site www.thepemworkshop.com, le portfolio PDF, et les visites.

## Ce qui apparaît sur le site

Une œuvre est publique quand elle est Disponible, Réservée, Vendue, Consignée, Prêtée ou donnée, sans être détruite ni perdue. L'application le décide d'après le statut : on ne coche rien à la main.

## Site public

- En haut : **Site**, **↓ PDF** et **/works** ouvrent le site, le PDF du portfolio et la page des œuvres ; **Publier →** met les réglages en ligne (la date de la dernière publication est dessous).
- **Composition** : les blocs de chaque page (Accueil, Œuvres, À propos) ; ajouter, réordonner, masquer.
- **Ambiance** : la lumière et les ombres de chaque page, avec des boutons rotatifs.

## Portfolio

**Sections Portfolio** : chaque section a un titre, un texte, un thème et l'ordre de ses œuvres ; elles composent le PDF téléchargeable. **+ Ajouter** crée une section ; « Éditer le texte » ouvre son texte.

## Analytiques

Les visites du site : pages vues et visiteurs (sans les sessions de l'Atelier), la tendance par jour, les pages les plus vues, les pays et les sources. « Pages site » ou « Tout brut », et 7, 30 ou 90 jours en haut.
`,
  },
  {
    id: 'rules',
    title: 'Ce que l\'application fait d\'elle-même',
    verified: '2026-11-18',
    md: `
Certaines règles sont tenues par la base de données : chaque écran les suit, et personne n'a à les faire à la main.

## Le parcours d'une œuvre

- Une œuvre passe par trois stades : **atelier** (pas encore cataloguée), **cataloguée, photo à faire**, **prête** (cataloguée et photo validée). On peut revenir en arrière.
- Cataloguer demande au moins une photo.
- À l'atelier, le statut suit le stade : **Disponible** quand elle est prête, **En production** sinon.
- Les étapes de Production suivent le stade : « Cataloguer » est ouverte tant que l'œuvre n'est pas cataloguée, « Photographier » tant que la photo reste à faire.
- La production se termine le jour où l'œuvre devient prête ; revenir en arrière efface cette date et l'écrit dans l'historique.
- **Archive** : l'œuvre est cataloguée d'abord, ses étapes sont mises en pause ; elle n'en ressort que par un choix.

## Qui a l'œuvre

- Une œuvre ne quitte l'atelier que par une commande : vente, dépôt, prêt, don ou Confié.
- Le propriétaire, le dépositaire et l'adresse suivent les étapes de la commande.
- Chaque changement de statut, de propriétaire ou de dépositaire laisse une ligne datée dans l'historique.

## Les accidents

- Une destruction, une perte ou un vol se déclarent par un constat. Ses commandes ouvertes se ferment ; une œuvre détruite ferme ses étapes, une œuvre perdue les met en pause (elles reviennent si on la retrouve).
- Une œuvre détruite ou perdue n'est jamais « Exposable ».
- Une œuvre mise à la corbeille met ses étapes en pause ; elles reviennent si on la sort de la corbeille.
- Seul un administrateur peut supprimer une œuvre vendue ou donnée.

## Le site

Ce qui est public découle du statut (voir Site public). Valider la photo d'une œuvre de l'atelier la rend Disponible et visible : l'application demande d'abord.

## Référence : statuts et étapes

### Les trois étapes de la fiche (Production)

1. **En production** (« Travail en cours ») : à l'atelier, pas encore cataloguée. Étape ouverte : Cataloguer.
2. **Catalogué** (« Photo en attente ») : décrite, avec au moins une photo ; la photo du catalogue reste à faire. Étape ouverte : Photographier.
3. **Disponible** (« Prêt pour diffusion ») : cataloguée et photo validée. Pour une œuvre de l'atelier, elle devient visible sur le site.

### La propriété (sur la fiche)

- **Atelier (Pem)** : « Propriété totale ».
- **Réservé** : « Vente en cours ». Par une commande de vente signée.
- **Consigné** : « Galerie / sans transfert ». Par une commande de dépôt.
- **Prêt** : « Institution / sans transfert ». Par une commande de prêt.
- **Vendu** : « Transfert propriété ». Par une commande de vente soldée.
- **Don** : « Transfert propriété ». Par « Don… », une commande de don.
- **Archive (Pem)** : « Retiré de la diffusion ». L'œuvre doit être cataloguée d'abord.

Réservé, Consigné, Prêt et Vendu sont fermés sur la fiche : ils se font par leur commande (« Préparer une commande pour cette œuvre (brouillon, à signer dans Commandes). »). Une œuvre chez un artisan garde sa propriété et affiche « Confié · chez … ».

### Les statuts dans les listes

L'Inventaire, les rapports et les pastilles montrent un seul mot par œuvre :

- **En production** ; **Catalogué** (pastille jaune : cataloguée, photo à faire) ; **Disponible** ;
- **Réservé**, **Consigné**, **Prêt**, **Vendu**, **Don** ;
- **Archive (Pem)** ;
- **Détruite**, **Perdue**, **Volée**.

**Publiques** (sur le site) : Disponible, Réservé, Consigné, Prêt, Vendu, Don, sans destruction, perte ni vol. **Non publiques** : En production, Catalogué, Archive, Détruite, Perdue, Volée. La pastille « Publique / Non publique » de la fiche le dit, en lecture seule.

Une œuvre vendue ou donnée, puis détruite, perdue ou volée, garde « Vendu » ou « Don », avec la mention « détruite », « perdue » ou « volée ».

### Les portes (Objet → Présentation)

Quatre cases, indépendantes du statut : **Montée**, **Encadrée** (aussi cochées par les étapes de Production), **Exposable** (physiquement prête à montrer ; jamais pour une œuvre détruite, perdue, ou dans l'archive), **Prêt pour diffusion** (la publication sur les réseaux, suivie par l'administrateur).

### Le destin

« ni détruite ni perdue — se règle par un constat ». Après une destruction, une perte ou un vol : « Étapes verrouillées : clore ou supprimer le constat de perte / destruction pour les modifier. »
`,
  },
  {
    id: 'faq',
    title: 'Questions fréquentes et dépannage',
    verified: '2026-11-18',
    md: `
Les questions qui reviennent, et les messages de l'application mot pour mot, avec quoi faire.

## Œuvres et fiches

### J'ai enregistré, mais la fiche n'a pas changé

« Envoyé pour validation par l'administrateur » : votre modification attend que Pem la valide. La fiche change quand il l'accepte. Voir Premiers pas → Ce qui attend la validation de Pem.

### Mes photos n'apparaissent pas

- « Photos en attente de validation » : elles apparaissent une fois validées.
- « Envoyé pour validation par l'administrateur. Les images sélectionnées n'ont pas été envoyées — ajoutez-les une fois la modification approuvée. » : c'était une nouvelle œuvre ; elle n'a pas encore de numéro. Ajoutez les photos quand elle est validée.

### Je ne trouve pas une œuvre

1. ⌘K (Ctrl+K) à l'ordinateur, ou la recherche du menu ☰ au téléphone : tapez #numéro ou un morceau du titre.
2. Dans l'Inventaire, regardez la case « Rechercher… » et les filtres : un filtre resté actif cache des œuvres.
3. « Catalogue partiel · … » : l'Atelier n'a chargé qu'une partie du catalogue ; « Charger la tranche suivante » élargit les listes.
4. Une œuvre mise à la corbeille n'apparaît plus nulle part : demandez à Pem.

### La fiche refuse un statut

- « Vendu / don : choisir l'acquéreur (pas Pem). Consigné / prêt : choisir le dépositaire (pas Pem). »
- « Une œuvre ne quitte l'atelier que par une commande (dépôt, prêt, vente) ; en production, disponible ou archivée, Pem en est propriétaire et dépositaire. » : passez par Commandes.
- « Œuvre hors circulation (vendue, donnée, archivée, détruite, perdue ou déjà en dépôt) : impossible de la réserver, vendre ou déposer. »
- « Archive : cataloguez d'abord l'œuvre (une fiche partielle suffit). »
- « Sortie d'archive vers Disponible : la photo doit être faite. Sinon, repassez l'œuvre en production. »
- Une œuvre sans photo ne peut pas être cataloguée : ajoutez une photo d'abord.

### Je ne peux pas modifier plusieurs œuvres d'un coup

« Modifier statut, contact, prix… sur plusieurs œuvres est réservé aux admins. Les thèmes et groupes restent modifiables ; pour le reste, passez par la fiche (validation). »

### Je ne peux pas mettre une œuvre à la corbeille

« Seul un admin peut mettre à la corbeille une œuvre vendue ou donnée. »

### « Modifications non enregistrées »

Vous fermez une fiche modifiée : **Enregistrer** garde vos changements, **Quitter sans enregistrer** les jette, **Annuler** vous laisse sur la fiche.

### Un lieu est refusé dans l'historique de création

« Ce lieu n'existait pas à cette date — choisir un autre lieu ou corriger la date. »

### Un constat ne se modifie pas

- « Seul l'auteur ou l'administrateur peut modifier ce constat. »
- « Seul un admin peut enregistrer une destruction, une perte ou un vol. » : faites un constat d'Examen, et prévenez Pem.
- « Photo trop lourde (12 Mo max). »

## Commandes et envois

### La commande ne se crée pas

- « Choisissez avec qui (pas Pem). »
- « Ajoutez au moins une œuvre. »
- « Une vente a besoin de son prix final. »
- « Un dépôt ou un prêt a besoin de ses dates de sortie et de retour. »
- « Déjà sur une autre commande ouverte : » suivi du numéro : ouvrez cette commande, finissez-la ou annulez-la d'abord.

### Une étape ou un paiement est refusé

- « Cette étape n'est pas possible depuis l'étape actuelle. » : rechargez la commande ; quelqu'un l'a peut-être déjà fait avancer.
- « Ce montant dépasse le reste à payer (déjà encaissé ?). Rechargez la commande. »
- « Cette commande ne se modifie plus (payée, sortie, remise ou close). »
- « Le délai de retour de 14 jours est passé : la vente est définitive. »

### L'envoi ne se prépare pas, ou n'avance pas

- « Toutes les œuvres de cette commande sont déjà sur un envoi. » : il est déjà dans Logistique.
- « Préparation pas finie : … demande(s) ouverte(s). » : cochez « Fait » sur chaque demande de la vente.

### La copie signée est refusée

« Fichier trop lourd (4 Mo au plus). » ou un format autre que PDF, JPEG, PNG, WebP ou HEIC. Au téléphone, une photo du papier signé suffit.

### Où est la facture ?

La facture s'émet une fois la vente payée, par Pem. Les certificats d'authenticité se font tout seuls au paiement. Voir Commandes → Référence.

## Téléphone et réseau

### Le micro ne marche pas

- « Micro non disponible » : autorisez le micro pour le site dans les réglages du navigateur, puis « Réessayer » ; ou « Écrire une note ».
- « Pas enregistrée » : « Réessayer l'envoi » avant de fermer ; l'audio est encore là.

### Pas de réseau

- Sur une fiche : « Hors ligne : enregistrement mis en file. Synchronisation à la reconnexion. » L'enregistrement part tout seul au retour du réseau (« File hors ligne synchronisée. »).
- « Hors ligne » puis « Cette page n'est pas en cache. Reconnectez-vous pour continuer, ou ouvrez le Hub si vous l'avez déjà visité. » : les pages déjà ouvertes restent lisibles ; les autres attendent le réseau.
- Pour une note : « Écrire une note » garde un brouillon sur le téléphone.

### Le menu Partager ne propose pas l'application

Sur iPhone, c'est normal : utilisez la case **+** de la fiche, ou « Importer depuis cet appareil » dans Réception partage. Sur Android, installez d'abord l'application sur l'écran d'accueil.

### « Améliorer avec l'IA » ne répond pas

Normal hors de l'ordinateur de Pem : « Analyser » suffit. Le contact reste tel qu'il a été lu.

### L'étiquette QR ouvre la page de connexion

Il faut être connecté : connectez-vous, l'étiquette ouvre ensuite la fiche.

## Compte

### J'ai perdu mon mot de passe

« Mot de passe oublié ? » sur la page de connexion envoie un lien par e-mail. Un compte Google seul se connecte avec le bouton Google.

### Je n'ai plus accès à l'Atelier

L'accès est donné par Pem, sur votre fiche de contact. Demandez-lui de vérifier « Accès atelier ».

## Signaler un problème

- **Un problème sur une œuvre ou à l'atelier** (un châssis desserré, une tache…) : au téléphone, ☰ → Actions → **Signalement** (« Signaler un problème ») : un titre court, des détails, une photo si vous voulez, puis « Envoyer le signalement ». Avec une œuvre et une étape choisies, il apparaît dans Production.
- **Un problème de l'application, ou un écran qui ne correspond pas à ce guide** : Kaizen → Opérations & Stratégie → **+ Nouvelle entrée**. Dites ce que vous faisiez, ce qui s'est passé, et l'heure.
`,
  },
  {
    id: 'glossary',
    title: 'Glossaire',
    verified: '2026-11-18',
    md: `
Les mots de l'application, en français et en anglais.

- **Œuvre** (Work) : une pièce de Pem, avec son numéro (#2407).
- **Fiche** (Card) : la page d'une œuvre, qui s'ouvre sur le côté.
- **Catalogué** (Catalogued) : l'œuvre est décrite et photographiée au moins une fois.
- **En production** (In production) : l'œuvre est à l'atelier et pas encore prête.
- **Disponible** (Available) : prête, à l'atelier, visible sur le site.
- **Archive** (Archive) : gardée par l'atelier, hors circulation.
- **Réservé, Vendu** (Reserved, Sold) : étapes d'une vente.
- **Consigné / Dépôt** (Consigned / Consignment) : confiée à une galerie qui peut la vendre.
- **Prêt** (Loan) : prêtée pour un temps, puis rentrée.
- **Don** (Gift) : donnée ; le bénéficiaire devient propriétaire à la remise.
- **Confié** (Entrusted) : chez un artisan (encadreur, restaurateur) pour un travail.
- **Propriétaire** (Owner) : à qui l'œuvre appartient.
- **Dépositaire** (Custodian) : qui l'a entre les mains.
- **Commande** (Order) : la trace d'une œuvre qui quitte l'atelier, avec ses étapes et ses papiers.
- **Envoi** (Shipment) : un colis ou un retrait, pour une ou plusieurs commandes.
- **Constat** (Condition report) : l'état d'une œuvre à une date, avec ses problèmes et leurs photos.
- **Validation** (Approval) : l'accord de Pem sur une nouvelle œuvre, une modification de fiche ou une photo proposées par l'équipe.
- **Reprise** (Rework) : une œuvre retravaillée, qui garde son numéro.
- **Période, Source** (Period, Source) : quand et à partir de quoi l'œuvre est faite (mémoire, motif, photo…).
- **Séance de terrain** (Field session) : une séance de travail photographiée.
- **Journal** (Journal) : une page par jour, écrits et notes vocales.
- **Fil** (Feed) : la file de Pem : propositions, lignes et brouillons à trier (administrateurs).
- **Kaizen** : l'amélioration continue de l'atelier et de l'application ; « Opérations & Stratégie » et cette Aide.
- **Coffre** (Vault) : les documents (papiers des commandes, certificats, cartes de visite).
- **Cartel** (Label) : le petit texte imprimé à côté d'une œuvre exposée.
`,
  },
]
