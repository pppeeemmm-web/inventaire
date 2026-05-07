'use server'

export type AnalyticsResult =
  | { error: string }
  | { ok: true; visits: number; pageviews: number; topPages: { path: string; views: number }[] }

export async function getAnalyticsStats(days: number): Promise<AnalyticsResult> {
  const token     = process.env.VERCEL_ACCESS_TOKEN
  const projectId = process.env.VERCEL_PROJECT_ID

  if (!token || !projectId) {
    return { error: 'VERCEL_ACCESS_TOKEN ou VERCEL_PROJECT_ID manquant dans les variables d\'environnement.' }
  }

  const to   = Date.now()
  const from = to - days * 24 * 60 * 60 * 1000
  const tz   = 'Europe%2FParis'
  const filter = encodeURIComponent('{}')
  const base = `projectId=${projectId}&from=${from}&to=${to}&filter=${filter}&tz=${tz}`

  const [statsRes, breakdownRes] = await Promise.all([
    fetch(`https://vercel.com/api/web/insights/stats?${base}`, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 3600 },
    }),
    fetch(`https://vercel.com/api/web/insights/breakdown?${base}&groupBy=path&limit=10`, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 3600 },
    }),
  ])

  if (!statsRes.ok) {
    return { error: `Erreur API Vercel stats: ${statsRes.status} ${statsRes.statusText}` }
  }
  if (!breakdownRes.ok) {
    return { error: `Erreur API Vercel breakdown: ${breakdownRes.status} ${breakdownRes.statusText}` }
  }

  const stats     = await statsRes.json()
  const breakdown = await breakdownRes.json()

  return {
    ok:        true,
    visits:    stats.data?.visits    ?? 0,
    pageviews: stats.data?.pageviews ?? 0,
    topPages:  (breakdown.data ?? []).map((d: any) => ({ path: d.key as string, views: d.total as number })),
  }
}
