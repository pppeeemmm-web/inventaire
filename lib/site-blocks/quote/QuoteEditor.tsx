'use client'

import { useI18n } from '@/lib/i18n/context'
import type { BlockEditorProps } from '@/lib/site-blocks/registry'
import type { QuoteFields } from './QuoteRenderer'

export default function QuoteEditor({ fields, onChange }: BlockEditorProps<QuoteFields>) {
  const { t } = useI18n()
  return (
    <div className="sb-quote-editor">
      <style>{`
        .sb-quote-editor { display: flex; flex-direction: column; gap: 10px; }
        .sb-quote-editor .row { display: grid; grid-template-columns: 60px 1fr; gap: 8px; align-items: start; }
        .sb-quote-editor label {
          font-size: 8px; letter-spacing: 1.5px; text-transform: uppercase;
          color: var(--tx3); padding-top: 6px;
        }
        .sb-quote-editor input, .sb-quote-editor textarea {
          font-family: 'JetBrains Mono', monospace; font-size: 11px;
          padding: 8px; background: var(--bg2); color: var(--tx);
          border: 1px solid var(--bd2); border-radius: 0;
          width: 100%; box-sizing: border-box;
        }
        .sb-quote-editor textarea { min-height: 80px; resize: vertical; line-height: 1.5; }
        .sb-quote-editor input:focus, .sb-quote-editor textarea:focus {
          outline: none; border-color: var(--bd3);
        }
      `}</style>
      <div className="row">
        <label htmlFor="sb-q-fr">{t('site_text_body_fr')}</label>
        <textarea id="sb-q-fr" value={fields.quote_fr} rows={3}
          onChange={e => onChange({ quote_fr: e.target.value })} />
      </div>
      <div className="row">
        <label htmlFor="sb-q-en">{t('site_text_body_en')}</label>
        <textarea id="sb-q-en" value={fields.quote_en} rows={3}
          onChange={e => onChange({ quote_en: e.target.value })} />
      </div>
      <div className="row">
        <label htmlFor="sb-q-a-fr">{t('site_statement_attribution_fr')}</label>
        <input id="sb-q-a-fr" type="text" value={fields.attribution_fr}
          onChange={e => onChange({ attribution_fr: e.target.value })} />
      </div>
      <div className="row">
        <label htmlFor="sb-q-a-en">{t('site_statement_attribution_en')}</label>
        <input id="sb-q-a-en" type="text" value={fields.attribution_en}
          onChange={e => onChange({ attribution_en: e.target.value })} />
      </div>
      <div className="row">
        <label htmlFor="sb-q-url">{t('site_quote_source_url')}</label>
        <input id="sb-q-url" type="url" inputMode="url" autoComplete="off"
          placeholder="https://…"
          value={fields.source_url}
          onChange={e => onChange({ source_url: e.target.value })} />
      </div>
    </div>
  )
}
