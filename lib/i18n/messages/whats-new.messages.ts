import { defineMessages } from '../message-core'

/** "www.thepemworkshop.com 3.0" — what's new for the team (owner 2026-11-03). Items: `lib/whats-new.ts`. */
export const whatsNewMessages = defineMessages({
  wn_title: { fr: 'www.thepemworkshop.com 3.0', en: 'www.thepemworkshop.com 3.0' },
  wn_intro: {
    fr: 'Ce qui a changé ces trois derniers jours dans l’Atelier.',
    en: 'What changed in the Atelier over the last three days.',
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
