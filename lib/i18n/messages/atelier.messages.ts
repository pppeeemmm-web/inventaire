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
    fr: 'Télécharger la Bible Atelier',
    en: 'Download Studio Bible',
  },
  studio_bible_download_not_found: {
    fr: 'Aucun document Bible Atelier (type bible) dans le coffre.',
    en: 'No Studio Bible document (kind bible) in the vault.',
  },
  cmd_palette_action_download_studio_bible: {
    fr: 'Télécharger la Bible Atelier',
    en: 'Download Studio Bible',
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
  themes_collections_count_fmt: {
    fr: '{count} collections',
    en: '{count} collections',
  },
  themes_active_groups_count_fmt: {
    fr: '{count} groupes actifs',
    en: '{count} active groups',
  },
  themes_works_displayed_fmt: {
    fr: '{count} œuvres affichées',
    en: '{count} works displayed',
  },
  themes_mosaic_hover_hint: {
    fr: 'Survoler un thème ou un groupe pour prévisualiser',
    en: 'Hover a theme or group to preview',
  },
  themes_row_context_menu_title: {
    fr: 'Clic droit : renommer · Ctrl+clic droit : supprimer',
    en: 'Right-click: rename · Ctrl+right-click: delete',
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
    fr: 'Une session par jour (date ci-dessous). Ajoutez une peinture par œuvre touchée, puis les photos.',
    en: 'One session per day (date below). Add a painting entry per work, then photos.',
  },
  session_date_label: {
    fr: 'Date de la session',
    en: 'Session date',
  },
  session_date_hint: {
    fr: 'Une session par date — changez la date pour une autre journée.',
    en: 'One session per date — change the date to switch days.',
  },
  session_dev_profile_notice: {
    fr: 'Profil dev LAN ({email}) : les sessions terrain sont liées à chaque compte. Pour revoir vos vraies captures (ex. 20/05), mettez votre e-mail PEM dans DEV_AUTO_LOGIN_EMAIL ou ouvrez le jour depuis le Journal.',
    en: 'LAN dev profile ({email}): field sessions belong to each login. To see your real captures (e.g. 20 May), set your PEM email in DEV_AUTO_LOGIN_EMAIL or open the day from the Journal.',
  },
  session_flow_steps: {
    fr: 'Date → Œuvre → Photos → Appliquer sur la fiche',
    en: 'Date → Work → Photos → Apply to catalogue',
  },
  session_back_journal: {
    fr: '← Journal des dates',
    en: '← Date journal',
  },
  session_photo_uploading: {
    fr: 'Envoi des photos…',
    en: 'Uploading photos…',
  },
  journal_capture_today: {
    fr: 'Capturer aujourd’hui',
    en: 'Capture today',
  },
  journal_open_day_capture: {
    fr: 'Ouvre la capture pour cette date',
    en: 'Opens capture for this date',
  },
  journal_team_readonly_intro: {
    fr: 'Toute l’équipe peut consulter le journal. Seuls les administrateurs peuvent capturer ou modifier une session.',
    en: 'The whole team can read the journal. Only administrators can capture or edit a session.',
  },
  session_readonly_notice: {
    fr: 'Consultation seule — la capture terrain est réservée aux administrateurs.',
    en: 'Read-only — field capture is limited to administrators.',
  },
  session_capture_admin_only: {
    fr: 'La capture terrain est réservée aux administrateurs. Ouvrez une journée depuis le journal pour la consulter.',
    en: 'Field capture is for administrators only. Open a day from the journal to view it.',
  },
  journal_view_session_day: {
    fr: 'Voir cette journée',
    en: 'View this day',
  },
  journal_inventory_link_aria: {
    fr: 'Ouvrir l’œuvre #{id} dans l’inventaire',
    en: 'Open work #{id} in inventory',
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
  session_no_painting_yet: {
    fr: 'Aucune peinture pour l’instant — touchez « Ajouter peinture » pour commencer.',
    en: 'No paintings yet — tap Add painting to start.',
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
    fr: 'Journal de terrain',
    en: 'Field journal',
  },
  journal_tab_intro: {
    fr: 'Chronique de vos journées sur le terrain — une session par date ; les doublons du même jour sont fusionnés automatiquement.',
    en: 'A chronicle of your field days — one session per date; duplicate rows for the same day are merged automatically.',
  },
  journal_new_day: {
    fr: 'Ouvrir la journée',
    en: 'Open today',
  },
  journal_continue_capture: {
    fr: 'Compléter cette journée',
    en: 'Continue this day',
  },
  journal_empty: {
    fr: 'Aucune journée enregistrée pour l’instant.',
    en: 'No field days recorded yet.',
  },
  journal_empty_cta: {
    fr: 'Commencer une journée',
    en: 'Start a field day',
  },
  journal_pick_day: {
    fr: 'Choisissez une date dans la liste.',
    en: 'Choose a date from the list.',
  },
  journal_back_to_days: {
    fr: 'Toutes les dates',
    en: 'All dates',
  },
  journal_paintings_heading: {
    fr: 'Peintures touchées',
    en: 'Paintings touched',
  },
  journal_field_context_lede: {
    fr: 'Conditions du terrain',
    en: 'Field conditions',
  },
  journal_day_one_work: {
    fr: '1 peinture',
    en: '1 painting',
  },
  journal_day_works: {
    fr: '{n} peintures',
    en: '{n} paintings',
  },
  journal_day_one_photo: {
    fr: '1 photo',
    en: '1 photo',
  },
  journal_day_photos: {
    fr: '{n} photos',
    en: '{n} photos',
  },
  journal_day_empty_summary: {
    fr: 'Journée ouverte',
    en: 'Day opened',
  },
  journal_show_details: {
    fr: 'Détails',
    en: 'Details',
  },
  journal_hide_details: {
    fr: 'Masquer les détails',
    en: 'Hide details',
  },
  journal_manage: {
    fr: 'Gestion',
    en: 'Manage',
  },
  journal_hide_manage: {
    fr: 'Masquer la gestion',
    en: 'Hide manage',
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
    fr: 'Supprimer toute la journée de capture ? Les photos déjà appliquées aux œuvres sont conservées.',
    en: 'Delete the entire capture day? Photos already applied to works are kept.',
  },
  journal_select_all: {
    fr: 'Tout sélectionner',
    en: 'Select all',
  },
  journal_clear_selection: {
    fr: 'Effacer la sélection',
    en: 'Clear selection',
  },
  journal_delete_selected: {
    fr: 'Supprimer la sélection ({n})',
    en: 'Delete selected ({n})',
  },
  journal_delete_selected_confirm: {
    fr: 'Supprimer {n} journée(s) de capture ? Les photos déjà appliquées aux œuvres sont conservées.',
    en: 'Delete {n} capture day(s)? Photos already applied to works are kept.',
  },
  journal_delete_failed: {
    fr: 'Suppression impossible — vérifiez vos droits ou réessayez.',
    en: 'Could not delete — check your permissions or try again.',
  },
  journal_bulk_deleted_toast: {
    fr: '{n} session(s) supprimée(s).',
    en: '{n} session(s) deleted.',
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
  pwa_offline_title: {
    fr: 'Hors ligne',
    en: 'Offline',
  },
  pwa_offline_body: {
    fr: 'Cette page n’est pas en cache. Reconnectez-vous pour continuer, ou ouvrez le Hub si vous l’avez déjà visité.',
    en: 'This page is not cached. Reconnect to continue, or open the Hub if you have visited it before.',
  },
  pwa_offline_hub: {
    fr: 'Retour au Hub',
    en: 'Back to Hub',
  },
  atelier_error_title: {
    fr: 'Erreur Atelier',
    en: 'Atelier error',
  },
  atelier_error_chunk_body: {
    fr: 'Une mise à jour de l’application est disponible. La page va se recharger pour récupérer les nouveaux fichiers.',
    en: 'The app was updated. This page will reload to fetch the latest files.',
  },
  atelier_error_generic_body: {
    fr: 'La page n’a pas pu être générée. Vérifiez la console du serveur (terminal Next) pour le détail.',
    en: 'This page could not be rendered. Check the server console (Next terminal) for details.',
  },
  atelier_error_retry: {
    fr: 'Réessayer',
    en: 'Retry',
  },
  atelier_error_reload: {
    fr: 'Recharger la page',
    en: 'Reload page',
  },
})
