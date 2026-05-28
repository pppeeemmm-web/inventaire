import type { BlockDescriptor } from '@/lib/site-blocks/registry'
import MaterialsRenderer, { MATERIALS_DEFAULTS, type MaterialsFields } from './MaterialsRenderer'
import MaterialsEditor from './MaterialsEditor'

/** `materials` — short media list. About page. */
export const materialsDescriptor: BlockDescriptor<MaterialsFields> = {
  kind: 'materials',
  allowedPages: ['about'],
  knobFamilies: [],
  defaultFields: MATERIALS_DEFAULTS,
  editor: MaterialsEditor,
  renderer: MaterialsRenderer,
  migrateFields(raw): MaterialsFields {
    const r = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {}
    return {
      materials_fr: typeof r.materials_fr === 'string' ? r.materials_fr : '',
      materials_en: typeof r.materials_en === 'string' ? r.materials_en : '',
    }
  },
}
