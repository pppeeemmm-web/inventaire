'use client'

import { useI18n } from '@/lib/i18n/context'
import type { BlockRendererProps } from '@/lib/site-blocks/registry'

export type MaterialsFields = {
  materials_fr: string
  materials_en: string
}

export const MATERIALS_DEFAULTS: MaterialsFields = {
  materials_fr: '',
  materials_en: '',
}

function hasContent(html: string | null | undefined): boolean {
  if (!html) return false
  return html.replace(/<[^>]*>/g, '').trim().length > 0
}

/** `materials` — short list/description of media used. About page. */
export default function MaterialsRenderer({ fields }: BlockRendererProps<MaterialsFields>) {
  const { lang } = useI18n()
  const body = lang === 'en'
    ? (fields.materials_en || fields.materials_fr)
    : (fields.materials_fr || fields.materials_en)
  if (!hasContent(body)) return null
  return (
    <div className="sb-materials" data-block-kind="materials">
      <style>{`
        .sb-materials {
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px; line-height: 1.7;
          max-width: 48ch;
        }
        .sb-materials p { margin: 0 0 8px; }
      `}</style>
      <div dangerouslySetInnerHTML={{ __html: body! }} />
    </div>
  )
}
