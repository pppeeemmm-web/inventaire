import { defineMessages } from '../message-core'

/** Contacts list: « Privé » chip and filter, admin only (ContactsReview phase 1, 2026-11-18). */
export const contactDisplayMessages = defineMessages({
  contacts_private_chip: {
    fr: 'Privé',
    en: 'Private',
  },
  contacts_private_chip_title: {
    fr: 'Contact privé : visible des administrateurs seulement',
    en: 'Private contact: visible to admins only',
  },
  contacts_private_filter_fmt: {
    fr: 'Privé ({n})',
    en: 'Private ({n})',
  },
  contacts_private_filter_title: {
    fr: 'Afficher seulement les contacts privés',
    en: 'Show only private contacts',
  },
})
