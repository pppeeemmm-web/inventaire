'use server'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { headers } from 'next/headers'

function getServiceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

export async function trackView(path: string, referrer: string | null = null, country: string | null = null) {
  const sb = getServiceClient()
  if (!sb) return

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
