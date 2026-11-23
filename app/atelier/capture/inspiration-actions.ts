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

type Loose = { rpc: (f: string, a: Record<string, unknown>) => any }
/** A link typed in the photo's text: a work or a person (positive integer id), an idée (uuid). */
export type PhotoLink = { kind: 'oeuvre' | 'concept' | 'contact'; id: number | string }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function validPhotoLink(l: unknown): l is PhotoLink {
  if (!l || typeof l !== 'object') return false
  const { kind, id } = l as { kind?: unknown; id?: unknown }
  if (kind === 'oeuvre' || kind === 'contact') {
    return typeof id === 'number' && Number.isInteger(id) && id > 0 && String(id).length <= 9
  }
  if (kind === 'concept') return typeof id === 'string' && UUID_RE.test(id)
  return false
}

function validPhotoLinks(v: unknown): v is PhotoLink[] {
  return Array.isArray(v) && v.every(validPhotoLink)
}

// The RPCs raise one word (not_found, hidden, text_required, bad_link, not_allowed); it is passed on as is,
// any other Postgres message too.
function mapRpcError(message: string): string {
  return message
}

const META_STR_KEYS = ['taken_at', 'make', 'model', 'lens', 'file_name'] as const
const META_NUM_KEYS = ['f_number', 'exposure', 'iso', 'focal', 'width', 'height'] as const

/** Keeps only the known camera fields (strings ≤ 120 chars, finite numbers) and a valid gps; else null. */
function cleanMeta(raw: string): Record<string, unknown> | null {
  let o: unknown
  try {
    o = JSON.parse(raw)
  } catch {
    return null
  }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null
  const src = o as Record<string, unknown>
  const out: Record<string, unknown> = {}
  const okStr = (v: unknown): v is string => typeof v === 'string' && v.length <= 120
  const okNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
  for (const k of [...META_STR_KEYS, ...META_NUM_KEYS]) {
    const v = src[k]
    if (okStr(v) || okNum(v)) out[k] = v
  }
  if (typeof out.taken_at === 'string' && !Number.isFinite(Date.parse(out.taken_at))) delete out.taken_at
  const g = src.gps
  if (g && typeof g === 'object' && !Array.isArray(g)) {
    const { lat, lon, alt } = g as Record<string, unknown>
    if (okNum(lat) && lat >= -90 && lat <= 90 && okNum(lon) && lon >= -180 && lon <= 180) {
      out.gps = okNum(alt) ? { lat, lon, alt } : { lat, lon }
    }
  }
  return Object.keys(out).length ? out : null
}

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

/**
 * Saves one inspiration photo on a Journal day (Paris), optionally linked to a work and / or an idée.
 * The day: `day` when sent (the desk's paste / drop onto a day — any past day, never ahead of today), else the
 * day a queued capture was taken (`taken_at`), else today. A resend of the same one-time id answers
 * `already: true` with the day the photo is on (design 2026-11-23 JournalDesk §3: never a silent « ok »).
 */
export async function addInspirationPhoto(formData: FormData): Promise<{ ok: true; id: string; day: string; already?: true; textError?: string } | Err> {
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
    if (already) return { ok: true, id: clientId, day: String((already as { day: string }).day), already: true }
  }

  const metaRaw = String(formData.get('meta') ?? '').trim()
  const meta = metaRaw ? cleanMeta(metaRaw) : null
  const linksRaw = String(formData.get('links') ?? '').trim()
  let extraLinks: PhotoLink[] = []
  if (linksRaw) {
    let parsed: unknown
    try {
      parsed = JSON.parse(linksRaw)
    } catch {
      return { error: 'bad_link' }
    }
    if (!validPhotoLinks(parsed)) return { error: 'bad_link' }
    extraLinks = parsed
  }

  const file = formData.get('photo')
  if (!(file instanceof File) || file.size === 0) return { error: 'empty' }
  if (file.size > MAX_BYTES) return { error: 'too_large' }
  const raw = Buffer.from(await file.arrayBuffer())
  const valid = await validateWorkImageBuffer(raw)
  if ('error' in valid) return { error: 'invalid_format' }
  // Sharp here has no HEIC decoder (checked 2026-11-23): say so instead of failing later as `r2_failed`.
  if (valid.ext === 'heic') return { error: 'heic' }

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
  const dayRaw = String(formData.get('day') ?? '').trim()
  const dayMs = /^\d{4}-\d{2}-\d{2}$/.test(dayRaw) ? Date.parse(`${dayRaw}T12:00:00Z`) : NaN
  const realDay = Number.isFinite(dayMs) && new Date(dayMs).toISOString().startsWith(dayRaw)
  if (dayRaw && (!realDay || dayRaw > today)) return { error: 'day' }
  const day = dayRaw || (takenDay && takenDay <= today ? takenDay : today)
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
    .insert({ ...(clientId ? { id: clientId } : {}), day, author_id: who.user.id, image_key: mainKey, caption: null, oeuvre_id, concept_id, meta } as never)
    .select('id')
    .single()
  // Two sends of the same one-time id at once: the other one saved it (same image keys) — not an error.
  if (error && clientId && error.code === '23505') return { ok: true, id: clientId, day, already: true }
  if (error || !data) {
    await recycle([mainKey, thumbKey])
    return { error: error?.message ?? 'insert' }
  }

  const newId = (data as { id: string }).id
  let textError: string | undefined
  const links: PhotoLink[] = [...extraLinks]
  if (oeuvre_id != null) links.push({ kind: 'oeuvre', id: oeuvre_id })
  if (concept_id != null) links.push({ kind: 'concept', id: concept_id })
  // No text → no entry (the set_text door refuses an empty one): a picked work / idea stays in the photo's columns.
  if (caption) {
    const { error: textErr } = await (supabase as unknown as Loose).rpc('inspiration_photo_set_text', {
      p_photo: newId,
      p_text: caption ?? '',
      p_links: links,
    })
    // The photo stays saved whatever happens to its text.
    if (textErr) textError = mapRpcError(String(textErr.message ?? 'text'))
  }

  revalidatePath('/atelier/journal')
  revalidatePath('/hub')
  return { ok: true, id: newId, day, ...(textError ? { textError } : {}) }
}

/**
 * Sets the text beside an inspiration photo (admin), after the fact (Pem 2026-11-21). Empty = no text.
 * Answers with the text as stored; a photo that is not there is `not_found`, never « ok ».
 * No path refresh: each of the two readers takes this answer — the desk Journal day patches its list, the phone
 * day (`TodayEntries`, server-rendered) asks its page again (`router.refresh()`).
 */
export async function setInspirationCaption(
  id: string,
  text: string,
  links: PhotoLink[] = [],
): Promise<{ ok: true; caption: string | null; changed: boolean; entryId: number | null } | Err> {
  if (!INSPIRATION_SQL_LIVE) return { error: 'sql_waiting' }
  if (!/^[0-9a-f-]{36}$/i.test(String(id))) return { error: 'not_found' }
  if (!validPhotoLinks(links)) return { error: 'bad_link' }
  const supabase = await createClient()
  const who = await adminUser(supabase)
  if (!who.user) return { error: who.error ?? 'auth' }
  const { data, error } = await (supabase as unknown as Loose).rpc('inspiration_photo_set_text', {
    p_photo: id,
    p_text: String(text ?? ''),
    p_links: links,
  })
  if (error) return { error: mapRpcError(String(error.message ?? 'error')) }
  const r = (data ?? {}) as { caption?: string | null; changed?: boolean; entry_id?: number | null }
  return { ok: true, caption: r.caption ?? null, changed: r.changed === true, entryId: r.entry_id != null ? Number(r.entry_id) : null }
}

/** Removes an inspiration photo (admin): the row goes, the image + thumb go to R2 `recycle/`. */
export async function removeInspirationPhoto(id: string): Promise<{ ok: true; result: 'deleted' | 'hidden' } | Err> {
  if (!INSPIRATION_SQL_LIVE) return { error: 'sql_waiting' }
  const supabase = await createClient()
  const who = await adminUser(supabase)
  if (!who.user) return { error: who.error ?? 'auth' }
  const { data, error } = await (supabase as unknown as Loose).rpc('inspiration_photo_remove', { p_photo: id })
  if (error) return { error: mapRpcError(String(error.message ?? 'error')) }
  const r = (data ?? {}) as { result?: string; image_key?: string }
  let result: 'deleted' | 'hidden' = 'hidden'
  if (r.result === 'deleted') {
    result = 'deleted'
    const key = String(r.image_key ?? '')
    if (key.startsWith('inspiration/')) await recycle([key, `thumbs/${key}`])
  }
  revalidatePath('/atelier/journal')
  revalidatePath('/hub')
  return { ok: true, result }
}
