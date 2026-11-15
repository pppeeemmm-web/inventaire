import { defineMessages } from '../message-core'

/** Session photos staged but not yet applied to their work (TODO 2, root cause of the 10 stranded
 *  photos of 2026-07-30): shown on the journal day, its summary line and the work card. */
export const sessionStagedMessages = defineMessages({
  st_waiting_one: { fr: '1 photo en attente : pas encore sur l’œuvre', en: '1 photo waiting: not on the work yet' },
  st_waiting_fmt: { fr: '{n} photos en attente : pas encore sur l’œuvre', en: '{n} photos waiting: not on the work yet' },
  st_sum_fmt: { fr: '{n} en attente', en: '{n} waiting' },
  st_open_session: { fr: 'Ouvrir la session', en: 'Open the session' },
  st_drawer_fmt: { fr: 'Session du {date} : {n} photo(s) pas encore sur l’œuvre', en: 'Session of {date}: {n} photo(s) not on the work yet' },
  st_hint: {
    fr: 'Une photo prise en session reste en attente tant qu’elle n’est pas appliquée à l’œuvre (un admin l’applique depuis la session).',
    en: 'A session photo waits until it is applied to the work (an admin applies it from the session).',
  },
  /** Singular forms for the work card's session list (TODO 1f); plurals stay in the legacy dict. */
  st_shot_one: { fr: 'photo', en: 'photo' },
  st_item_one: { fr: 'entrée', en: 'entry' },
})
