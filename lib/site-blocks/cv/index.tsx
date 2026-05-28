import type { BlockDescriptor } from '@/lib/site-blocks/registry'
import CvRenderer, { CV_DEFAULTS, type CvFields } from './CvRenderer'
import CvEditor from './CvEditor'

/** `cv` — download link to a CV PDF (or any URL). About page only. */
export const cvDescriptor: BlockDescriptor<CvFields> = {
  kind: 'cv',
  allowedPages: ['about'],
  knobFamilies: [],
  defaultFields: CV_DEFAULTS,
  editor: CvEditor,
  renderer: CvRenderer,
  migrateFields(raw): CvFields {
    const r = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {}
    return {
      url: typeof r.url === 'string' ? r.url : '',
      label_fr: typeof r.label_fr === 'string' ? r.label_fr : '',
      label_en: typeof r.label_en === 'string' ? r.label_en : '',
    }
  },
}
