'use client'

import { useState, useEffect, useCallback, useTransition } from 'react'
import { useI18n } from '@/lib/i18n/context'
import {
  deleteAuditLogEntries,
  fetchAuditAdmin,
  fetchSystemLogs,
  type AuditLogEntry,
} from '@/app/atelier/(portal)/audit/actions'
import { PendingQueue } from '@/components/atelier/PendingQueue'
import { PendingWorkSessions } from '@/components/atelier/PendingWorkSessions'
import { LoadingShell } from '@/components/shared/LoadingShell'
import { toast } from '@/lib/ui/toast'

export function Audit() {
  const { t, lang } = useI18n()
  const [view, setView] = useState<'ledger' | 'pending'>('ledger')
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [filter, setFilter] = useState('ALL')
  const [busy, setBusy] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [checkedIds, setCheckedIds] = useState<Set<number>>(() => new Set())
  const [deletePending, startDeleteTransition] = useTransition()

  const locale = lang === 'fr' ? 'fr-FR' : 'en-GB'

  const reloadLedger = useCallback(async () => {
    setBusy(true)
    const [data, admin] = await Promise.all([fetchSystemLogs(200), fetchAuditAdmin()])
    setLogs(data)
    setIsAdmin(admin)
    setBusy(false)
  }, [])

  useEffect(() => {
    if (view !== 'ledger') return
    void reloadLedger()
  }, [view, reloadLedger])

  useEffect(() => {
    setCheckedIds(new Set())
  }, [filter])

  if (view === 'pending') {
    return (
      <div data-testid="audit-tab-root" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ padding: '12px 28px', borderBottom: '1px solid var(--bd)', display: 'flex', gap: 8 }}>
          <button onClick={() => setView('ledger')} className="btn ghost sm" style={{ fontSize: 9, letterSpacing: 1, opacity: 0.5 }} data-testid="audit-subtab-ledger">{t('audit_view_ledger')}</button>
          <button onClick={() => setView('pending')} className="btn ghost sm" style={{ fontSize: 9, letterSpacing: 1, border: '1px solid var(--bd)', background: 'var(--bg1)' }} data-testid="audit-subtab-pending">{t('audit_view_pending')}</button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
          <PendingQueue />
          <PendingWorkSessions />
        </div>
      </div>
    )
  }

  const filtered = logs.filter(l => filter === 'ALL' || l.event_type === filter)
  const filteredIds = filtered.map((l) => l.id)
  const allFilteredSelected =
    filteredIds.length > 0 && filteredIds.every((id) => checkedIds.has(id))

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

  function toggleRow(id: number) {
    setCheckedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAllFiltered() {
    if (allFilteredSelected) {
      setCheckedIds((prev) => {
        const next = new Set(prev)
        for (const id of filteredIds) next.delete(id)
        return next
      })
      return
    }
    setCheckedIds((prev) => {
      const next = new Set(prev)
      for (const id of filteredIds) next.add(id)
      return next
    })
  }

  function deleteChecked() {
    if (!isAdmin || checkedIds.size === 0) return
    const ids = Array.from(checkedIds)
    const confirmText = t('audit_delete_selected_confirm').replace('{n}', String(ids.length))
    if (!window.confirm(confirmText)) return
    startDeleteTransition(async () => {
      const res = await deleteAuditLogEntries(ids)
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      const n = res.deletedCount
      if (n === 0) {
        toast.error(t('audit_delete_failed'))
        return
      }
      toast.success(t('audit_bulk_deleted_toast').replace('{n}', String(n)))
      setCheckedIds(new Set())
      await reloadLedger()
    })
  }

  if (busy) return <LoadingShell title={t('shell_loading')} />

  return (
    <div data-testid="audit-tab-root" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header / Filter Bar */}
      <div style={{ padding: '12px 28px', borderBottom: '1px solid var(--bd)', display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setView('ledger')} className="btn ghost sm" style={{ fontSize: 9, letterSpacing: 1, border: '1px solid var(--bd)', background: 'var(--bg1)' }} data-testid="audit-subtab-ledger">{t('audit_view_ledger')}</button>
          <button onClick={() => setView('pending')} className="btn ghost sm" style={{ fontSize: 9, letterSpacing: 1, opacity: 0.5 }} data-testid="audit-subtab-pending">{t('audit_view_pending')}</button>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
        {isAdmin && filtered.length > 0 ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto' }}>
            <button
              type="button"
              className="btn ghost sm"
              data-testid="audit-select-all"
              disabled={deletePending}
              onClick={toggleSelectAllFiltered}
              style={{ fontSize: 9, letterSpacing: 1 }}
            >
              {t('audit_select_all')}
            </button>
            {checkedIds.size > 0 ? (
              <>
                <button
                  type="button"
                  className="btn ghost sm"
                  disabled={deletePending}
                  onClick={() => setCheckedIds(new Set())}
                  style={{ fontSize: 9, letterSpacing: 1 }}
                >
                  {t('audit_clear_selection')}
                </button>
                <button
                  type="button"
                  className="btn sm"
                  data-testid="audit-delete-selected"
                  disabled={deletePending}
                  onClick={deleteChecked}
                  style={{ background: 'var(--rust)', borderColor: 'var(--rust)', fontSize: 9, letterSpacing: 1 }}
                >
                  {t('audit_delete_selected').replace('{n}', String(checkedIds.size))}
                </button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Ledger Table */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <table className="tbl" style={{ width: '100%' }}>
          <thead>
            <tr>
              {isAdmin ? <th style={{ width: 36 }} aria-label={t('audit_select_all')} /> : null}
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
                {isAdmin ? (
                  <td>
                    <input
                      type="checkbox"
                      data-testid={`audit-row-checkbox-${l.id}`}
                      checked={checkedIds.has(l.id)}
                      disabled={deletePending}
                      onChange={() => toggleRow(l.id)}
                      aria-label={t('audit_row_select_aria').replace('{id}', String(l.id))}
                      style={{ width: 16, height: 16, minWidth: 16, minHeight: 16 }}
                    />
                  </td>
                ) : null}
                <td className="t-mono-sm" style={{ opacity: 0.6 }}>
                  {new Date(l.created_at).toLocaleString(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
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
