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
import { logSystemEvent } from '@/lib/utils/logging'
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
type ShareActionOk = { ok: true; href?: string }

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
  const { data: row, error } = await (supabase.from('share_inbox') as any)
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
    const { data, error } = await (g.supabase.from('Contact') as any)
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
    const { data, error } = await (g.supabase.from('suivi_process') as any)
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
      const { error: docErr } = await (g.supabase.from('document') as any).insert({
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

  const { data: c } = await (g.supabase.from('Contact') as any)
    .select('Notes')
    .eq('ContactID', contactId)
    .maybeSingle()
  if (!c) return { error: 'not_found' }

  const { error: upErr } = await (g.supabase.from('Contact') as any)
    .update({ Notes: appendBlock(c.Notes, block) })
    .eq('ContactID', contactId)
  if (upErr) return { error: upErr.message }

  const fin = await finishInbox(inboxId, { target: 'contact', contactId })
  if (fin) return fin
  return { ok: true, href: `/atelier?tab=contacts&contact=${contactId}` }
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

  const { data: p } = await (g.supabase.from('suivi_process') as any)
    .select('notes')
    .eq('id', processId)
    .maybeSingle()
  if (!p) return { error: 'not_found' }

  const { error: upErr } = await (g.supabase.from('suivi_process') as any)
    .update({ notes: appendBlock(p.notes, block) })
    .eq('id', processId)
  if (upErr) return { error: upErr.message }

  const fin = await finishInbox(inboxId, { target: 'process', processId })
  if (fin) return fin
  return { ok: true, href: `/atelier?tab=pipeline&process=${processId}` }
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
    const { error: docErr } = await (g.supabase.from('document') as any).insert({
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
  return { ok: true, href: '/atelier?tab=vault' }
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
  const { error } = await (g.supabase.from('voice_note') as any).insert({
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
  return { ok: true, href: '/atelier?tab=notes' }
}
