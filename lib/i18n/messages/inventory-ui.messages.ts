import { defineMessages } from '../message-core'

export const inventoryUiMessages = defineMessages({
  inv_col_location: {
    fr: 'Emplacement',
    en: 'Location',
  },
  inv_rows_shown_fmt: {
    fr: '{count} œuvres affichées',
    en: '{count} works shown',
  },
  inv_title_select_all_shown: {
    fr: 'Sélectionner tous les résultats affichés',
    en: 'Select all shown results',
  },
  inv_title_color_legend: {
    fr: 'Légende des couleurs',
    en: 'Color legend',
  },
  inv_title_toggle_side_preview: {
    fr: "Afficher/masquer l'aperçu latéral",
    en: 'Show/hide side preview',
  },
  inv_title_contact_hidden: {
    fr: 'Contact masqué',
    en: 'Contact hidden',
  },
  inv_col_status: {
    fr: 'État',
    en: 'Status',
  },
  inv_col_broadcast: {
    fr: 'Diffusion',
    en: 'Broadcast',
  },
  inv_title_status_col: {
    fr: 'État commercial (disponible, production, réservé, vendu…)',
    en: 'Commercial status (available, production, reserved, sold…)',
  },
  inv_title_broadcast_col: {
    fr: 'Cochée = œuvre prête à diffuser (réseaux, newsletter — onglet Diffusion). Cliquez pour trier.',
    en: 'Ticked = work ready to broadcast (social, newsletter — Broadcast tab). Click to sort.',
  },
  inv_preview: {
    fr: 'Aperçu',
    en: 'Preview',
  },
  inv_legend_empty: {
    fr: 'Aucune œuvre en production',
    en: 'No works in production',
  },
  inv_masked: {
    fr: '[Masqué]',
    en: '[Hidden]',
  },
  inv_title_private: {
    fr: 'Privé (Confidentiel)',
    en: 'Private (Confidential)',
  },
  inv_field_date_creation: {
    fr: 'Date création',
    en: 'Creation date',
  },
  inv_field_prix_final: {
    fr: 'Prix final',
    en: 'Final price',
  },
  inv_field_exposable: {
    fr: 'Exposable',
    en: 'Exhibitable',
  },
  inv_field_catalogued: {
    fr: 'Cataloguée',
    en: 'Catalogued',
  },
  inv_field_height: {
    fr: 'Hauteur (cm)',
    en: 'Height (cm)',
  },
  inv_field_width: {
    fr: 'Largeur (cm)',
    en: 'Width (cm)',
  },
  inv_field_depth: {
    fr: 'Profondeur (cm)',
    en: 'Depth (cm)',
  },
  inv_field_needs_photo: {
    fr: 'À photographier',
    en: 'To photograph',
  },
  inv_field_return_date: {
    fr: 'Date retour',
    en: 'Return date',
  },
  inv_field_has_image: {
    fr: 'Photo (couverture)',
    en: 'Photo (cover)',
  },
  inv_colour_btn: { fr: 'Couleurs', en: 'Colours' },
  inv_colour_btn_active_fmt: { fr: '✓ Couleurs ({n})', en: '✓ Colours ({n})' },
  inv_colour_mode_aria: { fr: 'Avec ou sans ces couleurs', en: 'With or without these colours' },
  inv_colour_mode_include: { fr: 'Avec', en: 'With' },
  inv_colour_mode_exclude: { fr: 'Sans', en: 'Without' },
  inv_colour_nearby: { fr: 'Teintes voisines', en: 'Nearby shades' },
  inv_colour_nearby_title: {
    fr: 'Compte aussi les familles voisines sur le cercle (orange → rouge-orangé, jaune-orangé, brun), pour les couleurs à la frontière comme la rouille. Pour « Monochromes d’abord » : décoché = une seule famille, coché = une famille et ses voisines.',
    en: 'Also counts the neighbouring families on the wheel (orange → red-orange, yellow-orange, brown), for boundary colours such as rust. For "Monochrome first": off = a single family, on = a family and its neighbours.',
  },
  inv_colour_rank_label: { fr: 'Trier', en: 'Sort' },
  inv_colour_rank_match: { fr: 'Couleurs les plus présentes d’abord', en: 'Most colour coverage first' },
  inv_colour_rank_mono: { fr: 'Monochromes d’abord', en: 'Monochrome first' },
  inv_colour_rank_off: { fr: 'Par colonne', en: 'By column' },
  inv_colour_loading: { fr: 'Chargement des palettes…', en: 'Loading palettes…' },
  inv_colour_hint: {
    fr: 'Image principale ; une couleur compte à partir de 3 % de l’image. Jusqu’à 5 couleurs.',
    en: 'Main image; a colour counts from 3% of the picture. Up to 5 colours.',
  },
  inv_colour_count_fmt: { fr: '{n} œuvres dans le catalogue', en: '{n} works in the catalogue' },
  inv_colour_clear: { fr: 'Effacer les couleurs', en: 'Clear colours' },
  inv_colour_chip_without_fmt: { fr: 'Sans {c}', en: 'Without {c}' },
  wf_palette_swatch_filter_fmt: {
    fr: '{c} — voir les œuvres de cette couleur',
    en: '{c} — show works with this colour',
  },
})
