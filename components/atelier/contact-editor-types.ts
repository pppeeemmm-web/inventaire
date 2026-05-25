/** Shared types for ContactsTab + ContactEditorPanel */

export interface ContactRow {
  ContactID: number
  NomInstitution: string | null
  Nom: string | null
  Prénom: string | null
  Role: string | null
  Genre?: string | null
  TypeContact?: number | null
  Email?: string | null
  IndicatifPays1?: string | null
  Téléphone1?: string | null
  IndicatifPays2?: string | null
  Téléphone2?: string | null
  Website?: string | null
  Adresse?: string | null
  CodePostal?: string | null
  Ville?: string | null
  Pays?: string | null
  Notes?: string | null
  Instagram?: string | null
  LinkedIn?: string | null
  Facebook?: string | null
  Twitter?: string | null
  PersonneResponsable?: string | null
  RoleResponsable?: string | null
  Actif?: boolean | null
  is_private?: boolean | null
  is_team_member?: boolean | null
  auth_user_id?: string | null
}

export interface ContactAddress {
  id?: number
  contact_id: number
  label: string
  adresse: string | null
  code_postal: string | null
  ville: string | null
  pays: string | null
  position: number
  shipping_notes?: string | null
}

export interface ContactEmail {
  id?: number
  contact_id: number
  email: string
  label: string
  is_primary: boolean
}

export interface ContactPhone {
  id?: number
  contact_id: number
  country_code?: string | null
  phone: string
  label: string
  is_primary: boolean
}

export interface ContactWebsite {
  id?: number
  contact_id: number
  url: string
  label: string
}

export interface ContactSocial {
  id?: number
  contact_id: number
  platform: string
  handle: string
}
