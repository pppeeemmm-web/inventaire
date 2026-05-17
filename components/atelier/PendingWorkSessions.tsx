'use client'

import { useEffect, useState, useTransition } from 'react'
import { useI18n } from '@/lib/i18n/context'
import {
  applyWorkSessionToOeuvre,
  listWorkSessionsForAdminReview,
  rejectWorkSession,
  type WorkSessionQueueRow,
} from '@/app/atelier/session/actions'

export function PendingWorkSessions() {
  const { t, lang } = useI18n()
  const [rows, setRows] = useState<WorkSessionQueueRow[]>([])
  const [busy, setBusy] = useState(true)
  const [pending, startTransition] = useTransition()
  const locale = lang === 'fr' ? 'fr-FR' : 'en-GB'

  function reload() {
    setBusy(true)
    void listWorkSessionsForAdminReview().then((data) => {
      setRows(data)
      setBusy(false)
    })
  }

  useEffect(() => {
    reload()
  }, [])

  function handleApply(id: string) {
    if (!confirm(t('pending_sessions_apply_confirm'))) return
    startTransition(async () => {
      const r = await applyWorkSessionToOeuvre(id)
      if ('error' in r) alert(r.error)
      reload()
    })
  }

  function handleReject(id: string) {
    const reason = window.prompt(t('session_reject_prompt'), '')
    if (reason === null) return
    startTransition(async () => {
      const r = await rejectWorkSession(id, reason || '—')
      if ('error' in r) alert(r.error)
      reload()
    })
  }

  if (busy) {
    return (
      <div style={{ padding: '16px 28px', opacity: 0.5 }} className="t-mono-sm">
        {t('pending_sessions_loading')}
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div style={{ padding: '16px 28px', opacity: 0.5 }} className="t-mono-sm">
        {t('pending_sessions_empty')}
      </div>
    )
  }

  return (
    <div data-testid="pending-work-sessions" style={{ display: 'flex', flexDirection: 'column', borderTop: '1px solid var(--bd)' }}>
      <div style={{ padding: '12px 28px' }}>
        <div className="t-eyebrow" style={{ fontSize: 10 }}>
          {t('pending_sessions_title')} · {rows.length}
        </div>
        <p className="t-mono-sm" style={{ fontSize: 11, color: 'var(--tx2)', margin: '8px 0 0', lineHeight: 1.45 }}>
          {t('pending_sessions_intro')}
        </p>
      </div>
      <div style={{ maxHeight: 360, overflow: 'auto' }}>
        {rows.map((row) => (
          <div key={row.id} style={{ borderBottom: '1px solid var(--bd)', padding: '12px 28px' }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--tx)' }}>
                {row.item_count} {t('session_journal_items_count')} · {row.oeuvre_title || '—'}
              </div>
              <div style={{ fontSize: 10, color: 'var(--tx3)', marginTop: 2 }}>
                {row.author_email || row.user_id.slice(0, 8)} ·{' '}
                {new Date(row.updated_at).toLocaleString(locale)} · {row.shot_count}{' '}
                {t('pending_sessions_shots')} ·{' '}
                {row.status === 'pending_review'
                  ? t('session_status_pending_review')
                  : t('session_status_draft')}
              </div>
              {row.journal_notes ? (
                <div style={{ fontSize: 10, color: 'var(--tx2)', marginTop: 6, lineHeight: 1.4 }}>
                  {row.journal_notes}
                </div>
              ) : null}
              {row.item_summaries.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 8 }}>
                  {row.item_summaries.map((item, idx) => (
                    <div key={item.id} style={{ fontSize: 10, color: 'var(--tx3)' }}>
                      {t('session_painting_label')} {idx + 1}: {item.oeuvre_id ? `#${item.oeuvre_id}` : item.title_hint || '—'} ·{' '}
                      {item.shot_count + item.applied_shot_count} {t('drawer_work_sessions_shots')} · {t(item.status === 'applied' ? 'session_status_applied' : 'session_status_draft')}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn primary sm"
                data-testid={`pending-session-apply-${row.id.slice(0, 8)}`}
                disabled={pending}
                onClick={() => handleApply(row.id)}
              >
                {t('session_admin_apply')}
              </button>
              {row.status === 'pending_review' ? (
                <button
                  type="button"
                  className="btn ghost sm"
                  disabled={pending}
                  onClick={() => handleReject(row.id)}
                >
                  {t('session_admin_reject')}
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
