'use client'

import { useEffect, useRef } from 'react'
import { saveWork } from '@/app/atelier/works/actions'
import {
  listOfflineWorkSaves,
  removeOfflineWorkSave,
  stringRecordToFormData,
} from '@/lib/mobile/offline-work-queue'
import { useI18n } from '@/lib/i18n/context'
import { toast } from '@/lib/ui/toast'

export function AtelierOfflineFlush() {
  const { t } = useI18n()
  const busy = useRef(false)

  useEffect(() => {
    async function flush() {
      if (!navigator.onLine || busy.current) return
      busy.current = true
      try {
        const rows = await listOfflineWorkSaves()
        let flushed = 0
        for (const row of rows) {
          const fd = stringRecordToFormData(row.fields)
          const res = await saveWork(fd)
          if ('error' in res) {
            toast.error(`${t('error_prefix')} ${res.error}`)
            break
          }
          await removeOfflineWorkSave(row.id)
          flushed++
        }
        if (flushed > 0) {
          toast.success(t('offline_sync_done'))
        }
      } catch {
        toast.error(t('offline_sync_failed'))
      } finally {
        busy.current = false
      }
    }

    void flush()
    window.addEventListener('online', flush)
    return () => window.removeEventListener('online', flush)
  }, [t])

  return null
}
