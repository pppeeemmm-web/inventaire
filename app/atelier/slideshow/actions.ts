'use server'

// Saved slideshows (TODO R5, docs/archive/PLAN_SLIDESHOW.md). Team table `slideshow`
// (supabase/sql/slideshow.sql): RLS lets any team member read and write; signed-out → nothing.

import { createClient } from '@/lib/supabase/server'
import { logError } from '@/lib/error-reporter/server'
import { normalizeSlideshowSettings, type SlideshowSettings } from '@/lib/slideshow'

export type SavedSlideshow = {
  id: string
  name: string
  workIds: number[]
  settings: SlideshowSettings
  updatedAt: string
}

type Row = { id: string; name: string; work_ids: number[] | null; settings: unknown; updated_at: string }

const toSaved = (r: Row): SavedSlideshow => ({
  id: r.id,
  name: r.name,
  workIds: (r.work_ids ?? []).filter((n) => Number.isInteger(n) && n > 0),
  settings: normalizeSlideshowSettings(r.settings),
  updatedAt: r.updated_at,
})

const cleanName = (name: string) => name.trim().replace(/\s+/g, ' ').slice(0, 120)
const cleanIds = (ids: number[]) => Array.from(new Set(ids.filter((n) => Number.isInteger(n) && n > 0)))

export async function listSlideshows(): Promise<SavedSlideshow[] | { error: string }> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('slideshow')
    .select('id, name, work_ids, settings, updated_at')
    .order('updated_at', { ascending: false })
    .limit(500)
  if (error) {
    await logError('Slideshow list failed', error, { source: 'slideshow.list' })
    return { error: error.message }
  }
  return (data as Row[]).map(toSaved)
}

/** Creates (id null) or replaces a saved slideshow: name, works in order, settings. */
export async function saveSlideshow(input: {
  id: string | null
  name: string
  workIds: number[]
  settings: SlideshowSettings
}): Promise<{ ok: true; id: string; name: string } | { error: string }> {
  const name = cleanName(input.name ?? '')
  if (!name) return { error: 'name' }
  const row = {
    name,
    work_ids: cleanIds(input.workIds ?? []),
    settings: normalizeSlideshowSettings(input.settings),
    updated_at: new Date().toISOString(),
  }
  const supabase = await createClient()
  const res = input.id
    ? await supabase.from('slideshow').update(row).eq('id', input.id).select('id, name').maybeSingle()
    : await supabase.from('slideshow').insert(row).select('id, name').single()
  if (res.error || !res.data) {
    await logError('Slideshow save failed', res.error, { source: 'slideshow.save', metadata: { id: input.id } })
    return { error: res.error?.message ?? 'not_found' }
  }
  return { ok: true, id: res.data.id, name: res.data.name }
}

export async function renameSlideshow(id: string, name: string): Promise<{ ok: true } | { error: string }> {
  const clean = cleanName(name ?? '')
  if (!clean) return { error: 'name' }
  const supabase = await createClient()
  const { error } = await supabase.from('slideshow').update({ name: clean, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) {
    await logError('Slideshow rename failed', error, { source: 'slideshow.rename', metadata: { id } })
    return { error: error.message }
  }
  return { ok: true }
}

export async function deleteSlideshow(id: string): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('slideshow').delete().eq('id', id)
  if (error) {
    await logError('Slideshow delete failed', error, { source: 'slideshow.delete', metadata: { id } })
    return { error: error.message }
  }
  return { ok: true }
}
