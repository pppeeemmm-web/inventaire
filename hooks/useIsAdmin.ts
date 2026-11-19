'use client'

// Is the signed-in user an admin (`is_admin()` RPC)? Asked once per page load and shared by every caller: contact
// pickers use it to hide « Privé » contacts from the team (pickableContacts, Pem 2026-11-19). False until known, so a
// team member never glimpses a private contact; an admin's private contacts appear a moment later. Sign-out reloads
// the page (AccountActions), which drops the cached answer.

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

let cached: boolean | null = null
let pending: Promise<boolean> | null = null

function askIsAdmin(): Promise<boolean> {
  if (cached !== null) return Promise.resolve(cached)
  pending ??= (async () => {
    try {
      const { data } = await createClient().rpc('is_admin')
      cached = !!data
      return cached
    } catch (e) {
      // Unknown → not admin (pickers stay filtered); asked again on the next call.
      console.error('[useIsAdmin]', e)
      pending = null
      return false
    }
  })()
  return pending
}

export function useIsAdmin(): boolean {
  const [isAdmin, setIsAdmin] = useState(cached ?? false)
  useEffect(() => {
    let alive = true
    void askIsAdmin().then((v) => {
      if (alive) setIsAdmin(v)
    })
    return () => {
      alive = false
    }
  }, [])
  return isAdmin
}
