import type { BlockDescriptor } from '@/lib/site-blocks/registry'
import BiographieRenderer, { BIOGRAPHIE_DEFAULTS, type BiographieFields } from './BiographieRenderer'
import BiographieEditor from './BiographieEditor'

/** `biographie` — long-form artist bio. About page only. */
export const biographieDescriptor: BlockDescriptor<BiographieFields> = {
  kind: 'biographie',
  allowedPages: ['about'],
  knobFamilies: [],
  defaultFields: BIOGRAPHIE_DEFAULTS,
  editor: BiographieEditor,
  renderer: BiographieRenderer,
  migrateFields(raw): BiographieFields {
    const r = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {}
    return {
      intro_fr: typeof r.intro_fr === 'string' ? r.intro_fr : '',
      intro_en: typeof r.intro_en === 'string' ? r.intro_en : '',
    }
  },
}
