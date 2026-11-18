import { defineMessages } from '../message-core'

/**
 * Copy printed only in the PDF guide (`lib/aide/pdf.ts`, server side). Deliberately NOT registered in
 * `lib/i18n/messages/index.ts`, like `whats-new-items.messages.ts`: it never ships in a page's catalog.
 */
export const aidePdfMessages = defineMessages({
  aide_pdf_cover_kicker: { fr: 'PEM Studio — l’atelier', en: 'PEM Studio — the studio' },
  aide_pdf_cover_note: {
    fr: 'Le même texte que l’Aide de l’application (Kaizen → Aide), au {d}. Chaque chapitre dit le jour où il a été vérifié.',
    en: 'The same text as the app’s Help (Kaizen → Help), as of {d}. Each chapter gives the day it was checked.',
  },
  aide_pdf_admin_note: {
    fr: 'Réservé aux administrateurs : ce qui s’ajoute au guide d’équipe.',
    en: 'For admins only: what comes on top of the team guide.',
  },
  aide_pdf_page: { fr: 'Page {n} / {t}', en: 'Page {n} / {t}' },
  aide_pdf_chapter: { fr: 'Chapitre {n}', en: 'Chapter {n}' },
})
