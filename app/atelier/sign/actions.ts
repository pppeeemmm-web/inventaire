'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { r2PutObject } from '@/lib/r2-s3-object'
import { logSystemEvent } from '@/lib/utils/logging'

export async function saveContactSignature(
  contactId: number,
  pngBase64: string,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'auth' }

  const { data: isAdmin } = await supabase.rpc('is_admin')
  if (!isAdmin) return { error: 'forbidden' }

  if (!Number.isFinite(contactId) || contactId <= 0) return { error: 'invalid_contact' }
  const raw = pngBase64.replace(/^data:image\/png;base64,/, '')
  const buf = Buffer.from(raw, 'base64')
  if (buf.length < 32 || buf.length > 512 * 1024) return { error: 'invalid_image' }

  const key = `signatures/contact_${contactId}_${Date.now()}.png`
  try {
    await r2PutObject(buf, key, 'image/png', {
      source: 'contact_signature',
      classification: 'linked',
      linkedRefs: [{ table: 'Contact', column: 'signature_r2_key', row_id: contactId }],
      uploadedBy: user.id,
    })
  } catch {
    return { error: 'r2_failed' }
  }

  const { error } = await supabase.from('Contact')
    .update({ signature_r2_key: key })
    .eq('ContactID', contactId)

  if (error) return { error: error.message }

  await logSystemEvent({
    eventType: 'SYSTEM_CONFIG',
    tableName: 'Contact',
    rowId: contactId,
    metadata: { action: 'signature_saved', key },
  })

  revalidatePath('/atelier/sign/setup')
  return { ok: true }
}
