'use client'

import { useI18n } from '@/lib/i18n/context'
import type { BlockEditorProps } from '@/lib/site-blocks/registry'
import type { StatementFields } from './StatementRenderer'

export default function StatementEditor({ fields, onChange }: BlockEditorProps<StatementFields>) {
  const { t } = useI18n()
  return (
    <div className="sb-stmt-editor">
      <style>{`
        .sb-stmt-editor { display: flex; flex-direction: column; gap: 10px; }
        .sb-stmt-editor .row { display: grid; grid-template-columns: 60px 1fr; gap: 8px; align-items: start; }
        .sb-stmt-editor label {
          font-size: 8px; letter-spacing: 1.5px; text-transform: uppercase;
          color: var(--tx3); padding-top: 6px;
        }
        .sb-stmt-editor input, .sb-stmt-editor textarea {
          font-family: 'JetBrains Mono', monospace; font-size: 11px;
          padding: 8px; background: var(--bg2); color: var(--tx);
          border: 1px solid var(--bd2); border-radius: 0;
          width: 100%; box-sizing: border-box;
        }
        .sb-stmt-editor textarea { min-height: 80px; resize: vertical; line-height: 1.5; }
        .sb-stmt-editor input:focus, .sb-stmt-editor textarea:focus {
          outline: none; border-color: var(--bd3);
        }
      `}</style>
      <div className="row">
        <label htmlFor="sb-stmt-q-fr">{t('site_text_body_fr')}</label>
        <textarea id="sb-stmt-q-fr" value={fields.quote_fr} rows={3}
          onChange={e => onChange({ quote_fr: e.target.value })} />
      </div>
      <div className="row">
        <label htmlFor="sb-stmt-q-en">{t('site_text_body_en')}</label>
        <textarea id="sb-stmt-q-en" value={fields.quote_en} rows={3}
          onChange={e => onChange({ quote_en: e.target.value })} />
      </div>
      <div className="row">
        <label htmlFor="sb-stmt-a-fr">{t('site_statement_attribution_fr')}</label>
        <input id="sb-stmt-a-fr" type="text" value={fields.attribution_fr}
          onChange={e => onChange({ attribution_fr: e.target.value })} />
      </div>
      <div className="row">
        <label htmlFor="sb-stmt-a-en">{t('site_statement_attribution_en')}</label>
        <input id="sb-stmt-a-en" type="text" value={fields.attribution_en}
          onChange={e => onChange({ attribution_en: e.target.value })} />
      </div>
    </div>
  )
}
