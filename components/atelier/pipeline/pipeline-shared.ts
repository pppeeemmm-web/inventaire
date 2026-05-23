/**
 * Shared pipeline process types + FR/EN type labels (used by Pipeline and ExhibitionsListPanel).
 * Keeps `Pipeline.tsx` thinner without changing runtime behaviour.
 */

import type { Lang } from '@/lib/i18n/dictionary'

export const ATELIER_NARROW_MQ = '(max-width: 767px)'

export type ProcessType =
  | 'prix' | 'residence' | 'expedition' | 'consignment' | 'exposition'
  | 'pr' | 'visite_atelier' | 'salon' | 'livre' | 'collaboration'
  | 'evenement' | 'correspondance' | 'vente' | 'autre'

export type ProcessStatut = 'en_cours' | 'gagne' | 'perdu' | 'annule' | 'termine'
export type EtapeStatut = 'a_faire' | 'en_cours' | 'fait' | 'bloque'

export interface Etape {
  id: string
  process_id: string
  nom: string
  date_echeance: string | null
  statut: EtapeStatut
  position: number
  notes: string | null
  overdue_override: boolean
}

export interface Responsable {
  nom: string
  contact_id: number | null
  role: string
}

export interface Process {
  id: string
  nom: string
  type: ProcessType
  date_debut: string | null
  date_fin: string | null
  deadline_time: string | null
  statut: ProcessStatut
  notes: string | null
  localisation: string | null
  url: string | null
  scope: string | null
  stakeholders: string | null
  responsables: Responsable[]
  vault_tags: string[]
  vault_path: string | null
  pdf_path: string | null
  asset_notes: string | null
  oeuvre_id: number | null
  contact_id: number | null
  exhibition_process_id?: string | null
  created_at: string
  etapes: Etape[]
}

export interface Reminder {
  id: string
  process_id: string | null
  etape_id: string | null
  message: string
  remind_at: string
  lu: boolean
}

export const TYPE_LABELS: Record<ProcessType, string> = {
  collaboration: 'Collaboration',
  consignment: 'Consignation',
  correspondance: 'Correspondance',
  evenement: 'Événement',
  expedition: 'Expédition',
  exposition: 'Exposition',
  livre: 'Livre / Publication',
  pr: 'Relations publiques',
  prix: 'Prix',
  residence: 'Résidence / Bourse',
  salon: 'Salon / Foire',
  visite_atelier: "Visite d'atelier",
  vente: 'Vente',
  autre: 'Autre',
}

export const TYPE_LABELS_EN: Record<ProcessType, string> = {
  collaboration: 'Collaboration',
  consignment: 'Consignment',
  correspondance: 'Correspondence',
  evenement: 'Event',
  expedition: 'Shipment',
  exposition: 'Exhibition',
  livre: 'Book / Publication',
  pr: 'Public Relations',
  prix: 'Prize / Award',
  residence: 'Residency / Grant',
  salon: 'Art Fair',
  visite_atelier: 'Studio Visit',
  vente: 'Sale',
  autre: 'Other',
}

export function pipelineTypeLabel(typ: ProcessType, lang: Lang): string {
  return lang === 'en' ? TYPE_LABELS_EN[typ] : TYPE_LABELS[typ]
}

export const TYPE_COLORS: Record<ProcessType, string> = {
  collaboration: '#b07040',
  consignment: '#c08080',
  correspondance: '#708090',
  evenement: '#80a060',
  expedition: '#80c090',
  exposition: '#a060c0',
  livre: '#c0a030',
  pr: '#60b0c0',
  prix: '#c0a060',
  residence: '#6090c0',
  salon: '#c06090',
  visite_atelier: '#70b080',
  vente: '#60a060',
  autre: '#888888',
}

export const ETAPE_STATUT_COLORS: Record<EtapeStatut, string> = {
  a_faire: 'var(--tx3)',
  en_cours: '#c0a030',
  fait: '#60a060',
  bloque: '#c06060',
}

export const ETAPE_STATUT_ORDER: EtapeStatut[] = ['a_faire', 'en_cours', 'fait', 'bloque']
