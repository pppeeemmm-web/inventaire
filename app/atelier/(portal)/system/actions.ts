'use server'

import { createClient } from '@/lib/supabase/server'

export type DeleteStudioTaskResult =
  | { ok: true }
  | { error: 'not_authenticated' | 'admin_required' | 'delete_failed'; message?: string }

export async function deleteStudioTask(id: number): Promise<DeleteStudioTaskResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'not_authenticated' }

  const { data: isAdmin } = await supabase.rpc('is_admin')
  if (!isAdmin) return { error: 'admin_required' }

  const { error } = await supabase.from('studio_task').delete().eq('id', id)
  if (error) return { error: 'delete_failed', message: error.message }
  return { ok: true }
}
