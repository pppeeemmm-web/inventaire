'use server'

import { createClient } from '@/lib/supabase/server'
import { r2S3Hostname } from '@/lib/r2-s3-host'
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
  await s3.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET ?? 'paintings',
    Key: key, Body: body, ContentType: contentType,
  }))
}

async function r2Delete(key: string) {
  const s3 = r2Client()
  await s3.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET ?? 'paintings', Key: key }))
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
