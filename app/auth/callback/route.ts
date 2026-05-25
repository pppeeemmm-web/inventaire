// Auth callback — exchanges the PKCE code (Google OAuth) for a session.
// Cookies MUST be attached to the same NextResponse as the redirect, otherwise
// the session never reaches the browser and protected routes loop back to /login.
//
// Flow: signInWithOAuth or resetPasswordForEmail → … → /auth/callback?code=xxx&next=/hub|/login/reset-password

import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { requestPublicOrigin } from '@/lib/request-public-origin'

function safeNext(param: string | null): string {
  const fallback = '/hub'
  if (!param || !param.startsWith('/') || param.startsWith('//')) return fallback
  return param
}

export async function GET(request: NextRequest) {
  const url    = new URL(request.url)
  const code   = url.searchParams.get('code')
  const next   = safeNext(url.searchParams.get('next'))
  const origin = requestPublicOrigin(request)

  if (code) {
    let response = NextResponse.redirect(`${origin}${next}`)
    response.headers.set('Cache-Control', 'private, no-store, max-age=0, must-revalidate')

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

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return response
    }

    console.error('[auth/callback] exchangeCodeForSession:', error.message)
    const errRes = NextResponse.redirect(`${origin}/login?error=auth`)
    errRes.headers.set('Cache-Control', 'private, no-store, max-age=0, must-revalidate')
    return errRes
  }

  const done = NextResponse.redirect(`${origin}${next}`)
  done.headers.set('Cache-Control', 'private, no-store, max-age=0, must-revalidate')
  return done
}
