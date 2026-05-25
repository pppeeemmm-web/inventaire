import { defineMessages } from '../message-core'

export const siteBlocksMessages = defineMessages({
  site_block_hero: {
    fr: 'Image d’accueil',
    en: 'Hero image',
  },
  site_block_identity: {
    fr: 'Identité générale',
    en: 'General identity',
  },
  site_block_about: {
    fr: 'Page À propos',
    en: 'About page',
  },
  site_block_practice: {
    fr: 'Page Pratique',
    en: 'Practice page',
  },
  site_block_works_modes: {
    fr: 'Page /works',
    en: '/works page',
  },
  site_block_hidden_badge: {
    fr: 'Masqué',
    en: 'Hidden',
  },
  site_block_toggle_visible: {
    fr: 'Afficher / masquer cette section',
    en: 'Show / hide this section',
  },
  site_block_move_up: {
    fr: 'Déplacer vers le haut',
    en: 'Move up',
  },
  site_block_move_down: {
    fr: 'Déplacer vers le bas',
    en: 'Move down',
  },
  site_mode_move_left: {
    fr: 'Déplacer à gauche',
    en: 'Move left',
  },
  site_mode_move_right: {
    fr: 'Déplacer à droite',
    en: 'Move right',
  },
  site_works_layout_label: {
    fr: 'Présentation',
    en: 'Layout',
  },
  site_works_layout_carousel: {
    fr: 'Carrousel',
    en: 'Carousel',
  },
  site_works_layout_grid: {
    fr: 'Grille',
    en: 'Grid',
  },
  atelier_pub_landing_behavior_help: {
    fr:
      'Accueil public : l’image héros remplit l’écran (clic → /works si la page /works est visible). Légende sous l’image. Les blocs À propos et Pratique ajoutent des liens autour du cercle. Contact reste sous la légende. Masquer un bloc ◻ retire son lien sans modifier le code.',
    en:
      'Public home: hero fills the viewport (click → /works when /works block is visible). Caption under the image. About and Practice blocks add links around the circle. Enquiry stays below the caption. Hiding a block ◻ removes its link without code changes.',
  },
  atelier_pub_hero_url_full_res_hint: {
    fr: 'Utilisez l’URL AVIF pleine résolution (racine R2), pas /thumbs/ (400 px, flou en grand).',
    en: 'Use the full-size AVIF URL (R2 root), not /thumbs/ (400px — soft when enlarged).',
  },
  site_hero_caption_label: {
    fr: 'Légende sous l’image',
    en: 'Caption under image',
  },
  site_landing_bg_label: {
    fr: 'Fond de la page d’accueil',
    en: 'Home page background',
  },
  site_landing_bg_top_label: {
    fr: 'Couleur haut (dégradé)',
    en: 'Top colour (gradient)',
  },
  site_landing_bg_bottom_label: {
    fr: 'Couleur bas (dégradé)',
    en: 'Bottom colour (gradient)',
  },
  site_landing_bg_preview_label: {
    fr: 'Aperçu',
    en: 'Preview',
  },
  site_landing_bg_toggle_show: {
    fr: 'Afficher le dégradé (2–6 stops)',
    en: 'Show gradient (2–6 stops)',
  },
  site_landing_bg_toggle_hide: {
    fr: 'Masquer le dégradé',
    en: 'Hide gradient',
  },
  site_landing_bg_stop_color_label: {
    fr: 'Couleur',
    en: 'Colour',
  },
  site_landing_bg_stop_position_label: {
    fr: 'Position (% depuis le haut)',
    en: 'Position (% from top)',
  },
  site_landing_bg_add_stop: {
    fr: 'Ajouter un stop',
    en: 'Add stop',
  },
  site_landing_bg_remove_stop: {
    fr: 'Retirer',
    en: 'Remove',
  },
  site_landing_bg_stop_heading: {
    fr: 'Stop {n}',
    en: 'Stop {n}',
  },
  site_landing_bg_blend_position_label: {
    fr: 'Position de la transition (% depuis le haut)',
    en: 'Transition position (% from top)',
  },
  site_landing_bg_blend_hardness_label: {
    fr: 'Dureté de la transition (0 = dur, 100 = doux)',
    en: 'Transition hardness (0 = hard, 100 = soft)',
  },
  site_landing_bg_blend_transition_hint: {
    fr: 'Recalcule le dégradé à 4 stops à partir des couleurs du haut et du bas.',
    en: 'Rebuilds a 4-stop gradient from the top and bottom colours.',
  },
  site_hero_gloss_label: {
    fr: 'Éclat de l’image (fusion)',
    en: 'Hero image gloss (blend)',
  },
  site_hero_gloss_help: {
    fr: 'Surcouche sur le disque uniquement — l’ombre portée du disque n’est pas atténuée.',
    en: 'Overlay on the disc only — the disc drop shadow is not faded.',
  },
  site_hero_gloss_blend_label: {
    fr: 'Mode de fusion',
    en: 'Blend mode',
  },
  site_hero_gloss_blend_off: {
    fr: 'Aucun',
    en: 'None',
  },
  site_hero_gloss_blend_color_dodge: {
    fr: 'Fusion couleur (éclat)',
    en: 'Color dodge (pop)',
  },
  site_hero_gloss_blend_soft_light: {
    fr: 'Lumière tamisée',
    en: 'Soft light',
  },
  site_hero_gloss_blend_overlay: {
    fr: 'Superposition',
    en: 'Overlay',
  },
  site_hero_gloss_blend_multiply: {
    fr: 'Produit',
    en: 'Multiply',
  },
  site_hero_gloss_blend_screen: {
    fr: 'Écran',
    en: 'Screen',
  },
  site_hero_gloss_strength_label: {
    fr: 'Intensité de l’éclat (0 = off, 100 = max)',
    en: 'Gloss strength (0 = off, 100 = max)',
  },
  site_hero_gloss_position_label: {
    fr: 'Point blanc (% depuis le haut — plus bas = plus haut sur le disque)',
    en: 'White point (% from top — lower = higher on disc)',
  },
  site_hero_gloss_falloff_label: {
    fr: 'Rayon de l’éclat (plus bas = ombres de l’image préservées)',
    en: 'Gloss radius (lower = preserves image shadows)',
  },
  site_block_works_modes_landing_hint: {
    fr: 'Visible : l’image d’accueil mène vers /works (survol « Œuvres »).',
    en: 'When visible: home hero links to /works (hover shows Works).',
  },
  site_block_page_bg_about: {
    fr: 'Fond — page À propos',
    en: 'Background — About page',
  },
  site_block_page_bg_practice: {
    fr: 'Fond — page Pratique',
    en: 'Background — Practice page',
  },
  site_block_page_bg_works: {
    fr: 'Fond — page /works',
    en: 'Background — /works page',
  },
  site_block_page_bg_inherit_hint: {
    fr: 'Sans réglage personnalisé, cette page reprend le dégradé de l’accueil.',
    en: 'Unless customized, this page uses the home page gradient.',
  },
  site_block_page_bg_reset: {
    fr: 'Reprendre le dégradé de l’accueil',
    en: 'Use home page gradient',
  },
  site_block_works_nav_transparent: {
    fr: 'Navigation transparente (dégradé jusqu’en haut, sans bandeau)',
    en: 'Transparent navigation (gradient to top, no header bar)',
  },
})
