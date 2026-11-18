import { defineMessages } from '../message-core'

/** In-app Aide — screen chrome only; chapter text lives in `lib/aide/*` (owner GO 2026-11-18). */
export const aideMessages = defineMessages({
  aide_tab: { fr: 'Aide', en: 'Help' },
  aide_guide_team: { fr: 'Guide d’équipe', en: 'Team guide' },
  aide_guide_admin: { fr: 'Guide admin', en: 'Admin guide' },
  aide_contents: { fr: 'Sommaire', en: 'Contents' },
  aide_back: { fr: '← Sommaire', en: '← Contents' },
  aide_verified: { fr: 'Vérifié le {d}', en: 'Checked on {d}' },
  aide_prev: { fr: '← Précédent', en: '← Previous' },
  aide_next: { fr: 'Suivant →', en: 'Next →' },
  aide_vault_link: { fr: 'Aide et guides', en: 'Help and guides' },
})
