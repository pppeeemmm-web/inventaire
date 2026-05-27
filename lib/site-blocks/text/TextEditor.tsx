'use client'

import { useI18n } from '@/lib/i18n/context'
import type { BlockEditorProps } from '@/lib/site-blocks/registry'
import type { TextFields } from './TextRenderer'

/**
 * Text block editor — FR/EN title + body. Minimal field set for slice B;
 * future extensions (align, font size, color) layer on through additional
 * fields and a wider editor.
 */
export default function TextEditor({ fields, onChange }: BlockEditorProps<TextFields>) {
  const { t } = useI18n()
  return (
    <div className="sb-text-editor">
      <style>{`
        .sb-text-editor { display: flex; flex-direction: column; gap: 10px; }
        .sb-text-editor .row { display: grid; grid-template-columns: 60px 1fr; gap: 8px; align-items: start; }
        .sb-text-editor label {
          font-size: 8px; letter-spacing: 1.5px; text-transform: uppercase;
          color: var(--tx3); padding-top: 6px;
        }
        .sb-text-editor input, .sb-text-editor textarea {
          font-family: 'JetBrains Mono', monospace; font-size: 11px;
          padding: 6px 8px; background: var(--bg2); color: var(--tx);
          border: 1px solid var(--bd2); border-radius: 0;
          width: 100%; box-sizing: border-box;
        }
        .sb-text-editor textarea { min-height: 80px; resize: vertical; line-height: 1.5; }
        .sb-text-editor input:focus, .sb-text-editor textarea:focus {
          outline: none; border-color: var(--bd3);
        }
      `}</style>
      <div className="row">
        <label htmlFor="sb-text-title-fr">{t('site_text_title_fr')}</label>
        <input id="sb-text-title-fr" type="text" value={fields.title_fr}
          onChange={e => onChange({ title_fr: e.target.value })} />
      </div>
      <div className="row">
        <label htmlFor="sb-text-title-en">{t('site_text_title_en')}</label>
        <input id="sb-text-title-en" type="text" value={fields.title_en}
          onChange={e => onChange({ title_en: e.target.value })} />
      </div>
      <div className="row">
        <label htmlFor="sb-text-body-fr">{t('site_text_body_fr')}</label>
        <textarea id="sb-text-body-fr" value={fields.body_fr} rows={4}
          onChange={e => onChange({ body_fr: e.target.value })} />
      </div>
      <div className="row">
        <label htmlFor="sb-text-body-en">{t('site_text_body_en')}</label>
        <textarea id="sb-text-body-en" value={fields.body_en} rows={4}
          onChange={e => onChange({ body_en: e.target.value })} />
      </div>
    </div>
  )
}
