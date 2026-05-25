'use server'

import { createClient } from '@/lib/supabase/server'
import { isSupabaseMissingTableError } from '@/lib/supabase/missing-table'

/** Kept out of contacts/actions.ts so client shells avoid importing the whole contacts module graph. */
export async function fetchContactConflicts() {
  const supabase = await createClient()
  const { data: isAdmin } = await supabase.rpc('is_admin')
  if (!isAdmin) return []

  const { data, error } = await supabase
    .from('contact_conflicts')
    .select('*, public:public_contact_id(ContactID, Nom, "Prénom", NomInstitution), private:private_contact_id(ContactID, Nom, "Prénom", NomInstitution)')
    .eq('resolved', false)

  if (error && isSupabaseMissingTableError(error)) return []
  return data ?? []
}
