import { defineMessages } from '../message-core'

/** Work drawer → links to other works (WorkLinksSection). `_out` = this work → #N, `_in` = #N → this work. */
export const workLinksMessages = defineMessages({
  wl_heading: { fr: 'Liens avec d’autres œuvres', en: 'Links to other works' },
  wl_none: { fr: 'Aucun lien.', en: 'No links.' },
  wl_add: { fr: 'Lier', en: 'Link' },
  wl_work_ph: { fr: 'N° œuvre', en: 'Work no.' },
  wl_type_aria: { fr: 'Type de lien', en: 'Link type' },
  wl_remove_aria: { fr: 'Retirer ce lien', en: 'Remove this link' },
  wl_remove_confirm: { fr: 'Retirer le lien avec #{n} ?', en: 'Remove the link with #{n}?' },
  wl_err_work: { fr: 'Numéro d’œuvre introuvable.', en: 'Work number not found.' },
  wl_painted_on_out: { fr: 'Peinte sur', en: 'Painted on' },
  wl_painted_on_in: { fr: 'Recouverte par', en: 'Painted over by' },
  wl_derived_from_out: { fr: 'Dérivée de', en: 'Derived from' },
  wl_derived_from_in: { fr: 'A donné', en: 'Gave rise to' },
  wl_answers_out: { fr: 'Répond à', en: 'Answers' },
  wl_answers_in: { fr: 'A pour réponse', en: 'Answered by' },
  wl_series_out: { fr: 'Même série que', en: 'Same series as' },
  wl_series_in: { fr: 'Même série que', en: 'Same series as' },
  wl_diptych_out: { fr: 'Diptyque avec', en: 'Diptych with' },
  wl_diptych_in: { fr: 'Diptyque avec', en: 'Diptych with' },
  wl_influence_out: { fr: 'Influence avec', en: 'Influence with' },
  wl_influence_in: { fr: 'Influence avec', en: 'Influence with' },
  wl_proximity_out: { fr: 'Proche de', en: 'Close to' },
  wl_proximity_in: { fr: 'Proche de', en: 'Close to' },
})
