/** Shared shape for bulk contact import (CSV, URL enrich, etc.). */

export interface ImportedContact {
  prenom: string | null
  nom: string | null
  institution: string | null
  role: string | null
  notes: string | null
  emails: { email: string; label: string }[]
  phones: { country_code: string | null; phone: string; label: string }[]
  addresses: {
    label: string
    adresse: string | null
    code_postal: string | null
    ville: string | null
    pays: string | null
  }[]
  websites: { url: string; label: string }[]
}
