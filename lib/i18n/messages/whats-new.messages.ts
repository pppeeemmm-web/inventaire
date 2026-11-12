import { defineMessages } from '../message-core'

/** "www.thepemworkshop.com 3.0" — what's new for the team (owner 2026-11-03). Items: `lib/whats-new.ts`. */
export const whatsNewMessages = defineMessages({
  wn_title: { fr: 'www.thepemworkshop.com 3.0', en: 'www.thepemworkshop.com 3.0' },
  wn_intro: {
    fr: 'Ce qui a changé ces derniers jours dans l’Atelier.',
    en: 'What changed in the Atelier over the last few days.',
  },

  // 3.0.3 (2026-11-12) — owner bug review + journal entries.
  wn_journal_main_tab_t: { fr: 'Le Journal devient l’entrée du terrain', en: 'The Journal becomes the field entry point' },
  wn_journal_main_tab_d: {
    fr: 'Sur le téléphone, le Hub commence par « Journal » : il ouvre la page d’aujourd’hui. En haut, quatre boutons : Écrire, Dicter, Note vocale et (admins) Capture. Les photos d’œuvres se prennent dans la section « Œuvres du jour », repliée tant qu’on ne l’ouvre pas — la journée ne charge plus la capture pour rien. Création, notes vocales et fiches modifiées sont repliées en bas. Les lignes « Session » et « Note » du Hub disparaissent.',
    en: 'On the phone, the Hub starts with "Journal": it opens today’s page. At the top, four buttons: Write, Dictate, Voice note and (admins) Capture. Work photos are taken in the "Works of the day" section, folded until opened — the day no longer loads capture for nothing. Création, voice notes and works changed are folded at the bottom. The Hub "Session" and "Note" rows are gone.',
  },
  wn_journal_links_t: { fr: 'Journal : entrées lisibles, concepts, suggestions IA', en: 'Journal: readable entries, concepts, AI suggestions' },
  wn_journal_links_d: {
    fr: 'Les entrées s’affichent avec titres, gras, listes et tableaux (le texte enregistré ne change pas) — dont l’Atlas, importé au 10 juin 2026. « Nouvelle entrée » peut relier un concept de Recherche. L’index relit les entrées et propose des œuvres ou concepts proches, marqués ✦ : seul un admin les valide ou les rejette ; rien n’est relié sans validation.',
    en: 'Entries display with headings, bold, lists and tables (the saved text does not change) — including the Atlas, imported on 10 June 2026. "New entry" can link a Research concept. The index reads entries and suggests nearby works or concepts, marked ✦: only an admin confirms or rejects them; nothing is linked without confirmation.',
  },
  wn_new_work_field_mode_t: { fr: 'Nouvelle œuvre sur le téléphone : le terrain d’abord', en: 'New work on the phone: field first' },
  wn_new_work_field_mode_d: {
    fr: 'Comme la fiche, le formulaire « Nouvelle œuvre » sur téléphone montre d’abord photo, commentaires, titre, technique, support et dimensions. Thèmes, historique, production, propriété et prix sont sous « Tous les champs » ; ils restent enregistrés comme avant.',
    en: 'Like the work drawer, the "New work" form on the phone shows photo, comments, title, technique, support and size first. Themes, history, production, ownership and price are under "All fields"; they still save as before.',
  },
  wn_drawer_field_mode_t: { fr: 'Fiche sur le téléphone : le terrain d’abord', en: 'Work drawer on the phone: field first' },
  wn_drawer_field_mode_d: {
    fr: 'Sur le téléphone, une fiche s’ouvre sur l’essentiel du terrain : photo, titre, technique, support, dimensions et commentaires, avec Enregistrer et 📷 en bas. Statut, propriété, prix, constats, groupes et séances sont repliés sous « Tous les champs » ; « Terrain seulement » les replie à nouveau. Rien ne change sur ordinateur, ni dans ce qui est enregistré.',
    en: 'On the phone, a work drawer opens on the field essentials: photo, title, technique, support, size and comments, with Save and 📷 at the bottom. Status, ownership, price, condition, groups and sessions are folded under "All fields"; "Field fields only" folds them again. Nothing changes on a computer, nor in what is saved.',
  },
  wn_journal_phone_t: { fr: 'Journal sur le téléphone, et dictée', en: 'Journal on the phone, and dictation' },
  wn_journal_phone_d: {
    fr: 'Sur le téléphone, le Journal montre soit la liste des jours, soit une journée en plein écran (« ← Jours » pour revenir). Dans « Nouvelle entrée », 🎙 Dicter écrit ce que vous dites dans le texte ; relisez avant d’ajouter. Une entrée dictée est marquée « Dictée · Non vérifiée ».',
    en: 'On the phone, the Journal shows either the list of days or one day full screen ("← Days" to go back). In "New entry", 🎙 Dictate writes what you say into the text; read it before adding. A dictated entry is marked "Dictated · Unverified".',
  },
  wn_journal_entries_t: { fr: 'Journal : toute la journée sur une page', en: 'Journal: the whole day on one page' },
  wn_journal_entries_d: {
    fr: 'Chaque journée du Journal rassemble tout ce qui a été noté ce jour-là : les « Entrées du jour » (étincelle, déclencheur, réflexion ou note, tapée telle quelle ; « #2399 » relie l’œuvre), ce qui a été ajouté dans Kaizen → Création, les notes vocales, la séance photo et les fiches modifiées (admins). Création reste à sa place dans Kaizen : la journée la lit, rien n’est copié. Une journée apparaît dès que quelque chose y est noté. « Écrire aujourd’hui » ouvre la page du jour, curseur dans le texte. Une entrée ne se modifie ni ne s’efface : pour corriger, on en ajoute une nouvelle.',
    en: 'Each Journal day gathers everything logged that day: the "Entries of the day" (a spark, a trigger, a reflection or a note, typed as is; "#2399" links the work), what was added in Kaizen → Création, voice notes, the photo session and works changed (admins). Création stays in Kaizen: the day reads it, nothing is copied. A day appears as soon as anything is logged on it. "Write today" opens today’s page with the cursor in the text box. An entry is never edited or erased: to correct it, add a new one.',
  },
  wn_drawer_lists_t: { fr: 'Technique, support et format toujours remplis', en: 'Technique, support and format always filled' },
  wn_drawer_lists_d: {
    fr: 'Une fiche ouverte juste après l’arrivée dans l’Atelier (ou depuis un lien) pouvait montrer des listes Technique / Support / Format vides, avec seulement « — ». Les listes se remplissent maintenant dès qu’elles sont chargées. Aucune donnée n’avait été perdue.',
    en: 'A work drawer opened right after reaching the Atelier (or from a link) could show empty Technique / Support / Format lists, with only "—". The lists now fill as soon as they are loaded. No data had been lost.',
  },
  wn_history_fields_t: { fr: 'Le journal et l’historique montrent tous les changements', en: 'Journal and history show every change' },
  wn_history_fields_d: {
    fr: 'La comparaison avant / après du journal de terrain et l’historique des versions d’une œuvre montrent maintenant aussi la technique, le support, le format, la TVA, la commission et l’anonymat — ils étaient oubliés.',
    en: 'The before / after view in the field journal and a work’s version history now also show technique, support, format, VAT, commission and anonymity — they were left out.',
  },
  wn_production_cascade_t: { fr: 'Production : une étape à la fois', en: 'Production: one stage at a time' },
  wn_production_cascade_d: {
    fr: 'Une œuvre suit Cataloguer → Photographier → Disponible. Tant qu’elle n’est pas cataloguée, elle reste dans la colonne Catalogue seulement, même si « à photographier » est coché ; elle ne peut plus apparaître dans deux colonnes de production. Encadrer, monter, expédier… peuvent toujours se cumuler.',
    en: 'A work goes Catalogue → Photograph → Available. Until it is catalogued it stays in the Catalogue column only, even with "needs photo" ticked; it can no longer show in two production columns. Framing, mounting, shipping… can still stack.',
  },
  wn_vault_types_t: { fr: 'Coffre : les types montrent tous leurs fichiers', en: 'Vault: types show all their files' },
  wn_vault_types_d: {
    fr: 'Cliquer un type (Factures, Contrats…) liste ses fichiers de tous les dossiers, avec le dossier de chacun. Les compteurs ne comptent que les vrais fichiers, et les types personnalisés (CV, scan…) ont leur ligne.',
    en: 'Clicking a type (Invoices, Contracts…) lists its files from every folder, with each file’s folder. Counters count real files only, and custom types (CV, scan…) have their own row.',
  },
  wn_period_start_t: { fr: 'Période trouvée depuis le début de production', en: 'Period found from the production start' },
  wn_period_start_d: {
    fr: 'Une œuvre sans année prend sa période depuis sa date de début de production (par exemple une œuvre commencée en session terrain le 9 novembre 2026 → Marseille).',
    en: 'A work without a year takes its period from its production start date (for example a work started in a field session on 9 November 2026 → Marseille).',
  },
  wn_single_address_t: { fr: 'Adresse du dépositaire reliée toute seule', en: 'Custodian’s address linked automatically' },
  wn_single_address_d: {
    fr: 'Quand un dépositaire n’a qu’une adresse, ses œuvres la prennent automatiquement — aussi quand l’adresse est ajoutée après coup. « Adresse absente » dans la Vue d’ensemble ne compte plus ces œuvres à tort.',
    en: 'When a custodian has a single address, their works take it automatically — also when the address is added later. "No address set" in Overview no longer counts these works by mistake.',
  },
  wn_fate_report_only_t: { fr: 'Détruite / perdue : seulement par un constat', en: 'Destroyed / lost: only through a condition report' },
  wn_fate_report_only_d: {
    fr: 'Le statut Détruite ou Perdue ne peut venir que d’un constat Destruction ou Perte — jamais d’une modification directe. Une seule façon de marquer le destin d’une œuvre.',
    en: 'The Destroyed or Lost status can only come from a Destruction or Loss condition report — never from a direct edit. One single way to record a work’s fate.',
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
