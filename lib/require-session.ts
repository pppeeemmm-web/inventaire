import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isPublicSupabaseConfigured } from '@/lib/supabase/public-env'

/** Use in protected route layouts — avoids middleware HTML redirects that break RSC / Server Actions */
export async function requireSession() {
  if (!isPublicSupabaseConfigured()) redirect('/')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
}
