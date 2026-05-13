/**
 * Shared deadline math + “pulse” item list for Pipeline sidebar and Atelier Overview.
 * Keeps Overview ACTIVE PIPELINE in sync with Pipeline tab logic (etapes, skip rules).
 */

export const PIPELINE_PULSE_HORIZON_DAYS = 60

export type PulseEtape = {
  id?: string
  nom: string
  statut: string
  date_echeance: string | null
  overdue_override: boolean
}

export type PulseProcess = {
  id: string
  nom: string
  type: string
  statut: string
  date_fin: string | null
  deadline_time: string | null
  etapes: PulseEtape[]
}

export type PipelinePulseItem = {
  label: string
  date: string
  deadline_time: string | null
  type: string
  processId: string
  etapeId?: string
}

export function daysUntil(dateStr: string): number {
  const d = new Date(dateStr)
  d.setHours(0, 0, 0, 0)
  const n = new Date()
  n.setHours(0, 0, 0, 0)
  return Math.ceil((d.getTime() - n.getTime()) / 86400000)
}

/**
 * All pipeline deadline rows (process end + open steps), same skip rules as the pulse list,
 * but **no** horizon filter — used by the month calendar and other wide-range views.
 */
export function computePipelineCalendarDeadlineItems(processes: PulseProcess[]): PipelinePulseItem[] {
  const items: PipelinePulseItem[] = []
  for (const p of processes) {
    if (['perdu', 'annule', 'termine'].includes(p.statut)) continue

    let skipDateFin = false
    if (p.date_fin) {
      const days = daysUntil(p.date_fin)
      const hasCompletedSameDay = p.etapes.some((e) => e.statut === 'fait' && e.date_echeance === p.date_fin)
      const hasFutureSteps = p.etapes.some(
        (e) => e.statut !== 'fait' && e.date_echeance && daysUntil(e.date_echeance) >= 0,
      )
      const hasPendingSameDay = p.etapes.some((e) => e.statut !== 'fait' && e.date_echeance === p.date_fin)

      if (hasCompletedSameDay || (days < 0 && hasFutureSteps) || hasPendingSameDay) {
        skipDateFin = true
      }
    }

    if (p.date_fin && !skipDateFin) {
      items.push({
        label: p.nom,
        date: p.date_fin,
        deadline_time: p.deadline_time,
        type: p.type,
        processId: p.id,
      })
    }

    for (const e of p.etapes) {
      if (e.statut !== 'fait' && !e.overdue_override && e.date_echeance) {
        items.push({
          label: `${p.nom} · ${e.nom}`,
          date: e.date_echeance,
          deadline_time: null,
          type: p.type,
          processId: p.id,
          etapeId: e.id,
        })
      }
    }
  }

  return items.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
}

/** Same rules as PipelineTab `upcoming` sidebar (deadlines in the next N days, incl. overdue). */
export function computePipelinePulseItems(
  processes: PulseProcess[],
  horizonDays: number = PIPELINE_PULSE_HORIZON_DAYS,
): PipelinePulseItem[] {
  return computePipelineCalendarDeadlineItems(processes)
    .filter((i) => daysUntil(i.date) <= horizonDays)
}
