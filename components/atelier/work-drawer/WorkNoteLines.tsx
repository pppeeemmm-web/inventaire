'use client'

// R1 step 6 slice 4b — a work's notes as separate lines (note_line, target 'work'), oldest first, each
// with author + date (docs/design/2026-11-17/R1_InputsFeed.notes.md, open question 3 « (a) »). Anyone
// on the team adds a line; it stands at once and reaches Pem's Fil. Team nudge: a line longer than one
// line of text offers « Une idée pour Pem ? » (flagged_for_pem → first in the Fil). A line Pem took out
// of the Fil comes back from RLS only to Pem and its author; it shows dimmed, marked « retirée du Fil ».

import { useEffect, useState } from 'react'
import { addWorkNoteLine, listWorkNoteLines, type WorkNoteLine } from '@/app/atelier/fil/note-lines-actions'
import { useI18n } from '@/lib/i18n/context'
import { toast } from '@/lib/ui/toast'
import { stringifyError } from '@/lib/error'
import { FIS } from './drawer-widgets'

/** « More than one line of text »: a line break, or longer than a phone line. */
const NUDGE_CHARS = 90
const isLong = (s: string) => s.includes('\n') || s.length > NUDGE_CHARS

export function WorkNoteLines({ oeuvreId, isAdmin, narrow }: { oeuvreId: number; isAdmin: boolean; narrow: boolean }) {
  const { t, lang } = useI18n()
  const dateLoc = lang === 'fr' ? 'fr-FR' : 'en-GB'
  const [lines, setLines] = useState<WorkNoteLine[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [draft, setDraft] = useState('')
  const [flag, setFlag] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLines(null)
    setFailed(false)
    void listWorkNoteLines(oeuvreId)
      .then((res) => {
        if (cancelled) return
        if ('error' in res) setFailed(true)
        else setLines(res.lines)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [oeuvreId])

  const text = draft.trim()
  const nudge = !isAdmin && isLong(text)

  async function add() {
    if (!text || busy) return
    setBusy(true)
    const res = await addWorkNoteLine(oeuvreId, text, nudge && flag)
    setBusy(false)
    if ('error' in res) {
      toast.error(t('nl_err').replace('{e}', stringifyError(res.error)))
      return
    }
    setDraft('')
    setFlag(false)
    setLines((prev) => [...(prev ?? []), res.line])
  }

  const tap = narrow ? 44 : 32

  return (
    <div data-testid="work-note-lines" style={{ marginTop: 8 }}>
      <div style={{ fontSize: 10, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--tx3)', fontWeight: 600, marginBottom: 4 }}>
        {t('nl_lines')}
        {lines?.length ? ` (${lines.length})` : ''}
      </div>

      {failed ? (
        <div style={{ fontSize: 11, color: 'var(--rust)', marginBottom: 6 }}>{t('nl_err_load')}</div>
      ) : !lines ? (
        <div style={{ fontSize: 11, color: 'var(--tx3)', marginBottom: 6 }}>{t('nl_loading')}</div>
      ) : lines.length === 0 ? (
        <div data-testid="work-note-lines-empty" style={{ fontSize: 11, color: 'var(--tx3)', marginBottom: 6 }}>{t('nl_empty')}</div>
      ) : (
        <ol style={{ listStyle: 'none', margin: '0 0 8px', padding: 0, borderTop: '1px solid var(--bd)' }}>
          {lines.map((l) => (
            <li key={l.id} data-testid="work-note-line" style={{ padding: '6px 0', borderBottom: '1px solid var(--bd)', opacity: l.discarded ? 0.5 : 1 }}>
              <div style={{ fontSize: 10, color: 'var(--tx3)', marginBottom: 2, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ color: 'var(--tx2)', fontWeight: 500 }}>{l.author ?? t('nl_team')}</span>
                <span>{new Date(l.createdAt).toLocaleDateString(dateLoc, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Paris' })}</span>
                {l.flagged && <span style={{ color: 'var(--ac)' }}>{t('nl_flagged')}</span>}
                {l.discarded && <span style={{ fontStyle: 'italic' }}>· {t('nl_discarded')}</span>}
              </div>
              <div style={{ fontSize: 12, color: 'var(--tx)', lineHeight: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{l.body}</div>
            </li>
          ))}
        </ol>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'stretch' }}>
        <textarea
          className="input"
          data-testid="work-note-line-input"
          aria-label={t('nl_add_ph')}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              void add()
            }
          }}
          rows={text ? 3 : 1}
          placeholder={t('nl_add_ph')}
          style={{ ...FIS, flex: '1 1 220px', minWidth: 0, minHeight: tap, resize: 'vertical', fontSize: 12, padding: 8 }}
        />
        <button
          type="button"
          className="btn sm"
          data-testid="work-note-line-add"
          disabled={busy || !text}
          onClick={() => void add()}
          style={{ minHeight: tap, flexShrink: 0 }}
        >
          {busy ? t('nl_adding') : t('nl_add')}
        </button>
      </div>

      {nudge && (
        <label
          data-testid="work-note-line-flag"
          title={t('nl_flag_hint')}
          style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: tap, fontSize: 12, color: flag ? 'var(--ac)' : 'var(--tx2)', cursor: 'pointer' }}
        >
          <input type="checkbox" checked={flag} onChange={(e) => setFlag(e.target.checked)} style={{ width: 18, height: 18 }} />
          {t('nl_flag')}
        </label>
      )}
      <div style={{ fontSize: 10, color: 'var(--tx3)', marginTop: 4 }}>{nudge ? t('nl_flag_hint') : t('nl_live_hint')}</div>
    </div>
  )
}
