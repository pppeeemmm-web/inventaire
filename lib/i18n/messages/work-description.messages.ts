import { defineMessages } from '../message-core'

/** Work drawer → "✦ Seen by AI" (A2, owner 2026-11-13): AI description rated for usefulness. */
export const workDescriptionMessages = defineMessages({
  wd_heading: { fr: '✦ Vu par l’IA', en: '✦ Seen by AI' },
  wd_ai_badge: { fr: 'IA', en: 'AI' },
  wd_meta: { fr: 'Décrit par {engine} le {date} · non vérifié', en: 'Described by {engine} on {date} · unverified' },
  wd_echoes: { fr: 'Échos', en: 'Echoes' },
  wd_useful_q: { fr: 'Utile ?', en: 'Useful?' },
  wd_level_0: { fr: 'Inutile', en: 'Useless' },
  wd_level_1: { fr: 'Peu utile', en: 'Barely useful' },
  wd_level_2: { fr: 'Moyen', en: 'So-so' },
  wd_level_3: { fr: 'Utile', en: 'Useful' },
  wd_level_4: { fr: 'Très juste', en: 'Spot on' },
  wd_unrated: { fr: 'Pas encore jugé', en: 'Not yet judged' },
  wd_rated_by: { fr: 'Noté par {name} le {date}', en: 'Rated by {name} on {date}' },
  wd_rated_on: { fr: 'Noté le {date}', en: 'Rated on {date}' },
  wd_clear: { fr: 'Effacer la note', en: 'Clear the rating' },
  wd_prompt_avg: {
    fr: 'Cette consigne : moyenne {avg} / 4 sur {rated} notées ({total} décrites)',
    en: 'This prompt: average {avg} / 4 over {rated} rated ({total} described)',
  },
  wd_prompt_none: { fr: 'Cette consigne : aucune note encore ({total} décrites)', en: 'This prompt: no rating yet ({total} described)' },
  wd_note: {
    fr: 'Texte de l’IA, jamais copié dans les commentaires. Noté 0 → retiré de la recherche.',
    en: 'AI text, never copied into the comments. Rated 0 → left out of search.',
  },
  wd_err: { fr: 'Note non enregistrée.', en: 'Rating not saved.' },
  wd_report_field: { fr: 'Utilité de la description IA', en: 'AI description usefulness' },
})
