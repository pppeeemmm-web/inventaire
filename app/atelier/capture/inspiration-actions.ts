'use server'

// Inspiration photo (R1 / R2): Photo · doc → Inspiration on the phone. Admin writes (the Journal is Pem's
// notebook), team reads — RLS in supabase/sql/inspiration_photo.sql. Behind INSPIRATION_SQL_LIVE until the
// lead applies that SQL: every action returns `sql_waiting` and reads nothing.
// Image: validated (Sharp), normalised to AVIF 2100 px + 400 px thumb (CLAUDE.md « Image upload »), R2 EU
// endpoint through r2PutObject, key `inspiration/I_{yyyymmdd}_{rand8}_{hash8}.avif`. Removal recycles.

import crypto from 'crypto'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { logError } from '@/lib/error-reporter/server'
import { normalizeImageToAvifPair, validateWorkImageBuffer } from '@/lib/image-upload'
import { r2PutObject, r2SoftDeleteObject } from '@/lib/r2-s3-object'
import { calendarDayInParisFromIso, todayCalendarDayInParis } from '@/lib/session-calendar-day'
import { INSPIRATION_MAX_EDGE, INSPIRATION_SQL_LIVE } from '@/lib/inspiration-photo'

type Err = { error: string }

const MAX_BYTES = 12 * 1024 * 1024
const MAX_CAPTION = 2000

function inspirationTable(supabase: Awaited<ReturnType<typeof createClient>>) {
  return supabase.from('inspiration_photo')
}

async function adminUser(supabase: Awaited<ReturnType<typeof createClient>>) {
  const [
    {
      data: { user },
    },
    { data: isAdmin },
  ] = await Promise.all([supabase.auth.getUser(), supabase.rpc('is_admin')])
  if (!user) return { error: 'auth' as const }
  if (isAdmin !== true) return { error: 'admin_only' as const }
  return { user }
}

async function recycle(keys: string[]): Promise<void> {
  for (const k of keys) {
    try {
      await r2SoftDeleteObject(k)
    } catch (e) {
      await logError('Inspiration photo recycle failed', e, { source: 'inspiration.recycle', metadata: { key: k } })
    }
  }
}

/** Saves one inspiration photo on today's Journal day (Paris), optionally linked to a work and / or an idée. */
export async function addInspirationPhoto(formData: FormData): Promise<{ ok: true; id: string; day: string } | Err> {
  if (!INSPIRATION_SQL_LIVE) return { error: 'sql_waiting' }
  const supabase = await createClient()
  const who = await adminUser(supabase)
  if (!who.user) return { error: who.error ?? 'auth' }

  // One-time id from the phone (lib/mobile/capture-queue.ts): it becomes the photo's id, so a resend
  // after a lost answer finds the photo already saved and writes nothing twice.
  const clientIdRaw = String(formData.get('client_id') ?? '').trim()
  const clientId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientIdRaw) ? clientIdRaw.toLowerCase() : null
  if (clientId) {
    const { data: already } = await inspirationTable(supabase).select('id, day').eq('id', clientId).maybeSingle()
    if (already) return { ok: true, id: clientId, day: String((already as { day: string }).day) }
  }

  const file = formData.get('photo')
  if (!(file instanceof File) || file.size === 0) return { error: 'empty' }
  if (file.size > MAX_BYTES) return { error: 'too_large' }
  const raw = Buffer.from(await file.arrayBuffer())
  const valid = await validateWorkImageBuffer(raw)
  if ('error' in valid) return { error: 'invalid_format' }

  const caption = String(formData.get('caption') ?? '').trim().slice(0, MAX_CAPTION) || null
  const workRaw = String(formData.get('oeuvre_id') ?? '').trim().replace(/^#/, '')
  const oeuvre_id = /^\d{1,6}$/.test(workRaw) ? Number(workRaw) : null
  const conceptRaw = String(formData.get('concept_id') ?? '').trim()
  const concept_id = /^[0-9a-f-]{36}$/i.test(conceptRaw) ? conceptRaw : null

  if (oeuvre_id != null) {
    const { data: w } = await supabase.from('Oeuvres').select('OeuvreID').eq('OeuvreID', oeuvre_id).maybeSingle()
    if (!w) return { error: 'no_work' }
  }

  // The day a queued capture was taken (`taken_at`, sent only by the capture queue: last 14 days, not in the
  // future); an online upload lands on today.
  const today = todayCalendarDayInParis()
  const takenRaw = String(formData.get('taken_at') ?? '').trim()
  const takenMs = takenRaw ? new Date(takenRaw).getTime() : NaN
  const takenDay =
    clientId && Number.isFinite(takenMs) && takenMs <= Date.now() + 5 * 60_000 && takenMs >= Date.now() - 14 * 86_400_000
      ? calendarDayInParisFromIso(new Date(takenMs).toISOString())
      : null
  const day = takenDay && takenDay <= today ? takenDay : today
  const hash8 = crypto.createHash('sha256').update(raw).digest('hex').slice(0, 8)
  const base = `I_${day.replace(/-/g, '')}_${(clientId ?? crypto.randomUUID()).slice(0, 8)}_${hash8}`
  const mainKey = `inspiration/${base}.avif`
  const thumbKey = `thumbs/inspiration/${base}.avif`
  try {
    const { mainBuf, thumbBuf } = await normalizeImageToAvifPair(raw, { maxEdge: INSPIRATION_MAX_EDGE })
    await r2PutObject(mainBuf, mainKey, 'image/avif', {
      source: 'inspiration_photo',
      classification: 'linked',
      linkedRefs: [{ table: 'inspiration_photo', column: 'image_key' }],
      uploadedBy: who.user.id,
      metadata: { role: 'main', day },
    })
    await r2PutObject(thumbBuf, thumbKey, 'image/avif', {
      source: 'inspiration_photo_thumb',
      classification: 'linked',
      linkedRefs: [{ table: 'inspiration_photo', column: 'image_key' }],
      uploadedBy: who.user.id,
      metadata: { role: 'thumb', original_key: mainKey },
    })
  } catch (e) {
    await logError('Inspiration photo upload failed', e, { source: 'inspiration.add' })
    return { error: 'r2_failed' }
  }

  const { data, error } = await inspirationTable(supabase)
    .insert({ ...(clientId ? { id: clientId } : {}), day, author_id: who.user.id, image_key: mainKey, caption, oeuvre_id, concept_id })
    .select('id')
    .single()
  // Two sends of the same one-time id at once: the other one saved it (same image keys) — not an error.
  if (error && clientId && error.code === '23505') return { ok: true, id: clientId, day }
  if (error || !data) {
    await recycle([mainKey, thumbKey])
    return { error: error?.message ?? 'insert' }
  }

  revalidatePath('/atelier/journal')
  revalidatePath('/hub')
  return { ok: true, id: (data as { id: string }).id, day }
}

/**
 * Sets the text beside an inspiration photo (admin), after the fact (Pem 2026-11-21). Empty = no text.
 * Answers with the text as stored; a photo that is not there is `not_found`, never « ok ».
 * No path refresh: each of the two readers takes this answer — the desk Journal day patches its list, the phone
 * day (`TodayEntries`, server-rendered) asks its page again (`router.refresh()`).
 */
export async function setInspirationCaption(id: string, text: string): Promise<{ ok: true; caption: string | null } | Err> {
  if (!INSPIRATION_SQL_LIVE) return { error: 'sql_waiting' }
  if (!/^[0-9a-f-]{36}$/i.test(String(id))) return { error: 'not_found' }
  const supabase = await createClient()
  const who = await adminUser(supabase)
  if (!who.user) return { error: who.error ?? 'auth' }
  const caption = String(text ?? '').trim().slice(0, MAX_CAPTION) || null
  const { data, error } = await inspirationTable(supabase).update({ caption }).eq('id', id).select('caption')
  if (error) return { error: error.message }
  const rows = (data ?? []) as Array<{ caption: string | null }>
  if (!rows.length) return { error: 'not_found' }
  return { ok: true, caption: rows[0].caption }
}

/** Removes an inspiration photo (admin): the row goes, the image + thumb go to R2 `recycle/`. */
export async function removeInspirationPhoto(id: string): Promise<{ ok: true } | Err> {
  if (!INSPIRATION_SQL_LIVE) return { error: 'sql_waiting' }
  const supabase = await createClient()
  const who = await adminUser(supabase)
  if (!who.user) return { error: who.error ?? 'auth' }
  const { data, error } = await inspirationTable(supabase).delete().eq('id', id).select('image_key')
  if (error) return { error: error.message }
  const rows = (data ?? []) as Array<{ image_key: string }>
  if (!rows.length) return { error: 'not_found' }
  await recycle(rows.flatMap((r) => (r.image_key.startsWith('inspiration/') ? [r.image_key, `thumbs/${r.image_key}`] : [])))
  revalidatePath('/atelier/journal')
  revalidatePath('/hub')
  return { ok: true }
}
