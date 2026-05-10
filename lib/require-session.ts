import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isPublicSupabaseConfigured } from '@/lib/supabase/public-env'

/** Use in protected route layouts — avoids middleware HTML redirects that break RSC / Server Actions */
export async function requireSession() {
  // Without project URL + anon key we cannot validate a session; allow the route to render
  // (e.g. /atelier shows TeamPortalClient “configure keys” UI instead of bouncing to /).
  if (!isPublicSupabaseConfigured()) return

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
}
