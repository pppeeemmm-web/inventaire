'use client'

// The text beside an inspiration photo, added or changed after the fact (Pem 2026-11-21: « a text box beside
// the capture »). One piece for both faces — the desk Journal day and the phone day — through one door
// (`setInspirationCaption`, admin). It shows the text the door answered with; no reload of the day.

import { useEffect, useState, useTransition, type ReactNode } from 'react'
import { setInspirationCaption } from '@/app/atelier/capture/inspiration-actions'
import { useI18n } from '@/lib/i18n/context'
import { toast } from '@/lib/ui/toast'

export function InspirationText({
  id,
  caption,
  canEdit,
  render,
  onSaved,
}: {
  id: string
  caption: string | null
  canEdit: boolean
  /** How this screen shows a text (work mentions `#123` included). */
  render: (text: string) => ReactNode
  onSaved?: (caption: string | null) => void
}) {
  const { t } = useI18n()
  const [text, setText] = useState(caption)
  const [draft, setDraft] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => setText(caption), [caption])

  function save() {
    if (draft == null) return
    startTransition(async () => {
      const res = await setInspirationCaption(id, draft)
      if ('error' in res) {
        toast.error(t('je_err_fmt').replace('{msg}', res.error))
        return
      }
      setText(res.caption)
      setDraft(null)
      onSaved?.(res.caption)
      toast.success(t('insp_text_saved'))
    })
  }

  if (draft != null) {
    return (
      <div data-testid={`inspiration-text-${id}`} style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
        <textarea
          className="input"
          aria-label={t('insp_text_label')}
          data-testid={`inspiration-text-box-${id}`}
          rows={5}
          autoFocus
          maxLength={2000}
          value={draft}
          placeholder={t('insp_text_placeholder')}
          onChange={(ev) => setDraft(ev.target.value)}
          style={{ fontSize: 16, width: '100%', boxSizing: 'border-box' }}
        />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button type="button" className="btn primary sm" disabled={pending} onClick={save} style={{ minHeight: 44 }} data-testid={`inspiration-text-save-${id}`}>
            {t(pending ? 'je_saving' : 'insp_text_save')}
          </button>
          <button type="button" className="btn ghost sm" disabled={pending} onClick={() => setDraft(null)} style={{ minHeight: 44 }}>
            {t('insp_text_cancel')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div data-testid={`inspiration-text-${id}`} style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
      {text?.trim() ? render(text) : null}
      {canEdit ? (
        <button
          type="button"
          className="btn ghost sm"
          data-testid={`inspiration-text-edit-${id}`}
          onClick={() => setDraft(text ?? '')}
          style={{ minHeight: 44, alignSelf: 'flex-start' }}
        >
          {t(text?.trim() ? 'insp_text_edit' : 'insp_text_add')}
        </button>
      ) : null}
    </div>
  )
}
