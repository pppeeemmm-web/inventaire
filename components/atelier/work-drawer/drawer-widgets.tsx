'use client'

import type { CSSProperties, ReactNode } from 'react'
import { useState } from 'react'
import { useI18n } from '@/lib/i18n/context'

export function WfPipeProgress({
  stages,
  current,
  onSelect,
  color,
}: {
  stages: { id: string; label: string; desc?: string; disabled?: boolean }[]
  current: string
  onSelect: (id: string) => void
  color: string
}) {
  const idxCurrent = stages.findIndex((x) => x.id === current)
  return (
    <div style={{ display: 'flex', gap: 4, width: '100%', flexWrap: 'wrap' }}>
      {stages.map((s, i) => {
        const isActive = s.id === current
        const isPast = idxCurrent >= i
        const isDisabled = !!s.disabled
        return (
          <div
            key={s.id}
            onClick={() => !isDisabled && onSelect(s.id)}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && !isDisabled) {
                e.preventDefault()
                onSelect(s.id)
              }
            }}
            role="button"
            tabIndex={isDisabled ? -1 : 0}
            style={{
              flex: '1 1 72px',
              minWidth: 64,
              cursor: isDisabled ? 'not-allowed' : 'pointer',
              borderBottom: `3px solid ${isPast ? color : 'var(--bd)'}`,
              padding: '6px 2px',
              opacity: isDisabled ? 0.25 : isPast ? 1 : 0.45,
            }}
          >
            <div style={{ fontSize: 10, fontWeight: isActive ? 700 : 400, color: 'var(--tx)', whiteSpace: 'normal', overflowWrap: 'anywhere', lineHeight: 1.25 }}>{s.label}</div>
            {s.desc && <div style={{ fontSize: 9, color: 'var(--tx3)', marginTop: 2, whiteSpace: 'normal', overflowWrap: 'anywhere', lineHeight: 1.25 }}>{s.desc}</div>}
          </div>
        )
      })}
    </div>
  )
}

export function WfSwitch({
  label,
  checked,
  onChange,
  disabled = false,
  testId,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  testId?: string
}) {
  return (
    <label data-testid={testId} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: disabled ? 'default' : 'pointer', fontSize: 12, opacity: disabled ? 0.45 : 1 }}>
      <div
        onClick={() => !disabled && onChange(!checked)}
        role="checkbox"
        aria-checked={checked}
        style={{
          width: 18,
          height: 18,
          border: '1px solid var(--bd)',
          background: checked ? 'var(--ac)' : 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--bg0)',
          fontSize: 11,
        }}
      >
        {checked ? '✓' : ''}
      </div>
      <span style={{ color: checked ? 'var(--tx)' : 'var(--tx3)' }}>{label}</span>
    </label>
  )
}

export function SectionTitle({ title }: { title: string }) {
  return (
    <div style={{ fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--tx3)', marginBottom: 10, paddingBottom: 4, borderBottom: '1px solid var(--bd2)', display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 3, height: 3, background: 'var(--ac)' }} />
      {title}
    </div>
  )
}

export function Label({ children }: { children: ReactNode }) {
  return <div className="t-label" style={{ fontSize: 10, paddingTop: 4 }}>{children}</div>
}

export function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div onClick={() => onChange(!checked)} style={{ width: 14, height: 14, border: '1px solid var(--bd)', background: checked ? 'var(--ac)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--bg1)', fontSize: 9, cursor: 'pointer', borderRadius: 2 }}>
      {checked ? '✓' : ''}
    </div>
  )
}

export const FIS: CSSProperties = {
  fontSize: 12,
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
  lineHeight: 1.35,
}

export function CreatableSelect({
  value,
  options,
  onChange,
  onAdd,
}: {
  value: string
  options: { id: string; label: string }[]
  onChange: (v: string) => void
  onAdd: (v: string) => void
}) {
  const { t } = useI18n()
  const [isAdding, setIsAdding] = useState(false)
  const [newVal, setNewVal] = useState('')
  if (isAdding) {
    return (
      <div style={{ display: 'flex', gap: 4 }}>
        <input className="input" value={newVal} onChange={e => setNewVal(e.target.value)} style={{ ...FIS, padding: '8px 10px', minHeight: 40 }} placeholder="Nouveau…" autoFocus />
        <button type="button" className="btn primary sm" style={{ minHeight: 40, padding: '0 10px', fontSize: 10 }} onClick={() => { onAdd(newVal); setIsAdding(false); setNewVal('') }}>OK</button>
        <button type="button" className="btn ghost sm" aria-label={t('cancel')} style={{ minHeight: 40, padding: '0 10px', fontSize: 10 }} onClick={() => setIsAdding(false)}>×</button>
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      <select className="input" value={value} onChange={e => onChange(e.target.value)} style={{ ...FIS, padding: '8px 10px', minHeight: 40 }}>
        <option value="">—</option>
        {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
      <button type="button" className="btn ghost sm" style={{ minHeight: 40, minWidth: 40, padding: 0, fontSize: 10 }} onClick={() => setIsAdding(true)}>+</button>
    </div>
  )
}

export function cap(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''
}
