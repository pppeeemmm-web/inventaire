import type { BlockDescriptor } from '@/lib/site-blocks/registry'
import GalleryStripRenderer, { GALLERY_STRIP_DEFAULTS, type GalleryStripFields } from './GalleryStripRenderer'
import GalleryStripEditor from './GalleryStripEditor'

function isItem(v: unknown): v is { url: string } {
  return typeof v === 'object' && v !== null && typeof (v as Record<string, unknown>).url === 'string'
}

/**
 * `gallery_strip` — horizontal scrollable row of images. Universal block.
 *
 * Phase 1: URL-paste per image (add/remove rows, thumbnail preview in editor).
 * A future phase may replace with an R2-backed work picker for catalogue images.
 */
export const galleryStripDescriptor: BlockDescriptor<GalleryStripFields> = {
  kind: 'gallery_strip',
  allowedPages: '*',
  knobFamilies: ['frame', 'bg'],
  defaultFields: GALLERY_STRIP_DEFAULTS,
  editor: GalleryStripEditor,
  renderer: GalleryStripRenderer,
  migrateFields(raw): GalleryStripFields {
    const r = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {}
    const rawItems = Array.isArray(r.items) ? r.items : []
    return {
      items: rawItems.filter(isItem).map(it => ({ url: it.url })),
      caption_fr: typeof r.caption_fr === 'string' ? r.caption_fr : '',
      caption_en: typeof r.caption_en === 'string' ? r.caption_en : '',
    }
  },
}
