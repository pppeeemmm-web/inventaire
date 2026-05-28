'use client'

import { useI18n } from '@/lib/i18n/context'
import type { BlockEditorProps } from '@/lib/site-blocks/registry'
import type { ApproachFields } from './ApproachRenderer'

export default function ApproachEditor({ fields, onChange }: BlockEditorProps<ApproachFields>) {
  const { t } = useI18n()
  return (
    <div className="sb-approach-editor">
      <style>{`
        .sb-approach-editor { display: flex; flex-direction: column; gap: 10px; }
        .sb-approach-editor .row { display: grid; grid-template-columns: 60px 1fr; gap: 8px; align-items: start; }
        .sb-approach-editor label {
          font-size: 8px; letter-spacing: 1.5px; text-transform: uppercase;
          color: var(--tx3); padding-top: 6px;
        }
        .sb-approach-editor textarea {
          font-family: 'JetBrains Mono', monospace; font-size: 11px;
          padding: 8px; background: var(--bg2); color: var(--tx);
          border: 1px solid var(--bd2); border-radius: 0;
          width: 100%; box-sizing: border-box;
          min-height: 120px; resize: vertical; line-height: 1.6;
        }
        .sb-approach-editor textarea:focus { outline: none; border-color: var(--bd3); }
      `}</style>
      <div className="row">
        <label htmlFor="sb-app-fr">{t('site_text_body_fr')}</label>
        <textarea id="sb-app-fr" value={fields.approach_fr} rows={6}
          onChange={e => onChange({ approach_fr: e.target.value })} />
      </div>
      <div className="row">
        <label htmlFor="sb-app-en">{t('site_text_body_en')}</label>
        <textarea id="sb-app-en" value={fields.approach_en} rows={6}
          onChange={e => onChange({ approach_en: e.target.value })} />
      </div>
    </div>
  )
}
