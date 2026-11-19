import { defineMessages } from '../message-core'

/** A contact's links (email, phone, website, social profiles) as one clickable row (2026-11-19). */
export const contactLinksMessages = defineMessages({
  contact_links_row: {
    fr: 'Liens',
    en: 'Links',
  },
  contact_links_open_fmt: {
    fr: 'Ouvrir {label}',
    en: 'Open {label}',
  },
  contact_links_email_fmt: {
    fr: 'Écrire à {label}',
    en: 'Email {label}',
  },
  contact_links_phone_fmt: {
    fr: 'Appeler {label}',
    en: 'Call {label}',
  },
})
