'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { appOrigin } from '@/lib/calendar/app-origin'
import { persistPrimaryEmail } from '@/lib/contacts/persist-primary-email'
import { findAuthUserIdByEmail } from '@/lib/contacts/team-access'
import { normalizeEmail } from '@/lib/contacts/primary-contact-email'

export type TeamAccessResult =
  | { ok: true; authUserId: string; invited: boolean; email: string }
  | { error: string }

export type TeamAccessState = {
  contactId: number
  storedEmail: string | null
  authUserId: string | null
  isTeamMember: boolean
  /** Supabase Auth user for stored/editor email, if any */
  authUserIdForEmail: string | null
  /** Another Contact row already holds that auth uid */
  linkedOtherContactId: number | null
}

async function requireAdminClient() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' as const }

  const { data: isAdmin, error } = await supabase.rpc('is_admin')
  if (error) return { error: error.message }
  if (!isAdmin) return { error: 'Admin only' as const }
  return { ok: true as const, supabase }
}

function inviteRedirectTo(): string {
  const origin = appOrigin()
  const next = encodeURIComponent('/login/reset-password')
  return `${origin}/auth/callback?next=${next}`
}

async function applyAuthLink(
  adminSupabase: Awaited<ReturnType<typeof createClient>>,
  contactId: number,
  authUserId: string,
  email: string,
): Promise<{ ok: true } | { error: string }> {
  const { error: updateErr } = await adminSupabase
    .from('Contact')
    .update({
      auth_user_id: authUserId,
      is_team_member: true,
      IsTeamMember: true,
      is_private: false,
      Email: email,
      Actif: true,
    })
    .eq('ContactID', contactId)

  if (updateErr) return { error: updateErr.message }
  revalidatePath('/atelier/contacts')
  return { ok: true }
}

/** Live DB truth for studio access panel (not editor cache). */
export async function getContactTeamAccessState(
  contactId: number,
): Promise<TeamAccessState | { error: string }> {
  const adminGate = await requireAdminClient()
  if ('error' in adminGate) return { error: adminGate.error ?? 'Admin only' }

  if (!Number.isFinite(contactId) || contactId < 1) return { error: 'Invalid contact' }

  const svc = createServiceClient()
  const { data: row, error } = await svc
    .from('Contact')
    .select('ContactID, Email, auth_user_id, is_team_member')
    .eq('ContactID', contactId)
    .maybeSingle()

  if (error) return { error: error.message }
  if (!row) return { error: 'Contact not found' }

  const storedEmail = row.Email?.trim() ?? null
  let authUserIdForEmail: string | null = null
  if (storedEmail) {
    authUserIdForEmail = await findAuthUserIdByEmail(svc, storedEmail)
  }

  let linkedOtherContactId: number | null = null
  const uid = authUserIdForEmail ?? row.auth_user_id
  if (uid) {
    const { data: other } = await svc
      .from('Contact')
      .select('ContactID')
      .eq('auth_user_id', uid)
      .neq('ContactID', contactId)
      .limit(1)
      .maybeSingle()
    if (other?.ContactID) linkedOtherContactId = other.ContactID
  }

  return {
    contactId: row.ContactID,
    storedEmail,
    authUserId: row.auth_user_id,
    isTeamMember: Boolean(row.is_team_member),
    authUserIdForEmail,
    linkedOtherContactId,
  }
}

/** Link Contact to auth + mark team member (admin). */
export async function setContactTeamMember(
  contactId: number,
  isTeamMember: boolean,
): Promise<{ ok: true } | { error: string }> {
  const adminGate = await requireAdminClient()
  if ('error' in adminGate) return { error: adminGate.error ?? 'Admin only' }

  if (!Number.isFinite(contactId) || contactId < 1) return { error: 'Invalid contact' }

  const { error } = await adminGate.supabase
    .from('Contact')
    .update({
      is_team_member: isTeamMember,
      IsTeamMember: isTeamMember,
      ...(isTeamMember ? { is_private: false } : {}),
    })
    .eq('ContactID', contactId)

  if (error) return { error: error.message }

  revalidatePath('/atelier/contacts')
  return { ok: true }
}

/**
 * One action: persist editor email to DB, then link existing Supabase user. Never sends email.
 */
export async function connectTeamStudioAccess(
  contactId: number,
  editorEmail: string,
): Promise<TeamAccessResult> {
  const adminGate = await requireAdminClient()
  if ('error' in adminGate) return { error: adminGate.error ?? 'Admin only' }

  if (!Number.isFinite(contactId) || contactId < 1) return { error: 'Invalid contact' }

  const editor = editorEmail?.trim()
  if (!editor) return { error: 'Enter an email in the Emails section first' }

  const svc = createServiceClient()
  const persisted = await persistPrimaryEmail(svc, contactId, editor)
  if ('error' in persisted) return persisted

  const email = normalizeEmail(persisted.email)
  const authUserId = await findAuthUserIdByEmail(svc, email)
  if (!authUserId) {
    return {
      error: `No Supabase login for ${persisted.email}. Create the user in Authentication, or use “Send invite (new account)” below.`,
    }
  }

  const { data: blocker } = await svc
    .from('Contact')
    .select('ContactID')
    .eq('auth_user_id', authUserId)
    .neq('ContactID', contactId)
    .limit(1)
    .maybeSingle()

  if (blocker?.ContactID) {
    return {
      error: `That login is already linked to contact #${blocker.ContactID}. Open that card or merge contacts — one login per person.`,
    }
  }

  const applied = await applyAuthLink(adminGate.supabase, contactId, authUserId, persisted.email)
  if ('error' in applied) return applied

  return { ok: true, authUserId, invited: false, email: persisted.email }
}

export async function linkAuthUserToContact(
  contactId: number,
  preferredEmail: string,
): Promise<TeamAccessResult> {
  return connectTeamStudioAccess(contactId, preferredEmail)
}

export async function sendAuthInviteToContact(
  contactId: number,
  preferredEmail: string,
): Promise<TeamAccessResult> {
  const adminGate = await requireAdminClient()
  if ('error' in adminGate) return { error: adminGate.error ?? 'Admin only' }

  if (!Number.isFinite(contactId) || contactId < 1) return { error: 'Invalid contact' }

  const editor = preferredEmail?.trim()
  if (!editor) return { error: 'Enter an email in the Emails section first' }

  const svc = createServiceClient()
  const persisted = await persistPrimaryEmail(svc, contactId, editor)
  if ('error' in persisted) return persisted

  const email = normalizeEmail(persisted.email)
  const existingId = await findAuthUserIdByEmail(svc, email)
  if (existingId) {
    return {
      error: `Login already exists for ${persisted.email}. Use “Connect studio access” — no email is sent.`,
    }
  }

  const { data: inviteData, error: inviteErr } = await svc.auth.admin.inviteUserByEmail(persisted.email, {
    redirectTo: inviteRedirectTo(),
  })

  if (inviteErr || !inviteData.user?.id) {
    return { error: inviteErr?.message ?? 'Invite failed' }
  }

  const applied = await applyAuthLink(adminGate.supabase, contactId, inviteData.user.id, persisted.email)
  if ('error' in applied) return applied

  return { ok: true, authUserId: inviteData.user.id, invited: true, email: persisted.email }
}

export async function inviteTeamMemberFromContact(
  contactId: number,
  preferredEmail: string,
): Promise<TeamAccessResult> {
  return connectTeamStudioAccess(contactId, preferredEmail)
}
