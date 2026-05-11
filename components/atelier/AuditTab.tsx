'use client'

import { useState, useEffect } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { fetchSystemLogs, type AuditLogEntry } from '@/app/atelier/audit/actions'

export function AuditTab() {
  const { t } = useI18n()
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [filter, setFilter] = useState('ALL')
  const [busy, setBusy] = useState(true)

  useEffect(() => {
    fetchSystemLogs(200).then(data => {
      setLogs(data)
      setBusy(false)
    })
  }, [])

  const filtered = logs.filter(l => filter === 'ALL' || l.event_type === filter)

  const eventTypes = ['ALL', ...new Set(logs.map(l => l.event_type).filter(Boolean))]

  function getBadgeColor(type: string) {
    switch (type) {
      case 'VISIBILITY_GATE': return 'var(--ac)'
      case 'GATE_BYPASS': return 'var(--rust)'
      case 'PAYMENT_GRAIN': return 'var(--green)'
      case 'STATUS_CHANGE': return 'var(--tx2)'
      default: return 'var(--tx3)'
    }
  }

  if (busy) return <div style={{ padding: 40, opacity: 0.5 }} className="t-mono-sm">LOADING AUDIT VAULT...</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header / Filter Bar */}
      <div style={{ padding: '12px 28px', borderBottom: '1px solid var(--bd)', display: 'flex', alignItems: 'center', gap: 20 }}>
        <div className="t-eyebrow" style={{ fontSize: 10 }}>Audit Ledger</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {eventTypes.map((evt) => (
            <button
              key={evt}
              onClick={() => setFilter(evt)}
              className="btn ghost sm"
              style={{
                fontSize: 9, letterSpacing: 1,
                border: filter === evt ? '1px solid var(--bd)' : '1px solid transparent',
                opacity: filter === evt ? 1 : 0.5,
                background: filter === evt ? 'var(--bg1)' : 'transparent'
              }}
            >
              {evt.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Ledger Table */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <table className="tbl" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th style={{ width: 160 }}>Timestamp</th>
              <th style={{ width: 140 }}>Event</th>
              <th style={{ width: 120 }}>User</th>
              <th style={{ width: 100 }}>Table</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(l => (
              <tr key={l.id} style={{ fontSize: 11 }}>
                <td className="t-mono-sm" style={{ opacity: 0.6 }}>
                  {new Date(l.created_at).toLocaleString('fr-FR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </td>
                <td>
                  <span style={{ 
                    fontSize: 8, fontWeight: 700, padding: '2px 6px', 
                    background: `${getBadgeColor(l.event_type)}15`, 
                    color: getBadgeColor(l.event_type),
                    border: `1px solid ${getBadgeColor(l.event_type)}33`,
                    borderRadius: 2, letterSpacing: 0.5
                  }}>
                    {l.event_type}
                  </span>
                </td>
                <td style={{ color: 'var(--tx2)' }}>{l.user_email?.split('@')[0] || t('audit_actor_system')}</td>
                <td style={{ opacity: 0.6, fontSize: 10 }}>{l.table_name || '—'}</td>
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <div style={{ color: 'var(--tx)' }}>{l.action}</div>
                    {l.metadata && (
                      <div style={{ fontSize: 9, color: 'var(--tx3)', fontStyle: 'italic' }}>
                        {typeof l.metadata === 'string' ? l.metadata : JSON.stringify(l.metadata)}
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
