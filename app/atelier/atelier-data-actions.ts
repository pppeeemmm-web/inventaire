'use server'

import { createClient } from '@/lib/supabase/server'
import type { ContactAddress } from '@/components/atelier/contact-editor-types'

/** Flat `contact_addresses` for curation/compare (post–first-paint fetch from TeamPortalClient). */
export async function fetchAtelierContactAddresses(): Promise<ContactAddress[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('contact_addresses')
    .select('id, contact_id, label, adresse, code_postal, ville, pays, position, shipping_notes')
    .order('position')
  if (error) {
    console.error('[atelier contact_addresses]', error.message)
    return []
  }
  return (data ?? []) as ContactAddress[]
}
