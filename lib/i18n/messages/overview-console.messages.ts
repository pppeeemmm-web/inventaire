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
  ov_index_title: { fr: 'Indexation recherche', en: 'Search indexing' },
  ov_index_pending: { fr: '{n} en attente', en: '{n} waiting' },
  ov_index_clear: { fr: 'Tout est indexé.', en: 'Everything is indexed.' },
  ov_index_run: { fr: "Lancer l'indexation", en: 'Run indexing' },
  ov_index_running: { fr: 'Indexation en cours…', en: 'Indexing…' },
  ov_index_copy: { fr: 'Copier la commande', en: 'Copy command' },
  ov_index_copied: { fr: 'Copié', en: 'Copied' },
  ov_index_hint: {
    fr: 'Lance le worker sur ce PC (Ollama). Installation unique : scripts/register-embed-protocol.ps1.',
    en: 'Runs the worker on this PC (Ollama). One-time setup: scripts/register-embed-protocol.ps1.',
  },
})
