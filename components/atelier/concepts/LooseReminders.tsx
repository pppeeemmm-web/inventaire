'use client'

// « Rappels sans projet » on Idées (Pem 2026-11-18: « it can go in reminders but needs to be visible in
// Idées »). Admin only, folded by default: dated notes with no Pipeline project, each « En faire une idée »
// (dated on its reminder's day) or « Vu ». Nothing shows when there are none.

import { useEffect, useState, useTransition } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { toast } from '@/lib/ui/toast'
import { fetchLooseReminders, reminderToIdea, type ConceptRow, type LooseReminder } from '@/app/atelier/(portal)/concepts/actions'
import { markSuiviReminderRead } from '@/app/atelier/reminders-actions'

export function LooseReminders({ narrow, onIdea }: { narrow: boolean; onIdea: (c: ConceptRow) => void }) {
  const { t, lang } = useI18n()
  const [rows, setRows] = useState<LooseReminder[]>([])
  const [pending, start] = useTransition()

  useEffect(() => {
    let alive = true
    void fetchLooseReminders().then((r) => {
      if (alive) setRows(r)
    })
    return () => {
      alive = false
    }
  }, [])

  if (!rows.length) return null
  const day = (d: string) =>
    new Date(`${d}T12:00:00`).toLocaleDateString(lang === 'en' ? 'en-GB' : 'fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })

  const toIdea = (id: string) =>
    start(async () => {
      const res = await reminderToIdea(id)
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      setRows((p) => p.filter((r) => r.id !== id))
      onIdea(res.concept)
    })
  const seen = (id: string) =>
    start(async () => {
      const res = await markSuiviReminderRead(id)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      setRows((p) => p.filter((r) => r.id !== id))
    })

  return (
    <details data-testid="ideas-loose-reminders" style={{ marginBottom: 16, border: '1px solid var(--bd)', background: 'var(--bg1)' }}>
      <summary style={{ cursor: 'pointer', padding: '10px 12px', fontSize: 12, color: 'var(--tx2)', minHeight: 44, display: 'flex', alignItems: 'center' }}>
        {t('ideas_loose_title').replace('{n}', String(rows.length))}
      </summary>
      <div style={{ padding: '0 12px 12px' }}>
        <p style={{ margin: '0 0 8px', fontSize: 11, color: 'var(--tx3)' }}>{t('ideas_loose_hint')}</p>
        {rows.map((r) => (
          <div
            key={r.id}
            style={{
              display: 'flex', flexWrap: narrow ? 'wrap' : 'nowrap', alignItems: 'center', gap: 8,
              padding: '8px 0', borderTop: '1px solid var(--bg2)',
            }}
          >
            <span className="t-mono-sm" style={{ fontSize: 11, color: 'var(--tx3)', flex: 'none', minWidth: 84 }}>{day(r.remind_at)}</span>
            <span style={{ flex: 1, minWidth: 0, fontSize: 13, overflowWrap: 'anywhere' }}>{r.message}</span>
            <span style={{ display: 'flex', gap: 6, flex: 'none' }}>
              <button type="button" className="btn sm" disabled={pending} onClick={() => toIdea(r.id)} style={{ minHeight: 44 }}>
                {t('ideas_loose_to_idea')}
              </button>
              <button type="button" className="btn sm" disabled={pending} onClick={() => seen(r.id)} style={{ minHeight: 44 }}>
                {t('ideas_loose_seen')}
              </button>
            </span>
          </div>
        ))}
      </div>
    </details>
  )
}
