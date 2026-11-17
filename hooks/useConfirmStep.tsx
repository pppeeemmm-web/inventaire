'use client'

import { useCallback, useRef, useState, type ReactNode } from 'react'
import { useEscapeClose } from '@/hooks/useEscapeClose'

type Ask = { title: string; body: string; confirmLabel: string; cancelLabel: string }

/**
 * A short « are you sure? » before one step (same look as the unsaved-changes guard, no
 * window.confirm). `confirmStep(...)` resolves true on Confirm, false on Cancel / Esc / backdrop.
 * Render `confirmDialog` once in the component.
 */
export function useConfirmStep(): { confirmStep: (a: Ask) => Promise<boolean>; confirmDialog: ReactNode } {
  const [ask, setAsk] = useState<Ask | null>(null)
  const resolveRef = useRef<((ok: boolean) => void) | null>(null)

  const close = useCallback((ok: boolean) => {
    setAsk(null)
    const r = resolveRef.current
    resolveRef.current = null
    r?.(ok)
  }, [])

  const confirmStep = useCallback((a: Ask) => {
    resolveRef.current?.(false)
    setAsk(a)
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve
    })
  }, [])

  useEscapeClose(!!ask, () => close(false))

  const confirmDialog = ask ? (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-step-title"
      data-testid="confirm-step"
      onClick={() => close(false)}
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
        <div id="confirm-step-title" style={{ fontSize: 16, fontFamily: "'Instrument Serif', serif", marginBottom: 8, color: 'var(--tx)' }}>
          {ask.title}
        </div>
        <div className="t-mono-sm" style={{ fontSize: 11, color: 'var(--tx3)', marginBottom: 20, lineHeight: 1.45 }}>
          {ask.body}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="btn ghost sm" onClick={() => close(false)} style={{ minHeight: 44 }} data-testid="confirm-step-cancel">
            {ask.cancelLabel}
          </button>
          <button type="button" className="btn primary sm" onClick={() => close(true)} style={{ minHeight: 44 }} data-testid="confirm-step-ok" autoFocus>
            {ask.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  ) : null

  return { confirmStep, confirmDialog }
}
