import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Email used for auth link / invite.
 * Order: explicit editor value → primary contact_emails → legacy Contact.Email.
 */
export async function resolveContactInviteEmail(
  sb: SupabaseClient,
  contactId: number,
  preferredEmail?: string | null,
): Promise<string | null> {
  const pref = preferredEmail?.trim().toLowerCase()
  if (pref) return pref

  const { data: rows } = await sb
    .from('contact_emails')
    .select('email, is_primary')
    .eq('contact_id', contactId)

  if (rows?.length) {
    const primary = rows.find((r) => r.is_primary) ?? rows[0]
    const fromList = primary?.email?.trim()
    if (fromList) return fromList
  }

  const { data: contact } = await sb
    .from('Contact')
    .select('Email')
    .eq('ContactID', contactId)
    .maybeSingle()

  return contact?.Email?.trim() ?? null
}

export async function findAuthUserIdByEmail(
  sb: SupabaseClient,
  email: string,
): Promise<string | null> {
  const needle = email.trim().toLowerCase()
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const hit = data.users.find((u) => u.email?.toLowerCase() === needle)
    if (hit?.id) return hit.id
    if (data.users.length < 200) break
  }
  return null
}
