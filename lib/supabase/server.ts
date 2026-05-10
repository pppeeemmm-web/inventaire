// Server client — use in Server Components, Server Actions, Route Handlers
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import {
  PLACEHOLDER_SUPABASE_URL,
  publicSupabaseEnv,
} from '@/lib/supabase/public-env'

export { isPublicSupabaseConfigured as isSupabaseConfigured } from '@/lib/supabase/public-env'

const PLACEHOLDER_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbCI6InNlcnZpY2Vfcm9sZSJ9.signature_placeholder'

export async function createClient() {
  const cookieStore = await cookies()
  const { url, anon } = publicSupabaseEnv()

  return createServerClient(url, anon, {
    cookies: {
      getAll() { return cookieStore.getAll() },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // Ignore — called from a Server Component where cookies can't be set
        }
      },
    },
  })
}

// Service-role client — server-side only, bypasses RLS.
// Used for /c/:token validation and other admin operations.
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  return createSupabaseJsClient(
    url && key ? url : PLACEHOLDER_SUPABASE_URL,
    url && key ? key : PLACEHOLDER_SERVICE_ROLE_KEY,
  )
}
