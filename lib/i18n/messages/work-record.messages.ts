import { defineMessages } from '../message-core'

/** R3 step 3: phone recording drawer (Nouvelle œuvre / Reprise) + the card's stage / custody / place rules. */
export const workRecordMessages = defineMessages({
  wr_title: { fr: 'Enregistrer', en: 'Record' },
  wr_all_fields: { fr: 'Tous les champs', en: 'All fields' },
  wr_close: { fr: 'Fermer', en: 'Close' },
  wr_mode_aria: { fr: 'Que faut-il enregistrer ?', en: 'What to record?' },
  wr_mode_new: { fr: 'Nouvelle œuvre', en: 'New work' },
  wr_mode_reprise: { fr: 'Reprise d’une œuvre', en: 'Rework a work' },
  wr_ok: { fr: 'OK', en: 'OK' },
  wr_cancel: { fr: 'Annuler', en: 'Cancel' },
  wr_change: { fr: 'changer…', en: 'change…' },
  wr_untitled: { fr: 'Sans titre', en: 'Untitled' },

  wr_add_photo: { fr: 'Ajouter la photo', en: 'Add the picture' },
  wr_photo_hint: {
    fr: 'Photothèque, ou Lightroom → Partager → PEM',
    en: 'Photo library, or Lightroom → Share → PEM',
  },
  wr_photo_end_hint: { fr: 's’ajoute à la fin de la bande d’images', en: 'added at the end of the picture strip' },
  wr_pic_remove: { fr: 'Retirer cette photo', en: 'Remove this picture' },
  wr_pics_shared: { fr: '{n} photo(s) partagée(s) jointe(s)', en: '{n} shared picture(s) attached' },
  wr_pics_pending: { fr: 'Photos en attente de validation.', en: 'Pictures awaiting approval.' },

  wr_field_title: { fr: 'Titre', en: 'Title' },
  wr_field_technique: { fr: 'Technique', en: 'Technique' },
  wr_new_technique: { fr: '+ Nouvelle technique…', en: '+ New technique…' },
  wr_field_support: { fr: 'Support', en: 'Support' },
  wr_new_support: { fr: '+ Nouveau support…', en: '+ New support…' },
  wr_field_dims: { fr: 'Dimensions (cm)', en: 'Dimensions (cm)' },
  wr_dim_h: { fr: 'H', en: 'H' },
  wr_dim_w: { fr: 'L', en: 'W' },
  wr_dim_d: { fr: 'P', en: 'D' },
  wr_field_format: { fr: 'Format', en: 'Format' },
  wr_new_format: { fr: '+ Nouveau format…', en: '+ New format…' },

  wr_place: { fr: 'Lieu', en: 'Place' },
  wr_place_new: { fr: 'Nom du nouveau lieu', en: 'New place name' },
  wr_place_auto: { fr: 'auto', en: 'auto' },
  wr_place_locate: { fr: 'Lieu le plus proche (position)', en: 'Nearest place (location)' },
  wr_place_none_near: { fr: 'Aucun lieu enregistré à moins de 2 km.', en: 'No saved place within 2 km.' },
  wr_place_locate_failed: { fr: 'Position indisponible.', en: 'Location unavailable.' },
  wr_place_date_err: {
    fr: 'Ce lieu n’existait pas à cette date — choisir un autre lieu ou corriger la date.',
    en: 'This place did not exist at that date — pick another place or fix the date.',
  },

  wr_field_note: { fr: 'Note', en: 'Note' },
  wr_note_ph: { fr: 'Ce qui a changé (fond, glacis…)', en: 'What changed (ground, glaze…)' },
  wr_voice_after: { fr: 'Note vocale après la création', en: 'Voice note after creating' },
  wr_voice_after_on: { fr: 'Note vocale : s’ouvre après la création ✓', en: 'Voice note: opens after creating ✓' },
  wr_voice_reprise: { fr: 'Note vocale sur la reprise', en: 'Voice note on the rework' },

  wr_more: {
    fr: 'Source · période · peinte sur l’ancien support de… (lien)',
    en: 'Source · period · painted on the old support of… (link)',
  },
  wr_field_source: { fr: 'Source', en: 'Source' },
  wr_new_source: { fr: '+ Nouvelle source…', en: '+ New source…' },
  wr_field_period: { fr: 'Période', en: 'Period' },
  wr_period_auto: { fr: 'Automatique (d’après la date)', en: 'Automatic (from the date)' },
  wr_painted_on: { fr: 'Peinte sur l’ancien support de…', en: 'Painted on the old support of…' },

  wr_pick_work: { fr: 'Œuvre reprise', en: 'Reworked work' },
  wr_pick_ph: { fr: 'n° ou titre', en: 'no. or title' },
  wr_searching: { fr: 'Recherche…', en: 'Searching…' },
  wr_no_hit: { fr: 'Aucune œuvre trouvée.', en: 'No work found.' },
  wr_pick_first: { fr: 'Choisir d’abord l’œuvre reprise.', en: 'Pick the reworked work first.' },
  wr_history_line: { fr: 'Ligne d’historique', en: 'History line' },
  wr_history_date: { fr: 'Date de la reprise', en: 'Rework date' },
  wr_stage_unchanged: {
    fr: 'Même numéro. Le stade de production ne change pas tout seul ; si l’œuvre était « Disponible », elle le reste.',
    en: 'Same number. The production stage does not move by itself; an « Available » work stays so.',
  },

  wr_create: { fr: 'Créer l’œuvre', en: 'Create the work' },
  wr_add_to: { fr: 'Ajouter à #{id}', en: 'Add to #{id}' },
  wr_add_to_none: { fr: 'Ajouter à l’œuvre', en: 'Add to the work' },
  wr_saving: { fr: 'Enregistrement…', en: 'Saving…' },
  wr_created: { fr: 'Œuvre #{id} créée.', en: 'Work #{id} created.' },
  wr_reprise_done: { fr: 'Reprise ajoutée à #{id}.', en: 'Rework added to #{id}.' },
  wr_leave_confirm: { fr: 'Quitter sans enregistrer ?', en: 'Leave without saving?' },

  // Rules on the card (WorkCard.notes « Rules the build must enforce »).
  wr_stage_fate_tt: {
    fr: 'Fermé : l’œuvre est détruite ou perdue (voir Objet › Destin).',
    en: 'Closed: the work is destroyed or lost (see Objet › Fate).',
  },
  wr_stage_archive_atelier_tt: {
    fr: 'Fermé : une œuvre de l’archive de l’artiste est cataloguée.',
    en: 'Closed: a work in the artist’s archive is catalogued.',
  },
  wr_stage_archive_avail_tt: {
    fr: 'Fermé : l’archive de l’artiste est retirée de la diffusion — elle s’arrête à Catalogué. Changer d’abord la propriété.',
    en: 'Closed: the artist’s archive is out of circulation — it stops at Catalogued. Change the ownership first.',
  },
  wr_stage_transferred_atelier_tt: {
    fr: 'Fermé : une œuvre vendue ou donnée a quitté l’atelier.',
    en: 'Closed: a sold or given work has left the studio.',
  },
  wr_custodian_archive: {
    fr: 'l’artiste, d’office (archive) — modifiable par l’admin',
    en: 'the artist, by rule (archive) — admin can change it',
  },
  wr_custodian_archive_admin: {
    fr: 'l’artiste par défaut (archive) — modifiable ici',
    en: 'the artist by default (archive) — change it here',
  },
  // « Brouillon » (Pem 2026-11-18, TODO 22): keep a new work's fields on this phone and leave.
  wr_keep_draft: { fr: 'Brouillon', en: 'Draft' },
  wr_draft_kept: {
    fr: 'Brouillon gardé sur ce téléphone (sans les photos) — rouvrez « Enregistrer » pour le reprendre.',
    en: 'Draft kept on this phone (without the photos) — open « Record » again to pick it up.',
  },
  wr_draft_restored: { fr: 'Brouillon du {date} repris.', en: 'Draft from {date} picked up.' },
  wr_draft_clear: { fr: 'Effacer', en: 'Clear' },
})
