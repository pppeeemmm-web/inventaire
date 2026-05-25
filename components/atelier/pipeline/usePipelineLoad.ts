'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { listUnreadSuiviReminders } from '@/app/atelier/reminders-actions'
import { fromSuiviProcess, fromSuiviEtape } from '@/lib/pipeline/suivi-client'
import type { Etape, Process, Reminder } from '@/components/atelier/pipeline/pipeline-shared'

export function usePipelineLoad(initialReminders: Reminder[]) {
  const [processes, setProcesses] = useState<Process[]>([])
  const [reminders, setReminders] = useState<Reminder[]>(initialReminders)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setReminders(initialReminders)
  }, [initialReminders])

  const load = useCallback(async (signal?: AbortSignal) => {
    const sb = createClient()
    let processQuery = fromSuiviProcess(sb).select('*').order('date_fin', { ascending: true, nullsFirst: false })
    let etapeQuery = fromSuiviEtape(sb).select('*').order('position')
    if (signal) {
      processQuery = processQuery.abortSignal(signal)
      etapeQuery = etapeQuery.abortSignal(signal)
    }
    const [{ data: procs }, { data: etapes }, rems] = await Promise.all([
      processQuery,
      etapeQuery,
      listUnreadSuiviReminders(500),
    ])
    if (signal?.aborted) return
    const etapeMap: Record<string, Etape[]> = {}
    ;(etapes ?? []).forEach((row) => {
      const e = row as Etape
      if (!etapeMap[e.process_id]) etapeMap[e.process_id] = []
      etapeMap[e.process_id].push(e)
    })
    setProcesses((procs ?? []).map((p: any) => ({
      ...p,
      responsables: p.responsables ?? [],
      vault_tags:   p.vault_tags   ?? [],
      vault_path:   p.vault_path   ?? null,
      etapes:       (etapeMap[p.id] ?? []).map((e: any) => ({
        ...e,
        overdue_override: e.overdue_override ?? false,
      })),
    })))
    setReminders(rems as Reminder[])
    setLoading(false)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load])

  return { processes, setProcesses, reminders, setReminders, loading, load }
}
