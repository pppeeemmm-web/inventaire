'use client'

import { useI18n } from '@/lib/i18n/context'
import type { BlockEditorProps } from '@/lib/site-blocks/registry'
import type { MaterialsFields } from './MaterialsRenderer'

export default function MaterialsEditor({ fields, onChange }: BlockEditorProps<MaterialsFields>) {
  const { t } = useI18n()
  return (
    <div className="sb-mat-editor">
      <style>{`
        .sb-mat-editor { display: flex; flex-direction: column; gap: 10px; }
        .sb-mat-editor .row { display: grid; grid-template-columns: 60px 1fr; gap: 8px; align-items: start; }
        .sb-mat-editor label {
          font-size: 8px; letter-spacing: 1.5px; text-transform: uppercase;
          color: var(--tx3); padding-top: 6px;
        }
        .sb-mat-editor textarea {
          font-family: 'JetBrains Mono', monospace; font-size: 11px;
          padding: 8px; background: var(--bg2); color: var(--tx);
          border: 1px solid var(--bd2); border-radius: 0;
          width: 100%; box-sizing: border-box;
          min-height: 80px; resize: vertical; line-height: 1.6;
        }
        .sb-mat-editor textarea:focus { outline: none; border-color: var(--bd3); }
      `}</style>
      <div className="row">
        <label htmlFor="sb-mat-fr">{t('site_text_body_fr')}</label>
        <textarea id="sb-mat-fr" value={fields.materials_fr} rows={4}
          onChange={e => onChange({ materials_fr: e.target.value })} />
      </div>
      <div className="row">
        <label htmlFor="sb-mat-en">{t('site_text_body_en')}</label>
        <textarea id="sb-mat-en" value={fields.materials_en} rows={4}
          onChange={e => onChange({ materials_en: e.target.value })} />
      </div>
    </div>
  )
}
