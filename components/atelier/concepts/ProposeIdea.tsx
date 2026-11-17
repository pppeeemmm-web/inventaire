'use client'

// R1 « Proposer une idée » — the team's one creative entry: one text, optionally a work #id.
// Inserts a note_line (target 'proposal'); it goes straight into Pem's Fil (Création), accepted
// by default. No photo: the only existing image path (concept sketches) is tied to
// concept.image_note, so a proposal photo would need its own storage key rule first.

import { useState } from 'react'
import { proposeIdea } from '@/app/atelier/(portal)/concepts/actions'
import { useI18n } from '@/lib/i18n/context'
import { toast } from '@/lib/ui/toast'
import { stringifyError } from '@/lib/error'
import { inputSt, labelSt } from './concept-form-styles'

export function ProposeIdea({ narrow }: { narrow: boolean }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [body, setBody] = useState('')
  const [work, setWork] = useState('')
  const [busy, setBusy] = useState(false)

  function reset() {
    setBody('')
    setWork('')
    setOpen(false)
  }

  async function send() {
    if (!body.trim()) return
    setBusy(true)
    const res = await proposeIdea(body, work)
    setBusy(false)
    if ('error' in res) {
      toast.error(res.error === 'work' ? t('ideas_propose_err_work') : t('ideas_err').replace('{e}', stringifyError(res.error)))
      return
    }
    toast.success(t('ideas_propose_sent'))
    reset()
  }

  if (!open) {
    return (
      <button
        type="button"
        className="btn sm"
        data-testid="idea-propose-open"
        style={{ minHeight: 44, width: narrow ? '100%' : 'auto', alignSelf: narrow ? 'stretch' : 'flex-start' }}
        onClick={() => setOpen(true)}
      >
        {t('ideas_propose_btn')}
      </button>
    )
  }

  return (
    <div
      data-testid="idea-propose-form"
      style={{ width: '100%', padding: 12, background: 'var(--bg2)', border: '1px solid var(--bd)', display: 'flex', flexDirection: 'column', gap: 8 }}
    >
      <div style={{ ...labelSt, marginBottom: 0 }}>{t('ideas_propose_btn')}</div>
      <div style={{ fontSize: 10, color: 'var(--tx3)' }}>{t('ideas_propose_hint')}</div>
      <textarea
        data-testid="idea-propose-body"
        aria-label={t('ideas_propose_ph')}
        autoFocus
        style={{ ...inputSt, minHeight: 88, resize: 'vertical' }}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={t('ideas_propose_ph')}
      />
      <label style={{ ...labelSt, marginBottom: 0 }}>
        {t('ideas_propose_work')}
        <input
          data-testid="idea-propose-work"
          style={{ ...inputSt, marginTop: 4, maxWidth: narrow ? '100%' : 160, minHeight: 44 }}
          inputMode="numeric"
          value={work}
          onChange={(e) => setWork(e.target.value)}
          placeholder={t('ideas_propose_work_ph')}
        />
      </label>
      <div className="row gap-sm" style={{ flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn sm"
          data-testid="idea-propose-send"
          style={{ minHeight: 44, flex: narrow ? '1 1 auto' : undefined }}
          disabled={busy || !body.trim()}
          onClick={() => void send()}
        >
          {busy ? t('ideas_propose_sending') : t('ideas_propose_send')}
        </button>
        <button type="button" className="btn ghost sm" style={{ minHeight: 44 }} onClick={reset} disabled={busy}>
          {t('ideas_propose_cancel')}
        </button>
      </div>
    </div>
  )
}
