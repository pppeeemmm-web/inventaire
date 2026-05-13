import type { CalendarEventDraft, UpsertResult } from '@/lib/calendar/types'

function tenant(): string {
  return (process.env.MICROSOFT_CALENDAR_TENANT || 'common').trim()
}

function authBase(): string {
  return `https://login.microsoftonline.com/${encodeURIComponent(tenant())}/oauth2/v2.0`
}

function clientId(): string {
  const id = process.env.MICROSOFT_CALENDAR_CLIENT_ID
  if (!id) throw new Error('MICROSOFT_CALENDAR_CLIENT_ID is not set')
  return id
}

function clientSecret(): string {
  const s = process.env.MICROSOFT_CALENDAR_CLIENT_SECRET
  if (!s) throw new Error('MICROSOFT_CALENDAR_CLIENT_SECRET is not set')
  return s
}

const MS_SCOPE = ['offline_access', 'Calendars.ReadWrite', 'User.Read'].join(' ')

export function microsoftAuthUrl(state: string, redirectUri: string): string {
  const u = new URL(`${authBase()}/authorize`)
  u.searchParams.set('client_id', clientId())
  u.searchParams.set('response_type', 'code')
  u.searchParams.set('redirect_uri', redirectUri)
  u.searchParams.set('response_mode', 'query')
  u.searchParams.set('scope', MS_SCOPE)
  u.searchParams.set('state', state)
  return u.toString()
}

export async function exchangeMicrosoftCode(
  code: string,
  redirectUri: string,
): Promise<{ refresh_token?: string; access_token: string; expires_in: number; scope?: string; tenant?: string }> {
  const body = new URLSearchParams({
    client_id: clientId(),
    client_secret: clientSecret(),
    code,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
    scope: MS_SCOPE,
  })
  const res = await fetch(`${authBase()}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  const json = (await res.json()) as Record<string, unknown>
  if (!res.ok) {
    throw new Error(String(json.error_description || json.error || 'Microsoft token exchange failed'))
  }
  return json as {
    refresh_token?: string
    access_token: string
    expires_in: number
    scope?: string
  }
}

export async function refreshMicrosoftAccessToken(refreshToken: string): Promise<{ access_token: string }> {
  const body = new URLSearchParams({
    client_id: clientId(),
    client_secret: clientSecret(),
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
    scope: MS_SCOPE,
  })
  const res = await fetch(`${authBase()}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  const json = (await res.json()) as Record<string, unknown>
  if (!res.ok) {
    throw new Error(String(json.error_description || json.error || 'Microsoft refresh failed'))
  }
  return { access_token: String(json.access_token) }
}

function graphBody(draft: CalendarEventDraft) {
  return {
    subject: draft.summary,
    body: { contentType: 'text', content: draft.description },
    location: draft.location ? { displayName: draft.location } : undefined,
    isAllDay: true,
    start: { dateTime: `${draft.startDate}T00:00:00.0000000`, timeZone: 'UTC' },
    end: { dateTime: `${draft.endExclusive}T00:00:00.0000000`, timeZone: 'UTC' },
  }
}

export async function upsertMicrosoftEvent(
  accessToken: string,
  draft: CalendarEventDraft,
  existingId: string | null,
  etag: string | null,
): Promise<UpsertResult> {
  if (existingId) {
    const url = `https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(existingId)}`
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    }
    if (etag) headers['If-Match'] = etag
    const res = await fetch(url, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(graphBody(draft)),
    })
    if (res.ok) {
      const j = (await res.json()) as { id: string; '@odata.etag'?: string }
      return { externalEventId: j.id, etag: j['@odata.etag'] ?? null }
    }
    if (res.status !== 404 && res.status !== 412) {
      const j = (await res.json()) as { error?: { message?: string } }
      throw new Error(j.error?.message || 'Microsoft update event failed')
    }
  }

  const res = await fetch('https://graph.microsoft.com/v1.0/me/events', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(graphBody(draft)),
  })
  const j = (await res.json()) as { id?: string; '@odata.etag'?: string; error?: { message?: string } }
  if (!res.ok) throw new Error(j.error?.message || 'Microsoft create event failed')
  return { externalEventId: String(j.id), etag: j['@odata.etag'] ?? null }
}

export async function deleteMicrosoftEvent(accessToken: string, eventId: string): Promise<void> {
  const url = `https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(eventId)}`
  const res = await fetch(url, { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } })
  if (res.status === 404) return
  if (!res.ok) {
    const t = await res.text()
    throw new Error(t || 'Microsoft delete event failed')
  }
}
