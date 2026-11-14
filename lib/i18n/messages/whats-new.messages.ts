import { defineMessages } from '../message-core'

/** "www.thepemworkshop.com 3.0" — what's new for the team (owner 2026-11-03). Items: `lib/whats-new.ts`. */
export const whatsNewMessages = defineMessages({
  wn_title: { fr: 'www.thepemworkshop.com 3.0', en: 'www.thepemworkshop.com 3.0' },
  wn_intro: {
    fr: 'Ce qui a changé ces derniers jours dans l’Atelier.',
    en: 'What changed in the Atelier over the last few days.',
  },

  // 3.1.8 (2026-11-14) — export rebuilt with a live preview (B3); Constellation arrows.
  // 3.1.13 (2026-11-14) — « Historique de création » (Pem: "a history for the creation where 'place' is just like 'history'").
  wn_creation_history_t: { fr: 'Historique de création : où et quand l’œuvre a été faite', en: 'Creation history: where and when the work was made' },
  wn_creation_history_d: {
    fr: 'Dans la fiche, « Lieu de création » devient une liste datée, comme l’historique : « 2021 · Commencée · Tooreeney », « 2026 · Terminée · Marseille Atelier ». Chaque ligne a une date (année, mois ou jour), une étape, un lieu et une note. « + Ligne » en ajoute une ; toucher une ligne la modifie ou la supprime. Une session de terrain tenue à l’un de vos lieux propose sa ligne (« Ajouter »), jamais ajoutée toute seule. Si les lignes tombent dans deux périodes, la fiche demande laquelle — Inventaire → Période → « Périodes à trancher » les liste. Inventaire affiche le parcours (« Tooreeney → Marseille Atelier ») et le filtre Lieu trouve chaque étape. Sans ligne, le lieu reste celui de la période, en gris. Modifier par lot : « Lieu de création » ajoute une ligne à chaque œuvre, sans rien effacer.',
    en: 'On the card, « Place made » becomes a dated list, like the history: « 2021 · Started · Tooreeney », « 2026 · Finished · Marseille Atelier ». Each line has a date (year, month or day), a step, a place and a note. « + Line » adds one; tap a line to edit or delete it. A field session held at one of your places offers its line (« Add »), never added by itself. If the lines fall in two periods, the card asks which one — Inventory → Period → « Periods to decide » lists them. Inventory shows the route (« Tooreeney → Marseille Atelier ») and the Place filter finds every step. With no line, the place stays the period’s, in grey. Batch modify: « Place made » adds a line to each work, erasing nothing.',
  },
  // 3.1.12 (2026-11-14) — place suggested from the field session.
  wn_place_from_session_t: { fr: 'Lieu de création : proposé par la session de terrain', en: 'Place made: suggested by the field session' },
  wn_place_from_session_d: {
    fr: 'Quand une œuvre a été prise en photo dans une session de terrain avec sa position, la fiche cherche le lieu enregistré le plus proche (moins de 2 km). S’il diffère du lieu affiché — ou s’il n’y en a pas — elle propose « Session de terrain du 22 août 2026 : Marseille Atelier » avec « Utiliser » ; s’il est le même, elle écrit « Confirmé par la session de terrain ». Rien n’est posé tout seul, et un lieu choisi à la main n’est jamais remplacé (changer la date de l’œuvre ne touche pas non plus à son lieu).',
    en: 'When a work was photographed in a field session that recorded its position, the card looks for the nearest saved place (under 2 km). If it differs from the place shown — or there is none — it offers « Field session of 22 Aug 2026: Marseille Atelier » with « Use it »; if it is the same, it says « Confirmed by the field session ». Nothing is set by itself, and a place picked by hand is never replaced (changing the work’s date does not touch its place either).',
  },
  // 3.1.11 (2026-11-14) — voice notes: record first (Pem, after a morning in the field).
  wn_voice_record_first_t: { fr: 'Note vocale : on enregistre d’abord', en: 'Voice note: record first' },
  wn_voice_record_first_d: {
    fr: 'Ouvrir une note vocale lance l’enregistrement tout de suite : gros bouton rouge, minuteur, niveau du micro. « Arrêter et enregistrer » envoie la note aussitôt (date et heure = début de l’enregistrement) et affiche « Enregistrée · 0:42 » avec la réécoute ; titre, type, œuvre, texte et rappel s’ajoutent après, s’il le faut. Si l’envoi échoue, c’est écrit en rouge avec « Réessayer » — la note reste sur le téléphone tant que la fenêtre est ouverte. Si l’écran se verrouille, la note s’arrête et elle est enregistrée. Dans Notes, chaque ligne montre la durée de l’audio. Micro refusé : la fenêtre dit où l’autoriser (c’est le téléphone qui décide, l’app ne peut pas se l’accorder pour toujours).',
    en: 'Opening a voice note starts recording at once: big red button, timer, mic level. « Stop and save » sends the note straight away (date and time = start of the recording) and shows « Saved · 0:42 » with a replay; title, kind, work, text and reminder are added after, if needed. If the upload fails it says so in red with « Retry » — the note stays on the phone while the window is open. If the screen locks, the note stops and is saved. In Notes each row shows the audio length. Mic refused: the window says where to allow it (the phone decides; the app cannot grant itself the mic for good).',
  },
  wn_place_from_period_t: { fr: 'Le lieu suit la période (l’atelier du moment)', en: 'The place follows the period (the atelier of the time)' },
  wn_place_from_period_d: {
    fr: 'Donnez un lieu à une période (Gérer périodes et sources → Lieu de la période) : toutes ses œuvres sans lieu propre y sont rangées, en gris « d’après la période ». Choisir un autre lieu sur la fiche sort l’œuvre de la règle ; « Revenir au lieu de la période » l’y remet (aussi en Modifier la sélection). Dans l’Inventaire, le lieu s’affiche sous la période, avec un filtre Lieu ; Rapports et la recherche le lisent aussi. Un lieu a maintenant une adresse, et « Trouver les coordonnées » le place sur la carte.',
    en: 'Give a period a place (Manage periods and sources → Period’s place): all its works without a place of their own sit there, greyed « from the period ». Picking another place on the card takes the work out of the rule; « Back to the period’s place » puts it back (also in Modify selection). In Inventory the place shows under the period, with a Place filter; Reports and search read it too. A place now has an address, and « Find coordinates » puts it on the map.',
  },
  wn_place_add_from_card_t: { fr: 'Lieu de création : ajouter un lieu depuis la fiche', en: 'Place made: add a place from the work card' },
  wn_place_add_from_card_d: {
    fr: 'Le choix « Lieu de création » était vide tant qu’aucun lieu n’avait été enregistré. Il propose maintenant « + Lieu » (et « + Nouveau lieu… » dans la liste) : nom, ville, pays, coordonnées si vous les avez ; le lieu est créé et posé sur l’œuvre en un geste.',
    en: 'The « Place made » choice was empty until a place had been saved. It now offers « + Place » (and « + New place… » in the list): name, town, country, coordinates if you have them; the place is created and set on the work in one go.',
  },
  wn_export_panel_light_t: { fr: 'Export : tous les réglages sur un écran, N&B clair', en: 'Export: every setting on one screen, light B&W' },
  wn_export_panel_light_d: {
    fr: 'Les réglages d’export tiennent sur un écran, sans défiler : Page, Champs, Image. La ligne « Cadre » donne la place de l’image sur la page (en cm) et, à côté, les pixels qui la remplissent : changer la résolution ne change que les pixels, jamais le cadre. Nouveau en Couleur : N&B clair, un gris adouci (le noir imprime à 65 %) qui met environ 35 % d’encre en moins sur les images.',
    en: 'The export settings fit on one screen, no scrolling: Page, Fields, Image. The « Frame » line gives the image’s space on the page (in cm) and, next to it, the pixels that fill it: changing the resolution changes only the pixels, never the frame. New in Colour: Light B&W, a softened grey (black prints at 65 %) that puts about 35 % less ink on the images.',
  },
  wn_export_image_quality_t: { fr: 'Export : écran ou impression, résolution, noir & blanc', en: 'Export: screen or print, resolution, black & white' },
  wn_export_image_quality_d: {
    fr: 'Dans Exporter, choisissez Écran (72 dpi, fichier léger) ou Impression (300 dpi), changez la résolution (72 / 150 / 300 dpi) et passez en noir & blanc. Chaque image est taillée à sa taille imprimée : 550 œuvres en fiches (2 par page, petite image) passent d’environ 326 Mo à 5 Mo pour l’écran ou 65 Mo pour l’impression à 300 dpi. En fiches, la taille de l’image suit le nombre de fiches par page (1 par page = toute la largeur). La taille estimée du fichier s’affiche au-dessus de l’aperçu.',
    en: 'In Export, pick Screen (72 dpi, a light file) or Print (300 dpi), change the resolution (72 / 150 / 300 dpi) and switch to black & white. Each image is cut to its printed size: 550 works as cards (2 per page, small image) go from about 326 MB to 5 MB for screen or 65 MB for print at 300 dpi. In Cards, the image size follows the cards per page (1 per page = the full width). The estimated file size shows above the preview.',
  },
  wn_constellation_arrows_t: { fr: 'Constellation : les liens orientés ont une flèche', en: 'Constellation: directed links get an arrow' },
  wn_constellation_arrows_d: {
    fr: '« Peinte sur », « Dérivée de » et « Répond à » ont un sens : la carte dessine maintenant une petite flèche de l’œuvre d’origine vers la nouvelle. Série, diptyque, influence et proximité restent des traits simples.',
    en: '“Painted on”, “Derived from” and “Answers” have a direction: the map now draws a small arrow from the original work to the new one. Series, diptych, influence and proximity stay plain lines.',
  },
  wn_export_preview_t: { fr: 'Export : on voit le fichier avant de l’exporter', en: 'Export: see the file before you export it' },
  wn_export_preview_d: {
    fr: 'L’export de la sélection s’ouvre en grand : en haut, le type (Fiches, Grille, Liste rapide, Étiquettes, CSV / XLSX) ; à gauche, les réglages ; au centre, le vrai fichier, refait à chaque changement sur les premières œuvres. Nouveau : Étiquettes — planches A4 (3 × 7, 2 × 7, 2 × 4, 5 × 13), avec le numéro de la première étiquette libre pour une planche entamée. Nouveau : CSV / XLSX — le tableau des champs cochés, téléchargeable. Vue d’ensemble : le signal Argent passe au ■ si le net de l’année est négatif.',
    en: 'The selection export opens large: the type on top (Cards, Grid, Quick list, Labels, CSV / XLSX), settings on the left, and in the middle the real file, redone on the first works at every change. New: Labels — A4 sheets (3 × 7, 2 × 7, 2 × 4, 5 × 13), with the first free label for a partly used sheet. New: CSV / XLSX — the table of ticked fields, ready to download. Overview: the Money signal turns ■ when the year’s net is negative.',
  },
  // 3.1.7 (2026-11-14) — periods by date + place made (A3).
  wn_periods_dates_places_t: { fr: 'Périodes au jour près, et le lieu de chaque œuvre', en: 'Periods to the day, and where each work was made' },
  wn_periods_dates_places_d: {
    fr: 'Une période a maintenant une date de début et de fin, pas seulement des années : Galway s’arrête le 12 juin 2024, Marseille commence le 13. Une œuvre datée (fin ou début de production, ou sa date) tombe dans la bonne période ; avec l’année seule, la fiche signale quand l’année couvre deux périodes. Nouveau : le lieu de création de chaque œuvre (fiche, modification en lot, Rapports, recherche). La liste des lieux se gère avec les périodes ; une période peut proposer un lieu, jamais le poser seule.',
    en: 'A period now has a start and end date, not just years: Galway ends on 12 June 2024, Marseille starts on the 13th. A dated work (production end or start, or its date) lands in the right period; with a year alone, the card says when that year spans two periods. New: the place each work was made (work card, batch modify, Reports, search). The places list is managed with the periods; a period can suggest a place, never set it by itself.',
  },
  // 3.1.6 (2026-11-14) — AI descriptions rated for usefulness (A2); field place + weather automatic (A4).
  wn_field_context_auto_t: { fr: 'Session terrain : lieu et météo tout seuls', en: 'Field session: place and weather on their own' },
  wn_field_context_auto_d: {
    fr: 'Sur le téléphone, ouvrir la session du jour enregistre seul le lieu et la météo (température, vent, humidité) — le navigateur demande l’accès une fois. Jamais sur un jour passé, jamais par-dessus une mesure déjà faite. Refuser l’accès ne bloque rien ; le bouton « Lieu et météo » relance la mesure à la main. Un jour qui n’a que le lieu et la météo reste un jour vide.',
    en: 'On the phone, opening today’s session records the place and the weather (temperature, wind, humidity) on its own — the browser asks for access once. Never on a past day, never over a reading already taken. Refusing access blocks nothing; the “Location & weather” button takes the reading by hand. A day with only place and weather still counts as empty.',
  },
  wn_ai_description_rating_t: { fr: 'Fiche : ce que l’IA voit, et si c’est utile', en: 'Work card: what the AI sees, and whether it helps' },
  wn_ai_description_rating_d: {
    fr: 'Dans la fiche d’une œuvre, une section repliée « ✦ Vu par l’IA » montre la description faite par le modèle local et sa ligne d’échos, marquées IA. Au lieu de juste / faux, notez son utilité de 0 (inutile) à 4 (très juste) ; la note garde qui et quand. Une description notée 0 sort de la recherche. La moyenne par consigne dit s’il vaut la peine de la relancer. Jamais copiée dans les commentaires. Rapports : champ « Utilité de la description IA ».',
    en: 'In a work’s card, a folded “✦ Seen by AI” section shows the local model’s description and its echoes line, marked AI. Instead of right / wrong, rate how useful it is from 0 (useless) to 4 (spot on); the rating keeps who and when. A description rated 0 leaves search. The average per prompt tells whether the prompt is worth re-running. Never copied into the comments. Reports: “AI description usefulness” field.',
  },
  // 3.1.5 (2026-11-13) — Overview dashboard (B1) + batch modify (B2), rebuilt from the design pass.
  wn_overview_dashboard_t: { fr: 'Vue d’ensemble : l’atelier d’un coup d’œil', en: 'Overview: the studio at a glance' },
  wn_overview_dashboard_d: {
    fr: 'La Vue d’ensemble tient sur un écran, sans défiler. En haut, une rangée de signaux toujours à la même place : ■ à corriger, ▲ à surveiller, ● OK, ○ info — forme et couleur, lisibles de loin. Un clic sur un signal mène à l’onglet qui le corrige. Dessous, quatre colonnes : à traiter et santé du catalogue · échéances, semaine et rappels · argent et collection · tâches locales, idées, à revoir et dernières œuvres. Laissez la souris sur un panneau marqué « +N » : il s’ouvre sur place. Sur téléphone, la liste des signaux, le pire d’abord, puis les rappels.',
    en: 'The Overview fits one screen, no scrolling. At the top, a row of signals that always sit in the same place: ■ wrong, ▲ attention, ● OK, ○ info — shape and colour, readable from across the room. Clicking a signal goes to the tab that fixes it. Below, four columns: to do and catalogue health · deadlines, week and reminders · money and collection · local jobs, ideas, see again and latest works. Rest the pointer on a panel marked “+N”: it opens in place. On the phone, the list of signals, worst first, then the reminders.',
  },
  // 3.1.5 (2026-11-13) — batch modify rebuilt from the design pass (B2).
  wn_batch_modify_mixer_t: { fr: 'Modification en lot : tout d’un coup d’œil', en: 'Batch modify: everything at a glance' },
  wn_batch_modify_mixer_d: {
    fr: 'La fenêtre a été redessinée comme une table de mixage : tous les champs visibles sans défiler, en trois colonnes (identité · prix · emplacement / attributs · note / thèmes · groupes). Un champ inchangé reste gris ; un champ qui va changer passe en doré, avec ✕ pour l’annuler. En bas, le nombre de champs qui vont changer et leur liste. Attributs en grille — / Oui / Non. Thèmes : n/N indique combien d’œuvres de la sélection l’ont déjà. Nouveau groupe directement depuis la fenêtre. Sur téléphone, une colonne et la barre Appliquer reste en bas.',
    en: 'The window was redrawn like a mixing desk: every field visible without scrolling, in three columns (identity · price · location / flags · note / themes · groups). An unchanged field stays grey; a field that will change turns gold, with ✕ to undo it. At the bottom, how many fields will change and which. Flags in a — / Yes / No grid. Themes: n/N shows how many works in the selection already have it. New group right from the window. On the phone, one column and the Apply bar stays at the bottom.',
  },

  // 3.1.4 (2026-11-13) — inventory table tidy + overview thumbnails.
  wn_inventory_table_tidy_t: { fr: 'Inventaire : un tableau qui tient', en: 'Inventory: a table that fits' },
  wn_inventory_table_tidy_d: {
    fr: 'Plus rien ne déborde ni ne se chevauche. Les gros prix s’écrivent en court (180 M €), le montant exact au survol. Titre et médium sur deux lignes, le texte entier au survol. L’état devient une pastille de couleur. Quand la liste est étroite (fiche ouverte), dimensions + année et contact + emplacement partagent une colonne, et le tableau ne part plus à droite. Vue d’ensemble : les vignettes « Documentation récente » ouvrent l’œuvre et montrent la loupe.',
    en: 'Nothing overflows or overlaps any more. Big prices are written short (€180m), the exact amount on hover. Title and medium on two lines, the full text on hover. Status becomes a colour dot. When the list is narrow (card open), dimensions + year and contact + location share a column, and the table no longer runs off the right. Overview: the “Recent documentation” thumbnails open the work and show the loupe.',
  },

  // 3.0.3 (2026-11-12) — owner bug review + journal entries.
  wn_batch_modify_t: { fr: 'Modification en lot : notes ajoutées, période, plus compact', en: 'Batch modify: notes added, period, more compact' },
  wn_batch_modify_d: {
    fr: 'Une note écrite en lot s’ajoute sous les commentaires de chaque œuvre, sur une nouvelle ligne datée — plus rien n’est écrasé. Nouveau champ Période (automatique, aucune, ou une période) pour toutes les œuvres choisies. Le panneau tient sur trois colonnes.',
    en: 'A note written in batch is added under each work’s comments, on a new dated line — nothing is overwritten any more. New Period field (automatic, none, or a period) for all selected works. The panel uses three columns.',
  },
  wn_inventory_loupe_t: { fr: 'Inventaire : loupe sur les vignettes', en: 'Inventory: loupe on thumbnails' },
  wn_inventory_loupe_d: {
    fr: 'Sur ordinateur, laissez la souris sur une vignette : l’image s’affiche en grand, entière, sur le côté libre de l’écran. Sur téléphone, appui long sur une vignette : l’image en plein écran ; touchez pour fermer. Le double-clic qui élargissait le panneau est retiré.',
    en: 'On a computer, rest the mouse on a thumbnail: the picture shows large and whole on the free side of the screen. On a phone, long-press a thumbnail: the picture full screen; tap to close. The double-click that widened the panel is gone.',
  },
  wn_see_again_link_type_t: { fr: '« Lier » : choisir le type et le sens', en: '"Link": choose the type and direction' },
  wn_see_again_link_type_d: {
    fr: 'Dans « À revoir aujourd’hui », « Lier » ouvre un choix : peinte sur, dérivée de, répond à, même série, diptyque, influence, proche de — et ⇄ pour inverser le sens (#A → #B). Les mêmes liens que la fiche de l’œuvre et la Constellation.',
    en: 'In "See again today", "Link" opens a choice: painted on, derived from, answers, same series, diptych, influence, close to — and ⇄ to swap the direction (#A → #B). The same links as the work card and the Constellation.',
  },
  wn_journal_jump_t: { fr: 'Journal : aller à une date', en: 'Journal: go to a date' },
  wn_journal_jump_d: {
    fr: 'Au-dessus de la liste des jours, « Aller au » + une date : le Journal ouvre ce jour, ou le jour le plus proche qui a quelque chose. Plus besoin de faire défiler.',
    en: 'Above the list of days, "Go to" + a date: the Journal opens that day, or the nearest day that has something. No more long scrolling.',
  },
  wn_sign_out_t: { fr: 'Se déconnecter, changer son mot de passe', en: 'Sign out, change your password' },
  wn_sign_out_d: {
    fr: 'En haut de l’Atelier (et dans le menu sur téléphone) et en bas du Hub : « Se déconnecter ». Les comptes avec e-mail + mot de passe ont aussi « Changer le mot de passe » ; les comptes Google ne l’ont pas (le mot de passe est chez Google).',
    en: 'At the top of the Atelier (in the menu on a phone) and at the bottom of the Hub: "Sign out". Email + password accounts also get "Change password"; Google accounts don’t (Google holds the password).',
  },
  wn_see_again_t: { fr: 'À revoir aujourd’hui', en: 'See again today' },
  wn_see_again_d: {
    fr: 'En haut du Journal du jour et dans la Vue d’ensemble : une entrée d’une autre année à la même semaine, une œuvre sans aucun lien, et deux œuvres proches pas encore liées. Les mêmes toute la journée. « Lier », « Sans rapport », « Écrire à ce sujet » (le formulaire s’ouvre avec #numéro). Rien n’est écrit par une IA : la carte choisit seulement quoi montrer.',
    en: 'At the top of today’s Journal and in Overview: an entry from this week in another year, a work with no link at all, and two close works not linked yet. The same all day. "Link", "Not related", "Write about it" (the form opens with #number). Nothing is written by AI: the card only chooses what to show.',
  },
  wn_contact_popup_t: { fr: 'Le contact s’ouvre par-dessus l’œuvre', en: 'The contact opens over the work' },
  wn_contact_popup_d: {
    fr: 'Dans la fiche d’une œuvre, ↗ à côté du propriétaire, du lieu ou de l’acheteur ouvre la fiche du contact par-dessus : on la modifie, on ferme, l’œuvre est toujours là. Plus d’aller-retour vers Contacts.',
    en: 'In a work’s card, ↗ next to the owner, location or buyer opens the contact on top: edit, close, the work is still there. No more round trip to Contacts.',
  },
  wn_work_preview_t: { fr: 'Aperçu d’une œuvre sur #numéro', en: 'Work preview on #number' },
  wn_work_preview_d: {
    fr: 'Partout où un #numéro d’œuvre est un lien (Journal, entrées, Kaizen, capture, contacts) : survol à la souris ou appui long sur téléphone = petite fiche (image, titre, année, technique, statut). Un clic ouvre toujours l’œuvre. Dans le texte des entrées, #1234 devient un lien.',
    en: 'Wherever a #work number is a link (Journal, entries, Kaizen, capture, contacts): mouse hover or a long press on a phone shows a small card (image, title, year, technique, status). A click still opens the work. In entry text, #1234 becomes a link.',
  },
  wn_work_links_t: { fr: 'Liens entre œuvres depuis la fiche', en: 'Links between works from the card' },
  wn_work_links_d: {
    fr: 'Fiche d’une œuvre → « Liens avec d’autres œuvres » : peinte sur, dérivée de, répond à, même série, diptyque, influence, proche de — avec le numéro de l’autre œuvre. Les mêmes liens que la Constellation.',
    en: 'A work’s card → "Links to other works": painted on, derived from, answers, same series, diptych, influence, close to — with the other work’s number. The same links as the Constellation.',
  },
  wn_production_drag_t: { fr: 'Production : glisser une carte en arrière', en: 'Production: drag a card back' },
  wn_production_drag_d: {
    fr: 'Sur ordinateur, glissez une carte vers une autre colonne pour déplacer la tâche. Vers « Cataloguer » = retour en production (non cataloguée, statut En production). Avancer vers « Photographier » passe toujours par ✓.',
    en: 'On a computer, drag a card to another column to move the to-do. Onto "Catalogue" = back to production (not catalogued, status In production). Moving forward to "Photograph" still goes through ✓.',
  },
  wn_voice_transcripts_t: { fr: 'Notes vocales transcrites dans le Journal', en: 'Voice notes transcribed in the Journal' },
  wn_voice_transcripts_d: {
    fr: 'Une note vocale enregistrée (🎤) est transcrite sur le PC de l’atelier et apparaît au jour de la note, avec son audio et la marque « ✦ transcription · moteur · non vérifiée ». L’audio reste la référence ; la transcription est trouvable par ⌘K.',
    en: 'A recorded voice note (🎤) is transcribed on the studio PC and appears on the note’s day, with its audio and the mark "✦ transcript · engine · unverified". The audio stays the reference; the transcript is found by ⌘K.',
  },
  wn_search_wider_t: { fr: 'La recherche connaît mieux les œuvres', en: 'Search knows the works better' },
  wn_search_wider_d: {
    fr: 'La recherche (⌘K) et les suggestions ✦ tiennent compte, pour chaque œuvre, du support, de l’année, des thèmes, de la période, de la source et des couleurs dominantes — plus seulement du titre, des commentaires et de la technique. Les œuvres sans titre deviennent trouvables (« pierre noire Marseille », « huile bleu »).',
    en: 'Search (⌘K) and ✦ suggestions now use each work’s support, year, themes, period, source and main colours — not just title, comments and technique. Untitled works can be found ("black chalk Marseille", "oil blue").',
  },
  wn_contact_bounce_t: { fr: 'De l’œuvre au contact, et retour', en: 'From work to contact and back' },
  wn_contact_bounce_d: {
    fr: 'Dans la fiche d’une œuvre (Propriété), le bouton ↗ à côté du propriétaire, du lieu ou de l’acheteur ouvre la fiche du contact ; en haut, « ← Retour à l’œuvre #… » rouvre l’œuvre. Production : le crayon ✎ d’une carte ouvre maintenant l’œuvre sur place (il ouvrait la Vue d’ensemble).',
    en: 'In a work’s drawer (Ownership), the ↗ next to the owner, location or buyer opens the contact card; at the top, "← Back to work #…" reopens the work. Production: a card’s ✎ pencil now opens the work in place (it opened Overview).',
  },
  wn_journal_day_tidy_t: { fr: 'Page du jour plus claire', en: 'Clearer day page' },
  wn_journal_day_tidy_d: {
    fr: 'Les sections repliées (Création, notes vocales, œuvres modifiées) ont une flèche ▸. Un jour vide affiche « Rien encore ». Dans la liste des jours, les admins voient « ✦ n à valider » : les suggestions des entrées Atlas sont sur le mercredi 10 juin 2026.',
    en: 'Folded sections (Création, voice notes, works changed) have a ▸ arrow. An empty day reads "Nothing yet". In the day list, admins see "✦ n to review": the Atlas entry suggestions are on Wednesday 10 June 2026.',
  },
  wn_journal_search_t: { fr: 'Le Journal dans la recherche et la Constellation', en: 'The Journal in search and Constellation' },
  wn_journal_search_d: {
    fr: 'La recherche (⌘K) trouve aussi les entrées du journal : un clic ouvre le jour. Dans la Constellation, le panneau d’une œuvre liste ses entrées validées. Les suggestions ✦ sont plus strictes : 29 gardées sur 75, les autres retirées (rien n’est effacé). Ouvrir la capture d’un jour sans rien ajouter ne laisse plus de jour « ouvert » vide.',
    en: 'Search (⌘K) also finds journal entries: a click opens the day. In Constellation, a work’s panel lists its validated entries. ✦ suggestions are stricter: 29 of 75 kept, the rest retired (nothing deleted). Opening capture on a day and adding nothing no longer leaves an empty "opened" day.',
  },
  wn_phone_drawer_inventory_t: { fr: 'Fiche et inventaire plus légers sur téléphone', en: 'Lighter work drawer and inventory on the phone' },
  wn_phone_drawer_inventory_d: {
    fr: 'Fiche d’œuvre : seuls les thèmes choisis s’affichent (« Modifier les thèmes » ouvre la liste) et la barre du bas garde Enregistrer et 📷 — le reste, dont Supprimer, est sous « ⋯ ». Inventaire : un seul bouton « Filtres & vues » au-dessus de la liste, et la grille par défaut au lieu du tableau large.',
    en: 'Work drawer: only the chosen themes show ("Edit themes" opens the list) and the bottom bar keeps Save and 📷 — the rest, Delete included, is under "⋯". Inventory: one "Filters & views" button above the list, and the grid by default instead of the wide table.',
  },
  wn_capture_tidy_t: { fr: 'Capture photo plus nette', en: 'Tidier photo capture' },
  wn_capture_tidy_d: {
    fr: 'Dans la capture, « Appliquer sur l’œuvre » n’apparaît que s’il y a quelque chose à appliquer (il recouvrait le texte). Prendre une photo / Bibliothèque passent avant « Lieu & météo », désormais replié (▸, ✓ une fois relevé).',
    en: 'In capture, "Apply to work" only shows when there is something to apply (it covered the text). Take photo / Library come before "Location & weather", now folded (▸, ✓ once captured).',
  },
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
