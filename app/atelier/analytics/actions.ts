'use server'

import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export type DayCount = { date: string; views: number }

export type AnalyticsResult =
  | { error: string }
  | {
      ok:           true
      pageviews:    number
      topPages:     { path: string; views: number }[]
      topCountries: { country: string; views: number }[]
      topReferrers: { referrer: string; views: number }[]
      trend:        DayCount[]
    }

export async function getAnalyticsStats(days: number): Promise<AnalyticsResult> {
  const since = new Date(Date.now() - days * 86400 * 1000).toISOString()

  const { data, error } = await sb
    .from('page_view')
    .select('path, referrer, country, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: true })

  if (error) return { error: error.message }

  const pageviews = data.length

  const pageCounts:     Record<string, number> = {}
  const countryCounts:  Record<string, number> = {}
  const referrerCounts: Record<string, number> = {}
  const dayCounts:      Record<string, number> = {}

  for (const row of data) {
    pageCounts[row.path] = (pageCounts[row.path] ?? 0) + 1

    const country = row.country ?? 'Inconnu'
    countryCounts[country] = (countryCounts[country] ?? 0) + 1

    if (row.referrer) {
      try {
        const host = new URL(row.referrer).hostname.replace(/^www\./, '')
        referrerCounts[host] = (referrerCounts[host] ?? 0) + 1
      } catch {
        // malformed referrer — skip
      }
    }

    const day = row.created_at.slice(0, 10) // YYYY-MM-DD
    dayCounts[day] = (dayCounts[day] ?? 0) + 1
  }

  const top = <T extends string>(counts: Record<T, number>, n = 8) =>
    Object.entries(counts)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, n)

  // Fill every day in the period (so chart has no gaps)
  const trend: DayCount[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400 * 1000)
    const key = d.toISOString().slice(0, 10)
    trend.push({ date: key, views: dayCounts[key] ?? 0 })
  }

  return {
    ok:           true,
    pageviews,
    topPages:     top(pageCounts, 10).map(([path, views])         => ({ path,     views: views as number })),
    topCountries: top(countryCounts, 8).map(([country, views])   => ({ country,  views: views as number })),
    topReferrers: top(referrerCounts, 8).map(([referrer, views]) => ({ referrer, views: views as number })),
    trend,
  }
}
