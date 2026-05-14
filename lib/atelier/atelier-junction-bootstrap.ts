import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/supabase.generated'

/** PostgREST max rows per response — paginate for full junction payloads */
export const ATELIER_JUNCTION_RANGE_PAGE = 1000

/** Chunk size for `.in('oeuvre_id', …)` junction + visibility lookups */
const OEUVRE_ID_IN_CHUNK = 200

type ServerSupabase = SupabaseClient<Database>

export type OeuvreThemeLinkRow = { oeuvre_id: number; theme_id: number }
export type WorkingGroupWorkLinkRow = { group_id: string; oeuvre_id: number }

/** Serializable slice passed RSC → TeamPortalClient (theme/group junction aggregates). */
export interface AtelierJunctionDerived {
  themePublicStats: Record<number, { total: number; pub: number }>
  themePrivateWorks: Record<number, number[]>
  themeWorkCount: Record<number, number>
  groupWorkCount: Record<string, number>
  groupPrivateWorks: Record<string, number[]>
  oeuvreThemeIdsByOeuvre: Record<number, number[]>
  oeuvreGroupIdsByOeuvre: Record<number, string[]>
  themeToGroups: Record<number, string[]>
  groupToThemes: Record<string, number[]>
}

export function emptyAtelierJunctionDerived(): AtelierJunctionDerived {
  return {
    themePublicStats: {},
    themePrivateWorks: {},
    themeWorkCount: {},
    groupWorkCount: {},
    groupPrivateWorks: {},
    oeuvreThemeIdsByOeuvre: {},
    oeuvreGroupIdsByOeuvre: {},
    themeToGroups: {},
    groupToThemes: {},
  }
}

function uniqNums(xs: number[]): number[] {
  return [...new Set(xs)]
}

function uniqStr(xs: string[]): string[] {
  return [...new Set(xs)]
}

/** Merge partial junction payloads (e.g. initial chunk + keyset “load more”). */
export function mergeAtelierJunctionDerived(a: AtelierJunctionDerived, b: AtelierJunctionDerived): AtelierJunctionDerived {
  const out: AtelierJunctionDerived = {
    themePublicStats: { ...a.themePublicStats },
    themePrivateWorks: { ...a.themePrivateWorks },
    themeWorkCount: { ...a.themeWorkCount },
    groupWorkCount: { ...a.groupWorkCount },
    groupPrivateWorks: { ...a.groupPrivateWorks },
    oeuvreThemeIdsByOeuvre: { ...a.oeuvreThemeIdsByOeuvre },
    oeuvreGroupIdsByOeuvre: { ...a.oeuvreGroupIdsByOeuvre },
    themeToGroups: { ...a.themeToGroups },
    groupToThemes: { ...a.groupToThemes },
  }

  for (const [kStr, v] of Object.entries(b.themePublicStats)) {
    const k = Number(kStr)
    const prev = out.themePublicStats[k]
    out.themePublicStats[k] = {
      total: (prev?.total ?? 0) + v.total,
      pub: (prev?.pub ?? 0) + v.pub,
    }
  }

  for (const [kStr, arr] of Object.entries(b.themePrivateWorks)) {
    const k = Number(kStr)
    out.themePrivateWorks[k] = uniqNums([...(out.themePrivateWorks[k] ?? []), ...arr])
  }

  for (const [kStr, n] of Object.entries(b.themeWorkCount)) {
    const k = Number(kStr)
    out.themeWorkCount[k] = (out.themeWorkCount[k] ?? 0) + n
  }

  for (const [gid, n] of Object.entries(b.groupWorkCount)) {
    out.groupWorkCount[gid] = (out.groupWorkCount[gid] ?? 0) + n
  }

  for (const [gid, arr] of Object.entries(b.groupPrivateWorks)) {
    out.groupPrivateWorks[gid] = uniqNums([...(out.groupPrivateWorks[gid] ?? []), ...arr])
  }

  for (const [oidStr, arr] of Object.entries(b.oeuvreThemeIdsByOeuvre)) {
    const oid = Number(oidStr)
    out.oeuvreThemeIdsByOeuvre[oid] = uniqNums([...(out.oeuvreThemeIdsByOeuvre[oid] ?? []), ...arr])
  }

  for (const [oidStr, arr] of Object.entries(b.oeuvreGroupIdsByOeuvre)) {
    const oid = Number(oidStr)
    out.oeuvreGroupIdsByOeuvre[oid] = uniqStr([...(out.oeuvreGroupIdsByOeuvre[oid] ?? []), ...arr])
  }

  for (const [tidStr, arr] of Object.entries(b.themeToGroups)) {
    const tid = Number(tidStr)
    out.themeToGroups[tid] = uniqStr([...(out.themeToGroups[tid] ?? []), ...arr])
  }

  for (const [gid, arr] of Object.entries(b.groupToThemes)) {
    out.groupToThemes[gid] = uniqNums([...(out.groupToThemes[gid] ?? []), ...arr])
  }

  return out
}

type OeuvreJunctionInput = { OeuvreID: number; is_public?: boolean | null }

/** Build junction aggregates for a loaded œuvre batch (matches legacy TeamPortal bootstrap). */
export function deriveAtelierJunctionState(
  oeuvres: OeuvreJunctionInput[],
  oeuvreThemeRows: OeuvreThemeLinkRow[],
  workingGroupWorkRows: WorkingGroupWorkLinkRow[],
): AtelierJunctionDerived {
  const themePublicStats: Record<number, { total: number; pub: number }> = {}
  const themeAllWorks: Record<number, number[]> = {}
  const oeuvreThemeIdsByOeuvre: Record<number, number[]> = {}
  const oeuvreGroupIdsByOeuvre: Record<number, string[]> = {}
  const themeWorkCount: Record<number, number> = {}
  const groupWorkCount: Record<string, number> = {}
  const themeToGroups: Record<number, Set<string>> = {}
  const groupToThemes: Record<string, Set<number>> = {}
  const groupAllWorks: Record<string, number[]> = {}

  const oeuvreIsPublic: Record<number, boolean> = {}
  for (const o of oeuvres) oeuvreIsPublic[o.OeuvreID] = o.is_public ?? false

  const oeuvreMap: Record<number, true> = {}
  for (const o of oeuvres) oeuvreMap[o.OeuvreID] = true

  for (const row of oeuvreThemeRows) {
    if (!oeuvreMap[row.oeuvre_id]) continue
    if (!themePublicStats[row.theme_id]) themePublicStats[row.theme_id] = { total: 0, pub: 0 }
    themePublicStats[row.theme_id].total++
    themeWorkCount[row.theme_id] = (themeWorkCount[row.theme_id] ?? 0) + 1
    if (oeuvreIsPublic[row.oeuvre_id]) themePublicStats[row.theme_id].pub++
    if (!themeAllWorks[row.theme_id]) themeAllWorks[row.theme_id] = []
    themeAllWorks[row.theme_id].push(row.oeuvre_id)

    if (!oeuvreThemeIdsByOeuvre[row.oeuvre_id]) oeuvreThemeIdsByOeuvre[row.oeuvre_id] = []
    oeuvreThemeIdsByOeuvre[row.oeuvre_id].push(row.theme_id)
  }

  for (const row of workingGroupWorkRows) {
    if (!oeuvreMap[row.oeuvre_id]) continue
    groupWorkCount[row.group_id] = (groupWorkCount[row.group_id] ?? 0) + 1
    if (!groupAllWorks[row.group_id]) groupAllWorks[row.group_id] = []
    groupAllWorks[row.group_id].push(row.oeuvre_id)

    if (!oeuvreGroupIdsByOeuvre[row.oeuvre_id]) oeuvreGroupIdsByOeuvre[row.oeuvre_id] = []
    oeuvreGroupIdsByOeuvre[row.oeuvre_id].push(row.group_id)

    if (oeuvreThemeIdsByOeuvre[row.oeuvre_id]) {
      for (const tId of oeuvreThemeIdsByOeuvre[row.oeuvre_id]) {
        if (!themeToGroups[tId]) themeToGroups[tId] = new Set()
        themeToGroups[tId].add(row.group_id)
        if (!groupToThemes[row.group_id]) groupToThemes[row.group_id] = new Set()
        groupToThemes[row.group_id].add(tId)
      }
    }
  }

  const t2g: Record<number, string[]> = {}
  for (const [k, v] of Object.entries(themeToGroups)) t2g[Number(k)] = Array.from(v)
  const g2t: Record<string, number[]> = {}
  for (const [k, v] of Object.entries(groupToThemes)) g2t[k] = Array.from(v)

  return {
    themePublicStats,
    themePrivateWorks: themeAllWorks,
    themeWorkCount,
    groupWorkCount,
    groupPrivateWorks: groupAllWorks,
    oeuvreThemeIdsByOeuvre,
    oeuvreGroupIdsByOeuvre,
    themeToGroups: t2g,
    groupToThemes: g2t,
  }
}

export async function fetchOeuvrePublicFlagsForIds(
  supabase: ServerSupabase,
  oeuvreIds: number[],
): Promise<Map<number, boolean>> {
  const m = new Map<number, boolean>()
  const uniq = [...new Set(oeuvreIds)]
  for (let i = 0; i < uniq.length; i += OEUVRE_ID_IN_CHUNK) {
    const slice = uniq.slice(i, i + OEUVRE_ID_IN_CHUNK)
    const { data, error } = await supabase
      .from('Oeuvres')
      .select('OeuvreID, is_public')
      .in('OeuvreID', slice)
      .is('deleted_at', null)
    if (error) {
      console.error('[atelier junction] Oeuvres flags:', error.message)
      continue
    }
    for (const row of (data ?? []) as { OeuvreID: number; is_public: boolean | null }[]) {
      m.set(row.OeuvreID, row.is_public ?? false)
    }
  }
  return m
}

export async function fetchOeuvreThemeLinksForOeuvreIds(
  supabase: ServerSupabase,
  oeuvreIds: number[],
): Promise<OeuvreThemeLinkRow[]> {
  const rows: OeuvreThemeLinkRow[] = []
  const uniq = [...new Set(oeuvreIds)]
  for (let i = 0; i < uniq.length; i += OEUVRE_ID_IN_CHUNK) {
    const slice = uniq.slice(i, i + OEUVRE_ID_IN_CHUNK)
    const { data, error } = await supabase
      .from('oeuvre_theme')
      .select('oeuvre_id, theme_id')
      .in('oeuvre_id', slice)
    if (error) {
      console.error('[atelier junction] oeuvre_theme:', error.message)
      continue
    }
    rows.push(...((data ?? []) as OeuvreThemeLinkRow[]))
  }
  return rows
}

export async function fetchWorkingGroupWorkLinksForOeuvreIds(
  supabase: ServerSupabase,
  oeuvreIds: number[],
): Promise<WorkingGroupWorkLinkRow[]> {
  const rows: WorkingGroupWorkLinkRow[] = []
  const uniq = [...new Set(oeuvreIds)]
  for (let i = 0; i < uniq.length; i += OEUVRE_ID_IN_CHUNK) {
    const slice = uniq.slice(i, i + OEUVRE_ID_IN_CHUNK)
    const { data, error } = await supabase
      .from('working_group_work')
      .select('group_id, oeuvre_id')
      .in('oeuvre_id', slice)
    if (error) {
      console.error('[atelier junction] working_group_work:', error.message)
      continue
    }
    rows.push(...((data ?? []) as WorkingGroupWorkLinkRow[]))
  }
  return rows
}

export async function fetchAllOeuvreThemeLinks(supabase: ServerSupabase): Promise<OeuvreThemeLinkRow[]> {
  const rows: OeuvreThemeLinkRow[] = []
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
    rows.push(...(data as OeuvreThemeLinkRow[]))
    if (data.length < ATELIER_JUNCTION_RANGE_PAGE) break
  }
  return rows
}

export async function fetchAllWorkingGroupWorkLinks(supabase: ServerSupabase): Promise<WorkingGroupWorkLinkRow[]> {
  const rows: WorkingGroupWorkLinkRow[] = []
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
    rows.push(...(data as WorkingGroupWorkLinkRow[]))
    if (data.length < ATELIER_JUNCTION_RANGE_PAGE) break
  }
  return rows
}
