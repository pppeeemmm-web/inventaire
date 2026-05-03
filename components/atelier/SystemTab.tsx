'use client'

import { useState, useEffect, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { vaultStudioBible } from '@/app/atelier/vault/bible-action'
import { stringifyError } from '@/lib/error'

interface LogEntry {
  id: number
  created_at: string
  type: string
  label: string
  details: string
  status: string
}

export function SystemTab() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [isPending, startTransition] = useTransition()
  
  // Form state
  const [label, setLabel] = useState('')
  const [details, setDetails] = useState('')
  const [type, setType] = useState('maintenance')

  useEffect(() => {
    fetchLogs()
  }, [])

  async function fetchLogs() {
    const sb = createClient()
    const { data } = await sb.from('system_log').select('*').order('id', { ascending: false })
    setLogs(data ?? [])
    setLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!label) return
    setBusy(true)
    const sb = createClient()
    const status = type === 'suggestion' ? 'requested' : 'active'
    const { data, error } = await sb.from('system_log').insert([{
      label, details, type, status
    }]).select().single()
    
    if (data) {
      setLogs([data, ...logs])
      setLabel('')
      setDetails('')
    }
    setBusy(false)
  }

  function handleRegenerateBible() {
    if (!confirm('Regenerate and Vault the Studio Bible PDF?')) return
    startTransition(async () => {
      const res = await vaultStudioBible()
      if ('error' in res) {
        alert(`Error: ${stringifyError(res.error)}`)
      } else {
        alert(`Success! Studio Bible vaulted as: ${res.filename}`)
        // Add a log entry for the update
        const sb = createClient()
        await sb.from('system_log').insert([{
          label: 'Studio Bible Updated',
          details: `Regenerated high-fidelity PDF and vaulted as ${res.filename}`,
          type: 'improvement',
          status: 'completed'
        }])
        fetchLogs()
      }
    })
  }

  return (
    <div style={{ flex: 1, padding: '32px 40px', overflow: 'auto', background: 'var(--bg0)' }}>
      <div style={{ maxWidth: 900 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
          <div>
            <h2 className="serif" style={{ fontSize: 32, marginBottom: 8 }}>System Ledger & Suggestions</h2>
            <p className="t-mono-sm" style={{ color: 'var(--tx3)' }}>Record maintenance, log improvements, or suggest new features for the studio system.</p>
          </div>
          <button 
            className="btn ghost sm" 
            onClick={handleRegenerateBible}
            disabled={isPending}
            style={{ borderColor: 'var(--ac)', color: 'var(--ac)' }}
          >
            {isPending ? 'Regenerating...' : '✦ Regenerate Studio Bible'}
          </button>
        </div>
        
        {/* Input Form */}
        <form onSubmit={handleSubmit} style={{ 
          background: 'var(--bg1)', border: '1px solid var(--bd)', 
          padding: 24, marginBottom: 40, display: 'flex', flexDirection: 'column', gap: 16 
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 16 }}>
            <select value={type} onChange={e => setType(e.target.value)} 
              style={{ padding: '8px', background: 'var(--bg0)', border: '1px solid var(--bd)', color: 'var(--tx)', fontSize: 11 }}>
              <option value="suggestion">💡 Suggestion</option>
              <option value="improvement">✨ Improvement</option>
              <option value="maintenance">🔧 Maintenance</option>
              <option value="backlog">📅 Backlog</option>
              <option value="bug">🐛 Bug Report</option>
            </select>
            <input 
              placeholder="What changed or needs fixing?" 
              value={label} 
              onChange={e => setLabel(e.target.value)}
              style={{ padding: '8px 12px', background: 'var(--bg0)', border: '1px solid var(--bd)', color: 'var(--tx)', fontSize: 12 }}
            />
          </div>
          <textarea 
            placeholder="Additional details, technical notes, or observations..." 
            value={details}
            onChange={e => setDetails(e.target.value)}
            style={{ padding: '10px 12px', background: 'var(--bg0)', border: '1px solid var(--bd)', color: 'var(--tx)', fontSize: 11, minHeight: 60, resize: 'vertical' }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
             <button disabled={busy || !label} type="submit" className="btn primary sm">
               {busy ? 'Logging...' : 'Add Log Entry'}
             </button>
          </div>
        </form>

        {loading ? (
          <div className="t-mono-sm">Loading ledger...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid var(--bd)' }}>
            {logs.map((log, idx) => (
              <div key={log.id} style={{ 
                display: 'grid', gridTemplateColumns: '100px 100px 1fr 100px', 
                gap: 20, padding: '14px 20px', 
                borderBottom: idx === logs.length - 1 ? 'none' : '1px solid var(--bd2)',
                background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                alignItems: 'start'
              }}>
                <div className="t-mono-sm" style={{ color: 'var(--tx3)', fontSize: 9 }}>
                  {new Date(log.created_at).toLocaleDateString()}
                </div>
                <div>
                   <span style={{ 
                     fontSize: 8, textTransform: 'uppercase', color: 'var(--ac)', 
                     letterSpacing: 1, border: '1px solid var(--ac)', padding: '1px 5px' 
                   }}>{log.type}</span>
                </div>
                <div>
                  <div className="t-mono" style={{ fontSize: 11, fontWeight: 600, color: 'var(--tx)' }}>{log.label}</div>
                  {log.details && <div style={{ fontSize: 10, color: 'var(--tx2)', marginTop: 4, lineHeight: 1.4 }}>{log.details}</div>}
                </div>
                <div style={{ textAlign: 'right' }}>
                   <span style={{ 
                     fontSize: 8, textTransform: 'uppercase', 
                     color: log.status === 'completed' ? 'var(--green)' : 'var(--ac)', 
                     letterSpacing: 1 
                   }}>{log.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
