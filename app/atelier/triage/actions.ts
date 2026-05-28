'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { thumbUrl } from '@/lib/data'
import { logSystemEvent } from '@/lib/utils/logging'

export type TriageDeckCard =
  | {
      kind: 'broadcast'
      broadcastId: string
      oeuvreId: number
      titre: string | null
      thumb: string | null
      platform: string
      queuedAt: string | null
    }
  | {
      kind: 'enquiry'
      id: string
      name: string
      email: string
      message: string
      category: string
      createdAt: string
    }

async function guardTeam() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'auth' as const, supabase: null, isAdmin: false }
  const { data: isTeam } = await supabase.rpc('is_team')
  if (!isTeam) return { error: 'forbidden' as const, supabase: null, isAdmin: false }
  const { data: isAdmin } = await supabase.rpc('is_admin')
  return { error: null, supabase, isAdmin: !!isAdmin }
}

export async function listTriageDeck(): Promise<{ cards: TriageDeckCard[] } | { error: string }> {
  const g = await guardTeam()
  if (g.error || !g.supabase) return { error: g.error ?? 'auth' }

  const cards: TriageDeckCard[] = []

  if (g.isAdmin) {
    const sb = createServiceClient()
    const { data: queueRows } = await sb
      .from('oeuvre_broadcasts')
      .select('id, oeuvre_id, platform, queued_at')
      .eq('status', 'queued')
      .order('queued_at', { ascending: false })
      .limit(40)

    const ids = [...new Set((queueRows ?? []).map((r: { oeuvre_id: number }) => r.oeuvre_id))]
    const titreMap = new Map<number, { Titre: string | null; txtImageNameLink: string | null }>()
    if (ids.length) {
      const { data: works } = await sb.from('Oeuvres').select('OeuvreID, Titre, txtImageNameLink').in('OeuvreID', ids)
      for (const w of works ?? []) {
        titreMap.set(w.OeuvreID as number, { Titre: w.Titre as string | null, txtImageNameLink: w.txtImageNameLink as string | null })
      }
    }

    for (const r of queueRows ?? []) {
      const w = titreMap.get(r.oeuvre_id as number)
      cards.push({
        kind: 'broadcast',
        broadcastId: r.id as string,
        oeuvreId: r.oeuvre_id as number,
        titre: w?.Titre ?? null,
        thumb: w?.txtImageNameLink ? thumbUrl(w.txtImageNameLink) : null,
        platform: r.platform as string,
        queuedAt: r.queued_at as string | null,
      })
    }
  }

  const { data: enquiries } = await g.supabase.from('inquiry')
    .select('id, name, email, message, category, created_at, status')
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(30)

  for (const row of enquiries ?? []) {
    cards.push({
      kind: 'enquiry',
      id: row.id as string,
      name: row.name as string,
      email: row.email as string,
      message: (row.message as string).slice(0, 500),
      category: row.category as string,
      createdAt: row.created_at as string,
    })
  }

  return { cards }
}

export async function approveBroadcast(broadcastId: string): Promise<{ ok: true } | { error: string }> {
  const g = await guardTeam()
  if (g.error || !g.supabase || !g.isAdmin) return { error: g.error ?? 'forbidden' }

  const sb = createServiceClient()
  const now = new Date().toISOString()
  const { error } = await sb
    .from('oeuvre_broadcasts')
    .update({ status: 'posted', broadcast_at: now })
    .eq('id', broadcastId)
    .eq('status', 'queued')
  if (error) return { error: error.message }

  await logSystemEvent({
    eventType: 'SYSTEM_CONFIG',
    tableName: 'oeuvre_broadcasts',
    rowId: broadcastId,
    metadata: { action: 'triage_approve_broadcast' },
  })
  revalidatePath('/atelier/triage')
  revalidatePath('/atelier')
  return { ok: true }
}

export async function rejectBroadcast(broadcastId: string): Promise<{ ok: true } | { error: string }> {
  const g = await guardTeam()
  if (g.error || !g.supabase || !g.isAdmin) return { error: g.error ?? 'forbidden' }

  const sb = createServiceClient()
  const { error } = await sb.from('oeuvre_broadcasts').delete().eq('id', broadcastId).eq('status', 'queued')
  if (error) return { error: error.message }

  await logSystemEvent({
    eventType: 'SYSTEM_CONFIG',
    tableName: 'oeuvre_broadcasts',
    rowId: broadcastId,
    metadata: { action: 'triage_reject_broadcast' },
  })
  revalidatePath('/atelier/triage')
  return { ok: true }
}

export async function approveEnquiry(inquiryId: string): Promise<{ ok: true } | { error: string }> {
  const g = await guardTeam()
  if (g.error || !g.supabase) return { error: g.error ?? 'auth' }

  const { error } = await g.supabase.from('inquiry')
    .update({ status: 'in_progress' })
    .eq('id', inquiryId)
    .eq('status', 'open')
  if (error) return { error: error.message }

  await logSystemEvent({
    eventType: 'SYSTEM_CONFIG',
    tableName: 'inquiry',
    rowId: inquiryId,
    metadata: { action: 'triage_approve_enquiry' },
  })
  revalidatePath('/atelier/triage')
  return { ok: true }
}

export async function archiveEnquiry(inquiryId: string): Promise<{ ok: true } | { error: string }> {
  const g = await guardTeam()
  if (g.error || !g.supabase) return { error: g.error ?? 'auth' }

  const { error } = await g.supabase.from('inquiry')
    .update({ status: 'closed' })
    .eq('id', inquiryId)
  if (error) return { error: error.message }

  await logSystemEvent({
    eventType: 'SYSTEM_CONFIG',
    tableName: 'inquiry',
    rowId: inquiryId,
    metadata: { action: 'triage_archive_enquiry' },
  })
  revalidatePath('/atelier/triage')
  return { ok: true }
}
