import { defineMessages } from '../message-core'

/**
 * What's new items (`wn_<id>_t` / `wn_<id>_d` for each id in `lib/whats-new.ts`). Deliberately NOT registered in
 * `lib/i18n/messages/index.ts`: `WhatsNewList` imports this module on demand, so the release notes never ship in
 * a page's i18n catalog (/hub JS budget, 2026-11-18). New items go here, newest first, FR + EN together.
 */
export const whatsNewItemMessages = defineMessages({
  // 3.1.96 (2026-11-23) — 🎤 inside an idea.
  wn_idea_mic_t: { fr: 'Dicter dans une idée', en: 'Dictate into an idea' },
  wn_idea_mic_d: {
    fr: 'Dans une idée, le 🎤 ouvre l’enregistreur du Journal : la note va sur la page d’aujourd’hui et dans l’idée. Si le micro est bloqué, une note tapée y va aussi. Les vues Mois et Années comptent aussi les changements d’idées, et les idées de l’Aperçu ouvrent directement l’idée.',
    en: 'In an idea, the 🎤 opens the Journal’s recorder: the note goes on today’s page and into the idea. If the mic is blocked, a typed note goes there too. The Months and Years views also count idea changes, and the ideas on the Overview open the idea directly.',
  },
  // 3.1.95 (2026-11-23) — phone new work keeps the draft on « Tous les champs ».
  wn_work_record_all_fields_t: { fr: '« Tous les champs » garde ce qui est saisi', en: '« All fields » keeps what was typed' },
  wn_work_record_all_fields_d: {
    fr: 'Sur le téléphone, en enregistrant une nouvelle œuvre, « Tous les champs » emporte le titre, la technique, le support, le format, les dimensions et les photos dans le formulaire complet au lieu de les perdre. Le lieu, la source, la période et « peint sur » s’ajoutent ensuite depuis la fiche : un message le rappelle.',
    en: 'On the phone, when recording a new work, « All fields » carries the title, technique, support, format, size and photos into the full form instead of losing them. The place, source, period and « painted on » are added afterwards from the card: a message says so.',
  },
  // 3.1.94 (2026-11-23) — the Journal day shows its ideas.
  wn_journal_idea_lines_t: { fr: 'Les idées du jour dans le Journal', en: 'The day’s ideas in the Journal' },
  wn_journal_idea_lines_d: {
    fr: 'Une idée plantée, passée en pousse ou mûre, au texte retravaillé, renommée ou greffée sur une autre s’affiche dans le fil du Journal, sur son jour, en une ligne discrète avec qui l’a fait ; la ligne ouvre l’idée. Plusieurs enregistrements du même texte dans la journée font une seule ligne « ×n ».',
    en: 'An idea planted, moved to sprout or ripe, its text reworked, renamed or grafted onto another shows in the Journal stream on its day, as a quiet line with who did it; the line opens the idea. Several saves of the same text in a day make one line « ×n ».',
  },
  // 3.1.93 (2026-11-23) — Idées as a tree fed by the Journal.
  wn_ideas_tree_t: { fr: 'Les Idées deviennent un arbre', en: 'Ideas become a tree' },
  wn_ideas_tree_d: {
    fr: 'L’onglet Idées montre chaque idée comme une graine qui pousse : graine, pousse, mûre — seule la personne qui l’a plantée change l’étape. Une idée peut pousser sur une autre (ses branches). En ouvrant une idée : son Fil (les moments du Journal qui la nourrissent, le plus récent en haut), son Texte (avec ses versions), ses documents, œuvres, branches et idées liées. Écrire dans une idée écrit un moment sur la page d’aujourd’hui.',
    en: 'The Ideas tab shows each idea as a seed that grows: seed, sprout, ripe — only the person who planted it moves the stage. An idea can grow on another (its branches). Opening an idea: its Thread (the Journal moments that feed it, newest at the top), its Text (with its versions), its documents, works, branches and linked ideas. Writing into an idea writes a moment on today’s page.',
  },
  wn_idea_from_moment_t: { fr: 'Planter une idée depuis le Journal', en: 'Plant an idea from the Journal' },
  wn_idea_from_moment_d: {
    fr: 'Sur une note du Journal, « ⋯ » puis « 🌰 En faire une idée » : la note reste sur son jour et devient le premier moment de la nouvelle idée. Une note vocale envoyée vers une idée, un partage ajouté à une idée et « En faire une idée » sur un rappel passent aussi par là.',
    en: 'On a Journal note, « ⋯ » then « 🌰 Make it an idea »: the note stays on its day and becomes the new idea’s first moment. A voice note sent to an idea, a share added to an idea and « Make it an idea » on a reminder go the same way.',
  },
  // 3.1.92 (2026-11-23) — the stream is the default.
  wn_journal_stream_default_t: { fr: 'Le Journal s’ouvre sur le fil des jours', en: 'The Journal opens on the stream of days' },
  wn_journal_stream_default_d: {
    fr: 'Le fil des jours n’est plus à essayer : le Journal et la page Aujourd’hui s’ouvrent dessus, sur l’ordinateur comme sur le téléphone. Un lien vers un jour (recherche, Chronologie) ouvre le fil à ce jour. Pour garder l’ancien écran sur un appareil, ajoutez ?stream=0 à l’adresse une fois ; ?stream=1 revient au fil.',
    en: 'The stream of days is no longer a try-out: the Journal and the Today page open on it, on the computer and on the phone. A link to a day (search, Chronology) opens the stream at that day. To keep the old screen on a device, add ?stream=0 to the address once; ?stream=1 goes back to the stream.',
  },
  // 3.1.91 (2026-11-23) — the Journal as one stream of days (to try), captures kept offline, voice note = entry at once, labels / suite / move.
  wn_journal_stream_t: { fr: 'Le Journal en un seul fil de jours', en: 'The Journal as one stream of days' },
  wn_journal_stream_d: {
    fr: 'Dans le Journal et la page Aujourd’hui, les jours se suivent en un seul fil, le plus récent en haut, chaque carte avec une seule action principale (le reste sous « ⋯ »). Pincez à deux doigts sur le téléphone, ou utilisez les boutons Mois / Années sur l’ordinateur, pour passer aux mois et aux années. Sur l’ordinateur, une colonne montre les œuvres du jour choisi.',
    en: 'In the Journal and the Today page, the days follow one another in a single stream, newest at the top, each card with one main action (the rest under « ⋯ »). Pinch with two fingers on the phone, or use the Months / Years buttons on the computer, to zoom out to months and years. On the computer, a column shows the works of the day chosen.',
  },
  wn_capture_offline_t: { fr: 'Notes vocales et photos gardées sans réseau', en: 'Voice notes and photos kept without network' },
  wn_capture_offline_d: {
    fr: 'Sans réseau, une note vocale ou une photo d’inspiration reste sur le téléphone, montrée « en attente d’envoi » sur la page du jour, et part toute seule quand le réseau revient. Un envoi répété n’écrit jamais deux fois la même note.',
    en: 'Without network, a voice note or an inspiration photo stays on the phone, shown « waiting to be sent » on the day’s page, and goes by itself when the network returns. A repeated send never writes the same note twice.',
  },
  wn_voice_entry_at_once_t: { fr: 'Une note vocale est dans le Journal tout de suite', en: 'A voice note is in the Journal at once' },
  wn_voice_entry_at_once_d: {
    fr: 'La note vocale entre dans le Journal dès qu’elle est enregistrée, avec les mots entendus par le téléphone (ou « transcription à venir »). La transcription de l’ordinateur arrive ensuite comme une correction. Si quelqu’un a déjà vérifié ou corrigé le texte, l’ordinateur le propose seulement : « Reprendre ces mots » ou « Garder mon texte ». Les suggestions d’œuvres et d’idées partent du texte affiché.',
    en: 'A voice note enters the Journal as soon as it is recorded, with the words the phone heard (or « transcript to come »). The computer’s transcript then arrives as a correction. If someone has already checked or corrected the text, the computer only proposes it: « Use these words » or « Keep my text ». Work and idea suggestions start from the text shown.',
  },
  wn_journal_labels_suite_move_t: { fr: 'Étiquettes, suite et autre jour', en: 'Labels, follow-up and another day' },
  wn_journal_labels_suite_move_d: {
    fr: 'Dans le fil du Journal, « ⋯ » sur une note : « Étiquettes » (processus, matériaux, étincelle…), « Ajouter une suite » (une note écrite aujourd’hui, montrée sous celle qu’elle prolonge) et « Placer sur un autre jour » (pour l’auteur ou un admin ; l’ancien jour est gardé).',
    en: 'In the Journal stream, « ⋯ » on a note: « Labels » (process, materials, spark…), « Add a follow-up » (a note written today, shown under the one it continues) and « Place on another day » (for the author or an admin; the old day is kept).',
  },
  // 3.1.90 (2026-11-23) — saving a contact keeps its addresses' links.
  wn_contact_save_keeps_addresses_t: {
    fr: 'Enregistrer un contact garde ses adresses liées',
    en: 'Saving a contact keeps its linked addresses',
  },
  wn_contact_save_keeps_addresses_d: {
    fr: 'Enregistrer une fiche contact ne détache plus les œuvres, commandes et envois de son adresse. Retirer une adresse encore utilisée est refusé, avec le nombre d’œuvres, commandes et envois concernés : donnez-leur une autre adresse d’abord.',
    en: 'Saving a contact no longer unlinks works, orders and shipments from its address. Removing an address still in use is refused, with the number of works, orders and shipments concerned: give them another address first.',
  },
  // 3.1.89 (2026-11-22) — « Corriger » a Journal transcript.
  wn_journal_correct_t: { fr: 'Corriger une transcription du Journal', en: 'Correct a Journal transcript' },
  wn_journal_correct_d: {
    fr: 'Sur un texte transcrit par la machine ou importé, « Vérifier · corriger » ouvre le texte : « Le texte est juste » le marque vérifié, ou corrigez-le et « Enregistrer la correction ». Le texte d’origine est gardé (« voir le texte d’origine ») ; la correction s’affiche partout à sa place, sur l’ordinateur comme sur le téléphone.',
    en: 'On a text transcribed by the machine or imported, « Check · correct » opens the text: « The text is right » marks it checked, or correct it and « Save the correction ». The original text is kept (« show the original text »); the correction shows everywhere in its place, on the computer and on the phone.',
  },
  // 3.1.89 (2026-11-22) — a deleted contact no longer breaks restore / approve; same-instant saves.
  wn_deleted_contact_restore_t: { fr: 'Restaurer une version ou approuver malgré un contact supprimé', en: 'Restore a version or approve despite a deleted contact' },
  wn_deleted_contact_restore_d: {
    fr: 'Restaurer une ancienne version d’une œuvre dont le contact a été supprimé garde le propriétaire, le dépositaire ou l’acheteur actuel et restaure le reste, en le disant. Une proposition qui nomme un contact supprimé est refusée avec une phrase claire. Et un enregistrement de fiche qui tombe au même instant qu’un autre changement n’écrit rien et recommence sur l’œuvre à jour.',
    en: 'Restoring an older version of a work whose contact was deleted keeps the current owner, custodian or buyer and restores the rest, and says so. A proposal naming a deleted contact is refused with a clear sentence. And a card save landing at the same instant as another change writes nothing and starts again on the up-to-date work.',
  },
  // 3.1.88 (2026-11-21) — the work card saves field by field.
  wn_work_save_field_by_field_t: { fr: 'Une fiche restée ouverte n’efface plus un autre changement', en: 'A card left open no longer undoes another change' },
  wn_work_save_field_by_field_d: {
    fr: 'Quand une commande, une modification en lot ou la production change une œuvre pendant que sa fiche est ouverte, « Enregistrer » n’écrit plus que ce que vous avez modifié dans la fiche : l’autre changement est gardé et la fiche le montre. Si vous avez changé le même champ, la fiche refuse et dit lequel.',
    en: 'When an order, a batch edit or production changes a work while its card is open, « Save » now writes only what you changed in the card: the other change is kept and the card shows it. If you changed the same field, the card refuses and says which one.',
  },
  // 3.1.87 (2026-11-21) — inspiration photos are found: in the list of days and by their text.
  wn_inspiration_found_t: { fr: 'Les photos d’inspiration se retrouvent', en: 'Inspiration photos can be found again' },
  wn_inspiration_found_d: {
    fr: 'Un jour qui ne contient qu’une photo d’inspiration apparaît maintenant dans la liste des jours du Journal, avec « 1 photo d’inspiration ». Et la recherche trouve une photo par son texte : Ctrl+K sur l’ordinateur, la recherche du menu ☰ sur le téléphone ; le résultat ouvre le jour de la photo.',
    en: 'A day that holds only an inspiration photo now shows in the Journal’s list of days, with « 1 inspiration photo ». And search finds a photo by its text: Ctrl+K on the computer, the ☰ menu search on the phone; the result opens the photo’s day.',
  },
  // 3.1.86 (2026-11-21) — a text beside an inspiration photo.
  wn_inspiration_text_t: { fr: 'Un texte à côté de chaque photo d’inspiration', en: 'A text beside each inspiration photo' },
  wn_inspiration_text_d: {
    fr: 'Dans le Journal, chaque photo d’inspiration a maintenant son texte : « Ajouter un texte » ou « Modifier le texte », sur l’ordinateur comme sur le téléphone, quand vous voulez. Écrivez #123 pour mentionner une œuvre. Sur l’ordinateur, laissez la souris sur la photo pour la voir en grand.',
    en: 'In the Journal, each inspiration photo now has its text: « Add a text » or « Edit the text », on the computer and on the phone, whenever you like. Write #123 to mention a work. On the computer, rest the mouse on the photo to see it large.',
  },
  // 3.1.72 (2026-11-18) — Pem's evening pass + the Aide finished.
  wn_admin_ai_desk_t: { fr: 'Bureau IA (admin)', en: 'AI desk (admin)' },
  wn_admin_ai_desk_d: {
    fr: 'Kaizen → Bureau IA dit en une phrase si l’assistant IA de votre PC est allumé, et ce qu’il fait pour vous : transcrire les notes vocales, mettre la recherche à jour, décrire les images — avec « Faire maintenant ». Tout reste sur votre PC, aucune IA extérieure.',
    en: 'Kaizen → AI desk says in one sentence whether your PC’s AI assistant is on, and what it does for you: transcribe voice notes, update the search, describe images — with « Do it now ». Everything stays on your PC, no outside AI.',
  },
  wn_admin_works_bin_t: { fr: 'La corbeille des œuvres (admin)', en: 'The works bin (admin)' },
  wn_admin_works_bin_d: {
    fr: 'Audit → Corbeille liste les œuvres mises à la corbeille : « Restaurer » les remet dans les listes, « Supprimer définitivement » est refusé tant que l’œuvre figure sur une commande, un envoi, un lien du Journal ou un sinistre.',
    en: 'Audit → Bin lists the binned works: « Restore » puts them back in the lists; « Delete for good » is refused while the work is on an order, a shipment, a Journal link or a claim.',
  },
  wn_admin_approval_conflicts_t: { fr: 'Valider une proposition n’écrase plus vos changements (admin)', en: 'Approving no longer overwrites your changes (admin)' },
  wn_admin_approval_conflicts_d: {
    fr: 'En validant, seuls les champs que la personne a changés sont écrits. Si vous avez modifié l’un d’eux depuis, Audit le dit et propose « Appliquer quand même » ou « Rejeter ». L’auteur voit votre raison de refus dans sa Vue d’ensemble.',
    en: 'On approval only the fields the person changed are written. If you edited one of them since, Audit says so and offers « Apply anyway » or « Reject ». The author sees your rejection reason in their Overview.',
  },
  wn_layout_titles_phone_bar_t: { fr: 'Titres entiers, barres à leur place', en: 'Full titles, bars in their place' },
  wn_layout_titles_phone_bar_d: {
    fr: 'L’Inventaire garde le titre lisible quand la fiche est ouverte (les colonnes secondaires se replient, « +n » dit lesquelles) ; la Production replie les colonnes vides et donne au titre sa propre ligne. Au téléphone, la sélection est une barre fine au-dessus de la barre du bas, et les messages ne la cachent plus. Un contact ajouté vite au téléphone s’ouvre bien, et un texte trop long au Journal est arrêté avant d’être coupé.',
    en: 'Inventory keeps the title readable with the card open (secondary columns fold, « +n » says which); Production folds empty columns and gives the title its own line. On the phone, the selection is a slim bar above the bottom bar, and messages no longer hide it. A contact quick-added on the phone opens properly, and a Journal text that is too long is stopped instead of cut.',
  },
  wn_proposals_reasons_t: { fr: 'Vos propositions et leur suite', en: 'Your proposals and what came of them' },
  wn_proposals_reasons_d: {
    fr: 'Dans la Vue d’ensemble, « Pour vous » montre vos propositions : en attente, validées, ou refusées avec la raison donnée par Pem. Une photo envoyée et pas encore validée s’annonce sur la fiche. Quand Pem valide une proposition, seuls les champs que vous avez changés sont écrits.',
    en: 'In the Overview, « For you » shows your proposals: waiting, approved, or rejected with Pem’s reason. A photo sent and not yet approved shows on the card. When Pem approves a proposal, only the fields you changed are written.',
  },
  // 3.1.85 (2026-11-20) — voice note → idea with its text; Bureau IA launch.
  wn_voice_note_idea_text_t: { fr: 'Note vocale → idée : le texte suit', en: 'Voice note → idea: the text comes along' },
  wn_voice_note_idea_text_d: {
    fr: 'Dans le Journal, « Relier » une note vocale à « + nouvelle idée » copie maintenant sa transcription dans l’idée (votre version corrigée si vous en avez enregistré une). Le texte se corrige ensuite dans Idées ; le Journal garde l’original.',
    en: 'In the Journal, « Relier » a voice note to « + new idea » now copies its transcript into the idea (your corrected version if you saved one). The text is then edited on Ideas; the Journal keeps the original.',
  },
  wn_ai_desk_launch_click_t: { fr: 'Bureau IA : « Lancer » démarre vraiment le PC', en: 'AI desk: « Run » really starts the PC' },
  wn_ai_desk_launch_click_d: {
    fr: 'Sur l’ordinateur, « Lancer » démarre l’agent du PC au moment du clic ; avant, le navigateur pouvait l’ignorer et la tâche restait « en attente ».',
    en: 'On the computer, « Run » starts the PC agent at the click; before, the browser could ignore it and the job stayed « waiting ».',
  },
  // 3.1.84 (2026-11-19) — contact merge in one step, admins only; Journal day lists.
  wn_journal_day_once_t: { fr: 'Journal : chaque œuvre une fois par jour', en: 'Journal: each work once per day' },
  wn_journal_day_once_d: {
    fr: 'Dans la liste des jours du Journal, une œuvre travaillée deux fois le même jour n’apparaît plus qu’une fois. Sur le téléphone, la page d’un jour montre aussi les peintures pas encore enregistrées comme œuvres (« pas encore de fiche »), comme sur l’ordinateur.',
    en: 'In the Journal’s list of days, a work handled twice the same day now shows once. On the phone, a day’s page also shows paintings not yet recorded as works (« no record yet »), as on the computer.',
  },
  wn_contact_merge_safe_t: { fr: 'Fusion de deux contacts : en une seule étape, par un admin', en: 'Merging two contacts: one step, by an admin' },
  wn_contact_merge_safe_d: {
    fr: 'Fusionner deux fiches contact se fait maintenant d’un bloc : tout passe sur la fiche gardée (œuvres, commandes, adresses, e-mails, liens, lectures de cartes) ou rien ne bouge, jamais une fiche coupée en deux. Une fiche « Privé » le reste après la fusion. Le bouton « Fusionner » est réservé aux admins : demandez à Pem.',
    en: 'Merging two contacts now happens in one go: everything moves to the kept contact (works, orders, addresses, emails, links, card readings) or nothing moves, never a contact split in two. A « Private » contact stays private after the merge. The « Merge » button is for admins only: ask Pem.',
  },
  // 3.1.83 (2026-11-19) — contact links in one row; AI contact fill in French.
  wn_contact_links_row_t: { fr: 'Contacts : site web et réseaux en un clic', en: 'Contacts: website and socials in one click' },
  wn_contact_links_row_d: {
    fr: 'En haut d’une fiche contact, une rangée de boutons : écrire, appeler, ouvrir le site, Instagram, LinkedIn… Les sites et comptes enregistrés autrefois qui ne s’affichaient pas y sont maintenant. Les fiches remplies par l’IA (carte de visite, page web) arrivent en français, les noms restent tels qu’imprimés.',
    en: 'At the top of a contact, a row of buttons: write, call, open the website, Instagram, LinkedIn… Websites and accounts saved earlier that did not show are there now. Contacts filled by the AI (business card, web page) come in French, names kept as printed.',
  },
  wn_admin_ai_on_demand_t: { fr: 'L’IA du PC : un bouton pour la lancer, un badge pour ce qui attend', en: 'The PC’s AI: a button to start it, a badge for what waits' },
  wn_admin_ai_on_demand_d: {
    fr: 'Le badge de Bureau IA dans le menu compte ce qui attend. Sur le PC, « Lancer sur ce PC » (ou « Faire maintenant ») fait tout, puis l’IA s’arrête. Elle passe aussi à l’ouverture de session Windows.',
    en: 'The AI desk badge in the menu counts what waits. On the PC, « Start on this PC » (or « Do it now ») does it all, then the AI stops. It also runs when you sign in to Windows.',
  },
  wn_admin_ai_cards_t: { fr: 'Bureau IA : les cartes de visite lues par votre PC', en: 'Bureau IA: business cards read by your PC' },
  wn_admin_ai_cards_d: {
    fr: 'Une carte photographiée au téléphone est lue par l’IA de votre PC. Bureau IA → « Cartes lues, à vérifier » montre ce qu’elle ajouterait à la fiche ; « Ouvrir et vérifier » pose ces ajouts dans la fiche, vous corrigez puis Enregistrer. Rien n’est remplacé.',
    en: 'A card photographed on the phone is read by your PC’s AI. Bureau IA → « Cards read, to check » shows what it would add to the contact; « Open and check » puts those additions in the contact, you correct, then Save. Nothing is replaced.',
  },
  wn_private_contacts_pickers_t: { fr: 'Contacts privés : cachés des listes et des recherches, toujours nommés là où ils sont liés', en: 'Private contacts: hidden from lists and searches, still named wherever they are linked' },
  wn_private_contacts_pickers_d: {
    fr: 'Un contact marqué « Privé » par un admin n’apparaît plus dans la liste Contacts, la recherche ni les listes de choix (acheteur, propriétaire, client d’une commande…). Sur une œuvre, une commande ou un envoi où il figure déjà, son nom reste affiché et vous travaillez normalement.',
    en: 'A contact an admin marks « Private » no longer appears in the Contacts list, in search or in pickers (buyer, owner, order party…). On a work, order or shipment it is already linked to, its name still shows and you work as usual.',
  },
  wn_pdf_from_group_t: { fr: 'PDF portfolio : partir d’un groupe de travail, dans l’ordre du groupe', en: 'Portfolio PDF: start from a working group, in the group’s order' },
  wn_pdf_from_group_d: {
    fr: 'Dans la fenêtre du PDF, la liste « Collections » propose aussi vos groupes de travail : choisissez-en un, et le PDF reprend ses œuvres publiques dans l’ordre du groupe. Les chapitres du site ne changent pas.',
    en: 'In the PDF window, the « Collections » list also offers your working groups: pick one and the PDF takes its public works in the group’s order. The site’s chapters do not change.',
  },
  wn_theme_group_copy_t: { fr: 'Thèmes : copier un thème en groupe de travail, ou un groupe en thème', en: 'Themes: copy a theme as a working group, or a group as a theme' },
  wn_theme_group_copy_d: {
    fr: 'Les thèmes servent à la création, les groupes au commercial (kits, sélections, envois). Sur la page Thèmes, ⧉ copie un thème en groupe avec les mêmes œuvres, ou l’inverse. Si le nom existe déjà, on vous demande avant d’ajouter les œuvres manquantes.',
    en: 'Themes are for creation, groups for business (kits, selections, sending out). On the Themes page, ⧉ copies a theme into a group with the same works, or the other way round. If the name already exists, you are asked before the missing works are added.',
  },
  wn_retouch_shows_now_t: { fr: 'Image retouchée : la nouvelle version s’affiche partout tout de suite', en: 'Retouched image: the new version shows everywhere straight away' },
  wn_retouch_shows_now_d: {
    fr: 'Remplacer une image par sa version retouchée ne laisse plus l’ancienne à l’écran (même après un rechargement) : liste, diaporamas, site public et image d’accueil montrent la nouvelle. L’ancienne reste gardée de côté.',
    en: 'Replacing an image with its retouched version no longer leaves the old one on screen (even after a reload): lists, slideshows, the public site and the home image show the new one. The old one is kept aside.',
  },
  wn_two_tabs_safe_t: { fr: 'Une fiche ouverte deux fois ne défait plus l’autre enregistrement', en: 'A card open twice no longer undoes the other save' },
  wn_two_tabs_safe_d: {
    fr: 'Si une œuvre a été enregistrée ailleurs (autre onglet, autre personne) depuis que vous avez ouvert sa fiche, votre enregistrement est refusé avec un message, au lieu d’effacer l’autre en silence : rouvrez la fiche, puis refaites vos changements. Même chose si elle a été mise à la corbeille. Hors ligne sur le téléphone, deux enregistrements de la même fiche n’en font plus qu’un (le plus récent).',
    en: 'If a work was saved elsewhere (another tab, another person) since you opened its card, your save is refused with a message instead of silently erasing the other one: reopen the card, then make your changes again. Same if it was put in the bin. Offline on the phone, two saves of the same card become one (the latest).',
  },
  wn_contact_names_one_way_t: { fr: 'Les noms des contacts, partout pareil', en: 'Contact names, the same everywhere' },
  wn_contact_names_one_way_d: {
    fr: 'Dans les listes et les choix : « DUPONT Marie · Galerie X », triés par nom de famille (« de Kooning » sous D). Sur les papiers : « Marie DUPONT ». Une galerie ou un musée s’écrit tel quel, une seule fois. La liste des adresses se met à jour après une modification, une fusion ou une suppression.',
    en: 'In lists and pickers: « DUPONT Marie · Galerie X », sorted by family name (« de Kooning » under D). On papers: « Marie DUPONT ». A gallery or museum is written as typed, once. The address list updates after an edit, a merge or a delete.',
  },
  wn_phone_fixes_1119_t: { fr: 'Petites corrections, surtout sur le téléphone', en: 'Small fixes, mostly on the phone' },
  wn_phone_fixes_1119_d: {
    fr: 'Revenus & Dépenses tient dans l’écran du téléphone (onglets qui défilent, montants sans « € » coupé). Boutons plus faciles à toucher : ⊕ de l’Inventaire, « Retirer du thème », zoom de la carte, flèches de la Chronologie. Sur la Vue d’ensemble, « envois à faire » ne compte plus les colis déjà partis. La photo d’une carte de visite n’est envoyée qu’une fois.',
    en: 'Revenus & Dépenses fits the phone screen (tabs scroll, amounts never split from their « € »). Easier taps: Inventory ⊕, « Retirer du thème », map zoom, Chronologie arrows. On Overview, « shipments to do » no longer counts boxes already sent. A business-card photo is sent only once.',
  },
  wn_contact_delete_safe_t: { fr: 'Supprimer un contact ne perd plus rien', en: 'Deleting a contact no longer loses anything' },
  wn_contact_delete_safe_d: {
    fr: 'Un contact encore propriétaire ou détenteur d’une œuvre, ou lié à une commande, ne se supprime pas : un message dit ce qui le retient, et rien n’est effacé (avant, ses adresses disparaissaient). Les contacts que vous importez ne sont plus marqués « Privé ».',
    en: 'A contact who still owns or holds a work, or is on an order, is not deleted: a message says what holds it, and nothing is erased (its addresses used to vanish). Contacts you import are no longer marked « Private ».',
  },
  wn_small_slips_1118_t: { fr: 'Petites corrections', en: 'Small fixes' },
  wn_small_slips_1118_d: {
    fr: 'Une commande de fournitures reçue en partie le dit, et une nouvelle ligne reprend le dernier prix HT. Au téléphone, le menu ☰ montre les nouveautés et la Logistique distingue « en route » et « en cours ». Le Journal compte les œuvres sans doublon.',
    en: 'A partly received supply order says so, and a new line takes the last price paid. On the phone, the ☰ menu shows what is new and Logistics tells « on the road » from « under way ». The Journal counts works without doubles.',
  },
  wn_aide_complete_t: { fr: 'L’Aide est complète', en: 'The Help is complete' },
  wn_aide_complete_d: {
    fr: 'Le guide d’équipe dit ce qui attend la validation de Pem, détaille la fiche, les commandes et leurs papiers (facture comprise) et répond aux questions fréquentes avec les messages de l’application. Le guide admin couvre tout le reste. Les deux se téléchargent en PDF.',
    en: 'The team guide says what waits for Pem’s approval, details the card, the orders and their papers (invoice included) and answers frequent questions with the app’s own messages. The admin guide covers the rest. Both download as PDF.',
  },
  wn_map_back_card_names_t: { fr: 'La carte revient, la fiche nomme le propriétaire', en: 'The map is back, the card names the owner' },
  wn_map_back_card_names_d: {
    fr: 'La Carte affiche de nouveau son fond (il était bloqué depuis ce matin sur le site). Une fiche ouverte depuis l’étiquette QR ou ⌘K montre le propriétaire et le dépositaire, et propose tous les contacts.',
    en: 'The Map shows its background again (it was blocked on the site since this morning). A card opened from the QR label or ⌘K shows the owner and the custodian, and offers every contact.',
  },
  wn_contacts_badge_vault_tree_t: { fr: 'Contacts, Coffre, carte de visite', en: 'Contacts, Vault, business card' },
  wn_contacts_badge_vault_tree_d: {
    fr: 'Supprimer un contact met à jour le compteur et les listes des fiches. Dans le Coffre, les sous-dossiers s’affichent sous leur dossier. Carte de visite : après la photo, l’écran rappelle d’ajouter le texte avec Live Text — la photo seule n’est pas lue.',
    en: 'Deleting a contact updates the count and the cards’ lists. In the Vault, sub-folders show under their folder. Business card: after the photo, the screen reminds you to add the text with Live Text — the photo alone is not read.',
  },
  // 3.1.71 (2026-11-18) — guide PDF + « ? » help.
  wn_help_pdf_and_panel_t: { fr: 'L’Aide en PDF, et un « ? » sur chaque écran', en: 'Help as a PDF, and a « ? » on every screen' },
  wn_help_pdf_and_panel_d: {
    fr: 'Dans Kaizen → Aide, « Télécharger le guide (PDF) » : le guide complet, mis en page, à lire hors de l’ordinateur — toujours le même texte que l’Aide. Sur chaque écran de l’Atelier, le bouton « ? » (ou la touche ?) ouvre l’aide de cet écran par-dessus, avec une recherche. Au téléphone : ☰ → « Aide pour cet écran ».',
    en: 'In Kaizen → Help, « Download the guide (PDF) »: the whole guide, laid out, to read away from the computer — always the same text as the Help. On every Atelier screen, the « ? » button (or the ? key) opens help for that screen on top of it, with a search. On the phone: ☰ → « Help for this screen ».',
  },
  // 3.1.70 (2026-11-18) — Aide batch 6: the Studio Bible and the old guides retired.
  wn_bible_to_aide_t: { fr: 'La Bible Atelier laisse place à l’Aide', en: 'The Studio Bible gives way to Help' },
  wn_bible_to_aide_d: {
    fr: 'Le téléchargement « Bible Atelier » (⌘K, menu du téléphone) n’existe plus : tout est dans Kaizen → Aide, tenu à jour. Un ancien lien vers la Bible ouvre l’Aide.',
    en: 'The « Studio Bible » download (⌘K, phone menu) is gone: everything is in Kaizen → Help, kept up to date. An old link to the Bible opens Help.',
  },
  // 3.1.69 (2026-11-18) — stress-test fixes.
  wn_sign_out_this_device_t: { fr: '« Se déconnecter » ne déconnecte que cet appareil', en: '« Sign out » signs out this device only' },
  wn_sign_out_this_device_d: {
    fr: 'Avant, se déconnecter sur l’ordinateur vous déconnectait aussi du téléphone. Maintenant vos autres appareils restent connectés.',
    en: 'Signing out on the computer used to sign you out on your phone too. Now your other devices stay signed in.',
  },
  wn_scroll_keeps_numbers_t: { fr: 'La molette ne change plus un montant', en: 'Scrolling no longer changes an amount' },
  wn_scroll_keeps_numbers_d: {
    fr: 'Faire défiler avec la souris au-dessus d’un champ chiffré (un paiement, un prix, une quantité) changeait sa valeur (300 € devenait 299 €). Le champ garde maintenant ce que vous avez tapé et la page défile.',
    en: 'Scrolling with the mouse over a number field (a payment, a price, a quantity) changed its value (300 € became 299 €). The field now keeps what you typed and the page scrolls.',
  },
  wn_light_controls_contact_popup_t: { fr: 'Cases à cocher lisibles, fiche contact en grand', en: 'Readable checkboxes, full-size contact card' },
  wn_light_controls_contact_popup_d: {
    fr: 'En mode Jour, les cases à cocher, lecteurs audio et champs de date ne s’affichent plus en sombre. La fiche contact ouverte depuis une œuvre prend toute la fenêtre et se ferme sur « Contact enregistré ». Quelques boutons coupés passent à la ligne.',
    en: 'In Day mode, checkboxes, audio players and date fields no longer draw dark. The contact card opened from a work fills the window and closes with « Contact saved ». A few cut-off buttons now wrap.',
  },
  // 3.1.68 (2026-11-18) — Aide batch 4: team guide complete.
  wn_aide_team_complete_t: { fr: 'Aide : le guide d’équipe est complet', en: 'Help: the team guide is complete' },
  wn_aide_team_complete_d: {
    fr: 'Six derniers chapitres dans Kaizen → Aide : Contacts (et la carte de visite), Fournitures, Rapports, Site public et Portfolio, ce que l’application fait d’elle-même, et un glossaire français / anglais.',
    en: 'The last six chapters in Kaizen → Help: Contacts (and the business card), Supplies, Reports, Public site and Portfolio, what the app does by itself, and a French / English glossary.',
  },
  // 3.1.67 (2026-11-18) — Aide batch 3.
  wn_aide_day_orders_events_t: { fr: 'Aide : la journée, les idées, les commandes', en: 'Help: the day, ideas, orders' },
  wn_aide_day_orders_events_d: {
    fr: 'Cinq chapitres de plus dans Kaizen → Aide : la journée et le Journal (Écrire, Vocal), les Idées, les Commandes (étapes de chaque genre, argent, retour de 14 jours, papiers), la Logistique et les Expositions et événements.',
    en: 'Five more chapters in Kaizen → Help: the day and the Journal (Write, Voice), Ideas, Orders (each kind’s steps, money, 14-day return, papers), Logistics, and Exhibitions and events.',
  },
  // 3.1.66 (2026-11-18) — Aide batch 2, QR link.
  wn_aide_works_production_t: { fr: 'Aide : Œuvres et Production', en: 'Help: Works and Production' },
  wn_aide_works_production_d: {
    fr: 'Deux chapitres de fiches pratiques dans Kaizen → Aide : trouver une œuvre, lire et modifier la fiche, enregistrer une nouvelle œuvre ou une reprise au téléphone, ajouter des photos (iPhone et Android), faire un constat, l’étiquette QR ; et le tableau Production, étape par étape.',
    en: 'Two chapters of how-to cards in Kaizen → Help: finding a work, reading and editing the card, recording a new work or a rework on the phone, adding photos (iPhone and Android), condition reports, the QR label; and the Production board, step by step.',
  },
  wn_qr_link_opens_work_t: { fr: 'L’étiquette QR ouvre l’œuvre', en: 'The QR label opens the work' },
  wn_qr_link_opens_work_d: {
    fr: 'Scanner une étiquette QR ou suivre « Copier le lien » ouvrait la Vue d’ensemble sans l’œuvre. La fiche s’ouvre à nouveau.',
    en: 'Scanning a QR label or following « Copy link » opened the Overview without the work. The card opens again.',
  },
  // 3.1.65 (2026-11-18) — in-app Aide.
  wn_aide_guides_t: { fr: 'Aide : le guide dans l’application', en: 'Help: the guide in the app' },
  wn_aide_guides_d: {
    fr: 'Kaizen → Aide (au téléphone : ☰ → Tout le reste → Aide), en français et en anglais. Pour commencer : le projet et son périmètre, et les premiers pas ; d’autres fiches pratiques suivront. Chaque chapitre dit quand il a été vérifié. Le bouton « Aide et guides » du Coffre y mène aussi.',
    en: 'Kaizen → Help (on the phone: ☰ → Everything else → Help), in French and English. To start: the project and its scope, and getting started; more how-to cards will follow. Each chapter says when it was checked. The Vault’s « Help and guides » button leads there too.',
  },
  // 3.1.62 (2026-11-18) — paid from payments, order address + return to the gallery, ⌘K by number, faster tabs.
  wn_paid_from_payments_t: { fr: '« Payé » suit les paiements', en: '« Paid » follows the payments' },
  wn_paid_from_payments_d: {
    fr: '« Payé » sur une œuvre suit les paiements de sa vente : soldée → payé, retour → non payé. La fiche dit d’où vient la valeur, et elle reste modifiable à la main.',
    en: '« Paid » on a work follows its sale’s payments: fully paid → paid, returned → not paid. The card says where the value comes from, and it can still be set by hand.',
  },
  wn_order_address_return_t: { fr: 'Commandes : l’adresse, et le retour chez la galerie', en: 'Orders: the address, and the return to the gallery' },
  wn_order_address_return_d: {
    fr: 'Une commande montre l’adresse où vont les œuvres, et on la choisit quand elle manque. Le « Retour » d’une œuvre vendue depuis un dépôt, payée mais pas livrée, la remet en « Consigné » chez la galerie, et le dépôt reprend.',
    en: 'An order shows the address the works go to, and you pick it when it is missing. A « Return » of a work sold out of a deposit, paid but not delivered, puts it back « Consigned » at the gallery, and the deposit reopens.',
  },
  wn_orders_double_click_t: { fr: 'Commandes : un double clic ne compte qu’une fois', en: 'Orders: a double click counts once' },
  wn_orders_double_click_d: {
    fr: 'Une œuvre ne peut pas être vendue deux fois, un paiement ne s’enregistre pas deux fois, et le total payé ne dépasse jamais le prix + l’envoi. « Recevoir » une commande de fournitures se verrouille pendant l’envoi. L’onglet Ventes fonctionne au-delà de 200 commandes.',
    en: 'A work can’t be sold twice, a payment isn’t recorded twice, and the total paid never goes above price + shipping. « Receive » on a supplies order locks while it saves. The Sales tab works past 200 orders.',
  },
  wn_shipments_follow_orders_t: { fr: 'Les envois suivent leurs commandes', en: 'Shipments follow their orders' },
  wn_shipments_follow_orders_d: {
    fr: 'Une vente annulée ou retournée, un dépôt ou un prêt clos à la main : ses œuvres sortent d’un envoi pas encore parti, et un carton vide est annulé. Un envoi déjà en route ne bouge pas.',
    en: 'A sale cancelled or returned, a deposit or loan closed by hand: its works leave a shipment not yet gone, and an empty box is cancelled. A shipment already on the road is left as it is.',
  },
  wn_card_live_text_t: { fr: 'Carte de visite : marche dehors', en: 'Business card: works outdoors' },
  wn_card_live_text_d: {
    fr: 'Touchez la case de texte deux fois, « Scanner le texte », visez la carte, puis « Analyser » : le contact se remplit tout de suite, sans IA ni réseau de l’atelier. « Améliorer avec l’IA » est à part et abandonne après 30 s. La photo de la carte est gardée avec le contact (Coffre › Business).',
    en: 'Tap the text box twice, « Scan Text », aim at the card, then « Analyse »: the contact fills at once, no AI or studio network. « Improve with AI » is separate and gives up after 30 s. The card photo is kept with the contact (Vault › Business).',
  },
  wn_search_by_number_t: { fr: '⌘K : une œuvre par son numéro', en: '⌘K: a work by its number' },
  wn_search_by_number_d: {
    fr: 'Tapez « 2405 » ou « #2405 » dans ⌘K : l’œuvre vient en premier, même si elle n’est pas encore chargée.',
    en: 'Type « 2405 » or « #2405 » in ⌘K: the work comes first, even if it is not loaded yet.',
  },
  wn_faster_tabs_t: { fr: 'Des onglets plus rapides à ouvrir', en: 'Tabs quicker to open' },
  wn_faster_tabs_d: {
    fr: 'L’Atelier attend moins entre deux lectures : les compteurs du menu arrivent avec la page, l’onglet ouvert passe en premier (Audit, Logistique), et la recherche d’une séance ne se relance plus à chaque note tapée.',
    en: 'The Atelier waits less between reads: the menu counts come with the page, the tab you open goes first (Audit, Logistics), and a session’s search no longer re-runs at each note typed.',
  },
  // 3.1.61 (2026-11-18) — phone navigation, collector share kit, recording draft, old comments field gone.
  wn_phone_nav_t: { fr: 'Téléphone : une seule journée, un vrai menu', en: 'Phone: one day screen, a real menu' },
  wn_phone_nav_d: {
    fr: 'Sur le téléphone, « Aujourd’hui » est la journée, quel que soit le jour : le Journal devient la liste des jours. « Écrire » ouvre une feuille sur la journée, sans quitter l’écran. ☰ ouvre tout de suite un menu : chercher une œuvre par numéro ou titre, les grands écrans en tuiles avec leurs comptes, le reste et les actions repliés en dessous.',
    en: 'On the phone, « Today » is the day, whichever day: the Journal becomes the list of days. « Write » opens a sheet over the day, without leaving the screen. ☰ opens a menu at once: find a work by number or title, the main screens as tiles with their counts, the rest and the actions folded below.',
  },
  wn_share_kit_t: { fr: 'Partager une sélection à un collectionneur', en: 'Share a selection with a collector' },
  wn_share_kit_d: {
    fr: 'Sur un groupe de travail (Thèmes / Groupes) ou la fiche d’un contact : « Partager à un collectionneur… ». On choisit le collectionneur, les œuvres et leur ordre, les prix à montrer, la langue et un message ; le lien privé et son PDF sont faits ensemble, valables 14 jours. Le collectionneur voit une page calme, une œuvre par écran, et peut écrire à l’atelier : sa demande arrive dans Triage à son nom. La fiche du contact liste ses sélections (prolonger, retirer).',
    en: 'On a working group (Themes / Groups) or a contact’s card: « Share with a collector… ». Pick the collector, the works and their order, which prices to show, the language and a message; the private link and its PDF are made together, valid 14 days. The collector sees a calm page, one work per screen, and can write to the studio: the enquiry lands in Triage under their name. The contact’s card lists their selections (extend, withdraw).',
  },
  wn_record_draft_t: { fr: 'Enregistrer : « Brouillon »', en: 'Record: « Draft »' },
  wn_record_draft_d: {
    fr: 'Sur l’écran « Enregistrer » du téléphone, « Brouillon » garde ce que vous avez tapé (sans les photos) et ferme l’écran ; il revient la prochaine fois, avec « Effacer » si vous n’en voulez plus.',
    en: 'On the phone « Record » screen, « Draft » keeps what you typed (without the photos) and closes the screen; it comes back next time, with « Clear » if you no longer want it.',
  },
  wn_old_comments_gone_t: { fr: 'Fiche d’œuvre : l’ancien champ « Commentaires » disparaît', en: 'Work card: the old « Comments » field is gone' },
  wn_old_comments_gone_d: {
    fr: 'Son texte était déjà dans les lignes de notes de chaque œuvre. Les notes s’ajoutent en lignes, avec leur auteur et leur date ; la recherche les lit.',
    en: 'Its text was already in each work’s note lines. Notes are added as lines, with their author and date; search reads them.',
  },
  // 3.1.60 (2026-11-18) — order leftovers, ideas visible.
  wn_order_leftovers_t: { fr: 'Commandes : valeur modifiable, papier à partager, « Confié » visible', en: 'Orders: editable value, paper to share, « Entrusted » visible' },
  wn_order_leftovers_d: {
    fr: 'La valeur d’une ligne se modifie après coup (brouillon ; signée, avec un rappel de refaire le papier ; plus après paiement ou remise). « Partager » envoie le papier lui-même, sans lien : sur le téléphone par la feuille de partage, sur l’ordinateur en téléchargement. Une œuvre confiée (encadreur…) apparaît sur le tableau de Production : « chez … depuis … ».',
    en: 'A line’s value can be changed afterwards (draft; signed, with a reminder to remake the paper; not once paid or handed over). « Share » sends the paper itself, no link: the share sheet on the phone, a download on a computer. An entrusted work (framer…) shows on the Production board: « at … since … ».',
  },
  wn_ideas_visible_t: { fr: 'Idées : les rappels sans projet, et l’Aperçu', en: 'Ideas: reminders with no project, and the Overview' },
  wn_ideas_visible_d: {
    fr: 'En haut d’Idées, les rappels datés qui ne sont liés à aucun projet : « En faire une idée » la garde à sa date, « Vu » la range. Le panneau Idées de l’Aperçu montre les dernières idées, les mûres d’abord.',
    en: 'At the top of Ideas, dated reminders tied to no project: « Make it an idea » keeps it at its date, « Seen » puts it away. The Overview Ideas panel shows the latest ideas, ripe ones first.',
  },
  // 3.1.59 (2026-11-18) — ideas in one place.
  wn_expense_year_t: { fr: 'Dépenses : la bonne année', en: 'Expenses: the right year' },
  wn_expense_year_d: {
    fr: 'Une dépense est rangée dans l’année de sa date, à chaque enregistrement : une dépense saisie à la main ne disparaît plus de la liste, et changer sa date d’année la déplace aussi.',
    en: 'An expense is filed under its date’s year on every save: a hand-typed expense no longer drops out of the list, and moving its date to another year moves it too.',
  },
  wn_ideas_one_place_t: { fr: 'Les idées au même endroit : Idées', en: 'Ideas in one place: Ideas' },
  wn_ideas_one_place_d: {
    fr: 'Kaizen « Création » rejoint Idées : ses entrées sont devenues des idées ou des lignes sur leurs œuvres, rien n’est perdu. Neuf rappels qui étaient en fait des idées y sont aussi, à leur date d’origine. Nouveautés est maintenant dans Opérations & Stratégie.',
    en: 'Kaizen « Creation » joins Ideas: its entries became ideas or lines on their works, nothing lost. Nine reminders that were really ideas are there too, at their original date. What’s new now sits in Operations & Strategy.',
  },
  // 3.1.58 (2026-11-18) — supply orders.
  wn_supply_orders_t: { fr: 'Fournitures : commandes et achats', en: 'Supplies: orders and purchases' },
  wn_supply_orders_d: {
    fr: 'Studio → Fournitures → Commandes : une commande à un fournisseur (ou un achat en magasin, déjà reçu). « Recevoir » ajoute les quantités au stock, met à jour le coût et le fournisseur ; une livraison partielle reste ouverte, « Clore » accepte un manque. La dépense se crée depuis la commande, et chaque dépense peut garder sa facture ou son ticket.',
    en: 'Studio → Supplies → Orders: an order to a supplier (or a shop purchase, already received). « Receive » adds the quantities to stock and updates cost and supplier; a partial delivery stays open, « Close » accepts a shortfall. The expense is made from the order, and every expense can keep its invoice or ticket.',
  },
  // 3.1.57 (2026-11-18) — order dates in the calendar.
  wn_order_calendar_t: { fr: 'Les dates des commandes dans votre agenda', en: 'Order dates in your calendar' },
  wn_order_calendar_d: {
    fr: 'Les dates d’une commande (sortie, retour, livraison…) s’ajoutent à votre agenda Google / Microsoft relié, à la création, à chaque étape et à l’annulation ; un bouton dans la commande le refait à la main. Sans agenda relié, rien ne change.',
    en: 'An order’s dates (out, back, delivery…) go into your linked Google / Microsoft calendar on create, at each step and on cancel; a button in the order does it by hand. With no calendar linked, nothing changes.',
  },
  // 3.1.56 (2026-11-18) — R7b order chain, menu counts, Overview strip.
  wn_order_cascade_t: { fr: 'Commandes : la suite s’enchaîne', en: 'Orders: the next steps follow on' },
  wn_order_cascade_d: {
    fr: 'Une commande signée ouvre son envoi dans Logistique ; payée, elle prépare le certificat ; la facture a son papier. Logistique montre les envois en cours. Le menu compte les commandes, la production, le pipeline, les événements et les envois ; l’Aperçu a une bande Commandes · Événements · Système.',
    en: 'A signed order opens its shipment in Logistics; once paid it prepares the certificate; the invoice has its paper. Logistics shows shipments in progress. The menu counts orders, production, pipeline, events and shipments; the Overview has a strip Orders · Events · System.',
  },
  // 3.1.55 (2026-11-18) — news where it happened (TODO 24).
  wn_theme_notes_t: { fr: 'Thèmes : des notes, des noms courts', en: 'Themes: notes, short names' },
  wn_theme_notes_d: {
    fr: 'Chaque thème a maintenant un champ de notes (sens, source, texte de travail) : le nom reste court. Les quatre noms les plus longs ont été raccourcis, leur texte est passé dans les notes. Les notes restent internes : le site public ne montre que le nom.',
    en: 'Each theme now has a notes field (meaning, source, working text), so the name stays short. The four longest names were shortened and their text moved into the notes. Notes stay internal: the public site shows only the name.',
  },
  wn_news_where_it_happened_t: { fr: 'Les nouveautés, là où elles sont', en: 'What’s new, where it happened' },
  wn_news_where_it_happened_d: {
    fr: 'Un point sur l’onglet du menu qui a changé ; en l’ouvrant, une ligne « Nouveau ici : … » et « Compris ». Et sur Aujourd’hui, un mot de Pem : une note vocale avec « #équipe » dans son sujet s’affiche pour toute l’équipe pendant 3 semaines, avec les dernières nouveautés en dessous.',
    en: 'A dot on the menu tab that changed; opening it shows one line « New here: … » and « Got it ». And on Today, a word from Pem: a voice note with « #équipe » in its subject shows to the whole team for 3 weeks, with the latest novelties under it.',
  },
  // 3.1.54 (2026-11-18) — image room, « Volée », voice notes, sale paper.
  wn_inputs_review_t: { fr: 'Notes vocales, photo d’inspiration, demandes du site', en: 'Voice notes, inspiration photo, site enquiries' },
  wn_inputs_review_d: {
    fr: 'Une note vocale peut être supprimée depuis le Journal, et un « #1234 » dit dans la note montre l’œuvre (vignette + titre). Photo · doc → Inspiration : une photo prise au téléphone rejoint le Journal du jour et peut être reliée à une œuvre ou une idée. Le formulaire du site enregistre le motif (acquérir, commande, exposition, presse). Le mode Création de la carte s’affiche dès l’ouverture. L’ancien champ Commentaires n’apparaît plus quand il est vide.',
    en: 'A voice note can be deleted from the Journal, and a « #1234 » said in the note shows the work (thumbnail + title). Photo · doc → Inspiration: a phone photo joins the day in the Journal and can be linked to a work or an idea. The site form saves the reason (buy, commission, exhibition, press). The map’s Création mode shows as soon as it opens. The old Commentaires field no longer shows when empty.',
  },
  wn_image_room_stolen_t: { fr: 'Image plus grande, « Volée », notes vocales', en: 'Bigger image, « Stolen », voice notes' },
  wn_image_room_stolen_d: {
    fr: 'Sur ordinateur, l’image de la fiche œuvre prend presque toute la hauteur de l’écran, en pleine définition. Nouveau sort d’une œuvre : « Volée » (et « Retrouvée »), comme Détruite / Perdue, avec sa ligne d’historique. Une note vocale courte ou sans parole ne reste plus « transcription à venir » : le texte dicté sur le téléphone sert à défaut. Le bon de vente précise les 48 h pour signaler un dommage à la livraison. Le titre des nouveautés montre la version en cours.',
    en: 'On a computer, the work card’s image takes nearly the full screen height, at full resolution. A new fate for a work: « Stolen » (and « Found »), like Destroyed / Lost, with its history line. A short or silent voice note no longer stays « transcript to come »: the phone’s dictation is used instead. The sale paper states the 48 h to report damage on delivery. The What’s new title shows the current version.',
  },
  // 3.1.53 (2026-11-18) — R7, Pem's review.
  wn_orders_review_t: { fr: 'Commandes : ce que votre relecture a demandé', en: 'Orders: what your review asked for' },
  wn_orders_review_d: {
    fr: 'Nouveau contact directement depuis le formulaire de commande ; prix final calculé à la saisie (prix − remise) avec une ligne TVA « à définir » ; « Remis » visible sur les dons ; « Créer la commande » depuis Pipeline ; une vente « emportée aujourd’hui » à l’atelier passe « Livrée » dès le paiement (sauf commandes à faire et œuvres gardées) ; « Marquer remboursé » sur une vente retournée ; une œuvre donnée ne revient plus dans les étapes ni en « Disponible ». Les anciennes tables de ventes (vides) sont supprimées.',
    en: 'New contact straight from the order form; final price worked out as you type (price − discount) with a VAT line « to be set »; « Handed over » shown on gifts; « Create the order » from Pipeline; a studio sale « taken away today » becomes « Delivered » as soon as it is paid (except commissions and held works); « Mark refunded » on a returned sale; a given work no longer goes back into the stages or « Available ». The old (empty) sales tables are gone.',
  },
  // 3.1.52 (2026-11-18) — R6.
  wn_events_tab_t: { fr: 'Expositions & événements : un seul onglet, sur les commandes', en: 'Exhibitions & events: one tab, on the orders' },
  wn_events_tab_d: {
    fr: 'Dans Studio → Expositions : la liste des événements, et pour chacun les œuvres (où est chacune maintenant), les cases de préparation datées (cartel, constat, emballage, accrochage, photo…), les personnes et leur rôle, ce qu’il reste à préparer. Les sorties d’œuvres passent par un Prêt ou un Dépôt en brouillon créé depuis l’événement. Sur le téléphone, la vue « sur place ». Les pages du téléphone sont aussi plus légères.',
    en: 'In Studio → Exhibitions: the list of events, and for each the works (where each one is now), dated prep ticks (label, condition report, packing, hanging, photo…), the people and their roles, what is left to prepare. Works go out through a draft Loan or Deposit made from the event. On the phone, the « on site » view. Phone pages are lighter too.',
  },

  // 3.1.8 (2026-11-14) — export rebuilt with a live preview (B3); Constellation arrows.
  // 3.1.30 (2026-11-16) — the rest of the catalogue in one request (TODO 19).
  // 3.1.51 (2026-11-17) — work rules batch 2.
  wn_previews_everywhere_t: { fr: 'Vignette et titre sur chaque numéro d’œuvre', en: 'Thumbnail and title on every work number' },
  wn_previews_everywhere_d: {
    fr: 'Commandes, Coffre, tableau Production, Pipeline, Constellation, ⌘K et les listes de choix montrent maintenant la vignette et le titre de chaque œuvre ; un appui long ou le survol ouvre la grande image. Une œuvre détruite ou perdue ne peut plus être cochée « Montrable ».',
    en: 'Orders, Vault, Production board, Pipeline, Constellation, ⌘K and the pickers now show each work’s thumbnail and title; a long press or hover opens the big picture. A destroyed or lost work can no longer be ticked « Showable ».',
  },
  wn_work_rules_checked_t: { fr: 'L’historique ne se perd plus, et la photo validée prévient', en: 'History is no longer lost, and validating a photo warns first' },
  wn_work_rules_checked_d: {
    fr: 'Enregistrer une fiche ne fait plus disparaître une ligne d’historique écrite entre-temps. Valider la photo d’une œuvre de l’atelier demande d’abord : elle passera Disponible et sera visible sur le site. La modification en lot refuse « Catalogué » sans photo. Audit → Règles liste les œuvres qui ne suivent pas une règle (vérifié aussi chaque nuit).',
    en: 'Saving a work card no longer drops a history line written meanwhile. Validating the photo of a studio work asks first: it will become Available and show on the website. Batch edit refuses « Catalogued » without a photo. Audit → Rules lists the works that break a rule (also checked every night).',
  },
  // 3.1.50 (2026-11-17) — R7 closes: Confié, 14-day return; work state batch 1.
  wn_work_state_one_rule_t: { fr: 'Une seule règle pour l’état d’une œuvre', en: 'One rule for a work’s state' },
  wn_work_state_one_rule_d: {
    fr: 'La fiche et le tableau Production suivent une seule règle : une œuvre cataloguée avec sa photo validée passe Disponible d’elle-même, sinon elle reste En production ; les tâches Cataloguer / Photographier s’ouvrent et se ferment seules ; l’historique s’écrit tout seul à chaque changement de statut, de propriétaire ou de dépositaire.',
    en: 'The work card and the Production board follow one rule: a catalogued work with its photo approved becomes Available by itself, otherwise it stays In production; the Catalogue / Photograph tasks open and close by themselves; the history writes itself at every change of status, owner or holder.',
  },
  wn_return_14_days_confie_t: { fr: 'Retour de 14 jours sur chaque vente, et les commandes « Confié »', en: '14-day return on every sale, and « Entrusted » orders' },
  wn_return_14_days_confie_d: {
    fr: 'Chaque vente a 14 jours de retour à partir de la livraison (ou de la remise en main propre) : la commande, la fiche et le téléphone montrent les jours restants. L’argent reçu reste « en attente » jusqu’à la fin du délai ; les totaux de l’année dans Revenus & dépenses ne comptent que l’argent définitif. « Retour » annule la vente, ramène les œuvres à l’atelier et indique le montant à rembourser (l’application ne vire rien). Le bon de commande porte le droit de retour et un formulaire à découper. Nouveau type de commande « Confié » : une œuvre chez un encadreur, un restaurateur ou un photographe garde son étape et affiche « chez … » jusqu’à son retour.',
    en: 'Every sale has 14 days to return from delivery (or handover in person): the order, the work card and the phone show the days left. Money received stays « held » until the period ends; the year totals in Revenue & expenses count only definitive money. « Return » cancels the sale, brings the works back to the studio and shows the amount to refund (the app moves no money). The purchase order carries the return right and a cut-off form. New order kind « Entrusted »: a work at a framer, restorer or photographer keeps its stage and shows « at … » until it comes back.',
  },
  // 3.1.49 (2026-11-17) — Archive = the shelf (archive_shelf.sql).
  wn_archive_shelf_t: { fr: 'Archive : on range, on peut ressortir', en: 'Archive: put away, and back out when you want' },
  wn_archive_shelf_d: {
    fr: 'Une œuvre part en archive seulement une fois cataloguée (une fiche partielle suffit) : sinon « Archive » reste fermé sur la fiche. En archive, ses tâches ouvertes (Cataloguer, Photographier…) sont mises en pause : elles quittent la Production sans être cochées. Pour la ressortir, choisir « Artiste » puis son étape : En production (les tâches reviennent) ou Disponible si la photo est faite.',
    en: 'A work goes to the archive only once catalogued (a partial record is enough): otherwise « Archive » stays closed on the card. In the archive, its open tasks (Catalogue, Photograph…) are paused: they leave Production without being ticked. To bring it back, choose « Artist » then its stage: In production (the tasks come back) or Available if the photo is done.',
  },
  // 3.1.49 (2026-11-17) — R4 build v1; R7 values + gift at handover.
  wn_orders_values_gift_handover_t: { fr: 'Commandes : une valeur par œuvre, le don se fait à la remise', en: 'Orders: a value per work, a gift happens at handover' },
  wn_orders_values_gift_handover_d: {
    fr: 'Chaque œuvre d’une commande a sa valeur : valeur d’assurance pour un prêt, prix convenu pour un dépôt, valeur de référence pour un don (jamais imprimée sur l’acte). Un don se fait à la remise : signer l’acte ne change rien, la remise rend le bénéficiaire propriétaire et refait l’acte daté. Les chiffres de l’ancien onglet Ventes sont dans Revenus & dépenses ; changer l’étape d’une œuvre à la main crée une commande en brouillon dans le Fil.',
    en: 'Each work on an order has its value: insurance value for a loan, agreed price for a deposit, reference value for a gift (never printed on the deed). A gift happens at handover: signing the deed changes nothing, the handover makes the recipient the owner and remakes the dated deed. The old Sales tab figures are in Revenue & expenses; changing a work’s stage by hand makes a draft order in the Fil.',
  },
  wn_timeline_map_previews_t: { fr: 'Chronologie, carte « Création », et un numéro d’œuvre montre toujours l’œuvre', en: 'Timeline, map « Création », and a work number always shows the work' },
  wn_timeline_map_previews_d: {
    fr: 'Nouvel onglet Chronologie (Catalogue, sur ordinateur) : les œuvres, séances, jours du Journal et commandes dans le temps ; choisir une période ouvre ce qu’elle contient, « Voir sur la carte » passe à la Carte. La Carte gagne le mode Création : où les œuvres ont été faites. Partout où un numéro #1234 apparaît (Journal, Aujourd’hui, Fil, fiche, Broadcast, Revenus & dépenses), il vient avec sa vignette et son titre ; un appui long ou le survol ouvre la grande image avec sa légende.',
    en: 'New Timeline tab (Catalogue, on a computer): works, sessions, Journal days and orders over time; picking a span opens what it holds, « See on the map » goes to the Map. The Map gains a Création mode: where the works were made. Wherever a #1234 number shows (Journal, Today, Fil, work card, Broadcast, Revenue & expenses), it comes with its thumbnail and title; a long press or hover opens the big picture with its caption.',
  },
  // 3.1.48 (2026-11-17) — destroyed / lost works on the card and in the history; R7 step 2.
  wn_orders_everywhere_t: { fr: 'Une vente, un dépôt, un prêt ou un don passe toujours par une commande', en: 'A sale, deposit, loan or gift always goes through an order' },
  wn_orders_everywhere_d: {
    fr: 'Le menu Commercial s’appelle Business et Ventes s’appelle Commandes. « Don… » sur la fiche, une vente ou un dépôt dans Pipeline, « Envoyer des œuvres » dans Expositions et la vente sur le téléphone créent maintenant une commande en brouillon avec son papier : l’œuvre ne bouge qu’aux étapes de la commande (signée, sortie, remise). Sur une vente signée, « Encaisser » enregistre un paiement, compté dans Revenus & dépenses.',
    en: 'The Commercial menu is now Business and Sales is now Orders. « Gift… » on the card, a sale or deposit in Pipeline, « Send works » in Exhibitions and the phone sale now make a draft order with its paper: the work moves only at the order’s steps (signed, out, handed over). On a signed sale, « Record a payment », counted in Revenue & expenses.',
  },
  wn_fate_card_history_t: { fr: 'Œuvre détruite ou perdue : la fiche le dit', en: 'Destroyed or lost work: the card says so' },
  wn_fate_card_history_d: {
    fr: 'Sur la fiche d’une œuvre détruite ou perdue, la ligne Production affiche « Détruite · date » au lieu d’« En production ». Le constat de destruction ou de perte écrit sa ligne dans Historique / provenance (et « Retrouvée » quand on clôt une perte). Enregistrer la fiche n’ajoute plus de fausse ligne « statut 9 → En production ».',
    en: 'On the card of a destroyed or lost work, the Production row shows « Destroyed · date » instead of « In production ». The destruction or loss report writes its line in History / provenance (and « Found » when a loss is closed). Saving the card no longer adds a false « statut 9 → En production » line.',
  },
  // 3.1.47 (2026-11-17) — one language per page; R8 first batch.
  wn_lighter_pages_site_t: { fr: 'Pages plus légères, site public retouché', en: 'Lighter pages, public site touched up' },
  wn_lighter_pages_site_d: {
    fr: 'Chaque page n’envoie plus que la langue choisie : le téléphone charge environ un cinquième de moins. Sur le site public : la légende d’une œuvre donne son support, le formulaire de contact propose Acquérir une œuvre, Commande, Exposition ou Presse, et un lien partagé montre une grande image de l’œuvre.',
    en: 'Each page now sends only the chosen language: the phone loads about a fifth less. On the public site: a work’s caption gives its medium, the contact form offers Buy a work, Commission, Exhibition or Press, and a shared link shows a large image of the work.',
  },
  // 3.1.46 (2026-11-17) — R7 build step 1.
  wn_orders_papers_t: { fr: 'Commandes : une œuvre qui sort, un papier', en: 'Orders: a work goes out, a paper' },
  wn_orders_papers_d: {
    fr: 'Dans Ventes, « Commandes » réunit tout ce qui sort de l’atelier : vente, dépôt-vente, prêt, don, avec ses étapes. Chaque commande a son papier (bon de commande, bordereau de dépôt-vente, contrat de prêt, acte de don), rangé dans le Coffre sous Commandes ; la copie signée se range à côté. Un dépôt ou un prêt demande ses dates de sortie et de retour.',
    en: 'In Sales, « Orders » gathers everything that leaves the studio: sale, consignment, loan, gift, with its steps. Each order has its paper (order form, consignment slip, loan contract, deed of gift), filed in the Vault under Orders; the signed copy goes beside it. A consignment or loan needs its out and back dates.',
  },
  // 3.1.45 (2026-11-17) — R1 step 7.
  wn_voice_in_journal_t: { fr: 'Les notes vocales vivent dans le Journal', en: 'Voice notes live in the Journal' },
  wn_voice_in_journal_d: {
    fr: 'Une note vocale apparaît sur son jour dans le Journal, parmi les entrées. « Relier… » la rattache à une œuvre, une idée, un projet, un constat ou un rappel daté. L’écran « Notes » disparaît : son ancien lien ouvre le Journal. L’enregistrement ne demande plus de type ni de projet. Les suggestions ✦ sont plus rares : au plus l’œuvre et l’idée les plus proches par entrée.',
    en: 'A voice note shows on its day in the Journal, among the entries. « Link… » ties it to a work, an idea, a project, a condition report or a dated reminder. The « Notes » screen is gone: its old link opens the Journal. Recording no longer asks for a kind or a project. ✦ suggestions are rarer: at most the closest work and the closest idea per entry.',
  },
  // 3.1.44 (2026-11-17) — R2 speed safeguards.
  wn_today_cached_copy_t: { fr: 'Aujourd’hui s’ouvre tout de suite', en: 'Today opens at once' },
  wn_today_cached_copy_d: {
    fr: 'Au téléphone, « Aujourd’hui » s’affiche depuis la dernière copie gardée par le téléphone, puis se met à jour ; si la copie a plus d’une minute, « Mis à jour il y a N min » le dit. Se déconnecter efface ces copies. Les volets repliés s’ouvrent aussi plus vite.',
    en: 'On the phone, « Today » shows the last copy the phone kept, then refreshes; if that copy is more than a minute old, « Updated N min ago » says so. Signing out wipes these copies. The folded sections also open faster.',
  },
  // 3.1.43 (2026-11-17) — R1 6.4b: work notes as lines, « Pour vous » (the Fil on Overview is admin-only: not here); readable field names.
  wn_work_note_lines_t: { fr: 'Notes d’œuvre : une ligne par personne', en: 'Work notes: one line per person' },
  wn_work_note_lines_d: {
    fr: 'Sur la fiche d’une œuvre, les notes deviennent des lignes séparées, chacune avec son auteur et sa date ; on en ajoute une sans toucher aux autres. « Une idée pour Pem ? » envoie la ligne directement à Pem. Sur la Vue d’ensemble, « Pour vous » montre vos lignes et ce qu’elles sont devenues.',
    en: 'On a work’s card, notes become separate lines, each with its author and date; you add one without touching the others. « An idea for Pem? » sends the line straight to Pem. On Overview, « For you » shows your lines and what became of them.',
  },
  wn_field_names_readable_t: { fr: 'Champs modifiés : des noms lisibles', en: 'Changed fields: readable names' },
  wn_field_names_readable_d: {
    fr: 'Quand un attribut d’œuvre change (Aujourd’hui, Journal, comparaison de séance, historique des versions), son nom s’affiche en clair — Année, Statut, Dépositaire, Taux de TVA… — et non plus le nom de la colonne en base.',
    en: 'When a work attribute changes (Today, Journal, session compare, version history), its name shows in plain words — Year, Status, Custodian, VAT rate… — instead of the database column name.',
  },
  // 3.1.42 (2026-11-17) — R2: days, ✦ rows, folds, phone menu.
  wn_today_days_menu_t: { fr: 'Aujourd’hui : d’un jour à l’autre', en: 'Today: day to day' },
  wn_today_days_menu_d: {
    fr: 'Sur « Aujourd’hui » au téléphone, ‹ › passent au jour précédent ou suivant. On y trouve aussi les suggestions ✦ du jour avec leur vignette, les œuvres photographiées ce jour-là, et deux volets repliés : attributs d’œuvres modifiés et Création (Kaizen). Le menu du téléphone commence par Aujourd’hui · Idées ; « Notes » est rangé dans le Journal.',
    en: 'On the phone’s « Today », ‹ › step to the previous or next day. It also shows the day’s ✦ suggestions with their thumbnail, the works photographed that day, and two folded sections: changed work attributes and Creation (Kaizen). The phone menu starts with Today · Ideas; « Notes » lives in the Journal.',
  },
  // 3.1.41 (2026-11-17) — R1: Idées for the team.
  wn_ideas_team_t: { fr: 'Idées : proposer, discuter', en: 'Ideas: propose, discuss' },
  wn_ideas_team_d: {
    fr: 'Les « Concepts » deviennent « Idées ». Chacun peut lire les idées de Pem et y ajouter une ligne : une idée devient une discussion. Pour une idée nouvelle, « Proposer une idée » (un texte, un numéro d’œuvre si besoin) l’envoie directement à Pem. Pem classe chaque idée : petite ou recherche, et graine, pousse ou mûre.',
    en: '« Concepts » become « Ideas ». Everyone can read Pem’s ideas and add a line to them: an idea becomes a discussion. For a new idea, « Propose an idea » (a text, a work number if needed) sends it straight to Pem. Pem sorts each idea: small or research, and seed, sprout or ripe.',
  },
  // 3.1.40 (2026-11-17) — R2: Œuvre + Vocal sheets on the phone bar (the Fil is admin-only: admin guide, not here).
  wn_phone_work_voice_sheets_t: { fr: 'Au téléphone : Œuvre et Vocal', en: 'On the phone: Work and Voice' },
  wn_phone_work_voice_sheets_d: {
    fr: 'Le bouton « Œuvre » de la barre propose d’abord le choix : nouvelle œuvre, reprise d’une œuvre, ou photos de la séance. Dans « Vocal », les mots s’affichent pendant l’enregistrement quand le téléphone le permet (« Masquer les mots » pour les cacher) et restent comme premier texte de la note ; le son est toujours gardé et transcrit sur le PC. Le choix « Mémo · Général » disparaît du téléphone.',
    en: 'The bar’s « Work » button first offers the choice: new work, resuming a work, or session photos. In « Voice », words show while recording when the phone can (« Hide words » turns them off) and stay as the note’s first text; the audio is always kept and transcribed on the PC. The « Memo · General » choice is gone from the phone.',
  },
  // 3.1.39 (2026-11-17) — Triage on the shared swipe deck.
  wn_triage_swipe_undo_t: { fr: 'Triage : balayer, 6 s pour annuler', en: 'Triage: swipe, 6 s to undo' },
  wn_triage_swipe_undo_d: {
    fr: 'Le Triage (publications en attente, demandes du site) montre une carte à la fois : vers la gauche pour refuser ou classer, vers la droite pour valider — ou les boutons ✕ ✓, ou les flèches ← → au clavier. Pendant 6 secondes, « Annuler » ramène la carte ; rien n’est envoyé avant.',
    en: 'Triage (posts waiting to go out, site enquiries) shows one card at a time: left to reject or file, right to approve — or the ✕ ✓ buttons, or the ← → keys. For 6 seconds « Undo » brings the card back; nothing is sent before.',
  },
  // 3.1.38 (2026-11-17) — R2: « À revoir » actions on Aujourd'hui; « Plus tard ».
  wn_see_again_later_t: { fr: '« À revoir » : Plus tard', en: '« See again »: Later' },
  wn_see_again_later_d: {
    fr: 'Sur « Aujourd’hui » au téléphone, « À revoir » montre une carte à la fois (« 1 / 3 › ») avec ses boutons : ouvrir, écrire à ce sujet, lier, sans rapport. « Ne plus montrer » devient « Plus tard » partout : l’entrée ou l’œuvre revient au bout de 7 jours. « Sans rapport » reste définitif.',
    en: 'On the phone’s « Today », « See again » shows one card at a time (« 1 / 3 › ») with its buttons: open, write about it, link, not related. « Don’t show again » becomes « Later » everywhere: the entry or work comes back after 7 days. « Not related » stays final.',
  },
  // 3.1.37 (2026-11-17) — R2: the Hub opens on « Aujourd'hui », streamed; Bureau fold; Journal quick row → bar.
  wn_hub_opens_today_t: { fr: 'Le Hub s’ouvre sur Aujourd’hui', en: 'The Hub opens on Today' },
  wn_hub_opens_today_d: {
    fr: 'Sur le téléphone, le Hub (et l’app) s’ouvre directement sur « Aujourd’hui ». La date et la barre de saisie arrivent tout de suite ; « À revoir », les œuvres et les écrits du jour suivent dès qu’ils sont prêts. Pipeline, Vente, Triage, Contact, Document, Problème et la déconnexion sont rangés dans « Bureau », replié en bas. Dans la journée du Journal, les boutons Écrire · Dicter · Note vocale · Capture laissent la place à la barre du bas.',
    en: 'On the phone, the Hub (and the app) opens straight on « Today ». The date and the input bar come at once; « See again », the works and the writings of the day follow as soon as they are ready. Pipeline, Sale, Triage, Contact, Document, Issue and sign-out sit in « Desk », folded at the bottom. On a Journal day, the Write · Dictate · Voice note · Capture buttons give way to the bottom bar.',
  },
  // 3.1.36 (2026-11-17) — R2: « Aujourd'hui » light phone page + one input bar on every phone screen.
  wn_phone_today_bar_t: { fr: 'Au téléphone : Aujourd’hui et une barre de saisie', en: 'On the phone: Today and one input bar' },
  wn_phone_today_bar_d: {
    fr: 'Une page « Aujourd’hui » légère (ligne Journal du Hub) : la journée, « À revoir », les œuvres du jour et les écrits s’affichent d’un coup, sans charger tout l’atelier. En bas de chaque écran du téléphone, une seule barre : Écrire (ouvre le formulaire du jour) · Vocal · Œuvre · Photo · doc (document, carte de visite, étiquette QR). Les rappels restent dans le menu.',
    en: 'A light « Today » page (the Hub’s Journal row): the day, « See again », the works of the day and the writings show at once, without loading the whole studio. At the bottom of every phone screen, one bar: Write (opens today’s form) · Voice · Work · Photo · doc (document, business card, QR label). Reminders stay in the menu.',
  },
  // 3.1.35 (2026-11-17) — long-press preview (B13) + small GIF captions (B14).
  wn_loupe_gif_caption_fixes_t: { fr: 'Aperçu au doigt et petits GIF', en: 'Long-press preview and small GIFs' },
  wn_loupe_gif_caption_fixes_d: {
    fr: 'Au téléphone, l’aperçu d’une œuvre (appui long sur sa vignette) se ferme d’un toucher et ne revient plus tout seul ; la liste ne défile plus dessous. Dans l’export de diaporama, la légende d’un petit GIF tient en bas du cadre (un tiers au plus, coupée par « … ») ; sous 88 px elle est laissée de côté.',
    en: 'On the phone, a work’s preview (long press on its thumbnail) closes with one tap and no longer comes back by itself; the list no longer scrolls underneath. In the slideshow export, a small GIF’s caption fits at the bottom of the frame (a third at most, cut with « … »); under 88 px it is left out.',
  },
  // 3.1.34 (2026-11-17) — R3 step 3: phone recording screen + card rules.
  wn_work_record_phone_t: { fr: 'Enregistrer une œuvre au téléphone', en: 'Record a work on the phone' },
  wn_work_record_phone_d: {
    fr: 'Au téléphone, « + œuvre » ouvre un écran court : « Nouvelle œuvre » (photo, titre, technique, support, format, lieu) ou « Reprise » (choisir l’œuvre, ajouter la photo et une ligne « Reprise » dans son historique, même numéro). La fiche suit aussi des règles : une œuvre en archive ne peut pas être Disponible et son gardien est l’artiste. Tous les boutons de la fiche se touchent facilement au téléphone.',
    en: 'On the phone, « + œuvre » opens a short screen: « Nouvelle œuvre » (photo, title, technique, support, format, place) or « Reprise » (pick the work, add the picture and a « Reprise » line in its history, same number). The card also follows rules: an archived work can’t be Available and its custodian is the artist. Every button on the card is easy to tap on the phone.',
  },
  // 3.1.33 (2026-11-17) — R3 step 2: the card's « Objet » part.
  wn_work_card_objet_t: { fr: 'Fiche œuvre : logistique, commande, présentation', en: 'Work card: logistics, commission, presentation' },
  wn_work_card_objet_d: {
    fr: 'Dans « Objet » : les envois de l’œuvre et ses dates de livraison et de retour (un repère en haut tant qu’un envoi est en cours), « Commande » avec son client, et les étapes de présentation Montée / Encadrée / Exposable / Prêt à diffuser. Chaque pastille explique son sens au survol (appui long sur téléphone). « Montée » n’est plus effacée à l’enregistrement.',
    en: 'In « Objet »: the work’s shipments and its delivery and return dates (a marker on top while a shipment is open), « Commande » with its client, and the presentation steps Mounted / Framed / Exhibitable / Ready to share. Every chip explains itself on hover (long press on the phone). « Mounted » is no longer cleared on save.',
  },
  // 3.1.32 (2026-11-16) — R3 step 1: the work card re-laid out.
  wn_work_card_r3_t: { fr: 'Nouvelle fiche œuvre', en: 'New work card' },
  wn_work_card_r3_d: {
    fr: 'La fiche œuvre est réorganisée : en haut l’essentiel (image, étapes en couleur, propriété, gardien, technique, dimensions, période), puis deux tiroirs « Création » et « Objet ». « Replié » montre l’essentiel et regroupe les champs vides ; « Développé » ouvre tout. Les images se réordonnent en les glissant, chaque couleur montre son code hex, et Annuler / Enregistrer restent toujours en bas.',
    en: 'The work card is reorganised: the essentials on top (picture, coloured stages, ownership, custodian, technique, dimensions, period), then two drawers, « Création » and « Objet ». « Replié » shows the essentials and gathers the empty fields; « Développé » opens everything. Drag pictures to reorder them, each colour shows its hex code, and Cancel / Save always stay at the bottom.',
  },
  // 3.1.31 (2026-11-16) — one card per work link; Overview counts from the start (TODO 18).
  wn_work_link_one_card_t: { fr: 'Un lien vers une œuvre ouvre une seule fiche', en: 'A work link opens one card' },
  wn_work_link_one_card_d: {
    fr: 'Sur ordinateur, un lien #1234 vers l’Inventaire (Journal, Notes, scan) montre l’œuvre dans le panneau latéral, au lieu d’ouvrir une seconde fiche par-dessus.',
    en: 'On a computer, a #1234 link to the Inventory (Journal, Notes, scan) shows the work in the side panel instead of opening a second card on top.',
  },
  wn_overview_counts_server_t: { fr: 'Vue d’ensemble juste dès l’ouverture', en: 'Overview right from the start' },
  wn_overview_counts_server_d: {
    fr: 'Les chiffres de la Vue d’ensemble comptent tout le catalogue dès l’ouverture, sans attendre qu’il soit chargé.',
    en: 'The Overview’s numbers count the whole catalogue as soon as it opens, without waiting for it to load.',
  },
  wn_catalogue_one_call_t: { fr: 'Catalogue complet plus vite', en: 'Full catalogue sooner' },
  wn_catalogue_one_call_d: {
    fr: 'Après les premières œuvres, le reste du catalogue arrive en une seule requête au lieu d’une par tranche de 500 : l’Inventaire est complet bien plus tôt.',
    en: 'After the first works, the rest of the catalogue arrives in one request instead of one per 500 works: the Inventory is complete much sooner.',
  },
  // 3.1.29 (2026-11-16) — batch 2: one read on open (TODO 18), Journal ✦ loupe (B12), Constellation panel (B11).
  wn_open_one_read_t: { fr: 'Fiche et Vue d’ensemble plus rapides', en: 'Faster work card and Overview' },
  wn_open_one_read_d: {
    fr: 'La fiche d’une œuvre et la Vue d’ensemble se chargent en une seule requête au lieu de 8 à 14 à la suite : la fiche est prête environ 3 fois plus vite.',
    en: 'A work’s card and the Overview now load in one request instead of 8 to 14 in a row: the card is ready about 3× faster.',
  },
  wn_journal_suggestion_loupe_t: { fr: 'Journal : aperçu sur les suggestions ✦', en: 'Journal: preview on ✦ suggestions' },
  wn_journal_suggestion_loupe_d: {
    fr: 'Les œuvres suggérées par l’IA (✦), celles de « Création » et la liste des modifications montrent l’aperçu et la loupe au survol, comme les liens confirmés ; une œuvre sans titre dit « Sans titre ». Dans Constellation, « Tout en groupe » reste dans le panneau et « Effacer tout » devient ⌫.',
    en: 'Works suggested by the AI (✦), « Création » works and the changes list show the preview and loupe on hover, like confirmed links; a work with no title says « Untitled ». In Constellation, « Tout en groupe » stays inside the panel and « Clear all » becomes ⌫.',
  },
  // 3.1.28 (2026-11-16) — parallel batch 1: B9 quick fixes, small round GIFs (21), Constellation tools (20).
  wn_constellation_tools_t: { fr: 'Constellation : annuler, sélection au rectangle, flèches', en: 'Constellation: undo, rectangle selection, arrows' },
  wn_constellation_tools_d: {
    fr: 'Ctrl+Z annule (et Ctrl+Maj+Z rétablit) les dessins, les textes, les déplacements et les liens — un lien supprimé revient avec sa note. Maj+glisser trace un rectangle de sélection animé ; l’outil flèche dessine une flèche à main levée. Un mode d’emploi (fermé par défaut) dans le panneau de droite explique les gestes et les types de liens ; « Tout ajouter » dit qu’il s’arrête à 120 œuvres, exprès.',
    en: 'Ctrl+Z undoes (and Ctrl+Shift+Z redoes) drawings, texts, moves and links — a deleted link comes back with its note. Shift+drag draws an animated selection rectangle; the arrow tool draws a freehand arrow. A how-to (folded by default) in the right panel explains the gestures and the link types; « Add all » says it stops at 120 works, on purpose.',
  },
  wn_slideshow_small_gifs_t: { fr: 'Diaporama : petits GIF et cadre rond', en: 'Slideshow: small GIFs and a round frame' },
  wn_slideshow_small_gifs_d: {
    fr: 'Un curseur de taille règle le grand côté du cadre, jusqu’à 40 px (40 × 40, 50 × 60…). Avec « Entière (fond autour) », un cadre rond met l’image dans un cercle. Sous 1 Mo, la taille du fichier s’affiche en Ko.',
    en: 'A size slider sets the frame’s long side, down to 40 px (40 × 40, 50 × 60…). With « Whole (background around) », a round frame puts the picture in a circle. Under 1 MB the file size shows in KB.',
  },
  wn_inventory_card_fixes_t: { fr: 'Inventaire et fiche : petites corrections', en: 'Inventory and work card: small fixes' },
  wn_inventory_card_fixes_d: {
    fr: 'La fiche dit « Catalogué », comme l’Inventaire, pour une œuvre cataloguée qui attend sa photo. Le lien du QR mène toujours au site public. Dans le tableau, l’année « en cours » et la colonne Diffusion ne sont plus coupées. « Filtres + » ouvre directement une ligne de filtre (sur le titre, qui ne filtre rien tant qu’elle est vide). « Historique des versions » devient « Historique des données ».',
    en: 'The work card says « Catalogued », like the Inventory, for a catalogued work waiting for its photo. The QR link always leads to the public site. In the table, the « in progress » year and the Broadcast column are no longer cut. « Filters + » opens a filter row straight away (on the title; it filters nothing while empty). « Version history » becomes « Data history ».',
  },
  // 3.1.27 (2026-11-16) — labels print the image; text never overlaps (TODO B7, Pem's screenshot).
  wn_labels_image_t: { fr: 'Étiquettes : l’image de l’œuvre', en: 'Labels: the work’s image' },
  wn_labels_image_d: {
    fr: 'Avec « Image » coché, chaque étiquette imprime l’image de l’œuvre à gauche du texte (PDF et HTML, couleur ou noir et blanc comme l’export). Sur les planches L7160 et L7651, l’image et le QR ne tiennent pas ensemble : avec le QR, l’image est grisée. Chaque information tient sur une ligne, coupée avec « … » : le texte ne se chevauche plus. Statut et notes sont grisés : ils ne s’impriment pas sur les étiquettes.',
    en: 'With « Image » ticked, each label prints the work’s image left of the text (PDF and HTML, colour or black and white like the export). On the L7160 and L7651 sheets the image and the QR do not fit together: with the QR on, the image is greyed out. Each piece of text stays on one line, cut with « … »: no more overlapping. Status and notes are greyed out: they are not printed on labels.',
  },
  // 3.1.26 (2026-11-15) — Constellation eraser: one whole object per click (TODO B6).
  wn_constellation_eraser_t: { fr: 'Constellation : la gomme efface un objet entier', en: 'Constellation: the eraser removes a whole object' },
  wn_constellation_eraser_d: {
    fr: 'Avec la gomme, un clic efface le trait ou le texte sous le curseur en entier, ou à défaut le lien entre deux œuvres. Glisser n’efface plus tout sur son passage. Un lien effacé est supprimé (pas d’annulation).',
    en: 'With the eraser, one click removes the whole stroke or text under the cursor, or else the link between two works. Dragging no longer wipes everything it passes over. An erased link is deleted (no undo).',
  },
  // 3.1.25 (2026-11-15) — Constellation keeps the blank canvas + selection for the session (TODO B5).
  wn_constellation_session_t: { fr: 'Constellation : le canevas libre reste', en: 'Constellation: the blank canvas stays' },
  wn_constellation_session_d: {
    fr: 'Les œuvres posées sur le canevas libre, leur place, vos dessins et la sélection restent quand vous changez d’onglet ou rechargez la page, jusqu’à la fermeture de l’onglet du navigateur.',
    en: 'Works placed on the blank canvas, their spots, your drawings and the selection now stay when you switch tabs or reload the page, until you close the browser tab.',
  },
  // 3.1.24 (2026-11-15) — exhibition floor plan: groups, saved moves, open a work (TODO B4).
  wn_floor_plan_groups_t: { fr: 'Plan de salle : placer un groupe', en: 'Floor plan: place a group' },
  wn_floor_plan_groups_d: {
    fr: 'Dans Expositions → Plan de salle, choisissez un groupe d’œuvres au-dessus de la liste : ses œuvres s’affichent, « Tout placer » les pose sur le plan. Une œuvre déplacée sur le plan garde sa place (avant, le déplacement se perdait). Double-clic sur une œuvre : sa fiche s’ouvre.',
    en: 'In Exhibitions → Floor plan, pick a work group above the list: its works show, « Place all » puts them on the plan. A work moved on the plan keeps its spot (moves used to be lost). Double-click a work to open its card.',
  },
  // 3.1.22 → corrected 3.1.23 (2026-11-15) — Exhibitions list keeps new and past exhibitions (TODO B3; applications stay in Pipeline).
  wn_exhibitions_all_t: { fr: 'Expositions : les nouvelles restent dans la liste', en: 'Exhibitions: new ones stay in the list' },
  wn_exhibitions_all_d: {
    fr: 'Une exposition créée sans dates disparaissait au rechargement : elle reste maintenant, en tête de liste. L’onglet montre les expositions acceptées, en cours ou passées (l’historique reste) ; les candidatures — résidences, salons, prix, refusées comprises — restent dans Suivi.',
    en: 'An exhibition created without dates vanished on reload: it now stays, at the top. The tab shows accepted exhibitions, current or past (history stays); applications — residencies, salons, prizes, rejected ones included — stay in Pipeline.',
  },
  // 3.1.21 (2026-11-15) — palette = main colours (TODO B9 #6, docs/TODO_NOTES.md « palette-main-colours »).
  wn_palette_main_colours_t: { fr: 'Palette : les couleurs principales de l’œuvre', en: 'Palette: the work’s main colours' },
  wn_palette_main_colours_d: {
    fr: 'La palette nomme les couleurs de l’œuvre, pas leur surface. Une touche de rouge compte même minuscule, nommée par sa primaire (un rouge orangé est un rouge, un brun un orange sombre) ; sa pastille est la moyenne de la touche. Un trait blanc sur fond sombre (craie) compte comme blanc. Le bord de la photo (scotch, table) est ignoré pour les touches. Toutes les palettes ont été recalculées, le filtre couleur en tient compte.',
    en: 'The palette names the work’s colours, not their area. A touch of red counts even when tiny, named by its primary (an orange-ish red is a red, a brown a dark orange); its swatch is the touch’s average. A white mark on a dark ground (chalk) counts as white. The edge of the photo (tape, table) is ignored for touches. Every palette was recomputed; the colour filter uses them.',
  },
  // 3.1.20 (2026-11-15) — bug batch 1 (TODO B1, B2, B8, B10, 1f).
  wn_bug_batch_1_t: { fr: 'Corrections : Notes, tableaux croisés, Coffre', en: 'Fixes: Notes, pivot tables, Vault' },
  wn_bug_batch_1_d: {
    fr: 'Notes : la transcription faite par le PC (aussi dans le Journal) s’affiche maintenant dans la note, marquée ✦ ; « Enregistrer » garde votre version. Une transcription modifiée n’est plus perdue : changer de note ou d’onglet demande d’enregistrer, et le bouton reste en bas de l’écran. Les tableaux croisés (Inventaire, Ventes, Rapports, Revenus & Dépenses) et « Fournisseurs » s’ouvrent repliés ; ouverts une fois, ils le restent pour la session. Coffre : les boutons du panneau ne sont plus coupés, et un fichier .txt montre son texte. Fiche œuvre : « 1 photo » au singulier.',
    en: 'Notes: the PC transcript (also in the Journal) now shows in the note, marked ✦; « Save » keeps your version. An edited transcript is no longer lost: switching note or tab asks to save, and the button stays at the bottom of the screen. Pivot tables (Inventory, Sales, Reports, Income & Expenses) and « Suppliers » open collapsed; once opened they stay open for the session. Vault: the panel buttons are no longer cut off, and a .txt file shows its text. Work card: « 1 photo », singular.',
  },
  // 3.1.19 (2026-11-15) — QR code on labels.
  wn_labels_qr_t: { fr: 'Étiquettes avec QR code', en: 'Labels with a QR code' },
  wn_labels_qr_d: {
    fr: 'Exporter → Étiquettes : cochez « QR code » pour l’imprimer à droite de chaque étiquette. Scanné avec l’Atelier, il ouvre l’œuvre — pour les étiquettes de stockage et d’inventaire.',
    en: 'Export → Labels: tick « QR code » to print it on the right of each label. Scanned with the Atelier, it opens the work — for storage and inventory labels.',
  },
  // 3.1.18 (2026-11-15) — slideshow export (docs/archive/PLAN_SLIDESHOW.md step 2).
  wn_slideshow_export_t: { fr: 'Diaporama : export GIF ou images', en: 'Slideshow: GIF or image export' },
  wn_slideshow_export_d: {
    fr: 'Dans les réglages ⚙ du diaporama, « Exporter » : un GIF animé (une image par œuvre, sans transition, pause réglable, 256 couleurs) ou les mêmes images en couleurs complètes (JPEG ou PNG, numérotées, dans un ZIP avec la liste de l’ordre) pour en faire une vidéo plus tard. Formats 1:1, 4:5, 9:16 Reels, 16:9 ou sur mesure, taille web en option ; l’image entière (fond autour) ou remplissant le cadre (bords coupés). En 9:16, la légende reste hors des bandes d’Instagram. Tout se fait dans le navigateur.',
    en: 'In the slideshow settings ⚙, « Export »: an animated GIF (one frame per work, no transition, adjustable pause, 256 colours) or the same frames in full colour (JPEG or PNG, numbered, in a ZIP with the order list) to make a video later. Sizes 1:1, 4:5, 9:16 Reels, 16:9 or custom, web size optional; the whole picture (background around) or filling the frame (edges cut). In 9:16 the caption stays out of Instagram’s bands. It all runs in the browser.',
  },
  // 3.1.17 (2026-11-15) — slideshow (TODO R5, docs/archive/PLAN_SLIDESHOW.md step 1).
  wn_slideshow_t: { fr: 'Diaporama de la sélection', en: 'Slideshow of the selection' },
  wn_slideshow_d: {
    fr: 'Sélectionnez des œuvres, puis « Diaporama » dans la barre de sélection : chaque œuvre en plein écran, l’image entière (jamais recadrée), sur fond noir, gris ou blanc. ← → ou glisser sur le téléphone, Espace pour lecture / pause, Échap pour fermer. Réglages ⚙ : secondes par image, coupe / fondu / glissé, en boucle, ordre au hasard, légende (titre, année, technique, support, dimensions, numéro ; FR ou EN ; à placer en la glissant ; ombre portée). « Enregistrer » garde le diaporama sous un nom, pour toute l’équipe : Catalogue → Diaporamas pour le relire, le renommer ou le supprimer.',
    en: 'Select works, then « Slideshow » in the selection bar: each work full screen, the whole picture (never cropped), on black, grey or white. ← → or swipe on the phone, Space to play / pause, Esc to close. Settings ⚙: seconds per slide, cut / fade / slide, loop, random order, caption (title, year, technique, support, dimensions, number; FR or EN; dragged into place; cast shadow). « Save » keeps the slideshow under a name, for the whole team: Catalogue → Slideshows to play, rename or delete it.',
  },
  // 3.1.16 (2026-11-14) — Inventory états: Catalogué named, sort by stage, État filter, + filter list A→Z (Pem).
  wn_inventory_states_t: { fr: 'Inventaire : les états, triés et filtrables', en: 'Inventory: states, sorted and filterable' },
  wn_inventory_states_d: {
    fr: 'Le second stade de production s’appelle maintenant « Catalogué » (point jaune) au lieu d’un second « En production ». Trier par État suit l’ordre des stades : En production, Catalogué, Disponible, Réservé, En dépôt, Prêt, Vendu, Don, Archive, Détruite, Perdue. Un menu « État » rejoint les filtres. La liste « + filter » donne un nom à chaque champ, cache les champs techniques et suit l’ordre alphabétique, comme toutes les listes (groupes et périodes aussi).',
    en: 'The second production stage is now called « Catalogued » (yellow dot) instead of a second « In production ». Sorting by State follows the stages: In production, Catalogued, Available, Reserved, Consigned, Loan, Sold, Gift, Archive, Destroyed, Lost. A « State » menu joins the filters. The « + filter » list names every field, hides technical ones and is alphabetical, like every list (groups and periods too).',
  },
  // 3.1.16 (2026-11-14) — Inventory year cell, phone works dated, duplicate fix (Pem).
  wn_inventory_year_in_progress_t: { fr: 'Inventaire : « en cours » au lieu de « — »', en: 'Inventory: « in progress » instead of « — »' },
  wn_inventory_year_in_progress_d: {
    fr: 'Sous les dimensions, une œuvre encore en production et sans année affiche « en cours » (le « — » faisait croire à une date manquante). Les œuvres enregistrées depuis le téléphone avant le 8 novembre ont reçu leur année (2026) et une ligne datée de leur première session de terrain : elles sont dans la période Marseille. Enregistrer une ligne de session ne peut plus créer l’œuvre en double.',
    en: 'Under the size, a work still in production with no year now reads « in progress » (the « — » looked like a missing date). Works recorded from the phone before 8 November got their year (2026) and a line dated their first field session: they sit in the Marseille period. Saving a session line can no longer create the work twice.',
  },
  // 3.1.15 (2026-11-14) — desktop sidebar order (Pem).
  wn_sidebar_catalogue_up_t: { fr: 'Menu de gauche : Catalogue remonte', en: 'Left menu: Catalogue moves up' },
  wn_sidebar_catalogue_up_d: {
    fr: 'Sur ordinateur, le menu de gauche suit maintenant cet ordre : Kaizen, Catalogue (avec l’Inventaire en tête), Terrain (Production, Journal, Notes vocales), Studio, Commercial, Public. Le menu du téléphone ne change pas pour l’instant.',
    en: 'On a computer, the left menu now reads: Kaizen, Catalogue (with Inventory at the top), Field (Production, Journal, Voice notes), Studio, Commercial, Public. The phone menu does not change for now.',
  },
  // 3.1.14 (2026-11-14) — staged session photos shown; production dates partial + end by hand; new / found in WorkForm (TODO 2–4).
  wn_staged_photos_dates_t: { fr: 'Photos en attente et dates de production', en: 'Waiting photos and production dates' },
  wn_staged_photos_dates_d: {
    fr: 'Une photo prise en session qui n’est pas encore sur son œuvre se voit : « en attente » sur la journée du Journal et dans sa ligne de résumé, et sur la fiche de l’œuvre (section Sessions), avec « Ouvrir la session ». Sur la fiche, le début et la fin de production acceptent une année, un mois ou un jour (2021, 06/2024, 22/08/2026) ; la fin peut être corrigée à la main (elle se remplit toujours seule quand l’œuvre est cataloguée). Le formulaire « nouvelle œuvre » demande aussi : nouvelle (commencée aujourd’hui) ou ancienne (retrouvée).',
    en: 'A session photo not yet on its work now shows: « waiting » on the Journal day and its summary line, and on the work card (Sessions section), with « Open the session ». On the card, production start and end take a year, a month or a day (2021, 2024-06, 2026-08-22); the end can be corrected by hand (it still fills itself in when the work is catalogued). The new-work form also asks: new (started today) or older (found).',
  },
  // 3.1.13 (2026-11-14) — Journal on the phone (Pem, opening the Journal on his phone).
  wn_journal_phone_tidy_t: { fr: 'Journal sur téléphone : on reste sur la journée', en: 'Journal on the phone: you stay on the day' },
  wn_journal_phone_tidy_d: {
    fr: 'Le Journal s’ouvre plus vite : il charge sa journée avant le reste de l’Atelier. Depuis le Hub, il s’ouvre directement sur la page du jour, sans passer par la liste. Dans « À revoir » et dans les œuvres du jour, toucher ou garder le doigt sur une vignette montre l’image en grand ; un toucher la ferme, et l’on reste sur le Journal (« Ouvrir » mène toujours à la fiche). Le « + » (nouvelle œuvre) quitte la barre du bas : il reste dans le menu. La fenêtre « Quoi de neuf » ne s’ouvre plus toute seule : la liste est dans Kaizen.',
    en: 'The Journal opens faster: it loads its day before the rest of the Atelier. From the Hub, it opens straight on today’s page, without the list first. In « See again » and in the day’s works, tap or hold a thumbnail to see the picture large; a tap closes it and you stay on the Journal (« Open » still goes to the card). The « + » (new work) left the bottom bar: it stays in the menu. The « What’s new » window no longer opens by itself: the list is in Kaizen.',
  },
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
