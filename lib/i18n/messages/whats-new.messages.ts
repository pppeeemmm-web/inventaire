import { defineMessages } from '../message-core'

/** "www.thepemworkshop.com 3.0" — what's new for the team (owner 2026-11-03). Items: `lib/whats-new.ts`. */
export const whatsNewMessages = defineMessages({
  wn_title: { fr: 'www.thepemworkshop.com 3.0', en: 'www.thepemworkshop.com 3.0' },
  wn_intro: {
    fr: 'Ce qui a changé ces derniers jours dans l’Atelier.',
    en: 'What changed in the Atelier over the last few days.',
  },

  // 3.0.1 (2026-11-03 pm) — plain language for the whole team.
  wn_custody_t: { fr: 'Propriétaire, dépositaire et adresse : chacun à sa place', en: 'Owner, custodian and address: each in its place' },
  wn_custody_d: {
    fr: 'Chaque œuvre dit maintenant à qui elle appartient, qui la garde et à quelle adresse. Chez Pem, l’adresse suit l’étape : Atelier pendant la production, Principal dès qu’elle est disponible. Une œuvre ne quitte l’atelier que par une commande (vente, dépôt, prêt — les expositions comprises) : la propriété passe à l’acheteur quand le paiement est réglé, la garde à la livraison. Pour un don, c’est vous qui décidez, et vous pouvez garder l’œuvre jusqu’à la remise. La liste montre « dépositaire · adresse ».',
    en: 'Each work now says who owns it, who holds it and at which address. At Pem, the address follows the stage: Atelier while in production, Principal once available. A work leaves the studio only through an order (sale, consignment, loan — exhibitions included): ownership moves to the buyer when payment is cleared, custody on delivery. For a gift you decide, and you can keep the work until it is handed over. The list shows "custodian · address".',
  },
  wn_safety_t: { fr: 'Vos données sont protégées', en: 'Your data is protected' },
  wn_safety_d: {
    fr: 'Chaque modification d’une œuvre garde l’ancienne version : un admin peut revenir en arrière. Les photos et fichiers supprimés restent 90 jours dans une corbeille avant de disparaître. Une copie complète de la base est faite chaque nuit. Les changements qu’un membre de l’équipe fait dans la fiche d’une œuvre existante attendent la validation d’un admin.',
    en: 'Every change to a work keeps the previous version: an admin can go back. Deleted photos and files stay 90 days in a bin before they disappear. A full copy of the database is made every night. Changes a team member makes in an existing work’s drawer wait for an admin to approve them.',
  },
  wn_lifetime_rules_t: { fr: 'Des garde-fous sur la vie d’une œuvre', en: 'Safeguards across a work’s life' },
  wn_lifetime_rules_d: {
    fr: 'Une œuvre vendue, donnée, archivée, détruite ou perdue ne peut plus être réservée, vendue ou mise en dépôt par erreur. Une vente demande un acquéreur, un dépôt ou un prêt un dépositaire — jamais Pem ; en dépôt, Pem reste propriétaire. Une vente annulée remet l’œuvre « Disponible » si elle était prête. Seul un admin peut supprimer définitivement une œuvre, mettre à la corbeille une œuvre vendue ou donnée, ou changer statut / prix sur plusieurs œuvres à la fois.',
    en: 'A sold, given, archived, destroyed or lost work can no longer be reserved, sold or consigned by mistake. A sale needs an acquirer, a consignment or loan a custodian — never Pem; on consignment, Pem stays the owner. A cancelled sale puts the work back to "Available" if it was ready. Only an admin can delete a work for good, move a sold or given work to the bin, or change status / price on several works at once.',
  },
  wn_destroyed_lost_t: { fr: 'Œuvre détruite ou perdue', en: 'Destroyed or lost work' },
  wn_destroyed_lost_d: {
    fr: 'Dans la fiche, un constat peut maintenant être une « Destruction » ou une « Perte », avec la date où c’est arrivé — même approximative : juste l’année, ou le mois. L’œuvre quitte alors le site public, les ventes et la production, et ses étapes sont verrouillées. Une œuvre perdue puis retrouvée reprend son statut d’avant avec « Retrouvée ». Une œuvre vendue ou donnée reste « Vendu » / « Don », avec la mention « détruite » ou « perdue ». Réservé aux admins.',
    en: 'In the work drawer, a condition report can now be a "Destruction" or a "Loss", with the date it happened — even roughly: just the year, or the month. The work then leaves the public site, sales and production, and its stages are locked. A lost work that turns up again gets its previous status back with "Found". A sold or given work stays "Sold" / "Gift", marked "destroyed" or "lost". Admins only.',
  },
  wn_live_list_t: { fr: 'La liste suit vos modifications', en: 'The list follows your changes' },
  wn_live_list_d: {
    fr: 'Après « Enregistrer » dans la fiche, la ligne de l’Inventaire se met à jour tout de suite — couleur du statut, lieu — sans recharger la page.',
    en: 'After "Save" in the work drawer, the Inventory row updates straight away — status colour, location — without reloading the page.',
  },
  wn_private_archive_gone_t: { fr: 'Statut « Archive privée » retiré', en: '"Private archive" status removed' },
  wn_private_archive_gone_d: {
    fr: 'Aucune œuvre ne l’utilisait : une œuvre chez un particulier est vendue ou donnée, et l’archive de Pem reste « Archive artiste ».',
    en: 'No work used it: a work held by a private person is sold or given, and Pem’s own archive stays "Artist archive".',
  },
  wn_drawer_clearer_t: { fr: 'Fiche plus lisible', en: 'Clearer work drawer' },
  wn_drawer_clearer_d: {
    fr: 'Une œuvre cataloguée mais pas encore prête (photo à faire) s’affiche en jaune. Le bouton « Enregistrer » reste visible quand on fait défiler, et l’image s’ouvre en grand dans un nouvel onglet.',
    en: 'A work that is catalogued but not ready yet (photo to take) shows in yellow. The "Save" button stays visible while you scroll, and the image opens full size in a new tab.',
  },
  wn_holder_address_t: { fr: 'L’adresse exacte du lieu', en: 'The exact address of the location' },
  wn_holder_address_d: {
    fr: 'Quand un contact a plusieurs adresses (par exemple Pem : Principal, Atelier, Rutali), la fiche dit à laquelle se trouve l’œuvre.',
    en: 'When a contact has several addresses (Pem, for example: Principal, Atelier, Rutali), the drawer says which one holds the work.',
  },
  wn_image_download_t: { fr: 'Télécharger les images', en: 'Download the images' },
  wn_image_download_d: {
    fr: 'Inventaire : un bouton télécharge en ZIP les images des œuvres affichées (ou sélectionnées), par lots de 100.',
    en: 'Inventory: one button downloads the images of the works shown (or selected) as a ZIP, 100 at a time.',
  },
  wn_overview_t: { fr: 'Vue d’ensemble sur un écran', en: 'Overview on one screen' },
  wn_overview_d: {
    fr: 'L’accueil de l’Atelier tient sur un écran d’ordinateur, avec les rappels à traiter et ce qui demande une action.',
    en: 'The Atelier home fits on one computer screen, with the reminders to deal with and what needs action.',
  },
  wn_planning_zoom_t: { fr: 'Suivi : se déplacer dans le temps', en: 'Pipeline: move through time' },
  wn_planning_zoom_d: {
    fr: 'Dans le planning du Suivi, on fait glisser et on zoome pour voir d’autres semaines ou mois ; aucun nom n’est coupé.',
    en: 'In the Pipeline timeline, drag and zoom to see other weeks or months; no name is cut off.',
  },
  wn_map_filters_t: { fr: 'Carte : filtres plus rapides', en: 'Map: quicker filters' },
  wn_map_filters_d: {
    fr: 'Boutons « Tous » et « Aucun » ; Alt-clic (ou appui long sur téléphone) sur un filtre pour ne garder que lui.',
    en: '"All" and "None" buttons; Alt-click (or long-press on a phone) a filter to keep only that one.',
  },
  wn_no_field_wipe_t: { fr: 'Enregistrer n’efface plus rien', en: 'Saving no longer erases anything' },
  wn_no_field_wipe_d: {
    fr: 'Avant, enregistrer une œuvre depuis certains formulaires pouvait vider des informations que ce formulaire n’affichait pas. C’est corrigé.',
    en: 'Before, saving a work from some forms could empty information that form did not show. That is fixed.',
  },
  wn_dont_show: { fr: 'Ne plus afficher', en: 'Don’t show again' },
  wn_close: { fr: 'Fermer', en: 'Close' },
  wn_open_kaizen: { fr: 'Voir dans Kaizen → Nouveautés', en: 'See in Kaizen → What’s new' },
  wn_kaizen_btn: { fr: 'Nouveautés 3.0', en: 'What’s new 3.0' },
  wn_kaizen_hide: { fr: 'Masquer les nouveautés', en: 'Hide what’s new' },

  wn_status_colours_t: { fr: 'Couleurs des statuts', en: 'Status colours' },
  wn_status_colours_d: {
    fr: 'Réservé, consigné, prêt : magenta. Vendu : turquoise. Don : noir & blanc.',
    en: 'Reserved, consigned, loan: magenta. Sold: turquoise. Gift: black & white.',
  },
  wn_rules_t: { fr: 'Règles automatiques sur les œuvres', en: 'Automatic rules on works' },
  wn_rules_d: {
    fr: 'Archive artiste = cataloguée. Sans lieu, une œuvre est à l’atelier. Profondeur 0,1 cm pour les œuvres à plat (pas encadrées, pas montées, pas de sculpture).',
    en: 'Artist archive = catalogued. With no location, a work is at the atelier. Depth 0.1 cm for flat works (not framed, not mounted, not a sculpture).',
  },
  wn_production_dates_t: { fr: 'Dates de production', en: 'Production dates' },
  wn_production_dates_d: {
    fr: 'Dans la fiche : début → fin et nombre de jours. La fin se remplit seule quand l’œuvre est cataloguée ou archivée.',
    en: 'In the work drawer: start → end and the number of days. The end fills itself in when the work is catalogued or archived.',
  },
  wn_period_source_t: { fr: 'Période & source', en: 'Period & source' },
  wn_period_source_d: {
    fr: 'Chaque œuvre a sa période (d’après l’année) et ses sources — Mémoire, Sur le motif, Photo, Lieu… — avec une ligne de précision. Filtres et colonne dans l’Inventaire.',
    en: 'Each work has its period (from its year) and its sources — Memory, From life, Photo, Place… — with a one-line detail. Filters and a column in Inventory.',
  },
  wn_bulk_source_t: { fr: 'Une source pour plusieurs œuvres', en: 'One source for several works' },
  wn_bulk_source_d: {
    fr: 'Inventaire : sélectionnez des œuvres, puis « Source… ».',
    en: 'Inventory: select works, then "Source…".',
  },
  wn_colours_t: { fr: 'Palette et filtre couleurs', en: 'Palette and colour filter' },
  wn_colours_d: {
    fr: 'Les couleurs de chaque photo par famille. Inventaire → Couleurs : avec / sans une couleur, puis « Affiner » pour les nuances claires ou foncées.',
    en: 'Each photo’s colours by family. Inventory → Colours: with / without a colour, then "Refine" for light or dark shades.',
  },
  wn_constats_t: { fr: 'Constats d’état', en: 'Condition reports' },
  wn_constats_d: {
    fr: 'Dans la fiche : un constat (date, état, actions) avec des problèmes et leurs photos.',
    en: 'In the work drawer: a report (date, condition, action) with issues and their photos.',
  },
  wn_reports_t: { fr: 'Rapports', en: 'Reports' },
  wn_reports_d: {
    fr: 'Choisir les champs, filtrer, trier, enregistrer un rapport, imprimer ou exporter. Bouton « Rapport » dans l’Inventaire, la Production, Kaizen, les Ventes et les Contacts.',
    en: 'Pick fields, filter, sort, save a report, print or export. "Report" button in Inventory, Production, Kaizen, Sales and Contacts.',
  },
  wn_kaizen_t: { fr: 'Kaizen', en: 'Kaizen' },
  wn_kaizen_d: {
    fr: 'Idées et améliorations : Création, et Opérations & Stratégie (Système, Business). Un badge compte ce que les autres ont ajouté. Captures d’écran possibles sur chaque entrée.',
    en: 'Ideas and improvements: Creation, and Operations & Strategy (System, Business). A badge counts what others added. Screenshots can go on each entry.',
  },
  wn_notes_t: { fr: 'Trier les notes vocales', en: 'Sorting voice notes' },
  wn_notes_d: {
    fr: 'Notes → Trier : rattacher une note à une recherche, une œuvre, un projet, ou en faire un rappel.',
    en: 'Notes → Sort: link a note to a research concept, a work, a project, or make it a reminder.',
  },
  wn_qr_t: { fr: 'Étiquette QR', en: 'QR label' },
  wn_qr_d: {
    fr: 'Le lien de l’étiquette ouvre bien l’œuvre, et « Imprimer » affiche l’étiquette.',
    en: 'The label’s link opens the work, and "Print" shows the label.',
  },
  wn_sidebar_t: { fr: 'Menu réorganisé', en: 'Reorganised menu' },
  wn_sidebar_d: {
    fr: 'Kaizen en tête ; Contacts et Carte dans Commercial ; le comptage des fournitures dans Studio → Fournitures.',
    en: 'Kaizen at the top; Contacts and Map under Commercial; supplies counting in Studio → Supplies.',
  },
  wn_fiscal_t: { fr: 'Revenus & dépenses par année', en: 'Income & expenses by year' },
  wn_fiscal_d: {
    fr: 'Chaque année, l’année en cours comparée à la même période l’an dernier, et un tableau croisé.',
    en: 'Every year, this year against the same dates last year, and a pivot table.',
  },
})
