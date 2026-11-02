'use server'

// Rows for report sources the Atelier shell does not already hold (Contacts).
// Kaizen and Ventes reuse their own loaders (`listKaizen`, `fetchOrders`).

import { createClient } from '@/lib/supabase/server'

export type ReportContactRow = {
  ContactID: number
  Nom: string | null
  Prénom: string | null
  NomInstitution: string | null
  Type: string | null
  Role: string | null
  Ville: string | null
  Pays: string | null
  Email: string | null
  Téléphone1: string | null
  Actif: boolean | null
  is_team_member: boolean
  PropriétaireOeuvre: boolean | null
}

export async function listReportContacts(): Promise<{ rows: ReportContactRow[] } | { error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'auth' }
  // `select('*')`: the typed select parser rejects the accented column names.
  const { data, error } = await supabase.from('Contact').select('*').order('ContactID').limit(5000)
  if (error) return { error: error.message }
  return {
    rows: ((data ?? []) as ReportContactRow[]).map((c) => ({
      ContactID: c.ContactID,
      Nom: c.Nom,
      Prénom: c.Prénom,
      NomInstitution: c.NomInstitution,
      Type: c.Type,
      Role: c.Role,
      Ville: c.Ville,
      Pays: c.Pays,
      Email: c.Email,
      Téléphone1: c.Téléphone1,
      Actif: c.Actif,
      is_team_member: c.is_team_member,
      PropriétaireOeuvre: c.PropriétaireOeuvre,
    })),
  }
}
