import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { appOrigin } from '@/lib/calendar/app-origin'
import { exchangeMicrosoftCode } from '@/lib/calendar/microsoft-graph'
import { verifyOAuthState } from '@/lib/calendar/oauth-state'
import {
  decryptCalendarRefreshToken,
  encryptCalendarRefreshToken,
} from '@/lib/calendar/token-crypto'

function exhibitionsRedirect(origin: string, query: Record<string, string>) {
  const u = new URL(`${origin}/atelier`)
  u.searchParams.set('tab', 'exhibitions')
  for (const [k, v] of Object.entries(query)) u.searchParams.set(k, v)
  return NextResponse.redirect(u.toString())
}

function calendarFail(origin: string, code: string, logDetail?: string) {
  if (logDetail) console.warn('[calendar/microsoft/callback]', code, logDetail)
  return exhibitionsRedirect(origin, {
    calendar: 'microsoft_err',
    calendar_err_code: code,
  })
}

export async function GET(request: NextRequest) {
  const origin = appOrigin()
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const oauthErr = url.searchParams.get('error')

  let response = calendarFail(origin, 'init')

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (oauthErr) {
    response = calendarFail(origin, 'oauth', oauthErr)
    return response
  }
  if (!user) {
    response = calendarFail(origin, 'auth')
    return response
  }
  if (!code || !state) {
    response = calendarFail(origin, 'missing')
    return response
  }

  try {
    verifyOAuthState(state, user.id, 'microsoft')
  } catch (e) {
    console.warn('[calendar/microsoft/callback] oauth state verify failed', e)
    response = calendarFail(origin, 'state')
    return response
  }

  const redirectUri = `${origin}/api/calendar/microsoft/callback`
  const tenantConfigured = (process.env.MICROSOFT_CALENDAR_TENANT || 'common').trim()

  let refreshPlain = ''
  let scopeStr = ''
  try {
    const tokens = await exchangeMicrosoftCode(code, redirectUri)
    scopeStr = tokens.scope ?? ''
    refreshPlain = tokens.refresh_token ?? ''
    if (!refreshPlain) {
      const { data: ex } = await supabase
        .from('calendar_account' as never)
        .select('refresh_token_encrypted, token_salt')
        .eq('auth_user_id', user.id)
        .eq('provider', 'microsoft')
        .maybeSingle()
      const row = ex as { refresh_token_encrypted?: string; token_salt?: string | null } | null
      if (row?.refresh_token_encrypted) {
        refreshPlain = decryptCalendarRefreshToken(
          row.refresh_token_encrypted,
          row.token_salt,
        )
      }
    }
    if (!refreshPlain) {
      response = calendarFail(origin, 'refresh')
      return response
    }
  } catch (e) {
    console.warn('[calendar/microsoft/callback] token exchange', e)
    response = calendarFail(origin, 'token')
    return response
  }

  const { ciphertext, token_salt } = encryptCalendarRefreshToken(refreshPlain)
  const row = {
    auth_user_id: user.id,
    provider: 'microsoft' as const,
    tenant_id: tenantConfigured,
    refresh_token_encrypted: ciphertext,
    token_salt,
    scopes: scopeStr,
    primary_calendar_id: null as string | null,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase.from('calendar_account' as never).upsert(row as never, {
    onConflict: 'auth_user_id,provider',
  })
  if (error) {
    console.error('[calendar/microsoft/callback]', error.message)
    response = calendarFail(origin, 'db', error.message)
    return response
  }

  response = exhibitionsRedirect(origin, { calendar: 'microsoft_ok' })
  return response
}
