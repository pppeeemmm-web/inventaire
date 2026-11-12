'use client'

// Constellation side panel: journal entries linked to the selected work (validated links).
// The canvas itself stays works-only; an entry opens on its day in the Journal.

import { useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { listJournalEntriesForWork, type WorkJournalEntry } from '@/app/atelier/(portal)/journal/entry-actions'

export function ConstellationJournalEntries({ oeuvreId }: { oeuvreId: number }) {
  const { t } = useI18n()
  const [entries, setEntries] = useState<WorkJournalEntry[] | null>(null)

  useEffect(() => {
    let alive = true
    setEntries(null)
    void listJournalEntriesForWork(oeuvreId).then((rows) => {
      if (alive) setEntries(rows)
    })
    return () => {
      alive = false
    }
  }, [oeuvreId])

  if (!entries || entries.length === 0) return null
  return (
    <div data-testid="constellation-journal-entries" style={{ marginTop: 12 }}>
      <div className="t-eyebrow" style={{ marginBottom: 6 }}>
        {t('je_const_heading')} ({entries.length})
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
        {entries.map((e) => (
          <a
            key={e.id}
            href={`/atelier/journal?day=${e.day}`}
            style={{ fontSize: 11, lineHeight: 1.35, color: 'var(--tx2)', textDecoration: 'none' }}
          >
            <span className="t-mono-sm" style={{ color: 'var(--ac)' }}>
              {e.day}
            </span>{' '}
            {e.snippet}
          </a>
        ))}
      </div>
    </div>
  )
}
