'use server'

// Atelier > Broadcast tab — read-only dashboard data + admin-only stuck-queue clearing.
// Service-role for reads (RLS on broadcast_events / oeuvre_broadcasts is admin_select only,
// but we keep a uniform admin gate via is_admin() before returning anything).

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { thumbUrl } from '@/lib/data'

async function requireAdminGuard(): Promise<{ error: string } | { ok: true }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }
  const { data: isAdmin } = await supabase.rpc('is_admin')
  if (!isAdmin) return { error: 'Accès réservé à l’administrateur' }
  return { ok: true }
}

export type BroadcastQueueRow = {
  oeuvreId: number
  titre: string | null
  thumb: string | null
  anneeYear: number | null
  platform: string
  status: 'queued' | 'posted'
  queuedAt: string | null
  attemptCount: number
  broadcastId: string
}

export type BroadcastPostedRow = {
  broadcastId: string
  oeuvreId: number
  titre: string | null
  thumb: string | null
  platform: string
  broadcastAt: string
  externalUrl: string | null
  captionFinal: string | null
}

export type BroadcastEventRow = {
  id: string
  oeuvreId: number | null
  titre: string | null
  platform: string
  eventType: string
  priority: 'vip' | 'normal'
  summary: string | null
  externalUrl: string | null
  createdAt: string
}

export type BroadcastDashboard = {
  queue: BroadcastQueueRow[]
  posted: BroadcastPostedRow[]
  events: BroadcastEventRow[]
  /**
   * `vipUnseen` = count within the fetched events window (legacy, kept for compat).
   * `vipTotal`  = true DB count of all VIP events (use for the badge).
   */
  counts: { queued: number; posted: number; vipUnseen: number; vipTotal: number }
}

export type BroadcastDashboardResult =
  | { error: string }
  | { ok: true; data: BroadcastDashboard }

function yearFromAnnee(annee: string | null | undefined): number | null {
  if (!annee) return null
  const m = String(annee).match(/^(\d{4})/)
  return m ? Number(m[1]) : null
}

export async function listBroadcastDashboard(): Promise<BroadcastDashboardResult> {
  const guard = await requireAdminGuard()
  if ('error' in guard) return { error: guard.error }

  const sb = createServiceClient()

  const [
    { data: queueRows, error: qErr },
    { data: postedRows, error: pErr },
    { data: eventRows, error: eErr },
    { count: vipCountRaw, error: vipCountErr },
  ] =
    await Promise.all([
      sb
        .from('oeuvre_broadcasts')
        .select('id, oeuvre_id, platform, status, queued_at, attempt_count')
        .eq('status', 'queued')
        .order('queued_at', { ascending: false })
        .limit(100),
      sb
        .from('oeuvre_broadcasts')
        .select('id, oeuvre_id, platform, broadcast_at, external_url, caption_final')
        .eq('status', 'posted')
        .order('broadcast_at', { ascending: false })
        .limit(50),
      sb
        .from('broadcast_events')
        .select('id, oeuvre_id, platform, event_type, priority, summary, external_url, created_at')
        .order('created_at', { ascending: false })
        .limit(50),
      // True VIP count — not limited by the events window fetch above.
      sb
        .from('broadcast_events')
        .select('id', { count: 'exact', head: true })
        .eq('priority', 'vip'),
    ])

  if (qErr) return { error: qErr.message }
  if (pErr) return { error: pErr.message }
  if (eErr) return { error: eErr.message }
  if (vipCountErr) return { error: vipCountErr.message }

  const oeuvreIds = new Set<number>()
  for (const r of queueRows ?? []) oeuvreIds.add((r as { oeuvre_id: number }).oeuvre_id)
  for (const r of postedRows ?? []) oeuvreIds.add((r as { oeuvre_id: number }).oeuvre_id)
  for (const r of eventRows ?? []) {
    const id = (r as { oeuvre_id: number | null }).oeuvre_id
    if (id != null) oeuvreIds.add(id)
  }

  let works: Array<{ OeuvreID: number; Titre: string | null; Année: string | null; txtImageNameLink: string | null }> = []
  if (oeuvreIds.size > 0) {
    const { data: wRows, error: wErr } = await sb
      .from('Oeuvres')
      .select('OeuvreID, Titre, "Année", txtImageNameLink')
      .in('OeuvreID', [...oeuvreIds])
    if (wErr) return { error: wErr.message }
    works = wRows ?? []
  }
  const workMap = new Map<number, { titre: string | null; annee: string | null; thumb: string | null }>()
  for (const w of works) {
    workMap.set(w.OeuvreID, {
      titre: w.Titre,
      annee: w.Année,
      thumb: thumbUrl(w.txtImageNameLink ?? undefined),
    })
  }

  const queue: BroadcastQueueRow[] = (queueRows ?? []).map((r: unknown) => {
    const row = r as {
      id: string; oeuvre_id: number; platform: string; status: 'queued' | 'posted';
      queued_at: string | null; attempt_count: number | null
    }
    const w = workMap.get(row.oeuvre_id)
    return {
      oeuvreId: row.oeuvre_id,
      titre: w?.titre ?? null,
      thumb: w?.thumb ?? null,
      anneeYear: yearFromAnnee(w?.annee),
      platform: row.platform,
      status: row.status,
      queuedAt: row.queued_at,
      attemptCount: row.attempt_count ?? 0,
      broadcastId: row.id,
    }
  })

  const posted: BroadcastPostedRow[] = (postedRows ?? []).map((r: unknown) => {
    const row = r as {
      id: string; oeuvre_id: number; platform: string; broadcast_at: string;
      external_url: string | null; caption_final: string | null
    }
    const w = workMap.get(row.oeuvre_id)
    return {
      broadcastId: row.id,
      oeuvreId: row.oeuvre_id,
      titre: w?.titre ?? null,
      thumb: w?.thumb ?? null,
      platform: row.platform,
      broadcastAt: row.broadcast_at,
      externalUrl: row.external_url,
      captionFinal: row.caption_final,
    }
  })

  const events: BroadcastEventRow[] = (eventRows ?? []).map((r: unknown) => {
    const row = r as {
      id: string; oeuvre_id: number | null; platform: string; event_type: string;
      priority: 'vip' | 'normal'; summary: string | null; external_url: string | null; created_at: string
    }
    const w = row.oeuvre_id != null ? workMap.get(row.oeuvre_id) : null
    return {
      id: row.id,
      oeuvreId: row.oeuvre_id,
      titre: w?.titre ?? null,
      platform: row.platform,
      eventType: row.event_type,
      priority: row.priority,
      summary: row.summary,
      externalUrl: row.external_url,
      createdAt: row.created_at,
    }
  })

  const vipInWindow = events.filter((e) => e.priority === 'vip').length
  const counts = {
    queued: queue.length,
    posted: posted.length,
    vipUnseen: vipInWindow,
    vipTotal: vipCountRaw ?? vipInWindow,
  }

  return { ok: true, data: { queue, posted, events, counts } }
}

/** Clear a stuck queued row so the work re-enters the feed. Admin only. */
export async function clearStuckQueue(
  oeuvreId: number,
  platform: string,
): Promise<{ error: string } | { ok: true }> {
  const guard = await requireAdminGuard()
  if ('error' in guard) return { error: guard.error }

  if (!Number.isFinite(oeuvreId) || oeuvreId <= 0) return { error: 'oeuvreId requis' }
  const p = String(platform ?? '').trim().toLowerCase()
  if (!p) return { error: 'platform requis' }

  const sb = createServiceClient()
  const { error } = await sb
    .from('oeuvre_broadcasts')
    .delete()
    .eq('oeuvre_id', oeuvreId)
    .eq('platform', p)
    .eq('status', 'queued')
  if (error) return { error: error.message }

  revalidatePath('/atelier')
  return { ok: true }
}
