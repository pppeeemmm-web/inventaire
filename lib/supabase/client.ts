// Browser client — use in Client Components ('use client')
import { createBrowserClient } from '@supabase/ssr'
import { publicSupabaseEnv } from '@/lib/supabase/public-env'

export function createClient() {
  const { url, anon } = publicSupabaseEnv()
  return createBrowserClient(url, anon)
}
