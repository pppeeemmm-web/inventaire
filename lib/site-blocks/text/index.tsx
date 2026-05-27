import type { BlockDescriptor } from '@/lib/site-blocks/registry'
import TextRenderer, { TEXT_DEFAULTS, type TextFields } from './TextRenderer'
import TextEditor from './TextEditor'

/**
 * `text` — universal rich text block. Allowed on every page; serves as the
 * canonical "drop content in anywhere" primitive. Reads no knob families
 * (Phase 2 may add typography knobs that affect every text block).
 */
export const textDescriptor: BlockDescriptor<TextFields> = {
  kind: 'text',
  allowedPages: '*',
  knobFamilies: [],
  defaultFields: TEXT_DEFAULTS,
  editor: TextEditor,
  renderer: TextRenderer,
  migrateFields(raw): TextFields {
    const r = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {}
    return {
      title_fr: typeof r.title_fr === 'string' ? r.title_fr : '',
      title_en: typeof r.title_en === 'string' ? r.title_en : '',
      body_fr: typeof r.body_fr === 'string' ? r.body_fr : '',
      body_en: typeof r.body_en === 'string' ? r.body_en : '',
    }
  },
}
