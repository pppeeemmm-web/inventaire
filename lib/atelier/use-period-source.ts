'use client'

// One shared copy of the periods + sources data for the Atelier (Inventory, work drawer, Rapports):
// loaded once, and every edit updates it in place so the other views follow without a reload.

import { useEffect, useSyncExternalStore } from 'react'
import { loadPeriodSourceData } from '@/app/atelier/works/period-source-actions'
import { emptyPeriodSourceData, type PeriodSourceData } from '@/lib/work-periods'

let data: PeriodSourceData = emptyPeriodSourceData()
let loaded = false
let inflight: Promise<void> | null = null
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

export function refreshPeriodSource(): Promise<void> {
  inflight ??= loadPeriodSourceData()
    .then((res) => {
      if ('error' in res) return
      data = res
      loaded = true
      emit()
    })
    .finally(() => {
      inflight = null
    })
  return inflight
}

/** False until the first load lands; read during render (the load re-renders every subscriber). */
export function isPeriodSourceLoaded(): boolean {
  return loaded
}

/** Apply a local change after a successful save. */
export function patchPeriodSource(fn: (d: PeriodSourceData) => PeriodSourceData) {
  data = fn(data)
  emit()
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function usePeriodSource(): PeriodSourceData {
  const snap = useSyncExternalStore(subscribe, () => data, () => data)
  useEffect(() => {
    if (!loaded) void refreshPeriodSource()
  }, [])
  return snap
}
