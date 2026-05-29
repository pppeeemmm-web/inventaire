'use server'

// Admin-only CRUD for forest_pins — used by the map layout pin editor in SiteEditorPanel.
// x = lng, y = lat (stored as float8; values 0–100 represent % position on the panorama).

import { logError } from '@/lib/error-reporter/server'
import { createServiceClient } from '@/lib/supabase/server'
import type { ForestPin } from '@/components/public/works-utils'

async function assertAdmin(): Promise<void> {
  const sb = await createServiceClient()
  const { data, error } = await sb.rpc('is_admin')
  if (error || !data) throw new Error('Forbidden: admin only')
}

export async function listForestPins(): Promise<ForestPin[]> {
  const sb = await createServiceClient()
  const { data, error } = await sb
    .from('forest_pins')
    .select('work_id, lat, lng, label')
    .order('work_id')
  if (error) {
    logError('listForestPins', error)
    return []
  }
  return (data ?? []).map((r: Record<string, unknown>) => ({
    work_id: r.work_id as number,
    x: typeof r.lng === 'number' ? r.lng : 0,
    y: typeof r.lat === 'number' ? r.lat : 0,
    label: typeof r.label === 'string' ? r.label : null,
  }))
}

export async function upsertForestPin(
  workId: number,
  x: number,
  y: number,
  label?: string,
): Promise<void> {
  await assertAdmin()
  const sb = await createServiceClient()
  const { error } = await sb
    .from('forest_pins')
    .upsert(
      { work_id: workId, lng: x, lat: y, label: label ?? null },
      { onConflict: 'work_id' },
    )
  if (error) logError('upsertForestPin', error)
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
