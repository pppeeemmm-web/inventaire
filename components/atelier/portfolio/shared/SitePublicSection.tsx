'use client'

import { useState } from 'react'
import { useI18n } from '@/lib/i18n/context'

export function SitePublicSection({
  title, icon, children, action, testId,
  collapsible = true, defaultCollapsed = false,
}: {
  title: string
  icon: string
  children: React.ReactNode
  action?: React.ReactNode
  testId?: string
  /** When true (default) the header chevron collapses the body. */
  collapsible?: boolean
  /** Initial collapsed state when collapsible. */
  defaultCollapsed?: boolean
}) {
  const { t } = useI18n()
  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  const isCollapsed = collapsible && collapsed

  const titleCluster = (
    <div className="row gap-md center" style={{ gap: 10 }}>
      {collapsible && (
        <span
          aria-hidden
          style={{
            fontSize: 10,
            color: 'var(--tx3)',
            transition: 'transform .15s',
            transform: isCollapsed ? 'none' : 'rotate(90deg)',
            display: 'inline-block',
            flexShrink: 0,
          }}
        >
          ▸
        </span>
      )}
      <span style={{ fontSize: 18, color: 'var(--ac)' }}>{icon}</span>
      <h3 className="serif" style={{ fontSize: 20 }}>{title}</h3>
    </div>
  )

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
        paddingBottom: isCollapsed ? 0 : 14,
        marginBottom: isCollapsed ? 0 : 20,
        alignItems: 'center',
        borderBottom: isCollapsed ? 'none' : '1px solid var(--bd)',
      }}>
        {collapsible ? (
          <button
            type="button"
            onClick={() => setCollapsed(c => !c)}
            aria-expanded={!isCollapsed}
            aria-label={t(isCollapsed ? 'editor_fade_expand' : 'editor_fade_collapse')}
            style={{
              background: 'none', border: 'none', padding: 0, margin: 0,
              cursor: 'pointer', color: 'inherit', font: 'inherit', textAlign: 'left',
              flex: 1, minWidth: 0,
            }}
          >
            {titleCluster}
          </button>
        ) : (
          titleCluster
        )}
        {action}
      </div>
      {!isCollapsed && children}
    </section>
  )
}
