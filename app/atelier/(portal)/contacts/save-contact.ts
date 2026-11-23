'use server'

/**
 * saveContact — the one door for a contact and its addresses, emails, phones, websites and socials (People.md §3,
 * v1, Pem GO 2026-11-23). It calls the SQL function `save_contact` (supabase/sql/save_contact_fn.sql), which checks
 * who asks, refuses a stale or forbidden change, keeps child-row ids and writes everything in one transaction.
 * No browser file writes a contact table: screens call this door and show the refusal in words.
 * No revalidatePath: the caller updates its one card from the returned card (principle 6).
 */

import { createClient } from '@/lib/supabase/server'
import { logError } from '@/lib/error-reporter'
import type {
  ContactAddress,
  ContactEmail,
  ContactPhone,
  ContactRow,
  ContactSocial,
  ContactWebsite,
} from '@/components/atelier/contact-editor-types'

/** Contact columns the door writes (the SQL function refuses any other key). */
export type ContactFields = Partial<
  Pick<
    ContactRow,
    | 'NomInstitution'
    | 'Nom'
    | 'Prénom'
    | 'Genre'
    | 'Role'
    | 'TypeContact'
    | 'Email'
    | 'IndicatifPays1'
    | 'Téléphone1'
    | 'IndicatifPays2'
    | 'Téléphone2'
    | 'PersonneResponsable'
    | 'RoleResponsable'
    | 'Notes'
    | 'Actif'
    | 'is_private'
    | 'is_team_member'
  > & { Type: string | null; IsTeamMember: boolean | null; PropriétaireOeuvre: boolean | null }
>

type Row<T> = Omit<T, 'contact_id'> & { contact_id?: number }

export type ContactLists = Partial<{
  addresses: Row<ContactAddress>[]
  emails: Row<ContactEmail>[]
  phones: Row<ContactPhone>[]
  websites: Row<ContactWebsite>[]
  socials: Row<ContactSocial>[]
}>

export type SaveContactInput = {
  /** null = create. */
  id: number | null
  fields?: ContactFields
  /** The field values the screen read (stale check). Omit only when the screen holds no earlier copy. */
  read?: ContactFields | null
  /** A kind left out is not touched. */
  lists?: ContactLists
  /** The lists as the screen read them (stale check). */
  readLists?: ContactLists | null
}

export type ContactCard = {
  contact: ContactRow
  addresses: ContactAddress[]
  emails: ContactEmail[]
  phones: ContactPhone[]
  websites: ContactWebsite[]
  socials: ContactSocial[]
}

export type SaveContactRefusal =
  | 'forbidden'
  | 'bad_field'
  | 'admin_only'
  | 'stale'
  | 'not_found'

export type SaveContactResult =
  | { ok: true; created: boolean; changed: string[]; card: ContactCard }
  | { unchanged: true; card: ContactCard }
  | { refused: SaveContactRefusal; detail?: unknown; card?: ContactCard }
  | { error: string }

/** '' → null, so « emptied » and « never set » compare equal and nothing stores an empty string. */
function blankToNull<T extends Record<string, unknown>>(o: T): T {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(o)) {
    if (k === 'contact_id') continue
    out[k] = typeof v === 'string' && v.trim() === '' ? null : v
  }
  return out as T
}

/** The column a row cannot exist without: a row left blank (an empty « + » line) is dropped, not sent. */
const REQUIRED: Record<string, string[]> = { emails: ['email'], phones: ['phone'], websites: ['url'], socials: ['platform', 'handle'] }

function cleanLists(lists: ContactLists | null | undefined): ContactLists | undefined {
  if (!lists) return undefined
  const out: Record<string, unknown[]> = {}
  for (const [kind, rows] of Object.entries(lists)) {
    if (!Array.isArray(rows)) continue
    out[kind] = rows
      .map((r) => blankToNull(r as Record<string, unknown>))
      .filter((r) => (REQUIRED[kind] ?? []).every((c) => r[c] != null))
  }
  return out as ContactLists
}

/** The values the screen read go as they were (no trimming, no renaming), so the stale check compares like with like. */
function rawRead<T extends object>(o: T | null | undefined): T | null {
  if (!o) return null
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(o)) if (k !== 'contact_id') out[k] = v
  return out as T
}

function cleanFields(fields: ContactFields | null | undefined): ContactFields | undefined {
  if (!fields) return undefined
  const f = blankToNull(fields as Record<string, unknown>) as ContactFields
  // One spelling for the framer role (the editor offered both).
  if (f.Role === 'Encadreur') f.Role = 'Framer'
  return f
}

export async function saveContact(input: SaveContactInput): Promise<SaveContactResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { refused: 'forbidden' }

  const p = {
    id: input.id,
    fields: cleanFields(input.fields) ?? {},
    read: rawRead(input.read),
    lists: cleanLists(input.lists) ?? {},
    read_lists: input.readLists
      ? Object.fromEntries(Object.entries(input.readLists).map(([k, rows]) => [k, (rows ?? []).map((r) => rawRead(r))]))
      : null,
  }
  const { data, error } = await supabase.rpc('save_contact' as never, { p } as never)
  if (error) {
    await logError('saveContact failed', error, { source: 'saveContact', metadata: { contactId: input.id } })
    return { error: error.message }
  }
  return data as unknown as SaveContactResult
}
