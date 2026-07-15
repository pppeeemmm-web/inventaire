'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { saveWork, commitWorkImage, discardPendingWorkImage } from '@/app/atelier/works/actions'
import {
  filterPendingPayloadForReplay,
  filterPendingImageAddPayload,
  formDataFromPendingPayload,
  resolvePendingChangeKind,
  type PendingChangeKind,
} from '@/lib/work-pending-keys'
import { attachShareInboxFilesToWork } from '@/app/atelier/share-triage/actions'

function parseCaptureMeta(raw: string | undefined): Record<string, unknown> | null {
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>
  } catch {
    /* ignore invalid JSON */
  }
  return null
}

export interface PendingChange {
  id:            number
  oeuvre_id:     number | null
  change_kind:   PendingChangeKind
  payload:       Record<string, string>
  baseline:      Record<string, unknown> | null
  author_id:     string | null
  author_email:  string | null
  status:        'pending' | 'approved' | 'rejected'
  created_at:    string
  reviewed_at:   string | null
  reviewer_id:   string | null
  reject_reason: string | null
  oeuvre_title?: string | null
}

export type PendingResult = { ok: true } | { error: string }

async function ensureAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' as const, supabase, user: null }
  const { data: isAdmin } = await supabase.rpc('is_admin')
  if (!isAdmin) return { error: 'Action réservée à l’administrateur' as const, supabase, user }
  return { error: null, supabase, user }
}

export async function listPendingChanges(): Promise<PendingChange[]> {
  const gate = await ensureAdmin()
  if (gate.error || !gate.supabase) return []
  const { data, error } = await gate.supabase
    .from('pending_changes')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) {
    console.error('[pending] list', error.message)
    return []
  }
  const ids = Array.from(
    new Set((data ?? []).map((r) => r.oeuvre_id).filter((id): id is number => id != null)),
  )
  let titleMap = new Map<number, string | null>()
  if (ids.length > 0) {
    const { data: titles } = await gate.supabase
      .from('Oeuvres').select('OeuvreID, Titre').in('OeuvreID', ids)
    titleMap = new Map((titles ?? []).map((t: { OeuvreID: number; Titre: string | null }) => [t.OeuvreID, t.Titre]))
  }
  return (data ?? []).map((r) => {
    const payload = r.payload as Record<string, string>
    const kind = resolvePendingChangeKind({
      change_kind: r.change_kind as string | null,
      oeuvre_id: r.oeuvre_id,
      payload,
    })
    const titleFromPayload = (payload.titre ?? '').trim() || null
    const oeuvreTitle =
      r.oeuvre_id != null ? titleMap.get(r.oeuvre_id) ?? null : titleFromPayload
    return {
      ...r,
      change_kind: kind,
      oeuvre_id: r.oeuvre_id,
      payload,
      oeuvre_title: oeuvreTitle,
    }
  })
}

export async function approvePendingChange(id: number): Promise<PendingResult> {
  const gate = await ensureAdmin()
  if (gate.error) return { error: gate.error }
  const supabase = gate.supabase!
  const user = gate.user!

  const { data: row, error: selErr } = await supabase
    .from('pending_changes').select('*').eq('id', id).maybeSingle()
  if (selErr) return { error: selErr.message }
  if (!row || row.status !== 'pending') return { error: 'Proposition introuvable ou déjà traitée' }

  const rawPayload = row.payload as Record<string, unknown>
  const kind = resolvePendingChangeKind({
    change_kind: row.change_kind as string | null,
    oeuvre_id: row.oeuvre_id,
    payload: rawPayload as Record<string, string>,
  })

  if (kind === 'image_add') {
    if (row.oeuvre_id == null) return { error: 'Œuvre introuvable pour cette image' }
    const img = filterPendingImageAddPayload(rawPayload)
    if (!img.filename) return { error: 'Fichier image introuvable' }
    const commitRes = await commitWorkImage(supabase, row.oeuvre_id, img.filename, {
      captureMeta: parseCaptureMeta(img.capture_meta),
      sha256: img.sha256 || null,
    })
    if ('error' in commitRes) return { error: commitRes.error }

    const { error: uErr } = await supabase
      .from('pending_changes')
      .update({ status: 'approved', reviewed_at: new Date().toISOString(), reviewer_id: user.id })
      .eq('id', id)
    if (uErr) return { error: uErr.message }

    revalidatePath('/atelier/audit')
    revalidatePath('/atelier')
    revalidatePath('/hub')
    revalidatePath('/works')
    return { ok: true }
  }

  const filtered = filterPendingPayloadForReplay(rawPayload)
  const shareInboxId = filtered.__share_inbox_id?.trim()
  const shareFileIndex = filtered.__share_file_index?.trim()
  const fd = formDataFromPendingPayload(filtered)
  fd.set('__skip_review', '1')
  if (row.author_id) fd.set('__pending_author_id', row.author_id)
  const result = await saveWork(fd)
  if ('error' in result) return { error: result.error }

  if (shareInboxId && typeof result.newId === 'number') {
    const idx =
      shareFileIndex != null && shareFileIndex !== '' ? Number(shareFileIndex) : undefined
    const indexes = idx != null && Number.isFinite(idx) ? [idx] : undefined
    const attach = await attachShareInboxFilesToWork(shareInboxId, result.newId, indexes)
    if (attach) return { error: attach.error }
  }

  const { error: uErr } = await supabase
    .from('pending_changes')
    .update({ status: 'approved', reviewed_at: new Date().toISOString(), reviewer_id: user.id })
    .eq('id', id)
  if (uErr) return { error: uErr.message }

  revalidatePath('/atelier/audit')
  revalidatePath('/atelier')
  revalidatePath('/hub')
  revalidatePath('/works')
  return { ok: true }
}

export async function rejectPendingChange(id: number, reason: string): Promise<PendingResult> {
  const gate = await ensureAdmin()
  if (gate.error) return { error: gate.error }
  const supabase = gate.supabase!
  const user = gate.user!

  const { data: row, error: selErr } = await supabase
    .from('pending_changes').select('*').eq('id', id).eq('status', 'pending').maybeSingle()
  if (selErr) return { error: selErr.message }

  if (row) {
    const kind = resolvePendingChangeKind({
      change_kind: row.change_kind as string | null,
      oeuvre_id: row.oeuvre_id,
      payload: row.payload as Record<string, string>,
    })
    if (kind === 'image_add') {
      const img = filterPendingImageAddPayload(row.payload as Record<string, unknown>)
      if (img.filename) await discardPendingWorkImage(img.filename)
    }
  }

  const { error } = await supabase
    .from('pending_changes')
    .update({
      status: 'rejected',
      reviewed_at: new Date().toISOString(),
      reviewer_id: user.id,
      reject_reason: reason || null,
    })
    .eq('id', id)
    .eq('status', 'pending')
  if (error) return { error: error.message }

  revalidatePath('/atelier/audit')
  return { ok: true }
}
