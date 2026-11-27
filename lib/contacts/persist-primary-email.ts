import { createClient } from '@/lib/supabase/server'
import { saveContact } from '@/app/atelier/(portal)/contacts/save-contact'
import { normalizeEmail } from './primary-contact-email'

/**
 * The email chosen for studio access becomes the card's primary email — through the one contact door (ContactDoor.md
 * step 3, BuildingPrinciples 2): `saveContact` writes Contact.Email and the email list (the chosen one primary, the
 * others kept, ids kept) in one transaction, with the same checks as the contact editor. Caller: admin team access.
 */
export async function persistPrimaryEmail(
  contactId: number,
  editorEmail: string,
): Promise<{ ok: true; email: string } | { error: string }> {
  const email = editorEmail.trim()
  if (!email) return { error: 'Email required' }

  const sb = await createClient()
  const { data: rows, error: listErr } = await sb
    .from('contact_emails')
    .select('id, email, label, is_primary')
    .eq('contact_id', contactId)
  if (listErr) return { error: listErr.message }

  const needle = normalizeEmail(email)
  const current = rows ?? []
  // A row already holding this address keeps its stored spelling, which the door copies to Contact.Email; it is
  // also the spelling returned, so the caller's later Contact.Email write agrees with it.
  const known = current.find((r) => normalizeEmail(r.email) === needle)
  const emails = [
    ...current.map((r) => ({ id: r.id, email: r.email, label: r.label ?? '', is_primary: normalizeEmail(r.email) === needle })),
    ...(known ? [] : [{ email, label: 'Principal', is_primary: true }]),
  ]

  // Contact.Email is copied by the door from the primary row (save_contact step 7).
  const res = await saveContact({ id: contactId, lists: { emails } })
  // A refusal is never « ok » (principle 3).
  if ('error' in res) return { error: res.error }
  if ('refused' in res) return { error: `refused: ${res.refused}` }
  return { ok: true, email: known?.email ?? email }
}
