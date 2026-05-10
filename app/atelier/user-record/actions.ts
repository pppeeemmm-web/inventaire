'use server'

import { createClient } from '@/lib/supabase/server'

/** All completion marks for the signed-in user (grouped by scope). */
export async function loadUserRecordMarks(): Promise<Record<string, string[]>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return {}

  const { data, error } = await supabase
    .from('user_record_done')
    .select('scope, record_id')
    .eq('user_id', user.id)

  if (error || !data) return {}

  const out: Record<string, string[]> = {}
  for (const row of data as { scope: string; record_id: string }[]) {
    if (!out[row.scope]) out[row.scope] = []
    out[row.scope].push(row.record_id)
  }
  return out
}

export async function setUserRecordDone(
  scope: string,
  recordId: string,
  done: boolean,
): Promise<{ ok: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false }

  if (done) {
    const { error } = await supabase.from('user_record_done').upsert(
      {
        user_id: user.id,
        scope,
        record_id: recordId,
        completed_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,scope,record_id' },
    )
    if (error) return { ok: false }
  } else {
    const { error } = await supabase
      .from('user_record_done')
      .delete()
      .eq('user_id', user.id)
      .eq('scope', scope)
      .eq('record_id', recordId)
    if (error) return { ok: false }
  }
  return { ok: true }
}
