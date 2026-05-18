'use client'

export function PipelineGanttView({ children, narrow }: { children: React.ReactNode; narrow: boolean }) {
  return (
    <div
      data-testid="pipeline-gantt-root"
      style={{
        flex: 1,
        overflow: 'auto',
        padding: narrow ? '12px 16px' : '20px 28px',
        minWidth: 0,
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
      }}
    >
      {children}
    </div>
  )
}
