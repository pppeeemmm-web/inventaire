'use client'

export function PageSection({ title, icon, children, action }: {
  title: string
  icon: string
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <section>
      <div className="row between bb" style={{ paddingBottom: 14, marginBottom: 24, alignItems: 'center' }}>
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
