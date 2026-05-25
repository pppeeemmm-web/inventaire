'use client'

import { useState, useEffect, useTransition } from 'react'
import { useI18n } from '@/lib/i18n/context'
import {
  listPendingChanges,
  approvePendingChange,
  rejectPendingChange,
  type PendingChange,
} from '@/app/atelier/(portal)/audit/pending-actions'

function diffEntries(baseline: Record<string, unknown> | null, payload: Record<string, string>) {
  if (!baseline) return Object.entries(payload).filter(([k]) => !k.startsWith('__'))
  const out: Array<[string, unknown, string]> = []
  for (const [k, v] of Object.entries(payload)) {
    if (k.startsWith('__') || k === 'oeuvre_id') continue
    const oldRaw = (baseline as Record<string, unknown>)[k]
    const oldStr = oldRaw == null ? '' : String(oldRaw)
    if (oldStr !== v) out.push([k, oldRaw, v])
  }
  return out
}

export function PendingQueue() {
  const { t } = useI18n()
  const [rows, setRows] = useState<PendingChange[]>([])
  const [busy, setBusy] = useState(true)
  const [pending, startTransition] = useTransition()
  const [openId, setOpenId] = useState<number | null>(null)
  const [rejectFor, setRejectFor] = useState<number | null>(null)
  const [reason, setReason] = useState('')

  function reload() {
    setBusy(true)
    listPendingChanges().then((data) => {
      setRows(data)
      setBusy(false)
    })
  }

  useEffect(() => { reload() }, [])

  function handleApprove(id: number) {
    if (!confirm(t('pending_confirm_approve'))) return
    startTransition(async () => {
      const r = await approvePendingChange(id)
      if ('error' in r) alert(r.error)
      reload()
    })
  }

  function handleReject(id: number) {
    startTransition(async () => {
      const r = await rejectPendingChange(id, reason.trim())
      if ('error' in r) alert(r.error)
      setRejectFor(null)
      setReason('')
      reload()
    })
  }

  if (busy) return <div style={{ padding: 40, opacity: 0.5 }} className="t-mono-sm">{t('pending_loading')}</div>

  if (rows.length === 0) {
    return <div style={{ padding: 40, opacity: 0.5 }} className="t-mono-sm">{t('pending_empty')}</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '12px 28px', borderBottom: '1px solid var(--bd)' }}>
        <div className="t-eyebrow" style={{ fontSize: 10 }}>{t('pending_queue_title')} · {rows.length}</div>
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {rows.map((r) => {
          const open = openId === r.id
          const changes = diffEntries(r.baseline, r.payload)
          return (
            <div key={r.id} style={{ borderBottom: '1px solid var(--bd)', padding: '12px 28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <button
                  className="btn ghost sm"
                  style={{ minWidth: 24 }}
                  onClick={() => setOpenId(open ? null : r.id)}
                >{open ? '▾' : '▸'}</button>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: 'var(--tx)' }}>
                    {r.change_kind === 'create'
                      ? `${t('pending_kind_create')}: ${r.oeuvre_title || '—'}`
                      : `#${r.oeuvre_id} · ${r.oeuvre_title || '—'}`}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--tx3)', marginTop: 2 }}>
                    {r.author_email || r.author_id || '—'} · {new Date(r.created_at).toLocaleString('fr-FR')}
                    {' · '}{changes.length} {t('pending_changes_count')}
                  </div>
                </div>
                <button
                  className="btn primary sm"
                  disabled={pending}
                  onClick={() => handleApprove(r.id)}
                >{t('pending_approve')}</button>
                <button
                  className="btn ghost sm"
                  disabled={pending}
                  onClick={() => setRejectFor(rejectFor === r.id ? null : r.id)}
                >{t('pending_reject')}</button>
              </div>

              {rejectFor === r.id && (
                <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                  <input
                    className="inp"
                    style={{ flex: 1 }}
                    placeholder={t('pending_reject_reason_placeholder')}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                  <button
                    className="btn sm"
                    disabled={pending}
                    onClick={() => handleReject(r.id)}
                  >{t('pending_confirm_reject')}</button>
                </div>
              )}

              {open && (
                <table className="tbl" style={{ width: '100%', marginTop: 10, fontSize: 11 }}>
                  <thead>
                    <tr>
                      <th style={{ width: 180 }}>{t('pending_field')}</th>
                      <th>{t('pending_before')}</th>
                      <th>{t('pending_after')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {changes.map(([k, before, after]) => (
                      <tr key={k}>
                        <td style={{ fontFamily: 'var(--mono)', color: 'var(--tx2)' }}>{k}</td>
                        <td style={{ color: 'var(--tx3)' }}>{before == null ? '—' : String(before)}</td>
                        <td style={{ color: 'var(--ac)' }}>{after}</td>
                      </tr>
                    ))}
                    {changes.length === 0 && (
                      <tr><td colSpan={3} style={{ opacity: 0.5 }}>{t('pending_no_changes')}</td></tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
