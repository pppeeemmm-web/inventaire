'use client'

export function SourceItem({ label, active, onClick, badge, badgeWarn }: {
  label: string
  active: boolean
  onClick: () => void
  badge?: string
  badgeWarn?: boolean
}) {
  return (
    <div onClick={onClick} style={{
      padding: '8px 12px', borderRadius: 4, border: '1px solid var(--bd)',
      background: active ? 'var(--bg2)' : 'var(--bg1)',
      cursor: active ? 'pointer' : 'default', transition: 'all 0.15s',
      display: 'flex', alignItems: 'center', gap: 8,
      opacity: active ? 1 : 0.55,
      transform: active ? 'scale(1.01)' : 'none',
    }}>
      <div style={{ width: 5, height: 5, borderRadius: '50%', background: active ? 'var(--ac)' : 'var(--bd)', flexShrink: 0 }} />
      <span className="t-mono-xs" style={{ fontSize: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{label}</span>
      {badge && (
        <span className="t-mono-xs" style={{ fontSize: 9, flexShrink: 0, color: badgeWarn ? 'var(--rust)' : 'var(--tx3)' }}>
          {badge}
        </span>
      )}
    </div>
  )
}
