'use server'

// Admin-only CRUD for forest_pins — used by the map layout pin editor in SiteEditorPanel.
// x = lng, y = lat (stored as float8; values 0–100 represent % position on the panorama).

import { logError } from '@/lib/error-reporter/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { ForestPin } from '@/components/public/works-utils'

async function assertAdmin(): Promise<void> {
  const sb = await createClient()
  const { data, error } = await sb.rpc('is_admin')
  if (error || !data) throw new Error('Forbidden: admin only')
}

export async function listForestPins(): Promise<ForestPin[]> {
  const sb = await createServiceClient()
  const { data, error } = await sb
    .from('forest_pins')
    .select('work_id, lat, lng, z, size, label')
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
    size: typeof r.size === 'number' ? r.size : null,
    label: typeof r.label === 'string' ? r.label : null,
  }))
}

export async function upsertForestPin(
  workId: number,
  x: number,
  y: number,
  z = 0,
  label?: string,
  size?: number | null,
): Promise<void> {
  await assertAdmin()
  const sb = await createServiceClient()
  const payload: Record<string, unknown> = { work_id: workId, lng: x, lat: y, z, label: label ?? null }
  if (size !== undefined) payload.size = size
  const { error } = await sb
    .from('forest_pins')
    .upsert(payload, { onConflict: 'work_id' })
  if (error) logError('upsertForestPin', error)
}

export async function updateForestPinZ(workId: number, z: number): Promise<void> {
  await assertAdmin()
  const sb = await createServiceClient()
  const { error } = await sb
    .from('forest_pins')
    .update({ z: Math.min(100, Math.max(0, z)) })
    .eq('work_id', workId)
  if (error) logError('updateForestPinZ', error)
}

export async function updateForestPinSize(workId: number, size: number | null): Promise<void> {
  await assertAdmin()
  const sb = await createServiceClient()
  const clamped = size === null ? null : Math.min(200, Math.max(8, size))
  const { error } = await sb
    .from('forest_pins')
    .update({ size: clamped })
    .eq('work_id', workId)
  if (error) logError('updateForestPinSize', error)
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
