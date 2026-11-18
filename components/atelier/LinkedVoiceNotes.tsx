'use client'

// Voice notes routed to a concept, a work or a pipeline project (Notes → Trier).
// Renders nothing when no note is linked, so it can sit in any detail panel.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n/context'
import { WorkRefText } from '@/components/atelier/journal/WorkRefText'
import { listLinkedVoiceNotes, type LinkedVoiceNote } from '@/app/atelier/(portal)/notes/actions'
import { openReadOr } from '@/lib/atelier/open-reads'
import { linkedVoiceNotesKey } from '@/lib/atelier/open-read-keys'

export function LinkedVoiceNotes({
  field,
  value,
  card = false,
  onCount,
}: {
  field: 'concept_id' | 'oeuvre_id' | 'process_id'
  value: string | number
  /** Work card R3: no heading; each note = a cyan « ● note vocale date » chip + its transcript. */
  card?: boolean
  /** How many notes are linked (the card's Création summary). */
  onCount?: (n: number) => void
}) {
  const { t, lang } = useI18n()
  const [rows, setRows] = useState<LinkedVoiceNote[]>([])

  useEffect(() => {
    let live = true
    void openReadOr(linkedVoiceNotesKey(field, value), () => listLinkedVoiceNotes(field, value)).then((r) => {
      if (live) {
        setRows(r)
        onCount?.(r.length)
      }
    })
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onCount is a state setter from the parent
  }, [field, value])

  if (rows.length === 0) return null
  const loc = lang === 'fr' ? 'fr-FR' : 'en-GB'

  return (
    <div data-testid={`linked-voice-notes-${field}`} style={{ marginTop: card ? 6 : 12 }}>
      {card ? null : (
        <div className="t-label" style={{ marginBottom: 6 }}>
          {t('linked_notes_title_fmt').replace('{n}', String(rows.length))}
        </div>
      )}
      {rows.map((n) => {
        const tx = (n.transcript ?? '').replace(/\s+/g, ' ').trim()
        // The heading opens the note's Journal day; the text sits outside that link so a `#1234` in it is
        // its own work link with its preview (R4; no link inside a link).
        return (
          <div
            key={n.id}
            style={{
              padding: '6px 8px',
              borderLeft: '2px solid var(--bd)',
              marginBottom: 6,
              fontSize: 12,
            }}
          >
            <Link href={`/atelier/notes?note=${n.id}`} style={{ color: 'var(--tx)', textDecoration: 'none' }}>
              {card ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--cyan)', border: '1px solid color-mix(in srgb, var(--cyan) 40%, transparent)', borderRadius: 999, padding: '1px 7px', marginRight: 6 }}>
                  ● {t('wc_voice_note_fmt').replace('{date}', new Date(n.created_at).toLocaleDateString(loc, { day: 'numeric', month: 'short' }))}
                </span>
              ) : (
                <span className="t-mono-sm" style={{ fontSize: 10, color: 'var(--tx3)' }}>
                  {new Date(n.created_at).toLocaleDateString(loc)}
                </span>
              )}{' '}
              <strong style={{ fontWeight: 600 }}>{n.subject?.trim() || t('linked_notes_untitled')}</strong>
            </Link>
            {tx ? (
              <span style={{ display: 'block', color: 'var(--tx2)', lineHeight: 1.4, overflowWrap: 'anywhere' }}>
                <WorkRefText text={tx.length > 140 ? `${tx.slice(0, 140)}…` : tx} />
              </span>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
