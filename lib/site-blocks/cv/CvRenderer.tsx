'use client'

import { useI18n } from '@/lib/i18n/context'
import type { BlockRendererProps } from '@/lib/site-blocks/registry'

export type CvFields = {
  url: string
  label_fr: string
  label_en: string
}

export const CV_DEFAULTS: CvFields = {
  url: '',
  label_fr: '',
  label_en: '',
}

/**
 * `cv` — download link to a CV PDF (or any URL). Renders as a single
 * prominent link button. About page only.
 */
export default function CvRenderer({ fields }: BlockRendererProps<CvFields>) {
  const { lang, t } = useI18n()
  if (!fields.url || !fields.url.trim()) return null
  const label = lang === 'en'
    ? (fields.label_en || fields.label_fr || t('site_cv_default_label'))
    : (fields.label_fr || fields.label_en || t('site_cv_default_label'))

  return (
    <div className="sb-cv" data-block-kind="cv">
      <style>{`
        .sb-cv { padding: 8px 0; }
        .sb-cv a {
          display: inline-flex; align-items: center; gap: 10px;
          padding: 10px 16px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: inherit;
          text-decoration: none;
          border: 1px solid currentColor;
          opacity: 0.75;
          transition: opacity 150ms ease;
        }
        .sb-cv a:hover { opacity: 1; }
        .sb-cv a::after {
          content: '↗';
          font-size: 12px;
          opacity: 0.6;
        }
      `}</style>
      <a href={fields.url} target="_blank" rel="noopener noreferrer">
        {label}
      </a>
    </div>
  )
}
