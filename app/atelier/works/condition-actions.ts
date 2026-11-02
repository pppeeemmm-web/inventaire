'use server'

// Constats (condition reports, owner 2026-11-02): one examination of a work — date, who, grade,
// notes, action / treatment — with issues and photos. Team adds; author or admin edits; deleting
// a whole constat is admin only (RLS). Removing an issue leaves its photo in R2 (no soft-delete
// helper here); the storage ledger can find it later.

import crypto, { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { logError } from '@/lib/error-reporter/server'
import { normalizeImageToAvifPair, validateWorkImageBuffer } from '@/lib/image-upload'
import { r2PutObject } from '@/lib/r2-s3-object'
import {
  parseActionStatus,
  parseGrade,
  type ConditionIssue,
  type ConditionReport,
} from '@/lib/condition'

type Err = { error: string }
type Supa = Awaited<ReturnType<typeof createClient>>

const MAX_TEXT = 20_000
const MAX_SHORT = 300
const MAX_PHOTO_BYTES = 12 * 1024 * 1024

const REPORT_COLS = 'id, oeuvre_id, created_at, updated_at, author_id, examined_on, examiner, grade, notes, action, action_status'
const ISSUE_COLS = 'id, report_id, created_at, author_id, description, location, photo_key'

async function teamUser(supabase: Supa): Promise<{ id: string } | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user ? { id: user.id } : null
}

/** Display names for author ids (Contact linked by `auth_user_id`). */
async function namesFor(supabase: Supa, ids: (string | null)[]): Promise<Record<string, string>> {
  const uniq = [...new Set(ids.filter((x): x is string => !!x))]
  const names: Record<string, string> = {}
  if (!uniq.length) return names
  // `select('*')`: the typed select parser rejects the accented `Prénom` column name.
  const { data } = await supabase.from('Contact').select('*').in('auth_user_id', uniq)
  for (const c of (data ?? []) as { auth_user_id: string | null; Prénom: string | null; Nom: string | null }[]) {
    if (c.auth_user_id) names[c.auth_user_id] = [c.Prénom, c.Nom].filter(Boolean).join(' ').trim() || '—'
  }
  return names
}

function withIssues(
  rows: Omit<ConditionReport, 'issues'>[],
  issues: ConditionIssue[],
): ConditionReport[] {
  const by = new Map<number, ConditionIssue[]>()
  for (const i of issues) by.set(i.report_id, [...(by.get(i.report_id) ?? []), i])
  return rows.map((r) => ({ ...r, issues: by.get(r.id) ?? [] }))
}

type ReportList = { reports: ConditionReport[]; names: Record<string, string>; me: string; isAdmin: boolean }

/** Constats of one work (newest examination first), or of all works when `oeuvreId` is omitted. */
export async function listConditionReports(oeuvreId?: number): Promise<ReportList | Err> {
  const supabase = await createClient()
  const user = await teamUser(supabase)
  if (!user) return { error: 'auth' }
  let q = supabase.from('condition_report').select(REPORT_COLS).order('examined_on', { ascending: false }).order('id', { ascending: false })
  if (oeuvreId != null) q = q.eq('oeuvre_id', oeuvreId)
  const [repRes, adminRes] = await Promise.all([q.limit(5000), supabase.rpc('is_admin')])
  if (repRes.error) return { error: repRes.error.message }
  const rows = (repRes.data ?? []) as Omit<ConditionReport, 'issues'>[]
  let issues: ConditionIssue[] = []
  if (rows.length) {
    const { data, error } = await supabase
      .from('condition_issue')
      .select(ISSUE_COLS)
      .in('report_id', rows.map((r) => r.id))
      .order('id')
    if (error) return { error: error.message }
    issues = (data ?? []) as ConditionIssue[]
  }
  const names = await namesFor(supabase, [...rows.map((r) => r.author_id), ...issues.map((i) => i.author_id)])
  return { reports: withIssues(rows, issues), names, me: user.id, isAdmin: adminRes.data === true }
}

export type ConditionReportInput = {
  examined_on?: string
  examiner?: string
  grade?: string | null
  notes?: string
  action?: string
  action_status?: string
}

function cleanInput(input: ConditionReportInput): { values: Record<string, unknown> } | Err {
  const out: Record<string, unknown> = {}
  if (input.examined_on !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.examined_on)) return { error: 'bad_date' }
    out.examined_on = input.examined_on
  }
  if (input.examiner !== undefined) out.examiner = input.examiner.trim().slice(0, MAX_SHORT) || null
  if (input.grade !== undefined) {
    if (input.grade === null || input.grade === '') out.grade = null
    else {
      const g = parseGrade(input.grade)
      if (!g) return { error: 'bad_grade' }
      out.grade = g
    }
  }
  if (input.notes !== undefined) out.notes = input.notes.trim().slice(0, MAX_TEXT) || null
  if (input.action !== undefined) out.action = input.action.trim().slice(0, MAX_TEXT) || null
  if (input.action_status !== undefined) {
    const s = parseActionStatus(input.action_status)
    if (!s) return { error: 'bad_status' }
    out.action_status = s
  }
  return { values: out }
}

export async function createConditionReport(
  oeuvreId: number,
  input: ConditionReportInput,
): Promise<{ ok: true; report: ConditionReport } | Err> {
  const supabase = await createClient()
  const user = await teamUser(supabase)
  if (!user) return { error: 'auth' }
  if (!Number.isInteger(oeuvreId) || oeuvreId <= 0) return { error: 'bad_work' }
  const clean = cleanInput(input)
  if ('error' in clean) return clean
  const { data, error } = await supabase
    .from('condition_report')
    .insert({ ...clean.values, oeuvre_id: oeuvreId, author_id: user.id })
    .select(REPORT_COLS)
    .single()
  if (error || !data) return { error: error?.message ?? 'insert' }
  revalidatePath('/atelier')
  return { ok: true, report: { ...(data as Omit<ConditionReport, 'issues'>), issues: [] } }
}

export async function updateConditionReport(
  id: number,
  input: ConditionReportInput,
): Promise<{ ok: true; report: Omit<ConditionReport, 'issues'> } | Err> {
  const supabase = await createClient()
  const user = await teamUser(supabase)
  if (!user) return { error: 'auth' }
  const clean = cleanInput(input)
  if ('error' in clean) return clean
  const { data, error } = await supabase.from('condition_report').update(clean.values).eq('id', id).select(REPORT_COLS).maybeSingle()
  if (error) return { error: error.message }
  // RLS hides the row from the update when the user is neither its author nor admin.
  if (!data) return { error: 'forbidden' }
  revalidatePath('/atelier')
  return { ok: true, report: data as Omit<ConditionReport, 'issues'> }
}

/** Admin only (RLS). Issues go with it (cascade); their photos stay in R2. */
export async function deleteConditionReport(id: number): Promise<{ ok: true } | Err> {
  const supabase = await createClient()
  const user = await teamUser(supabase)
  if (!user) return { error: 'auth' }
  const { data, error } = await supabase.from('condition_report').delete().eq('id', id).select('id')
  if (error) return { error: error.message }
  if (!data?.length) return { error: 'forbidden' }
  revalidatePath('/atelier')
  return { ok: true }
}

/**
 * Adds an issue (description, where on the work, optional photo). The photo is normalised like a
 * session shot — AVIF, 2100 px long side, plus a 400 px thumb — under `constat/C_{oid}_{report}_…`.
 */
export async function addConditionIssue(
  reportId: number,
  formData: FormData,
): Promise<{ ok: true; issue: ConditionIssue } | Err> {
  const supabase = await createClient()
  const user = await teamUser(supabase)
  if (!user) return { error: 'auth' }
  const description = String(formData.get('description') ?? '').trim().slice(0, MAX_TEXT)
  if (!description) return { error: 'empty' }
  const location = String(formData.get('location') ?? '').trim().slice(0, MAX_SHORT) || null

  const { data: rep } = await supabase.from('condition_report').select('id, oeuvre_id').eq('id', reportId).maybeSingle()
  if (!rep) return { error: 'not_found' }

  let photo_key: string | null = null
  const file = formData.get('photo')
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_PHOTO_BYTES) return { error: 'too_large' }
    const raw = Buffer.from(await file.arrayBuffer())
    const valid = await validateWorkImageBuffer(raw)
    if ('error' in valid) return { error: 'invalid_format' }
    const hash8 = crypto.createHash('sha256').update(raw).digest('hex').slice(0, 8)
    const base = `C_${rep.oeuvre_id}_${rep.id}_${randomUUID().slice(0, 8)}_${hash8}`
    const mainKey = `constat/${base}.avif`
    try {
      const { mainBuf, thumbBuf } = await normalizeImageToAvifPair(raw, { maxEdge: 2100 })
      await r2PutObject(mainBuf, mainKey, 'image/avif', {
        source: 'condition_issue',
        classification: 'linked',
        linkedRefs: [{ table: 'condition_issue', column: 'photo_key' }],
        uploadedBy: user.id,
        metadata: { role: 'main', oeuvre_id: rep.oeuvre_id, report_id: rep.id },
      })
      await r2PutObject(thumbBuf, `thumbs/constat/${base}.avif`, 'image/avif', {
        source: 'condition_issue_thumb',
        classification: 'linked',
        linkedRefs: [{ table: 'condition_issue', column: 'photo_key' }],
        uploadedBy: user.id,
        metadata: { role: 'thumb', original_key: mainKey },
      })
      photo_key = mainKey
    } catch (e) {
      await logError('Constat photo upload failed', e, { source: 'condition.addConditionIssue', metadata: { reportId } })
      return { error: 'r2_failed' }
    }
  }

  const { data, error } = await supabase
    .from('condition_issue')
    .insert({ report_id: reportId, author_id: user.id, description, location, photo_key })
    .select(ISSUE_COLS)
    .single()
  if (error || !data) return { error: error?.message ?? 'insert' }
  revalidatePath('/atelier')
  return { ok: true, issue: data as ConditionIssue }
}

export async function removeConditionIssue(id: number): Promise<{ ok: true } | Err> {
  const supabase = await createClient()
  const user = await teamUser(supabase)
  if (!user) return { error: 'auth' }
  const { data, error } = await supabase.from('condition_issue').delete().eq('id', id).select('id')
  if (error) return { error: error.message }
  if (!data?.length) return { error: 'forbidden' }
  revalidatePath('/atelier')
  return { ok: true }
}
