'use server'

import { createClient } from '@/lib/supabase/server'
import { r2S3Hostname } from '@/lib/r2-s3-host'
import { markStorageObject, recordStorageObject } from '@/lib/storage-object-ledger'
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Wall {
  id:    string
  nom:   string
  color: string
}

export interface Placement {
  oeuvre_id: number
  wall_id:   string
  position:  number   // 0–100 along wall
  scale:     number   // relative size (default 1)
  label?:    string
  x?:        number   // % from left of floorplan (0-100)
  y?:        number   // % from top of floorplan (0-100)
}

export interface ExhibitionLayout {
  id:             string
  created_at:     string
  updated_at:     string
  nom:            string
  process_id:     string | null
  floorplan_path: string | null
  floorplan_w:    number | null
  floorplan_h:    number | null
  walls:          Wall[]
  placements:     Placement[]
  notes:          string | null
}

export type LayoutResult = { error: string } | { ok: true; layout: ExhibitionLayout }
export type SimpleResult = { error: string } | { ok: true }
export type UploadResult = { error: string } | { ok: true; key: string }
export interface ExhibitionStepRow {
  id: string
  process_id: string
  nom: string
  statut: string
  date_echeance: string | null
  position: number
  notes: string | null
  overdue_override: boolean | null
}
export interface ExhibitionProcessRow {
  id: string
  nom: string
  type: string | null
  statut: string
  date_debut: string | null
  date_fin: string | null
  contact_id: number | null
  localisation: string | null
  url: string | null
  notes: string | null
  created_at: string
}
export interface ExhibitionProcessWithSteps extends ExhibitionProcessRow {
  steps: ExhibitionStepRow[]
}

// ── Auth guard ────────────────────────────────────────────────────────────────

async function guardTeam() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' as const, supabase: null }
  const { data: isTeam } = await supabase.rpc('is_team')
  if (!isTeam) return { error: 'Accès refusé' as const, supabase: null }
  return { error: null, supabase }
}

// ── R2 helper ─────────────────────────────────────────────────────────────────

function r2Client() {
  const accountId = process.env.R2_ACCOUNT_ID ?? ''
  return new S3Client({
    region: 'auto',
    endpoint: `https://${r2S3Hostname(accountId)}`,
    credentials: {
      accessKeyId:     process.env.R2_ACCESS_KEY_ID     ?? '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
    },
  })
}

async function r2Upload(key: string, body: Buffer, contentType: string) {
  const s3 = r2Client()
  const bucket = process.env.R2_BUCKET ?? 'paintings'
  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key, Body: body, ContentType: contentType,
  }))
  await recordStorageObject({
    bucket,
    objectKey: key,
    sizeBytes: body.length,
    contentType,
    source: 'exhibition_floorplan',
    classification: 'linked',
    linkedRefs: [{ table: 'exhibition_layout', column: 'floorplan_path' }],
  })
}

async function r2Delete(key: string) {
  const s3 = r2Client()
  const bucket = process.env.R2_BUCKET ?? 'paintings'
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
  await markStorageObject({
    bucket,
    objectKey: key,
    status: 'deleted',
    metadata: { source: 'exhibition_floorplan_delete' },
  })
}

// ── Fetch layouts ─────────────────────────────────────────────────────────────

export async function fetchLayouts(): Promise<ExhibitionLayout[]> {
  const { error: authErr, supabase } = await guardTeam()
  if (authErr || !supabase) return []
  const { data } = await (supabase
    .from('exhibition_layout') as any)
    .select('*')
    .order('updated_at', { ascending: false })
  return (data ?? []) as ExhibitionLayout[]
}

// ── Create layout ─────────────────────────────────────────────────────────────

export async function createLayout(nom: string, processId?: string): Promise<LayoutResult> {
  const { error: authErr, supabase } = await guardTeam()
  if (authErr || !supabase) return { error: authErr ?? 'Auth' }

  const defaultWalls: Wall[] = [
    { id: 'w1', nom: 'Mur A', color: '#c8a86e' },
    { id: 'w2', nom: 'Mur B', color: '#60a0a0' },
    { id: 'w3', nom: 'Mur C', color: '#a060a0' },
    { id: 'w4', nom: 'Mur D', color: '#a0a060' },
  ]

  const { data, error } = await (supabase.from('exhibition_layout') as any)
    .insert({
      nom,
      process_id: processId ?? null,
      walls: defaultWalls as any,
      placements: [] as any
    })
    .select()
    .single()

  if (error || !data) return { error: error?.message ?? 'Insert failed' }
  return { ok: true, layout: data as ExhibitionLayout }
}

// ── Upload floor plan image ───────────────────────────────────────────────────

export async function uploadFloorplan(layoutId: string, formData: FormData): Promise<UploadResult> {
  const { error: authErr, supabase } = await guardTeam()
  if (authErr || !supabase) return { error: authErr ?? 'Auth' }

  const file = formData.get('file') as File | null
  if (!file || file.size === 0) return { error: 'Aucun fichier' }

  const ext  = file.name.match(/\.([^.]+)$/)?.[1]?.toLowerCase() ?? 'png'
  const key  = `floorplans/${layoutId}.${ext}`
  const buf  = Buffer.from(await file.arrayBuffer())

  const bucketName = process.env.R2_BUCKET ?? 'paintings'
  try {
    await r2Upload(key, buf, file.type)
  } catch (e) {
    console.error('[exhibitions] upload error:', String(e))
    return { error: `Upload R2 (bucket="${bucketName}"): ${String(e)}` }
  }

  const { error } = await (supabase
    .from('exhibition_layout') as any)
    .update({ floorplan_path: key } as any)
    .eq('id', layoutId)

  if (error) return { error: error.message }
  return { ok: true, key }
}

// ── Save placements + walls ───────────────────────────────────────────────────

export async function saveLayout(
  layoutId: string,
  patch: Partial<Pick<ExhibitionLayout, 'nom' | 'walls' | 'placements' | 'notes' | 'process_id'>>,
): Promise<SimpleResult> {
  const { error: authErr, supabase } = await guardTeam()
  if (authErr || !supabase) return { error: authErr ?? 'Auth' }

  const { error } = await (supabase.from('exhibition_layout') as any).update(patch as any).eq('id', layoutId)
  if (error) return { error: error.message }
  return { ok: true }
}

// ── Delete layout ─────────────────────────────────────────────────────────────

export async function deleteLayout(layoutId: string, floorplanPath: string | null): Promise<SimpleResult> {
  const { error: authErr, supabase } = await guardTeam()
  if (authErr || !supabase) return { error: authErr ?? 'Auth' }

  if (floorplanPath) await r2Delete(floorplanPath).catch(() => {})
  const { error } = await supabase.from('exhibition_layout').delete().eq('id', layoutId)
  if (error) return { error: error.message }
  return { ok: true }
}

// ── Get signed URL for floor plan ────────────────────────────────────────────

export async function getFloorplanSignedUrl(key: string): Promise<{ url: string } | { error: string }> {
  const { error: authErr } = await guardTeam()
  if (authErr) return { error: authErr }
  // Floor plans in public bucket — return direct URL, no signing needed
  const url = `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? ''}/${key}`
  return { url }
}

// ── Fetch pipeline processes (for linking) ───────────────────────────────────

export async function fetchExhibitionProcesses(): Promise<{ id: string; nom: string }[]> {
  const { error: authErr, supabase } = await guardTeam()
  if (authErr || !supabase) return []
  const { data } = await supabase
    .from('suivi_process' as any)
    .select('id, nom')
    .eq('type', 'exposition')
    .order('date_fin', { ascending: false })
  return (data ?? []) as { id: string; nom: string }[]
}

export async function listExhibitionsWithSteps(): Promise<
  { ok: true; exhibitions: ExhibitionProcessWithSteps[] } | { error: string }
> {
  const { error: authErr, supabase } = await guardTeam()
  if (authErr || !supabase) return { error: authErr ?? 'Auth' }

  const { data: processes, error: pErr } = await supabase
    .from('suivi_process')
    .select('id, nom, type, statut, date_debut, date_fin, contact_id, localisation, url, notes, created_at')
    .eq('type', 'exposition')
    .or('date_debut.not.is.null,date_fin.not.is.null')
    .order('date_fin', { ascending: false, nullsFirst: false })
  if (pErr) return { error: pErr.message }

  const { data: steps, error: sErr } = await supabase
    .from('suivi_etape')
    .select('id, process_id, nom, statut, date_echeance, position, notes, overdue_override')
    .order('position')
  if (sErr) return { error: sErr.message }

  const typedProcesses = (processes ?? []) as ExhibitionProcessRow[]
  const typedSteps = (steps ?? []) as ExhibitionStepRow[]
  const exhibitions: ExhibitionProcessWithSteps[] = typedProcesses.map((p) => ({
    ...p,
    steps: typedSteps.filter((s) => s.process_id === p.id),
  }))
  return { ok: true, exhibitions }
}

export async function createExhibitionProcess(payload: {
  nom: string
  type?: string
}): Promise<{ ok: true; exhibition: ExhibitionProcessWithSteps } | { error: string }> {
  const { error: authErr, supabase } = await guardTeam()
  if (authErr || !supabase) return { error: authErr ?? 'Auth' }

  const { data, error } = await supabase
    .from('suivi_process')
    .insert({ nom: payload.nom, type: payload.type ?? 'exposition', statut: 'prevue' })
    .select('id, nom, type, statut, date_debut, date_fin, contact_id, localisation, url, notes, created_at')
    .single()
  if (error || !data) return { error: error?.message ?? 'Insert failed' }
  return { ok: true, exhibition: { ...(data as ExhibitionProcessRow), steps: [] } }
}

export async function deleteExhibitionProcess(exhibitionId: string): Promise<SimpleResult> {
  const { error: authErr, supabase } = await guardTeam()
  if (authErr || !supabase) return { error: authErr ?? 'Auth' }

  await supabase
    .from('suivi_process')
    .update({ exhibition_process_id: null })
    .eq('exhibition_process_id', exhibitionId)
  const { error } = await supabase.from('suivi_process').delete().eq('id', exhibitionId)
  if (error) return { error: error.message }
  return { ok: true }
}

export async function updateExhibitionProcess(payload: {
  exhibitionId: string
  patch: Partial<ExhibitionProcessRow> & { _isEditing?: boolean; steps?: ExhibitionStepRow[] }
  currentSteps: ExhibitionStepRow[]
}): Promise<{ ok: true; steps?: ExhibitionStepRow[] } | { error: string }> {
  const { error: authErr, supabase } = await guardTeam()
  if (authErr || !supabase) return { error: authErr ?? 'Auth' }

  const { steps, _isEditing: _ignored, ...processPatch } = payload.patch
  if (Object.keys(processPatch).length > 0) {
    const { error } = await supabase.from('suivi_process').update(processPatch).eq('id', payload.exhibitionId)
    if (error) return { error: error.message }
  }

  if (!steps) return { ok: true }
  const deletedIds = payload.currentSteps
    .filter((current) => !steps.find((s) => s.id === current.id))
    .map((s) => s.id)
  if (deletedIds.length > 0) {
    const { error } = await supabase.from('suivi_etape').delete().in('id', deletedIds)
    if (error) return { error: error.message }
  }

  const finalSteps: ExhibitionStepRow[] = []
  for (const step of steps) {
    const isNew = String(step.id).startsWith('s')
    if (isNew) {
      const { id: _temp, ...insertStep } = step
      const { data, error } = await supabase.from('suivi_etape').insert(insertStep).select().single()
      if (error || !data) return { error: error?.message ?? 'Insert step failed' }
      finalSteps.push(data as ExhibitionStepRow)
    } else {
      const { error } = await supabase.from('suivi_etape').update(step).eq('id', step.id)
      if (error) return { error: error.message }
      finalSteps.push(step)
    }
  }

  return { ok: true, steps: finalSteps }
}

export async function assignWorksToExhibitionContact(payload: {
  oeuvreIds: number[]
  contactId: number
}): Promise<SimpleResult> {
  const { error: authErr, supabase } = await guardTeam()
  if (authErr || !supabase) return { error: authErr ?? 'Auth' }
  const { error } = await supabase
    .from('Oeuvres')
    .update({ ContactID: payload.contactId })
    .in('OeuvreID', payload.oeuvreIds)
  if (error) return { error: error.message }
  return { ok: true }
}
