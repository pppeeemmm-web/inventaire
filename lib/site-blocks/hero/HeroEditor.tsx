'use client'

import { useI18n } from '@/lib/i18n/context'
import type { BlockEditorProps } from '@/lib/site-blocks/registry'
import type { HeroFields } from './HeroRenderer'
import { thumbUrl } from '@/lib/data'

export default function HeroEditor({ fields, ctx }: BlockEditorProps<HeroFields>) {
  const { t, lang } = useI18n()
  const caption = lang === 'en'
    ? (fields.hero_caption_en || fields.hero_caption_fr || '')
    : (fields.hero_caption_fr || fields.hero_caption_en || '')
  const previewSrc = fields.hero_image_key
    ? thumbUrl(fields.hero_image_key, 120)
    : null

  return (
    <div className="sb-hero-editor">
      <style>{`
        .sb-hero-editor {
          display: flex; flex-direction: column; gap: 10px;
          font-family: 'JetBrains Mono', monospace;
        }
        .sb-hero-preview {
          width: 64px; height: 64px;
          border-radius: 50%; overflow: hidden;
          border: 1px solid var(--bd);
          flex-shrink: 0;
        }
        .sb-hero-preview img {
          width: 100%; height: 100%;
          object-fit: contain;
        }
        .sb-hero-row {
          display: flex; gap: 12px; align-items: flex-start;
        }
        .sb-hero-meta {
          display: flex; flex-direction: column; gap: 4px;
          min-width: 0;
        }
        .sb-hero-caption {
          font-size: 10px; color: var(--tx2);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .sb-hero-key {
          font-size: 8px; color: var(--tx3); opacity: 0.5;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .sb-hero-hint {
          font-size: 9px; letter-spacing: 0.5px;
          color: var(--tx3); font-style: italic; line-height: 1.5;
        }
      `}</style>

      {previewSrc ? (
        <div className="sb-hero-row">
          <div className="sb-hero-preview">
            <img src={previewSrc} alt="" />
          </div>
          <div className="sb-hero-meta">
            {caption && <span className="sb-hero-caption">{caption}</span>}
            <span className="sb-hero-key">{fields.hero_image_key}</span>
          </div>
        </div>
      ) : (
        <p className="sb-hero-hint" style={{ fontStyle: 'normal', opacity: 0.5 }}>
          {t('site_hero_no_image')}
        </p>
      )}

      <p className="sb-hero-hint">{t('site_hero_managed_hint')}</p>
    </div>
  )
}
