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
    await supabase.auth.getUser()
  } catch (e) {
    console.error('[middleware] supabase.auth.getUser()', e)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|_next/webpack-hmr|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
