'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { generateCOA } from '@/app/atelier/vault/actions'
import { logSystemEvent } from '@/lib/utils/logging'

export type FieldDocType = 'coa'

async function guardTeam() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'auth' as const, supabase: null }
  const { data: isTeam } = await supabase.rpc('is_team')
  if (!isTeam) return { error: 'forbidden' as const, supabase: null }
  return { error: null, supabase }
}

export async function generateFieldDocument(
  docType: FieldDocType,
  oeuvreId: number,
): Promise<{ ok: true; href: string } | { error: string }> {
  const g = await guardTeam()
  if (g.error || !g.supabase) return { error: g.error ?? 'auth' }
  if (!Number.isFinite(oeuvreId) || oeuvreId <= 0) return { error: 'invalid_oeuvre' }

  const res = await generateCOA(oeuvreId)
  if ('error' in res) return { error: res.error }
  await logSystemEvent({
    eventType: 'VAULT_UPLOAD',
    tableName: 'document',
    rowId: res.doc?.id,
    metadata: { source: 'documents_new', type: docType, oeuvreId },
  })
  revalidatePath('/atelier/documents/new')
  return { ok: true, href: '/atelier/vault' }
}
