import type { BlockDescriptor } from '@/lib/site-blocks/registry'
import DividerRenderer, { DIVIDER_DEFAULTS, type DividerFields } from './DividerRenderer'
import DividerEditor from './DividerEditor'

/** `divider` — visual break (rule / spacer / ornament). Universal. */
export const dividerDescriptor: BlockDescriptor<DividerFields> = {
  kind: 'divider',
  allowedPages: '*',
  knobFamilies: [],
  defaultFields: DIVIDER_DEFAULTS,
  editor: DividerEditor,
  renderer: DividerRenderer,
  migrateFields(raw): DividerFields {
    const r = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {}
    const style = (r.style === 'spacer' || r.style === 'ornament') ? r.style : 'rule'
    return { style: style as DividerFields['style'] }
  },
}
