'use client'

// R6 — « À préparer »: the event's dated steps (`suivi_etape`). A tick = one update of that step;
// name and date save on blur. The kind's template adds the missing steps in one insert.

import { useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import type { EventStep } from '@/app/atelier/(portal)/exhibitions/event-actions'
import { EVENT_KIND_LABEL, type EventKind } from '@/lib/events/event-model'
import { BlurField } from './BlurField'
import { fmtDay, todayIso } from './events-shared'

interface Props {
  steps: EventStep[]
  kind: EventKind
  narrow: boolean
  onToggle: (id: string, done: boolean) => void
  onPatch: (id: string, field: 'nom' | 'date_echeance', value: string | null) => Promise<string | null>
  onAdd: (nom: string) => Promise<string | null>
  onDelete: (id: string) => void
  onTemplate: () => Promise<string | null>
}

export function EventSteps({ steps, kind, narrow, onToggle, onPatch, onAdd, onDelete, onTemplate }: Props) {
  const { t, lang } = useI18n()
  const [adding, setAdding] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const today = todayIso()
  const sorted = [...steps].sort((a, b) => (a.date_echeance ?? '9999').localeCompare(b.date_echeance ?? '9999') || a.position - b.position)

  async function run(fn: () => Promise<string | null>) {
    setBusy(true); const e = await fn(); setBusy(false); setErr(e)
  }

  return (
    <div>
      {steps.length === 0 && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'var(--tx3)' }}>{t('ev_steps_none')}</span>
          <button type="button" className="btn sm" disabled={busy} onClick={() => void run(onTemplate)} style={{ minHeight: narrow ? 44 : 32 }}>
            {t('ev_steps_template_fmt').replace('{kind}', t(EVENT_KIND_LABEL[kind]))}
          </button>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: narrow ? '1fr' : '1fr 1fr', columnGap: 24 }}>
        {sorted.map((s) => {
          const done = s.statut === 'fait'
          const late = !done && !!s.date_echeance && s.date_echeance < today
          return (
            <div key={s.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '4px 0', borderBottom: '1px solid var(--bg2)', minHeight: narrow ? 52 : 40 }}>
              <button
                type="button" aria-pressed={done} aria-label={`${t('ev_step_done')} — ${s.nom}`}
                onClick={() => onToggle(s.id, !done)}
                style={{
                  width: narrow ? 44 : 28, height: narrow ? 44 : 28, flexShrink: 0, borderRadius: '50%', cursor: 'pointer',
                  border: `1px solid ${done ? '#4caf82' : late ? 'var(--rust)' : 'var(--bd)'}`,
                  background: done ? '#4caf8222' : 'transparent', color: '#4caf82', fontSize: 13,
                }}
              >{done ? '✓' : ''}</button>
              <div style={{ flex: 1, minWidth: 0, textDecoration: done ? 'line-through' : 'none', opacity: done ? 0.7 : 1 }}>
                <BlurField value={s.nom} ariaLabel={t('ev_step_name')} onSave={(v) => onPatch(s.id, 'nom', v)} style={{ border: '1px solid transparent', background: 'transparent', padding: '2px 4px', minHeight: 28 }} />
              </div>
              <div style={{ width: narrow ? 140 : 132, flexShrink: 0 }}>
                <BlurField type="date" value={s.date_echeance} ariaLabel={t('ev_step_date')} onSave={(v) => onPatch(s.id, 'date_echeance', v)}
                  style={{ fontSize: 12, padding: '2px 4px', minHeight: 28, color: late ? 'var(--rust)' : 'var(--tx2)' }} />
                {late && <span style={{ fontSize: 10, color: 'var(--rust)' }}>{t('ev_step_late_fmt').replace('{date}', fmtDay(s.date_echeance, lang))}</span>}
              </div>
              <button type="button" className="btn ghost sm" aria-label={`${t('ev_step_delete')} — ${s.nom}`} title={t('ev_step_delete')}
                onClick={() => { if (confirm(t('exhib_step_delete_confirm'))) onDelete(s.id) }}
                style={{ minHeight: narrow ? 44 : 28, minWidth: narrow ? 44 : 28, padding: 0 }}>×</button>
            </div>
          )
        })}
      </div>
      <form
        onSubmit={(e) => { e.preventDefault(); const n = adding.trim(); if (!n) return; void run(async () => { const r = await onAdd(n); if (!r) setAdding(''); return r }) }}
        style={{ display: 'flex', gap: 6, marginTop: 8 }}
      >
        <input className="input" aria-label={t('ev_step_add')} placeholder={t('ev_step_add')} value={adding} onChange={(e) => setAdding(e.target.value)} style={{ flex: 1, minHeight: narrow ? 44 : 32, fontSize: 12 }} />
        <button type="submit" className="btn sm" disabled={busy || !adding.trim()} style={{ minHeight: narrow ? 44 : 32 }}>{t('ev_step_add_do')}</button>
      </form>
      {err && <div role="alert" style={{ fontSize: 12, color: 'var(--rust)', marginTop: 4 }}>{err}</div>}
    </div>
  )
}
