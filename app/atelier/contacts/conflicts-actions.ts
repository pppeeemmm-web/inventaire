'use server'

import { createClient } from '@/lib/supabase/server'

/** Kept out of contacts/actions.ts so client shells avoid importing the whole contacts module graph. */
export async function fetchContactConflicts() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return []

  const { data } = await supabase
    .from('contact_conflicts')
    .select('*, public:public_contact_id(ContactID, Nom, "Prénom", NomInstitution), private:private_contact_id(ContactID, Nom, "Prénom", NomInstitution)')
    .eq('resolved', false)

  return data ?? []
}
