/** Shared URL/key resolution — createBrowserClient/createServerClient throw on empty strings. */

export const PLACEHOLDER_SUPABASE_URL =
  'https://xxxxxxxxxxxxxxxxxxxx.supabase.co'

export const PLACEHOLDER_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSJ9.signature_placeholder'

export function isPublicSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  return Boolean(url && anon)
}

export function publicSupabaseEnv(): { url: string; anon: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  if (url && anon) return { url, anon }
  return { url: PLACEHOLDER_SUPABASE_URL, anon: PLACEHOLDER_ANON_KEY }
}
