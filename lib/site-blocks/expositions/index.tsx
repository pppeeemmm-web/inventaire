import type { BlockDescriptor } from '@/lib/site-blocks/registry'
import ExpositionsRenderer, {
  EXPOSITIONS_DEFAULTS,
  type ExpositionRow,
  type ExpositionsFields,
} from './ExpositionsRenderer'
import ExpositionsEditor from './ExpositionsEditor'

function migrateRow(raw: unknown): ExpositionRow {
  // Always returns a row (even all-blank) — the renderer filters empty
  // rows out for display, but the editor needs to see every row the
  // user added so they can fill it in.
  if (!raw || typeof raw !== 'object') return { year: '', title: '', venue: '' }
  const r = raw as Record<string, unknown>
  return {
    year: typeof r.year === 'string' ? r.year : '',
    title: typeof r.title === 'string' ? r.title : '',
    venue: typeof r.venue === 'string' ? r.venue : '',
  }
}

/** `expositions` — exhibition history rows. About page only. */
export const expositionsDescriptor: BlockDescriptor<ExpositionsFields> = {
  kind: 'expositions',
  allowedPages: ['about'],
  knobFamilies: [],
  defaultFields: EXPOSITIONS_DEFAULTS,
  editor: ExpositionsEditor,
  renderer: ExpositionsRenderer,
  migrateFields(raw): ExpositionsFields {
    const r = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {}
    const rawRows = Array.isArray(r.rows) ? r.rows : []
    return { rows: rawRows.map(migrateRow) }
  },
}
