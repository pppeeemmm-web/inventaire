'use client'

import { useI18n } from '@/lib/i18n/context'
import type { BlockRendererProps } from '@/lib/site-blocks/registry'

export type TextFields = {
  /** Optional title — display-serif, larger size. Empty hides the heading. */
  title_fr: string
  title_en: string
  /** Body paragraphs — newlines become paragraph breaks. */
  body_fr: string
  body_en: string
}

export const TEXT_DEFAULTS: TextFields = {
  title_fr: '',
  title_en: '',
  body_fr: '',
  body_en: '',
}

/**
 * Text block — display-serif title (optional) + mono body. Renders in the
 * current language (FR/EN); empty string falls back to the other locale so
 * partially-translated blocks still show something.
 */
export default function TextRenderer({ fields }: BlockRendererProps<TextFields>) {
  const { lang } = useI18n()
  const title = lang === 'en'
    ? (fields.title_en || fields.title_fr)
    : (fields.title_fr || fields.title_en)
  const body = lang === 'en'
    ? (fields.body_en || fields.body_fr)
    : (fields.body_fr || fields.body_en)

  if (!title && !body) return null
  const paragraphs = (body ?? '').split(/\n{2,}/).map(p => p.trim()).filter(Boolean)

  return (
    <div className="sb-text" data-block-kind="text">
      <style>{`
        .sb-text { padding: clamp(16px, 3vw, 32px) 0; max-width: 64ch; }
        .sb-text-title {
          font-family: 'Instrument Serif', serif;
          font-size: clamp(20px, 2.4vw, 28px);
          line-height: 1.2;
          margin: 0 0 16px;
        }
        .sb-text-body {
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          line-height: 1.7;
        }
        .sb-text-body p { margin: 0 0 12px; white-space: pre-wrap; }
        .sb-text-body p:last-child { margin-bottom: 0; }
      `}</style>
      {title && <h2 className="sb-text-title">{title}</h2>}
      {paragraphs.length > 0 && (
        <div className="sb-text-body">
          {paragraphs.map((p, i) => <p key={i}>{p}</p>)}
        </div>
      )}
    </div>
  )
}
