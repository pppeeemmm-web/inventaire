import 'server-only'
import type { createClient } from '@/lib/supabase/server'
import type { Json } from '@/lib/types/supabase.generated'

/**
 * A contact's address tab, written in one go by the database door `save_contact_places`
 * (supabase/sql/places_phase_b_switch.sql, Places.md §5). Called with the signed-in user's client: the door
 * checks the team and runs under RLS. No question is asked (Pem 2026-11-23): the same full line is the same
 * building, `complement` is the floor / flat (a child place), an edited line is corrected for everyone, a dropped
 * address ends that person's link only.
 */
export type ContactPlaceRowInput = {
  /** An existing live link of this contact (`contact_place_lines.id`). */
  link_id?: number
  label?: string | null
  adresse?: string | null
  code_postal?: string | null
  ville?: string | null
  pays?: string | null
  /** The floor / flat (« 3e étage »): a child place of the building. */
  complement?: string | null
  shipping_notes?: string | null
  is_primary?: boolean
}

export type SaveContactPlacesResult =
  | { status: 'ok'; changed: string[]; ended: number; removed: number }
  | { error: string }

export async function callSaveContactPlaces(
  supabase: Awaited<ReturnType<typeof createClient>>,
  contactId: number,
  rows: ContactPlaceRowInput[],
): Promise<SaveContactPlacesResult> {
  const { data, error } = await supabase.rpc('save_contact_places', { p_contact: contactId, p_rows: rows as unknown as Json })
  if (error) return { error: error.message }
  const res = data as unknown as SaveContactPlacesResult | null
  if (!res || !('status' in res) || res.status !== 'ok') return { error: 'save_contact_places: no answer' }
  return res
}
