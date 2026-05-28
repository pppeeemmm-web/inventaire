'use client'

import { useI18n } from '@/lib/i18n/context'
import type { BlockEditorProps } from '@/lib/site-blocks/registry'
import type { ImageFields } from './ImageRenderer'

export default function ImageEditor({ fields, onChange }: BlockEditorProps<ImageFields>) {
  const { t } = useI18n()
  const hasPreview = fields.url && /^https?:\/\//i.test(fields.url.trim())
  return (
    <div className="sb-img-editor">
      <style>{`
        .sb-img-editor { display: flex; flex-direction: column; gap: 10px; }
        .sb-img-editor .row { display: grid; grid-template-columns: 60px 1fr; gap: 8px; align-items: start; }
        .sb-img-editor label {
          font-size: 8px; letter-spacing: 1.5px; text-transform: uppercase;
          color: var(--tx3); padding-top: 6px;
        }
        .sb-img-editor input {
          font-family: 'JetBrains Mono', monospace; font-size: 11px;
          padding: 8px; background: var(--bg2); color: var(--tx);
          border: 1px solid var(--bd2); border-radius: 0;
          width: 100%; box-sizing: border-box;
        }
        .sb-img-editor input:focus { outline: none; border-color: var(--bd3); }
        .sb-img-preview {
          max-width: 160px; max-height: 120px;
          object-fit: contain;
          border: 1px solid var(--bd);
        }
      `}</style>
      <div className="row">
        <label htmlFor="sb-img-url">{t('site_image_url_label')}</label>
        <input id="sb-img-url" type="url" inputMode="url" autoComplete="off"
          placeholder="https://…"
          value={fields.url}
          onChange={e => onChange({ url: e.target.value })} />
      </div>
      {hasPreview && (
        <img className="sb-img-preview" src={fields.url} alt="" loading="lazy" />
      )}
      <div className="row">
        <label htmlFor="sb-img-alt-fr">{t('site_image_alt_fr')}</label>
        <input id="sb-img-alt-fr" type="text" value={fields.alt_fr}
          onChange={e => onChange({ alt_fr: e.target.value })} />
      </div>
      <div className="row">
        <label htmlFor="sb-img-alt-en">{t('site_image_alt_en')}</label>
        <input id="sb-img-alt-en" type="text" value={fields.alt_en}
          onChange={e => onChange({ alt_en: e.target.value })} />
      </div>
      <div className="row">
        <label htmlFor="sb-img-cap-fr">{t('site_image_caption_fr')}</label>
        <input id="sb-img-cap-fr" type="text" value={fields.caption_fr}
          onChange={e => onChange({ caption_fr: e.target.value })} />
      </div>
      <div className="row">
        <label htmlFor="sb-img-cap-en">{t('site_image_caption_en')}</label>
        <input id="sb-img-cap-en" type="text" value={fields.caption_en}
          onChange={e => onChange({ caption_en: e.target.value })} />
      </div>
    </div>
  )
}
