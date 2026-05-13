import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { appOrigin } from '@/lib/calendar/app-origin'
import { exchangeGoogleCode } from '@/lib/calendar/google-calendar'
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

/** Redirect with opaque calendar_err_code only — log sensitive detail server-side (prod-safe URLs). */
function calendarFail(
  origin: string,
  code: string,
  logDetail?: string,
) {
  if (logDetail) console.warn('[calendar/google/callback]', code, logDetail)
  return exhibitionsRedirect(origin, { calendar: 'google_err', calendar_err_code: code })
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
    verifyOAuthState(state, user.id, 'google')
  } catch {
    response = calendarFail(origin, 'state')
    return response
  }

  const redirectUri = `${origin}/api/calendar/google/callback`
  let refreshPlain = ''
  let scopeStr = ''
  try {
    const tokens = await exchangeGoogleCode(code, redirectUri)
    scopeStr = tokens.scope ?? ''
    refreshPlain = tokens.refresh_token ?? ''
    if (!refreshPlain) {
      const { data: ex } = await supabase
        .from('calendar_account' as never)
        .select('refresh_token_encrypted, token_salt')
        .eq('auth_user_id', user.id)
        .eq('provider', 'google')
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
    console.warn('[calendar/google/callback] token exchange', e)
    response = calendarFail(origin, 'token')
    return response
  }

  const { ciphertext, token_salt } = encryptCalendarRefreshToken(refreshPlain)
  const row = {
    auth_user_id: user.id,
    provider: 'google' as const,
    tenant_id: null as string | null,
    refresh_token_encrypted: ciphertext,
    token_salt,
    scopes: scopeStr,
    primary_calendar_id: 'primary',
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase.from('calendar_account' as never).upsert(row as never, {
    onConflict: 'auth_user_id,provider',
  })
  if (error) {
    console.error('[calendar/google/callback]', error.message)
    response = calendarFail(origin, 'db', error.message)
    return response
  }

  response = exhibitionsRedirect(origin, { calendar: 'google_ok' })
  return response
}
