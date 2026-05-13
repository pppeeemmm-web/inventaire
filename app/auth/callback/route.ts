// Auth callback — exchanges the PKCE code (OAuth + magic link) for a session.
// Cookies MUST be attached to the same NextResponse as the redirect, otherwise
// the session never reaches the browser and protected routes loop back to /login.
//
// Flow: signInWithOAuth / signInWithOtp → … → /auth/callback?code=xxx&next=/hub

import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

function safeNext(param: string | null): string {
  const fallback = '/hub'
  if (!param || !param.startsWith('/') || param.startsWith('//')) return fallback
  return param
}

/** Public origin the browser used (Vercel: prefer x-forwarded-* over internal request URL). */
function publicOrigin(request: NextRequest): string {
  const xfHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
  const xfProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() || 'https'
  if (xfHost) return `${xfProto}://${xfHost}`
  return request.nextUrl.origin
}

export async function GET(request: NextRequest) {
  const url    = new URL(request.url)
  const code   = url.searchParams.get('code')
  const next   = safeNext(url.searchParams.get('next'))
  const origin = publicOrigin(request)

  if (code) {
    let response = NextResponse.redirect(`${origin}${next}`)

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
    return NextResponse.redirect(`${origin}/login?error=auth`)
  }

  return NextResponse.redirect(`${origin}${next}`)
}
