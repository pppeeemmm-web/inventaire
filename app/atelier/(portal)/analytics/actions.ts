'use server'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { isPublicSiteTrackedPath, normalizeTrackedPath } from '@/lib/public-site-paths'
import { dict, type Lang } from '@/lib/i18n/dictionary'
import { missingPageViewVisitorColumns } from '@/lib/page-view-schema'
import {
  isDevAnalyticsHost,
  isDevAnalyticsPageView,
  isNetPageView,
  parseExcludedVisitorIds,
  type PageViewRow,
} from '@/lib/analytics-net'

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

export type { PageViewRow } from '@/lib/analytics-net'

export type DayCount = { date: string; views: number }

export type AnalyticsResult =
  | { error: string }
  | {
      ok: true
      /** Net page views in scope (excl. team sessions + ANALYTICS_EXCLUDE_VISITOR_IDS). */
      pageviews: number
      /** Distinct net visitor_id in scope. */
      uniqueVisitors: number
      scope: 'public_site' | 'all'
      topPages: { path: string; views: number }[]
      topCountries: { country: string; views: number }[]
      topReferrers: { referrer: string; views: number }[]
      trend: DayCount[]
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
  const since = new Date(Date.now() - days * 86400 * 1000).toISOString()

  const { rows, error } = await fetchAllPageViews(sb, since)
  if (error) return { error }

  const allRows = rows ?? []
  const scopedRows =
    scope === 'public_site' ? allRows.filter((r) => isPublicSiteTrackedPath(r.path)) : allRows

  const excludedIds = parseExcludedVisitorIds()
  const netRows = scopedRows
    .filter((r) => isNetPageView(r, excludedIds))
    .filter((r) => !isDevAnalyticsPageView(r))
  const pageviews = netRows.length

  const netVisitorSet = new Set<string>()
  for (const row of netRows) {
    const vid = row.visitor_id?.trim()
    if (vid) netVisitorSet.add(vid)
  }
  const uniqueVisitors = netVisitorSet.size

  const pageCounts: Record<string, number> = {}
  const countryByCode: Record<string, number> = {}
  const referrerCounts: Record<string, number> = {}
  const dayCounts: Record<string, number> = {}

  for (const row of netRows) {
    const path = normalizeTrackedPath(row.path)
    pageCounts[path] = (pageCounts[path] ?? 0) + 1

    const code = row.country?.trim() || COUNTRY_UNKNOWN_CODE
    countryByCode[code] = (countryByCode[code] ?? 0) + 1

    const refRaw = row.referrer?.trim()
    if (refRaw) {
      try {
        const host = new URL(refRaw).hostname.replace(/^www\./, '')
        if (isDevAnalyticsHost(host)) continue
        referrerCounts[host] = (referrerCounts[host] ?? 0) + 1
      } catch {
        if (isDevAnalyticsHost(refRaw)) continue
        referrerCounts[REF_BUCKET_INVALID] = (referrerCounts[REF_BUCKET_INVALID] ?? 0) + 1
      }
    } else {
      referrerCounts[REF_BUCKET_DIRECT] = (referrerCounts[REF_BUCKET_DIRECT] ?? 0) + 1
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
    trend,
  }
}
