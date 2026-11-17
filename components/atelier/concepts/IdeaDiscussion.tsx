'use client'

// R1 Idées: an idea's discussion — note_line rows (target 'idea'), oldest first, author + date.
// Anyone on the team adds a line (live at once, reaches Pem's Fil as one card per idea). Pem can
// close it: still readable, no new lines (RLS refuses them too). A line Pem took out of the Fil is
// returned by RLS only to Pem and its author; it shows dimmed, marked « retirée du Fil ».

import { useState } from 'react'
import { addIdeaLine, setIdeaDiscussionClosed, type IdeaLine } from '@/app/atelier/(portal)/concepts/actions'
import { useI18n } from '@/lib/i18n/context'
import { toast } from '@/lib/ui/toast'
import { stringifyError } from '@/lib/error'
import { inputSt, labelSt } from './concept-form-styles'

export function IdeaDiscussion({
  conceptId,
  lines,
  closedAt,
  isAdmin,
  onLineAdded,
  onClosedChange,
}: {
  conceptId: string
  lines: IdeaLine[]
  closedAt: string | null
  isAdmin: boolean
  onLineAdded: (line: IdeaLine) => void
  onClosedChange: (closedAt: string | null) => void
}) {
  const { t, lang } = useI18n()
  const dateLoc = lang === 'fr' ? 'fr-FR' : 'en-GB'
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)

  function errText(e: string) {
    if (e === 'closed') return t('ideas_err_closed')
    if (e === 'admin') return t('ideas_admin_only')
    return t('ideas_err').replace('{e}', stringifyError(e))
  }

  async function add() {
    const body = draft.trim()
    if (!body) return
    setBusy(true)
    const res = await addIdeaLine(conceptId, body)
    setBusy(false)
    if ('error' in res) {
      toast.error(errText(res.error))
      return
    }
    setDraft('')
    onLineAdded(res.line)
  }

  async function toggleClosed() {
    setBusy(true)
    const res = await setIdeaDiscussionClosed(conceptId, !closedAt)
    setBusy(false)
    if ('error' in res) {
      toast.error(errText(res.error))
      return
    }
    onClosedChange(res.closedAt)
  }

  return (
    <section data-testid="idea-discussion" aria-label={t('ideas_discussion')} style={{ marginBottom: 12 }}>
      <div style={labelSt}>
        {t('ideas_discussion')}
        {lines.length ? ` (${lines.length})` : ''}
      </div>

      {lines.length === 0 ? (
        <div style={{ fontSize: 10, color: 'var(--tx3)', marginBottom: 8 }}>{t('ideas_discussion_empty')}</div>
      ) : (
        <ol style={{ listStyle: 'none', margin: '0 0 8px', padding: 0, borderTop: '1px solid var(--bd)' }}>
          {lines.map((l) => (
            <li
              key={l.id}
              data-testid="idea-line"
              style={{ padding: '6px 0', borderBottom: '1px solid var(--bd)', opacity: l.discarded ? 0.5 : 1 }}
            >
              <div style={{ fontSize: 9, color: 'var(--tx3)', marginBottom: 2, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ color: 'var(--tx2)', fontWeight: 500 }}>{l.author ?? t('ideas_line_team')}</span>
                <span>{new Date(l.createdAt).toLocaleDateString(dateLoc, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                {l.discarded && <span style={{ fontStyle: 'italic' }}>· {t('ideas_line_discarded')}</span>}
              </div>
              <div style={{ fontSize: 11, color: 'var(--tx)', lineHeight: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{l.body}</div>
            </li>
          ))}
        </ol>
      )}

      {closedAt ? (
        <div data-testid="idea-discussion-closed" style={{ fontSize: 10, color: 'var(--tx3)', marginBottom: 8 }}>{t('ideas_closed')}</div>
      ) : (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'stretch', marginBottom: 8 }}>
          <textarea
            data-testid="idea-line-input"
            aria-label={t('ideas_line_ph')}
            style={{ ...inputSt, flex: '1 1 220px', minWidth: 0, minHeight: 44, height: 44, resize: 'vertical' }}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t('ideas_line_ph')}
          />
          <button
            type="button"
            className="btn sm"
            data-testid="idea-line-add"
            style={{ minHeight: 44, flexShrink: 0 }}
            disabled={busy || !draft.trim()}
            onClick={() => void add()}
          >
            {busy ? t('ideas_line_adding') : t('ideas_line_add')}
          </button>
        </div>
      )}

      {isAdmin && (
        <button
          type="button"
          className="btn ghost sm"
          data-testid="idea-discussion-toggle"
          style={{ minHeight: 44 }}
          disabled={busy}
          onClick={() => void toggleClosed()}
        >
          {closedAt ? t('ideas_reopen') : t('ideas_close')}
        </button>
      )}
    </section>
  )
}
