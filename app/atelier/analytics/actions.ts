'use server'

import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export type AnalyticsResult =
  | { error: string }
  | { ok: true; pageviews: number; topPages: { path: string; views: number }[] }

export async function getAnalyticsStats(days: number): Promise<AnalyticsResult> {
  const since = new Date(Date.now() - days * 86400 * 1000).toISOString()

  const { data, error } = await sb
    .from('page_view')
    .select('path')
    .gte('created_at', since)

  if (error) return { error: error.message }

  const pageviews = data.length

  const counts: Record<string, number> = {}
  for (const row of data) counts[row.path] = (counts[row.path] ?? 0) + 1

  const topPages = Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([path, views]) => ({ path, views }))

  return { ok: true, pageviews, topPages }
}
