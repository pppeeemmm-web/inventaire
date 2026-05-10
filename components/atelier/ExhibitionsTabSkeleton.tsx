'use client'

/** Matches ExhibitionsTab chrome so chunk load + data fetch don’t jump layout */
export function ExhibitionsTabSkeleton() {
  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>
      <div
        style={{
          width: 240,
          flexShrink: 0,
          borderRight: '1px solid var(--bd)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--bd)' }}>
          <div className="pulse" style={{ height: 28, background: 'var(--bg2)', borderRadius: 2 }} />
        </div>
        <div style={{ flex: 1, padding: '12px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="pulse" style={{ height: 44, background: 'var(--bg2)', borderRadius: 2 }} />
          ))}
        </div>
        <div style={{ padding: '8px 12px', borderTop: '1px solid var(--bd)' }}>
          <div className="pulse" style={{ height: 12, background: 'var(--bg2)', borderRadius: 2, width: '70%' }} />
        </div>
      </div>
      <div style={{ flex: 1, padding: 24, display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
        <div className="pulse" style={{ height: 22, width: '55%', background: 'var(--bg2)', borderRadius: 2 }} />
        <div className="pulse" style={{ height: 10, width: '35%', background: 'var(--bg2)', borderRadius: 2 }} />
        <div className="pulse" style={{ flex: 1, minHeight: 160, background: 'var(--bg2)', borderRadius: 2 }} />
      </div>
    </div>
  )
}
