'use server'

import crypto from 'crypto'
import sharp from 'sharp'
import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { validateWorkImageBuffer } from '@/lib/image-upload'
import { r2PutObject, r2DeleteObject, r2GetObjectBuffer } from '@/lib/r2-s3-object'
import { addWorkImage } from '@/app/atelier/works/actions'
import {
  countWorkSessionItems,
  countWorkSessionShots,
  createWorkSessionItem,
  emptyWorkSessionPayload,
  listWorkSessionLinkedOeuvreIds,
  parseWorkSessionPayload,
  type WorkSessionFieldContext,
  type WorkSessionItem,
  type WorkSessionItemMode,
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
const SESSION_WORK_FETCH_PAGE_SIZE = 1000
const SESSION_WORK_EXCLUDED_STATUS_IDS = new Set([3, 5, 6, 11])

function expiresAtIso(): string {
  return new Date(Date.now() + DRAFT_TTL_MS).toISOString()
}

function normalizeSessionAt(value: string | null | undefined): string | null {
  if (!value) return null
  const time = Date.parse(value)
  if (Number.isNaN(time)) return null
  return new Date(time).toISOString()
}

function sessionAtForPayload(payload: WorkSessionPayload, rowCreatedAt?: string | null): string {
  return normalizeSessionAt(payload.session_at) ?? normalizeSessionAt(rowCreatedAt) ?? new Date().toISOString()
}

function formatSessionHistoryDate(value: string): string {
  return new Intl.DateTimeFormat('fr-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value)).replace(/-/g, '/')
}

async function rpcIsAdmin(supabase: Awaited<ReturnType<typeof createClient>>): Promise<boolean> {
  const { data } = await supabase.rpc('is_admin')
  return !!data
}

export type SessionActionResult = { ok: true } | { error: string }

type SessionMutableRow = {
  id: string
  user_id: string
  status: string
  payload: unknown
  oeuvre_id?: number | null
}

export type WorkSessionWorkOption = {
  OeuvreID: number
  Titre: string | null
  Année: string | null
  Hauteur: string | null
  Largeur: string | null
  statusId: number | null
  Catalogué: boolean | null
  NeedsPhotograph: boolean | null
  txtImageNameLink: string | null
}

export type WorkSessionJournalItem = {
  id: string
  mode: WorkSessionItemMode
  status: WorkSessionItem['status']
  oeuvre_id: number | null
  oeuvre_title: string | null
  work_thumb: string | null
  title_hint: string | null
  notes: string | null
  width_cm: string | null
  height_cm: string | null
  staged_shots: Array<{ r2_key: string; thumb_r2_key: string | null }>
  applied_shot_count: number
  created_at: string | null
  updated_at: string | null
  applied_at: string | null
}

export type WorkSessionJournalRow = WorkSessionRow & {
  session_at: string
  journal_notes: string | null
  field_context: WorkSessionFieldContext | null
  item_count: number
  staged_shot_count: number
  applied_shot_count: number
  items: WorkSessionJournalItem[]
}

export type WorkSessionVersionCompare = {
  before: { changed_at: string | null; source: string | null; snapshot: Record<string, unknown> | null }
  after: { changed_at: string | null; source: string | null; snapshot: Record<string, unknown> | null }
  changes: Array<{ field: string; before: unknown; after: unknown }>
}

const VERSION_COMPARE_FIELDS = [
  'Titre',
  'Année',
  'TechniqueID',
  'SupportID',
  'FormatID',
  'Hauteur',
  'Largeur',
  'Profondeur',
  'Prix',
  'PrixFinal',
  'statusId',
  'ContactID',
  'Commentaires',
  'Historique',
  'LocalisationID',
  'LocalisationDetail',
  'TVARate',
  'Catalogué',
  'NeedsPhotograph',
  'is_commission',
  'is_paid',
  'is_gift',
  'AnonymityLevel',
]

function asPayloadRecord(payload: WorkSessionPayload): Record<string, unknown> {
  return payload as unknown as Record<string, unknown>
}

function touchItem(item: WorkSessionItem): WorkSessionItem {
  return { ...item, updated_at: new Date().toISOString() }
}

function itemHasApplyTarget(item: WorkSessionItem): boolean {
  return (
    (typeof item.oeuvre_id === 'number' && item.oeuvre_id > 0)
    || (item.mode === 'new' && !!item.title_hint?.trim())
  )
}

function itemIsActionable(item: WorkSessionItem): boolean {
  return item.status !== 'applied' && item.shots.length > 0 && itemHasApplyTarget(item)
}

function isSessionWorkCandidate(work: Pick<WorkSessionWorkOption, 'statusId'>): boolean {
  return work.statusId == null || !SESSION_WORK_EXCLUDED_STATUS_IDS.has(work.statusId)
}

function isSessionWorkInProgress(work: Pick<WorkSessionWorkOption, 'statusId' | 'Catalogué' | 'NeedsPhotograph'>): boolean {
  return isSessionWorkCandidate(work) && (work.statusId === 1 || work.statusId == null || !work.Catalogué || !!work.NeedsPhotograph)
}

function actionableItemCount(payload: WorkSessionPayload): number {
  if (payload.items.length > 0) return payload.items.filter(itemIsActionable).length
  return payload.shots.length > 0 ? 1 : 0
}

function findItemIndex(payload: WorkSessionPayload, itemId: string): number {
  return payload.items.findIndex((item) => item.id === itemId)
}

async function selectWorkTitle(
  supabase: Awaited<ReturnType<typeof createClient>>,
  oeuvreId: number,
): Promise<{ ok: true; title: string | null } | { error: string }> {
  const { data, error } = await supabase
    .from('Oeuvres')
    .select('OeuvreID,Titre')
    .eq('OeuvreID', oeuvreId)
    .maybeSingle()
  if (error || !data) return { error: error?.message ?? 'Œuvre introuvable' }
  return { ok: true, title: data.Titre as string | null }
}

async function createWorkFromSessionFields(
  supabase: Awaited<ReturnType<typeof createClient>>,
  fields: {
    title_hint: string
    notes?: string
    width_cm?: string
    height_cm?: string
    session_at?: string
  },
): Promise<{ ok: true; oeuvreId: number } | { error: string }> {
  const titre = fields.title_hint.trim()
  if (!titre) return { error: 'Titre requis pour créer une œuvre' }

  const { data: maxRow } = await supabase
    .from('Oeuvres')
    .select('OeuvreID')
    .order('OeuvreID', { ascending: false })
    .limit(1)
    .single()
  const oid = (maxRow?.OeuvreID ?? 2337) + 1

  const sessionAt = normalizeSessionAt(fields.session_at) ?? new Date().toISOString()
  const dateStr = formatSessionHistoryDate(sessionAt)
  const originEntry = `[${dateStr}] Session terrain`
  const notesTrim = (fields.notes ?? '').trim()
  const historique = notesTrim ? `${originEntry}\n${notesTrim}` : originEntry

  const { error: insertErr } = await supabase.from('Oeuvres').insert({
    OeuvreID: oid,
    Titre: titre,
    Largeur: (fields.width_cm ?? '').trim() || null,
    Hauteur: (fields.height_cm ?? '').trim() || null,
    Commentaires: notesTrim || null,
    Historique: historique,
    statusId: 1,
    NeedsPhotograph: true,
    Exposable: false,
    Catalogué: false,
  })
  if (insertErr) return { error: insertErr.message }
  return { ok: true, oeuvreId: oid }
}

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
  return countWorkSessionShots(parseWorkSessionPayload(data.payload))
}

export type WorkSessionDraftFields = {
  session_at: string
  notes: string
  title_hint: string
  width_cm: string
  height_cm: string
  field_context: WorkSessionFieldContext | null
}

export async function getWorkSessionDraftFields(sessionId: string): Promise<
  { ok: true; fields: WorkSessionDraftFields; oeuvre_id: number | null; items: WorkSessionItem[] } | { error: string }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }
  const { data, error } = await workSessionTable(supabase)
    .select('payload,oeuvre_id,created_at')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (error || !data) return { error: error?.message ?? 'Session introuvable' }
  const p = parseWorkSessionPayload(data.payload)
  const oeuvreId = data.oeuvre_id
  return {
    ok: true,
    oeuvre_id: typeof oeuvreId === 'number' && oeuvreId > 0 ? oeuvreId : null,
    items: p.items,
    fields: {
      session_at: sessionAtForPayload(p, data.created_at as string | null),
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

  const payload = emptyWorkSessionPayload()
  payload.session_at = new Date().toISOString()
  const firstItem = createWorkSessionItem(oeuvreId && oeuvreId > 0 ? 'existing' : 'existing')
  if (oeuvreId && oeuvreId > 0) firstItem.oeuvre_id = oeuvreId
  payload.items = [firstItem]

  const { data, error } = await workSessionTable(supabase)
    .insert({
      user_id: user.id,
      oeuvre_id: oeuvreId && oeuvreId > 0 ? oeuvreId : null,
      expires_at: expiresAtIso(),
      status: 'draft',
      payload: asPayloadRecord(payload),
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
    session_at?: string
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
  if (typeof patch.session_at === 'string') {
    const sessionAt = normalizeSessionAt(patch.session_at)
    if (!sessionAt) return { error: 'Date de session invalide' }
    payload.session_at = sessionAt
  }
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
    .update({ payload: asPayloadRecord(payload) })
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .eq('status', 'draft')
  if (upErr) return { error: upErr.message }
  return { ok: true }
}

export async function updateWorkSessionJournalMetadata(
  sessionId: string,
  patch: {
    notes?: string
    session_at?: string
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

  const isAdmin = await rpcIsAdmin(supabase)
  if (!isAdmin && row.user_id !== user.id) return { error: 'Accès refusé' }
  if (!isAdmin && row.status !== 'draft') return { error: 'Session non modifiable' }

  const payload = parseWorkSessionPayload(row.payload)
  if (typeof patch.session_at === 'string') {
    const sessionAt = normalizeSessionAt(patch.session_at)
    if (!sessionAt) return { error: 'Date de session invalide' }
    payload.session_at = sessionAt
  }
  if (typeof patch.notes === 'string') payload.notes = patch.notes

  const { error: upErr } = await workSessionTable(supabase)
    .update({ payload: asPayloadRecord(payload) })
    .eq('id', sessionId)
  if (upErr) return { error: upErr.message }
  revalidatePath('/atelier')
  return { ok: true }
}

export async function createWorkSessionItemAction(
  sessionId: string,
  mode: WorkSessionItemMode = 'existing',
): Promise<{ ok: true; item: WorkSessionItem } | { error: string }> {
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
  if ((row as SessionMutableRow).user_id !== user.id) return { error: 'Accès refusé' }
  if ((row as SessionMutableRow).status !== 'draft') return { error: 'Session non modifiable' }

  const payload = parseWorkSessionPayload((row as SessionMutableRow).payload)
  const item = createWorkSessionItem(mode)
  payload.items = [...payload.items, item]
  const { error: upErr } = await workSessionTable(supabase)
    .update({ payload: asPayloadRecord(payload) })
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .eq('status', 'draft')
  if (upErr) return { error: upErr.message }
  return { ok: true, item }
}

export async function updateWorkSessionItemMetadata(
  sessionId: string,
  itemId: string,
  patch: {
    mode?: WorkSessionItemMode
    notes?: string
    title_hint?: string
    width_cm?: string
    height_cm?: string
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
  const isAdmin = await rpcIsAdmin(supabase)
  const canEdit = (row as SessionMutableRow).user_id === user.id || isAdmin
  if (!canEdit) return { error: 'Accès refusé' }
  if ((row as SessionMutableRow).status !== 'draft' && !isAdmin) return { error: 'Session non modifiable' }

  const payload = parseWorkSessionPayload((row as SessionMutableRow).payload)
  const idx = findItemIndex(payload, itemId)
  if (idx < 0) return { error: 'Entrée introuvable' }
  const current = payload.items[idx]
  payload.items[idx] = touchItem({
    ...current,
    ...(patch.mode ? { mode: patch.mode, oeuvre_id: patch.mode === 'new' ? null : current.oeuvre_id } : {}),
    ...(typeof patch.notes === 'string' ? { notes: patch.notes } : {}),
    ...(typeof patch.title_hint === 'string' ? { title_hint: patch.title_hint } : {}),
    ...(typeof patch.width_cm === 'string' ? { width_cm: patch.width_cm } : {}),
    ...(typeof patch.height_cm === 'string' ? { height_cm: patch.height_cm } : {}),
  })

  const { error: upErr } = await workSessionTable(supabase)
    .update({ payload: asPayloadRecord(payload) })
    .eq('id', sessionId)
  if (upErr) return { error: upErr.message }
  revalidatePath('/atelier')
  revalidatePath('/atelier/session/new')
  return { ok: true }
}

export async function deleteWorkSessionItem(
  sessionId: string,
  itemId: string,
): Promise<SessionActionResult> {
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
  const isAdmin = await rpcIsAdmin(supabase)
  if ((row as SessionMutableRow).user_id !== user.id && !isAdmin) return { error: 'Accès refusé' }
  if ((row as SessionMutableRow).status !== 'draft' && !isAdmin) return { error: 'Session non modifiable' }

  const payload = parseWorkSessionPayload((row as SessionMutableRow).payload)
  const idx = findItemIndex(payload, itemId)
  if (idx < 0) return { error: 'Entrée introuvable' }
  const [removed] = payload.items.splice(idx, 1)
  for (const shot of removed.shots) {
    try {
      await r2DeleteObject(shot.r2_key)
      if (shot.thumb_r2_key) await r2DeleteObject(shot.thumb_r2_key)
    } catch {
      /* best-effort staged object cleanup */
    }
  }

  const topLevelOeuvreId = listWorkSessionLinkedOeuvreIds(payload)[0] ?? null
  const { error: upErr } = await workSessionTable(supabase)
    .update({ payload: asPayloadRecord(payload), oeuvre_id: topLevelOeuvreId })
    .eq('id', sessionId)
  if (upErr) return { error: upErr.message }

  revalidatePath('/atelier')
  revalidatePath('/atelier/session/new')
  revalidatePath('/atelier/audit')
  return { ok: true }
}

export async function linkWorkSessionItemToOeuvre(
  sessionId: string,
  itemId: string,
  oeuvreId: number,
): Promise<SessionActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }
  if (!Number.isFinite(oeuvreId) || oeuvreId <= 0) return { error: 'Œuvre invalide' }

  const work = await selectWorkTitle(supabase, oeuvreId)
  if ('error' in work) return work

  const { data: row, error: selErr } = await workSessionTable(supabase)
    .select('id,user_id,status,payload')
    .eq('id', sessionId)
    .maybeSingle()
  if (selErr || !row) return { error: selErr?.message ?? 'Session introuvable' }
  if ((row as SessionMutableRow).user_id !== user.id) return { error: 'Accès refusé' }
  if ((row as SessionMutableRow).status !== 'draft') return { error: 'Session non modifiable' }

  const payload = parseWorkSessionPayload((row as SessionMutableRow).payload)
  const idx = findItemIndex(payload, itemId)
  if (idx < 0) return { error: 'Entrée introuvable' }
  payload.items[idx] = touchItem({
    ...payload.items[idx],
    mode: 'existing',
    oeuvre_id: oeuvreId,
    oeuvre_title: work.title,
  })

  const topLevelOeuvreId = payload.items.find((item) => item.oeuvre_id)?.oeuvre_id ?? oeuvreId
  const { error: upErr } = await workSessionTable(supabase)
    .update({ payload: asPayloadRecord(payload), oeuvre_id: topLevelOeuvreId })
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .eq('status', 'draft')
  if (upErr) return { error: upErr.message }
  return { ok: true }
}

export async function searchWorksForSession(query: string): Promise<WorkSessionWorkOption[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const q = query.trim()
  const rows: WorkSessionWorkOption[] = []
  for (let from = 0; ; from += SESSION_WORK_FETCH_PAGE_SIZE) {
    let req = supabase
      .from('Oeuvres')
      .select('OeuvreID,Titre,"Année",Hauteur,Largeur,statusId,"Catalogué",NeedsPhotograph,txtImageNameLink')
      .is('deleted_at', null)
      .order('OeuvreID', { ascending: false })
      .range(from, from + SESSION_WORK_FETCH_PAGE_SIZE - 1)

    if (q) {
      const n = Number.parseInt(q, 10)
      const safe = q.replace(/[%_,]/g, '')
      req = Number.isFinite(n) && String(n) === q
        ? req.eq('OeuvreID', n)
        : req.or(`Titre.ilike.%${safe}%,Largeur.ilike.%${safe}%,Hauteur.ilike.%${safe}%`)
    }

    const { data, error } = await req
    if (error) {
      console.error('[work_session] searchWorksForSession', error.message)
      return []
    }

    rows.push(...((data ?? []) as WorkSessionWorkOption[]))
    if (!data || data.length < SESSION_WORK_FETCH_PAGE_SIZE) break
  }

  return rows
    .filter(isSessionWorkCandidate)
    .sort((a, b) => {
      const aInProgress = isSessionWorkInProgress(a)
      const bInProgress = isSessionWorkInProgress(b)
      if (aInProgress !== bInProgress) return aInProgress ? -1 : 1
      return b.OeuvreID - a.OeuvreID
    })
}

async function workMapsForIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  oeuvreIds: number[],
): Promise<{
  titleMap: Map<number, string | null>
  thumbMap: Map<number, string | null>
}> {
  const titleMap = new Map<number, string | null>()
  const thumbMap = new Map<number, string | null>()
  if (oeuvreIds.length === 0) return { titleMap, thumbMap }
  const { data, error } = await supabase
    .from('Oeuvres')
    .select('OeuvreID,Titre,txtImageNameLink')
    .in('OeuvreID', oeuvreIds)
  if (error) {
    console.error('[work_session] workMapsForIds', error.message)
    return { titleMap, thumbMap }
  }
  for (const row of (data ?? []) as Array<{ OeuvreID: number; Titre: string | null; txtImageNameLink: string | null }>) {
    titleMap.set(row.OeuvreID, row.Titre)
    thumbMap.set(row.OeuvreID, row.txtImageNameLink)
  }
  return { titleMap, thumbMap }
}

export async function listWorkSessionJournal(limit = 100): Promise<WorkSessionJournalRow[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await workSessionTable(supabase)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) {
    console.error('[work_session] journal list', error.message)
    return []
  }

  const rows = (data ?? []) as WorkSessionRow[]
  const parsed = new Map(rows.map((row) => [row.id, parseWorkSessionPayload(row.payload)]))
  const oeuvreIds = Array.from(new Set(rows.flatMap((row) => {
    const payload = parsed.get(row.id) ?? emptyWorkSessionPayload()
    return [
      ...(typeof row.oeuvre_id === 'number' && row.oeuvre_id > 0 ? [row.oeuvre_id] : []),
      ...listWorkSessionLinkedOeuvreIds(payload),
    ]
  })))
  const { titleMap, thumbMap } = await workMapsForIds(supabase, oeuvreIds)

  return rows.map((row) => {
    const payload = parsed.get(row.id) ?? emptyWorkSessionPayload()
    const items = payload.items.map((item): WorkSessionJournalItem => {
      const oid = item.oeuvre_id ?? null
      return {
        id: item.id,
        mode: item.mode,
        status: item.status,
        oeuvre_id: oid,
        oeuvre_title: oid ? titleMap.get(oid) ?? item.oeuvre_title ?? null : item.oeuvre_title ?? null,
        work_thumb: oid ? thumbMap.get(oid) ?? null : null,
        title_hint: item.title_hint ?? null,
        notes: item.notes ?? null,
        width_cm: item.width_cm ?? null,
        height_cm: item.height_cm ?? null,
        staged_shots: item.shots.map((shot) => ({ r2_key: shot.r2_key, thumb_r2_key: shot.thumb_r2_key })),
        applied_shot_count: item.applied_shot_count ?? 0,
        created_at: item.created_at ?? null,
        updated_at: item.updated_at ?? null,
        applied_at: item.applied_at ?? null,
      }
    })
    return {
      ...row,
      session_at: sessionAtForPayload(payload, row.created_at),
      journal_notes: payload.notes ?? null,
      field_context: payload.field_context ?? null,
      item_count: countWorkSessionItems(payload),
      staged_shot_count: payload.shots.length + payload.items.reduce((sum, item) => sum + item.shots.length, 0),
      applied_shot_count: payload.items.reduce((sum, item) => sum + (item.applied_shot_count ?? 0), 0),
      items,
    }
  }).sort((a, b) => Date.parse(b.session_at) - Date.parse(a.session_at))
}

function diffVersionSnapshots(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): Array<{ field: string; before: unknown; after: unknown }> {
  if (!before && !after) return []
  return VERSION_COMPARE_FIELDS.flatMap((field) => {
    const a = before?.[field] ?? null
    const b = after?.[field] ?? null
    return String(a ?? '') === String(b ?? '') ? [] : [{ field, before: a, after: b }]
  })
}

export async function fetchSessionItemVersionCompare(
  oeuvreId: number,
  sessionDateIso: string,
): Promise<WorkSessionVersionCompare | { error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }
  if (!(await rpcIsAdmin(supabase))) return { error: 'Action réservée à l’administrateur' }
  if (!Number.isFinite(oeuvreId) || oeuvreId <= 0) return { error: 'Œuvre invalide' }

  const date = Number.isNaN(Date.parse(sessionDateIso)) ? new Date().toISOString() : sessionDateIso
  const { data: beforeRows, error: beforeErr } = await supabase
    .from('oeuvre_versions')
    .select('snapshot,changed_at,source')
    .eq('oeuvre_id', oeuvreId)
    .lte('changed_at', date)
    .order('changed_at', { ascending: false })
    .limit(1)
  if (beforeErr) return { error: beforeErr.message }

  const { data: afterRows, error: afterErr } = await supabase
    .from('oeuvre_versions')
    .select('snapshot,changed_at,source')
    .eq('oeuvre_id', oeuvreId)
    .gte('changed_at', date)
    .order('changed_at', { ascending: true })
    .limit(1)
  if (afterErr) return { error: afterErr.message }

  let afterSnapshot = (afterRows?.[0]?.snapshot ?? null) as Record<string, unknown> | null
  let afterChangedAt = (afterRows?.[0]?.changed_at ?? null) as string | null
  let afterSource = (afterRows?.[0]?.source ?? null) as string | null
  if (!afterSnapshot) {
    const { data: current, error: currentErr } = await supabase
      .from('Oeuvres')
      .select('*')
      .eq('OeuvreID', oeuvreId)
      .maybeSingle()
    if (currentErr) return { error: currentErr.message }
    afterSnapshot = (current ?? null) as Record<string, unknown> | null
    afterChangedAt = null
    afterSource = 'current'
  }

  const beforeSnapshot = (beforeRows?.[0]?.snapshot ?? null) as Record<string, unknown> | null
  return {
    before: {
      changed_at: (beforeRows?.[0]?.changed_at ?? null) as string | null,
      source: (beforeRows?.[0]?.source ?? null) as string | null,
      snapshot: beforeSnapshot,
    },
    after: {
      changed_at: afterChangedAt,
      source: afterSource,
      snapshot: afterSnapshot,
    },
    changes: diffVersionSnapshots(beforeSnapshot, afterSnapshot),
  }
}

async function putAvifPair(
  rawBuf: Buffer,
  mainKey: string,
  thumbKey: string,
  sessionId: string,
  uploadedBy: string,
  itemId?: string,
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
      linkedRefs: [{
        table: 'work_session',
        column: itemId ? 'payload.items.shots.r2_key' : 'payload.shots.r2_key',
        row_id: sessionId,
      }],
      uploadedBy,
      metadata: { role: 'main', ...(itemId ? { item_id: itemId } : {}) },
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
      linkedRefs: [{
        table: 'work_session',
        column: itemId ? 'payload.items.shots.thumb_r2_key' : 'payload.shots.thumb_r2_key',
        row_id: sessionId,
      }],
      uploadedBy,
      metadata: { role: 'thumb', original_key: mainKey, ...(itemId ? { item_id: itemId } : {}) },
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

export async function uploadWorkSessionItemShot(
  sessionId: string,
  itemId: string,
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
  if ((row as SessionMutableRow).user_id !== user.id) return { error: 'Accès refusé' }
  if ((row as SessionMutableRow).status !== 'draft') return { error: 'Session non modifiable' }

  const payload = parseWorkSessionPayload((row as SessionMutableRow).payload)
  const idx = findItemIndex(payload, itemId)
  if (idx < 0) return { error: 'Entrée introuvable' }

  const rawBuf = Buffer.from(await file.arrayBuffer())
  const sha256 = crypto.createHash('sha256').update(rawBuf).digest('hex')
  const validated = await validateWorkImageBuffer(rawBuf)
  if ('error' in validated) return { error: validated.error }

  const hash8 = sha256.slice(0, 8)
  const mainKey = `work-session/${sessionId}/${itemId}/${hash8}_main.avif`
  const thumbKey = `thumbs/work-session/${sessionId}/${itemId}/${hash8}_thumb.avif`

  const put = await putAvifPair(rawBuf, mainKey, thumbKey, sessionId, user.id, itemId)
  if ('error' in put) return { error: put.error }

  const shot: WorkSessionShot = {
    r2_key: mainKey,
    thumb_r2_key: thumbKey,
    sha256,
    size_bytes: rawBuf.length,
  }
  payload.items[idx] = touchItem({
    ...payload.items[idx],
    shots: [...payload.items[idx].shots, shot],
  })

  const { error: upErr } = await workSessionTable(supabase)
    .update({ payload: asPayloadRecord(payload) })
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .eq('status', 'draft')
  if (upErr) return { error: upErr.message }

  revalidatePath('/atelier/session/new')
  return { ok: true }
}

export async function removeWorkSessionItemShot(
  sessionId: string,
  itemId: string,
  shotSha256: string,
): Promise<SessionActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const sha = shotSha256.trim()
  if (!/^[a-f0-9]{64}$/i.test(sha)) return { error: 'Photo introuvable' }

  const { data: row, error: selErr } = await workSessionTable(supabase)
    .select('id,user_id,status,payload')
    .eq('id', sessionId)
    .maybeSingle()
  if (selErr || !row) return { error: selErr?.message ?? 'Session introuvable' }
  if ((row as SessionMutableRow).user_id !== user.id) return { error: 'Accès refusé' }
  if ((row as SessionMutableRow).status !== 'draft') return { error: 'Session non modifiable' }

  const payload = parseWorkSessionPayload((row as SessionMutableRow).payload)
  const idx = findItemIndex(payload, itemId)
  if (idx < 0) return { error: 'Entrée introuvable' }

  const item = payload.items[idx]
  const shotIdx = item.shots.findIndex((s) => s.sha256 === sha)
  if (shotIdx < 0) return { error: 'Photo introuvable' }

  const [removed] = item.shots.splice(shotIdx, 1)
  try {
    await r2DeleteObject(removed.r2_key)
    if (removed.thumb_r2_key) await r2DeleteObject(removed.thumb_r2_key)
  } catch {
    /* best-effort staged object cleanup */
  }

  payload.items[idx] = touchItem({ ...item, shots: item.shots })

  const { error: upErr } = await workSessionTable(supabase)
    .update({ payload: asPayloadRecord(payload) })
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
    session_at?: string
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
    ...(fields.session_at ? { session_at: fields.session_at } : {}),
    title_hint: titre,
    width_cm: fields.width_cm ?? '',
    height_cm: fields.height_cm ?? '',
    ...(fields.field_context != null ? { field_context: fields.field_context } : {}),
  }
  const metaRes = await updateWorkSessionMetadata(sessionId, metaPatch)
  if ('error' in metaRes) return metaRes

  const created = await createWorkFromSessionFields(supabase, fields)
  if ('error' in created) return created
  const oid = created.oeuvreId

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

export async function createAndLinkWorkFromSessionItem(
  sessionId: string,
  itemId: string,
): Promise<{ ok: true; oeuvreId: number } | { error: string }> {
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
  if ((row as SessionMutableRow).user_id !== user.id) return { error: 'Accès refusé' }
  if ((row as SessionMutableRow).status !== 'draft') return { error: 'Session non modifiable' }

  const payload = parseWorkSessionPayload((row as SessionMutableRow).payload)
  const sessionAt = sessionAtForPayload(payload)
  const idx = findItemIndex(payload, itemId)
  if (idx < 0) return { error: 'Entrée introuvable' }
  const item = payload.items[idx]
  const created = await createWorkFromSessionFields(supabase, {
    title_hint: item.title_hint ?? '',
    notes: item.notes ?? payload.notes,
    width_cm: item.width_cm,
    height_cm: item.height_cm,
    session_at: sessionAt,
  })
  if ('error' in created) return created

  payload.items[idx] = touchItem({
    ...item,
    mode: 'existing',
    oeuvre_id: created.oeuvreId,
    oeuvre_title: item.title_hint ?? null,
  })
  const topLevelOeuvreId = payload.items.find((i) => i.oeuvre_id)?.oeuvre_id ?? created.oeuvreId
  const { error: upErr } = await workSessionTable(supabase)
    .update({ payload: asPayloadRecord(payload), oeuvre_id: topLevelOeuvreId })
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .eq('status', 'draft')
  if (upErr) return { error: upErr.message }

  revalidatePath('/atelier')
  revalidatePath('/atelier/session/new')
  return { ok: true, oeuvreId: created.oeuvreId }
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

  const work = await selectWorkTitle(supabase, oeuvreId)
  if ('error' in work) return work

  const { data: row, error: selErr } = await workSessionTable(supabase)
    .select('id,user_id,status,payload')
    .eq('id', sessionId)
    .maybeSingle()
  if (selErr || !row) return { error: selErr?.message ?? 'Session introuvable' }
  const payload = parseWorkSessionPayload((row as SessionMutableRow).payload)
  if (payload.items.length > 0) {
    payload.items[0] = touchItem({
      ...payload.items[0],
      mode: 'existing',
      oeuvre_id: oeuvreId,
      oeuvre_title: work.title,
    })
  }

  const { error } = await workSessionTable(supabase)
    .update({ oeuvre_id: oeuvreId, payload: asPayloadRecord(payload) })
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
  const payload = parseWorkSessionPayload(row.payload)
  if (actionableItemCount(payload) === 0) return { error: 'Ajoutez au moins une photo et une œuvre à appliquer' }

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
    .select('id,status,payload,oeuvre_id,created_at')
    .eq('id', sessionId)
    .maybeSingle()
  if (selErr || !row) return { error: selErr?.message ?? 'Session introuvable' }
  if (row.status !== 'draft' && row.status !== 'pending_review') {
    return { error: 'Session déjà traitée' }
  }
  const payload = parseWorkSessionPayload(row.payload)
  const sessionAt = sessionAtForPayload(payload, row.created_at as string | null)
  if (countWorkSessionShots(payload) === 0) return { error: 'Aucune photo à appliquer' }

  let appliedCount = 0
  const applyShotsToWork = async (
    oeuvreId: number,
    shots: WorkSessionShot[],
    captureMeta: Record<string, unknown>,
  ): Promise<SessionActionResult> => {
    for (const shot of shots) {
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
    return { ok: true }
  }

  if (payload.items.length > 0) {
    const appliedAt = new Date().toISOString()
    for (let idx = 0; idx < payload.items.length; idx += 1) {
      let item = payload.items[idx]
      if (!itemIsActionable(item)) continue
      let oeuvreId = item.oeuvre_id ?? null
      if (!oeuvreId && item.mode === 'new') {
        const created = await createWorkFromSessionFields(supabase, {
          title_hint: item.title_hint ?? '',
          notes: item.notes ?? payload.notes,
          width_cm: item.width_cm,
          height_cm: item.height_cm,
          session_at: sessionAt,
        })
        if ('error' in created) return created
        oeuvreId = created.oeuvreId
        item = touchItem({
          ...item,
          mode: 'existing',
          oeuvre_id: oeuvreId,
          oeuvre_title: item.title_hint ?? null,
        })
        payload.items[idx] = item
        const topLevelOeuvreId = listWorkSessionLinkedOeuvreIds(payload)[0] ?? row.oeuvre_id ?? null
        const { error: linkPersistErr } = await workSessionTable(supabase)
          .update({ oeuvre_id: topLevelOeuvreId, payload: asPayloadRecord(payload) })
          .eq('id', sessionId)
        if (linkPersistErr) return { error: linkPersistErr.message }
      }
      if (!oeuvreId) continue
      const captureMeta = {
        source: 'work_session',
        session_id: sessionId,
        session_at: sessionAt,
        item_id: item.id,
        notes: item.notes ?? payload.notes ?? null,
        title_hint: item.title_hint ?? null,
        width_cm: item.width_cm ?? null,
        height_cm: item.height_cm ?? null,
      }
      const applied = await applyShotsToWork(oeuvreId, item.shots, captureMeta)
      if ('error' in applied) return applied
      appliedCount += item.shots.length
      payload.items[idx] = touchItem({
        ...item,
        mode: 'existing',
        oeuvre_id: oeuvreId,
        oeuvre_title: item.oeuvre_title ?? item.title_hint ?? null,
        status: 'applied',
        shots: [],
        applied_at: appliedAt,
        applied_by: user.id,
        applied_shot_count: (item.applied_shot_count ?? 0) + item.shots.length,
      })
      const topLevelOeuvreId = listWorkSessionLinkedOeuvreIds(payload)[0] ?? row.oeuvre_id ?? null
      const { error: itemPersistErr } = await workSessionTable(supabase)
        .update({ oeuvre_id: topLevelOeuvreId, payload: asPayloadRecord(payload) })
        .eq('id', sessionId)
      if (itemPersistErr) return { error: itemPersistErr.message }
    }

    if (appliedCount === 0) return { error: 'Aucune entrée complète à appliquer' }
    payload.applied_at = appliedAt
    payload.applied_by = user.id
    const remainingShots = countWorkSessionShots(payload)
    const nextStatus = remainingShots > 0 ? row.status : 'applied'
    const topLevelOeuvreId = listWorkSessionLinkedOeuvreIds(payload)[0] ?? row.oeuvre_id ?? null
    const { error: finErr } = await workSessionTable(supabase)
      .update({
        status: nextStatus,
        oeuvre_id: topLevelOeuvreId,
        payload: asPayloadRecord(payload),
      })
      .eq('id', sessionId)
    if (finErr) return { error: finErr.message }

    revalidatePath('/atelier')
    revalidatePath('/atelier/session/new')
    revalidatePath('/atelier/audit')
    return { ok: true }
  }

  if (!row.oeuvre_id) return { error: 'Œuvre manquante' }
  const oeuvreId = row.oeuvre_id as number
  const captureMeta = {
    source: 'work_session',
    session_id: sessionId,
    session_at: sessionAt,
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
    session_at: sessionAt,
    title_hint: payload.title_hint ?? null,
    width_cm: payload.width_cm ?? null,
    height_cm: payload.height_cm ?? null,
    shots: [],
    items: [],
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
  const svc = createServiceClient()

  const { data: row, error: selErr } = await workSessionTable(svc)
    .select('id,payload')
    .eq('id', sessionId)
    .maybeSingle()
  if (selErr || !row) return { error: selErr?.message ?? 'Session introuvable' }
  const payload = parseWorkSessionPayload(row.payload)
  const allShots = [
    ...payload.shots,
    ...payload.items.flatMap((item) => item.shots),
  ]
  for (const shot of allShots) {
    try {
      await r2DeleteObject(shot.r2_key)
      if (shot.thumb_r2_key) await r2DeleteObject(shot.thumb_r2_key)
    } catch {
      /* ignore */
    }
  }
  const { data: deleted, error } = await workSessionTable(svc)
    .delete()
    .eq('id', sessionId)
    .select('id')
    .maybeSingle()
  if (error) return { error: error.message }
  if (!deleted) return { error: 'Session non supprimée' }
  revalidatePath('/atelier')
  revalidatePath('/atelier/session/new')
  revalidatePath('/atelier/audit')
  return { ok: true }
}

export type WorkSessionQueueRow = WorkSessionRow & {
  oeuvre_title: string | null
  shot_count: number
  item_count: number
  open_item_count: number
  journal_notes: string | null
  item_summaries: Array<{
    id: string
    mode: WorkSessionItemMode
    oeuvre_id: number | null
    oeuvre_title: string | null
    title_hint: string | null
    shot_count: number
    applied_shot_count: number
    status: WorkSessionItem['status']
  }>
  author_email: string | null
}

async function enrichWorkSessionQueueRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: WorkSessionRow[],
): Promise<WorkSessionQueueRow[]> {
  if (rows.length === 0) return []
  const parsed = new Map(rows.map((row) => [row.id, parseWorkSessionPayload(row.payload)]))
  const oeuvreIds = Array.from(new Set(rows.flatMap((r) => {
    const fromRow = typeof r.oeuvre_id === 'number' && r.oeuvre_id > 0 ? [r.oeuvre_id] : []
    const payload = parsed.get(r.id) ?? emptyWorkSessionPayload()
    return [...fromRow, ...listWorkSessionLinkedOeuvreIds(payload)]
  })))
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
    ...(() => {
      const payload = parsed.get(row.id) ?? emptyWorkSessionPayload()
      const itemSummaries = payload.items.map((item) => ({
        id: item.id,
        mode: item.mode,
        oeuvre_id: item.oeuvre_id ?? null,
        oeuvre_title: item.oeuvre_id ? titleMap.get(item.oeuvre_id) ?? item.oeuvre_title ?? null : item.oeuvre_title ?? null,
        title_hint: item.title_hint ?? null,
        shot_count: item.shots.length,
        applied_shot_count: item.applied_shot_count ?? 0,
        status: item.status,
      }))
      const firstLinkedId = row.oeuvre_id ?? itemSummaries.find((item) => item.oeuvre_id)?.oeuvre_id ?? null
      return {
        oeuvre_title: firstLinkedId ? titleMap.get(firstLinkedId) ?? null : itemSummaries[0]?.title_hint ?? null,
        shot_count: countWorkSessionShots(payload),
        item_count: countWorkSessionItems(payload),
        open_item_count: payload.items.filter((item) => item.status !== 'applied').length || (payload.shots.length > 0 ? 1 : 0),
        journal_notes: payload.notes ?? null,
        item_summaries: itemSummaries,
        author_email: emailMap.get(row.user_id) ?? null,
      }
    })(),
  }))
}

/** Admin review queue: editor submissions + drafts with photos ready to apply. */
export async function listWorkSessionsForAdminReview(): Promise<WorkSessionQueueRow[]> {
  const supabase = await createClient()
  if (!(await rpcIsAdmin(supabase))) return []
  const { data, error } = await workSessionTable(supabase)
    .select('*')
    .in('status', ['pending_review', 'draft'])
    .order('updated_at', { ascending: false })
    .limit(100)
  if (error) {
    console.error('[work_session] listForAdminReview', error.message)
    return []
  }
  const withShots = ((data ?? []) as WorkSessionRow[]).filter(
    (row) => countWorkSessionShots(parseWorkSessionPayload(row.payload)) > 0,
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

  const { data: directRows, error: directError } = await workSessionTable(supabase)
    .select('*')
    .eq('oeuvre_id', oeuvreId)
    .order('updated_at', { ascending: false })
    .limit(100)
  if (directError) {
    console.error('[work_session] listForOeuvre direct', directError.message)
    return []
  }

  const { data: recentRows, error: recentError } = await workSessionTable(supabase)
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(1000)
  if (recentError) {
    console.error('[work_session] listForOeuvre recent', recentError.message)
    return (directRows ?? []) as WorkSessionRow[]
  }

  const byId = new Map<string, WorkSessionRow>()
  for (const row of (directRows ?? []) as WorkSessionRow[]) byId.set(row.id, row)
  for (const row of ((recentRows ?? []) as WorkSessionRow[])
    .filter((row) => {
      return parseWorkSessionPayload(row.payload).items.some((item) => item.oeuvre_id === oeuvreId)
    })) byId.set(row.id, row)
  return Array.from(byId.values())
    .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at))
    .slice(0, 50)
}
