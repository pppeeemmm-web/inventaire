import { defineMessages } from '../message-core'

export const knobsPanelMessages = defineMessages({
  // ── Panel header ──────────────────────────────────────────────────────────
  site_knobs_panel_title: {
    fr: 'Ambiance',
    en: 'Atmosphere',
  },
  site_knobs_scope_site: {
    fr: 'Site',
    en: 'Site',
  },
  site_knobs_reset_family: {
    fr: 'Réinitialiser la famille',
    en: 'Reset family',
  },
  site_knobs_not_rendered_note: {
    fr: 'Schéma réservé — non rendu',
    en: 'Schema reserved — not rendered',
  },

  // ── Family labels ─────────────────────────────────────────────────────────
  site_knobs_family_light: {
    fr: 'Lumière',
    en: 'Light',
  },
  site_knobs_family_shadow: {
    fr: 'Ombres portées',
    en: 'Cast shadows',
  },
  site_knobs_family_frame: {
    fr: 'Cadre & biseau',
    en: 'Frame & bevel',
  },
  site_knobs_family_bg: {
    fr: 'Fond',
    en: 'Background',
  },
  site_knobs_family_mat: {
    fr: 'Texture de surface',
    en: 'Surface texture',
  },
  site_knobs_family_type: {
    fr: 'Typographie',
    en: 'Typography',
  },
  site_knobs_family_atm: {
    fr: 'Atmosphère',
    en: 'Atmosphere',
  },
  site_knobs_family_motion: {
    fr: 'Mouvement',
    en: 'Motion',
  },

  // ── Light ─────────────────────────────────────────────────────────────────
  site_knobs_light_temp: {
    fr: 'Température',
    en: 'Temperature',
  },
  site_knobs_light_dir: {
    fr: 'Direction',
    en: 'Direction',
  },
  site_knobs_light_intensity: {
    fr: 'Intensité',
    en: 'Intensity',
  },

  // ── Shadow ────────────────────────────────────────────────────────────────
  site_knobs_shadow_enabled: {
    fr: 'Activer les ombres',
    en: 'Enable shadows',
  },
  site_knobs_shadow_distance: {
    fr: 'Distance',
    en: 'Distance',
  },
  site_knobs_shadow_blur: {
    fr: 'Diffusion',
    en: 'Blur',
  },
  site_knobs_shadow_opacity: {
    fr: 'Opacité',
    en: 'Opacity',
  },

  // ── Frame ─────────────────────────────────────────────────────────────────
  site_knobs_frame_bevel: {
    fr: 'Biseau',
    en: 'Bevel',
  },
  site_knobs_frame_smooth: {
    fr: 'Lisse',
    en: 'Smooth',
  },
  site_knobs_frame_hard: {
    fr: 'Dur',
    en: 'Hard',
  },

  // ── Background ────────────────────────────────────────────────────────────
  site_knobs_bg_blend_pos: {
    fr: 'Position du fondu',
    en: 'Blend position',
  },
  site_knobs_bg_blend_soft: {
    fr: 'Douceur du fondu',
    en: 'Blend softness',
  },
  site_knobs_bg_opacity: {
    fr: 'Opacité de superposition',
    en: 'Overlay opacity',
  },

  // ── Atmosphere ────────────────────────────────────────────────────────────
  site_knobs_atm_sky_top: {
    fr: 'Couleur ciel (haut)',
    en: 'Sky color (top)',
  },
  site_knobs_atm_sky_bottom: {
    fr: 'Couleur ciel (bas)',
    en: 'Sky color (bottom)',
  },
  site_knobs_atm_tint_opacity: {
    fr: 'Opacité de la teinte',
    en: 'Tint opacity',
  },
  site_knobs_atm_work_glow: {
    fr: 'Halo des œuvres',
    en: 'Work glow',
  },

  // ── Surface texture ───────────────────────────────────────────────────────
  site_knobs_mat_grain: {
    fr: 'Grain',
    en: 'Grain',
  },
  site_knobs_mat_voile: {
    fr: 'Voile',
    en: 'Voile',
  },
  site_knobs_mat_vignette: {
    fr: 'Vignettage',
    en: 'Vignette',
  },

  // ── Typography ────────────────────────────────────────────────────────────
  site_knobs_type_scale: {
    fr: 'Échelle',
    en: 'Scale',
  },
  site_knobs_type_light: {
    fr: 'Léger',
    en: 'Light',
  },
  site_knobs_type_regular: {
    fr: 'Normal',
    en: 'Regular',
  },
  site_knobs_type_bold: {
    fr: 'Gras',
    en: 'Bold',
  },

  // ── Motion ────────────────────────────────────────────────────────────────
  site_knobs_motion_parallax: {
    fr: 'Parallaxe',
    en: 'Parallax',
  },
  site_knobs_motion_sway: {
    fr: 'Oscillation',
    en: 'Sway',
  },
  site_knobs_motion_reduce: {
    fr: 'Réduire les animations',
    en: 'Reduce motion',
  },

  // ── Scope tabs ────────────────────────────────────────────────────────────
  site_knobs_scope_landing: {
    fr: 'Accueil',
    en: 'Landing',
  },
  site_knobs_scope_works: {
    fr: 'Œuvres',
    en: 'Works',
  },
  site_knobs_scope_about: {
    fr: 'À propos',
    en: 'About',
  },
  site_knobs_scope_block: {
    fr: 'Bloc',
    en: 'Block',
  },
  site_knobs_override_on: {
    fr: 'Personnaliser',
    en: 'Customize',
  },
  site_knobs_override_inherited: {
    fr: 'Hérité du site',
    en: 'Inherited from site',
  },

  // ── Circadian ─────────────────────────────────────────────────────────────
  site_knobs_circ_section: {
    fr: 'Circadien',
    en: 'Circadian',
  },
  site_knobs_circ_auto: {
    fr: 'Automatique (horloge du visiteur)',
    en: 'Automatic (visitor clock)',
  },
  site_knobs_circ_manual: {
    fr: 'Heure manuelle',
    en: 'Manual time',
  },
  site_knobs_circ_drives: {
    fr: 'Pilote',
    en: 'Drives',
  },
  site_knobs_circ_drive_light: {
    fr: 'Lumière',
    en: 'Light',
  },
  site_knobs_circ_drive_shadow: {
    fr: 'Ombres',
    en: 'Shadows',
  },
  site_knobs_circ_drive_bg: {
    fr: 'Fond',
    en: 'Background',
  },
  site_knobs_circ_drive_atm: {
    fr: 'Atmosphère',
    en: 'Atmosphere',
  },
  site_knobs_circ_preset_sun: {
    fr: 'Solaire',
    en: 'Sun-tracking',
  },
  site_knobs_circ_preset_gallery: {
    fr: 'Galerie',
    en: 'Gallery',
  },
  site_knobs_circ_preset_theatre: {
    fr: 'Théâtral',
    en: 'Theatrical',
  },
  site_knobs_circ_preset_custom: {
    fr: 'Personnalisé',
    en: 'Custom',
  },
})
