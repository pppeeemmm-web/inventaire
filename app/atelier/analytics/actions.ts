'use server'

import { createClient } from '@supabase/supabase-js'
import { isPublicSiteTrackedPath, normalizeTrackedPath } from '@/lib/public-site-paths'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/** PostgREST default max rows — must paginate for correct totals / breakdowns */
const PAGE_SIZE = 1000

type PageViewRow = {
  path: string
  referrer: string | null
  country: string | null
  created_at: string
}

export type DayCount = { date: string; views: number }

export type AnalyticsResult =
  | { error: string }
  | {
      ok: true
      /** Views counted toward aggregates (see scope) */
      pageviews: number
      /** Rows whose path is not a known public route — only when scope is public_site */
      offSitePageviews?: number
      scope: 'public_site' | 'all'
      topPages: { path: string; views: number }[]
      topCountries: { country: string; views: number }[]
      topReferrers: { referrer: string; views: number }[]
      trend: DayCount[]
    }

const regionFr = new Intl.DisplayNames(['fr'], { type: 'region' })

function countryLabel(code: string): string {
  if (code === 'Inconnu') return 'Inconnu'
  if (/^[A-Za-z]{2}$/.test(code)) {
    try {
      return regionFr.of(code.toUpperCase()) ?? code
    } catch {
      return code
    }
  }
  return code
}

async function fetchAllPageViews(since: string): Promise<{ rows: PageViewRow[] | null; error: string | null }> {
  const rows: PageViewRow[] = []
  let from = 0
  for (;;) {
    const { data, error } = await sb
      .from('page_view')
      .select('path, referrer, country, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)

    if (error) return { rows: null, error: error.message }
    if (!data?.length) break
    rows.push(...(data as PageViewRow[]))
    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return { rows, error: null }
}

export async function getAnalyticsStats(
  days: number,
  opts?: { scope?: 'public_site' | 'all' }
): Promise<AnalyticsResult> {
  const scope = opts?.scope ?? 'public_site'
  const since = new Date(Date.now() - days * 86400 * 1000).toISOString()

  const { rows, error } = await fetchAllPageViews(since)
  if (error) return { error }

  const scopedRows =
    scope === 'public_site' ? rows.filter((r) => isPublicSiteTrackedPath(r.path)) : rows
  const offSitePageviews =
    scope === 'public_site' ? rows.length - scopedRows.length : undefined

  const pageviews = scopedRows.length

  const pageCounts: Record<string, number> = {}
  const countryByCode: Record<string, number> = {}
  const referrerCounts: Record<string, number> = {}
  const dayCounts: Record<string, number> = {}

  for (const row of scopedRows) {
    const path = normalizeTrackedPath(row.path)
    pageCounts[path] = (pageCounts[path] ?? 0) + 1

    const code = row.country?.trim() || 'Inconnu'
    countryByCode[code] = (countryByCode[code] ?? 0) + 1

    const refRaw = row.referrer?.trim()
    if (refRaw) {
      try {
        const host = new URL(refRaw).hostname.replace(/^www\./, '')
        referrerCounts[host] = (referrerCounts[host] ?? 0) + 1
      } catch {
        referrerCounts['Référent invalide'] = (referrerCounts['Référent invalide'] ?? 0) + 1
      }
    } else {
      referrerCounts['Direct'] = (referrerCounts['Direct'] ?? 0) + 1
    }

    const day = row.created_at.slice(0, 10)
    dayCounts[day] = (dayCounts[day] ?? 0) + 1
  }

  const top = <T extends string>(counts: Record<T, number>, n: number) =>
    Object.entries(counts)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, n)

  const countryByLabel: Record<string, number> = {}
  for (const [code, v] of Object.entries(countryByCode)) {
    const label = countryLabel(code)
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
    ...(offSitePageviews !== undefined && offSitePageviews > 0 ? { offSitePageviews } : {}),
    scope,
    topPages: top(pageCounts, 10).map(([path, views]) => ({ path, views: views as number })),
    topCountries: Object.entries(countryByLabel)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([country, views]) => ({ country, views })),
    topReferrers: top(referrerCounts, 12).map(([referrer, views]) => ({ referrer, views: views as number })),
    trend,
  }
}
