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
- Un membre de l'équipe voit presque tout. Ses nouvelles œuvres, les modifications enregistrées sur une fiche et les photos ajoutées attendent la validation d'un administrateur ; quelques écrans sont réservés aux administrateurs.

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
- **« Tout le reste »** (replié) : tous les autres écrans.
- **« Actions »** (replié) : Vente, Contact (carte de visite), Document, Problème, Pipeline, Triage.
- **En bas** : votre compte, la langue (FR / EN), la déconnexion.

Sur les autres écrans, la pastille « Aujourd'hui » en haut à droite vous ramène à la journée.

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
- Les boutons **FR / EN** de l'en-tête changent la langue.

## Ce guide

- Chaque chapitre porte la date du jour où il a été vérifié dans l'application. Si l'écran ne correspond plus au guide, c'est l'écran qui a raison : signalez-le dans Kaizen → Opérations & Stratégie (+ Nouvelle entrée).
- Ce qui a changé depuis : Kaizen → Opérations & Stratégie → **Nouveautés**.
- Le guide suit la langue de l'application.
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

**Ensuite :** si vous n'êtes pas administrateur, la modification part en validation (« Envoyé pour validation par l'administrateur ») : elle apparaît sur la fiche une fois acceptée.

**Attention :**
- Les **lignes** de « Commentaires & notes » comptent tout de suite, sans validation : Pem les lit dans son Fil.
- Quitter une fiche modifiée sans enregistrer : l'application demande d'abord.

## Enregistrer une nouvelle œuvre au téléphone

**Quand :** une œuvre commence ou vient d'être faite.

1. Dans la barre du bas, touchez **Œuvre**, puis **Nouvelle œuvre**.
2. **Ajouter la photo** : choisissez l'image dans la photothèque du téléphone (plusieurs à la fois si besoin).
3. Remplissez ce que vous savez : titre, technique, support, format, dimensions (cm), lieu (« Lieu le plus proche » propose un lieu enregistré à moins de 2 km), période, source, note. « Tous les champs » ouvre le reste.
4. **Créer l'œuvre**.

**Ensuite :** l'œuvre reçoit son numéro (« Œuvre #… créée »). Une note vocale peut s'ouvrir juste après, si vous l'avez demandé. Si vous n'êtes pas administrateur, la création attend la validation.

**Attention :** un brouillon non enregistré est gardé sur le téléphone et repris à la prochaine ouverture (« Brouillon du … repris ») ; « Effacer » le jette.

## Noter une reprise

**Quand :** Pem retravaille une œuvre qui existe déjà.

1. **Œuvre**, puis **Reprise d'une œuvre**.
2. Cherchez l'œuvre reprise (numéro ou titre).
3. Ajoutez une photo, la date de la reprise et une ligne « ce qui a changé » (fond, glacis…).
4. **Ajouter à #…**.

**Ensuite :** la photo s'ajoute à la fin de la bande d'images et une ligne « Reprise » entre dans l'historique de création. L'œuvre garde son numéro.

## Ajouter des photos

**Quand :** une œuvre a besoin de ses photos, ou de meilleures photos.

1. Préparez les photos dans Lightroom et exportez-les en JPEG vers les Photos du téléphone.
2. Ouvrez la fiche de l'œuvre et touchez la case **+** dans la bande d'images, puis choisissez les photos.
3. **Android seulement** : vous pouvez aussi, depuis Lightroom ou la galerie, Partager → PEM Workshop. Les images arrivent dans « Réception partage », où vous choisissez une nouvelle œuvre, une œuvre par image, ou de les joindre à une œuvre existante.
4. **iPhone** : le menu Partager ne propose pas l'application ; utilisez la case **+** de la fiche, ou le formulaire « Importer depuis cet appareil » de la page Réception partage.

**Ensuite :** dans la bande d'images, glissez ⠿ pour changer l'ordre : la première image est la couverture. Si vous n'êtes pas administrateur, les photos attendent la validation (« Photos en attente de validation »).

**Attention :** l'application réduit et convertit chaque image une fois, à l'envoi. Gardez les originaux dans Lightroom.

## Faire un constat d'état

**Quand :** vous examinez l'état d'une œuvre (arrivée, départ, prêt, encadrement), ou vous voyez un problème.

1. Fiche → Développé → **Constats** → **+ Nouveau constat**.
2. Type **Examen**, date, état (Excellent, Bon, Moyen, Mauvais, Critique), examiné par (vide = vous), notes.
3. Pour chaque problème : ce que c'est (craquelure, tache…), où (coin haut gauche, revers…), une photo, puis **Ajouter le problème**.
4. **Enregistrer le constat**.

**Ensuite :** le constat reste dans la fiche avec sa date et son auteur ; on peut le modifier plus tard.

**Attention :** une destruction, une perte ou un vol se déclarent aussi par un constat, mais seul un administrateur peut les enregistrer.

## L'étiquette QR

**Quand :** vous étiquetez une œuvre, ou vous voulez retrouver une œuvre étiquetée.

1. Fiche → Développé → **Étiquette physique** → **Imprimer** (ou « Copier le lien »).
2. Pour lire une étiquette : barre du bas → **Photo · doc** → **Étiquette QR**, ou l'appareil photo du téléphone.

**Ensuite :** l'étiquette ouvre la fiche de l'œuvre dans l'Atelier (il faut être connecté).
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
]
