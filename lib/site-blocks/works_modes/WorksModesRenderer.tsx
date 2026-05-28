/**
 * works_modes public renderer.
 *
 * The /works page still renders via the legacy WorksClient path (which reads
 * config.works_modes directly). This renderer returns null so the registry
 * iteration on /works produces no output — the page shell handles the actual
 * layout dispatch outside the block iteration loop.
 *
 * Phase 2+ will wire the actual layout here once WorksPageClient is refactored
 * to pass works[] + modeMap through the block rendering context.
 */

export type WorksModesFields = {
  /** References config.works_modes[].id */
  mode_id: string
  /** Display hints — populated by deriveDefaultPages; may be stale if the
   *  mode is later renamed via the legacy editor. */
  label_fr?: string
  label_en?: string
  layout?: string
}

export const WORKS_MODES_DEFAULTS: WorksModesFields = {
  mode_id: '',
  label_fr: '',
  label_en: '',
  layout: 'carousel',
}

export default function WorksModesRenderer(): null {
  return null
}
