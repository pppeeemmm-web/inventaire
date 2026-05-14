'use server'

import crypto, { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import { validateWorkImageBuffer } from '@/lib/image-upload'
import { r2PutObject } from '@/lib/r2-s3-object'

const TASK_TYPES = new Set(['suggestion', 'improvement', 'maintenance', 'backlog', 'bug'])

export type CreateFieldIssueResult = { ok: true } | { ok: false; error: string }

function makeIssuePhotoKey(buf: Buffer, extWithoutDot: string): string {
  const hash8 = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 8)
  const safeExt = extWithoutDot.replace(/[^a-z0-9]/gi, '').slice(0, 4) || 'jpg'
  return `field-issue/${randomUUID()}_${hash8}.${safeExt}`
}

export async function createFieldIssueReport(formData: FormData): Promise<CreateFieldIssueResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'not_authenticated' }

  const { data: isTeam } = await supabase.rpc('is_team')
  if (!isTeam) return { ok: false, error: 'not_team' }

  const titleRaw = formData.get('action_title')
  const detailsRaw = formData.get('details')
  const typeRaw = formData.get('type')
  const title = typeof titleRaw === 'string' ? titleRaw.trim().slice(0, 300) : ''
  const details = typeof detailsRaw === 'string' ? detailsRaw.trim().slice(0, 12_000) : ''
  const type = typeof typeRaw === 'string' && TASK_TYPES.has(typeRaw) ? typeRaw : 'maintenance'

  if (!title) return { ok: false, error: 'missing_title' }

  let detailsOut = details
  const file = formData.get('photo')
  if (file instanceof File && file.size > 0) {
    const buf = Buffer.from(await file.arrayBuffer())
    if (buf.length > 8 * 1024 * 1024) return { ok: false, error: 'photo_too_large' }
    const validated = await validateWorkImageBuffer(buf)
    if ('error' in validated) return { ok: false, error: 'invalid_photo' }
    const key = makeIssuePhotoKey(buf, validated.ext)
    try {
      await r2PutObject(buf, key, validated.mime)
    } catch {
      return { ok: false, error: 'r2_failed' }
    }
    const photoNote = detailsOut ? `\n\n[photo:${key}]` : `[photo:${key}]`
    detailsOut = `${detailsOut}${photoNote}`.slice(0, 12_000)
  }

  const priority = type === 'bug' ? 'P2' : 'P3'
  const { error } = await supabase.from('studio_task').insert({
    action: title,
    details: detailsOut || null,
    type,
    priority,
    status: 'requested',
  })

  if (error) {
    console.error('[createFieldIssueReport]', error)
    return { ok: false, error: 'insert_failed' }
  }

  revalidatePath('/hub')
  revalidatePath('/atelier')
  return { ok: true }
}
