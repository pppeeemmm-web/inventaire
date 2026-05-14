'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { r2DeleteObject } from '@/lib/r2-s3-object'
import type { ShareInboxPayloadV1 } from '@/lib/share-inbox-types'
import { isShareInboxPayloadV1 } from '@/lib/share-inbox-types'

export async function deleteShareInboxEntry(id: string): Promise<{ ok: true } | { error: string }> {
  try {
    const sb = await createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return { error: 'auth' }

    const { data: row, error: selErr } = await (sb.from('share_inbox') as any)
      .select('payload')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (selErr) throw selErr
    if (!row) return { error: 'not_found' }

    const p = row.payload
    if (isShareInboxPayloadV1(p)) {
      for (const f of p.files) {
        try {
          await r2DeleteObject(f.r2_key)
        } catch {
          // best-effort
        }
      }
    }

    const { error: delErr } = await (sb.from('share_inbox') as any).delete().eq('id', id).eq('user_id', user.id)
    if (delErr) throw delErr
    revalidatePath('/atelier/share-triage')
    return { ok: true }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[deleteShareInboxEntry]', msg)
    return { error: msg }
  }
}

export type ShareInboxListRow = {
  id: string
  created_at: string
  payload: ShareInboxPayloadV1 | Record<string, unknown>
}

export async function listShareInboxForUser(): Promise<ShareInboxListRow[]> {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return []

  const { data, error } = await (sb.from('share_inbox') as any)
    .select('id, created_at, payload')
    .eq('user_id', user.id)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(12)
  if (error) {
    console.error('[listShareInboxForUser]', error)
    return []
  }
  return (data ?? []) as ShareInboxListRow[]
}
