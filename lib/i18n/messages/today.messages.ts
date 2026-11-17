import { defineMessages } from '../message-core'

/** R2 « Aujourd'hui » — the light phone route (`/hub/today`), outside the Atelier shell. */
export const todayMessages = defineMessages({
  today_days: { fr: 'Les jours', en: 'All days' },
  today_menu: { fr: 'Menu', en: 'Menu' },
  today_summary: { fr: '{e} entrées · {w} œuvres · {v} notes', en: '{e} entries · {w} works · {v} notes' },
  today_see_again: { fr: 'À revoir', en: 'See again' },
  today_works: { fr: 'Œuvres du jour', en: 'Works of the day' },
  today_works_empty: { fr: 'Aucune œuvre aujourd’hui — Œuvre ↓', en: 'No work today — Work ↓' },
  today_entries: { fr: 'Écrits et notes du jour', en: 'Writings and notes of the day' },
  today_entries_empty: { fr: 'Rien d’écrit aujourd’hui — Écrire ↓', en: 'Nothing written today — Write ↓' },
  today_voice_note: { fr: 'note vocale', en: 'voice note' },
  today_open_full: { fr: 'Ouvrir la journée complète', en: 'Open the full day' },
  today_bar_write: { fr: 'Écrire', en: 'Write' },
  today_bar_voice: { fr: 'Vocal', en: 'Voice' },
  today_bar_work: { fr: 'Œuvre', en: 'Work' },
  today_bar_doc: { fr: 'Photo · doc', en: 'Photo · doc' },
  today_load_error: { fr: 'Une partie de la journée n’a pas pu se charger.', en: 'Part of the day could not load.' },
})
