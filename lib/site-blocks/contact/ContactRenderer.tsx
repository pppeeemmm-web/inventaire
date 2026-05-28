'use client'

import { useI18n } from '@/lib/i18n/context'
import type { BlockRendererProps } from '@/lib/site-blocks/registry'

export type ContactFields = {
  email: string
  gallery_name: string
  gallery_address: string
  note_fr: string
  note_en: string
}

export const CONTACT_DEFAULTS: ContactFields = {
  email: '',
  gallery_name: '',
  gallery_address: '',
  note_fr: '',
  note_en: '',
}

/**
 * `contact` — structured contact card. Email link, optional representing
 * gallery details, and a short note. About page only.
 */
export default function ContactRenderer({ fields }: BlockRendererProps<ContactFields>) {
  const { lang, t } = useI18n()
  const note = lang === 'en'
    ? (fields.note_en || fields.note_fr)
    : (fields.note_fr || fields.note_en)

  const hasAny = !!(
    fields.email
    || fields.gallery_name
    || fields.gallery_address
    || (note && note.trim())
  )
  if (!hasAny) return null

  return (
    <div className="sb-contact" data-block-kind="contact">
      <style>{`
        .sb-contact {
          display: flex; flex-direction: column; gap: 14px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          line-height: 1.7;
          max-width: 56ch;
        }
        .sb-contact-row {
          display: grid;
          grid-template-columns: 80px 1fr;
          gap: 12px;
          align-items: baseline;
        }
        .sb-contact-label {
          font-size: 9px;
          letter-spacing: 2px;
          text-transform: uppercase;
          opacity: 0.55;
        }
        .sb-contact-value a {
          color: inherit;
          text-decoration: underline;
          text-underline-offset: 3px;
        }
        .sb-contact-note {
          margin-top: 4px;
          padding-top: 14px;
          border-top: 1px dashed currentColor;
          opacity: 0.8;
        }
        .sb-contact-note p + p { margin-top: 0.8em; }
      `}</style>
      {fields.email && (
        <div className="sb-contact-row">
          <span className="sb-contact-label">{t('site_contact_email_label')}</span>
          <span className="sb-contact-value">
            <a href={`mailto:${fields.email}`}>{fields.email}</a>
          </span>
        </div>
      )}
      {(fields.gallery_name || fields.gallery_address) && (
        <div className="sb-contact-row">
          <span className="sb-contact-label">{t('site_contact_gallery_label')}</span>
          <span className="sb-contact-value">
            {fields.gallery_name && <div>{fields.gallery_name}</div>}
            {fields.gallery_address && <div style={{ opacity: 0.7 }}>{fields.gallery_address}</div>}
          </span>
        </div>
      )}
      {note && note.trim() && (
        <div className="sb-contact-note">
          {note.split(/\n{2,}/).map((p, i) => <p key={i} style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{p.trim()}</p>)}
        </div>
      )}
    </div>
  )
}
