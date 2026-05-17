'use server'

import crypto from 'crypto'
import sharp from 'sharp'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { validateWorkImageBuffer } from '@/lib/image-upload'
import { r2PutObject, r2DeleteObject, r2GetObjectBuffer } from '@/lib/r2-s3-object'
import { addWorkImage } from '@/app/atelier/works/actions'
import {
  emptyWorkSessionPayload,
  parseWorkSessionPayload,
  type WorkSessionFieldContext,
  type WorkSessionPayload,
  type WorkSessionShot,
} from '@/lib/work-session-payload'
import type { WorkSessionRow } from '@/lib/types/database'

/** Until `work_session` is in generated Supabase types (run `supabase gen types` after migration). */
function workSessionTable(supabase: Awaited<ReturnType<typeof createClient>>) {
  return (supabase as { from: (name: string) => ReturnType<Awaited<ReturnType<typeof createClient>>['from']> }).from(
    'work_session',
  )
}

const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000

function expiresAtIso(): string {
  return new Date(Date.now() + DRAFT_TTL_MS).toISOString()
}

async function rpcIsAdmin(supabase: Awaited<ReturnType<typeof createClient>>): Promise<boolean> {
  const { data } = await supabase.rpc('is_admin')
  return !!data
}

export type SessionActionResult = { ok: true } | { error: string }

export async function getSessionNewPageContext(): Promise<{ authed: boolean; isAdmin: boolean }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { authed: false, isAdmin: false }
  return { authed: true, isAdmin: await rpcIsAdmin(supabase) }
}

export async function getWorkSessionShotCount(sessionId: string): Promise<number> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return 0
  const { data, error } = await workSessionTable(supabase)
    .select('payload')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (error || !data) return 0
  return parseWorkSessionPayload(data.payload).shots.length
}

export type WorkSessionDraftFields = {
  notes: string
  title_hint: string
  width_cm: string
  height_cm: string
  field_context: WorkSessionFieldContext | null
}

export async function getWorkSessionDraftFields(sessionId: string): Promise<
  { ok: true; fields: WorkSessionDraftFields; oeuvre_id: number | null } | { error: string }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }
  const { data, error } = await workSessionTable(supabase)
    .select('payload,oeuvre_id')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (error || !data) return { error: error?.message ?? 'Session introuvable' }
  const p = parseWorkSessionPayload(data.payload)
  const oeuvreId = data.oeuvre_id
  return {
    ok: true,
    oeuvre_id: typeof oeuvreId === 'number' && oeuvreId > 0 ? oeuvreId : null,
    fields: {
      notes: p.notes ?? '',
      title_hint: p.title_hint ?? '',
      width_cm: p.width_cm ?? '',
      height_cm: p.height_cm ?? '',
      field_context: p.field_context ?? null,
    },
  }
}

export async function createWorkSessionDraft(oeuvreId: number | null): Promise<
  { ok: true; id: string } | { error: string }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { data, error } = await workSessionTable(supabase)
    .insert({
      user_id: user.id,
      oeuvre_id: oeuvreId && oeuvreId > 0 ? oeuvreId : null,
      expires_at: expiresAtIso(),
      status: 'draft',
      payload: emptyWorkSessionPayload() as unknown as Record<string, unknown>,
    })
    .select('id')
    .single()

  if (error || !data) return { error: error?.message ?? 'work_session insert failed' }
  revalidatePath('/atelier/session/new')
  return { ok: true, id: data.id as string }
}

export async function updateWorkSessionMetadata(
  sessionId: string,
  patch: {
    notes?: string
    title_hint?: string
    width_cm?: string
    height_cm?: string
    field_context?: WorkSessionFieldContext | null
  },
): Promise<SessionActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { data: row, error: selErr } = await workSessionTable(supabase)
    .select('id,user_id,status,payload')
    .eq('id', sessionId)
    .maybeSingle()
  if (selErr || !row) return { error: selErr?.message ?? 'Session introuvable' }
  if (row.user_id !== user.id) return { error: 'Accès refusé' }
  if (row.status !== 'draft') return { error: 'Session non modifiable' }

  const payload = parseWorkSessionPayload(row.payload)
  if (typeof patch.notes === 'string') payload.notes = patch.notes
  if (typeof patch.title_hint === 'string') payload.title_hint = patch.title_hint
  if (typeof patch.width_cm === 'string') payload.width_cm = patch.width_cm
  if (typeof patch.height_cm === 'string') payload.height_cm = patch.height_cm
  if ('field_context' in patch) {
    if (patch.field_context === null || patch.field_context === undefined) {
      delete payload.field_context
    } else {
      payload.field_context = patch.field_context
    }
  }

  const { error: upErr } = await workSessionTable(supabase)
    .update({ payload: payload as unknown as Record<string, unknown> })
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .eq('status', 'draft')
  if (upErr) return { error: upErr.message }
  return { ok: true }
}

async function putAvifPair(
  rawBuf: Buffer,
  mainKey: string,
  thumbKey: string,
  sessionId: string,
  uploadedBy: string,
): Promise<{ error: string } | { ok: true }> {
  const artist =
    process.env.IMAGE_EXIF_ARTIST?.trim() || 'PierreEmmanuelMoulin'
  const copyright =
    process.env.IMAGE_EXIF_COPYRIGHT?.trim() ||
    '© PierreEmmanuelMoulin · pppeeemmm@gmail.com'
  try {
    const avifBuf = await sharp(rawBuf)
      .rotate()
      .resize({
        width: 2100,
        height: 2100,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .keepIccProfile()
      .withExif({
        IFD0: {
          Artist: artist,
          Copyright: copyright,
        },
      })
      .avif({ quality: 50, effort: 4, chromaSubsampling: '4:4:4' })
      .toBuffer()

    await r2PutObject(avifBuf, mainKey, 'image/avif', {
      source: 'work_session',
      classification: 'transient',
      linkedRefs: [{ table: 'work_session', column: 'payload.shots.r2_key', row_id: sessionId }],
      uploadedBy,
      metadata: { role: 'main' },
    })

    const thumbBuf = await sharp(avifBuf)
      .ensureAlpha()
      .resize({
        width: 400,
        height: 400,
        fit: 'inside',
        withoutEnlargement: true,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .avif({ quality: 70, effort: 3, chromaSubsampling: '4:4:4' })
      .toBuffer()
    await r2PutObject(thumbBuf, thumbKey, 'image/avif', {
      source: 'work_session_thumb',
      classification: 'transient',
      linkedRefs: [{ table: 'work_session', column: 'payload.shots.thumb_r2_key', row_id: sessionId }],
      uploadedBy,
      metadata: { role: 'thumb', original_key: mainKey },
    })
    return { ok: true }
  } catch (e) {
    return { error: String(e) }
  }
}

export async function uploadWorkSessionShot(
  sessionId: string,
  formData: FormData,
): Promise<SessionActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const file = formData.get('image') as File | null
  if (!file || file.size === 0) return { error: 'Image manquante' }

  const { data: row, error: selErr } = await workSessionTable(supabase)
    .select('id,user_id,status,payload')
    .eq('id', sessionId)
    .maybeSingle()
  if (selErr || !row) return { error: selErr?.message ?? 'Session introuvable' }
  if (row.user_id !== user.id) return { error: 'Accès refusé' }
  if (row.status !== 'draft') return { error: 'Session non modifiable' }

  const rawBuf = Buffer.from(await file.arrayBuffer())
  const sha256 = crypto.createHash('sha256').update(rawBuf).digest('hex')
  const validated = await validateWorkImageBuffer(rawBuf)
  if ('error' in validated) return { error: validated.error }

  const hash8 = sha256.slice(0, 8)
  const mainKey = `work-session/${sessionId}/${hash8}_main.avif`
  const thumbKey = `thumbs/work-session/${sessionId}/${hash8}_thumb.avif`

  const put = await putAvifPair(rawBuf, mainKey, thumbKey, sessionId, user.id)
  if ('error' in put) return { error: put.error }

  const payload = parseWorkSessionPayload(row.payload)
  const shot: WorkSessionShot = {
    r2_key: mainKey,
    thumb_r2_key: thumbKey,
    sha256,
    size_bytes: rawBuf.length,
  }
  payload.shots = [...payload.shots, shot]

  const { error: upErr } = await workSessionTable(supabase)
    .update({ payload: payload as unknown as Record<string, unknown> })
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .eq('status', 'draft')
  if (upErr) return { error: upErr.message }

  revalidatePath('/atelier/session/new')
  return { ok: true }
}

export async function createAndLinkWorkFromSession(
  sessionId: string,
  fields: {
    title_hint: string
    notes?: string
    width_cm?: string
    height_cm?: string
    field_context?: WorkSessionFieldContext | null
  },
): Promise<{ ok: true; oeuvreId: number } | { error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const titre = fields.title_hint.trim()
  if (!titre) return { error: 'Titre requis pour créer une œuvre' }

  const { data: row, error: selErr } = await workSessionTable(supabase)
    .select('id,user_id,status,payload,oeuvre_id')
    .eq('id', sessionId)
    .maybeSingle()
  if (selErr || !row) return { error: selErr?.message ?? 'Session introuvable' }
  if (row.user_id !== user.id) return { error: 'Accès refusé' }
  if (row.status !== 'draft') return { error: 'Session non modifiable' }
  if (row.oeuvre_id) return { error: 'Œuvre déjà associée' }

  const metaPatch = {
    notes: fields.notes ?? '',
    title_hint: titre,
    width_cm: fields.width_cm ?? '',
    height_cm: fields.height_cm ?? '',
    ...(fields.field_context != null ? { field_context: fields.field_context } : {}),
  }
  const metaRes = await updateWorkSessionMetadata(sessionId, metaPatch)
  if ('error' in metaRes) return metaRes

  const { data: maxRow } = await supabase
    .from('Oeuvres')
    .select('OeuvreID')
    .order('OeuvreID', { ascending: false })
    .limit(1)
    .single()
  const oid = (maxRow?.OeuvreID ?? 2337) + 1

  const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '/')
  const originEntry = `[${dateStr}] Session terrain`
  const notesTrim = (fields.notes ?? '').trim()
  const historique = notesTrim ? `${originEntry}\n${notesTrim}` : originEntry

  const largeur = (fields.width_cm ?? '').trim() || null
  const hauteur = (fields.height_cm ?? '').trim() || null

  const { error: insertErr } = await supabase.from('Oeuvres').insert({
    OeuvreID: oid,
    Titre: titre,
    Largeur: largeur,
    Hauteur: hauteur,
    Commentaires: notesTrim || null,
    Historique: historique,
    statusId: 1,
    NeedsPhotograph: true,
    Exposable: false,
    Catalogué: false,
  })
  if (insertErr) return { error: insertErr.message }

  const { error: linkErr } = await workSessionTable(supabase)
    .update({ oeuvre_id: oid })
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .eq('status', 'draft')
  if (linkErr) return { error: linkErr.message }

  revalidatePath('/atelier')
  revalidatePath('/atelier/session/new')
  return { ok: true, oeuvreId: oid }
}

export async function linkWorkSessionToOeuvre(
  sessionId: string,
  oeuvreId: number,
): Promise<SessionActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }
  if (!Number.isFinite(oeuvreId) || oeuvreId <= 0) return { error: 'Œuvre invalide' }

  const { error } = await workSessionTable(supabase)
    .update({ oeuvre_id: oeuvreId })
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .eq('status', 'draft')
  if (error) return { error: error.message }
  return { ok: true }
}

export async function submitWorkSessionForReview(sessionId: string): Promise<SessionActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { data: row, error: selErr } = await workSessionTable(supabase)
    .select('id,user_id,status,payload,oeuvre_id')
    .eq('id', sessionId)
    .maybeSingle()
  if (selErr || !row) return { error: selErr?.message ?? 'Session introuvable' }
  if (row.user_id !== user.id) return { error: 'Accès refusé' }
  if (row.status !== 'draft') return { error: 'Session déjà envoyée' }
  if (!row.oeuvre_id) return { error: 'Associez une œuvre avant envoi' }
  const payload = parseWorkSessionPayload(row.payload)
  if (payload.shots.length === 0) return { error: 'Ajoutez au moins une photo' }

  const admin = await rpcIsAdmin(supabase)
  if (admin) return { error: 'Les administrateurs appliquent directement ou abandonnent le brouillon' }

  const { error: upErr } = await workSessionTable(supabase)
    .update({ status: 'pending_review' })
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .eq('status', 'draft')
  if (upErr) return { error: upErr.message }

  revalidatePath('/atelier/session/new')
  revalidatePath('/atelier/audit')
  return { ok: true }
}

export async function applyWorkSessionToOeuvre(sessionId: string): Promise<SessionActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }
  if (!(await rpcIsAdmin(supabase))) return { error: 'Action réservée à l’administrateur' }

  const { data: row, error: selErr } = await workSessionTable(supabase)
    .select('id,status,payload,oeuvre_id')
    .eq('id', sessionId)
    .maybeSingle()
  if (selErr || !row) return { error: selErr?.message ?? 'Session introuvable' }
  if (!row.oeuvre_id) return { error: 'Œuvre manquante' }
  if (row.status !== 'draft' && row.status !== 'pending_review') {
    return { error: 'Session déjà traitée' }
  }
  const payload = parseWorkSessionPayload(row.payload)
  if (payload.shots.length === 0) return { error: 'Aucune photo à appliquer' }

  const oeuvreId = row.oeuvre_id as number
  const captureMeta = {
    source: 'work_session',
    session_id: sessionId,
    notes: payload.notes ?? null,
    title_hint: payload.title_hint ?? null,
    width_cm: payload.width_cm ?? null,
    height_cm: payload.height_cm ?? null,
  }

  for (const shot of payload.shots) {
    let buf: Buffer
    try {
      buf = await r2GetObjectBuffer(shot.r2_key)
    } catch (e) {
      return { error: `Lecture R2: ${String(e)}` }
    }
    const file = new File([new Uint8Array(buf)], 'session.avif', { type: 'image/avif' })
    const fd = new FormData()
    fd.set('oeuvre_id', String(oeuvreId))
    fd.set('image', file)
    fd.set('image_sha256', shot.sha256)
    fd.set('image_capture_meta', JSON.stringify({ ...captureMeta, shot_sha256: shot.sha256 }))
    const res = await addWorkImage(fd)
    if ('error' in res) return { error: res.error }
    try {
      await r2DeleteObject(shot.r2_key)
      if (shot.thumb_r2_key) await r2DeleteObject(shot.thumb_r2_key)
    } catch {
      /* best-effort cleanup */
    }
  }

  const donePayload: Record<string, unknown> = {
    notes: payload.notes ?? null,
    title_hint: payload.title_hint ?? null,
    width_cm: payload.width_cm ?? null,
    height_cm: payload.height_cm ?? null,
    shots: [],
    applied_at: new Date().toISOString(),
    applied_by: user.id,
  }

  const { error: finErr } = await workSessionTable(supabase)
    .update({
      status: 'applied',
      payload: donePayload,
    })
    .eq('id', sessionId)
  if (finErr) return { error: finErr.message }

  revalidatePath('/atelier')
  revalidatePath('/atelier/session/new')
  revalidatePath('/atelier/audit')
  return { ok: true }
}

export async function rejectWorkSession(sessionId: string, reason: string): Promise<SessionActionResult> {
  const supabase = await createClient()
  if (!(await rpcIsAdmin(supabase))) return { error: 'Action réservée à l’administrateur' }

  const { data: row, error: selErr } = await workSessionTable(supabase)
    .select('id,status,payload')
    .eq('id', sessionId)
    .maybeSingle()
  if (selErr || !row) return { error: selErr?.message ?? 'Session introuvable' }
  if (row.status !== 'pending_review') return { error: 'Statut invalide pour rejet' }
  const payload = parseWorkSessionPayload(row.payload)
  payload.reject_reason = reason.trim() || '—'

  const { error } = await workSessionTable(supabase)
    .update({
      status: 'rejected',
      payload: payload as unknown as Record<string, unknown>,
    })
    .eq('id', sessionId)
    .eq('status', 'pending_review')
  if (error) return { error: error.message }
  revalidatePath('/atelier/session/new')
  revalidatePath('/atelier/audit')
  return { ok: true }
}

export async function deleteWorkSessionAdmin(sessionId: string): Promise<SessionActionResult> {
  const supabase = await createClient()
  if (!(await rpcIsAdmin(supabase))) return { error: 'Action réservée à l’administrateur' }

  const { data: row, error: selErr } = await workSessionTable(supabase)
    .select('id,payload')
    .eq('id', sessionId)
    .maybeSingle()
  if (selErr || !row) return { error: selErr?.message ?? 'Session introuvable' }
  const payload = parseWorkSessionPayload(row.payload)
  for (const shot of payload.shots) {
    try {
      await r2DeleteObject(shot.r2_key)
      if (shot.thumb_r2_key) await r2DeleteObject(shot.thumb_r2_key)
    } catch {
      /* ignore */
    }
  }
  const { error } = await workSessionTable(supabase).delete().eq('id', sessionId)
  if (error) return { error: error.message }
  revalidatePath('/atelier/session/new')
  revalidatePath('/atelier/audit')
  return { ok: true }
}

export type WorkSessionQueueRow = WorkSessionRow & {
  oeuvre_title: string | null
  shot_count: number
  author_email: string | null
}

async function enrichWorkSessionQueueRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: WorkSessionRow[],
): Promise<WorkSessionQueueRow[]> {
  if (rows.length === 0) return []
  const oeuvreIds = Array.from(
    new Set(rows.map((r) => r.oeuvre_id).filter((id): id is number => typeof id === 'number' && id > 0)),
  )
  const userIds = Array.from(new Set(rows.map((r) => r.user_id)))
  let titleMap = new Map<number, string | null>()
  if (oeuvreIds.length > 0) {
    const { data: titles } = await supabase
      .from('Oeuvres')
      .select('OeuvreID, Titre')
      .in('OeuvreID', oeuvreIds)
    titleMap = new Map(
      (titles ?? []).map((t: { OeuvreID: number; Titre: string | null }) => [t.OeuvreID, t.Titre]),
    )
  }
  let emailMap = new Map<string, string | null>()
  if (userIds.length > 0) {
    const { data: contacts } = await supabase
      .from('Contact')
      .select('auth_user_id, Email')
      .in('auth_user_id', userIds)
    emailMap = new Map(
      (contacts ?? []).map((c: { auth_user_id: string | null; Email: string | null }) => [
        c.auth_user_id ?? '',
        c.Email,
      ]),
    )
  }
  return rows.map((row) => ({
    ...row,
    oeuvre_title: row.oeuvre_id ? titleMap.get(row.oeuvre_id) ?? null : null,
    shot_count: parseWorkSessionPayload(row.payload).shots.length,
    author_email: emailMap.get(row.user_id) ?? null,
  }))
}

/** Admin review queue: editor submissions + drafts with photos ready to apply. */
export async function listWorkSessionsForAdminReview(): Promise<WorkSessionQueueRow[]> {
  const supabase = await createClient()
  if (!(await rpcIsAdmin(supabase))) return []
  const { data, error } = await workSessionTable(supabase)
    .select('*')
    .in('status', ['pending_review', 'draft'])
    .not('oeuvre_id', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(100)
  if (error) {
    console.error('[work_session] listForAdminReview', error.message)
    return []
  }
  const withShots = ((data ?? []) as WorkSessionRow[]).filter(
    (row) => parseWorkSessionPayload(row.payload).shots.length > 0,
  )
  return enrichWorkSessionQueueRows(supabase, withShots)
}

/** @deprecated Prefer listWorkSessionsForAdminReview — kept for callers that only need pending_review. */
export async function listPendingWorkSessionsAdmin(): Promise<WorkSessionRow[]> {
  const rows = await listWorkSessionsForAdminReview()
  return rows.filter((r) => r.status === 'pending_review')
}

export async function listWorkSessionsForOeuvre(oeuvreId: number): Promise<WorkSessionRow[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await workSessionTable(supabase)
    .select('*')
    .eq('oeuvre_id', oeuvreId)
    .order('updated_at', { ascending: false })
    .limit(50)
  if (error) {
    console.error('[work_session] listForOeuvre', error.message)
    return []
  }
  return (data ?? []) as WorkSessionRow[]
}
