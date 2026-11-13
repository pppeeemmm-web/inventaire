import { defineMessages } from '../message-core'

export const overviewConsoleMessages = defineMessages({
  ov_needs_you: {
    fr: 'À traiter',
    en: 'Needs you',
  },
  ov_needs_you_hint: {
    fr: 'Cliquez une ligne pour aller droit aux éléments concernés.',
    en: 'Click a row to go straight to the items behind it.',
  },
  ov_needs_all_clear: {
    fr: 'Rien en attente.',
    en: 'Nothing waiting.',
  },
  ov_needs_photo_validation: {
    fr: 'Validation photo',
    en: 'Photo validation',
  },
  ov_needs_not_catalogued: {
    fr: 'Non cataloguées',
    en: 'Not catalogued',
  },
  ov_needs_approvals: {
    fr: 'Validations en attente',
    en: 'Pending approvals',
  },
  ov_needs_field_tasks: {
    fr: 'Tâches terrain ouvertes',
    en: 'Open field tasks',
  },
  ov_needs_ledger: {
    fr: 'Kaizen à trier / ouvert',
    en: 'Kaizen to sort / open',
  },
  ov_needs_sessions: {
    fr: 'Sessions à appliquer',
    en: 'Sessions to apply',
  },
  ov_health_hint: {
    fr: "Cliquez un compteur pour filtrer l'inventaire.",
    en: 'Click a count to filter the inventory.',
  },
  ov_reminder_done: {
    fr: 'Fait — retirer des rappels',
    en: 'Done — remove from reminders',
  },
  ov_reminder_open_project: {
    fr: 'Ouvrir le projet dans le Suivi',
    en: 'Open the project in Pipeline',
  },
  ov_reminder_open_notes: {
    fr: 'Ouvrir les notes',
    en: 'Open notes',
  },
  ov_health_missing_tech: { fr: 'Technique manquante', en: 'Missing technique' },
  ov_health_missing_support: { fr: 'Support manquant', en: 'Missing support' },
  ov_health_missing_year: { fr: 'Année manquante', en: 'Missing year' },
  ov_health_missing_title: { fr: 'Sans titre', en: 'Untitled' },
  ov_jobs_title: { fr: 'Tâches locales', en: 'Local jobs' },
  ov_jobs_voice_pending: { fr: '{n} note(s) vocale(s) à transcrire', en: '{n} voice note(s) to transcribe' },
  ov_jobs_voice_clear: { fr: 'Notes vocales : tout est transcrit.', en: 'Voice notes: all transcribed.' },
  ov_jobs_run: { fr: 'Lancer sur ce PC', en: 'Run on this PC' },
  ov_jobs_running: { fr: 'En cours…', en: 'Running…' },
  ov_jobs_hint: {
    fr: "Transcrit les notes vocales puis indexe la recherche, l'un après l'autre (GPU de ce PC). Installation unique : scripts/register-embed-protocol.ps1.",
    en: "Transcribes voice notes, then indexes search, one after the other (this PC's GPU). One-time setup: scripts/register-embed-protocol.ps1.",
  },
  ov_jobs_phone_hint: {
    fr: 'Se lance depuis le PC (Aperçu, bouton « Lancer sur ce PC »).',
    en: 'Runs from the PC (Overview, “Run on this PC”).',
  },
  ov_index_pending: { fr: "Recherche : {n} en attente d'indexation", en: 'Search: {n} waiting for indexing' },
  ov_index_clear: { fr: 'Recherche : tout est indexé.', en: 'Search: everything is indexed.' },
  ov_index_copy: { fr: 'Copier la commande', en: 'Copy command' },
  ov_index_copied: { fr: 'Copié', en: 'Copied' },
})
