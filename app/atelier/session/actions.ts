'use server'

import crypto from 'crypto'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { logError, logWarn } from '@/lib/error-reporter/server'
import { normalizeImageToAvifPair, validateWorkImageBuffer } from '@/lib/image-upload'
import { r2PutObject, r2DeleteObject, r2GetObjectBuffer, isR2ObjectNotFound } from '@/lib/r2-s3-object'
import { addWorkImage, deleteWorkImage } from '@/app/atelier/works/actions'
import {
  countWorkSessionItems,
  sessionItemHasContent,
  countWorkSessionShots,
  createWorkSessionItem,
  emptyWorkSessionPayload,
  listWorkSessionLinkedOeuvreIds,
  parseWorkSessionPayload,
  type WorkSessionAppliedShot,
  type WorkSessionFieldContext,
  type WorkSessionItem,
  type WorkSessionItemMode,
  type WorkSessionPayload,
  type WorkSessionShot,
} from '@/lib/work-session-payload'
import type { WorkSessionRow } from '@/lib/types/database'
import { provenanceTimestamp, provenanceUserId } from '@/lib/oeuvre-provenance'
import { allocateOeuvreId, insertOeuvreRow } from '@/lib/work-create-core'

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

function isDevAutoProfileEmail(userEmail: string | null | undefined): boolean {
  const devEmail = process.env.DEV_AUTO_LOGIN_EMAIL?.trim().toLowerCase() ?? ''
  return (
    process.env.NODE_ENV === 'development'
    && Boolean(devEmail)
    && userEmail?.toLowerCase() === devEmail
  )
}

async function rpcIsTeam(supabase: Awaited<ReturnType<typeof createClient>>): Promise<boolean> {
  const { data } = await supabase.rpc('is_team')
  return !!data
}

/** Any authenticated team member may list/read all field sessions (RLS: work_session_team_select). */
async function canReadTeamWorkSessions(supabase: Awaited<ReturnType<typeof createClient>>): Promise<boolean> {
  return rpcIsTeam(supabase)
}

/** Field capture (create/upload/apply) — administrators only. */
async function canCaptureWorkSession(supabase: Awaited<ReturnType<typeof createClient>>): Promise<boolean> {
  return rpcIsAdmin(supabase)
}

/** Team + admin capture see every session for a calendar day (one canonical row per day). */
async function teamWideSessionListing(supabase: Awaited<ReturnType<typeof createClient>>): Promise<boolean> {
  return (await canReadTeamWorkSessions(supabase)) || (await canCaptureWorkSession(supabase))
}

function sessionRowIsEmpty(payload: WorkSessionPayload): boolean {
  return countWorkSessionItems(payload) === 0 && payload.shots.length === 0
}

function mergeJournalNotes(into: string, extra: string): string {
  const a = into.trim()
  const b = extra.trim()
  if (!b) return a
  if (!a) return b
  if (a.includes(b)) return a
  return `${a}\n\n${b}`
}

function appendWorkSessionItemToPayload(keeper: WorkSessionPayload, item: WorkSessionItem): void {
  if (!sessionItemHasContent(item)) return
  const idx = findItemIndex(keeper, item.id)
  if (idx >= 0) {
    const existing = keeper.items[idx]!
    const shotKeys = new Set(existing.shots.map((s) => s.sha256))
    const newShots = item.shots.filter((s) => !shotKeys.has(s.sha256))
    keeper.items[idx] = touchItem({
      ...existing,
      notes: existing.notes?.trim() ? existing.notes : item.notes,
      title_hint: existing.title_hint?.trim() ? existing.title_hint : item.title_hint,
      width_cm: existing.width_cm?.trim() ? existing.width_cm : item.width_cm,
      height_cm: existing.height_cm?.trim() ? existing.height_cm : item.height_cm,
      oeuvre_id: existing.oeuvre_id ?? item.oeuvre_id,
      oeuvre_title: existing.oeuvre_title?.trim() ? existing.oeuvre_title : item.oeuvre_title,
      shots: [...existing.shots, ...newShots],
      applied_shot_count: Math.max(existing.applied_shot_count ?? 0, item.applied_shot_count ?? 0),
    })
    return
  }
  keeper.items.push(touchItem({ ...item }))
}

function absorbPayloadIntoKeeper(keeper: WorkSessionPayload, donor: WorkSessionPayload): void {
  keeper.notes = mergeJournalNotes(keeper.notes ?? '', donor.notes ?? '')
  if (!keeper.field_context && donor.field_context) keeper.field_context = donor.field_context
  if (donor.title_hint?.trim() && !keeper.title_hint?.trim()) keeper.title_hint = donor.title_hint
  if (donor.width_cm?.trim() && !keeper.width_cm?.trim()) keeper.width_cm = donor.width_cm
  if (donor.height_cm?.trim() && !keeper.height_cm?.trim()) keeper.height_cm = donor.height_cm
  for (const item of donor.items) appendWorkSessionItemToPayload(keeper, item)
  if (donor.shots.length > 0) {
    if (keeper.items.length === 0) {
      const item = createWorkSessionItem('existing')
      item.shots = [...donor.shots]
      keeper.items.push(touchItem(item))
    } else {
      const existing = keeper.items[0]!
      const shotKeys = new Set(existing.shots.map((s) => s.sha256))
      const newShots = donor.shots.filter((s) => !shotKeys.has(s.sha256))
      keeper.items[0] = touchItem({ ...existing, shots: [...existing.shots, ...newShots] })
    }
  }
}

/**
 * Merge every work_session for a calendar day into one row (all paintings kept), delete duplicates.
 * Admin capture only.
 */
async function consolidateSessionsForCalendarDay(
  supabase: Awaited<ReturnType<typeof createClient>>,
  calendarDay: string,
  userId: string,
): Promise<{ ok: true; keeperId: string | null } | { error: string }> {
  if (!(await canCaptureWorkSession(supabase))) return { ok: true, keeperId: null }

  const teamWide = await teamWideSessionListing(supabase)
  const listed = await listWorkSessionsForCalendarDay(supabase, calendarDay, { userId, teamWide })
  if ('error' in listed) return { error: listed.error }
  if (listed.length === 0) return { ok: true, keeperId: null }

  if (listed.length === 1) {
    const row = listed[0]!
    const payload = parseWorkSessionPayload(row.payload)
    if (payload.session_day !== calendarDay || !payload.session_at) {
      payload.session_day = calendarDay
      if (!payload.session_at) payload.session_at = sessionAtForCalendarDay(calendarDay)
      await workSessionTable(supabase)
        .update({ payload: asPayloadRecord(payload) })
        .eq('id', row.id)
    }
    return { ok: true, keeperId: row.id }
  }

  const keeper = pickSessionForDay(listed)!
  let keeperPayload = parseWorkSessionPayload(keeper.payload)
  keeperPayload.session_day = calendarDay
  keeperPayload.session_at = sessionAtForCalendarDay(calendarDay)

  const donorIds: string[] = []
  for (const row of listed) {
    if (row.id === keeper.id) continue
    donorIds.push(row.id)
    absorbPayloadIntoKeeper(keeperPayload, parseWorkSessionPayload(row.payload))
  }

  const topOid =
    listWorkSessionLinkedOeuvreIds(keeperPayload)[0]
    ?? (typeof keeper.oeuvre_id === 'number' && keeper.oeuvre_id > 0 ? keeper.oeuvre_id : null)

  if (keeperPayload.shots.length > 0) {
    keeperPayload = await migrateLegacySessionShotsToItems(supabase, keeper.id, keeperPayload, topOid)
  }

  const { error: upErr } = await workSessionTable(supabase)
    .update({
      payload: asPayloadRecord(keeperPayload),
      oeuvre_id: topOid,
      status: keeper.status === 'draft' ? 'draft' : keeper.status,
    })
    .eq('id', keeper.id)
  if (upErr) return { error: upErr.message }

  if (donorIds.length > 0) {
    const del = await deleteWorkSessionRows(supabase, donorIds)
    if ('error' in del) return del
  }

  revalidatePath('/atelier')
  revalidatePath('/atelier/session/new')
  revalidatePath('/atelier/audit')
  return { ok: true, keeperId: keeper.id }
}

const CAPTURE_ADMIN_ONLY = 'Capture réservée aux administrateurs'

async function assertCaptureAdmin(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<{ error: string } | null> {
  if (!(await canCaptureWorkSession(supabase))) return { error: CAPTURE_ADMIN_ONLY }
  return null
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

/** YYYY-MM-DD in Europe/Paris for one-session-per-day matching. */
function sessionCalendarDayKey(iso: string | null | undefined): string | null {
  const normalized = normalizeSessionAt(iso ?? '')
  if (!normalized) return null
  return new Intl.DateTimeFormat('fr-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(normalized))
}

function sessionDayForPayload(payload: WorkSessionPayload, rowCreatedAt?: string | null): string | null {
  if (payload.session_day && /^\d{4}-\d{2}-\d{2}$/.test(payload.session_day)) return payload.session_day
  return sessionCalendarDayKey(sessionAtForPayload(payload, rowCreatedAt))
}

function sessionAtForCalendarDay(calendarDay: string): string {
  const noon = Date.parse(`${calendarDay}T12:00:00`)
  return Number.isNaN(noon) ? new Date().toISOString() : new Date(noon).toISOString()
}

function sessionStatusRank(status: string): number {
  if (status === 'draft') return 4
  if (status === 'applied') return 3
  if (status === 'abandoned' || status === 'rejected') return 2
  if (status === 'pending_review') return 1
  return 0
}

function sessionPayloadContentScore(payload: WorkSessionPayload): number {
  const shots = countWorkSessionShots(payload)
  const items = countWorkSessionItems(payload)
  return shots * 100 + items * 10 + payload.items.filter(sessionItemHasContent).length
}

function pickSessionForDay(rows: WorkSessionDayRow[]): WorkSessionDayRow | null {
  if (rows.length === 0) return null
  return rows.reduce((best, row) => {
    const bestPayload = parseWorkSessionPayload(best.payload)
    const rowPayload = parseWorkSessionPayload(row.payload)
    const bestScore = sessionPayloadContentScore(bestPayload)
    const rowScore = sessionPayloadContentScore(rowPayload)
    if (rowScore > bestScore) return row
    if (rowScore < bestScore) return best
    const bestRank = sessionStatusRank(best.status)
    const rowRank = sessionStatusRank(row.status)
    if (rowRank > bestRank) return row
    if (rowRank < bestRank) return best
    const bestTs = Date.parse(best.updated_at ?? '') || 0
    const rowTs = Date.parse(row.updated_at ?? '') || 0
    return rowTs > bestTs ? row : best
  })
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
  /** work_session row that owns this item (required when journal merges multiple sessions per day). */
  source_session_id: string
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
  /** YYYY-MM-DD Europe/Paris — canonical day for links and grouping. */
  calendar_day: string
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

// Gated on staged shots, not on status: an already-applied painting the owner comes
// back to and adds a replacement photo for must be committable too. Applying consumes
// the staged shots, so a settled item has none left and is skipped anyway.
function itemIsActionable(item: WorkSessionItem): boolean {
  return item.shots.length > 0 && itemHasApplyTarget(item)
}

function isSessionWorkCandidate(work: Pick<WorkSessionWorkOption, 'statusId'>): boolean {
  return work.statusId == null || !SESSION_WORK_EXCLUDED_STATUS_IDS.has(work.statusId)
}

function isSessionWorkInProgress(work: Pick<WorkSessionWorkOption, 'statusId' | 'Catalogué' | 'NeedsPhotograph'>): boolean {
  return isSessionWorkCandidate(work) && (work.statusId === 1 || work.statusId == null || !work.Catalogué || !!work.NeedsPhotograph)
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
  actorUserId: string,
  fields: {
    title_hint: string
    notes?: string
    width_cm?: string
    height_cm?: string
    technique_id?: string
    support_id?: string
    session_at?: string
  },
): Promise<{ ok: true; oeuvreId: number } | { error: string }> {
  const titre = fields.title_hint.trim()
  if (!titre) return { error: 'Titre requis pour créer une œuvre' }

  // Captured in the field so the owner does not have to reopen the work in the
  // catalogue afterwards just to set them. Blank / non-numeric stays null.
  const fkOrNull = (raw: string | undefined): number | null => {
    const n = Number.parseInt((raw ?? '').trim(), 10)
    return Number.isFinite(n) && n > 0 ? n : null
  }

  const oidRes = await allocateOeuvreId(supabase)
  if (typeof oidRes !== 'number') return oidRes
  const oid = oidRes

  const sessionAt = normalizeSessionAt(fields.session_at) ?? new Date().toISOString()
  const dateStr = formatSessionHistoryDate(sessionAt)
  const originEntry = `[${dateStr}] Session terrain`
  const notesTrim = (fields.notes ?? '').trim()
  const historique = notesTrim ? `${originEntry}\n${notesTrim}` : originEntry

  const actorId = provenanceUserId(actorUserId, null)
  const editedAt = provenanceTimestamp()
  const inserted = await insertOeuvreRow(
    supabase,
    oid,
    {
      Titre: titre,
      Largeur: (fields.width_cm ?? '').trim() || null,
      Hauteur: (fields.height_cm ?? '').trim() || null,
      Technique: fkOrNull(fields.technique_id),
      Support: fkOrNull(fields.support_id),
      Commentaires: notesTrim || null,
      Historique: historique,
      statusId: 1,
      NeedsPhotograph: true,
      Exposable: false,
      Catalogué: false,
    },
    { actorId, editedAt },
  )
  if ('error' in inserted) return { error: inserted.error }
  return { ok: true, oeuvreId: oid }
}

export async function getSessionNewPageContext(): Promise<{
  authed: boolean
  isAdmin: boolean
  userEmail: string | null
  /** True when middleware DEV_AUTO_LOGIN signed in (separate from production Google user). */
  isDevAutoProfile: boolean
  /** True when journal can list all team sessions (is_team). */
  journalTeamReadAccess: boolean
  /** True when user may run field capture (admin only). */
  canCaptureSessions: boolean
  /** Technique / Support pickers for new works created in the field. */
  techniques: SessionLookupOption[]
  supports: SessionLookupOption[]
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return {
      authed: false,
      isAdmin: false,
      userEmail: null,
      isDevAutoProfile: false,
      journalTeamReadAccess: false,
      canCaptureSessions: false,
      techniques: [],
      supports: [],
    }
  }
  const userEmail = user.email ?? null
  const isDevAutoProfile = isDevAutoProfileEmail(userEmail)
  const isAdmin = await rpcIsAdmin(supabase)
  const [techniques, supports] = await Promise.all([
    listSessionTechniques(supabase),
    listSessionSupports(supabase),
  ])
  return {
    authed: true,
    isAdmin,
    userEmail,
    isDevAutoProfile,
    journalTeamReadAccess: await canReadTeamWorkSessions(supabase),
    canCaptureSessions: isAdmin,
    techniques,
    supports,
  }
}

/** Option for the Technique / Support selects — `id` is the FK as a string so the
 *  raw <select> value round-trips through the session payload unchanged. */
export type SessionLookupOption = { id: string; label: string }

function sortedLookupOptions(
  rows: { id: number | null; label: string | null }[],
): SessionLookupOption[] {
  return rows
    .filter((row) => row.id != null && (row.label ?? '').trim() !== '')
    .map((row) => ({ id: String(row.id), label: (row.label ?? '').trim() }))
    .sort((a, b) => a.label.localeCompare(b.label, 'fr'))
}

async function listSessionTechniques(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<SessionLookupOption[]> {
  const { data } = await supabase.from('Technique').select('TechniqueID, Technique')
  return sortedLookupOptions(
    (data ?? []).map((row) => ({ id: row.TechniqueID, label: row.Technique })),
  )
}

async function listSessionSupports(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<SessionLookupOption[]> {
  const { data } = await supabase.from('Support').select('SupportID, Support')
  return sortedLookupOptions((data ?? []).map((row) => ({ id: row.SupportID, label: row.Support })))
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
    .maybeSingle()
  if (error || !data) return 0
  return countWorkSessionShots(parseWorkSessionPayload(data.payload))
}

export type WorkSessionDraftFields = {
  session_at: string
  /** YYYY-MM-DD Europe/Paris — use for date input, not raw session_at alone. */
  calendar_day: string
  notes: string
  title_hint: string
  width_cm: string
  height_cm: string
  field_context: WorkSessionFieldContext | null
}

/** Older sessions stored photos on payload.shots with an empty items[]. */
async function migrateLegacySessionShotsToItems(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sessionId: string,
  payload: WorkSessionPayload,
  topLevelOeuvreId: number | null,
): Promise<WorkSessionPayload> {
  if (payload.shots.length === 0) return payload

  const next = { ...payload, items: [...payload.items], shots: [] as WorkSessionPayload['shots'] }
  const targetIdx = next.items.findIndex((item) => sessionItemHasContent(item))
  const idx = targetIdx >= 0 ? targetIdx : 0

  if (next.items.length === 0) {
    const item = createWorkSessionItem('existing')
    if (topLevelOeuvreId && topLevelOeuvreId > 0) item.oeuvre_id = topLevelOeuvreId
    item.shots = [...payload.shots]
    next.items = [touchItem(item)]
  } else {
    const existing = next.items[idx]!
    next.items[idx] = touchItem({
      ...existing,
      shots: [...existing.shots, ...payload.shots],
    })
  }

  const { error } = await workSessionTable(supabase)
    .update({ payload: asPayloadRecord(next) })
    .eq('id', sessionId)
  if (error) {
    await logError('migrateLegacySessionShotsToItems failed', error, {
      source: 'work_session.migrateLegacySessionShotsToItems',
      metadata: { sessionId },
    })
    return payload
  }
  return next
}

function enrichDraftItems(
  payload: WorkSessionPayload,
  titleMap: Map<number, string | null>,
  thumbMap: Map<number, string | null>,
  appliedMap?: Map<number, WorkSessionAppliedShot[]>,
): WorkSessionItem[] {
  return payload.items.map((item) => {
    const oid = item.oeuvre_id ?? null
    return {
      ...item,
      oeuvre_title: oid ? titleMap.get(oid) ?? item.oeuvre_title ?? null : item.oeuvre_title ?? null,
      work_thumb: oid ? thumbMap.get(oid) ?? null : null,
      applied_shots: oid ? appliedMap?.get(oid) ?? [] : [],
    }
  })
}

export async function getWorkSessionDraftFields(sessionId: string): Promise<
  | {
    ok: true
    status: string
    fields: WorkSessionDraftFields
    oeuvre_id: number | null
    items: WorkSessionItem[]
    readOnly: boolean
  }
  | { error: string }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }
  const { data, error } = await workSessionTable(supabase)
    .select('payload,oeuvre_id,created_at,status,user_id')
    .eq('id', sessionId)
    .maybeSingle()
  if (error || !data) return { error: error?.message ?? 'Session introuvable' }
  let p = parseWorkSessionPayload(data.payload)
  const oeuvreId = data.oeuvre_id
  const status = (data.status as string) ?? 'draft'
  const topOid = typeof oeuvreId === 'number' && oeuvreId > 0 ? oeuvreId : null
  const rowUserId = (data as { user_id?: string }).user_id
  const readOnly = !(await canCaptureWorkSession(supabase))

  if (p.shots.length > 0 && !readOnly) {
    p = await migrateLegacySessionShotsToItems(supabase, sessionId, p, topOid)
  }

  const linkedIds = [
    ...listWorkSessionLinkedOeuvreIds(p),
    ...(topOid ? [topOid] : []),
  ]
  const { titleMap, thumbMap, appliedMap } = await workMapsForIds(supabase, linkedIds)
  const items = enrichDraftItems(p, titleMap, thumbMap, appliedMap)
  const sessionAt = sessionAtForPayload(p, data.created_at as string | null)
  const calendarDay =
    p.session_day && /^\d{4}-\d{2}-\d{2}$/.test(p.session_day)
      ? p.session_day
      : sessionCalendarDayKey(sessionAt) ?? ''

  return {
    ok: true,
    status,
    oeuvre_id: topOid,
    items,
    fields: {
      session_at: sessionAt,
      calendar_day: calendarDay,
      notes: p.notes ?? '',
      title_hint: p.title_hint ?? '',
      width_cm: p.width_cm ?? '',
      height_cm: p.height_cm ?? '',
      field_context: p.field_context ?? null,
    },
    readOnly,
  }
}

async function ensureWorkSessionHasItem(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sessionId: string,
  oeuvreId: number | null,
): Promise<SessionActionResult> {
  const { data: row, error: selErr } = await workSessionTable(supabase)
    .select('id,payload')
    .eq('id', sessionId)
    .maybeSingle()
  if (selErr || !row) return { error: selErr?.message ?? 'Session introuvable' }
  const payload = parseWorkSessionPayload(row.payload)
  if (payload.items.length === 0) {
    if (oeuvreId && oeuvreId > 0) {
      const firstItem = createWorkSessionItem('existing')
      firstItem.oeuvre_id = oeuvreId
      payload.items = [firstItem]
    }
  } else if (oeuvreId && oeuvreId > 0 && !payload.items.some((item) => item.oeuvre_id === oeuvreId)) {
    const first = payload.items[0]
    if (!first.oeuvre_id) {
      payload.items[0] = touchItem({ ...first, oeuvre_id: oeuvreId })
    }
  }
  const topLevelOeuvreId = listWorkSessionLinkedOeuvreIds(payload)[0] ?? (oeuvreId && oeuvreId > 0 ? oeuvreId : null)
  const { error: upErr } = await workSessionTable(supabase)
    .update({ payload: asPayloadRecord(payload), oeuvre_id: topLevelOeuvreId })
    .eq('id', sessionId)
  if (upErr) return { error: upErr.message }
  return { ok: true }
}

const WORK_SESSION_OPEN_STATUSES = ['draft', 'applied', 'abandoned', 'rejected', 'pending_review'] as const

type WorkSessionDayRow = {
  id: string
  status: string
  payload: unknown
  oeuvre_id?: number | null
  user_id?: string
  created_at: string | null
  updated_at?: string | null
}

async function listWorkSessionsForCalendarDay(
  supabase: Awaited<ReturnType<typeof createClient>>,
  calendarDay: string,
  opts: { userId: string; teamWide: boolean },
): Promise<WorkSessionDayRow[] | { error: string }> {
  const baseSelect = () =>
    workSessionTable(supabase)
      .select('id,status,payload,oeuvre_id,created_at,updated_at,user_id')
      .in('status', [...WORK_SESSION_OPEN_STATUSES])

  let byDayKey = baseSelect()
    .filter('payload->>session_day', 'eq', calendarDay)
    .order('updated_at', { ascending: false })
    .limit(48)
  if (!opts.teamWide) byDayKey = byDayKey.eq('user_id', opts.userId)

  const { data: byStoredDay, error: keyErr } = await byDayKey
  if (keyErr) return { error: keyErr.message }

  let scan = baseSelect().order('updated_at', { ascending: false }).limit(400)
  if (!opts.teamWide) scan = scan.eq('user_id', opts.userId)

  const { data: rows, error: listErr } = await scan
  if (listErr) return { error: listErr.message }

  // Union keyed + scanned rows: an empty draft with session_day set must not hide
  // an older session on the same Paris day that only has session_at.
  const seen = new Set<string>()
  const merged: WorkSessionDayRow[] = []
  for (const row of [...(byStoredDay ?? []), ...(rows ?? [])]) {
    const id = row.id as string
    if (seen.has(id)) continue
    const payload = parseWorkSessionPayload(row.payload)
    const day = sessionDayForPayload(payload, row.created_at as string | null)
    if (day !== calendarDay) continue
    seen.add(id)
    merged.push(row as WorkSessionDayRow)
  }
  return merged
}

async function reopenWorkSessionRow(
  supabase: Awaited<ReturnType<typeof createClient>>,
  existing: WorkSessionDayRow,
  calendarDay: string,
  oeuvreId: number | null,
  opts?: { readOnly?: boolean },
): Promise<{ ok: true; id: string; reopened: boolean; readOnly: boolean } | { error: string }> {
  if (opts?.readOnly) {
    revalidatePath('/atelier/session/new')
    return { ok: true, id: existing.id, reopened: false, readOnly: true }
  }

  let reopened = false
  if (existing.status !== 'draft') {
    const { error: reopenErr } = await workSessionTable(supabase)
      .update({ status: 'draft', expires_at: expiresAtIso() })
      .eq('id', existing.id)
    if (reopenErr) return { error: reopenErr.message }
    reopened = true
  }
  let payload = parseWorkSessionPayload(existing.payload)
  const topOid =
    typeof existing.oeuvre_id === 'number' && existing.oeuvre_id > 0
      ? existing.oeuvre_id
      : (oeuvreId && oeuvreId > 0 ? oeuvreId : null)
  if (payload.shots.length > 0) {
    payload = await migrateLegacySessionShotsToItems(supabase, existing.id, payload, topOid)
  }
  if (!payload.session_day) {
    payload.session_day = calendarDay
    if (!payload.session_at) payload.session_at = sessionAtForCalendarDay(calendarDay)
    await workSessionTable(supabase)
      .update({ payload: asPayloadRecord(payload) })
      .eq('id', existing.id)
  }
  const itemRes = await ensureWorkSessionHasItem(supabase, existing.id, oeuvreId)
  if ('error' in itemRes) return itemRes
  revalidatePath('/atelier/session/new')
  return { ok: true, id: existing.id, reopened, readOnly: false }
}

/** One field session per calendar day (YYYY-MM-DD); reopens the same row to add more works/photos. */
export async function openWorkSessionForDay(
  oeuvreId: number | null,
  calendarDay: string,
  opts?: { preferredSessionId?: string | null },
): Promise<{ ok: true; id: string; reopened: boolean; readOnly: boolean } | { error: string }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(calendarDay)) return { error: 'Date de session invalide' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const canCapture = await canCaptureWorkSession(supabase)

  if (canCapture) {
    // Capture path: consolidate merges the day into one keeper row (donors deleted)
    // and returns its id, so we reopen that row directly instead of re-scanning the
    // whole day a second time. preferredSessionId is moot here — any preferred donor
    // has been merged into the keeper, which already holds its content.
    const merged = await consolidateSessionsForCalendarDay(supabase, calendarDay, user.id)
    if ('error' in merged) return { error: merged.error }
    if (merged.keeperId) {
      const { data: keeperRow, error: keeperErr } = await workSessionTable(supabase)
        .select('id,status,payload,oeuvre_id,created_at,updated_at,user_id')
        .eq('id', merged.keeperId)
        .maybeSingle()
      if (keeperErr) return { error: keeperErr.message }
      if (keeperRow) {
        return reopenWorkSessionRow(supabase, keeperRow as WorkSessionDayRow, calendarDay, oeuvreId, {
          readOnly: false,
        })
      }
    }

    // No session yet for this calendar day — create one.
    const payload = emptyWorkSessionPayload()
    payload.session_day = calendarDay
    payload.session_at = sessionAtForCalendarDay(calendarDay)
    if (oeuvreId && oeuvreId > 0) {
      const firstItem = createWorkSessionItem('existing')
      firstItem.oeuvre_id = oeuvreId
      payload.items = [firstItem]
    }

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
    return { ok: true, id: data.id as string, reopened: false, readOnly: false }
  }

  // Read-only path (team member, no capture rights): list the day and reopen read-only.
  const teamWide = await teamWideSessionListing(supabase)
  const listed = await listWorkSessionsForCalendarDay(supabase, calendarDay, {
    userId: user.id,
    teamWide,
  })
  if ('error' in listed) return { error: listed.error }

  const preferredId = opts?.preferredSessionId?.trim() ?? ''
  let existing = pickSessionForDay(listed)
  if (preferredId) {
    const preferred = listed.find((row) => row.id === preferredId)
    if (preferred) existing = preferred
  }

  if (existing) {
    return reopenWorkSessionRow(supabase, existing, calendarDay, oeuvreId, { readOnly: true })
  }

  return { error: CAPTURE_ADMIN_ONLY }
}

/** @deprecated Prefer openWorkSessionForDay with an explicit YYYY-MM-DD calendar day. */
export async function createWorkSessionDraft(oeuvreId: number | null): Promise<
  { ok: true; id: string } | { error: string }
> {
  const supabase = await createClient()
  const denied = await assertCaptureAdmin(supabase)
  if (denied) return denied
  const day =
    sessionCalendarDayKey(new Date().toISOString())
    ?? new Date().toISOString().slice(0, 10)
  const opened = await openWorkSessionForDay(oeuvreId, day)
  if ('error' in opened) return opened
  return { ok: true, id: opened.id }
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
  const denied = await assertCaptureAdmin(supabase)
  if (denied) return denied

  const { data: row, error: selErr } = await workSessionTable(supabase)
    .select('id,user_id,status,payload')
    .eq('id', sessionId)
    .maybeSingle()
  if (selErr || !row) return { error: selErr?.message ?? 'Session introuvable' }
  if (row.status !== 'draft') return { error: 'Session non modifiable' }

  const payload = parseWorkSessionPayload(row.payload)
  if (typeof patch.session_at === 'string') {
    const sessionAt = normalizeSessionAt(patch.session_at)
    if (!sessionAt) return { error: 'Date de session invalide' }
    payload.session_at = sessionAt
    const day = sessionCalendarDayKey(sessionAt)
    if (day) payload.session_day = day
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
  const denied = await assertCaptureAdmin(supabase)
  if (denied) return denied
  if (row.status !== 'draft') return { error: 'Session non modifiable' }

  const payload = parseWorkSessionPayload(row.payload)
  if (typeof patch.session_at === 'string') {
    const sessionAt = normalizeSessionAt(patch.session_at)
    if (!sessionAt) return { error: 'Date de session invalide' }
    payload.session_at = sessionAt
    const day = sessionCalendarDayKey(sessionAt)
    if (day) payload.session_day = day
  }
  if (typeof patch.notes === 'string') payload.notes = patch.notes

  const { error: upErr } = await workSessionTable(supabase)
    .update({ payload: asPayloadRecord(payload) })
    .eq('id', sessionId)
  if (upErr) return { error: upErr.message }
  revalidatePath('/atelier')
  return { ok: true }
}

/**
 * Remove a photo that is already committed to the work, from inside the session.
 *
 * This is NOT a session-local undo: once applied there is no session copy left, so
 * this deletes the `tblImage` row and soft-deletes the R2 objects to `recycle/<date>/`
 * (90-day window) exactly as the catalogue image manager does. Admin only, via
 * deleteWorkImage. The item's applied_shot_count is decremented so the session's
 * photo tally does not drift from the work's real image count.
 */
export async function removeAppliedSessionImage(
  sessionId: string,
  itemId: string,
  imageId: number,
): Promise<SessionActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }
  if (!(await rpcIsAdmin(supabase))) return { error: 'Action réservée à l’administrateur' }

  const { data: row, error: selErr } = await workSessionTable(supabase)
    .select('id,user_id,status,payload')
    .eq('id', sessionId)
    .maybeSingle()
  if (selErr || !row) return { error: selErr?.message ?? 'Session introuvable' }

  const payload = parseWorkSessionPayload((row as SessionMutableRow).payload)
  const idx = findItemIndex(payload, itemId)
  if (idx < 0) return { error: 'Entrée introuvable' }
  const item = payload.items[idx]
  const oeuvreId = item.oeuvre_id
  if (!oeuvreId || oeuvreId <= 0) return { error: 'Œuvre invalide' }

  const deleted = await deleteWorkImage(imageId, oeuvreId)
  if ('error' in deleted) return { error: deleted.error }

  payload.items[idx] = touchItem({
    ...item,
    applied_shot_count: Math.max(0, (item.applied_shot_count ?? 0) - 1),
  })
  const { error: upErr } = await workSessionTable(supabase)
    .update({ payload: asPayloadRecord(payload) })
    .eq('id', sessionId)
  if (upErr) return { error: upErr.message }

  revalidatePath('/atelier')
  revalidatePath('/atelier/session/new')
  return { ok: true }
}

/**
 * Existing works whose title matches, so the field UI can warn before a second copy of
 * the same painting is created. Advisory only — never blocks; same title is legitimate
 * for a series.
 */
export async function findWorksByTitleForSession(
  title: string,
): Promise<{ OeuvreID: number; Titre: string | null }[]> {
  const trimmed = title.trim()
  if (trimmed.length < 2) return []
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []
  const { data } = await supabase
    .from('Oeuvres')
    .select('OeuvreID,Titre')
    .ilike('Titre', trimmed)
    .limit(5)
  return (data ?? []) as { OeuvreID: number; Titre: string | null }[]
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
  const denied = await assertCaptureAdmin(supabase)
  if (denied) return denied

  const { data: row, error: selErr } = await workSessionTable(supabase)
    .select('id,user_id,status,payload')
    .eq('id', sessionId)
    .maybeSingle()
  if (selErr || !row) return { error: selErr?.message ?? 'Session introuvable' }
  if ((row as SessionMutableRow).status !== 'draft') return { error: 'Session non modifiable' }

  const payload = parseWorkSessionPayload((row as SessionMutableRow).payload)
  const item = createWorkSessionItem(mode)
  payload.items = [...payload.items, item]
  const { error: upErr } = await workSessionTable(supabase)
    .update({ payload: asPayloadRecord(payload) })
    .eq('id', sessionId)
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
    technique_id?: string
    support_id?: string
  },
): Promise<SessionActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }
  const denied = await assertCaptureAdmin(supabase)
  if (denied) return denied

  const { data: row, error: selErr } = await workSessionTable(supabase)
    .select('id,user_id,status,payload')
    .eq('id', sessionId)
    .maybeSingle()
  if (selErr || !row) return { error: selErr?.message ?? 'Session introuvable' }
  if ((row as SessionMutableRow).status !== 'draft') return { error: 'Session non modifiable' }

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
    ...(typeof patch.technique_id === 'string' ? { technique_id: patch.technique_id } : {}),
    ...(typeof patch.support_id === 'string' ? { support_id: patch.support_id } : {}),
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
  const denied = await assertCaptureAdmin(supabase)
  if (denied) return denied

  const { data: row, error: selErr } = await workSessionTable(supabase)
    .select('id,user_id,status,payload,oeuvre_id')
    .eq('id', sessionId)
    .maybeSingle()
  if (selErr || !row) return { error: selErr?.message ?? 'Session introuvable' }
  const isAdmin = await rpcIsAdmin(supabase)
  if ((row as SessionMutableRow).status !== 'draft' && !isAdmin) return { error: 'Session non modifiable' }

  const payload = parseWorkSessionPayload((row as SessionMutableRow).payload)
  const idx = findItemIndex(payload, itemId)
  if (idx < 0) return { error: 'Entrée introuvable' }
  const [removed] = payload.items.splice(idx, 1)
  for (const shot of removed.shots) {
    try {
      await r2DeleteObject(shot.r2_key)
      if (shot.thumb_r2_key) await r2DeleteObject(shot.thumb_r2_key)
    } catch (err) {
      await logWarn('Session shot R2 cleanup failed (best-effort)', err, {
        source: 'work_session.r2Cleanup',
        metadata: { r2_key: shot.r2_key },
      })
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
  const denied = await assertCaptureAdmin(supabase)
  if (denied) return denied
  if (!Number.isFinite(oeuvreId) || oeuvreId <= 0) return { error: 'Œuvre invalide' }

  const work = await selectWorkTitle(supabase, oeuvreId)
  if ('error' in work) return work

  const { data: row, error: selErr } = await workSessionTable(supabase)
    .select('id,user_id,status,payload')
    .eq('id', sessionId)
    .maybeSingle()
  if (selErr || !row) return { error: selErr?.message ?? 'Session introuvable' }
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
      await logError('searchWorksForSession failed', error, { source: 'work_session.searchWorksForSession' })
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
  appliedMap: Map<number, WorkSessionAppliedShot[]>
}> {
  const titleMap = new Map<number, string | null>()
  const thumbMap = new Map<number, string | null>()
  const appliedMap = await appliedShotsForIds(supabase, oeuvreIds)
  if (oeuvreIds.length === 0) return { titleMap, thumbMap, appliedMap }
  const { data, error } = await supabase
    .from('Oeuvres')
    .select('OeuvreID,Titre,txtImageNameLink')
    .in('OeuvreID', oeuvreIds)
  if (error) {
    await logError('workMapsForIds failed', error, {
      source: 'work_session.workMapsForIds',
      metadata: { count: oeuvreIds.length },
    })
    return { titleMap, thumbMap, appliedMap }
  }
  for (const row of (data ?? []) as Array<{ OeuvreID: number; Titre: string | null; txtImageNameLink: string | null }>) {
    titleMap.set(row.OeuvreID, row.Titre)
    thumbMap.set(row.OeuvreID, row.txtImageNameLink)
  }
  return { titleMap, thumbMap, appliedMap }
}

/** Photos already committed to these works, so the session can show and correct them. */
async function appliedShotsForIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  oeuvreIds: number[],
): Promise<Map<number, WorkSessionAppliedShot[]>> {
  const map = new Map<number, WorkSessionAppliedShot[]>()
  if (oeuvreIds.length === 0) return map
  const { data, error } = await supabase
    .from('tblImage')
    .select('ImageID,OeuvreID,txtImageNameLink,is_cover,SeqNo')
    .in('OeuvreID', oeuvreIds)
    .order('SeqNo', { ascending: true })
  if (error) {
    await logError('appliedShotsForIds failed', error, {
      source: 'work_session.appliedShotsForIds',
      metadata: { count: oeuvreIds.length },
    })
    return map
  }
  for (const row of (data ?? []) as Array<{
    ImageID: number
    OeuvreID: number | null
    txtImageNameLink: string | null
    is_cover: boolean | null
  }>) {
    if (row.OeuvreID == null || !row.txtImageNameLink) continue
    const list = map.get(row.OeuvreID) ?? []
    list.push({
      image_id: row.ImageID,
      r2_key: row.txtImageNameLink,
      is_cover: row.is_cover === true,
    })
    map.set(row.OeuvreID, list)
  }
  return map
}

export async function listWorkSessionJournal(
  limit = 100,
  opts?: { skipReconcile?: boolean },
): Promise<WorkSessionJournalRow[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const teamWide = await teamWideSessionListing(supabase)
  const fetchLimit = teamWide ? Math.max(limit, 200) : limit

  const { data, error } = await workSessionTable(supabase)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(fetchLimit)
  if (error) {
    await logError('work_session journal list failed', error, { source: 'work_session.listWorkSessionJournal' })
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

  const mapped = rows.map((row) => {
    const payload = parsed.get(row.id) ?? emptyWorkSessionPayload()
    const items = journalItemsFromPayload(payload, titleMap, thumbMap, row.id)
    const stagedFromItems = items.reduce((sum, item) => sum + item.staged_shots.length, 0)
    const appliedFromItems = items.reduce((sum, item) => sum + item.applied_shot_count, 0)
    const sessionAt = sessionAtForPayload(payload, row.created_at)
    const calendarDay =
      sessionDayForPayload(payload, row.created_at as string | null)
      ?? sessionCalendarDayKey(sessionAt)
      ?? ''
    return {
      ...row,
      session_at: sessionAt,
      calendar_day: calendarDay,
      journal_notes: payload.notes ?? null,
      field_context: payload.field_context ?? null,
      item_count: items.length,
      staged_shot_count: stagedFromItems,
      applied_shot_count: appliedFromItems,
      items,
    }
  })

  if (!opts?.skipReconcile && (await canCaptureWorkSession(supabase))) {
    const dupDays = new Set<string>()
    for (const row of mapped) {
      if (!row.calendar_day) continue
      const n = mapped.filter((r) => r.calendar_day === row.calendar_day).length
      if (n > 1) dupDays.add(row.calendar_day)
    }
    if (dupDays.size > 0) {
      for (const day of dupDays) {
        const merged = await consolidateSessionsForCalendarDay(supabase, day, user.id)
        if ('error' in merged) {
          await logError('journal reconcile failed', merged.error, {
            source: 'work_session.listWorkSessionJournal',
            metadata: { calendarDay: day },
          })
        }
      }
      return listWorkSessionJournal(limit, { skipReconcile: true })
    }
  }

  return mergeJournalRowsByDay(
    mapped.sort((a, b) => {
      const dayCmp = (b.calendar_day || '').localeCompare(a.calendar_day || '')
      if (dayCmp !== 0) return dayCmp
      return (Date.parse(b.updated_at ?? '') || 0) - (Date.parse(a.updated_at ?? '') || 0)
    }),
  )
}

/** One journal row per calendar day — items from every session that day (after DB consolidate: single source row). */
function mergeJournalRowsByDay(rows: WorkSessionJournalRow[]): WorkSessionJournalRow[] {
  const byDay = new Map<string, WorkSessionJournalRow[]>()
  for (const row of rows) {
    const day = row.calendar_day || sessionCalendarDayKey(row.session_at) || row.id
    byDay.set(day, [...(byDay.get(day) ?? []), row])
  }
  const merged: WorkSessionJournalRow[] = []
  for (const [day, dayRows] of byDay.entries()) {
    const sorted = [...dayRows].sort((a, b) => {
      const rank = sessionStatusRank(b.status) - sessionStatusRank(a.status)
      if (rank !== 0) return rank
      return (Date.parse(b.updated_at ?? '') || 0) - (Date.parse(a.updated_at ?? '') || 0)
    })
    const primary = sorted[0]
    const seen = new Set<string>()
    const items: WorkSessionJournalItem[] = []
    for (const row of sorted) {
      for (const item of row.items) {
        if (seen.has(item.id)) continue
        seen.add(item.id)
        items.push(item)
      }
    }
    const notesParts = sorted
      .map((r) => r.journal_notes?.trim())
      .filter((n): n is string => Boolean(n))
    merged.push({
      ...primary,
      calendar_day: day,
      journal_notes: notesParts.length > 0 ? [...new Set(notesParts)].join('\n\n') : null,
      item_count: items.length,
      staged_shot_count: items.reduce((sum, item) => sum + item.staged_shots.length, 0),
      applied_shot_count: items.reduce((sum, item) => sum + item.applied_shot_count, 0),
      items,
    })
  }
  return merged.sort((a, b) => Date.parse(b.session_at) - Date.parse(a.session_at))
}

function journalItemsFromPayload(
  payload: WorkSessionPayload,
  titleMap: Map<number, string | null>,
  thumbMap: Map<number, string | null>,
  sourceSessionId: string,
): WorkSessionJournalItem[] {
  const fromItems = payload.items.filter(sessionItemHasContent).map((item): WorkSessionJournalItem => {
    const oid = item.oeuvre_id ?? null
    return {
      id: item.id,
      source_session_id: sourceSessionId,
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
  if (fromItems.length > 0) return fromItems
  if (payload.shots.length === 0) return []
  return [
    {
      id: '__legacy_session_shots__',
      source_session_id: sourceSessionId,
      mode: 'existing',
      status: 'draft',
      oeuvre_id: null,
      oeuvre_title: payload.title_hint?.trim() || null,
      work_thumb: null,
      title_hint: payload.title_hint ?? null,
      notes: payload.notes ?? null,
      width_cm: payload.width_cm ?? null,
      height_cm: payload.height_cm ?? null,
      staged_shots: payload.shots.map((shot) => ({ r2_key: shot.r2_key, thumb_r2_key: shot.thumb_r2_key })),
      applied_shot_count: 0,
      created_at: null,
      updated_at: null,
      applied_at: null,
    },
  ]
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
  try {
    // Always normalise: a phone export is AVIF but not a lean one, and storage
    // across the archive matters more than the ~230 ms encode. See lib/image-upload.
    const { mainBuf: avifBuf, thumbBuf } = await normalizeImageToAvifPair(rawBuf, { maxEdge: 2100 })

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
    await logError('Session thumb upload failed', e, {
      source: 'work_session.uploadSessionThumb',
      metadata: { sessionId, mainKey },
    })
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
  const denied = await assertCaptureAdmin(supabase)
  if (denied) return denied

  const file = formData.get('image') as File | null
  if (!file || file.size === 0) return { error: 'Image manquante' }

  const { data: row, error: selErr } = await workSessionTable(supabase)
    .select('id,user_id,status,payload')
    .eq('id', sessionId)
    .maybeSingle()
  if (selErr || !row) return { error: selErr?.message ?? 'Session introuvable' }
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
    .update({ payload: asPayloadRecord(payload) })
    .eq('id', sessionId)
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
  const denied = await assertCaptureAdmin(supabase)
  if (denied) return denied

  const file = formData.get('image') as File | null
  if (!file || file.size === 0) return { error: 'Image manquante' }

  const { data: row, error: selErr } = await workSessionTable(supabase)
    .select('id,user_id,status,payload')
    .eq('id', sessionId)
    .maybeSingle()
  if (selErr || !row) return { error: selErr?.message ?? 'Session introuvable' }
  if ((row as SessionMutableRow).status !== 'draft') return { error: 'Session non modifiable' }

  const payload = parseWorkSessionPayload((row as SessionMutableRow).payload)
  const idx = findItemIndex(payload, itemId)
  if (idx < 0) return { error: 'Entrée introuvable' }

  const rawBuf = Buffer.from(await file.arrayBuffer())
  const sha256 = crypto.createHash('sha256').update(rawBuf).digest('hex')
  const validated = await validateWorkImageBuffer(rawBuf)
  if ('error' in validated) {
    // A rejected format only toasted, leaving no trace at all — the one upload
    // failure mode invisible to both the owner and the log. Record what arrived.
    await logWarn('Session shot rejected by image validation', undefined, {
      source: 'work_session.uploadWorkSessionItemShot',
      metadata: {
        sessionId,
        itemId,
        reason: validated.error,
        clientType: file.type || null,
        clientName: file.name || null,
        bytes: rawBuf.length,
      },
    })
    return { error: validated.error }
  }

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
  const denied = await assertCaptureAdmin(supabase)
  if (denied) return denied

  const sha = shotSha256.trim()
  if (!/^[a-f0-9]{64}$/i.test(sha)) return { error: 'Photo introuvable' }

  const { data: row, error: selErr } = await workSessionTable(supabase)
    .select('id,user_id,status,payload')
    .eq('id', sessionId)
    .maybeSingle()
  if (selErr || !row) return { error: selErr?.message ?? 'Session introuvable' }
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
  } catch (err) {
    await logWarn('Session shot R2 cleanup failed (best-effort)', err, {
      source: 'work_session.r2Cleanup',
      metadata: { r2_key: removed.r2_key },
    })
  }

  payload.items[idx] = touchItem({ ...item, shots: item.shots })

  const { error: upErr } = await workSessionTable(supabase)
    .update({ payload: asPayloadRecord(payload) })
    .eq('id', sessionId)
    .eq('status', 'draft')
  if (upErr) return { error: upErr.message }

  revalidatePath('/atelier/session/new')
  return { ok: true }
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
  const denied = await assertCaptureAdmin(supabase)
  if (denied) return denied

  const { data: row, error: selErr } = await workSessionTable(supabase)
    .select('id,user_id,status,payload')
    .eq('id', sessionId)
    .maybeSingle()
  if (selErr || !row) return { error: selErr?.message ?? 'Session introuvable' }
  if ((row as SessionMutableRow).status !== 'draft') return { error: 'Session non modifiable' }

  const payload = parseWorkSessionPayload((row as SessionMutableRow).payload)
  const sessionAt = sessionAtForPayload(payload)
  const idx = findItemIndex(payload, itemId)
  if (idx < 0) return { error: 'Entrée introuvable' }
  const item = payload.items[idx]
  const created = await createWorkFromSessionFields(supabase, user.id, {
    title_hint: item.title_hint ?? '',
    notes: item.notes ?? payload.notes,
    width_cm: item.width_cm,
    height_cm: item.height_cm,
    technique_id: item.technique_id,
    support_id: item.support_id,
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
  const denied = await assertCaptureAdmin(supabase)
  if (denied) return denied
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
    .eq('status', 'draft')
  if (error) return { error: error.message }
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

  const persistPayload = async (): Promise<string | null> => {
    const topLevelOeuvreId = listWorkSessionLinkedOeuvreIds(payload)[0] ?? row.oeuvre_id ?? null
    const { error } = await workSessionTable(supabase)
      .update({ oeuvre_id: topLevelOeuvreId, payload: asPayloadRecord(payload) })
      .eq('id', sessionId)
    return error?.message ?? null
  }

  /** Identical bytes staged twice share one key — applying it twice would 404 on the second pass. */
  const uniqueShots = (shots: WorkSessionShot[]): WorkSessionShot[] => {
    const seen = new Set<string>()
    return shots.filter((shot) => {
      if (seen.has(shot.r2_key)) return false
      seen.add(shot.r2_key)
      return true
    })
  }

  const applyShotsToWork = async (
    oeuvreId: number,
    shots: WorkSessionShot[],
    captureMeta: Record<string, unknown>,
    // Drops the shot from `payload` and persists it, so a retry or a concurrent run never
    // re-reads a staged key we are about to delete. Always runs before the R2 delete.
    consumeShot: (shot: WorkSessionShot) => Promise<string | null>,
  ): Promise<{ ok: true; applied: number } | { error: string }> => {
    let applied = 0
    // tblImage.sha256 was already recorded on every apply but never compared, so the
    // same picture could land on a work twice (different SeqNo, identical bytes).
    // Check once per work and drop the staged duplicate instead of doubling it up.
    const existingSha = new Set<string>()
    const { data: priorImages } = await supabase
      .from('tblImage')
      .select('sha256')
      .eq('OeuvreID', oeuvreId)
      .not('sha256', 'is', null)
    for (const row of (priorImages ?? []) as Array<{ sha256: string | null }>) {
      if (row.sha256) existingSha.add(row.sha256)
    }

    for (const shot of uniqueShots(shots)) {
      if (shot.sha256 && existingSha.has(shot.sha256)) {
        await logWarn('Session apply: duplicate photo skipped', null, {
          source: 'work_session.applyShotsToWork',
          metadata: { sessionId, oeuvreId, sha256: shot.sha256 },
        })
        const skipErr = await consumeShot(shot)
        if (skipErr) return { error: skipErr }
        try {
          await r2DeleteObject(shot.r2_key)
          if (shot.thumb_r2_key) await r2DeleteObject(shot.thumb_r2_key)
        } catch (err) {
          await logWarn('Session duplicate shot R2 cleanup failed (best-effort)', err, {
            source: 'work_session.r2Cleanup',
            metadata: { r2_key: shot.r2_key },
          })
        }
        continue
      }
      if (shot.sha256) existingSha.add(shot.sha256)
      let buf: Buffer
      try {
        buf = await r2GetObjectBuffer(shot.r2_key)
      } catch (e) {
        if (isR2ObjectNotFound(e)) {
          // Consumed by an earlier or concurrent apply: forget the shot instead of
          // dead-locking every later item in the session behind a phantom key.
          await logWarn('Session apply: staged shot missing, skipped', e, {
            source: 'work_session.applyShotsToWork',
            metadata: { sessionId, r2_key: shot.r2_key, oeuvreId },
          })
          const skipErr = await consumeShot(shot)
          if (skipErr) return { error: skipErr }
          continue
        }
        await logError('Session apply: R2 read failed', e, {
          source: 'work_session.applyShotsToWork',
          metadata: { sessionId, r2_key: shot.r2_key, oeuvreId },
        })
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
      applied += 1
      const persistErr = await consumeShot(shot)
      if (persistErr) return { error: persistErr }
      try {
        await r2DeleteObject(shot.r2_key)
        if (shot.thumb_r2_key) await r2DeleteObject(shot.thumb_r2_key)
      } catch (err) {
        await logWarn('Session shot R2 cleanup failed (best-effort)', err, {
          source: 'work_session.r2Cleanup',
          metadata: { r2_key: shot.r2_key },
        })
      }
    }
    return { ok: true, applied }
  }

  if (payload.items.length > 0) {
    const appliedAt = new Date().toISOString()
    for (let idx = 0; idx < payload.items.length; idx += 1) {
      let item = payload.items[idx]
      if (!itemIsActionable(item)) continue
      let oeuvreId = item.oeuvre_id ?? null
      if (!oeuvreId && item.mode === 'new') {
        // A concurrent apply may have created and linked this work between our snapshot and
        // now. Re-read the slot before minting one: without this both runs insert an Oeuvre
        // and the loser's payload write repoints the slot at its own orphan duplicate —
        // that is how #2371 came to shadow the photographed #2362 on 2026-07-29.
        const { data: fresh, error: freshErr } = await workSessionTable(supabase)
          .select('payload')
          .eq('id', sessionId)
          .maybeSingle()
        if (freshErr) return { error: freshErr.message }
        const freshItem = fresh
          ? parseWorkSessionPayload(fresh.payload).items.find((candidate) => candidate.id === item.id)
          : undefined

        if (freshItem?.oeuvre_id) {
          oeuvreId = freshItem.oeuvre_id
        } else {
          const created = await createWorkFromSessionFields(supabase, user.id, {
            title_hint: item.title_hint ?? '',
            notes: item.notes ?? payload.notes,
            width_cm: item.width_cm,
            height_cm: item.height_cm,
            technique_id: item.technique_id,
            support_id: item.support_id,
            session_at: sessionAt,
          })
          if ('error' in created) return created
          oeuvreId = created.oeuvreId
        }
        item = touchItem({
          ...item,
          mode: 'existing',
          oeuvre_id: oeuvreId,
          oeuvre_title: freshItem?.oeuvre_title ?? item.title_hint ?? null,
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
      const consumeItemShot = async (shot: WorkSessionShot): Promise<string | null> => {
        const current = payload.items[idx]
        payload.items[idx] = touchItem({
          ...current,
          shots: current.shots.filter((s) => s.r2_key !== shot.r2_key),
        })
        return persistPayload()
      }
      const applied = await applyShotsToWork(oeuvreId, item.shots, captureMeta, consumeItemShot)
      if ('error' in applied) return applied
      // Nothing landed (every staged key was a phantom): leave the item unapplied rather
      // than claiming photos it never received. Its shots are already cleared + persisted.
      if (applied.applied === 0) continue
      appliedCount += applied.applied
      payload.items[idx] = touchItem({
        ...item,
        mode: 'existing',
        oeuvre_id: oeuvreId,
        oeuvre_title: item.oeuvre_title ?? item.title_hint ?? null,
        status: 'applied',
        shots: [],
        applied_at: appliedAt,
        applied_by: user.id,
        applied_shot_count: (item.applied_shot_count ?? 0) + applied.applied,
      })
      const itemPersistErr = await persistPayload()
      if (itemPersistErr) return { error: itemPersistErr }
    }

    if (appliedCount === 0) return { error: 'Aucune entrée complète à appliquer' }
    payload.applied_at = appliedAt
    payload.applied_by = user.id
    // Journal multi-peinture: garder le brouillon ouvert pour ajouter d'autres œuvres après application.
    const nextStatus = 'draft'
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

  const consumeLegacyShot = async (shot: WorkSessionShot): Promise<string | null> => {
    payload.shots = payload.shots.filter((s) => s.r2_key !== shot.r2_key)
    return persistPayload()
  }
  const legacyApplied = await applyShotsToWork(oeuvreId, payload.shots, captureMeta, consumeLegacyShot)
  if ('error' in legacyApplied) return legacyApplied
  if (legacyApplied.applied === 0) return { error: 'Aucune photo à appliquer' }

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
      payload: asPayloadRecord(payload),
    })
    .eq('id', sessionId)
    .eq('status', 'pending_review')
  if (error) return { error: error.message }
  revalidatePath('/atelier/session/new')
  revalidatePath('/atelier/audit')
  return { ok: true }
}

async function purgeWorkSessionStagingShots(payload: WorkSessionPayload): Promise<void> {
  const allShots = [
    ...payload.shots,
    ...payload.items.flatMap((item) => item.shots),
  ]
  for (const shot of allShots) {
    try {
      await r2DeleteObject(shot.r2_key)
      if (shot.thumb_r2_key) await r2DeleteObject(shot.thumb_r2_key)
    } catch (err) {
      await logWarn('Session shot R2 cleanup failed (best-effort)', err, {
        source: 'work_session.r2Cleanup',
        metadata: { r2_key: shot.r2_key },
      })
    }
  }
}

/** All work_session rows sharing a calendar day with any seed row (journal is one row per day). */
async function workSessionIdsForJournalCalendarDays(
  supabase: Awaited<ReturnType<typeof createClient>>,
  seedSessionIds: string[],
): Promise<{ ids: string[]; error?: string }> {
  const uniqueSeeds = Array.from(new Set(seedSessionIds.filter(Boolean)))
  if (uniqueSeeds.length === 0) return { ids: [], error: 'Aucune session sélectionnée' }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ids: [], error: 'Non authentifié' }

  const { data: seedRows, error: seedErr } = await workSessionTable(supabase)
    .select('id,payload,created_at')
    .in('id', uniqueSeeds)
  if (seedErr) return { ids: [], error: seedErr.message }
  if (!seedRows?.length) return { ids: [], error: 'Session introuvable' }

  const targetDays = new Set<string>()
  for (const row of seedRows) {
    const payload = parseWorkSessionPayload(row.payload)
    const day = sessionDayForPayload(payload, row.created_at as string | null)
    if (day) targetDays.add(day)
  }

  const ids = new Set<string>(seedRows.map((row) => row.id as string))
  if (targetDays.size === 0) {
    return { ids: Array.from(ids) }
  }

  const teamWide = await teamWideSessionListing(supabase)
  for (const day of targetDays) {
    const listed = await listWorkSessionsForCalendarDay(supabase, day, { userId: user.id, teamWide })
    if ('error' in listed) return { ids: [], error: listed.error }
    for (const row of listed) ids.add(row.id)
  }

  return { ids: Array.from(ids) }
}

async function deleteWorkSessionRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sessionIds: string[],
): Promise<SessionActionResult & { deletedCount?: number }> {
  const uniqueIds = Array.from(new Set(sessionIds.filter(Boolean)))
  if (uniqueIds.length === 0) return { error: 'Aucune session sélectionnée' }

  const { data: rows, error: selErr } = await workSessionTable(supabase)
    .select('id,payload')
    .in('id', uniqueIds)
  if (selErr) return { error: selErr.message }
  if (!rows?.length) return { error: 'Session introuvable' }

  for (const row of rows) {
    await purgeWorkSessionStagingShots(parseWorkSessionPayload(row.payload))
  }

  const { data: deleted, error } = await workSessionTable(supabase)
    .delete()
    .in('id', rows.map((row) => row.id as string))
    .select('id')
  if (error) return { error: error.message }
  const deletedCount = deleted?.length ?? 0
  if (deletedCount === 0) return { error: 'Session non supprimée' }

  revalidatePath('/atelier')
  revalidatePath('/atelier/session/new')
  revalidatePath('/atelier/audit')
  return { ok: true, deletedCount }
}

export async function deleteWorkSessionAdmin(sessionId: string): Promise<SessionActionResult> {
  const supabase = await createClient()
  if (!(await rpcIsAdmin(supabase))) return { error: 'Action réservée à l’administrateur' }
  return deleteWorkSessionRows(supabase, [sessionId])
}

export async function deleteWorkSessionsAdmin(sessionIds: string[]): Promise<SessionActionResult & { deletedCount?: number }> {
  const supabase = await createClient()
  if (!(await rpcIsAdmin(supabase))) return { error: 'Action réservée à l’administrateur' }
  return deleteWorkSessionRows(supabase, sessionIds)
}

/** Journal delete: remove every work_session row for the seed row’s calendar day (hidden duplicates included). */
export async function deleteWorkSessionJournalEntry(
  sessionId: string,
): Promise<SessionActionResult & { deletedCount?: number }> {
  const supabase = await createClient()
  if (!(await rpcIsAdmin(supabase))) return { error: 'Action réservée à l’administrateur' }
  const collected = await workSessionIdsForJournalCalendarDays(supabase, [sessionId])
  if (collected.error) return { error: collected.error }
  return deleteWorkSessionRows(supabase, collected.ids)
}

export async function deleteWorkSessionJournalEntries(
  sessionIds: string[],
): Promise<SessionActionResult & { deletedCount?: number }> {
  const supabase = await createClient()
  if (!(await rpcIsAdmin(supabase))) return { error: 'Action réservée à l’administrateur' }
  const collected = await workSessionIdsForJournalCalendarDays(supabase, sessionIds)
  if (collected.error) return { error: collected.error }
  return deleteWorkSessionRows(supabase, collected.ids)
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
    await logError('listForAdminReview failed', error, { source: 'work_session.listWorkSessionsForAdminReview' })
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
    await logError('listForOeuvre direct query failed', directError, {
      source: 'work_session.listWorkSessionsForOeuvre',
      metadata: { oeuvreId },
    })
    return []
  }

  const { data: recentRows, error: recentError } = await workSessionTable(supabase)
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(1000)
  if (recentError) {
    await logError('listForOeuvre recent query failed', recentError, {
      source: 'work_session.listWorkSessionsForOeuvre',
      metadata: { oeuvreId },
    })
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
