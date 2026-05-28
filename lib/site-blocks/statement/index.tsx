import type { BlockDescriptor } from '@/lib/site-blocks/registry'
import StatementRenderer, { STATEMENT_DEFAULTS, type StatementFields } from './StatementRenderer'
import StatementEditor from './StatementEditor'

/** `statement` — universal pulled-out quote in display-serif. */
export const statementDescriptor: BlockDescriptor<StatementFields> = {
  kind: 'statement',
  allowedPages: '*',
  knobFamilies: [],
  defaultFields: STATEMENT_DEFAULTS,
  editor: StatementEditor,
  renderer: StatementRenderer,
  migrateFields(raw): StatementFields {
    const r = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {}
    return {
      quote_fr: typeof r.quote_fr === 'string' ? r.quote_fr : '',
      quote_en: typeof r.quote_en === 'string' ? r.quote_en : '',
      attribution_fr: typeof r.attribution_fr === 'string' ? r.attribution_fr : '',
      attribution_en: typeof r.attribution_en === 'string' ? r.attribution_en : '',
    }
  },
}
