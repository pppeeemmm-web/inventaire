'use client'

import { useI18n } from '@/lib/i18n/context'
import type { BlockRendererProps } from '@/lib/site-blocks/registry'

export type ApproachFields = {
  approach_fr: string
  approach_en: string
}

export const APPROACH_DEFAULTS: ApproachFields = {
  approach_fr: '',
  approach_en: '',
}

function hasContent(html: string | null | undefined): boolean {
  if (!html) return false
  return html.replace(/<[^>]*>/g, '').trim().length > 0
}

/**
 * `approach` — long-form practice statement. Ex-/practice page content folded
 * into /about. Same visual treatment as biographie (display-serif column).
 */
export default function ApproachRenderer({ fields }: BlockRendererProps<ApproachFields>) {
  const { lang } = useI18n()
  const body = lang === 'en'
    ? (fields.approach_en || fields.approach_fr)
    : (fields.approach_fr || fields.approach_en)

  if (!hasContent(body)) return null
  return (
    <div className="sb-approach" data-block-kind="approach">
      <style>{`
        .sb-approach {
          font-size: clamp(12px, 1.6vw, 13px);
          line-height: 2;
          max-width: 64ch;
        }
        .sb-approach p + p { margin-top: 1.4em; }
      `}</style>
      <div dangerouslySetInnerHTML={{ __html: body! }} />
    </div>
  )
}
