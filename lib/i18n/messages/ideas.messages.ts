import { defineMessages } from '../message-core'

/** Idées — R1 step 6 slice 4a (the concepts tab reworked): weight, maturity, discussion, « Proposer une idée ». */
export const ideasMessages = defineMessages({
  ideas_weight_petite: { fr: 'Petite', en: 'Small' },
  ideas_weight_recherche: { fr: 'Recherche', en: 'Research' },
  ideas_maturity_graine: { fr: 'Graine', en: 'Seed' },
  ideas_maturity_pousse: { fr: 'Pousse', en: 'Sprout' },
  ideas_maturity_mure: { fr: 'Mûre', en: 'Ripe' },
  ideas_field_weight: { fr: 'Poids', en: 'Weight' },
  ideas_field_maturity: { fr: 'Maturité', en: 'Maturity' },
  ideas_maturity_aria: { fr: 'Maturité : {m}', en: 'Maturity: {m}' },
  ideas_stat_ripe: { fr: 'Mûres', en: 'Ripe' },
  ideas_filter_weight: { fr: 'Poids', en: 'Weight' },
  ideas_filter_maturity: { fr: 'Maturité', en: 'Maturity' },
  ideas_team_hint: {
    fr: 'Pem décide des idées. Lisez-les, ajoutez une ligne à leur discussion, ou proposez-en une.',
    en: 'Pem decides the ideas. Read them, add a line to their discussion, or propose one.',
  },
  ideas_admin_only: { fr: 'Réservé à Pem.', en: 'Pem only.' },
  ideas_saved: { fr: 'Enregistré.', en: 'Saved.' },
  ideas_err: { fr: 'Échec : {e}', en: 'Failed: {e}' },

  // Discussion
  ideas_discussion: { fr: 'Discussion', en: 'Discussion' },
  ideas_discussion_empty: { fr: 'Pas encore de ligne.', en: 'No line yet.' },
  ideas_lines_one: { fr: '1 ligne', en: '1 line' },
  ideas_lines_n: { fr: '{n} lignes', en: '{n} lines' },
  ideas_line_ph: { fr: 'Ajouter une ligne…', en: 'Add a line…' },
  ideas_line_add: { fr: 'Ajouter', en: 'Add' },
  ideas_line_adding: { fr: 'Ajout…', en: 'Adding…' },
  ideas_line_team: { fr: 'Équipe', en: 'Team' },
  ideas_line_discarded: { fr: 'retirée du Fil', en: 'taken out of the feed' },
  ideas_closed: { fr: 'Discussion close : elle reste lisible, sans nouvelle ligne.', en: 'Discussion closed: still readable, no new lines.' },
  ideas_close: { fr: 'Clore la discussion', en: 'Close the discussion' },
  ideas_reopen: { fr: 'Rouvrir la discussion', en: 'Reopen the discussion' },
  ideas_err_closed: { fr: 'Cette discussion est close.', en: 'This discussion is closed.' },

  // « Proposer une idée »
  ideas_propose_btn: { fr: 'Proposer une idée', en: 'Propose an idea' },
  ideas_propose_hint: { fr: 'Elle arrive directement dans le Fil de Pem.', en: 'It goes straight into Pem’s feed.' },
  ideas_propose_ph: { fr: 'Votre idée, en quelques mots…', en: 'Your idea, in a few words…' },
  ideas_propose_work: { fr: 'Œuvre (facultatif)', en: 'Work (optional)' },
  ideas_propose_work_ph: { fr: '#1234', en: '#1234' },
  ideas_propose_send: { fr: 'Envoyer à Pem', en: 'Send to Pem' },
  ideas_propose_sending: { fr: 'Envoi…', en: 'Sending…' },
  ideas_propose_cancel: { fr: 'Annuler', en: 'Cancel' },
  ideas_propose_sent: { fr: 'Envoyée à Pem.', en: 'Sent to Pem.' },
  ideas_propose_err_work: { fr: 'Œuvre introuvable : vérifiez le numéro.', en: 'Work not found: check the number.' },
})
