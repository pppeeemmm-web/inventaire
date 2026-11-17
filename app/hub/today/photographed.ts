import 'server-only'

// « Photographiées ce jour » on « Aujourd'hui » (Pem 2026-11-17): before the work sessions (19 May 2026)
// the only day-level trace of a work is the date in its photo's file name, e.g.
// `W_1316_01_20230823_PE10773_copy.avif` = 23 Aug 2023 (911 works, 42 shoot days, Apr 2022 – Apr 2026).
// It is the day the photo was taken, not the day the work was made. Newer uploads have hash names,
// so this only ever matches old days. Read only, with the signed-in user's rights (RLS).
import { createClient } from '@/lib/supabase/server'
import { logError } from '@/lib/error-reporter/server'
import type { TodayWork } from '@/components/hub/TodayClient'

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/
const MAX_WORKS = 60

export async function worksPhotographedOn(day: string): Promise<{ works: TodayWork[]; more: number }> {
  if (!DAY_RE.test(day)) return { works: [], more: 0 }
  const ymd = day.replace(/-/g, '')
  const supabase = await createClient()
  const { data: images, error } = await supabase
    .from('tblImage')
    .select('OeuvreID, txtImageNameLink, SeqNo')
    .or(`txtImageName.ilike.*${ymd}*,txtImageNameLink.ilike.*${ymd}*`)
    .order('OeuvreID', { ascending: true })
    .order('SeqNo', { ascending: true })
    .limit(500)
  if (error) {
    await logError('today photographed images failed', error, { source: 'hub.today.worksPhotographedOn', metadata: { day } })
    throw error
  }
  // One row per work: its first photo of that day is the thumbnail.
  const photoOf = new Map<number, string | null>()
  for (const img of images ?? []) {
    if (img.OeuvreID != null && !photoOf.has(img.OeuvreID)) photoOf.set(img.OeuvreID, img.txtImageNameLink)
  }
  if (!photoOf.size) return { works: [], more: 0 }

  const { data: rows, error: worksError } = await supabase
    .from('Oeuvres')
    .select('OeuvreID, Titre')
    .in('OeuvreID', [...photoOf.keys()])
    .is('deleted_at', null)
    .order('OeuvreID', { ascending: true })
  if (worksError) {
    await logError('today photographed works failed', worksError, { source: 'hub.today.worksPhotographedOn', metadata: { day } })
    throw worksError
  }
  const works = (rows ?? []).map((w) => ({ id: w.OeuvreID, title: w.Titre, thumb: photoOf.get(w.OeuvreID) ?? null }))
  return { works: works.slice(0, MAX_WORKS), more: Math.max(0, works.length - MAX_WORKS) }
}
