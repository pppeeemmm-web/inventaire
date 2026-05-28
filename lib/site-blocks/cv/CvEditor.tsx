'use client'

import { useI18n } from '@/lib/i18n/context'
import type { BlockEditorProps } from '@/lib/site-blocks/registry'
import type { CvFields } from './CvRenderer'

export default function CvEditor({ fields, onChange }: BlockEditorProps<CvFields>) {
  const { t } = useI18n()
  return (
    <div className="sb-cv-editor">
      <style>{`
        .sb-cv-editor { display: flex; flex-direction: column; gap: 10px; }
        .sb-cv-editor .row { display: grid; grid-template-columns: 80px 1fr; gap: 8px; align-items: start; }
        .sb-cv-editor label {
          font-size: 8px; letter-spacing: 1.5px; text-transform: uppercase;
          color: var(--tx3); padding-top: 6px;
        }
        .sb-cv-editor input {
          font-family: 'JetBrains Mono', monospace; font-size: 11px;
          padding: 8px; background: var(--bg2); color: var(--tx);
          border: 1px solid var(--bd2); border-radius: 0;
          width: 100%; box-sizing: border-box;
        }
        .sb-cv-editor input:focus { outline: none; border-color: var(--bd3); }
      `}</style>
      <div className="row">
        <label htmlFor="sb-cv-url">{t('site_cv_url_label')}</label>
        <input id="sb-cv-url" type="url" inputMode="url" autoComplete="off" value={fields.url}
          placeholder="https://..."
          onChange={e => onChange({ url: e.target.value })} />
      </div>
      <div className="row">
        <label htmlFor="sb-cv-l-fr">{t('site_cv_label_fr')}</label>
        <input id="sb-cv-l-fr" type="text" value={fields.label_fr}
          onChange={e => onChange({ label_fr: e.target.value })} />
      </div>
      <div className="row">
        <label htmlFor="sb-cv-l-en">{t('site_cv_label_en')}</label>
        <input id="sb-cv-l-en" type="text" value={fields.label_en}
          onChange={e => onChange({ label_en: e.target.value })} />
      </div>
    </div>
  )
}
