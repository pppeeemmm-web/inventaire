import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/supabase.generated'

/** PostgREST max rows per response — paginate for full junction payloads */
export const ATELIER_JUNCTION_RANGE_PAGE = 1000

type ServerSupabase = SupabaseClient<Database>

export async function fetchAllOeuvreThemeLinks(supabase: ServerSupabase): Promise<
  { oeuvre_id: number; theme_id: number }[]
> {
  const rows: { oeuvre_id: number; theme_id: number }[] = []
  for (let from = 0; ; from += ATELIER_JUNCTION_RANGE_PAGE) {
    const { data, error } = await supabase
      .from('oeuvre_theme')
      .select('oeuvre_id, theme_id')
      .order('oeuvre_id', { ascending: true })
      .order('theme_id', { ascending: true })
      .range(from, from + ATELIER_JUNCTION_RANGE_PAGE - 1)
    if (error) {
      console.error('[atelier loader] oeuvre_theme:', error.message)
      break
    }
    if (!data?.length) break
    rows.push(...(data as { oeuvre_id: number; theme_id: number }[]))
    if (data.length < ATELIER_JUNCTION_RANGE_PAGE) break
  }
  return rows
}

export async function fetchAllWorkingGroupWorkLinks(supabase: ServerSupabase): Promise<
  { group_id: string; oeuvre_id: number }[]
> {
  const rows: { group_id: string; oeuvre_id: number }[] = []
  for (let from = 0; ; from += ATELIER_JUNCTION_RANGE_PAGE) {
    const { data, error } = await supabase
      .from('working_group_work')
      .select('group_id, oeuvre_id')
      .order('oeuvre_id', { ascending: true })
      .order('group_id', { ascending: true })
      .range(from, from + ATELIER_JUNCTION_RANGE_PAGE - 1)
    if (error) {
      console.error('[atelier loader] working_group_work:', error.message)
      break
    }
    if (!data?.length) break
    rows.push(...(data as { group_id: string; oeuvre_id: number }[]))
    if (data.length < ATELIER_JUNCTION_RANGE_PAGE) break
  }
  return rows
}
