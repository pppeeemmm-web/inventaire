import crypto from 'crypto'

function deriveKey(): Buffer {
  const raw = process.env.CALENDAR_TOKEN_ENCRYPTION_KEY
  if (!raw?.trim()) {
    throw new Error('CALENDAR_TOKEN_ENCRYPTION_KEY is not set')
  }
  return crypto.createHash('sha256').update(raw, 'utf8').digest()
}

/** AES-256-GCM; output is base64(iv||tag||ciphertext). */
export function encryptSecret(plain: string): string {
  const key = deriveKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, enc]).toString('base64')
}

export function decryptSecret(b64: string): string {
  const key = deriveKey()
  const buf = Buffer.from(b64, 'base64')
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const enc = buf.subarray(28)
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8')
}
