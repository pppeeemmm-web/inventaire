'use server'

import crypto, { randomUUID } from 'crypto'

import { createClient } from '@/lib/supabase/server'
import { validateWorkImageBuffer } from '@/lib/image-upload'
import { r2PutObject } from '@/lib/r2-s3-object'

const MAX_BYTES = 8 * 1024 * 1024
const KEY_PREFIX = 'ledger/L_'

export type UploadLedgerAttachmentCode =
  | 'ok'
  | 'not_authenticated'
  | 'not_team'
  | 'no_file'
  | 'too_large'
  | 'invalid_format'
  | 'r2_failed'

export type UploadLedgerAttachmentResult =
  | { ok: true; key: string }
  | { ok: false; code: Exclude<UploadLedgerAttachmentCode, 'ok'> }

function makeLedgerKey(buf: Buffer, extWithoutDot: string): string {
  const hash8 = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 8)
  const safeExt = extWithoutDot.replace(/[^a-z0-9]/gi, '').slice(0, 4) || 'jpg'
  return `${KEY_PREFIX}${randomUUID()}_${hash8}.${safeExt}`
}

export async function uploadLedgerAttachment(formData: FormData): Promise<UploadLedgerAttachmentResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, code: 'not_authenticated' }

  const { data: isTeam } = await supabase.rpc('is_team')
  if (!isTeam) return { ok: false, code: 'not_team' }

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) return { ok: false, code: 'no_file' }
  if (file.size > MAX_BYTES) return { ok: false, code: 'too_large' }

  const ab = await file.arrayBuffer()
  const buf = Buffer.from(ab)

  const validated = await validateWorkImageBuffer(buf)
  if ('error' in validated) return { ok: false, code: 'invalid_format' }

  const key = makeLedgerKey(buf, validated.ext)

  try {
    await r2PutObject(buf, key, validated.mime, {
      source: 'system_log_attachment',
      classification: 'linked',
      linkedRefs: [{ table: 'system_log', column: 'attachments' }],
      uploadedBy: user.id,
    })
  } catch {
    return { ok: false, code: 'r2_failed' }
  }

  return { ok: true, key }
}
