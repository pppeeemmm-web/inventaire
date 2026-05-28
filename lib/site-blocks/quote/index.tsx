import type { BlockDescriptor } from '@/lib/site-blocks/registry'
import QuoteRenderer, { QUOTE_DEFAULTS, type QuoteFields } from './QuoteRenderer'
import QuoteEditor from './QuoteEditor'

/** `quote` — pulled-out quote with optional source URL. Universal block. */
export const quoteDescriptor: BlockDescriptor<QuoteFields> = {
  kind: 'quote',
  allowedPages: '*',
  knobFamilies: [],
  defaultFields: QUOTE_DEFAULTS,
  editor: QuoteEditor,
  renderer: QuoteRenderer,
  migrateFields(raw): QuoteFields {
    const r = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {}
    return {
      quote_fr: typeof r.quote_fr === 'string' ? r.quote_fr : '',
      quote_en: typeof r.quote_en === 'string' ? r.quote_en : '',
      attribution_fr: typeof r.attribution_fr === 'string' ? r.attribution_fr : '',
      attribution_en: typeof r.attribution_en === 'string' ? r.attribution_en : '',
      source_url: typeof r.source_url === 'string' ? r.source_url : '',
    }
  },
}
