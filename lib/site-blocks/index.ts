/**
 * Barrel that imports every shipped block descriptor so registration runs
 * on first import. Public pages and the editor should import THIS module
 * (not the registry directly) to guarantee descriptors are registered.
 *
 * Adding a kind: drop a folder under `lib/site-blocks/<kind>/`, import the
 * descriptor here, and call `registerBlock(...)`.
 */

import { registerBlock, getDescriptor, kindsAllowedOnPage, isKindAllowedOnPage, BLOCKS } from './registry'
import { textDescriptor } from './text'

// Register in alphabetical-by-kind order so the editor's "Add block" menu
// renders deterministically across page reloads.
registerBlock(textDescriptor)

export { registerBlock, getDescriptor, kindsAllowedOnPage, isKindAllowedOnPage, BLOCKS }
export type { BlockDescriptor, BlockEditorProps, BlockRendererProps, BlockEditorCtx, BlockRendererCtx, KnobFamily } from './registry'
