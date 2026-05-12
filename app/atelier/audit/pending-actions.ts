'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { saveWork } from '@/app/atelier/works/actions'

export interface PendingChange {
  id:            number
  oeuvre_id:     number
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
  // Optional: enrich with current title for the queue list
  const ids = Array.from(new Set((data ?? []).map((r) => r.oeuvre_id)))
  let titleMap = new Map<number, string | null>()
  if (ids.length > 0) {
    const { data: titles } = await gate.supabase
      .from('Oeuvres').select('OeuvreID, Titre').in('OeuvreID', ids)
    titleMap = new Map((titles ?? []).map((t: { OeuvreID: number; Titre: string | null }) => [t.OeuvreID, t.Titre]))
  }
  return (data ?? []).map((r) => ({ ...r, oeuvre_title: titleMap.get(r.oeuvre_id) ?? null }))
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

  // Replay payload through saveWork as the admin (skip_review bypasses the queue).
  const fd = new FormData()
  for (const [k, v] of Object.entries(row.payload as Record<string, string>)) {
    fd.append(k, v)
  }
  fd.set('__skip_review', '1')
  const result = await saveWork(fd)
  if ('error' in result) return { error: result.error }

  const { error: uErr } = await supabase
    .from('pending_changes')
    .update({ status: 'approved', reviewed_at: new Date().toISOString(), reviewer_id: user.id })
    .eq('id', id)
  if (uErr) return { error: uErr.message }

  revalidatePath('/atelier/audit')
  revalidatePath('/atelier')
  return { ok: true }
}

export async function rejectPendingChange(id: number, reason: string): Promise<PendingResult> {
  const gate = await ensureAdmin()
  if (gate.error) return { error: gate.error }
  const supabase = gate.supabase!
  const user = gate.user!

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
