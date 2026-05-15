'use client'

import { useRef, type ReactNode } from 'react'
import { quickAddEtape, quickMarkProcessDone } from '@/app/atelier/pipeline/actions'
import { toast } from '@/lib/ui/toast'
import type { DictKey } from '@/lib/i18n/dictionary'

const SWIPE_MIN_PX = 56

type Props = {
  processId: string
  enabled: boolean
  onRefresh: () => void
  t: (key: DictKey) => string
  children: ReactNode
}

/** Narrow Gantt row — swipe right adds étape, swipe left marks process done. */
export function PipelineProcessSwipe({ processId, enabled, onRefresh, t, children }: Props) {
  const start = useRef<{ x: number; y: number } | null>(null)

  if (!enabled) return <>{children}</>

  return (
    <div
      data-testid="pipeline-process-swipe"
      data-process-id={processId}
      onTouchStart={(e) => {
        const touch = e.touches[0]
        if (!touch) return
        start.current = { x: touch.clientX, y: touch.clientY }
      }}
      onTouchEnd={async (e) => {
        const touch = e.changedTouches[0]
        const s = start.current
        start.current = null
        if (!touch || !s) return
        const dx = touch.clientX - s.x
        const dy = touch.clientY - s.y
        if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy)) return
        if (dx > 0) {
          const res = await quickAddEtape(processId)
          if ('error' in res) toast.error(res.error)
          else {
            toast.success(t('pipeline_swipe_add_etape'))
            onRefresh()
          }
        } else {
          const res = await quickMarkProcessDone(processId)
          if ('error' in res) toast.error(res.error)
          else {
            toast.success(t('pipeline_swipe_done'))
            onRefresh()
          }
        }
      }}
    >
      {children}
    </div>
  )
}
