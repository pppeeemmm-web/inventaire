import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/** Use in protected route layouts — avoids middleware HTML redirects that break RSC / Server Actions */
export async function requireSession() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
}
