'use server'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { isPublicSiteTrackedPath, normalizeTrackedPath } from '@/lib/public-site-paths'
import { dict, type Lang } from '@/lib/i18n/dictionary'
import { missingPageViewVisitorColumns } from '@/lib/page-view-schema'

/** Internal bucket keys (not hostnames) — mapped to UI copy via `dict[lang]`. */
const REF_BUCKET_DIRECT = '__pem_analytics_direct__'
const REF_BUCKET_INVALID = '__pem_analytics_bad_ref__'
const COUNTRY_UNKNOWN_CODE = '__pem_unknown_country__'

function getPageViewServiceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

/** PostgREST default max rows — must paginate for correct totals / breakdowns */
const PAGE_SIZE = 1000

type PageViewRow = {
  path: string
  referrer: string | null
  country: string | null
  created_at: string
  visitor_id: string | null
  is_team_session: boolean | null
}

export type DayCount = { date: string; views: number }
export type AnalyticsComparison = {
  current: number
  previous: number
  deltaPercent: number | null
}
export type AnalyticsSourceQuality = {
  referrer: string
  views: number
  netVisitors: number
  viewsPerVisitor: number | null
}

export type AnalyticsResult =
  | { error: string }
  | {
      ok: true
      /** Views counted toward aggregates (see scope) */
      pageviews: number
      /** Distinct non-null visitor_id in scope (browser localStorage id). */
      uniqueVisitors: number
      /** Distinct visitor_id excluding team Atelier sessions and ANALYTICS_EXCLUDE_VISITOR_IDS. */
      netUniqueVisitors: number
      /** Rows whose path is not a known public route — only when scope is public_site */
      offSitePageviews?: number
      scope: 'public_site' | 'all'
      comparisons: {
        pageviews: AnalyticsComparison
        netUniqueVisitors: AnalyticsComparison
        viewsPerNetVisitor: AnalyticsComparison
      }
      viewsPerNetVisitor: number | null
      returningVisitors: number
      returningVisitorRate: number | null
      onePageVisitors: number
      onePageVisitorRate: number | null
      browsingDepth: { bucket: '1' | '2_3' | '4_7' | '8_plus'; visitors: number }[]
      topPages: { path: string; views: number }[]
      topLandingPages: { path: string; visitors: number }[]
      topCountries: { country: string; views: number }[]
      topReferrers: { referrer: string; views: number }[]
      sourceQuality: AnalyticsSourceQuality[]
      trend: DayCount[]
    }

function parseExcludedVisitorIds(): Set<string> {
  const raw = process.env.ANALYTICS_EXCLUDE_VISITOR_IDS?.trim()
  if (!raw) return new Set()
  return new Set(
    raw
      .split(/[\s,;]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  )
}

function countryLabel(code: string, lang: Lang): string {
  const d = dict[lang]
  if (code === COUNTRY_UNKNOWN_CODE) return d.analytics_country_unknown
  if (/^[A-Za-z]{2}$/.test(code)) {
    try {
      const loc = lang === 'en' ? 'en-GB' : 'fr-FR'
      return new Intl.DisplayNames([loc], { type: 'region' }).of(code.toUpperCase()) ?? code
    } catch {
      return code
    }
  }
  return code
}

function referrerBucketLabel(key: string, lang: Lang): string {
  const d = dict[lang]
  if (key === REF_BUCKET_DIRECT) return d.analytics_referrer_direct
  if (key === REF_BUCKET_INVALID) return d.analytics_referrer_invalid
  return key
}

function referrerBucket(row: PageViewRow): string {
  const refRaw = row.referrer?.trim()
  if (!refRaw) return REF_BUCKET_DIRECT
  try {
    return new URL(refRaw).hostname.replace(/^www\./, '')
  } catch {
    return REF_BUCKET_INVALID
  }
}

function percentDelta(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null
  return Math.round(((current - previous) / previous) * 100)
}

function perVisitor(views: number, visitors: number): number | null {
  if (visitors <= 0) return null
  return Math.round((views / visitors) * 10) / 10
}

function comparison(current: number | null, previous: number | null): AnalyticsComparison {
  const c = current ?? 0
  const p = previous ?? 0
  return {
    current: c,
    previous: p,
    deltaPercent: percentDelta(c, p),
  }
}

const PAGE_VIEW_SELECT_LEGACY = 'path, referrer, country, created_at' as const

async function fetchAllPageViews(
  sb: SupabaseClient,
  since: string
): Promise<{ rows: PageViewRow[] | null; error: string | null }> {
  const rows: PageViewRow[] = []
  let from = 0
  let useLegacy = false

  for (;;) {
    const res = useLegacy
      ? await sb
          .from('page_view')
          .select(PAGE_VIEW_SELECT_LEGACY)
          .gte('created_at', since)
          .order('created_at', { ascending: true })
          .range(from, from + PAGE_SIZE - 1)
      : await sb
          .from('page_view')
          .select('path, referrer, country, created_at, visitor_id, is_team_session')
          .gte('created_at', since)
          .order('created_at', { ascending: true })
          .range(from, from + PAGE_SIZE - 1)

    const { data, error } = res

    if (error) {
      if (from === 0 && !useLegacy && missingPageViewVisitorColumns(error.message)) {
        useLegacy = true
        continue
      }
      return { rows: null, error: error.message }
    }
    if (!data?.length) break

    if (useLegacy) {
      for (const r of data as { path: string; referrer: string | null; country: string | null; created_at: string | null }[]) {
        rows.push({
          path: r.path,
          referrer: r.referrer,
          country: r.country,
          created_at: r.created_at ?? '',
          visitor_id: null,
          is_team_session: null,
        })
      }
    } else {
      rows.push(...(data as PageViewRow[]))
    }
    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return { rows, error: null }
}

export async function getAnalyticsStats(
  days: number,
  opts?: { scope?: 'public_site' | 'all'; lang?: Lang }
): Promise<AnalyticsResult> {
  const sb = getPageViewServiceClient()
  if (!sb) return { error: 'Missing Supabase configuration.' }

  const lang: Lang = opts?.lang === 'en' ? 'en' : 'fr'
  const scope = opts?.scope ?? 'public_site'
  const now = Date.now()
  const currentSinceMs = now - days * 86400 * 1000
  const previousSinceMs = now - days * 2 * 86400 * 1000
  const since = new Date(previousSinceMs).toISOString()

  const { rows, error } = await fetchAllPageViews(sb, since)
  if (error) return { error }

  const allRows = rows ?? []
  const scopedAllRows =
    scope === 'public_site' ? allRows.filter((r) => isPublicSiteTrackedPath(r.path)) : allRows
  const scopedRows = scopedAllRows.filter((r) => {
    const time = Date.parse(r.created_at)
    return Number.isFinite(time) && time >= currentSinceMs
  })
  const previousRows = scopedAllRows.filter((r) => {
    const time = Date.parse(r.created_at)
    return Number.isFinite(time) && time >= previousSinceMs && time < currentSinceMs
  })
  const offSitePageviews =
    scope === 'public_site'
      ? allRows.filter((r) => {
          const time = Date.parse(r.created_at)
          return Number.isFinite(time) && time >= currentSinceMs && !isPublicSiteTrackedPath(r.path)
        }).length
      : undefined

  const pageviews = scopedRows.length

  const excludedIds = parseExcludedVisitorIds()
  const uniqueSet = new Set<string>()
  const netSet = new Set<string>()
  const previousNetSet = new Set<string>()
  for (const row of scopedRows) {
    const vid = row.visitor_id?.trim()
    if (!vid) continue
    uniqueSet.add(vid)
    if (row.is_team_session === true) continue
    if (excludedIds.has(vid.toLowerCase())) continue
    netSet.add(vid)
  }
  for (const row of previousRows) {
    const vid = row.visitor_id?.trim()
    if (!vid) continue
    if (row.is_team_session === true) continue
    if (excludedIds.has(vid.toLowerCase())) continue
    previousNetSet.add(vid)
  }
  const uniqueVisitors = uniqueSet.size
  const netUniqueVisitors = netSet.size
  const previousPageviews = previousRows.length
  const previousNetUniqueVisitors = previousNetSet.size
  const viewsPerNetVisitor = perVisitor(pageviews, netUniqueVisitors)
  const previousViewsPerNetVisitor = perVisitor(previousPageviews, previousNetUniqueVisitors)

  const pageCounts: Record<string, number> = {}
  const countryByCode: Record<string, number> = {}
  const referrerCounts: Record<string, number> = {}
  const dayCounts: Record<string, number> = {}
  const viewsByNetVisitor: Record<string, number> = {}
  const firstSeenByNetVisitor: Record<string, PageViewRow> = {}
  const sourceViews: Record<string, number> = {}
  const sourceVisitors: Record<string, Set<string>> = {}

  for (const row of scopedRows) {
    const path = normalizeTrackedPath(row.path)
    pageCounts[path] = (pageCounts[path] ?? 0) + 1

    const code = row.country?.trim() || COUNTRY_UNKNOWN_CODE
    countryByCode[code] = (countryByCode[code] ?? 0) + 1

    const source = referrerBucket(row)
    referrerCounts[source] = (referrerCounts[source] ?? 0) + 1

    const day = row.created_at.slice(0, 10)
    dayCounts[day] = (dayCounts[day] ?? 0) + 1

    const vid = row.visitor_id?.trim()
    if (!vid || !netSet.has(vid)) continue

    viewsByNetVisitor[vid] = (viewsByNetVisitor[vid] ?? 0) + 1
    const first = firstSeenByNetVisitor[vid]
    if (!first || row.created_at < first.created_at) {
      firstSeenByNetVisitor[vid] = row
    }
    sourceViews[source] = (sourceViews[source] ?? 0) + 1
    sourceVisitors[source] ??= new Set<string>()
    sourceVisitors[source].add(vid)
  }

  const top = <T extends string>(counts: Record<T, number>, n: number) =>
    Object.entries(counts)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, n)

  const countryByLabel: Record<string, number> = {}
  for (const [code, v] of Object.entries(countryByCode)) {
    const label = countryLabel(code, lang)
    countryByLabel[label] = (countryByLabel[label] ?? 0) + v
  }

  const trend: DayCount[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400 * 1000)
    const key = d.toISOString().slice(0, 10)
    trend.push({ date: key, views: dayCounts[key] ?? 0 })
  }

  return {
    ok: true,
    pageviews,
    uniqueVisitors,
    netUniqueVisitors,
    ...(offSitePageviews !== undefined && offSitePageviews > 0 ? { offSitePageviews } : {}),
    scope,
    topPages: top(pageCounts, 10).map(([path, views]) => ({ path, views: views as number })),
    topCountries: Object.entries(countryByLabel)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([country, views]) => ({ country, views })),
    topReferrers: top(referrerCounts, 12).map(([referrer, views]) => ({
      referrer: referrerBucketLabel(referrer, lang),
      views: views as number,
    })),
    sourceQuality: Object.entries(sourceViews)
      .map(([referrer, views]) => {
        const visitors = sourceVisitors[referrer]?.size ?? 0
        return {
          referrer: referrerBucketLabel(referrer, lang),
          views,
          netVisitors: visitors,
          viewsPerVisitor: perVisitor(views, visitors),
        }
      })
      .sort((a, b) => b.netVisitors - a.netVisitors || b.views - a.views)
      .slice(0, 8),
    topLandingPages: top(
      Object.values(firstSeenByNetVisitor).reduce<Record<string, number>>((acc, row) => {
        const path = normalizeTrackedPath(row.path)
        acc[path] = (acc[path] ?? 0) + 1
        return acc
      }, {}),
      8
    ).map(([path, visitors]) => ({ path, visitors: visitors as number })),
    comparisons: {
      pageviews: comparison(pageviews, previousPageviews),
      netUniqueVisitors: comparison(netUniqueVisitors, previousNetUniqueVisitors),
      viewsPerNetVisitor: comparison(viewsPerNetVisitor, previousViewsPerNetVisitor),
    },
    viewsPerNetVisitor,
    returningVisitors: [...netSet].filter((vid) => previousNetSet.has(vid)).length,
    returningVisitorRate:
      netUniqueVisitors > 0
        ? Math.round((([...netSet].filter((vid) => previousNetSet.has(vid)).length / netUniqueVisitors) * 100))
        : null,
    onePageVisitors: Object.values(viewsByNetVisitor).filter((v) => v === 1).length,
    onePageVisitorRate:
      netUniqueVisitors > 0
        ? Math.round((Object.values(viewsByNetVisitor).filter((v) => v === 1).length / netUniqueVisitors) * 100)
        : null,
    browsingDepth: [
      { bucket: '1', visitors: Object.values(viewsByNetVisitor).filter((v) => v === 1).length },
      { bucket: '2_3', visitors: Object.values(viewsByNetVisitor).filter((v) => v >= 2 && v <= 3).length },
      { bucket: '4_7', visitors: Object.values(viewsByNetVisitor).filter((v) => v >= 4 && v <= 7).length },
      { bucket: '8_plus', visitors: Object.values(viewsByNetVisitor).filter((v) => v >= 8).length },
    ],
    trend,
  }
}
