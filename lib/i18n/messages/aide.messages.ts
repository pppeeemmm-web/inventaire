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
  // Downloadable guide (PDF, built on demand from the same chapters — Pem GO 2026-11-18).
  aide_pdf_download: { fr: 'Télécharger le guide (PDF)', en: 'Download the guide (PDF)' },
  // « ? » help panel (every Atelier screen).
  aide_help_button: { fr: 'Aide pour cet écran', en: 'Help for this screen' },
  aide_help_title: { fr: 'Aide', en: 'Help' },
  aide_help_search: { fr: 'Chercher dans l’Aide…', en: 'Search the Help…' },
  aide_help_no_match: { fr: 'Rien trouvé pour « {q} ».', en: 'Nothing found for « {q} ».' },
  aide_help_open_full: { fr: 'Ouvrir l’Aide complète', en: 'Open the full Help' },
  aide_help_close: { fr: 'Fermer l’aide', en: 'Close help' },
  aide_help_for_screen: { fr: 'Pour cet écran', en: 'For this screen' },
  aide_help_all: { fr: 'Tous les chapitres', en: 'All chapters' },
})
