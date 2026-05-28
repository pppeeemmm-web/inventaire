import type { BlockDescriptor } from '@/lib/site-blocks/registry'
import WorksModesRenderer, { WORKS_MODES_DEFAULTS, type WorksModesFields } from './WorksModesRenderer'
import WorksModesEditor from './WorksModesEditor'

/**
 * `works_modes` — auto-generated per active WorksMode in config.works_modes.
 *
 * systemManaged = true: blocks are NOT manually addable via PagesEditor's
 * "Add block" menu (they appear because deriveDefaultPages / migratePages
 * auto-populates them from config.works_modes). Authors can reorder and
 * toggle visibility; detailed editing happens in the legacy Diffusion section.
 *
 * The renderer returns null — /works still dispatches layouts via the legacy
 * WorksClient path. A future session will wire the renderer once WorksPageClient
 * is refactored to pass works[] + modeMap through the block context.
 */
export const worksModesDescriptor: BlockDescriptor<WorksModesFields> = {
  kind: 'works_modes',
  allowedPages: ['works'],
  knobFamilies: ['light', 'shadow', 'frame'],
  defaultFields: WORKS_MODES_DEFAULTS,
  systemManaged: true,
  editor: WorksModesEditor,
  renderer: WorksModesRenderer,
  migrateFields(raw): WorksModesFields {
    const r = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {}
    return {
      mode_id: typeof r.mode_id === 'string' ? r.mode_id : '',
      label_fr: typeof r.label_fr === 'string' ? r.label_fr : undefined,
      label_en: typeof r.label_en === 'string' ? r.label_en : undefined,
      layout: typeof r.layout === 'string' ? r.layout : undefined,
    }
  },
}
