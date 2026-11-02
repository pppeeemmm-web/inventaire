'use client'

// Voice notes routed to a concept, a work or a pipeline project (Notes → Trier).
// Renders nothing when no note is linked, so it can sit in any detail panel.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n/context'
import { listLinkedVoiceNotes, type LinkedVoiceNote } from '@/app/atelier/(portal)/notes/actions'

export function LinkedVoiceNotes({
  field,
  value,
}: {
  field: 'concept_id' | 'oeuvre_id' | 'process_id'
  value: string | number
}) {
  const { t, lang } = useI18n()
  const [rows, setRows] = useState<LinkedVoiceNote[]>([])

  useEffect(() => {
    let live = true
    void listLinkedVoiceNotes(field, value).then((r) => {
      if (live) setRows(r)
    })
    return () => {
      live = false
    }
  }, [field, value])

  if (rows.length === 0) return null
  const loc = lang === 'fr' ? 'fr-FR' : 'en-GB'

  return (
    <div data-testid={`linked-voice-notes-${field}`} style={{ marginTop: 12 }}>
      <div className="t-label" style={{ marginBottom: 6 }}>
        {t('linked_notes_title_fmt').replace('{n}', String(rows.length))}
      </div>
      {rows.map((n) => {
        const tx = (n.transcript ?? '').replace(/\s+/g, ' ').trim()
        return (
          <Link
            key={n.id}
            href={`/atelier/notes?note=${n.id}`}
            style={{
              display: 'block',
              padding: '6px 8px',
              borderLeft: '2px solid var(--bd)',
              marginBottom: 6,
              color: 'var(--tx)',
              textDecoration: 'none',
              fontSize: 12,
            }}
          >
            <span className="t-mono-sm" style={{ fontSize: 10, color: 'var(--tx3)' }}>
              {new Date(n.created_at).toLocaleDateString(loc)}
            </span>{' '}
            <strong style={{ fontWeight: 600 }}>{n.subject?.trim() || t('linked_notes_untitled')}</strong>
            {tx ? (
              <span style={{ display: 'block', color: 'var(--tx2)', lineHeight: 1.4 }}>
                {tx.length > 140 ? `${tx.slice(0, 140)}…` : tx}
              </span>
            ) : null}
          </Link>
        )
      })}
    </div>
  )
}
