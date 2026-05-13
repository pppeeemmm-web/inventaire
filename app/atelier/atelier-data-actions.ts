'use server'

import { createClient } from '@/lib/supabase/server'
import type { ContactAddress } from '@/components/atelier/contact-editor-types'
import type { AtelierOverviewBootstrap } from '@/components/atelier/team-portal-types'
import {
  computePipelinePulseItems,
  type PulseEtape,
  type PulseProcess,
} from '@/lib/pipeline-deadlines'
import { buildPipelineCalendarEvents } from '@/lib/pipeline-calendar'
import type {
  ConceptBurningRow,
  SuiviEtapePulseRow,
  SuiviProcessPulseRow,
  SuiviReminderListRow,
} from '@/lib/types/database'

function buildPulseProcesses(
  procs: SuiviProcessPulseRow[],
  etapes: SuiviEtapePulseRow[],
): PulseProcess[] {
  const etapeMap: Record<string, PulseEtape[]> = {}
  for (const e of etapes) {
    if (!etapeMap[e.process_id]) etapeMap[e.process_id] = []
    etapeMap[e.process_id].push({
      id: e.id,
      nom: e.nom,
      statut: e.statut,
      date_echeance: e.date_echeance,
      overdue_override: e.overdue_override ?? false,
    })
  }
  return procs.map((p) => ({
    id: p.id,
    nom: p.nom,
    type: p.type,
    statut: p.statut,
    date_fin: p.date_fin,
    deadline_time: p.deadline_time,
    etapes: etapeMap[p.id] ?? [],
  }))
}

/** Expense + pipeline pulse + calendar events + burning concepts for Atelier overview (RSC bootstrap). */
export async function fetchAtelierOverviewBootstrap(
  fiscalYear: number,
  reminders: SuiviReminderListRow[],
): Promise<AtelierOverviewBootstrap> {
  const supabase = await createClient()

  const [expRes, proRes, etRes, conceptRes] = await Promise.all([
    supabase.from('expense').select('montant_ttc').eq('fiscal_year', fiscalYear),
    supabase
      .from('suivi_process')
      .select('id, nom, type, date_fin, deadline_time, statut')
      .not('statut', 'in', '("perdu","annule","termine")'),
    supabase
      .from('suivi_etape')
      .select('id, process_id, nom, statut, date_echeance, overdue_override, position')
      .order('position'),
    supabase
      .from('concept')
      .select('id, titre, energie')
      .gte('energie', 4)
      .not('statut', 'eq', 'abandonne')
      .not('statut', 'eq', 'devenu_oeuvre')
      .order('energie', { ascending: false })
      .limit(5),
  ])

  if (expRes.error) console.error('[atelier overview] expense:', expRes.error.message)
  if (proRes.error) console.error('[atelier overview] suivi_process:', proRes.error.message)
  if (etRes.error) console.error('[atelier overview] suivi_etape:', etRes.error.message)
  if (conceptRes.error) console.error('[atelier overview] concept:', conceptRes.error.message)

  const expenseRows = (expRes.data ?? []) as { montant_ttc: number | null }[]
  const expenseTotalTtc = expenseRows.reduce((s, e) => s + (e.montant_ttc ?? 0), 0)

  const procs = (proRes.data ?? []) as SuiviProcessPulseRow[]
  const etapes = (etRes.data ?? []) as SuiviEtapePulseRow[]
  const processes = buildPulseProcesses(procs, etapes)

  const reminderInputs = reminders.map((r) => ({
    id: r.id,
    message: r.message,
    remind_at: r.remind_at,
    process_id: r.process_id,
    lu: r.lu,
  }))

  return {
    expenseTotalTtc,
    upcomingPulse: computePipelinePulseItems(processes).slice(0, 8),
    overviewCalendarEvents: buildPipelineCalendarEvents(processes, reminderInputs),
    burningConcepts: (conceptRes.data ?? []) as ConceptBurningRow[],
  }
}

/** Flat `contact_addresses` for curation/compare (post–first-paint fetch from TeamPortalClient). */
export async function fetchAtelierContactAddresses(): Promise<ContactAddress[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('contact_addresses')
    .select('id, contact_id, label, adresse, code_postal, ville, pays, position, shipping_notes')
    .order('position')
  if (error) {
    console.error('[atelier contact_addresses]', error.message)
    return []
  }
  return (data ?? []) as ContactAddress[]
}
