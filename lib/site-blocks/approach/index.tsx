import type { BlockDescriptor } from '@/lib/site-blocks/registry'
import ApproachRenderer, { APPROACH_DEFAULTS, type ApproachFields } from './ApproachRenderer'
import ApproachEditor from './ApproachEditor'

/** `approach` — practice statement folded into /about. */
export const approachDescriptor: BlockDescriptor<ApproachFields> = {
  kind: 'approach',
  allowedPages: ['about'],
  knobFamilies: [],
  defaultFields: APPROACH_DEFAULTS,
  editor: ApproachEditor,
  renderer: ApproachRenderer,
  migrateFields(raw): ApproachFields {
    const r = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {}
    return {
      approach_fr: typeof r.approach_fr === 'string' ? r.approach_fr : '',
      approach_en: typeof r.approach_en === 'string' ? r.approach_en : '',
    }
  },
}
