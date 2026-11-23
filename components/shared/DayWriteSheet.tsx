'use client'

// « Écrire » on the phone (docs/design/2026-11-18/PhoneNav.notes.md, shared fix 2): a writing sheet over
// the page, saved as a Journal entry of that day — no jump into the Atelier. Same rules as the Journal
// form (append only; `#1234` in the text links the work). Its own chunk, loaded when Écrire is tapped
// (PhoneInputBar fetches it after first paint).
import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n/context'
import { toast } from '@/lib/ui/toast'
import { PemModalOverlay } from '@/components/shared/PemModalOverlay'
import { createJournalEntry } from '@/app/atelier/(portal)/journal/entry-actions'
import { useLinkPicker } from '@/components/journal/LinkPicker'

const KINDS = [
  { id: 'spark', label: 'je_kind_spark' },
  { id: 'trigger', label: 'je_kind_trigger' },
  { id: 'reflection', label: 'je_kind_reflection' },
  { id: 'note', label: 'je_kind_note' },
] as const

export function DayWriteSheet({ day, initialText = '', onClose }: { day: string; initialText?: string; onClose: () => void }) {
  const { t, lang } = useI18n()
  const router = useRouter()
  const [kind, setKind] = useState<(typeof KINDS)[number]['id']>('spark')
  const [body, setBody] = useState(initialText ? `${initialText.trim()} ` : '')
  const [pending, startTransition] = useTransition()
  const box = useRef<HTMLTextAreaElement>(null)
  const picker = useLinkPicker(body, setBody)

  useEffect(() => {
    // Phone: the keyboard opens with the sheet.
    const id = window.setTimeout(() => {
      const el = box.current
      if (!el) return
      el.focus({ preventScroll: true })
      el.setSelectionRange(el.value.length, el.value.length)
    }, 60)
    return () => window.clearTimeout(id)
  }, [])

  const date = new Date(`${day}T12:00:00Z`).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' })

  function save() {
    if (!body.trim()) {
      toast.error(t('je_err_empty'))
      return
    }
    startTransition(async () => {
      const res = await createJournalEntry({ day, kind, body, links: picker.links })
      if ('error' in res) {
        toast.error(t('je_err_fmt').replace('{msg}', res.error))
        return
      }
      if (res.linkError) toast.error(t('lp_link_error').replace('{msg}', res.linkError))
      else toast.success(t('pn_write_saved'))
      onClose()
      router.refresh()
    })
  }

  const chip = (on: boolean) => ({
    minHeight: 44, padding: '0 12px', borderRadius: 22, cursor: 'pointer', fontSize: 13,
    border: `1px solid ${on ? 'var(--ac)' : 'var(--bd2)'}`,
    background: on ? 'color-mix(in srgb, var(--ac) 10%, var(--bg0))' : 'var(--bg0)',
    color: on ? 'var(--tx)' : 'var(--tx2)',
  })

  return (
    <PemModalOverlay
      onClose={() => {
        // A started text is never thrown away by a tap beside the sheet.
        if (!body.trim() || body.trim() === initialText.trim()) onClose()
      }}
      panelStyle={{
        alignSelf: 'flex-end', width: '100%', maxWidth: 560, borderRadius: '16px 16px 0 0', border: 0, background: 'var(--bg0)',
        padding: '10px 16px', paddingBottom: 'max(16px, env(safe-area-inset-bottom, 0px))', boxSizing: 'border-box',
      }}
    >
      <div data-testid="day-write-sheet" style={{ display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h2 style={{ fontSize: 16, margin: 0, flex: 1, minWidth: 0 }}>{t('pn_write_title').replace('{date}', date)}</h2>
          <button type="button" onClick={onClose} className="btn ghost sm" style={{ minHeight: 44 }}>
            {t('pn_close')}
          </button>
        </div>
        <div role="radiogroup" aria-label={t('je_kind_label')} style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {KINDS.map((k) => (
            <button key={k.id} type="button" role="radio" aria-checked={kind === k.id} onClick={() => setKind(k.id)} style={chip(kind === k.id)}>
              {t(k.label)}
            </button>
          ))}
        </div>
        <textarea
          ref={box}
          data-testid="day-write-body"
          rows={5}
          value={body}
          // Same cap as `createJournalEntry` (MAX_BODY): the box stops there instead of the save cutting the text unseen.
          maxLength={20_000}
          placeholder={t('je_body_placeholder')}
          aria-label={t('je_body_label')}
          onChange={(e) => {
            setBody(e.target.value)
            picker.onChange(e)
          }}
          onClick={picker.onChange}
          onKeyUp={picker.onCaret}
          onKeyDown={(e) => {
            picker.onKeyDown(e)
          }}
          style={{ width: '100%', boxSizing: 'border-box', fontSize: 16, lineHeight: 1.45, padding: 10, borderRadius: 8, border: '1px solid var(--bd2)', background: 'var(--bg1)', color: 'var(--tx)', resize: 'vertical' }}
        />
        {picker.popover}
        {picker.chips}
        <p style={{ margin: 0, fontSize: 11, color: 'var(--tx3)' }}>{t('je_append_only_hint')}</p>
        <button type="button" className="btn primary" data-testid="day-write-save" disabled={pending || !body.trim()} onClick={save} style={{ minHeight: 48 }}>
          {t(pending ? 'je_saving' : 'je_save')}
        </button>
      </div>
    </PemModalOverlay>
  )
}
