import { defineMessages } from '../message-core'

/** Year pass (`/atelier/year-pass`) — week-1 report §3.1. */
export const yearPassMessages = defineMessages({
  yp_tab: { fr: 'Passe des années', en: 'Year pass' },
  yp_title: { fr: 'Passe des années', en: 'Year pass' },
  yp_left_fmt: { fr: '{n} sans année', en: '{n} without a year' },
  yp_done_fmt: { fr: '{n} datée(s) dans cette passe', en: '{n} dated in this pass' },
  yp_empty: { fr: 'Plus d’œuvre sans année dans cette liste.', en: 'No work without a year left in this list.' },
  yp_untitled: { fr: 'sans titre', en: 'untitled' },
  yp_in_selection: { fr: 'sélection Therapeia / Paréidolie', en: 'Therapeia / Paréidolie selection' },
  yp_dated_fmt: { fr: '{n} datées', en: '{n} dated' },
  yp_year_ph: { fr: 'Année (ex. 2019)', en: 'Year (e.g. 2019)' },
  yp_save: { fr: 'Enregistrer', en: 'Save' },
  yp_skip: { fr: 'Je ne sais pas', en: 'I don’t know' },
  yp_back: { fr: '← Précédente', en: '← Previous' },
  yp_fix_cancel: { fr: 'Annuler la correction', en: 'Cancel the correction' },
  yp_fixing_fmt: { fr: 'Correction : elle a {y} — tapez la bonne année.', en: 'Correcting: it has {y} — type the right year.' },
  yp_fixed: { fr: '#{n} corrigée : {y}', en: '#{n} corrected: {y}' },
  yp_admin_only: { fr: 'La passe des années est réservée à Pem (admin).', en: 'The year pass is for Pem (admin) only.' },
  yp_err_year: { fr: 'Une année entre 1950 et {max}.', en: 'A year between 1950 and {max}.' },
  yp_err_oeuvre_id: { fr: 'Œuvre introuvable.', en: 'Work not found.' },
  yp_err_admin_only: { fr: 'Réservé à l’admin.', en: 'Admin only.' },
  yp_err_unchanged: { fr: 'Rien n’a changé : l’année a été modifiée ailleurs entre-temps.', en: 'Nothing changed: the year was changed elsewhere meanwhile.' },
  yp_err_failed: { fr: 'Erreur de la base, réessayez.', en: 'Database error, try again.' },
})
