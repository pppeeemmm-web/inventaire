import { defineMessages } from '../message-core'

export const atelierMessages = defineMessages({
  atelier_oeuvres_subset_chip: {
    fr: 'Catalogue partiel · {loaded}/{total}',
    en: 'Partial catalogue · {loaded}/{total}',
  },
  atelier_oeuvres_subset_banner: {
    fr: 'Totaux (vue d’ensemble, thèmes), listes et indicateurs : lot chargé uniquement ({loaded} / {total}). Chargez la suite pour élargir.',
    en: 'Overview, theme totals, lists, and KPIs use the loaded batch only ({loaded} / {total}). Load more to widen.',
  },
  atelier_oeuvres_load_more_short: {
    fr: 'Suite',
    en: 'More',
  },
  atelier_oeuvres_load_more: {
    fr: 'Charger la tranche suivante',
    en: 'Load next batch',
  },
  atelier_subset_batch_toggle_aria: {
    fr: 'Afficher ou masquer le détail du catalogue partiel',
    en: 'Show or hide partial catalogue details',
  },
  research_bar_aria: {
    fr: 'Recherche Atelier',
    en: 'Atelier search',
  },
  research_pill_label: {
    fr: 'Recherche',
    en: 'Search',
  },
  research_placeholder: {
    fr: 'Chercher œuvres, contacts, projets, notes...',
    en: 'Search works, contacts, projects, notes...',
  },
  research_close: {
    fr: 'Fermer la recherche',
    en: 'Close search',
  },
  atelier_quick_search_shortcut: {
    fr: 'Recherche (Ctrl+K)',
    en: 'Search (Ctrl+K)',
  },
  atelier_quick_studio_bible: {
    fr: 'Bible Atelier',
    en: 'Studio Bible',
  },
  cmd_palette_action_capture_session: {
    fr: 'Capturer une session',
    en: 'Capture session',
  },
  cmd_palette_action_scan_qr: {
    fr: 'Scanner QR',
    en: 'Scan QR',
  },
  cmd_palette_action_field_note: {
    fr: 'Note terrain',
    en: 'Field note',
  },
  cmd_palette_action_reminders: {
    fr: 'Voir les rappels',
    en: 'Review reminders',
  },
  cmd_palette_action_new_sale: {
    fr: 'Nouvelle commande',
    en: 'New sale / order',
  },
  cmd_palette_action_stock_take: {
    fr: 'Inventaire terrain',
    en: 'Start stock take',
  },
  cmd_palette_action_pending_approvals: {
    fr: 'Validations en attente',
    en: 'Pending approvals',
  },
  research_loading: {
    fr: 'Recherche...',
    en: 'Searching...',
  },
  catalogue_loading: {
    fr: 'Chargement du catalogue...',
    en: 'Loading catalogue...',
  },
  rich_toolbar_bullet_list: {
    fr: 'Liste à puces',
    en: 'Bullet list',
  },
  rich_toolbar_ordered_list: {
    fr: 'Liste numérotée',
    en: 'Numbered list',
  },
  rich_toolbar_align_left: {
    fr: 'Aligner à gauche',
    en: 'Align left',
  },
  rich_toolbar_clear_formatting: {
    fr: 'Effacer le formatage',
    en: 'Clear formatting',
  },
  themes_prompt_rename_theme: {
    fr: 'Nouveau nom du thème :',
    en: 'New theme name:',
  },
  themes_prompt_rename_group: {
    fr: 'Nouveau nom du groupe de travail :',
    en: 'New working group name:',
  },
  work_thumb_add_image: {
    fr: 'Ajouter une image',
    en: 'Add image',
  },
  wf_images_download_original: {
    fr: 'Télécharger',
    en: 'Download',
  },
  wf_images_replace_retouched: {
    fr: 'Remplacer retouchée',
    en: 'Replace retouched',
  },
  wf_images_retouch_uploaded: {
    fr: 'Image retouchée mise à jour.',
    en: 'Retouched image updated.',
  },
  research_remote_error: {
    fr: 'Recherche distante indisponible.',
    en: 'Remote search unavailable.',
  },
  session_new_intro: {
    fr: 'Journal de session : ajoutez une entrée par peinture touchée, liez une œuvre existante ou notez une nouvelle œuvre, puis ajoutez les photos et les suivis.',
    en: 'Session journal: add one entry for each painting touched, link an existing work or mark a new work, then add photos and follow-up notes.',
  },
  session_date_label: {
    fr: 'Date de la session',
    en: 'Session date',
  },
  session_date_hint: {
    fr: 'Changez cette date pour rattraper une session faite hier ou un autre jour.',
    en: 'Change this date when catching up a session from yesterday or another day.',
  },
  session_journal_items_heading: {
    fr: 'Peintures dans cette session',
    en: 'Paintings in this session',
  },
  session_journal_items_count: {
    fr: 'entrées',
    en: 'entries',
  },
  session_add_painting: {
    fr: 'Ajouter peinture',
    en: 'Add painting',
  },
  session_painting_label: {
    fr: 'Peinture',
    en: 'Painting',
  },
  session_work_search_label: {
    fr: 'Chercher une œuvre',
    en: 'Search for a work',
  },
  session_work_search_placeholder: {
    fr: 'Titre, ID, dimensions...',
    en: 'Title, ID, dimensions...',
  },
  session_item_notes_label: {
    fr: 'Notes pour cette peinture',
    en: 'Notes for this painting',
  },
  tab_journal: {
    fr: 'Journal',
    en: 'Journal',
  },
  journal_tab_title: {
    fr: 'Journal de session',
    en: 'Session journal',
  },
  journal_tab_intro: {
    fr: 'Sessions datées, peintures touchées, photos et comparaison avant / après.',
    en: 'Dated sessions, paintings touched, photos, and before / after comparison.',
  },
  journal_empty: {
    fr: 'Aucune session enregistrée.',
    en: 'No sessions recorded.',
  },
  journal_session_date: {
    fr: 'Date de session',
    en: 'Session date',
  },
  journal_session_edit: {
    fr: 'Modifier la session',
    en: 'Edit session',
  },
  journal_session_delete: {
    fr: 'Supprimer la session',
    en: 'Delete session',
  },
  journal_session_delete_confirm: {
    fr: 'Supprimer cette session ? Les photos déjà appliquées aux œuvres sont conservées.',
    en: 'Delete this session? Photos already applied to works are kept.',
  },
  journal_no_items: {
    fr: 'Aucune peinture détaillée dans cette session.',
    en: 'No detailed painting entries in this session.',
  },
  journal_compare_cta: {
    fr: 'Comparer avant / après',
    en: 'Compare before / after',
  },
  journal_compare_before: {
    fr: 'Avant',
    en: 'Before',
  },
  journal_compare_after: {
    fr: 'Après',
    en: 'After',
  },
  journal_compare_current: {
    fr: 'État actuel',
    en: 'Current state',
  },
  journal_compare_empty: {
    fr: 'Aucune différence enregistrée autour de cette session.',
    en: 'No recorded difference around this session.',
  },
  journal_item_delete_confirm: {
    fr: 'Supprimer cette entrée du journal ? Les photos déjà appliquées aux œuvres sont conservées.',
    en: 'Delete this journal entry? Photos already applied to works are kept.',
  },
  research_group_actions: {
    fr: 'Actions',
    en: 'Actions',
  },
  research_group_tabs: {
    fr: 'Onglets',
    en: 'Tabs',
  },
  research_group_works: {
    fr: 'Œuvres',
    en: 'Works',
  },
  research_group_contacts: {
    fr: 'Contacts',
    en: 'Contacts',
  },
  research_group_exhibitions: {
    fr: 'Expositions',
    en: 'Exhibitions',
  },
  research_group_processes: {
    fr: 'Processus',
    en: 'Processes',
  },
  research_group_notes: {
    fr: 'Notes vocales',
    en: 'Voice notes',
  },
  research_quick_reports: {
    fr: 'Rapports',
    en: 'Reports',
  },
  research_quick_reports_selection: {
    fr: 'Rapports ({n})',
    en: 'Reports ({n})',
  },
  research_quick_reports_detail: {
    fr: 'Ouvrir les exports et tableaux',
    en: 'Open exports and tables',
  },
  research_quick_notes: {
    fr: 'Notes',
    en: 'Notes',
  },
  research_quick_notes_detail: {
    fr: 'Ouvrir les notes vocales',
    en: 'Open voice notes',
  },
  research_quick_contacts: {
    fr: 'Contacts',
    en: 'Contacts',
  },
  research_quick_contacts_detail: {
    fr: 'Ouvrir le répertoire',
    en: 'Open the directory',
  },
  research_detail_tab: {
    fr: 'Onglet Atelier',
    en: 'Atelier tab',
  },
  research_detail_work: {
    fr: 'Œuvre #{id}',
    en: 'Work #{id}',
  },
  research_detail_contact: {
    fr: 'Contact #{id}',
    en: 'Contact #{id}',
  },
  research_detail_process: {
    fr: 'Processus Atelier',
    en: 'Atelier process',
  },
  research_detail_note: {
    fr: 'Note vocale',
    en: 'Voice note',
  },
  issue_field_work_label: {
    fr: 'Œuvre liée',
    en: 'Linked work',
  },
  issue_field_work_none: {
    fr: 'Aucune œuvre liée',
    en: 'No linked work',
  },
  issue_field_action_type_label: {
    fr: 'Étape production',
    en: 'Production step',
  },
  issue_field_action_type_none: {
    fr: 'Aucune étape',
    en: 'No step',
  },
  issue_field_link_hint: {
    fr: 'Si une œuvre et une étape sont choisies, le signalement apparaîtra dans Production.',
    en: 'If a work and step are selected, the issue will appear in Production.',
  },
  material_overview_title: {
    fr: 'Vue matière',
    en: 'Material overview',
  },
  material_overview_subtitle: {
    fr: 'Signalements terrain ouverts : interventions, anomalies et points à trier côté matériel.',
    en: 'Open field reports: material interventions, issues, and items still needing triage.',
  },
  material_overview_stats: {
    fr: '{open} ouverts · {high} hauts · {unlinked} à trier',
    en: '{open} open · {high} high · {unlinked} to triage',
  },
  material_overview_empty: {
    fr: 'Aucun signalement matériel ouvert.',
    en: 'No open material reports.',
  },
  material_overview_linked: {
    fr: '{work} · {step}',
    en: '{work} · {step}',
  },
  material_overview_work_only: {
    fr: 'Œuvre #{id} · étape à choisir',
    en: 'Work #{id} · choose a step',
  },
  material_overview_needs_triage: {
    fr: 'À trier : lier à une œuvre ou traiter comme tâche atelier.',
    en: 'Needs triage: link to a work or handle as a studio task.',
  },
  material_overview_linked_count: {
    fr: '{n} signalement(s) alimentent aussi Production.',
    en: '{n} report(s) also feed Production.',
  },
  material_overview_open_work: {
    fr: 'Ouvrir',
    en: 'Open',
  },
  voice_next_action_label: {
    fr: 'Prochaine action',
    en: 'Next action',
  },
  voice_next_action_today: {
    fr: "Aujourd'hui",
    en: 'Today',
  },
  voice_next_action_tomorrow: {
    fr: 'Demain',
    en: 'Tomorrow',
  },
  voice_next_action_week: {
    fr: 'Cette semaine',
    en: 'This week',
  },
  voice_next_action_waiting: {
    fr: 'En attente',
    en: 'Waiting',
  },
  voice_next_action_none: {
    fr: 'Pas de suivi',
    en: 'No follow-up',
  },
  voice_offline_banner: {
    fr: 'Hors ligne : la note texte reste en brouillon local et pourra être enregistrée au retour du réseau.',
    en: 'Offline: the text note stays as a local draft and can be saved when the network returns.',
  },
  voice_offline_draft_saved: {
    fr: 'Brouillon local conservé.',
    en: 'Local draft kept.',
  },
  voice_follow_up_save_failed: {
    fr: 'Note enregistrée, mais le suivi n’a pas pu être créé.',
    en: 'Note saved, but the follow-up could not be created.',
  },
})
