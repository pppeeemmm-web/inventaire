'use client'

// R6 speed rule: a field keeps its text locally and saves once, on blur (or Enter), only if it changed.
// One field = one patch; the caller updates its row in place (no list re-fetch).

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useI18n } from '@/lib/i18n/context'

interface Props {
  value: string | null
  onSave: (next: string | null) => Promise<string | null>
  type?: 'text' | 'date' | 'url'
  multiline?: boolean
  placeholder?: string
  ariaLabel: string
  style?: CSSProperties
}

export function BlurField({ value, onSave, type = 'text', multiline, placeholder, ariaLabel, style }: Props) {
  const { t } = useI18n()
  const [draft, setDraft] = useState(value ?? '')
  const [state, setState] = useState<'idle' | 'saving' | 'error'>('idle')
  const [err, setErr] = useState<string | null>(null)
  const saved = useRef(value ?? '')

  // A save elsewhere (or another event) brings a new value: take it when not typing.
  useEffect(() => { saved.current = value ?? ''; setDraft(value ?? '') }, [value])

  async function commit() {
    const next = draft.trim()
    if (next === saved.current.trim()) return
    setState('saving')
    const e = await onSave(next === '' ? null : next)
    if (e) { setState('error'); setErr(e); return }
    saved.current = next
    setState('idle'); setErr(null)
  }

  const base: CSSProperties = {
    width: '100%', boxSizing: 'border-box', fontSize: 13, padding: '6px 8px', minHeight: 36,
    background: 'var(--bg0)', color: 'var(--tx)', outline: 'none',
    border: `1px solid ${state === 'error' ? 'var(--rust)' : 'var(--bd)'}`,
    opacity: state === 'saving' ? 0.7 : 1, ...style,
  }
  return (
    <span style={{ display: 'block', minWidth: 0 }}>
      {multiline ? (
        <textarea
          aria-label={ariaLabel} value={draft} placeholder={placeholder} rows={3}
          onChange={(e) => setDraft(e.target.value)} onBlur={() => void commit()}
          style={{ ...base, resize: 'vertical' }}
        />
      ) : (
        <input
          aria-label={ariaLabel} type={type} value={draft} placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => void commit()}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
          style={base}
        />
      )}
      {state === 'error' && <span role="alert" style={{ display: 'block', fontSize: 11, color: 'var(--rust)', marginTop: 2 }}>{`${t('ev_save_failed')} ${err ?? ''}`}</span>}
    </span>
  )
}
