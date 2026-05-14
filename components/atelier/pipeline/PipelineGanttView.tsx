'use client'

export function PipelineGanttView({ children, narrow }: { children: React.ReactNode; narrow: boolean }) {
  return (
    <div style={{ flex: 1, overflow: 'auto', padding: narrow ? '16px' : '20px 28px' }}>
      {children}
    </div>
  )
}
