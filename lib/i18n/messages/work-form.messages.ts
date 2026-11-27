import { defineMessages } from '../message-core'

export const workFormMessages = defineMessages({
  wf_qr_section_title: {
    fr: 'Étiquette physique',
    en: 'Physical label',
  },
  wf_qr_hint: {
    fr: 'Scannez pour ouvrir cette œuvre dans l’atelier (appareil photo ou /atelier/scan).',
    en: 'Scan to open this work in the studio (camera or /atelier/scan).',
  },
  wf_qr_copy_link: {
    fr: 'Copier le lien',
    en: 'Copy link',
  },
  wf_qr_print_label: {
    fr: 'Imprimer',
    en: 'Print',
  },
  wf_qr_copied: {
    fr: 'Lien copié',
    en: 'Link copied',
  },
  wf_qr_load_failed: {
    fr: 'QR indisponible',
    en: 'QR unavailable',
  },
  wf_location_address_label: {
    fr: 'Adresse du détenteur',
    en: 'Holder address',
  },
  wf_location_address_any: {
    fr: 'Adresse non précisée',
    en: 'Address not specified',
  },
  wf_production_label: {
    fr: 'Production',
    en: 'Production',
  },
  wf_palette_title: {
    fr: 'Couleurs de cette photo par famille du cercle chromatique, proportionnelles à leur surface ; « accent » = petite touche vive (survol : code couleur)',
    en: 'Colours of this photo by colour-wheel family, sized by how much of it they cover; "accent" = a small vivid touch (hover: colour code)',
  },
  wf_palette_accent: { fr: '· accent', en: '· accent' },
  wf_palette_label: {
    fr: 'Palette',
    en: 'Palette',
  },
  colour_family_red: { fr: 'Rouge', en: 'Red' },
  colour_family_red_orange: { fr: 'Rouge-orangé', en: 'Red-orange' },
  colour_family_orange: { fr: 'Orange', en: 'Orange' },
  colour_family_yellow_orange: { fr: 'Jaune-orangé', en: 'Yellow-orange' },
  colour_family_yellow: { fr: 'Jaune', en: 'Yellow' },
  colour_family_yellow_green: { fr: 'Jaune-vert', en: 'Yellow-green' },
  colour_family_green: { fr: 'Vert', en: 'Green' },
  colour_family_blue_green: { fr: 'Bleu-vert', en: 'Blue-green' },
  colour_family_blue: { fr: 'Bleu', en: 'Blue' },
  colour_family_blue_violet: { fr: 'Bleu-violet', en: 'Blue-violet' },
  colour_family_violet: { fr: 'Violet', en: 'Violet' },
  colour_family_red_violet: { fr: 'Rouge-violet', en: 'Red-violet' },
  colour_family_brown: { fr: 'Brun', en: 'Brown' },
  colour_family_black: { fr: 'Noir', en: 'Black' },
  colour_family_grey: { fr: 'Gris', en: 'Grey' },
  colour_family_white: { fr: 'Blanc', en: 'White' },
  wf_production_span_fmt: {
    fr: '{start} → {end} · {days} j',
    en: '{start} → {end} · {days} d',
  },
  wf_production_open_fmt: {
    fr: 'En cours depuis le {start} · {days} j',
    en: 'In progress since {start} · {days} d',
  },
  wf_production_end_only_fmt: {
    fr: 'Début inconnu → {end}',
    en: 'Start unknown → {end}',
  },
  wf_production_unknown_open: {
    fr: 'En cours · début inconnu',
    en: 'In progress · start unknown',
  },
  wf_production_start_label: {
    fr: 'Début de production',
    en: 'Production started',
  },
  wf_production_start_hint: {
    fr: 'Année, mois ou jour : 2021, 06/2024, 22/08/2026. La fin se remplit seule quand l’œuvre devient Prête (cataloguée, photo validée) — pas pour une œuvre retrouvée, qui garde son année ; on peut aussi la corriger ici.',
    en: 'Year, month or day: 2021, 2024-06, 2026-08-22. The end fills itself in when the work becomes Ready (catalogued, photo validated) — not for a found work, which keeps its year; it can also be corrected here.',
  },
  wf_origin_hint: {
    fr: 'Nouvelle : la production démarre aujourd’hui. Ancienne : début inconnu. Sans choix : nouvelle, commencée aujourd’hui — sauf si l’année saisie est antérieure (œuvre ancienne).',
    en: 'New: production starts today. Older: start unknown. No choice: new, started today — unless the year typed is earlier (an old work).',
  },
  wf_production_end_label: { fr: 'Fin de production', en: 'Production ended' },
  wf_production_end_saved: { fr: 'Date de fin enregistrée', en: 'End date saved' },
  wf_production_date_ph: { fr: '2021, 06/2024, 22/08/2026', en: '2021, 2024-06, 2026-08-22' },
  wf_production_span_nodays_fmt: { fr: '{start} → {end}', en: '{start} → {end}' },
  wf_production_open_nodays_fmt: { fr: 'En cours depuis {start}', en: 'In progress since {start}' },
  wf_production_start_save: { fr: 'Enregistrer', en: 'Save' },
  wf_production_start_saved: { fr: 'Date de début enregistrée', en: 'Start date saved' },
  wf_production_start_after_end: {
    fr: 'Le début ne peut pas être après la fin de production.',
    en: 'The start cannot be after the end of production.',
  },
  wf_production_start_invalid: { fr: 'Date invalide : 2021, 06/2024 ou 22/08/2026.', en: 'Invalid date: 2021, 2024-06 or 2026-08-22.' },
  wf_production_origin_found: {
    fr: 'œuvre retrouvée',
    en: 'found work',
  },
  wf_origin_new: { fr: 'Nouvelle', en: 'New' },
  wf_origin_found: { fr: 'Ancienne — retrouvée', en: 'Older — found' },
  wf_origin_saved: { fr: 'Origine enregistrée', en: 'Origin saved' },
  wf_origin_saved_on_tap: { fr: 'Enregistré dès le choix — pas besoin d’Enregistrer.', en: 'Saved as soon as chosen — no need to Save.' },
  wf_field_all_fields: {
    fr: 'Tous les champs ▾',
    en: 'All fields ▾',
  },
  wf_field_capture_only: { fr: 'Terrain seulement ▴', en: 'Field fields only ▴' },
  wf_themes_edit: { fr: 'Modifier les thèmes', en: 'Edit themes' },
  wf_themes_done: { fr: 'OK', en: 'Done' },
  wf_open_contact: { fr: 'Ouvrir la fiche contact', en: 'Open contact card' },
  wf_more_actions: { fr: 'Autres actions', en: 'More actions' },
  wf_field_all_fields_hint: {
    fr: 'Statut, propriété, prix, constats, groupes, séances…',
    en: 'Status, ownership, price, condition, groups, sessions…',
  },
  wf_short_form: { fr: '← Formulaire court', en: '← Short form' },
  wf_short_form_kept: {
    fr: 'Thèmes, commentaires et historique restent dans « Tous les champs » : ils ne s’enregistrent que depuis là.',
    en: 'Themes, comments and history stay in « All fields »: they are only saved from there.',
  },
  wf_themes_more: { fr: '+ {n} autres', en: '+ {n} more' },
})
