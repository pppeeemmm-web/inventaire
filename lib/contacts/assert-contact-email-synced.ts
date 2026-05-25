import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeEmail } from './primary-contact-email'

/**
 * Auth actions must not run while DB email ≠ editor email.
 * Returns a clear “Save first” error instead of silently using a ghost address.
 */
export async function assertContactEmailSynced(
  sb: SupabaseClient,
  contactId: number,
  editorEmail: string,
): Promise<{ ok: true } | { error: string }> {
  const needle = normalizeEmail(editorEmail)
  if (!needle) return { error: 'Enter an email before linking or inviting' }

  const { data: row, error: rowErr } = await sb
    .from('Contact')
    .select('Email')
    .eq('ContactID', contactId)
    .maybeSingle()

  if (rowErr) return { error: rowErr.message }

  const stored = row?.Email ? normalizeEmail(row.Email) : ''
  if (stored !== needle) {
    return {
      error: `Save the contact first. Database still has "${row?.Email ?? '—'}", editor shows "${editorEmail.trim()}".`,
    }
  }

  const { data: emails, error: listErr } = await sb
    .from('contact_emails')
    .select('email, is_primary')
    .eq('contact_id', contactId)

  if (listErr) return { error: listErr.message }

  if (emails?.length) {
    const primary = emails.find((e) => e.is_primary) ?? emails[0]
    const listPrimary = primary?.email ? normalizeEmail(primary.email) : ''
    if (listPrimary && listPrimary !== needle) {
      return {
        error: `Save the contact first. Email list still has "${primary?.email}", editor shows "${editorEmail.trim()}".`,
      }
    }
  }

  return { ok: true }
}
