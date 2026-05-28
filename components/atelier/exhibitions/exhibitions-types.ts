// Shared types + constants for Exhibitions components

import type { CSSProperties } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Step {
  id:               string
  process_id:       string
  nom:              string
  statut:           string
  date_echeance:    string | null
  position:         number
  notes:            string | null
  overdue_override: boolean | null
}

export interface Exhibition {
  id:           string
  nom:          string
  type:         string | null
  statut:       string
  date_debut:   string | null
  date_fin:     string | null
  contact_id:   number | null
  localisation: string | null
  url:          string | null
  notes:        string | null
  steps:        Step[]
  created_at:   string
}

export type ExhibitionContact = {
  ContactID:      number
  NomInstitution: string | null
  Nom:            string | null
  Prénom:         string | null
  Email?:         string | null
  Tel?:           string | null
}

// ── Constants ─────────────────────────────────────────────────────────────────

export const WALL_COLORS = [
  '#c8a86e','#60a0a0','#a060a0','#a0a060','#c06060','#6080c0','#80c080','#c08060',
]

export const inputSt: CSSProperties = {
  width: '100%', padding: '8px 12px', fontSize: 13,
  background: 'var(--bg0)', border: '1px solid var(--bd)',
  color: 'var(--tx)', outline: 'none', boxSizing: 'border-box',
}

export const STATUT_COLORS: Record<string, string> = {
  a_confirmer: '#a0a040',
  prevue:      '#6080c0',
  en_cours:    'var(--ac)',
  passee:      '#888',
}

export const STATUT_LABELS: Record<string, string> = {
  a_confirmer: 'À confirmer',
  prevue:      'Prévue',
  en_cours:    'En cours',
  passee:      'Passée',
}

export const STEP_COLORS: Record<string, string> = {
  fait:     '#4caf82',
  en_cours: 'var(--ac)',
  a_faire:  'var(--bd)',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}
