'use server'

// Admin-only CRUD for forest_pins — the manual map layout placement editor.
// x = lng, y = lat (float8; 0–100 = % position in the flat scene box).
// z = stacking order, size = work width as % of scene width (vw), rotation = Y-axis degrees.

import { logError } from '@/lib/error-reporter/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { ForestPin } from '@/components/public/works-utils'

/** Work width bounds, as % of scene width (vw). */
const SIZE_MIN = 2
const SIZE_MAX = 90
/** Default work width (% of scene width) for a freshly placed pin. */
const DEFAULT_PIN_PCT = 16

async function assertAdmin(): Promise<void> {
  const sb = await createClient()
  const { data, error } = await sb.rpc('is_admin')
  if (error || !data) throw new Error('Forbidden: admin only')
}

export async function listForestPins(): Promise<ForestPin[]> {
  const sb = await createServiceClient()
  const { data, error } = await sb
    .from('forest_pins')
    .select('work_id, lat, lng, z, size, rotation, label')
    .order('work_id')
  if (error) {
    logError('listForestPins', error)
    return []
  }
  return (data ?? []).map((r: Record<string, unknown>) => ({
    work_id: r.work_id as number,
    x: typeof r.lng === 'number' ? r.lng : 0,
    y: typeof r.lat === 'number' ? r.lat : 0,
    z: typeof r.z === 'number' ? r.z : 0,
    size: typeof r.size === 'number' && r.size >= SIZE_MIN ? r.size : DEFAULT_PIN_PCT,
    rotation: typeof r.rotation === 'number' ? r.rotation : 0,
    label: typeof r.label === 'string' ? r.label : null,
  }))
}

/**
 * Insert or move a pin. Only the fields present in `opts` are written, so a
 * move (x/y only) leaves z/size/rotation intact on an existing row.
 */
export async function upsertForestPin(
  workId: number,
  x: number,
  y: number,
  opts: { z?: number; label?: string | null; size?: number; rotation?: number } = {},
): Promise<void> {
  await assertAdmin()
  const sb = await createServiceClient()
  const payload: Record<string, unknown> = {
    work_id: workId,
    lng: Math.max(0, Math.min(100, x)),
    lat: Math.max(0, Math.min(100, y)),
  }
  if (opts.z !== undefined) payload.z = Math.max(0, Math.min(100, Math.round(opts.z)))
  if (opts.label !== undefined) payload.label = opts.label
  if (opts.size !== undefined) payload.size = Math.max(SIZE_MIN, Math.min(SIZE_MAX, opts.size))
  if (opts.rotation !== undefined) payload.rotation = Math.max(-180, Math.min(180, opts.rotation))
  const { error } = await sb
    .from('forest_pins')
    .upsert(payload, { onConflict: 'work_id' })
  if (error) logError('upsertForestPin', error)
}

export async function updateForestPinSize(workId: number, size: number): Promise<void> {
  await assertAdmin()
  const sb = await createServiceClient()
  const { error } = await sb
    .from('forest_pins')
    .update({ size: Math.max(SIZE_MIN, Math.min(SIZE_MAX, size)) })
    .eq('work_id', workId)
  if (error) logError('updateForestPinSize', error)
}

export async function updateForestPinRotation(workId: number, rotation: number): Promise<void> {
  await assertAdmin()
  const sb = await createServiceClient()
  const { error } = await sb
    .from('forest_pins')
    .update({ rotation: Math.max(-180, Math.min(180, rotation)) })
    .eq('work_id', workId)
  if (error) logError('updateForestPinRotation', error)
}

export async function updateForestPinZ(workId: number, z: number): Promise<void> {
  await assertAdmin()
  const sb = await createServiceClient()
  const { error } = await sb
    .from('forest_pins')
    .update({ z: Math.max(0, Math.min(100, Math.round(z))) })
    .eq('work_id', workId)
  if (error) logError('updateForestPinZ', error)
}

export async function deleteForestPin(workId: number): Promise<void> {
  await assertAdmin()
  const sb = await createServiceClient()
  const { error } = await sb
    .from('forest_pins')
    .delete()
    .eq('work_id', workId)
  if (error) logError('deleteForestPin', error)
}
