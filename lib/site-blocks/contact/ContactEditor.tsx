'use client'

import { useI18n } from '@/lib/i18n/context'
import type { BlockEditorProps } from '@/lib/site-blocks/registry'
import type { ContactFields } from './ContactRenderer'

export default function ContactEditor({ fields, onChange }: BlockEditorProps<ContactFields>) {
  const { t } = useI18n()
  return (
    <div className="sb-contact-editor">
      <style>{`
        .sb-contact-editor { display: flex; flex-direction: column; gap: 10px; }
        .sb-contact-editor .row { display: grid; grid-template-columns: 90px 1fr; gap: 8px; align-items: start; }
        .sb-contact-editor label {
          font-size: 8px; letter-spacing: 1.5px; text-transform: uppercase;
          color: var(--tx3); padding-top: 6px;
        }
        .sb-contact-editor input, .sb-contact-editor textarea {
          font-family: 'JetBrains Mono', monospace; font-size: 11px;
          padding: 8px; background: var(--bg2); color: var(--tx);
          border: 1px solid var(--bd2); border-radius: 0;
          width: 100%; box-sizing: border-box;
        }
        .sb-contact-editor textarea { min-height: 60px; resize: vertical; line-height: 1.5; }
        .sb-contact-editor input:focus, .sb-contact-editor textarea:focus {
          outline: none; border-color: var(--bd3);
        }
      `}</style>
      <div className="row">
        <label htmlFor="sb-c-email">{t('site_contact_email_label')}</label>
        <input id="sb-c-email" type="email" value={fields.email}
          onChange={e => onChange({ email: e.target.value })} />
      </div>
      <div className="row">
        <label htmlFor="sb-c-gal-n">{t('site_contact_gallery_name_label')}</label>
        <input id="sb-c-gal-n" type="text" value={fields.gallery_name}
          onChange={e => onChange({ gallery_name: e.target.value })} />
      </div>
      <div className="row">
        <label htmlFor="sb-c-gal-a">{t('site_contact_gallery_address_label')}</label>
        <input id="sb-c-gal-a" type="text" value={fields.gallery_address}
          onChange={e => onChange({ gallery_address: e.target.value })} />
      </div>
      <div className="row">
        <label htmlFor="sb-c-note-fr">{t('site_contact_note_fr')}</label>
        <textarea id="sb-c-note-fr" value={fields.note_fr} rows={3}
          onChange={e => onChange({ note_fr: e.target.value })} />
      </div>
      <div className="row">
        <label htmlFor="sb-c-note-en">{t('site_contact_note_en')}</label>
        <textarea id="sb-c-note-en" value={fields.note_en} rows={3}
          onChange={e => onChange({ note_en: e.target.value })} />
      </div>
    </div>
  )
}
