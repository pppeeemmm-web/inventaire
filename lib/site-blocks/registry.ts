/**
 * Block descriptor registry.
 *
 * Each block kind owns one folder under `lib/site-blocks/<kind>/` exporting
 * a `BlockDescriptor` from its `index.ts(x)`. Add a kind:
 *   1. New folder + descriptor + editor + renderer
 *   2. One import + entry in `BLOCKS` below
 *
 * The editor uses `allowedPages` to filter the "Add block" menu per page;
 * a corrupted persisted block whose page ∉ allowedPages is dropped/relocated.
 *
 * `knobFamilies` declares which knob groups the renderer reads (Phase 2 —
 * cascade resolution will pass only those families to the renderer; today
 * the renderers ignore the knobs prop).
 */

import type { ComponentType } from 'react'
import type {
  Block,
  BlockKind,
  Page,
} from '@/lib/portfolio-config-types'
import type { KnobValues } from './knob-types'

// Re-exported from knob-types so existing imports from registry stay stable.
export type { KnobFamily } from './knob-types'
import type { KnobFamily } from './knob-types'

/** Generic shape — descriptor authors narrow Fields via type parameter. */
export interface BlockDescriptor<Fields extends Record<string, unknown> = Record<string, unknown>> {
  kind: BlockKind
  /** Pages this kind is allowed on. `'*'` means universal. */
  allowedPages: Page[] | '*'
  /** Knob families this kind's renderer reads (Phase 2). */
  knobFamilies: KnobFamily[]
  /** Default fields for a freshly added block. */
  defaultFields: Fields
  /** Editor component — rendered inside SiteEditorPanel. */
  editor: ComponentType<BlockEditorProps<Fields>>
  /** Renderer component — rendered on the public page. */
  renderer: ComponentType<BlockRendererProps<Fields>>
  /** Optional: per-kind field migration on persist read. */
  migrateFields?: (raw: unknown) => Fields
  /** Optional: pre-publish validation, returns error keys for the editor. */
  validate?: (fields: Fields) => string[] | null
  /**
   * When true, blocks of this kind are auto-generated from other config
   * sources (e.g. works_modes from config.works_modes, hero/identity from
   * landing config) and should NOT appear in the PagesEditor "Add block"
   * dropdown. Blocks can still be reordered/toggled if they already exist.
   */
  systemManaged?: boolean
}

export interface BlockEditorProps<Fields extends Record<string, unknown>> {
  block: Block
  fields: Fields
  onChange: (patch: Partial<Fields>) => void
  /** Runtime hooks the editor may need (current page, locales, etc.). */
  ctx: BlockEditorCtx
}

export interface BlockEditorCtx {
  page: Page
  lang: 'fr' | 'en'
}

export interface BlockRendererProps<Fields extends Record<string, unknown>> {
  block: Block
  fields: Fields
  /** Site/page/block-cascaded knobs resolved by resolveKnobs() (Phase 2). */
  knobs?: KnobValues
  /** Runtime context for the renderer (e.g. site theme, locale). */
  ctx: BlockRendererCtx
}

export interface BlockRendererCtx {
  page: Page
  lang: 'fr' | 'en'
}

// ── Registry ──────────────────────────────────────────────────────────────

/**
 * Block kind → descriptor. Empty until the first slice (text / hero / etc.)
 * lands. Lookup via `getDescriptor(kind)` so callers can handle missing
 * kinds gracefully.
 */
export const BLOCKS = {} as Partial<Record<BlockKind, BlockDescriptor>>

export function registerBlock<Fields extends Record<string, unknown>>(d: BlockDescriptor<Fields>): void {
  if (BLOCKS[d.kind]) {
    // eslint-disable-next-line no-console
    console.warn(`[site-blocks] kind "${d.kind}" already registered — overwriting`)
  }
  // The descriptor's Fields is narrower than the registry's default
  // Record<string, unknown>; the cast is safe because we only round-trip
  // through the registry via `kind`.
  BLOCKS[d.kind] = d as unknown as BlockDescriptor
}

export function getDescriptor(kind: BlockKind): BlockDescriptor | undefined {
  return BLOCKS[kind]
}

export function kindsAllowedOnPage(page: Page): BlockKind[] {
  return (Object.values(BLOCKS) as BlockDescriptor[])
    .filter(d => d.allowedPages === '*' || d.allowedPages.includes(page))
    .map(d => d.kind)
}

export function isKindAllowedOnPage(kind: BlockKind, page: Page): boolean {
  const d = BLOCKS[kind]
  if (!d) return false
  return d.allowedPages === '*' || d.allowedPages.includes(page)
}
