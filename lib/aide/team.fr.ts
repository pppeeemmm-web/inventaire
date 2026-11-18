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
- Un membre de l'équipe voit presque tout. Certaines modifications d'une œuvre existante attendent la validation d'un administrateur, et quelques écrans sont réservés aux administrateurs.

## Ce que l'application ne fait pas

- Elle ne retouche pas les photos. Les photos du catalogue se préparent dans Lightroom, puis on les envoie à l'application par le menu Partager du téléphone.
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

L'icône ouvre directement **Aujourd'hui**. Une fois installée, l'application apparaît aussi dans le menu Partager du téléphone : c'est par là qu'arrivent les photos exportées de Lightroom.

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
]
