'use client'

// « Dans le Journal » on a contact card: Journal entries naming this person with `@`. Starts folded; loads on open.

import { useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { thumbUrl } from '@/lib/data'
import { readContactJournalMentions, type ContactJournalMention } from '@/app/atelier/(portal)/contacts/journal-mentions'

export function ContactJournalSection({ contactId }: { contactId: number }) {
  const { t, lang } = useI18n()
  const locale = lang === 'en' ? 'en-GB' : 'fr-FR'
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<ContactJournalMention[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setItems(null)
    setFailed(false)
    setOpen(false)
  }, [contactId])

  useEffect(() => {
    if (!open || items != null) return
    let live = true
    void readContactJournalMentions(contactId).then((res) => {
      if (!live) return
      if ('error' in res) {
        setFailed(true)
        setItems([])
        return
      }
      setItems(res.items)
    })
    return () => {
      live = false
    }
  }, [open, items, contactId])

  const dayLabel = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div style={{ marginTop: 16, borderTop: '1px solid var(--bd)', paddingTop: 8 }} data-testid="contact-journal">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{ width: '100%', minHeight: 44, display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', color: 'var(--tx)', cursor: 'pointer', padding: 0, textAlign: 'left' }}
      >
        <span style={{ fontSize: 10, color: 'var(--tx3)' }}>{open ? '▾' : '▸'}</span>
        <span style={{ fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--tx3)' }}>{t('cj_title')}</span>
        {items && items.length > 0 ? <span className="t-mono-sm" style={{ fontSize: 10, color: 'var(--tx3)' }}>{items.length}</span> : null}
      </button>
      {open ? (
        items == null ? (
          <div style={{ fontSize: 12, color: 'var(--tx3)', padding: '8px 0' }}>{t('cj_loading')}</div>
        ) : failed ? (
          <div style={{ fontSize: 12, color: 'var(--rust)', padding: '8px 0' }}>{t('cj_error')}</div>
        ) : items.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--tx3)', padding: '8px 0' }}>{t('cj_empty')}</div>
        ) : (
          items.map((it) => {
            const thumb = it.photoKey ? thumbUrl(it.photoKey) : null
            return (
              <a
                key={it.entryId}
                href={`/atelier/journal?day=${it.day}`}
                style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, padding: '6px 0', color: 'inherit', textDecoration: 'none', borderBottom: '1px solid var(--bd)', minWidth: 0 }}
              >
                {thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumb} alt="" width={40} height={40} style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 3, flexShrink: 0 }} />
                ) : null}
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span className="t-mono-sm" style={{ display: 'block', fontSize: 10, color: 'var(--tx3)' }}>{dayLabel(it.day)}</span>
                  <span style={{ display: 'block', fontSize: 12, overflowWrap: 'anywhere' }}>{it.snippet}</span>
                </span>
              </a>
            )
          })
        )
      ) : null}
    </div>
  )
}
