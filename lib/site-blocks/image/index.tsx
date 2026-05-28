import type { BlockDescriptor } from '@/lib/site-blocks/registry'
import ImageRenderer, { IMAGE_DEFAULTS, type ImageFields } from './ImageRenderer'
import ImageEditor from './ImageEditor'

/**
 * `image` — single image block (URL-paste variant). Universal block.
 *
 * Phase 1: accepts any https:// URL or /r2-proxy/ path pasted by the author.
 * A future phase may integrate the R2-backed work picker for catalogue images.
 */
export const imageDescriptor: BlockDescriptor<ImageFields> = {
  kind: 'image',
  allowedPages: '*',
  knobFamilies: [],
  defaultFields: IMAGE_DEFAULTS,
  editor: ImageEditor,
  renderer: ImageRenderer,
  migrateFields(raw): ImageFields {
    const r = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {}
    return {
      url: typeof r.url === 'string' ? r.url : '',
      alt_fr: typeof r.alt_fr === 'string' ? r.alt_fr : '',
      alt_en: typeof r.alt_en === 'string' ? r.alt_en : '',
      caption_fr: typeof r.caption_fr === 'string' ? r.caption_fr : '',
      caption_en: typeof r.caption_en === 'string' ? r.caption_en : '',
    }
  },
}
