'use client'

export function SitePublicSection({ title, icon, children, action, testId }: {
  title: string
  icon: string
  children: React.ReactNode
  action?: React.ReactNode
  testId?: string
}) {
  return (
    <section
      data-testid={testId}
      style={{
        background: 'var(--bg1)',
        border: '1px solid var(--bd)',
        borderRadius: 8,
        padding: 24,
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
      }}
    >
      <div className="row between" style={{
        paddingBottom: 14,
        marginBottom: 20,
        alignItems: 'center',
        borderBottom: '1px solid var(--bd)',
      }}>
        <div className="row gap-md center">
          <span style={{ fontSize: 18, color: 'var(--ac)' }}>{icon}</span>
          <h3 className="serif" style={{ fontSize: 20 }}>{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}
