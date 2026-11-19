import 'server-only'

import { createPublicAnonClient } from '@/lib/supabase/server'
import { logError } from '@/lib/error-reporter/server'
import type { LandingHeroSource } from '@/lib/seo/landing-hero'

type LandingWithHeroId = LandingHeroSource & { hero_image_id?: number | null }

/**
 * The landing config (R2) keeps a copy of the hero picture's file name from when it was picked.
 * A retouch gives that image a new file name (`replaceWorkImage`), so read the current one by
 * `hero_image_id`. Logged-out rights (anon + RLS): a hero from a non-public work, or any failure,
 * keeps the stored name.
 */
export async function withLiveHeroKey<T extends LandingWithHeroId>(landing: T | undefined): Promise<T | undefined> {
  const id = landing?.hero_image_id
  if (!landing || typeof id !== 'number') return landing
  try {
    const { data } = await createPublicAnonClient()
      .from('tblImage')
      .select('txtImageNameLink')
      .eq('ImageID', id)
      .maybeSingle()
    const key = data?.txtImageNameLink?.trim()
    return key && key !== landing.hero_image_key ? { ...landing, hero_image_key: key } : landing
  } catch (e) {
    await logError('landing hero image lookup failed', e, { source: 'seo.withLiveHeroKey', metadata: { id } })
    return landing
  }
}
