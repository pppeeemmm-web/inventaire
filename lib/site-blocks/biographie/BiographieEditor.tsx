'use client'

import { useI18n } from '@/lib/i18n/context'
import type { BlockEditorProps } from '@/lib/site-blocks/registry'
import type { BiographieFields } from './BiographieRenderer'

/**
 * Biographie editor — FR/EN rich-text bio. Plain textareas for now (HTML
 * is preserved on save). A future iteration can add a small rich-text
 * toolbar without changing the descriptor contract.
 */
export default function BiographieEditor({ fields, onChange }: BlockEditorProps<BiographieFields>) {
  const { t } = useI18n()
  return (
    <div className="sb-bio-editor">
      <style>{`
        .sb-bio-editor { display: flex; flex-direction: column; gap: 10px; }
        .sb-bio-editor .row { display: grid; grid-template-columns: 60px 1fr; gap: 8px; align-items: start; }
        .sb-bio-editor label {
          font-size: 8px; letter-spacing: 1.5px; text-transform: uppercase;
          color: var(--tx3); padding-top: 6px;
        }
        .sb-bio-editor textarea {
          font-family: 'JetBrains Mono', monospace; font-size: 11px;
          padding: 8px; background: var(--bg2); color: var(--tx);
          border: 1px solid var(--bd2); border-radius: 0;
          width: 100%; box-sizing: border-box;
          min-height: 140px; resize: vertical; line-height: 1.6;
        }
        .sb-bio-editor textarea:focus { outline: none; border-color: var(--bd3); }
      `}</style>
      <div className="row">
        <label htmlFor="sb-bio-fr">{t('site_text_body_fr')}</label>
        <textarea id="sb-bio-fr" value={fields.intro_fr} rows={8}
          onChange={e => onChange({ intro_fr: e.target.value })} />
      </div>
      <div className="row">
        <label htmlFor="sb-bio-en">{t('site_text_body_en')}</label>
        <textarea id="sb-bio-en" value={fields.intro_en} rows={8}
          onChange={e => onChange({ intro_en: e.target.value })} />
      </div>
    </div>
  )
}
