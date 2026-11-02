'use server'

// Colour filter source: the palette of every work's cover image, for the whole catalogue
// (Inventory loads works in batches; the colour filter must not depend on what is loaded).

import { createClient } from '@/lib/supabase/server'
import { toColourProfile, type ColourProfile } from '@/lib/colour-filter'
import { logError } from '@/lib/error-reporter/server'

export async function fetchCoverColourProfiles(): Promise<Record<number, ColourProfile> | { error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'auth' }

  const out: Record<number, ColourProfile> = {}
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('tblImage')
      .select('OeuvreID, palette')
      .eq('is_cover', true)
      .not('palette', 'is', null)
      .order('ImageID')
      .range(from, from + PAGE - 1)
    if (error) {
      await logError('Colour filter palettes failed', error, { source: 'inventory.fetchCoverColourProfiles' })
      return { error: error.message }
    }
    for (const r of data ?? []) {
      if (r.OeuvreID == null) continue
      const profile = toColourProfile(r.palette)
      if (profile) out[r.OeuvreID] = profile
    }
    if (!data || data.length < PAGE) break
  }
  return out
}
