// Auth callback — exchanges the PKCE code delivered by Supabase magic links
// for a real session, then redirects to the intended destination.
//
// Flow:
//   signInWithOtp → email → user clicks link
//   → /auth/callback?code=xxx&next=/atelier
//   → this route exchanges code → sets session cookies → redirect next

import { NextResponse } from 'next/server'
import { createClient }  from '@/lib/supabase/server'

export async function GET(request: Request) {
  const url      = new URL(request.url)
  const code     = url.searchParams.get('code')
  const next     = url.searchParams.get('next') ?? '/atelier'
  const origin   = url.origin

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
    // Code exchange failed — send back to login with hint
    return NextResponse.redirect(`${origin}/login?error=auth`)
  }

  // No code — just redirect (handles implicit-flow tokens set client-side)
  return NextResponse.redirect(`${origin}${next}`)
}
