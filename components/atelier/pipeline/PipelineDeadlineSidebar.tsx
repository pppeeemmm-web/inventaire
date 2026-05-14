'use client'

export function PipelineDeadlineSidebar({ children, narrow }: { children: React.ReactNode; narrow: boolean }) {
  return (
    <div style={{
      width: narrow ? '100%' : 280,
      maxHeight: narrow ? 320 : undefined,
      flexShrink: 0,
      borderLeft: narrow ? 'none' : '1px solid var(--bd)',
      borderTop: narrow ? '1px solid var(--bd)' : undefined,
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg1)',
      overflow: 'auto',
    }}>
      {children}
    </div>
  )
}
