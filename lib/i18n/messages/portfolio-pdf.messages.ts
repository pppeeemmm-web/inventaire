import { defineMessages } from '../message-core'

export const portfolioPdfMessages = defineMessages({
  pdf_section_sequence: {
    fr: 'Séquence des images',
    en: 'Image sequence',
  },
  pdf_sequence_collection_all: {
    fr: 'Toutes les sections sauvegardées',
    en: 'All saved sections',
  },
  pdf_sequence_collection_label: {
    fr: 'Collection sauvegardée',
    en: 'Saved collection',
  },
  pdf_profile_save: {
    fr: 'Enregistrer ce profil',
    en: 'Save this profile',
  },
  pdf_profile_reset: {
    fr: 'Réinitialiser',
    en: 'Reset',
  },
  pdf_sequence_help: {
    fr: 'Choisir la collection, puis ajuster l’ordre des images. Les réglages sous chaque image ne modifient que ce PDF.',
    en: 'Choose the collection, then adjust the image order. Per-image settings only affect this PDF.',
  },
  pdf_sequence_loading: {
    fr: 'Chargement des œuvres publiques…',
    en: 'Loading public works…',
  },
  pdf_sequence_empty: {
    fr: 'Aucune œuvre publique avec image.',
    en: 'No public works with images.',
  },
  pdf_sequence_selected_fmt: {
    fr: '{n} œuvre(s) sélectionnée(s)',
    en: '{n} selected work(s)',
  },
  pdf_sequence_excluded_fmt: {
    fr: '{n} exclue(s)',
    en: '{n} excluded',
  },
  pdf_sequence_include: {
    fr: 'Inclure',
    en: 'Include',
  },
  pdf_sequence_exclude: {
    fr: 'Exclure',
    en: 'Exclude',
  },
  pdf_sequence_move_up: {
    fr: 'Monter',
    en: 'Move up',
  },
  pdf_sequence_move_down: {
    fr: 'Descendre',
    en: 'Move down',
  },
  pdf_content_approach: {
    fr: 'Approche',
    en: 'Approach',
  },
  pdf_content_collection_statement: {
    fr: 'Texte de collection',
    en: 'Collection statement',
  },
  pdf_content_cv: {
    fr: 'CV succinct',
    en: 'Succinct CV',
  },
  pdf_content_contact_thanks: {
    fr: 'Contact + remerciements',
    en: 'Contact + thanks',
  },
  pdf_layout_mode_label: {
    fr: 'Mise en page image',
    en: 'Image layout',
  },
  pdf_layout_position_label: {
    fr: 'Position du recadrage',
    en: 'Crop position',
  },
  pdf_layout_help: {
    fr: 'Auto respecte l’orientation. Plein bord remplit toute la page et peut recadrer. Contenu garde l’image entière.',
    en: 'Auto follows orientation. Full bleed fills the page and may crop. Contained keeps the whole image visible.',
  },
  pdf_layout_auto: {
    fr: 'Auto',
    en: 'Auto',
  },
  pdf_layout_bleed: {
    fr: 'Plein bord',
    en: 'Full bleed',
  },
  pdf_layout_contain: {
    fr: 'Contenu',
    en: 'Contained',
  },
  pdf_layout_pos_start: {
    fr: 'Haut',
    en: 'Top',
  },
  pdf_layout_pos_center: {
    fr: 'Centre',
    en: 'Centre',
  },
  pdf_layout_pos_end: {
    fr: 'Bas',
    en: 'Bottom',
  },
  portfolio_collection_drag_reorder: {
    fr: 'Glisser pour réordonner',
    en: 'Drag to reorder',
  },
  portfolio_open_public_site_title: {
    fr: "Ouvrir la page d'accueil (site public)",
    en: 'Open public home page',
  },
  portfolio_tab_intro: {
    fr: "Onglet Portfolio : sections enregistrées dans le JSON (R2). Elles alimentent le PDF téléchargeable (lien sur la page d'accueil et bouton ↓ PDF ci-dessus). Utiliser /works pour l'aperçu du catalogue défilant.",
    en: 'Portfolio tab: sections saved in JSON (R2). They feed the downloadable PDF (home page link and ↓ PDF button above). Use /works for the scrolling catalogue preview.',
  },
  portfolio_sections_title: {
    fr: 'Sections Portfolio',
    en: 'Portfolio sections',
  },
  portfolio_add_section_btn: {
    fr: '+ Ajouter',
    en: '+ Add',
  },
  portfolio_sections_data_hint: {
    fr: "Données de section (titres, textes, thème, ordre des œuvres) — consommées par le PDF (titre · intro · œuvres dans l'ordre choisi).",
    en: 'Section data (titles, copy, theme, work order) — consumed by the PDF (title · intro · works in chosen order).',
  },
  portfolio_sections_empty: {
    fr: 'Aucune section. Cliquer "+ Ajouter".',
    en: 'No sections. Click "+ Add".',
  },
})
