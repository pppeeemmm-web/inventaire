import { defineMessages } from '../message-core'

/**
 * What's new — the dialog / Kaizen chrome only (owner 2026-11-03). The items' own copy lives in
 * `whats-new-items.messages.ts`, NOT registered in `index.ts`: it is loaded by `WhatsNewList` only when the
 * list opens, so it stays out of every page's catalog (it had grown to ~45 kB of French on the phone).
 */
export const whatsNewMessages = defineMessages({
  // {v} = WHATS_NEW_RELEASE (lib/whats-new.ts), filled where used (Pem 2026-11-18: no hard-coded « 3.0 »).
  wn_title: { fr: 'www.thepemworkshop.com {v}', en: 'www.thepemworkshop.com {v}' },
  wn_intro: {
    fr: 'Ce qui a changé ces derniers jours dans l’Atelier.',
    en: 'What changed in the Atelier over the last few days.',
  },
  wn_dont_show: { fr: 'Ne plus afficher', en: 'Don’t show again' },
  wn_close: { fr: 'Fermer', en: 'Close' },
  wn_open_kaizen: { fr: 'Voir dans Kaizen → Nouveautés', en: 'See in Kaizen → What’s new' },
  wn_kaizen_btn: { fr: 'Nouveautés {v}', en: 'What’s new {v}' },
  wn_kaizen_hide: { fr: 'Masquer les nouveautés', en: 'Hide what’s new' },
})
