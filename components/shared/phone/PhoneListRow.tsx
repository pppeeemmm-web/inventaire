'use client'

import type { ReactNode } from 'react'

/** One row of a phone list (PhonePattern.md): name, one grey line, a value on the right (red when it needs attention). */
export function PhoneListRow({ title, sub, value, alert = false, onClick, testId, leading }: {
  title: string
  sub?: string
  value?: ReactNode
  alert?: boolean
  onClick: () => void
  testId?: string
  leading?: ReactNode
}) {
  return (
    <li style={{ listStyle: 'none' }}>
      <button
        type="button"
        onClick={onClick}
        data-testid={testId}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 12, minHeight: 60, padding: '8px 4px',
          border: 0, borderBottom: '1px solid var(--bd)', background: 'none', color: 'var(--tx)', font: 'inherit', textAlign: 'left', cursor: 'pointer',
        }}
      >
        {leading}
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
          {sub ? <span style={{ display: 'block', fontSize: 13, color: 'var(--tx3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</span> : null}
        </span>
        {value != null ? (
          <span style={{ fontSize: 14, fontVariantNumeric: 'tabular-nums', color: alert ? 'var(--rust, var(--ko))' : 'var(--tx2, var(--tx))', fontWeight: alert ? 600 : 400, flexShrink: 0 }}>{value}</span>
        ) : null}
      </button>
    </li>
  )
}
