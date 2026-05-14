'use client'

import { useEffect, useRef } from 'react'
import { useI18n } from '@/lib/i18n/context'

/** Ring B — voice/written note stub (full capture in plan Phase 4). */
export function VoiceNoteSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n()
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const id = window.setTimeout(() => closeRef.current?.focus(), 0)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.clearTimeout(id)
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ring-b-voice-title"
      data-testid="ring-b-voice-sheet"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 155,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 480,
          background: 'var(--bg1)',
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          padding: '20px 20px max(20px, env(safe-area-inset-bottom))',
          borderTop: '1px solid var(--bd)',
          boxShadow: '0 -8px 32px rgba(0,0,0,0.25)',
        }}
      >
        <div id="ring-b-voice-title" className="serif" style={{ fontSize: 18, marginBottom: 10 }}>
          {t('ring_b_voice_sheet_title')}
        </div>
        <p className="t-mono-sm" style={{ color: 'var(--tx2)', fontSize: 12, lineHeight: 1.5, marginBottom: 16 }}>
          {t('ring_b_voice_sheet_body')}
        </p>
        <button
          ref={closeRef}
          type="button"
          className="btn primary"
          data-testid="ring-b-voice-sheet-close"
          style={{ minHeight: 44, width: '100%' }}
          onClick={onClose}
        >
          {t('ring_b_voice_sheet_close')}
        </button>
      </div>
    </div>
  )
}
