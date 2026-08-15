import { defineMessages } from '../message-core'

export const sessionFieldMessages = defineMessages({
  // ── Applied photos (already committed to the work) ─────────────────────────
  // Shown inside a painting so a past day can be checked and a wrong picture
  // corrected. Removal is a catalogue delete, so the copy says so plainly.
  session_photo_applied_heading: {
    fr: 'Photos de l’œuvre',
    en: 'Photos on the work',
  },
  session_photo_applied_hint: {
    fr: 'Déjà au catalogue. Les retirer les supprime de l’œuvre (récupérables 90 jours).',
    en: 'Already in the catalogue. Removing one deletes it from the work (recoverable for 90 days).',
  },
  session_photo_remove_applied_aria: {
    fr: 'Supprimer cette photo de l’œuvre',
    en: 'Delete this photo from the work',
  },
  session_photo_remove_applied_confirm: {
    fr: 'Supprimer cette photo de {work} ? Elle quitte le catalogue, pas seulement la séance. Récupérable 90 jours.',
    en: 'Delete this photo from {work}? It leaves the catalogue, not just this session. Recoverable for 90 days.',
  },

  // ── Photo pick failures ────────────────────────────────────────────────────
  // Both cases previously returned silently, which on a phone is indistinguishable
  // from a dead button — the photo was lost with nothing on screen.
  session_photo_read_failed: {
    fr: 'Photo illisible depuis la galerie. Réessayez, ou exportez-la à nouveau.',
    en: 'Could not read that photo from the gallery. Try again, or re-export it.',
  },
  session_photo_none_picked: {
    fr: 'Aucune photo reçue de la galerie. Réessayez.',
    en: 'The gallery returned no photo. Try again.',
  },

  // ── Duplicate guard ────────────────────────────────────────────────────────
  // Advisory: a series legitimately reuses a title, so this never blocks the commit.
  session_duplicate_title_warn: {
    fr: 'Ce titre existe déjà :',
    en: 'This title already exists:',
  },
})
