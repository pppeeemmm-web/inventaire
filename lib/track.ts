'use server'

import { createClient } from '@supabase/supabase-js'
import { headers } from 'next/headers'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function trackView(path: string, referrer: string | null = null, country: string | null = null) {
  try {
    // When called from a server component, read headers automatically
    if (referrer === null && country === null) {
      const h = await headers()
      referrer = h.get('referer')
      country  = h.get('x-vercel-ip-country')
    }
    await sb.from('page_view').insert({ path, referrer, country })
  } catch {
    // Never let analytics break the page
  }
}
