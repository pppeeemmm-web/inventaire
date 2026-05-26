import {
  canonicalCollectionTheme,
  type ThemeNameRecord,
} from '@/components/public/works-utils'

function patchCollectionRow(
  c: unknown,
  catalogueThemes: ReadonlyArray<ThemeNameRecord>,
): unknown {
  if (!c || typeof c !== 'object') return c
  const row = c as Record<string, unknown>
  return {
    ...row,
    theme: canonicalCollectionTheme(
      {
        theme: typeof row.theme === 'string' ? row.theme : null,
        title_fr: typeof row.title_fr === 'string' ? row.title_fr : null,
        title_en: typeof row.title_en === 'string' ? row.title_en : null,
      },
      catalogueThemes,
    ),
    is_active: true,
  }
}

function patchCollectionList(
  cols: unknown,
  catalogueThemes: ReadonlyArray<ThemeNameRecord>,
): unknown {
  if (!Array.isArray(cols)) return cols
  return cols.map((c) => patchCollectionRow(c, catalogueThemes))
}

/** Normalize collection `theme` labels before R2 persist (fixes stale selection labels). */
export function canonicalizePortfolioConfigThemes(
  config: Record<string, unknown>,
  catalogueThemes: ReadonlyArray<ThemeNameRecord>,
): Record<string, unknown> {
  const out = { ...config }

  if (Array.isArray(out.works_modes)) {
    out.works_modes = out.works_modes.map((mode) => {
      if (!mode || typeof mode !== 'object') return mode
      const m = mode as Record<string, unknown>
      return { ...m, collections: patchCollectionList(m.collections, catalogueThemes) }
    })
  }

  if (Array.isArray(out.works_collections)) {
    out.works_collections = patchCollectionList(out.works_collections, catalogueThemes)
  }

  if (Array.isArray(out.sections)) {
    out.sections = patchCollectionList(out.sections, catalogueThemes)
  }

  return out
}
