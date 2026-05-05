'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'

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

export async function saveContactWithConflictCheck(formData: FormData): Promise<{ ok: true; id: number } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  // 1. Parse Fields
  const nom        = (formData.get('nom') as string | null)?.trim()
  const prenom     = (formData.get('prenom') as string | null)?.trim()
  const email      = (formData.get('email') as string | null)?.trim()
  const inst       = (formData.get('institution') as string | null)?.trim()
  const is_private = formData.get('is_private') === 'true'

  // 2. SECRET CHECK (Bypass RLS to find collisions)
  const serviceClient = createServiceClient()
  let conflictWithId: number | null = null

  if (nom || prenom || email) {
    let query = serviceClient.from('Contact').select('ContactID, is_private')
    
    if (email) {
      query = query.eq('Email', email)
    } else {
      query = query.ilike('Nom', nom || '').ilike('Prénom', prenom || '')
    }

    const { data: matches } = await query
    
    // We found a match that the current user might not see
    const privateMatch = matches?.find(m => m.is_private)
    if (privateMatch) {
      conflictWithId = privateMatch.ContactID
    }
  }

  // 3. Create the Contact (Public/Private as requested)
  const { data: contact, error: insertErr } = await supabase.from('Contact').insert({
    Nom: nom,
    Prénom: prenom,
    Email: email,
    NomInstitution: inst,
    is_private: is_private
  }).select('ContactID').single()

  if (insertErr || !contact) return { error: insertErr?.message ?? 'Insert failed' }

  // 4. Record Conflict if detected
  if (conflictWithId && !is_private) {
    await serviceClient.from('contact_conflicts').insert({
      public_contact_id: contact.ContactID,
      private_contact_id: conflictWithId
    })
  }

  revalidatePath('/atelier')
  return { ok: true, id: contact.ContactID }
}

export async function fetchContactConflicts() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  // Check if user is admin
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return []

  const { data } = await supabase
    .from('contact_conflicts')
    .select('*, public:public_contact_id(ContactID, Nom, Prénom, NomInstitution), private:private_contact_id(ContactID, Nom, Prénom, NomInstitution)')
    .eq('resolved', false)

  return data ?? []
}
