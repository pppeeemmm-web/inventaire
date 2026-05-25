'use server'

import crypto from 'crypto'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { r2GetObjectBuffer, r2PutObject } from '@/lib/r2-s3-object'
import { validateWorkImageBuffer } from '@/lib/image-upload'
import type { ShareInboxPayloadV1 } from '@/lib/share-inbox-types'
import { isShareInboxPayloadV1 } from '@/lib/share-inbox-types'
import { deleteShareInboxEntry } from '@/app/atelier/share-inbox-actions'
import { addWorkImage } from '@/app/atelier/works/actions'
import { uploadWorkSessionItemShot } from '@/app/atelier/session/actions'
import { logSystemEvent } from '@/lib/utils/logging'
import { shareImageFiles, titreSeedFromSharePayload } from '@/lib/share-inbox-titre'
import { provenanceTimestamp, provenanceUserId } from '@/lib/oeuvre-provenance'
import { recordStorageObject } from '@/lib/storage-object-ledger'
import {
  S3Client,
  PutObjectCommand,
} from '@aws-sdk/client-s3'

const VAULT_BUCKET = process.env.R2_VAULT_BUCKET ?? 'vault'

export type ShareAttachTargetType = 'work' | 'contact' | 'process' | 'vault' | 'note'

export type ShareAttachSearchHit =
  | { type: 'work'; id: number; label: string }
  | { type: 'contact'; id: number; label: string }
  | { type: 'process'; id: string; label: string }

type ShareActionErr = { error: string }
type ShareActionOk = { ok: true; href?: string; pending?: true }

async function guardTeam(): Promise<
  | { error: string; supabase: null; user: null }
  | { error: null; supabase: Awaited<ReturnType<typeof createClient>>; user: { id: string } }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'auth', supabase: null, user: null }
  const { data: isTeam } = await supabase.rpc('is_team')
  if (!isTeam) return { error: 'forbidden', supabase: null, user: null }
  return { error: null, supabase, user }
}

async function loadInbox(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  inboxId: string,
): Promise<{ payload: ShareInboxPayloadV1 } | ShareActionErr> {
  const { data: row, error } = await supabase.from('share_inbox')
    .select('payload')
    .eq('id', inboxId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) return { error: error.message }
  if (!row || !isShareInboxPayloadV1(row.payload)) return { error: 'not_found' }
  return { payload: row.payload }
}

function formatShareInboxText(p: ShareInboxPayloadV1): string {
  const parts: string[] = []
  if (p.title?.trim()) parts.push(p.title.trim())
  if (p.text?.trim()) parts.push(p.text.trim())
  if (p.urls.length) parts.push(p.urls.join('\n'))
  return parts.join('\n\n').trim()
}

function appendBlock(existing: string | null | undefined, block: string): string {
  const prev = (existing ?? '').trim()
  if (!block) return prev
  if (!prev) return block
  return `${prev}\n\n---\n[Share]\n${block}`
}

async function vaultR2Upload(
  key: string,
  body: Buffer,
  contentType: string,
  uploadedBy: string,
  source: string,
): Promise<void> {
  const accountId = process.env.R2_ACCOUNT_ID ?? ''
  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.eu.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
    },
  })
  await s3.send(
    new PutObjectCommand({
      Bucket: VAULT_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  )
  await recordStorageObject({
    bucket: VAULT_BUCKET,
    objectKey: key,
    sizeBytes: body.length,
    contentType,
    source,
    classification: 'linked',
    linkedRefs: [{ table: 'document', column: 'storage_path' }],
    uploadedBy,
  })
}

function isPdfBuffer(buf: Buffer): boolean {
  return buf.length > 5 && buf.subarray(0, 5).toString('binary') === '%PDF-'
}

async function finishInbox(inboxId: string, meta: Record<string, unknown>): Promise<ShareActionErr | null> {
  const del = await deleteShareInboxEntry(inboxId)
  if ('error' in del) return { error: del.error }
  await logSystemEvent({
    eventType: 'SYSTEM_CONFIG',
    tableName: 'share_inbox',
    rowId: inboxId,
    metadata: { action: 'share_attach', ...meta },
  })
  revalidatePath('/atelier/share-triage')
  revalidatePath('/atelier')
  return null
}

export async function searchShareAttachTargets(
  type: ShareAttachTargetType,
  query: string,
): Promise<{ hits: ShareAttachSearchHit[] } | ShareActionErr> {
  const g = await guardTeam()
  if (g.error || !g.supabase) return { error: g.error ?? 'auth' }

  const q = query.trim().slice(0, 80)
  if (q.length < 1) return { hits: [] }

  const pattern = `%${q.replace(/[%_]/g, '')}%`

  if (type === 'work') {
    const { data, error } = await g.supabase
      .from('Oeuvres')
      .select('OeuvreID, Titre')
      .is('deleted_at', null)
      .ilike('Titre', pattern)
      .order('OeuvreID', { ascending: false })
      .limit(20)
    if (error) return { error: error.message }
    const hits: ShareAttachSearchHit[] = (data ?? []).map((r) => ({
      type: 'work',
      id: r.OeuvreID as number,
      label: (r.Titre as string | null) || `#${r.OeuvreID}`,
    }))
    return { hits }
  }

  if (type === 'contact') {
    const { data, error } = await g.supabase.from('Contact')
      .select('ContactID, Nom')
      .ilike('Nom', pattern)
      .order('ContactID', { ascending: false })
      .limit(20)
    if (error) return { error: error.message }
    const hits: ShareAttachSearchHit[] = (data ?? []).map((r: { ContactID: number; Nom: string | null }) => ({
      type: 'contact',
      id: r.ContactID,
      label: r.Nom || `#${r.ContactID}`,
    }))
    return { hits }
  }

  if (type === 'process') {
    const { data, error } = await g.supabase.from('suivi_process')
      .select('id, nom')
      .ilike('nom', pattern)
      .order('updated_at', { ascending: false })
      .limit(20)
    if (error) return { error: error.message }
    const hits: ShareAttachSearchHit[] = (data ?? []).map((r: { id: string; nom: string }) => ({
      type: 'process',
      id: r.id,
      label: r.nom || r.id.slice(0, 8),
    }))
    return { hits }
  }

  return { hits: [] }
}

export async function attachShareInboxToWork(
  inboxId: string,
  oeuvreId: number,
): Promise<ShareActionOk | ShareActionErr> {
  const g = await guardTeam()
  if (g.error || !g.supabase || !g.user) return { error: g.error ?? 'auth' }

  const loaded = await loadInbox(g.supabase, g.user.id, inboxId)
  if ('error' in loaded) return loaded
  const { payload } = loaded

  const block = formatShareInboxText(payload)
  if (block) {
    const { data: w } = await g.supabase.from('Oeuvres').select('Commentaires').eq('OeuvreID', oeuvreId).maybeSingle()
    const { error: upErr } = await g.supabase
      .from('Oeuvres')
      .update({ Commentaires: appendBlock(w?.Commentaires as string | null, block) })
      .eq('OeuvreID', oeuvreId)
    if (upErr) return { error: upErr.message }
  }

  for (const f of payload.files) {
    let buf: Buffer
    try {
      buf = await r2GetObjectBuffer(f.r2_key)
    } catch (e) {
      return { error: String(e) }
    }
    if (isPdfBuffer(buf)) {
      const path = `${new Date().toISOString().slice(0, 10)}_scan_share_${oeuvreId}_${f.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
      try {
        await vaultR2Upload(path, buf, 'application/pdf', g.user.id, 'share_inbox_work_pdf')
      } catch (e) {
        return { error: String(e) }
      }
      const { error: docErr } = await g.supabase.from('document').insert({
        name: f.name || payload.title || 'Share PDF',
        kind: 'scan',
        storage_path: path,
        file_size: buf.length,
        mime_type: 'application/pdf',
        oeuvre_id: oeuvreId,
        oeuvre_ids: [oeuvreId],
        notes: block || null,
      })
      if (docErr) return { error: docErr.message }
      continue
    }
    const validated = await validateWorkImageBuffer(buf)
    if ('error' in validated) continue
    const file = new File([new Uint8Array(buf)], f.name || `share.${validated.ext}`, { type: validated.mime })
    const fd = new FormData()
    fd.set('oeuvre_id', String(oeuvreId))
    fd.set('image', file)
    fd.set('image_capture_meta', JSON.stringify({ source: 'share_inbox', inbox_id: inboxId, file: f.name }))
    const res = await addWorkImage(fd)
    if ('error' in res) return { error: res.error }
  }

  const fin = await finishInbox(inboxId, { target: 'work', oeuvreId })
  if (fin) return fin
  return { ok: true, href: `/atelier?work=${oeuvreId}` }
}

export async function attachShareInboxToContact(
  inboxId: string,
  contactId: number,
): Promise<ShareActionOk | ShareActionErr> {
  const g = await guardTeam()
  if (g.error || !g.supabase || !g.user) return { error: g.error ?? 'auth' }

  const loaded = await loadInbox(g.supabase, g.user.id, inboxId)
  if ('error' in loaded) return loaded
  const block = formatShareInboxText(loaded.payload)
  if (!block && loaded.payload.files.length === 0) return { error: 'empty' }

  const { data: c } = await g.supabase.from('Contact')
    .select('Notes')
    .eq('ContactID', contactId)
    .maybeSingle()
  if (!c) return { error: 'not_found' }

  const { error: upErr } = await g.supabase.from('Contact')
    .update({ Notes: appendBlock(c.Notes, block) })
    .eq('ContactID', contactId)
  if (upErr) return { error: upErr.message }

  const fin = await finishInbox(inboxId, { target: 'contact', contactId })
  if (fin) return fin
  return { ok: true, href: `/atelier/contacts?contact=${contactId}` }
}

export async function attachShareInboxToProcess(
  inboxId: string,
  processId: string,
): Promise<ShareActionOk | ShareActionErr> {
  const g = await guardTeam()
  if (g.error || !g.supabase || !g.user) return { error: g.error ?? 'auth' }

  const loaded = await loadInbox(g.supabase, g.user.id, inboxId)
  if ('error' in loaded) return loaded
  const block = formatShareInboxText(loaded.payload)

  const { data: p } = await g.supabase.from('suivi_process')
    .select('notes')
    .eq('id', processId)
    .maybeSingle()
  if (!p) return { error: 'not_found' }

  const { error: upErr } = await g.supabase.from('suivi_process')
    .update({ notes: appendBlock(p.notes, block) })
    .eq('id', processId)
  if (upErr) return { error: upErr.message }

  const fin = await finishInbox(inboxId, { target: 'process', processId })
  if (fin) return fin
  return { ok: true, href: `/atelier/pipeline?process=${processId}` }
}

export async function attachShareInboxToVault(
  inboxId: string,
  docName?: string | null,
): Promise<ShareActionOk | ShareActionErr> {
  const g = await guardTeam()
  if (g.error || !g.supabase || !g.user) return { error: g.error ?? 'auth' }

  const loaded = await loadInbox(g.supabase, g.user.id, inboxId)
  if ('error' in loaded) return loaded
  const { payload } = loaded
  if (payload.files.length === 0) return { error: 'no_files' }

  const label = (docName?.trim() || payload.title?.trim() || 'Share import').slice(0, 200)
  const block = formatShareInboxText(payload)

  for (const f of payload.files) {
    let buf: Buffer
    try {
      buf = await r2GetObjectBuffer(f.r2_key)
    } catch (e) {
      return { error: String(e) }
    }
    const dateStr = new Date().toISOString().slice(0, 10)
    const safe = f.name.replace(/[^a-zA-Z0-9.-]/g, '_').slice(0, 60)
    const path = `${dateStr}_scan_${safe}`
    const mime = f.mime || (isPdfBuffer(buf) ? 'application/pdf' : 'application/octet-stream')
    try {
      await vaultR2Upload(path, buf, mime, g.user.id, 'share_inbox_vault')
    } catch (e) {
      return { error: String(e) }
    }
    const { error: docErr } = await g.supabase.from('document').insert({
      name: f.name || label,
      kind: 'scan',
      storage_path: path,
      file_size: buf.length,
      mime_type: mime,
      notes: block || null,
    })
    if (docErr) return { error: docErr.message }
  }

  const fin = await finishInbox(inboxId, { target: 'vault' })
  if (fin) return fin
  return { ok: true, href: '/atelier/vault' }
}

export async function attachShareInboxToVoiceNote(inboxId: string): Promise<ShareActionOk | ShareActionErr> {
  const g = await guardTeam()
  if (g.error || !g.supabase || !g.user) return { error: g.error ?? 'auth' }

  const loaded = await loadInbox(g.supabase, g.user.id, inboxId)
  if ('error' in loaded) return loaded
  const { payload } = loaded
  const transcript = formatShareInboxText(payload)
  if (!transcript && payload.files.length === 0) return { error: 'empty' }

  const id = crypto.randomUUID()
  const { error } = await g.supabase.from('voice_note').insert({
    id,
    user_id: g.user.id,
    kind: 'memo',
    bucket: 'general',
    subject: payload.title?.trim() || null,
    transcript: transcript || `[${payload.files.length} file(s) — see share inbox attach to vault/work]`,
    audio_r2_key: null,
    audio_mime: null,
    duration_ms: null,
    oeuvre_id: null,
  })
  if (error) return { error: error.message }

  const fin = await finishInbox(inboxId, { target: 'note', voiceNoteId: id })
  if (fin) return fin
  return { ok: true, href: '/atelier/notes' }
}

// ── Slice 2: Lightroom / new-work from share inbox ───────────────────────────

export type ShareInboxWorkPrefill = {
  inboxId: string
  titre: string
  files: ShareInboxPayloadV1['files']
  imageFiles: ShareInboxPayloadV1['files']
}

export type RecentWorkAttachRow = { id: number; label: string }

export async function getShareInboxWorkPrefill(
  inboxId: string,
): Promise<{ prefill: ShareInboxWorkPrefill } | ShareActionErr> {
  const g = await guardTeam()
  if (g.error || !g.supabase || !g.user) return { error: g.error ?? 'auth' }

  const loaded = await loadInbox(g.supabase, g.user.id, inboxId)
  if ('error' in loaded) return loaded
  const imageFiles = shareImageFiles(loaded.payload)
  return {
    prefill: {
      inboxId,
      titre: titreSeedFromSharePayload(loaded.payload, 0),
      files: loaded.payload.files,
      imageFiles,
    },
  }
}

export async function listRecentWorksForShareAttach(
  limit = 5,
): Promise<{ works: RecentWorkAttachRow[] } | ShareActionErr> {
  const g = await guardTeam()
  if (g.error || !g.supabase) return { error: g.error ?? 'auth' }

  const { data, error } = await g.supabase
    .from('Oeuvres')
    .select('OeuvreID, Titre')
    .is('deleted_at', null)
    .order('OeuvreID', { ascending: false })
    .limit(Math.min(Math.max(1, limit), 20))
  if (error) return { error: error.message }

  const works: RecentWorkAttachRow[] = (data ?? []).map((r) => ({
    id: r.OeuvreID as number,
    label: (r.Titre as string | null) || `#${r.OeuvreID}`,
  }))
  return { works }
}

async function nextOeuvreId(supabase: Awaited<ReturnType<typeof createClient>>): Promise<number | ShareActionErr> {
  const { data: maxRow, error } = await supabase
    .from('Oeuvres')
    .select('OeuvreID')
    .order('OeuvreID', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) return { error: error.message }
  return (maxRow?.OeuvreID ?? 2337) + 1
}

async function attachInboxImageFilesToWork(
  g: { supabase: Awaited<ReturnType<typeof createClient>>; user: { id: string } },
  payload: ShareInboxPayloadV1,
  oeuvreId: number,
  inboxId: string,
  fileIndexes?: number[],
): Promise<ShareActionErr | null> {
  const indexes =
    fileIndexes ??
    payload.files
      .map((f, i) => (f.mime.startsWith('image/') ? i : -1))
      .filter((i) => i >= 0)

  for (const idx of indexes) {
    const f = payload.files[idx]
    if (!f || !f.mime.startsWith('image/')) continue

    let buf: Buffer
    try {
      buf = await r2GetObjectBuffer(f.r2_key)
    } catch (e) {
      return { error: String(e) }
    }
    if (!buf) return { error: 'R2 fetch failed' }

    const validated = await validateWorkImageBuffer(buf)
    if ('error' in validated) continue

    const file = new File([new Uint8Array(buf)], f.name || `share.${validated.ext}`, {
      type: validated.mime,
    })
    const fd = new FormData()
    fd.set('oeuvre_id', String(oeuvreId))
    fd.set('image', file)
    fd.set(
      'image_capture_meta',
      JSON.stringify({ source: 'share_inbox', inbox_id: inboxId, file: f.name }),
    )
    const res = await addWorkImage(fd)
    if ('error' in res) return { error: res.error }
  }
  return null
}

/** Create a new œuvre and attach one or all inbox images (optional text block). */
export async function createDraftWorkFromShareInbox(
  inboxId: string,
  opts?: { fileIndex?: number; appendShareText?: boolean; finishInbox?: boolean },
): Promise<ShareActionOk | ShareActionErr> {
  const g = await guardTeam()
  if (g.error || !g.supabase || !g.user) return { error: g.error ?? 'auth' }

  const loaded = await loadInbox(g.supabase, g.user.id, inboxId)
  if ('error' in loaded) return loaded
  const { payload } = loaded

  const fileIndex = opts?.fileIndex ?? 0
  const titre = titreSeedFromSharePayload(payload, fileIndex) || null

  const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '/')
  let commentaires: string | null = null
  if (opts?.appendShareText !== false) {
    const block = formatShareInboxText(payload)
    if (block) commentaires = appendBlock(null, block)
  }

  const { data: isAdmin } = await g.supabase.rpc('is_admin')
  if (!isAdmin) {
    const queuePayload: Record<string, string> = {
      titre: titre ?? '',
      status_id: '1',
      catalogued: '0',
      needs_photograph: '0',
      exposable: '0',
      __share_inbox_id: inboxId,
      __share_file_index: String(fileIndex),
    }
    if (commentaires) queuePayload.commentaires = commentaires
    const {
      data: { user: authUser },
    } = await g.supabase.auth.getUser()
    const { error: pErr } = await g.supabase.from('pending_changes').insert({
      oeuvre_id: null,
      change_kind: 'create',
      payload: queuePayload,
      baseline: null,
      author_id: g.user.id,
      author_email: authUser?.email ?? null,
    })
    if (pErr) return { error: pErr.message }
    revalidatePath('/atelier/audit')
    return { ok: true, pending: true }
  }

  const oidRes = await nextOeuvreId(g.supabase)
  if (typeof oidRes !== 'number') return oidRes
  const oid = oidRes
  const actorId = provenanceUserId(g.user.id, null)
  const editedAt = provenanceTimestamp()

  const { error: insertErr } = await g.supabase.from('Oeuvres').insert({
    OeuvreID: oid,
    Titre: titre,
    Commentaires: commentaires,
    Historique: `[${dateStr}] Atelier (share)`,
    statusId: 1,
    Catalogué: false,
    NeedsPhotograph: false,
    Exposable: false,
    created_by: actorId,
    edited_by: actorId,
    edited_at: editedAt,
  })
  if (insertErr) return { error: insertErr.message }

  const attachErr = await attachInboxImageFilesToWork(
    g,
    payload,
    oid,
    inboxId,
    opts?.fileIndex != null ? [opts.fileIndex] : undefined,
  )
  if (attachErr) return attachErr

  if (opts?.finishInbox !== false) {
    const fin = await finishInbox(inboxId, { target: 'work', oeuvreId: oid, created: true })
    if (fin) return fin
  }

  revalidatePath('/atelier')
  return { ok: true, href: `/atelier?work=${oid}` }
}

/** After admin approves a share-originated pending create, attach inbox image(s). */
export async function attachShareInboxFilesToWork(
  inboxId: string,
  oeuvreId: number,
  fileIndexes?: number[],
): Promise<ShareActionErr | null> {
  const g = await guardTeam()
  if (g.error || !g.supabase || !g.user) return { error: g.error ?? 'auth' }

  const loaded = await loadInbox(g.supabase, g.user.id, inboxId)
  if ('error' in loaded) return loaded

  return attachInboxImageFilesToWork(g, loaded.payload, oeuvreId, inboxId, fileIndexes)
}

/** One new œuvre per image file in the inbox. */
export async function splitShareInboxIntoDrafts(
  inboxId: string,
): Promise<{ ok: true; hrefs: string[]; pending?: true } | ShareActionErr> {
  const g = await guardTeam()
  if (g.error || !g.supabase || !g.user) return { error: g.error ?? 'auth' }

  const loaded = await loadInbox(g.supabase, g.user.id, inboxId)
  if ('error' in loaded) return loaded

  const imageIndexes = loaded.payload.files
    .map((f, i) => (f.mime.startsWith('image/') ? i : -1))
    .filter((i) => i >= 0)
  if (imageIndexes.length === 0) return { error: 'empty' }

  const hrefs: string[] = []
  let anyPending = false
  for (const idx of imageIndexes) {
    const res = await createDraftWorkFromShareInbox(inboxId, {
      fileIndex: idx,
      appendShareText: idx === imageIndexes[0],
      finishInbox: false,
    })
    if ('error' in res) return res
    if (res.pending) anyPending = true
    else if (res.href) hrefs.push(res.href)
  }

  if (anyPending) {
    revalidatePath('/atelier/audit')
    return { ok: true, hrefs: [], pending: true }
  }

  const fin = await finishInbox(inboxId, { target: 'work', split: imageIndexes.length })
  if (fin) return fin

  return { ok: true, hrefs }
}

/** Import share-inbox images into an open work-session item (Lightroom → Share → return). */
export async function attachShareInboxToWorkSession(
  inboxId: string,
  sessionId: string,
  itemId: string,
  returnDate: string,
): Promise<ShareActionOk | ShareActionErr> {
  const g = await guardTeam()
  if (g.error || !g.supabase || !g.user) return { error: g.error ?? 'auth' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(returnDate.trim())) return { error: 'invalid_date' }

  const loaded = await loadInbox(g.supabase, g.user.id, inboxId)
  if ('error' in loaded) return loaded

  const images = shareImageFiles(loaded.payload)
  if (images.length === 0) return { error: 'empty' }

  for (const f of images) {
    let buf: Buffer
    try {
      buf = await r2GetObjectBuffer(f.r2_key)
    } catch (e) {
      return { error: String(e) }
    }
    const validated = await validateWorkImageBuffer(buf)
    if ('error' in validated) continue

    const file = new File([new Uint8Array(buf)], f.name || `share.${validated.ext}`, {
      type: validated.mime,
    })
    const fd = new FormData()
    fd.set('image', file)
    const res = await uploadWorkSessionItemShot(sessionId, itemId, fd)
    if ('error' in res) return { error: res.error }
  }

  const fin = await finishInbox(inboxId, { target: 'session', sessionId, itemId })
  if (fin) return fin

  revalidatePath('/atelier/session/new')
  return { ok: true, href: `/atelier/session/new?date=${returnDate}` }
}
