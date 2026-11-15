import { defineMessages } from '../message-core'

export const exhibitionsUiMessages = defineMessages({
  exh_layout_none: {
    fr: 'Aucune mise en espace.',
    en: 'No floor plan layout yet.',
  },
  exh_layout_none_for_exhibition: {
    fr: 'Aucune mise en espace pour cette exposition.',
    en: 'No layout for this exhibition.',
  },
  exh_layout_create_hint: {
    fr: 'Créez-en une dans le panneau de gauche pour commencer à placer des œuvres.',
    en: 'Create one in the left panel to start placing works.',
  },
  exh_placements_heading: {
    fr: 'Placements',
    en: 'Placements',
  },
  exh_delete_exhibition: {
    fr: "Supprimer l'exposition",
    en: 'Delete exhibition',
  },
  exh_no_steps_defined: {
    fr: 'Aucune étape définie.',
    en: 'No steps defined.',
  },
  exh_new_name_placeholder: {
    fr: "Nom de l'exposition…",
    en: 'Exhibition name…',
  },
  exh_calendar_start_label: {
    fr: "Début de l'exposition",
    en: 'Exhibition start',
  },
  exh_calendar_end_label: {
    fr: "Fin de l'exposition",
    en: 'Exhibition end',
  },
  exh_select_or_create: {
    fr: 'Sélectionnez ou créez une exposition.',
    en: 'Select or create an exhibition.',
  },
  exh_candidate_works: {
    fr: 'Œuvres candidates',
    en: 'Candidate works',
  },
  exh_step_status_done: {
    fr: '✓ Terminée',
    en: '✓ Done',
  },
  exh_step_status_in_progress: {
    fr: '→ En cours',
    en: '→ In progress',
  },
  exh_step_status_todo: {
    fr: 'À faire',
    en: 'To do',
  },
  exh_step_deadline_label: {
    fr: 'Échéance :',
    en: 'Due:',
  },
  exh_create_layout_aria: {
    fr: 'Créer une mise en espace',
    en: 'Create floor plan layout',
  },
  exh_remove_placement_aria: {
    fr: 'Retirer le placement',
    en: 'Remove placement',
  },
  exh_remove_wall_aria: {
    fr: 'Supprimer le mur',
    en: 'Remove wall',
  },

  // Floor plan (TODO B4, 2026-11-15) — groups = collections of works for an event (not themes).
  exh_fp_group_label: { fr: 'Groupe', en: 'Group' },
  exh_fp_group_exposable: { fr: 'Œuvres exposables', en: 'Exhibitable works' },
  exh_fp_group_loaded_fmt: { fr: '{loaded} / {total} chargées', en: '{loaded} / {total} loaded' },
  exh_fp_place_all_fmt: { fr: 'Tout placer ({n})', en: 'Place all ({n})' },
  exh_fp_tab_plan: { fr: 'Placement spatial', en: 'Floor plan' },
  exh_fp_tab_settings: { fr: 'Paramètres', en: 'Settings' },
  exh_fp_saving: { fr: 'Enregistrement…', en: 'Saving…' },
  exh_fp_save: { fr: 'Enregistrer', en: 'Save' },
  exh_fp_uploading: { fr: 'Envoi du plan…', en: 'Uploading plan…' },
  exh_fp_change_plan: { fr: 'Changer le plan', en: 'Change plan' },
  exh_fp_upload_plan: { fr: 'Ajouter un plan', en: 'Upload a plan' },
  exh_fp_drag_hint: {
    fr: 'Glissez les œuvres sur le plan · double-clic : ouvrir la fiche',
    en: 'Drag works onto the plan · double-click: open the work card',
  },
  exh_fp_plan_opacity: { fr: 'Opacité du plan', en: 'Plan opacity' },
  exh_fp_no_placement: { fr: 'Aucune œuvre placée.', en: 'No work placed.' },
  exh_fp_new_layout_ph: { fr: 'Nouvelle mise en espace…', en: 'New layout…' },
  exh_fp_works_one: { fr: '1 œuvre', en: '1 work' },
  exh_fp_works_fmt: { fr: '{n} œuvres', en: '{n} works' },
  exh_fp_name: { fr: 'Nom', en: 'Name' },
  exh_fp_walls: { fr: 'Murs', en: 'Walls' },
  exh_fp_add_wall: { fr: '+ Mur', en: '+ Wall' },
  exh_fp_wall_default_fmt: { fr: 'Mur {n}', en: 'Wall {n}' },
  exh_fp_notes: { fr: 'Notes', en: 'Notes' },
})
