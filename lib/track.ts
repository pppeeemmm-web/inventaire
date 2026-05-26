'use server'

import { createClient } from '@supabase/supabase-js'
import { headers } from 'next/headers'
import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { isLikelyVisitorUuid } from '@/lib/public-visitor-id'
import { missingPageViewVisitorColumns } from '@/lib/page-view-schema'
import { isDevAnalyticsHost } from '@/lib/analytics-net'

export async function trackView(
  path: string,
  referrer: string | null = null,
  country: string | null = null,
  visitorId: string | null = null
) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) return

    const sb = createClient(url, key)

    // When called from a server component, read headers automatically
    if (referrer === null && country === null) {
      const h = await headers()
      const host = h.get('x-forwarded-host') ?? h.get('host')
      if (isDevAnalyticsHost(host)) return
      referrer = h.get('referer')
      country  = h.get('x-vercel-ip-country')
    }

    let isTeamSession = false
    try {
      const userSb = await createServerSupabase()
      const { data: team } = await userSb.rpc('is_team')
      isTeamSession = Boolean(team)
    } catch (e) {
      console.warn('[trackView] is_team rpc failed', e)
      isTeamSession = false
    }

    const vid = visitorId?.trim()
    const visitor_id = vid && isLikelyVisitorUuid(vid) ? vid : null

    const fullRow = {
      path,
      referrer,
      country,
      visitor_id,
      is_team_session: isTeamSession,
    }
    const { error: insErr } = await sb.from('page_view').insert(fullRow)
    if (insErr) {
      if (missingPageViewVisitorColumns(insErr.message)) {
        const { error: legErr } = await sb.from('page_view').insert({ path, referrer, country })
        if (legErr) console.warn('[trackView] legacy insert failed', legErr.message)
      } else {
        console.warn('[trackView] insert failed', insErr.message)
      }
    }
  } catch (e) {
    console.warn('[trackView]', e)
    // Never let analytics break the page
  }
}
