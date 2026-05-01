'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type ContactDeleteResult = { error: string } | { ok: true }

/**
 * Delete one or more contacts and their associated addresses.
 * Note: Does NOT delete works associated with the contact (sets ContactID to null in Oeuvres).
 */
export async function deleteContacts(ids: number[]): Promise<ContactDeleteResult> {
  const supabase = await createClient()

  // Auth guard
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { data: isTeam } = await supabase.rpc('is_team')
  if (!isTeam) return { error: 'Accès refusé' }

  if (!ids.length) return { ok: true }

  // 1. Delete addresses first
  const { error: addrErr } = await supabase
    .from('contact_addresses')
    .delete()
    .in('contact_id', ids)
  
  if (addrErr) return { error: addrErr.message }

  // 2. Delete contacts
  const { error: contactErr } = await supabase
    .from('Contact')
    .delete()
    .in('ContactID', ids)

  if (contactErr) return { error: contactErr.message }

  revalidatePath('/atelier')
  return { ok: true }
}
