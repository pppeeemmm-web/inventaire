/** Public catalogue theme names — `theme` + `oeuvre_theme` (same as Atelier). */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/supabase.generated'

type ThemeRow = { id: number; name: string | null }
type OeuvreThemeLinkRow = { oeuvre_id: number; theme_id: number }

export function buildOeuvreThemeNamesMap(
  themeRecords: ThemeRow[],
  oeuvreThemes: OeuvreThemeLinkRow[],
): Map<number, string[]> {
  const idToName = Object.fromEntries(
    themeRecords
      .filter((r) => typeof r.id === 'number' && r.name)
      .map((r) => [r.id, r.name as string]),
  )
  const oeuvreThemeMap = new Map<number, string[]>()
  for (const ot of oeuvreThemes) {
    if (typeof ot.oeuvre_id !== 'number' || typeof ot.theme_id !== 'number') continue
    const name = idToName[ot.theme_id]
    if (!name) continue
    if (!oeuvreThemeMap.has(ot.oeuvre_id)) oeuvreThemeMap.set(ot.oeuvre_id, [])
    oeuvreThemeMap.get(ot.oeuvre_id)!.push(name)
  }
  return oeuvreThemeMap
}

export async function fetchPublicOeuvreThemeNamesMap(
  supabase: SupabaseClient<Database>,
): Promise<Map<number, string[]>> {
  const [{ data: themeRecords, error: themeErr }, { data: oeuvreThemes, error: linkErr }] =
    await Promise.all([
      supabase.from('theme').select('id, name'),
      supabase.from('oeuvre_theme').select('oeuvre_id, theme_id'),
    ])
  if (themeErr) console.error('[fetchPublicOeuvreThemeNamesMap] theme:', themeErr.message)
  if (linkErr) console.error('[fetchPublicOeuvreThemeNamesMap] oeuvre_theme:', linkErr.message)
  return buildOeuvreThemeNamesMap(themeRecords ?? [], oeuvreThemes ?? [])
}
