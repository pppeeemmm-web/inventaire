import type { BlockDescriptor } from '@/lib/site-blocks/registry'
import ContactRenderer, { CONTACT_DEFAULTS, type ContactFields } from './ContactRenderer'
import ContactEditor from './ContactEditor'

/** `contact` — structured contact card. About page only. */
export const contactDescriptor: BlockDescriptor<ContactFields> = {
  kind: 'contact',
  allowedPages: ['about'],
  knobFamilies: [],
  defaultFields: CONTACT_DEFAULTS,
  editor: ContactEditor,
  renderer: ContactRenderer,
  migrateFields(raw): ContactFields {
    const r = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {}
    return {
      email: typeof r.email === 'string' ? r.email : '',
      gallery_name: typeof r.gallery_name === 'string' ? r.gallery_name : '',
      gallery_address: typeof r.gallery_address === 'string' ? r.gallery_address : '',
      note_fr: typeof r.note_fr === 'string' ? r.note_fr : '',
      note_en: typeof r.note_en === 'string' ? r.note_en : '',
    }
  },
}
