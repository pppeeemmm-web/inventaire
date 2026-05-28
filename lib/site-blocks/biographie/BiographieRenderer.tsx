'use client'

import { useI18n } from '@/lib/i18n/context'
import type { BlockRendererProps } from '@/lib/site-blocks/registry'

export type BiographieFields = {
  /** Bio paragraphs — HTML allowed (rich text from old editor). */
  intro_fr: string
  intro_en: string
}

export const BIOGRAPHIE_DEFAULTS: BiographieFields = {
  intro_fr: '',
  intro_en: '',
}

function hasContent(html: string | null | undefined): boolean {
  if (!html) return false
  return html.replace(/<[^>]*>/g, '').trim().length > 0
}

/**
 * Biographie — long-form artist bio. Mirrors the styling AboutClient used
 * inline (Instrument Serif column, ~64ch max-width, double line-height) so
 * /about looks identical after the registry takes over.
 *
 * Accepts HTML in the fields (the legacy editor stored intro as HTML);
 * dangerouslySetInnerHTML is safe here because the source is the artist's
 * own editor, not user-generated content from the public.
 */
export default function BiographieRenderer({ fields }: BlockRendererProps<BiographieFields>) {
  const { lang } = useI18n()
  const intro = lang === 'en'
    ? (fields.intro_en || fields.intro_fr)
    : (fields.intro_fr || fields.intro_en)

  return (
    <div className="sb-bio" data-block-kind="biographie">
      <style>{`
        .sb-bio {
          font-size: clamp(12px, 1.6vw, 13px);
          line-height: 2;
          max-width: 64ch;
        }
        .sb-bio p + p { margin-top: 1.4em; }
        .sb-bio :global(p) { margin: 0; }
      `}</style>
      {hasContent(intro)
        ? <div dangerouslySetInnerHTML={{ __html: intro! }} />
        : null}
    </div>
  )
}
