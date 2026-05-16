'use server'

// Atelier > Broadcast tab — team command-center data and audited operations.
// Service-role is used after an explicit team/admin guard because broadcast RLS is intentionally narrow.

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { thumbUrl } from '@/lib/data'
import { isBroadcastEligible, normalizeBroadcastPlatform, type BroadcastOeuvreRow } from '@/lib/broadcast-eligibility'
import { logSystemEvent } from '@/lib/utils/logging'

async function requireAdminGuard(): Promise<{ error: string } | { ok: true }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }
  const { data: isAdmin } = await supabase.rpc('is_admin')
  if (!isAdmin) return { error: 'Accès réservé à l’administrateur' }
  return { ok: true }
}

async function requireTeamGuard(): Promise<{ error: string } | { ok: true; isAdmin: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }
  const { data: isTeam } = await supabase.rpc('is_team')
  if (!isTeam) return { error: 'Accès réservé à l’équipe' }
  const { data: isAdmin } = await supabase.rpc('is_admin')
  return { ok: true, isAdmin: !!isAdmin }
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
  captionSeed: string | null
}

export type BroadcastPostedRow = {
  broadcastId: string
  oeuvreId: number
  titre: string | null
  thumb: string | null
  platform: string
  broadcastAt: string | null
  externalUrl: string | null
  captionFinal: string | null
  externalPostId: string | null
  captionSeed: string | null
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

export type BroadcastCandidateRow = {
  oeuvreId: number
  titre: string | null
  thumb: string | null
  anneeYear: number | null
  captionSeed: string | null
}

export type BroadcastDashboard = {
  queue: BroadcastQueueRow[]
  posted: BroadcastPostedRow[]
  events: BroadcastEventRow[]
  candidates: BroadcastCandidateRow[]
  platforms: string[]
  selectedPlatform: string
  isAdmin: boolean
  counts: { queued: number; posted: number; vipUnseen: number; events: number; candidates: number }
}

export type BroadcastDashboardResult =
  | { error: string }
  | { ok: true; data: BroadcastDashboard }

export type BroadcastMutationResult = { error: string } | { ok: true }

function yearFromAnnee(annee: string | null | undefined): number | null {
  if (!annee) return null
  const m = String(annee).match(/^(\d{4})/)
  return m ? Number(m[1]) : null
}

function textOrNull(value: unknown, max = 8000): string | null {
  if (value == null) return null
  const raw = typeof value === 'string' ? value : String(value)
  const trimmed = raw.trim()
  return trimmed ? trimmed.slice(0, max) : null
}

function validOeuvreId(value: number): boolean {
  return Number.isInteger(value) && value > 0
}

type WorkInfo = {
  titre: string | null
  annee: string | null
  thumb: string | null
  captionSeed: string | null
}

type BroadcastRecord = {
  id: string
  oeuvre_id: number
  platform: string
  status: 'queued' | 'posted'
  queued_at: string | null
  attempt_count: number | null
  broadcast_at?: string | null
  external_url?: string | null
  caption_final?: string | null
  external_post_id?: string | null
}

type EventRecord = {
  id: string
  oeuvre_id: number | null
  platform: string
  event_type: string
  priority: 'vip' | 'normal'
  summary: string | null
  external_url: string | null
  created_at: string
}

type CandidateRecord = BroadcastOeuvreRow & {
  Titre: string | null
  Année: string | null
}

export async function listBroadcastDashboard(options?: { platform?: string }): Promise<BroadcastDashboardResult> {
  const guard = await requireTeamGuard()
  if ('error' in guard) return { error: guard.error }

  const sb = createServiceClient()
  const selectedPlatform = normalizeBroadcastPlatform(options?.platform ?? '') ?? 'instagram'
  const queueCutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString()

  const [
    { data: queueRows, error: qErr },
    { data: postedRows, error: pErr },
    { data: eventRows, error: eErr },
    { data: platformRows },
    { data: eventPlatformRows },
    queuedCount,
    postedCount,
    vipCount,
    eventCount,
    selectedDoneRows,
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
        .select('id, oeuvre_id, platform, status, broadcast_at, external_url, caption_final, external_post_id')
        .eq('status', 'posted')
        .order('broadcast_at', { ascending: false })
        .limit(100),
      sb
        .from('broadcast_events')
        .select('id, oeuvre_id, platform, event_type, priority, summary, external_url, created_at')
        .order('created_at', { ascending: false })
        .limit(100),
      sb.from('oeuvre_broadcasts').select('platform').limit(1000),
      sb.from('broadcast_events').select('platform').limit(1000),
      sb.from('oeuvre_broadcasts').select('id', { count: 'exact', head: true }).eq('status', 'queued'),
      sb.from('oeuvre_broadcasts').select('id', { count: 'exact', head: true }).eq('status', 'posted'),
      sb.from('broadcast_events').select('id', { count: 'exact', head: true }).eq('priority', 'vip'),
      sb.from('broadcast_events').select('id', { count: 'exact', head: true }),
      sb
        .from('oeuvre_broadcasts')
        .select('oeuvre_id, status, queued_at')
        .eq('platform', selectedPlatform),
    ])

  if (qErr) return { error: qErr.message }
  if (pErr) return { error: pErr.message }
  if (eErr) return { error: eErr.message }
  if (queuedCount.error) return { error: queuedCount.error.message }
  if (postedCount.error) return { error: postedCount.error.message }
  if (vipCount.error) return { error: vipCount.error.message }
  if (eventCount.error) return { error: eventCount.error.message }
  if (selectedDoneRows.error) return { error: selectedDoneRows.error.message }

  const excludedCandidateIds = (selectedDoneRows.data ?? [])
    .filter((r: unknown) => {
      const row = r as { status?: string | null; queued_at?: string | null }
      if (row.status === 'posted') return true
      if (row.status === 'queued' && row.queued_at && row.queued_at > queueCutoff) return true
      return false
    })
    .map((r: unknown) => (r as { oeuvre_id: number }).oeuvre_id)

  let candidateQuery = sb
    .from('Oeuvres')
    .select('OeuvreID, Titre, "Année", deleted_at, is_public, broadcast_ready, txtImageNameLink, broadcast_caption_seed', { count: 'exact' })
    .is('deleted_at', null)
    .eq('is_public', true)
    .eq('broadcast_ready', true)
    .not('txtImageNameLink', 'is', null)
    .order('Année', { ascending: false })
    .limit(80)
  if (excludedCandidateIds.length > 0) {
    candidateQuery = candidateQuery.not('OeuvreID', 'in', `(${excludedCandidateIds.join(',')})`)
  }
  const { data: candidateRows, count: candidateCount, error: cErr } = await candidateQuery
  if (cErr) return { error: cErr.message }

  const oeuvreIds = new Set<number>()
  for (const r of queueRows ?? []) oeuvreIds.add((r as BroadcastRecord).oeuvre_id)
  for (const r of postedRows ?? []) oeuvreIds.add((r as BroadcastRecord).oeuvre_id)
  for (const r of eventRows ?? []) {
    const id = (r as EventRecord).oeuvre_id
    if (id != null) oeuvreIds.add(id)
  }

  let works: Array<{ OeuvreID: number; Titre: string | null; Année: string | null; txtImageNameLink: string | null; broadcast_caption_seed: string | null }> = []
  if (oeuvreIds.size > 0) {
    const { data: wRows, error: wErr } = await sb
      .from('Oeuvres')
      .select('OeuvreID, Titre, "Année", txtImageNameLink, broadcast_caption_seed')
      .in('OeuvreID', [...oeuvreIds])
    if (wErr) return { error: wErr.message }
    works = wRows ?? []
  }
  const workMap = new Map<number, WorkInfo>()
  for (const w of works) {
    workMap.set(w.OeuvreID, {
      titre: w.Titre,
      annee: w.Année,
      thumb: thumbUrl(w.txtImageNameLink ?? undefined),
      captionSeed: w.broadcast_caption_seed ?? null,
    })
  }

  const queue: BroadcastQueueRow[] = (queueRows ?? []).map((r: unknown) => {
    const row = r as BroadcastRecord
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
      captionSeed: w?.captionSeed ?? null,
    }
  })

  const posted: BroadcastPostedRow[] = (postedRows ?? []).map((r: unknown) => {
    const row = r as BroadcastRecord
    const w = workMap.get(row.oeuvre_id)
    return {
      broadcastId: row.id,
      oeuvreId: row.oeuvre_id,
      titre: w?.titre ?? null,
      thumb: w?.thumb ?? null,
      platform: row.platform,
      broadcastAt: row.broadcast_at ?? null,
      externalUrl: row.external_url ?? null,
      captionFinal: row.caption_final ?? null,
      externalPostId: row.external_post_id ?? null,
      captionSeed: w?.captionSeed ?? null,
    }
  })

  const events: BroadcastEventRow[] = (eventRows ?? []).map((r: unknown) => {
    const row = r as EventRecord
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

  const candidates: BroadcastCandidateRow[] = ((candidateRows ?? []) as CandidateRecord[]).map((row) => ({
    oeuvreId: row.OeuvreID,
    titre: row.Titre ?? null,
    thumb: thumbUrl(row.txtImageNameLink ?? undefined),
    anneeYear: yearFromAnnee(row.Année),
    captionSeed: row.broadcast_caption_seed ?? null,
  }))

  const platformSet = new Set<string>([selectedPlatform, 'instagram'])
  for (const row of platformRows ?? []) {
    const platform = normalizeBroadcastPlatform((row as { platform: string | null }).platform)
    if (platform) platformSet.add(platform)
  }
  for (const row of eventPlatformRows ?? []) {
    const platform = normalizeBroadcastPlatform((row as { platform: string | null }).platform)
    if (platform) platformSet.add(platform)
  }

  const counts = {
    queued: queuedCount.count ?? queue.length,
    posted: postedCount.count ?? posted.length,
    vipUnseen: vipCount.count ?? events.filter((e) => e.priority === 'vip').length,
    events: eventCount.count ?? events.length,
    candidates: candidateCount ?? candidates.length,
  }

  return {
    ok: true,
    data: {
      queue,
      posted,
      events,
      candidates,
      platforms: [...platformSet].sort((a, b) => a.localeCompare(b)),
      selectedPlatform,
      isAdmin: guard.isAdmin,
      counts,
    },
  }
}

async function getEligibleWork(oeuvreId: number): Promise<{ error: string } | { ok: true; row: BroadcastOeuvreRow }> {
  if (!validOeuvreId(oeuvreId)) return { error: 'oeuvreId requis' }
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('Oeuvres')
    .select('OeuvreID, deleted_at, is_public, broadcast_ready, txtImageNameLink, broadcast_caption_seed')
    .eq('OeuvreID', oeuvreId)
    .maybeSingle()
  if (error) return { error: error.message }
  if (!data) return { error: 'Œuvre introuvable' }
  const row = data as BroadcastOeuvreRow
  if (!isBroadcastEligible(row)) return { error: 'Œuvre non éligible à la diffusion' }
  return { ok: true, row }
}

export async function queueBroadcastWork(oeuvreId: number, platformRaw: string): Promise<BroadcastMutationResult> {
  const guard = await requireTeamGuard()
  if ('error' in guard) return { error: guard.error }
  const platform = normalizeBroadcastPlatform(platformRaw)
  if (!platform) return { error: 'platform requis' }
  const eligible = await getEligibleWork(oeuvreId)
  if ('error' in eligible) return { error: eligible.error }

  const sb = createServiceClient()
  const { data: existing, error: exErr } = await sb
    .from('oeuvre_broadcasts')
    .select('id, status, attempt_count')
    .eq('oeuvre_id', oeuvreId)
    .eq('platform', platform)
    .maybeSingle()
  if (exErr) return { error: exErr.message }
  if ((existing as { status?: string } | null)?.status === 'posted') return { error: 'Déjà publié sur cette plateforme' }

  const now = new Date().toISOString()
  let broadcastId: string | null = null
  let action = 'queued'
  if (existing) {
    const row = existing as { id: string; attempt_count: number | null }
    const { error } = await sb
      .from('oeuvre_broadcasts')
      .update({ status: 'queued', queued_at: now, attempt_count: (row.attempt_count ?? 0) + 1 })
      .eq('id', row.id)
    if (error) return { error: error.message }
    broadcastId = row.id
    action = 'requeued'
  } else {
    const { data, error } = await sb
      .from('oeuvre_broadcasts')
      .insert({ oeuvre_id: oeuvreId, platform, status: 'queued', queued_at: now, attempt_count: 1 })
      .select('id')
      .single()
    if (error) return { error: error.message }
    broadcastId = (data as { id: string }).id
  }

  await logSystemEvent({
    eventType: 'SYSTEM_CONFIG',
    tableName: 'oeuvre_broadcasts',
    rowId: broadcastId ?? `${oeuvreId}:${platform}`,
    metadata: { action: `broadcast_${action}`, oeuvreId, platform },
  })
  revalidatePath('/atelier')
  return { ok: true }
}

export async function confirmBroadcastPost(input: {
  oeuvreId: number
  platform: string
  externalUrl?: string | null
  captionFinal?: string | null
}): Promise<BroadcastMutationResult> {
  const guard = await requireTeamGuard()
  if ('error' in guard) return { error: guard.error }
  const platform = normalizeBroadcastPlatform(input.platform)
  if (!platform) return { error: 'platform requis' }
  const eligible = await getEligibleWork(input.oeuvreId)
  if ('error' in eligible) return { error: eligible.error }

  const sb = createServiceClient()
  const { data: existing, error: exErr } = await sb
    .from('oeuvre_broadcasts')
    .select('id, status')
    .eq('oeuvre_id', input.oeuvreId)
    .eq('platform', platform)
    .maybeSingle()
  if (exErr) return { error: exErr.message }
  if ((existing as { status?: string } | null)?.status === 'posted') return { error: 'Déjà publié sur cette plateforme' }

  const now = new Date().toISOString()
  const postedFields = {
    status: 'posted' as const,
    broadcast_at: now,
    queued_at: null as string | null,
    external_url: textOrNull(input.externalUrl, 2000),
    caption_final: textOrNull(input.captionFinal, 8000),
  }
  let broadcastId: string
  if (existing) {
    const row = existing as { id: string }
    const { error } = await sb.from('oeuvre_broadcasts').update(postedFields).eq('id', row.id)
    if (error) return { error: error.message }
    broadcastId = row.id
  } else {
    const { data, error } = await sb
      .from('oeuvre_broadcasts')
      .insert({ oeuvre_id: input.oeuvreId, platform, ...postedFields })
      .select('id')
      .single()
    if (error) return { error: error.message }
    broadcastId = (data as { id: string }).id
  }

  await logSystemEvent({
    eventType: 'SYSTEM_CONFIG',
    tableName: 'oeuvre_broadcasts',
    rowId: broadcastId,
    metadata: { action: 'broadcast_confirm_post', oeuvreId: input.oeuvreId, platform },
  })
  revalidatePath('/atelier')
  return { ok: true }
}

export async function updateBroadcastPost(input: {
  broadcastId: string
  externalUrl?: string | null
  captionFinal?: string | null
}): Promise<BroadcastMutationResult> {
  const guard = await requireTeamGuard()
  if ('error' in guard) return { error: guard.error }
  const broadcastId = textOrNull(input.broadcastId, 128)
  if (!broadcastId) return { error: 'broadcastId requis' }

  const sb = createServiceClient()
  const { data: existing, error: exErr } = await sb
    .from('oeuvre_broadcasts')
    .select('id, oeuvre_id, platform, external_url, caption_final')
    .eq('id', broadcastId)
    .eq('status', 'posted')
    .maybeSingle()
  if (exErr) return { error: exErr.message }
  if (!existing) return { error: 'Publication introuvable' }

  const next = {
    external_url: textOrNull(input.externalUrl, 2000),
    caption_final: textOrNull(input.captionFinal, 8000),
  }
  const { error } = await sb.from('oeuvre_broadcasts').update(next).eq('id', broadcastId).eq('status', 'posted')
  if (error) return { error: error.message }

  const row = existing as { oeuvre_id: number; platform: string; external_url: string | null; caption_final: string | null }
  await logSystemEvent({
    eventType: 'SYSTEM_CONFIG',
    tableName: 'oeuvre_broadcasts',
    rowId: broadcastId,
    oldValue: { external_url: row.external_url, caption_final: row.caption_final },
    newValue: next,
    metadata: { action: 'broadcast_update_post', oeuvreId: row.oeuvre_id, platform: row.platform },
  })
  revalidatePath('/atelier')
  return { ok: true }
}

export async function appendBroadcastEvent(input: {
  oeuvreId?: number | null
  platform: string
  priority?: 'vip' | 'normal'
  summary: string
  externalUrl?: string | null
}): Promise<BroadcastMutationResult> {
  const guard = await requireTeamGuard()
  if ('error' in guard) return { error: guard.error }
  const platform = normalizeBroadcastPlatform(input.platform)
  if (!platform) return { error: 'platform requis' }
  const summary = textOrNull(input.summary, 500)
  if (!summary) return { error: 'note requise' }
  const oeuvreId = input.oeuvreId != null && validOeuvreId(input.oeuvreId) ? input.oeuvreId : null
  const priority = input.priority === 'vip' ? 'vip' : 'normal'

  const sb = createServiceClient()
  const { data, error } = await sb
    .from('broadcast_events')
    .insert({
      oeuvre_id: oeuvreId,
      platform,
      event_type: 'note',
      priority,
      summary,
      external_url: textOrNull(input.externalUrl, 2000),
      payload: { source: 'atelier_command_center' },
    })
    .select('id')
    .single()
  if (error) return { error: error.message }
  const eventId = (data as { id: string }).id

  await logSystemEvent({
    eventType: 'SYSTEM_CONFIG',
    tableName: 'broadcast_events',
    rowId: eventId,
    metadata: { action: 'broadcast_append_event', oeuvreId, platform, priority },
  })
  revalidatePath('/atelier')
  return { ok: true }
}

/** Clear a stuck queued row so the work re-enters the feed. Admin only. */
export async function clearStuckQueue(
  oeuvreId: number,
  platform: string,
): Promise<{ error: string } | { ok: true }> {
  const guard = await requireAdminGuard()
  if ('error' in guard) return { error: guard.error }

  if (!validOeuvreId(oeuvreId)) return { error: 'oeuvreId requis' }
  const p = normalizeBroadcastPlatform(platform)
  if (!p) return { error: 'platform requis' }

  const sb = createServiceClient()
  const { error } = await sb
    .from('oeuvre_broadcasts')
    .delete()
    .eq('oeuvre_id', oeuvreId)
    .eq('platform', p)
    .eq('status', 'queued')
  if (error) return { error: error.message }

  await logSystemEvent({
    eventType: 'SYSTEM_CONFIG',
    tableName: 'oeuvre_broadcasts',
    rowId: `${oeuvreId}:${p}`,
    metadata: { action: 'broadcast_clear_stuck_queue', oeuvreId, platform: p },
  })
  revalidatePath('/atelier')
  return { ok: true }
}
