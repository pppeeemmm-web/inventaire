import type { CalendarEventDraft, UpsertResult } from '@/lib/calendar/types'

const GOOGLE_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token'
const SCOPE = 'https://www.googleapis.com/auth/calendar.events'

function clientId(): string {
  const id = process.env.GOOGLE_CALENDAR_CLIENT_ID
  if (!id) throw new Error('GOOGLE_CALENDAR_CLIENT_ID is not set')
  return id
}

function clientSecret(): string {
  const s = process.env.GOOGLE_CALENDAR_CLIENT_SECRET
  if (!s) throw new Error('GOOGLE_CALENDAR_CLIENT_SECRET is not set')
  return s
}

export function googleAuthUrl(state: string, redirectUri: string): string {
  const u = new URL(GOOGLE_AUTH)
  u.searchParams.set('client_id', clientId())
  u.searchParams.set('redirect_uri', redirectUri)
  u.searchParams.set('response_type', 'code')
  u.searchParams.set('scope', SCOPE)
  u.searchParams.set('access_type', 'offline')
  u.searchParams.set('prompt', 'consent')
  u.searchParams.set('state', state)
  return u.toString()
}

export async function exchangeGoogleCode(
  code: string,
  redirectUri: string,
): Promise<{ refresh_token?: string; access_token: string; expires_in: number; scope: string }> {
  const body = new URLSearchParams({
    code,
    client_id: clientId(),
    client_secret: clientSecret(),
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  })
  const res = await fetch(GOOGLE_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  const json = (await res.json()) as Record<string, unknown>
  if (!res.ok) {
    throw new Error(String(json.error_description || json.error || 'Google token exchange failed'))
  }
  return json as { refresh_token?: string; access_token: string; expires_in: number; scope: string }
}

export async function refreshGoogleAccessToken(refreshToken: string): Promise<{ access_token: string }> {
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: clientId(),
    client_secret: clientSecret(),
    grant_type: 'refresh_token',
  })
  const res = await fetch(GOOGLE_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  const json = (await res.json()) as Record<string, unknown>
  if (!res.ok) {
    throw new Error(String(json.error_description || json.error || 'Google refresh failed'))
  }
  return { access_token: String(json.access_token) }
}

function eventBody(draft: CalendarEventDraft) {
  return {
    summary: draft.summary,
    description: draft.description,
    location: draft.location || undefined,
    start: { date: draft.startDate },
    end: { date: draft.endExclusive },
  }
}

export async function upsertGoogleEvent(
  accessToken: string,
  draft: CalendarEventDraft,
  existingId: string | null,
  etag: string | null,
): Promise<UpsertResult> {
  const cal = 'primary'

  if (existingId) {
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal)}/events/${encodeURIComponent(existingId)}`
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    }
    if (etag) headers['If-Match'] = etag
    const res = await fetch(url, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(eventBody(draft)),
    })
    if (res.ok) {
      const j = (await res.json()) as { id: string; etag?: string }
      return { externalEventId: j.id, etag: j.etag ?? null }
    }
    if (res.status !== 404 && res.status !== 412) {
      const j = (await res.json()) as { error?: { message?: string } }
      throw new Error(j.error?.message || 'Google update event failed')
    }
  }

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal)}/events`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(eventBody(draft)),
    },
  )
  const j = (await res.json()) as { id?: string; etag?: string; error?: { message?: string } }
  if (!res.ok) throw new Error(j.error?.message || 'Google create event failed')
  return { externalEventId: String(j.id), etag: j.etag ?? null }
}

export async function deleteGoogleEvent(accessToken: string, eventId: string): Promise<void> {
  const cal = 'primary'
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal)}/events/${encodeURIComponent(eventId)}`
  const res = await fetch(url, { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } })
  if (res.status === 404) return
  if (!res.ok) {
    const t = await res.text()
    throw new Error(t || 'Google delete event failed')
  }
}
