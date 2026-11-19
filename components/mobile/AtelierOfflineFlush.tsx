'use client'

import { useEffect, useRef } from 'react'
import { saveWork } from '@/app/atelier/works/actions'
import {
  enqueueOfflineWorkSaveFromFormData,
  isLikelyOfflineSaveError,
  listOfflineWorkSaves,
  offlineRecordToFormData,
  removeOfflineWorkSave,
  supersededOfflineSaves,
  OFFLINE_WORK_SAVED_EVENT,
  type OfflineWorkSavedDetail,
} from '@/lib/mobile/offline-work-queue'
import { useI18n } from '@/lib/i18n/context'
import { toast } from '@/lib/ui/toast'
import { workSaveErrorToastMessage, WORK_CHANGED_ERROR, WORK_IN_BIN_ERROR } from '@/lib/work-save-error'

export function AtelierOfflineFlush() {
  const { t } = useI18n()
  const busy = useRef(false)

  useEffect(() => {
    async function flush() {
      if (!navigator.onLine || busy.current) return
      busy.current = true
      try {
        const rows = await listOfflineWorkSaves()
        const superseded = supersededOfflineSaves(rows)
        let flushed = 0
        for (const row of [...rows].sort((a, b) => a.createdAt - b.createdAt)) {
          // A later save of the same card replaces this one (it carries these edits too).
          if (superseded.has(row.id)) {
            await removeOfflineWorkSave(row.id)
            continue
          }
          const fd = await offlineRecordToFormData(row)
          const res = await saveWork(fd)
          if ('error' in res) {
            // Saved elsewhere / binned since this phone queued it: replaying it can never succeed (a second offline save
            // of the same card, or a save whose answer was lost, ends here too). Drop it, say which work, go on —
            // kept, it would block every save queued behind it for ever.
            if (res.error === WORK_CHANGED_ERROR || res.error === WORK_IN_BIN_ERROR) {
              await removeOfflineWorkSave(row.id)
              const id = String(fd.get('oeuvre_id') ?? '')
              toast.error(`${t('wc_offline_save_dropped').replace('{id}', id)} ${workSaveErrorToastMessage(res.error, t)}`)
              continue
            }
            toast.error(workSaveErrorToastMessage(res.error, t))
            break
          }
          await removeOfflineWorkSave(row.id)
          flushed++
          // The card still open on this work holds the stamp it queued with: hand it the new one (and the saved row),
          // else its next save is refused as « saved elsewhere » by its own queued save.
          const base = fd.get('__base_edited_at')
          if (res.editedAt && typeof base === 'string') {
            const detail: OfflineWorkSavedDetail = { oeuvreId: Number(fd.get('oeuvre_id')), base, editedAt: res.editedAt, saved: res.saved as Record<string, unknown> | undefined }
            window.dispatchEvent(new CustomEvent(OFFLINE_WORK_SAVED_EVENT, { detail }))
          }
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
