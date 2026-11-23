import 'server-only'
import type { createClient } from '@/lib/supabase/server'

export type PlaceAddressLine = {
  adresse: string | null
  code_postal: string | null
  ville: string | null
  pays: string | null
  /** The floor / flat when the place is a child of the building (Places phase B, Pem 2026-11-23). */
  complement: string | null
}

/**
 * The address line of a place for a paper: the building's street / postcode / town / country (the root place), plus the
 * floor's name when the place is a floor or a flat under it. Null when the place is unknown.
 */
export async function placeAddressLine(
  supabase: Awaited<ReturnType<typeof createClient>>,
  placeId: number,
): Promise<PlaceAddressLine | null> {
  const { data: p } = await supabase.from('place')
    .select('id, name, parent_id, root_id, address, postcode, town, country').eq('id', placeId).maybeSingle()
  if (!p) return null
  const rootId = p.root_id ?? p.id
  const b = rootId === p.id
    ? p
    : (await supabase.from('place').select('id, name, parent_id, root_id, address, postcode, town, country').eq('id', rootId).maybeSingle()).data
  if (!b) return null
  return {
    adresse: b.address,
    code_postal: b.postcode,
    ville: b.town,
    pays: b.country,
    complement: p.parent_id != null ? p.name : null,
  }
}
