// Supabase auth session refresh middleware.
// Keeps the auth token alive on every request — required for SSR auth.
// Auth gating for private apps uses layout.tsx + redirect() so React Flight / Server Actions
// never receive an HTML redirect from middleware (that causes "unexpected response").
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/** Same-origin path only (blocks open redirects). */
function safeRelativeNext(raw: string | null): string | null {
  if (raw == null || typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed.startsWith('/')) return null
  if (trimmed.startsWith('//') || trimmed.includes('://')) return null
  if (trimmed.includes('\\')) return null
  return trimmed
}

export async function middleware(request: NextRequest) {
  // Never touch Next internals / static assets (matcher should skip these; bail out hard if not).
  const p = request.nextUrl.pathname
  if (p.startsWith('/_next/') || p === '/favicon.ico') {
    return NextResponse.next({ request })
  }

  // Flight / RSC / prefetch / Server Actions: Supabase cookie refresh here can break the RSC
  // binary/text stream → client shows "An unexpected response was received from the server".
  // See Next.js + Supabase middleware discussions (refresh session on full navigations only).
  const h = request.headers
  if (h.has('RSC') || h.has('Next-Router-Prefetch')) {
    return NextResponse.next({ request })
  }

  // OAuth / magic-link return: let the route handler run exchangeCodeForSession alone.
  // Running getUser()/refresh here can race PKCE cookies and cause redirect loops to Google.
  if (p === '/auth/callback' || p.startsWith('/auth/callback/')) {
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }: { name: string; value: string }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }: { name: string; value: string; options: CookieOptions }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session — do not remove this line
  try {
    let { data: { user } } = await supabase.auth.getUser()

    // Auth gating: only redirect on real document navigations (never on RSC/SA),
    // otherwise Next can throw "unexpected response" for Flight streams.
    const accept = h.get('accept') ?? ''
    const secFetchDest = h.get('sec-fetch-dest') ?? ''
    const isDocNav =
      request.method === 'GET' &&
      (secFetchDest === 'document' || accept.includes('text/html'))

    const isProtected =
      p === '/atelier' || p.startsWith('/atelier/') ||
      p === '/hub' || p.startsWith('/hub/') ||
      p === '/galerie' || p.startsWith('/galerie/') ||
      p === '/collection' || p.startsWith('/collection/') ||
      p === '/maps' || p.startsWith('/maps/')

    const isAuthRoute =
      p === '/login' || p.startsWith('/login/') ||
      p === '/auth/callback' || p.startsWith('/auth/callback/')

    // Dev-only auto-login: env creds sign you in without OAuth.
    // - Protected URLs: session then continues to the page.
    // - /login: was never "protected", so previews/bookmarks hit the gate; redirect to ?next= or /hub.
    // NEVER triggers in production (env vars must be absent there).
    const devAutoLoginReady =
      process.env.NODE_ENV === 'development' &&
      Boolean(process.env.DEV_AUTO_LOGIN_EMAIL) &&
      Boolean(process.env.DEV_AUTO_LOGIN_PASSWORD)

    const tryDevLoginHere =
      devAutoLoginReady &&
      ((isProtected && !isAuthRoute) || p === '/login' || p.startsWith('/login/'))

    if (!user && isDocNav && tryDevLoginHere) {
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: process.env.DEV_AUTO_LOGIN_EMAIL!,
        password: process.env.DEV_AUTO_LOGIN_PASSWORD!,
      })
      if (signInErr) {
        const safeMsg = signInErr.message.replace(
          /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
          '[email]',
        )
        console.error('[middleware] dev auto-login failed:', safeMsg)
      } else {
        const refreshed = await supabase.auth.getUser()
        user = refreshed.data.user
        if (user && (p === '/login' || p.startsWith('/login/'))) {
          const dest =
            safeRelativeNext(request.nextUrl.searchParams.get('next')) ?? '/hub'
          const redir = NextResponse.redirect(new URL(dest, request.url))
          for (const c of supabaseResponse.cookies.getAll()) {
            redir.cookies.set(c.name, c.value)
          }
          return redir
        }
      }
    }

    if (!user && isDocNav && isProtected && !isAuthRoute) {
      const next = request.nextUrl.pathname + request.nextUrl.search
      const login = request.nextUrl.clone()
      login.pathname = '/login'
      login.searchParams.set('next', next)
      return NextResponse.redirect(login)
    }
  } catch (e) {
    console.error('[middleware] supabase.auth.getUser()', e)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    // Exclude all of `/_next/*` (not only `_next/static`) so dev chunks, CSS, Turbopack, etc.
    // never hit this middleware — avoids spurious 404s / broken RSC when new subpaths appear.
    '/((?!_next/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
