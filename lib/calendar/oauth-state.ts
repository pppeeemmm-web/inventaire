import crypto from 'crypto'

const TTL_MS = 10 * 60 * 1000

function secret(): string {
  const s = process.env.CALENDAR_OAUTH_STATE_SECRET ?? process.env.CALENDAR_TOKEN_ENCRYPTION_KEY
  if (!s?.trim()) throw new Error('CALENDAR_OAUTH_STATE_SECRET (or CALENDAR_TOKEN_ENCRYPTION_KEY) is not set')
  return s
}

export type OAuthStatePayload = {
  sub: string
  provider: 'google' | 'microsoft'
  exp: number
  n: string
}

export function signOAuthState(payload: Omit<OAuthStatePayload, 'exp' | 'n'>): string {
  const body: OAuthStatePayload = {
    ...payload,
    exp: Date.now() + TTL_MS,
    n: crypto.randomBytes(16).toString('hex'),
  }
  const json = JSON.stringify(body)
  const sig = crypto.createHmac('sha256', secret()).update(json).digest('base64url')
  return Buffer.from(json, 'utf8').toString('base64url') + '.' + sig
}

export function verifyOAuthState(state: string, expectedSub: string, provider: 'google' | 'microsoft'): OAuthStatePayload {
  const dot = state.lastIndexOf('.')
  if (dot <= 0) throw new Error('Invalid state')
  const json = Buffer.from(state.slice(0, dot), 'base64url').toString('utf8')
  const sig = state.slice(dot + 1)
  const want = crypto.createHmac('sha256', secret()).update(json).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(want)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new Error('Invalid state signature')
  const body = JSON.parse(json) as OAuthStatePayload
  if (body.exp < Date.now()) throw new Error('State expired')
  if (body.sub !== expectedSub) throw new Error('State user mismatch')
  if (body.provider !== provider) throw new Error('State provider mismatch')
  return body
}
