'use client'

import { useCallback, useRef, useState } from 'react'
import { useI18n } from '@/lib/i18n/context'

/**
 * Generic unsaved-changes guard: Save / Discard / Cancel.
 * Use for modals, drawers, or any deferred action (e.g. row switch).
 */
export function useUnsavedActionGuard({
  isDirty,
  onProceed,
  performSave,
}: {
  isDirty: boolean
  onProceed: () => void
  performSave: () => Promise<boolean>
}) {
  const { t } = useI18n()
  const [show, setShow] = useState(false)
  const [saving, setSaving] = useState(false)
  const pendingRef = useRef<(() => void) | null>(null)

  const attemptAction = useCallback(() => {
    if (!isDirty) {
      onProceed()
      return
    }
    pendingRef.current = onProceed
    setShow(true)
  }, [isDirty, onProceed])

  const discard = useCallback(() => {
    setShow(false)
    const fn = pendingRef.current
    pendingRef.current = null
    fn?.()
  }, [])

  const cancelDialog = useCallback(() => {
    setShow(false)
    pendingRef.current = null
  }, [])

  const saveAndProceed = useCallback(async () => {
    setSaving(true)
    try {
      const ok = await performSave()
      if (ok) {
        setShow(false)
        const fn = pendingRef.current
        pendingRef.current = null
        fn?.()
      }
    } finally {
      setSaving(false)
    }
  }, [performSave])

  const unsavedDialog = show ? (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="unsaved-guard-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={() => {
        if (saving) return
        cancelDialog()
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg1)',
          border: '1px solid var(--bd)',
          borderRadius: 10,
          padding: 24,
          width: '100%',
          maxWidth: 400,
          boxShadow: '0 20px 60px rgba(0,0,0,0.45)',
        }}
      >
        <div id="unsaved-guard-title" style={{ fontSize: 16, fontFamily: "'Instrument Serif', serif", marginBottom: 8, color: 'var(--tx)' }}>
          {t('workDrawerUnsavedTitle')}
        </div>
        <div className="t-mono-sm" style={{ fontSize: 11, color: 'var(--tx3)', marginBottom: 20, lineHeight: 1.45 }}>
          {t('workDrawerUnsavedBody')}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="btn ghost sm" disabled={saving} onClick={discard} style={{ color: 'var(--rust)', borderColor: 'rgba(192,57,43,0.35)' }}>
            {t('workDrawerDiscard')}
          </button>
          <button type="button" className="btn ghost sm" disabled={saving} onClick={cancelDialog}>
            {t('cancel')}
          </button>
          <button type="button" className="btn primary sm" disabled={saving} onClick={() => void saveAndProceed()}>
            {saving ? '…' : t('save')}
          </button>
        </div>
      </div>
    </div>
  ) : null

  return { attemptAction, unsavedDialog, cancelDialog }
}
