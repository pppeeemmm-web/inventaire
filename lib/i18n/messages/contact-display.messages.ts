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
  cs_archived_fmt: {
    fr: 'Archivés ({n})',
    en: 'Archived ({n})',
  },
  cs_archived_title: {
    fr: 'Afficher seulement les personnes archivées',
    en: 'Show only archived people',
  },
  contacts_private_filter_title: {
    fr: 'Afficher seulement les contacts privés',
    en: 'Show only private contacts',
  },
  // Phone (Pem 2026-11-27: « avoid clutter, offer collapsible and interactive presentation »).
  contacts_phone_count_fmt: { fr: '{n} contacts', en: '{n} contacts' },
  contacts_phone_empty: { fr: 'Aucun contact', en: 'No contacts' },
  contacts_phone_search_in: { fr: 'Chercher dans', en: 'Search in' },
  contacts_phone_sphere: { fr: 'Sphère', en: 'Sphere' },
  contacts_phone_other: { fr: 'Autres', en: 'Other' },
  contacts_phone_sort: { fr: 'Trier par', en: 'Sort by' },
})
