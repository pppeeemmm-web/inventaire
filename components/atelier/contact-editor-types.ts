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
  Adresse?: string | null
  CodePostal?: string | null
  Ville?: string | null
  Pays?: string | null
  Notes?: string | null
  born_on?: string | null
  born_precision?: string | null
  died_on?: string | null
  died_precision?: string | null
  PersonneResponsable?: string | null
  RoleResponsable?: string | null
  Actif?: boolean | null
  is_private?: boolean | null
  is_team_member?: boolean | null
  auth_user_id?: string | null
}

/**
 * A person's address = one live link person ↔ place (`contact_place_lines`, Places.md §3b): `id` is the link,
 * `place_id` the place a work / order / shipment points at. Written only through `save_contact_places`.
 */
export interface ContactAddress {
  id?: number
  contact_id: number
  place_id?: number
  /** The building (root place) the link's place is in; = place_id when the link is to the building itself. */
  building_id?: number
  label: string
  adresse: string | null
  code_postal: string | null
  ville: string | null
  pays: string | null
  /** The floor / flat (a child place of the building), shown as « Étage / appartement ». */
  complement?: string | null
  position: number
  shipping_notes?: string | null
  is_primary?: boolean
  role?: string
  /** How many other people are linked to the same place (a count, never who). */
  others?: number
}

/** Columns of `contact_place_lines` read wherever addresses are listed. */
export const ADDRESS_LINE_COLS =
  'id, contact_id, place_id, building_id, label, role, is_primary, adresse, code_postal, ville, pays, complement, position, shipping_notes, others'

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
