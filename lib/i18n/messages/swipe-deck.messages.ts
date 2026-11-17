import { defineMessages } from '../message-core'

/** Shared swipe deck (components/shared/SwipeDeck.tsx) — R1 + R2 build step 4. */
export const swipeDeckMessages = defineMessages({
  sd_done: { fr: '{action} — 6 s pour annuler', en: '{action} — 6 s to undo' },
  sd_undo: { fr: 'Annuler', en: 'Undo' },
  sd_count: { fr: '{n} à trier', en: '{n} to sort' },
  sd_hint: { fr: '← glisser pour retirer · glisser pour garder →', en: '← swipe to discard · swipe to keep →' },
})
