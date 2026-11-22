'use client'

// « Corriger » a machine-made or imported Journal entry — one action instead of « vérifier » + « corriger »
// (Pem 2026-11-22: fewer equal buttons). The editor confirms the text as it is, or saves a correction:
// a new entry pointing at the original (append-only, `correctJournalEntry`); readers show it in place.
// Shared by the desk day page (JournalDayExtras) and the phone day tools (DayTools).
import { useState, useTransition } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { toast } from '@/lib/ui/toast'
import {
  correctJournalEntry,
  setJournalEntryVerified,
  type JournalDayEntry,
} from '@/app/atelier/(portal)/journal/entry-actions'

/** Entries « Corriger » applies to: not typed by a person (voice, photo, import, AI). */
export function canCorrectEntry(e: Pick<JournalDayEntry, 'provenance'>): boolean {
  return e.provenance !== 'typed'
}

/** The admin action and its inline editor. */
export function EntryCorrectAction({
  entry,
  onDone,
}: {
  entry: Pick<JournalDayEntry, 'id' | 'body' | 'verification' | 'original'>
  onDone: () => void | Promise<void>
}) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState(entry.body)
  const [pending, startTransition] = useTransition()
  const unverified = entry.verification === 'unverified'
  const changed = text.trim() !== entry.body.trim()

  function run(fn: () => Promise<{ ok: true } | { error: string }>, done?: string) {
    startTransition(async () => {
      const res = await fn()
      if ('error' in res) {
        toast.error(t('je_err_fmt').replace('{msg}', res.error))
        return
      }
      if (done) toast.success(done)
      setOpen(false)
      await onDone()
    })
  }

  if (!open) {
    return (
      <button
        type="button"
        className="btn ghost sm"
        disabled={pending}
        onClick={() => { setText(entry.body); setOpen(true) }}
        style={{ minHeight: 44 }}
        data-testid={`journal-entry-fix-${entry.id}`}
      >
        {t(unverified ? 'je_fix_open_unverified' : 'je_fix_open')}
      </button>
    )
  }

  return (
    <div data-testid={`journal-entry-fix-editor-${entry.id}`} style={{ flexBasis: '100%', display: 'grid', gap: 8 }}>
      <textarea
        value={text}
        onChange={(ev) => setText(ev.target.value)}
        rows={Math.min(14, Math.max(4, Math.ceil(text.length / 70)))}
        style={{ width: '100%', boxSizing: 'border-box', fontSize: 15, lineHeight: 1.5, padding: 10 }}
        autoFocus
      />
      <p className="t-mono-sm" style={{ margin: 0, fontSize: 11, color: 'var(--tx3)' }}>{t('je_fix_hint')}</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        {/* One main action, filled; the others quiet (ghost). */}
        {changed ? (
          <button type="button" className="btn sm" disabled={pending} onClick={() => run(() => correctJournalEntry(entry.id, text), t('je_fix_done'))} style={{ minHeight: 44 }}>
            {t('je_fix_save')}
          </button>
        ) : unverified ? (
          <button type="button" className="btn sm" disabled={pending} onClick={() => run(() => setJournalEntryVerified(entry.id, true))} style={{ minHeight: 44 }}>
            {t('je_fix_ok')}
          </button>
        ) : null}
        <button type="button" className="btn ghost sm" disabled={pending} onClick={() => setOpen(false)} style={{ minHeight: 44 }}>
          {t('je_fix_cancel')}
        </button>
        {!unverified && !changed && !entry.original ? (
          <button type="button" className="btn ghost sm" disabled={pending} onClick={() => run(() => setJournalEntryVerified(entry.id, false))} style={{ minHeight: 44, marginLeft: 'auto', color: 'var(--tx3)' }}>
            {t('je_fix_unverify')}
          </button>
        ) : null}
      </div>
    </div>
  )
}

