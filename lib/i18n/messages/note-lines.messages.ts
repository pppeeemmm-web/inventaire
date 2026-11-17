import { defineMessages } from '../message-core'

/** R1 step 6 slice 4b: work notes as lines (work card), the Fil on Overview, the team « Pour vous ». */
export const noteLinesMessages = defineMessages({
  // Work card — « Commentaires & notes »
  nl_lines: { fr: 'Lignes', en: 'Lines' },
  nl_old_field: { fr: 'Notes (ancien champ)', en: 'Notes (old field)' },
  nl_empty: { fr: 'Pas encore de ligne sur cette œuvre.', en: 'No line on this work yet.' },
  nl_add_ph: { fr: 'Ajouter une ligne…', en: 'Add a line…' },
  nl_add: { fr: 'Ajouter', en: 'Add' },
  nl_adding: { fr: 'Ajout…', en: 'Adding…' },
  nl_team: { fr: 'Équipe', en: 'Team' },
  nl_discarded: { fr: 'retirée du Fil', en: 'taken out of the feed' },
  nl_flag: { fr: 'Une idée pour Pem ?', en: 'An idea for Pem?' },
  nl_flag_hint: {
    fr: 'Cochez : la ligne passe en tête du Fil de Pem. Elle reste ici.',
    en: 'Tick it: the line goes first in Pem’s feed. It stays here.',
  },
  nl_flagged: { fr: '★ pour Pem', en: '★ for Pem' },
  nl_err: { fr: 'Échec : {e}', en: 'Failed: {e}' },
  nl_err_load: { fr: 'Les lignes n’ont pas pu se charger.', en: 'The lines could not load.' },
  nl_loading: { fr: 'Chargement des lignes…', en: 'Loading lines…' },
  nl_live_hint: {
    fr: 'Une ligne compte dès l’ajout ; Pem la lit dans son Fil.',
    en: 'A line counts as soon as it is added; Pem reads it in his feed.',
  },

  // Overview — the Fil (Pem) and « Pour vous » (team)
  ofil_title: { fr: 'Le Fil', en: 'The feed' },
  ofil_open_phone: { fr: 'Sur le téléphone', en: 'On the phone' },
  ofil_next: { fr: 'Ensuite', en: 'Next' },
  ofil_signals: { fr: 'Repères', en: 'Signals' },
  ofil_side: { fr: 'Le reste', en: 'Everything else' },
  ofil_expand_all: { fr: 'Tout ouvrir', en: 'Open all' },
  ofil_collapse_all: { fr: 'Tout fermer', en: 'Close all' },
  my_title: { fr: 'Pour vous', en: 'For you' },
  my_intro: {
    fr: 'Vos lignes et propositions, et ce que Pem en a fait.',
    en: 'Your lines and proposals, and what Pem did with them.',
  },
  my_empty: {
    fr: 'Rien encore. Vos lignes sur les œuvres et les idées s’afficheront ici.',
    en: 'Nothing yet. Your lines on works and ideas will show here.',
  },
  my_standing: { fr: 'Gardée', en: 'Standing' },
  my_discarded: { fr: 'Retirée par Pem le {date}', en: 'Taken out by Pem on {date}' },
  my_kind_work: { fr: 'Œuvre #{id}', en: 'Work #{id}' },
  my_kind_idea: { fr: 'Idée', en: 'Idea' },
  my_kind_proposal: { fr: 'Proposition', en: 'Proposal' },
  my_load_error: { fr: 'Vos lignes n’ont pas pu se charger.', en: 'Your lines could not load.' },
  my_discarded_count: { fr: '{n} retirée(s)', en: '{n} taken out' },
})
