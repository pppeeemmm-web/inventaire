'use server'

import { nanoid } from 'nanoid'
import { createClient } from '@/lib/supabase/server'

async function guardTeam() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' as const, supabase: null }
  const { data: isTeam } = await supabase.rpc('is_team')
  if (!isTeam) return { error: 'Accès refusé' as const, supabase: null }
  return { error: null, supabase }
}

export async function createWorkingGroupFromSelection(payload: {
  name: string
  oeuvreIds: number[]
}): Promise<{ ok: true; groupId: string; groupName: string } | { error: string }> {
  const { error: authErr, supabase } = await guardTeam()
  if (authErr || !supabase) return { error: authErr ?? 'Auth' }

  const nm = payload.name.trim() || `Sélection du ${new Date().toLocaleDateString('fr-FR')}`
  const { data: group, error: insertGroupError } = await supabase
    .from('working_group')
    .insert({ name: nm })
    .select('id')
    .single()
  if (insertGroupError || !group) return { error: insertGroupError?.message ?? 'Group insert failed' }

  const { error: insertLinksError } = await supabase.from('working_group_work').insert(
    payload.oeuvreIds.map((oeuvreId, index) => ({ group_id: group.id, oeuvre_id: oeuvreId, position: index })),
  )
  if (insertLinksError) return { error: insertLinksError.message }

  return { ok: true, groupId: group.id, groupName: nm }
}

export async function createPrivateLinkForGroup(payload: {
  groupId: string
  recipientName: string | null
  expiresDays: number
}): Promise<{ ok: true; token: string; expiresAt: string } | { error: string }> {
  const { error: authErr, supabase } = await guardTeam()
  if (authErr || !supabase) return { error: authErr ?? 'Auth' }

  const token = nanoid(12)
  const expiresAt = new Date(Date.now() + payload.expiresDays * 86_400_000).toISOString()
  const { error } = await supabase.from('private_link').insert({
    token,
    recipient_name: payload.recipientName?.trim() || null,
    group_id: payload.groupId,
    expires_at: expiresAt,
  })
  if (error) return { error: error.message }
  return { ok: true, token, expiresAt }
}
