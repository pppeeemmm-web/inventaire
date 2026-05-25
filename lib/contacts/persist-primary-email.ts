import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeEmail } from './primary-contact-email'

/** Write editor email to Contact.Email + primary contact_emails (single source of truth). */
export async function persistPrimaryEmail(
  sb: SupabaseClient,
  contactId: number,
  editorEmail: string,
): Promise<{ ok: true; email: string } | { error: string }> {
  const email = editorEmail.trim()
  if (!email) return { error: 'Email required' }

  const { error: contactErr } = await sb
    .from('Contact')
    .update({ Email: email })
    .eq('ContactID', contactId)

  if (contactErr) return { error: contactErr.message }

  const { data: rows, error: listErr } = await sb
    .from('contact_emails')
    .select('id, email, is_primary')
    .eq('contact_id', contactId)

  if (listErr) return { error: listErr.message }

  const needle = normalizeEmail(email)
  const match = rows?.find((r) => normalizeEmail(r.email) === needle)

  if (!rows?.length) {
    const { error } = await sb.from('contact_emails').insert({
      contact_id: contactId,
      email,
      label: 'Principal',
      is_primary: true,
    })
    if (error) return { error: error.message }
  } else if (match) {
    await sb.from('contact_emails').update({ is_primary: false }).eq('contact_id', contactId)
    const { error } = await sb
      .from('contact_emails')
      .update({ is_primary: true })
      .eq('id', match.id)
    if (error) return { error: error.message }
  } else {
    await sb.from('contact_emails').update({ is_primary: false }).eq('contact_id', contactId)
    const { error } = await sb.from('contact_emails').insert({
      contact_id: contactId,
      email,
      label: 'Principal',
      is_primary: true,
    })
    if (error) return { error: error.message }
  }

  return { ok: true, email }
}
