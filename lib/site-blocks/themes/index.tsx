import type { BlockDescriptor } from '@/lib/site-blocks/registry'
import ThemesRenderer, { THEMES_DEFAULTS, type ThemesFields } from './ThemesRenderer'
import ThemesEditor from './ThemesEditor'

/** `themes` — chip row of practice themes. About page. */
export const themesDescriptor: BlockDescriptor<ThemesFields> = {
  kind: 'themes',
  allowedPages: ['about'],
  knobFamilies: [],
  defaultFields: THEMES_DEFAULTS,
  editor: ThemesEditor,
  renderer: ThemesRenderer,
  migrateFields(raw): ThemesFields {
    const r = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {}
    const themes = Array.isArray(r.themes)
      ? r.themes.filter((s: unknown): s is string => typeof s === 'string')
      : []
    return { themes }
  },
}
