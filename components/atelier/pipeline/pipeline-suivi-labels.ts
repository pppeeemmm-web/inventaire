'use client'

import { useCallback, useMemo } from 'react'
import type { Lang } from '@/lib/i18n/dictionary'
import { useI18n } from '@/lib/i18n/context'
import { daysUntil, type PulseProcess } from '@/lib/pipeline-deadlines'
import {
  ETAPE_STATUT_ORDER,
  TYPE_LABELS,
  pipelineTypeLabel,
  type Etape,
  type EtapeStatut,
  type Process,
  type ProcessStatut,
  type ProcessType,
} from '@/components/atelier/pipeline/pipeline-shared'

export function useSuiviLabels() {
  const { t, lang } = useI18n()
  const statutLabels = useMemo(
    () =>
      ({
        en_cours: t('proc_stat_en_cours'),
        gagne: t('proc_stat_gagne'),
        perdu: t('proc_stat_perdu'),
        annule: t('proc_stat_annule'),
        termine: t('proc_stat_termine'),
      }) as Record<ProcessStatut, string>,
    [t],
  )
  const etapeLabels = useMemo(
    () =>
      ({
        a_faire: t('etape_stat_a_faire'),
        en_cours: t('etape_stat_en_cours'),
        fait: t('etape_stat_fait'),
        bloque: t('etape_stat_bloque'),
      }) as Record<EtapeStatut, string>,
    [t],
  )
  const typeLabel = useCallback((typ: ProcessType) => pipelineTypeLabel(typ, lang), [lang])
  return { statutLabels, etapeLabels, typeLabel, t, lang }
}

export function nextEtapeStatut(current: EtapeStatut): EtapeStatut {
  const i = ETAPE_STATUT_ORDER.indexOf(current)
  return ETAPE_STATUT_ORDER[(i + 1) % ETAPE_STATUT_ORDER.length]
}

export const DEFAULT_ETAPES: Record<ProcessType, string[]> = {
  collaboration: ['Premier contact', 'Proposition', 'Accord', 'Production', 'Livraison'],
  consignment: ['Proposition', 'Contrat', 'Livraison', 'En vente', 'Retour / Vente'],
  correspondance: ['Brouillon', 'Envoyé', 'Réponse reçue'],
  evenement: ['Concept', 'Planning', 'Communication', 'Jour J', 'Suivi'],
  expedition: ['Préparation', 'Emballage', 'En transit', 'Livré', 'Confirmé'],
  exposition: ['Concept', 'Sélection', 'Production', 'Installation', 'Vernissage', 'Décrochage'],
  livre: ['Concept', 'Éditorial', 'Textes & Images', 'Mise en page', 'Impression', 'Distribution'],
  pr: ['Stratégie', 'Contact', 'En cours', 'Publié'],
  prix: ['Dossier', 'Soumission', 'Présélection', 'Résultat'],
  residence: ['Dossier', 'Soumission', 'Entretien', 'Résultat'],
  salon: ['Candidature', 'Sélection', 'Logistique', 'Installation', 'Foire', 'Retour'],
  visite_atelier: ['Invitation', 'Confirmation', 'Visite', 'Suivi'],
  vente: ['Négociation', 'Accord', 'Acompte', 'Préparation', 'Livraison', 'Solde'],
  autre: ['Étape 1', 'Étape 2', 'Étape 3'],
}

export const SORTED_PROCESS_TYPES = (Object.keys(TYPE_LABELS) as ProcessType[]).sort((a, b) =>
  TYPE_LABELS[a].localeCompare(TYPE_LABELS[b], 'fr'),
)

export function urgencyColor(days: number): string {
  if (days < 0) return '#c06060'
  if (days <= 7) return '#c08040'
  if (days <= 21) return '#a0a040'
  return 'var(--tx3)'
}

export function dateLocaleTag(lang: Lang): 'fr-FR' | 'en-GB' {
  return lang === 'en' ? 'en-GB' : 'fr-FR'
}

export function fmtDate(s: string, includeTime?: string | null, locale: 'fr' | 'en' = 'fr'): string {
  const d = new Date(s)
  const loc = locale === 'en' ? 'en-GB' : 'fr-FR'
  const base = d.toLocaleDateString(loc, { day: 'numeric', month: 'short', year: 'numeric' })
  return includeTime ? `${base} · ${includeTime}` : base
}

export function processToPulseProcess(p: Process): PulseProcess {
  return {
    id: p.id,
    nom: p.nom,
    type: p.type,
    statut: p.statut,
    date_fin: p.date_fin,
    deadline_time: p.deadline_time,
    etapes: p.etapes.map((e: Etape) => ({
      id: e.id,
      nom: e.nom,
      statut: e.statut,
      date_echeance: e.date_echeance,
      overdue_override: e.overdue_override,
    })),
  }
}

export { daysUntil }
