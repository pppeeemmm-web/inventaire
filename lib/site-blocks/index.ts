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
import { biographieDescriptor } from './biographie'
import { approachDescriptor } from './approach'
import { themesDescriptor } from './themes'
import { materialsDescriptor } from './materials'
import { statementDescriptor } from './statement'
import { dividerDescriptor } from './divider'
import { contactDescriptor } from './contact'
import { cvDescriptor } from './cv'
import { expositionsDescriptor } from './expositions'
import { presseDescriptor } from './presse'
import { worksModesDescriptor } from './works_modes'

// Register in alphabetical-by-kind order so the editor's "Add block" menu
// renders deterministically across page reloads.
registerBlock(approachDescriptor)
registerBlock(biographieDescriptor)
registerBlock(contactDescriptor)
registerBlock(cvDescriptor)
registerBlock(dividerDescriptor)
registerBlock(expositionsDescriptor)
registerBlock(materialsDescriptor)
registerBlock(presseDescriptor)
registerBlock(statementDescriptor)
registerBlock(textDescriptor)
registerBlock(themesDescriptor)
registerBlock(worksModesDescriptor)

export { registerBlock, getDescriptor, kindsAllowedOnPage, isKindAllowedOnPage, BLOCKS }
export type { BlockDescriptor, BlockEditorProps, BlockRendererProps, BlockEditorCtx, BlockRendererCtx, KnobFamily } from './registry'
