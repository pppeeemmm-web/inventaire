// Supabase auth session refresh middleware.
// Keeps the auth token alive on every request — required for SSR auth.
// Auth gating for private apps uses layout.tsx + redirect() so React Flight / Server Actions
// never receive an HTML redirect from middleware (that causes "unexpected response").
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

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

    // Dev-only auto-login: when no session and credentials are present in env,
    // sign in transparently so the preview iframe doesn't have to traverse OAuth.
    // NEVER triggers in production (env vars must be absent there).
    if (
      !user &&
      isDocNav &&
      isProtected &&
      !isAuthRoute &&
      process.env.NODE_ENV === 'development' &&
      process.env.DEV_AUTO_LOGIN_EMAIL &&
      process.env.DEV_AUTO_LOGIN_PASSWORD
    ) {
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: process.env.DEV_AUTO_LOGIN_EMAIL,
        password: process.env.DEV_AUTO_LOGIN_PASSWORD,
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
