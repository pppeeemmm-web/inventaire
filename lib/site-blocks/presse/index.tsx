import type { BlockDescriptor } from '@/lib/site-blocks/registry'
import PresseRenderer, {
  PRESSE_DEFAULTS,
  type PresseFields,
  type PresseRow,
} from './PresseRenderer'
import PresseEditor from './PresseEditor'

function migrateRow(raw: unknown): PresseRow {
  // Always returns a row — renderer filters blanks for display, editor
  // needs every row so the user can fill it in.
  if (!raw || typeof raw !== 'object') {
    return { source: '', date: '', excerpt_fr: '', excerpt_en: '', url: '' }
  }
  const r = raw as Record<string, unknown>
  return {
    source: typeof r.source === 'string' ? r.source : '',
    date: typeof r.date === 'string' ? r.date : '',
    excerpt_fr: typeof r.excerpt_fr === 'string' ? r.excerpt_fr : '',
    excerpt_en: typeof r.excerpt_en === 'string' ? r.excerpt_en : '',
    url: typeof r.url === 'string' ? r.url : '',
  }
}

/** `presse` — press mentions with bilingual excerpts. About page only. */
export const presseDescriptor: BlockDescriptor<PresseFields> = {
  kind: 'presse',
  allowedPages: ['about'],
  knobFamilies: [],
  defaultFields: PRESSE_DEFAULTS,
  editor: PresseEditor,
  renderer: PresseRenderer,
  migrateFields(raw): PresseFields {
    const r = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {}
    const rawRows = Array.isArray(r.rows) ? r.rows : []
    return { rows: rawRows.map(migrateRow) }
  },
}
