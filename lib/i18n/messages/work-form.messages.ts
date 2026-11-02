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
    fr: 'Couleurs principales de cette photo, proportionnelles à leur surface (survol : code couleur et %)',
    en: 'Main colours of this photo, sized by how much of it they cover (hover: colour code and %)',
  },
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
  wf_production_origin_found: {
    fr: 'œuvre retrouvée',
    en: 'found work',
  },
})
