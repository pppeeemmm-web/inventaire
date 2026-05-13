import crypto from 'crypto'

const HKDF_INFO = Buffer.from('atelier-calendar-refresh-v1', 'utf8')

function requireMasterSecret(): string {
  const raw = process.env.CALENDAR_TOKEN_ENCRYPTION_KEY
  if (!raw?.trim()) {
    throw new Error('CALENDAR_TOKEN_ENCRYPTION_KEY is not set')
  }
  return raw.trim()
}

/** 32-byte IKM for HKDF (same derivation input as legacy AES key material). */
function deriveIkm(): Buffer {
  return crypto.createHash('sha256').update(requireMasterSecret(), 'utf8').digest()
}

/** Legacy AES-256-GCM key was SHA256(secret) bytes — used when token_salt is null. */
function legacyAesKey(): Buffer {
  return deriveIkm()
}

function aesGcmEncrypt(key: Buffer, plain: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, enc]).toString('base64')
}

function aesGcmDecrypt(key: Buffer, b64: string): string {
  const buf = Buffer.from(b64, 'base64')
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const enc = buf.subarray(28)
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8')
}

function decryptLegacy(b64: string): string {
  return aesGcmDecrypt(legacyAesKey(), b64)
}

/**
 * Encrypt refresh token with per-account salt: HKDF-SHA256(IKM, salt, info) → AES-256-GCM.
 * Store `token_salt` alongside `refresh_token_encrypted` in calendar_account.
 */
export function encryptCalendarRefreshToken(plain: string): {
  ciphertext: string
  token_salt: string
} {
  const salt = crypto.randomBytes(16)
  const saltB64 = salt.toString('base64')
  const rawKey = crypto.hkdfSync('sha256', deriveIkm(), salt, HKDF_INFO, 32)
  const key = Buffer.from(rawKey)
  return { ciphertext: aesGcmEncrypt(key, plain), token_salt: saltB64 }
}

/**
 * Decrypt: uses HKDF when token_salt is set; otherwise legacy single-key layout (migration).
 */
export function decryptCalendarRefreshToken(
  b64: string,
  tokenSaltB64: string | null | undefined,
): string {
  if (!tokenSaltB64?.trim()) return decryptLegacy(b64)
  const salt = Buffer.from(tokenSaltB64.trim(), 'base64')
  const rawKey = crypto.hkdfSync('sha256', deriveIkm(), salt, HKDF_INFO, 32)
  const key = Buffer.from(rawKey)
  return aesGcmDecrypt(key, b64)
}

/** Alias matching historical import sites; pass optional per-row salt. */
export function decryptSecret(
  b64: string,
  tokenSaltB64?: string | null,
): string {
  return decryptCalendarRefreshToken(b64, tokenSaltB64)
}
