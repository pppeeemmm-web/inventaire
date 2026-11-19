/**
 * AI desk phase 3 (docs/design/2026-11-18/AiDesk.notes.md): what a business card read by the PC agent may add to a
 * contact. One rule, used by Bureau IA (to list the changes) and by the contact editor (to pre-fill them):
 * a name / institution only fills an EMPTY field (the card's job title is not used: the contact's « Rôle » is a
 * category list, not a title); an email, phone, website or address is added only when the
 * contact does not have it yet. Nothing is ever overwritten.
 */
import type { ImportedContact } from '@/lib/contact-import-types'

export type CardSuggestion = ImportedContact

export type CardChange = {
  field: 'prenom' | 'nom' | 'institution' | 'email' | 'phone' | 'website' | 'address'
  before: string | null
  after: string
}

/** What the contact has now, flattened (scalars + the values of its lists). */
export type CardBefore = {
  prenom: string | null
  nom: string | null
  institution: string | null
  emails: string[]
  phones: string[]
  websites: string[]
  addresses: { adresse: string | null; code_postal: string | null; ville: string | null; pays: string | null }[]
}

const blank = (s: string | null | undefined) => !s || !s.trim()

export function sameEmail(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

/** Same number when the last 9 digits match (09 55 … vs +33 9 55 …). */
export function samePhone(a: string, b: string): boolean {
  const da = a.replace(/\D/g, '')
  const db = b.replace(/\D/g, '')
  if (!da || !db) return false
  return da.slice(-9) === db.slice(-9)
}

export function sameUrl(a: string, b: string): boolean {
  const n = (s: string) => s.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '')
  return n(a) === n(b)
}

export function addressLine(a: { adresse: string | null; code_postal: string | null; ville: string | null; pays: string | null }): string {
  return [a.adresse, [a.code_postal, a.ville].filter(Boolean).join(' '), a.pays].filter((s) => s && s.trim()).join(', ')
}

export function sameAddress(
  a: { adresse: string | null; code_postal: string | null; ville: string | null },
  b: { adresse: string | null; code_postal: string | null; ville: string | null },
): boolean {
  const n = (s: string | null) => (s ?? '').toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '')
  if (n(a.code_postal) !== n(b.code_postal) || n(a.ville) !== n(b.ville)) return false
  if (n(a.adresse) === n(b.adresse)) return true
  // Same postcode, city and street number = the same place: a card read « Bourgoin » for « Bourgeois » must not
  // add a second address (seen on the first real card, 2026-11-19).
  const num = (s: string | null) => /\d+/.exec(s ?? '')?.[0] ?? null
  return num(a.adresse) !== null && num(a.adresse) === num(b.adresse)
}

/** The changes a card suggestion would make to this contact; empty = nothing new on the card. */
export function cardChanges(before: CardBefore, s: CardSuggestion): CardChange[] {
  const out: CardChange[] = []
  const scalar = (field: 'prenom' | 'nom' | 'institution', after: string | null) => {
    if (!blank(after) && blank(before[field])) out.push({ field, before: null, after: after!.trim() })
  }
  scalar('prenom', s.prenom)
  scalar('nom', s.nom)
  scalar('institution', s.institution)
  for (const e of s.emails) if (!before.emails.some((x) => sameEmail(x, e.email))) out.push({ field: 'email', before: null, after: e.email })
  for (const p of s.phones) if (!before.phones.some((x) => samePhone(x, p.phone))) out.push({ field: 'phone', before: null, after: p.phone })
  for (const w of s.websites) if (!before.websites.some((x) => sameUrl(x, w.url))) out.push({ field: 'website', before: null, after: w.url })
  for (const a of s.addresses) {
    if (!before.addresses.some((x) => sameAddress(x, a))) out.push({ field: 'address', before: null, after: addressLine(a) })
  }
  return out
}
