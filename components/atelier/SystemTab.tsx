'use client'

import { useState, useEffect, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { vaultStudioBible } from '@/app/atelier/vault/bible-action'
import { exportSiteMapChecklistPdf } from '@/app/atelier/vault/actions'
import { stringifyError } from '@/lib/error'
import { useI18n } from '@/lib/i18n/context'

const TYPES   = ['suggestion', 'improvement', 'maintenance', 'backlog', 'bug'] as const
const STATUSES = ['active', 'requested', 'in-progress', 'completed', 'dismissed'] as const
const TYPE_LABELS: Record<string, string> = {
  suggestion: '💡 Suggestion', improvement: '✨ Improvement',
  maintenance: '🔧 Maintenance', backlog: '📅 Backlog', bug: '🐛 Bug Report',
}

function priorityColor(p: string | null | undefined) {
  if (p === 'P1') return '#e05252'
  if (p === 'P2') return '#d4843a'
  if (p === 'P4') return 'var(--tx3)'
  return 'var(--ac)'
}

function statusColor(s: string | null | undefined) {
  if (s === 'completed')  return 'var(--green)'
  if (s === 'dismissed')  return 'var(--tx3)'
  if (s === 'in-progress') return '#d4843a'
  return 'var(--ac)'
}

function nextStatus(s: string | null | undefined): string {
  const idx = STATUSES.indexOf((s ?? 'active') as any)
  return STATUSES[(idx + 1) % STATUSES.length]
}

interface LogEntry {
  id: number
  created_at: string
  type: string | null
  action: string
  details: string | null
  status: string | null
  priority: string | null
}

interface Draft {
  action: string
  details: string
  type: string
  status: string
  priority: string
}

const inputStyle: React.CSSProperties = {
  padding: '5px 8px', background: 'var(--bg0)', border: '1px solid var(--bd)',
  color: 'var(--tx)', fontSize: 11, width: '100%', boxSizing: 'border-box',
}

export function SystemTab() {
  const { t } = useI18n()
  const [logs, setLogs]         = useState<LogEntry[]>([])
  const [loading, setLoading]   = useState(true)
  const [busy, setBusy]         = useState(false)
  const [isPending, startTransition] = useTransition()
  const [checklistPending, startChecklist] = useTransition()

  // Add form
  const [action,   setAction]   = useState('')
  const [details,  setDetails]  = useState('')
  const [type,     setType]     = useState('maintenance')
  const [priority, setPriority] = useState('P3')

  // Edit state
  const [editingId, setEditingId] = useState<number | null>(null)
  const [draft,     setDraft]     = useState<Draft | null>(null)
  const [saveBusy,  setSaveBusy]  = useState(false)

  useEffect(() => { fetchLogs() }, [])

  async function fetchLogs() {
    const sb = createClient()
    const { data } = await sb.from('system_log').select('*').order('id', { ascending: false })
    setLogs(data ?? [])
    setLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!action) return
    setBusy(true)
    const sb = createClient()
    const status = type === 'suggestion' ? 'requested' : 'active'
    const { data } = await sb.from('system_log').insert([{
      action, details, type, status, priority,
    }]).select().single()
    if (data) { setLogs([data, ...logs]); setAction(''); setDetails(''); setPriority('P3') }
    setBusy(false)
  }

  function startEdit(log: LogEntry) {
    setEditingId(log.id)
    setDraft({
      action:   log.action,
      details:  log.details  ?? '',
      type:     log.type     ?? 'maintenance',
      status:   log.status   ?? 'active',
      priority: log.priority ?? 'P3',
    })
  }

  async function saveEdit(id: number) {
    if (!draft) return
    setSaveBusy(true)
    const sb = createClient()
    const { data } = await sb.from('system_log')
      .update({ action: draft.action, details: draft.details, type: draft.type, status: draft.status, priority: draft.priority })
      .eq('id', id).select().single()
    if (data) setLogs(logs.map(l => l.id === id ? data : l))
    setSaveBusy(false)
    setEditingId(null)
    setDraft(null)
  }

  async function cycleStatus(log: LogEntry) {
    const next = nextStatus(log.status)
    const sb = createClient()
    const { data } = await sb.from('system_log').update({ status: next }).eq('id', log.id).select().single()
    if (data) setLogs(logs.map(l => l.id === log.id ? data : l))
  }

  async function deleteLog(id: number) {
    if (!confirm('Delete this entry?')) return
    const sb = createClient()
    const { error } = await sb.from('system_log').delete().eq('id', id)
    if (!error) setLogs(logs.filter(l => l.id !== id))
  }

  function handleDownloadChecklist() {
    startChecklist(async () => {
      const res = await exportSiteMapChecklistPdf()
      if (!('ok' in res) || !res.ok) {
        const err = 'error' in res ? res.error : 'Unknown'
        alert(`${t('system_checklist_error_prefix')} ${stringifyError(err)}`)
        return
      }
      const bin = atob(res.base64)
      const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
      const blob = new Blob([bytes], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = res.filename
      a.click()
      URL.revokeObjectURL(url)
    })
  }

  function handleRegenerateBible() {
    if (!confirm('Regenerate and Vault the Studio Bible PDF?')) return
    startTransition(async () => {
      const res = await vaultStudioBible()
      if ('error' in res) {
        alert(`Error: ${stringifyError(res.error)}`)
      } else {
        alert(`Success! Studio Bible vaulted as: ${res.filename}`)
        const sb = createClient()
        await sb.from('system_log').insert([{
          action: 'Studio Bible Updated',
          details: `Regenerated high-fidelity PDF and vaulted as ${res.filename}`,
          type: 'improvement', status: 'completed', priority: 'P3',
        }])
        fetchLogs()
      }
    })
  }

  return (
    <div style={{ flex: 1, padding: '32px 40px', overflow: 'auto', background: 'var(--bg0)' }}>
      <div style={{ maxWidth: 960 }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
          <div>
            <h2 className="serif" style={{ fontSize: 32, marginBottom: 8 }}>System Ledger</h2>
            <p className="t-mono-sm" style={{ color: 'var(--tx3)' }}>Record maintenance, improvements, and suggestions for the studio system.</p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn ghost sm"
              onClick={handleDownloadChecklist}
              disabled={checklistPending}
              style={{ borderColor: 'var(--bd)', color: 'var(--tx2)' }}
            >
              {checklistPending ? t('system_checklist_building') : t('system_download_site_checklist')}
            </button>
            <button className="btn ghost sm" onClick={handleRegenerateBible} disabled={isPending}
              style={{ borderColor: 'var(--ac)', color: 'var(--ac)' }}>
              {isPending ? 'Regenerating...' : '✦ Regenerate Studio Bible'}
            </button>
          </div>
        </div>

        {/* Add form */}
        <form onSubmit={handleSubmit} style={{
          background: 'var(--bg1)', border: '1px solid var(--bd)',
          padding: 24, marginBottom: 40, display: 'flex', flexDirection: 'column', gap: 16,
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '80px 150px 1fr', gap: 12 }}>
            <select value={priority} onChange={e => setPriority(e.target.value)}
              style={{ ...inputStyle, border: `1px solid ${priorityColor(priority)}`, color: priorityColor(priority), fontWeight: 600 }}>
              <option value="P1">P1 — Critical</option>
              <option value="P2">P2 — High</option>
              <option value="P3">P3 — Normal</option>
              <option value="P4">P4 — Low</option>
            </select>
            <select value={type} onChange={e => setType(e.target.value)} style={inputStyle}>
              {TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
            </select>
            <input placeholder="What changed or needs fixing?"
              value={action} onChange={e => setAction(e.target.value)} style={inputStyle} />
          </div>
          <textarea placeholder="Additional details, technical notes, or observations..."
            value={details} onChange={e => setDetails(e.target.value)}
            style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button disabled={busy || !action} type="submit" className="btn primary sm">
              {busy ? 'Logging...' : '+ Add Entry'}
            </button>
          </div>
        </form>

        {/* Ledger table */}
        {loading ? (
          <div className="t-mono-sm" style={{ color: 'var(--tx3)' }}>Loading ledger...</div>
        ) : logs.length === 0 ? (
          <div className="t-mono-sm" style={{ color: 'var(--tx3)', opacity: 0.5 }}>No entries yet.</div>
        ) : (
          <div style={{ border: '1px solid var(--bd)' }}>
            {/* Column headers */}
            <div style={{
              display: 'grid', gridTemplateColumns: '44px 84px 110px 1fr 100px 88px',
              gap: 12, padding: '8px 16px',
              borderBottom: '1px solid var(--bd)', background: 'var(--bg1)',
            }}>
              {['Pri', 'Date', 'Type', 'Entry', 'Status', ''].map((h, i) => (
                <div key={i} style={{ fontSize: 8, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--tx3)' }}>{h}</div>
              ))}
            </div>

            {logs.map((log, idx) => {
              const isEditing = editingId === log.id

              return (
                <div key={log.id} style={{
                  borderBottom: idx === logs.length - 1 ? 'none' : '1px solid var(--bd2)',
                  background: isEditing ? 'var(--bg1)' : idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                }}>
                  {isEditing && draft ? (
                    /* ── Edit row ── */
                    <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '80px 150px 1fr', gap: 10 }}>
                        <select value={draft.priority} onChange={e => setDraft({ ...draft, priority: e.target.value })}
                          style={{ ...inputStyle, border: `1px solid ${priorityColor(draft.priority)}`, color: priorityColor(draft.priority), fontWeight: 600 }}>
                          <option value="P1">P1 — Critical</option>
                          <option value="P2">P2 — High</option>
                          <option value="P3">P3 — Normal</option>
                          <option value="P4">P4 — Low</option>
                        </select>
                        <select value={draft.type} onChange={e => setDraft({ ...draft, type: e.target.value })} style={inputStyle}>
                          {TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
                        </select>
                        <input value={draft.action} onChange={e => setDraft({ ...draft, action: e.target.value })} style={inputStyle} />
                      </div>
                      <textarea value={draft.details} onChange={e => setDraft({ ...draft, details: e.target.value })}
                        style={{ ...inputStyle, minHeight: 52, resize: 'vertical' }} />
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 8, letterSpacing: 1, color: 'var(--tx3)', textTransform: 'uppercase' }}>Status</span>
                        <select value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value })} style={{ ...inputStyle, width: 'auto' }}>
                          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <div style={{ flex: 1 }} />
                        <button type="button" onClick={() => { setEditingId(null); setDraft(null) }}
                          className="btn ghost sm" style={{ fontSize: 10 }}>Cancel</button>
                        <button type="button" onClick={() => saveEdit(log.id)} disabled={saveBusy || !draft.action}
                          className="btn primary sm" style={{ fontSize: 10 }}>
                          {saveBusy ? 'Saving…' : 'Save'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* ── View row ── */
                    <div style={{
                      display: 'grid', gridTemplateColumns: '44px 84px 110px 1fr 100px 88px',
                      gap: 12, padding: '13px 16px', alignItems: 'start',
                    }}>
                      <div style={{ fontWeight: 700, fontSize: 10, color: priorityColor(log.priority), letterSpacing: 0.5, paddingTop: 1 }}>
                        {log.priority ?? '—'}
                      </div>
                      <div className="t-mono-sm" style={{ color: 'var(--tx3)', fontSize: 9, paddingTop: 2 }}>
                        {new Date(log.created_at).toLocaleDateString()}
                      </div>
                      <div>
                        {log.type && (
                          <span style={{
                            fontSize: 8, textTransform: 'uppercase', color: 'var(--ac)',
                            letterSpacing: 1, border: '1px solid var(--ac)', padding: '1px 5px',
                          }}>{log.type}</span>
                        )}
                      </div>
                      <div>
                        <div className="t-mono" style={{ fontSize: 11, fontWeight: 600, color: 'var(--tx)' }}>{log.action}</div>
                        {log.details && <div style={{ fontSize: 10, color: 'var(--tx2)', marginTop: 4, lineHeight: 1.4 }}>{log.details}</div>}
                      </div>
                      <div>
                        <button onClick={() => cycleStatus(log)} title="Click to cycle status"
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                            fontSize: 8, textTransform: 'uppercase', letterSpacing: 1,
                            color: statusColor(log.status), fontFamily: 'inherit',
                          }}>
                          {log.status ?? 'active'} ↻
                        </button>
                      </div>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 1 }}>
                        <button onClick={() => startEdit(log)} title="Edit"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx3)', fontSize: 11, padding: '0 2px' }}>
                          ✎
                        </button>
                        <button onClick={() => deleteLog(log.id)} title="Delete"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx3)', fontSize: 13, padding: '0 2px', lineHeight: 1 }}>
                          ×
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
