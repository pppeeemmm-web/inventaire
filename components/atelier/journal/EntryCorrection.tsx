'use client'

// « Corriger » a machine-made or imported Journal entry — one action instead of « vérifier » + « corriger »
// (Pem 2026-11-22: fewer equal buttons). The editor confirms the text as it is, or saves a correction:
// a new entry pointing at the original (append-only, `correctJournalEntry`); readers show it in place.
// Shared by the desk day page (JournalDayExtras) and the phone day tools (DayTools).
import { useState, useTransition } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { toast } from '@/lib/ui/toast'
import { MAIN_ACTION_STYLE } from '@/lib/ui/main-action'
import { isNothingHeard, isWaitingTranscript } from '@/lib/journal/nothing-heard'
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
  primary = false,
  label,
  startEmpty = false,
}: {
  entry: Pick<JournalDayEntry, 'id' | 'body' | 'verification' | 'original' | 'liveWords' | 'textId' | 'pcProposal'>
  onDone: () => void | Promise<void>
  /** The card's main action (Journal stream): drawn filled. */
  primary?: boolean
  /** Replaces the button's own label (e.g. from a « ⋯ » menu). */
  label?: string
  /** The editor opens empty (« Rien entendu »: there is no text to correct, only to write). */
  startEmpty?: boolean
}) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState(entry.body)
  const [pending, startTransition] = useTransition()
  // A placeholder is no text to confirm: « rien entendu » can only be written over; a note waiting for
  // the PC transcript offers nothing (confirming it would stop the PC from ever transcribing it).
  const nothing = isNothingHeard(entry)
  const unverified = entry.verification === 'unverified' && !nothing
  const changed = text.trim() !== '' && text.trim() !== entry.body.trim()

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

  if (isWaitingTranscript(entry)) return null

  if (!open) {
    return (
      <button
        type="button"
        className={primary ? 'btn primary sm' : 'btn ghost sm'}
        disabled={pending}
        onClick={() => { setText(startEmpty ? '' : entry.body); setOpen(true) }}
        style={{ minHeight: 44, ...(primary ? MAIN_ACTION_STYLE : {}) }}
        data-testid={`journal-entry-fix-${entry.id}`}
      >
        {label ?? t(unverified ? 'je_fix_open_unverified' : 'je_fix_open')}
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
      {entry.pcProposal ? (
        <div data-testid={`journal-entry-proposal-${entry.id}`} style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--tx2)', borderLeft: '2px solid var(--ac)', paddingLeft: 8 }}>
          <span style={{ color: 'var(--ac)' }}>{t('js_pc_proposes')}</span> « {entry.pcProposal.body} »{' '}
          <button type="button" className="btn ghost sm" disabled={pending} onClick={() => setText(entry.pcProposal?.body ?? '')} style={{ minHeight: 36 }}>
            {t('js_live_use')}
          </button>
          <button
            type="button"
            className="btn ghost sm"
            disabled={pending}
            data-testid={`journal-entry-keep-${entry.id}`}
            onClick={() => run(() => setJournalEntryVerified(entry.pcProposal?.id ?? 0, true), t('js_kept_mine'))}
            style={{ minHeight: 36 }}
          >
            {t('js_keep_mine')}
          </button>
        </div>
      ) : null}
      {entry.liveWords && entry.liveWords.trim() !== entry.body.trim() ? (
        <div data-testid={`journal-entry-live-${entry.id}`} style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--tx2)', borderLeft: '2px solid var(--bd2)', paddingLeft: 8 }}>
          <span style={{ color: 'var(--tx3)' }}>{t('js_live_words')}</span> « {entry.liveWords} »{' '}
          <button type="button" className="btn ghost sm" disabled={pending} onClick={() => setText(entry.liveWords ?? '')} style={{ minHeight: 36 }}>
            {t('js_live_use')}
          </button>
        </div>
      ) : null}
      <p className="t-mono-sm" style={{ margin: 0, fontSize: 11, color: 'var(--tx3)' }}>{t('je_fix_hint')}</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        {/* One main action, filled; the others quiet (ghost). */}
        {changed ? (
          <button type="button" className="btn sm" disabled={pending} onClick={() => run(async () => {
              const res = await correctJournalEntry(entry.id, text)
              // Taking (or rewriting) the PC's proposal settles it: it is not offered again.
              if (!('error' in res) && entry.pcProposal) await setJournalEntryVerified(entry.pcProposal.id, true)
              return res
            }, t('je_fix_done'))} style={{ minHeight: 44, ...MAIN_ACTION_STYLE }}>
            {t('je_fix_save')}
          </button>
        ) : unverified ? (
          <button type="button" className="btn sm" disabled={pending} onClick={() => run(() => setJournalEntryVerified(entry.textId ?? entry.id, true))} style={{ minHeight: 44, ...MAIN_ACTION_STYLE }}>
            {t('je_fix_ok')}
          </button>
        ) : null}
        <button type="button" className="btn ghost sm" disabled={pending} onClick={() => setOpen(false)} style={{ minHeight: 44 }}>
          {t('je_fix_cancel')}
        </button>
        {!unverified && !changed && !entry.original ? (
          <button type="button" className="btn ghost sm" disabled={pending} onClick={() => run(() => setJournalEntryVerified(entry.textId ?? entry.id, false))} style={{ minHeight: 44, marginLeft: 'auto', color: 'var(--tx3)' }}>
            {t('je_fix_unverify')}
          </button>
        ) : null}
      </div>
    </div>
  )
}

