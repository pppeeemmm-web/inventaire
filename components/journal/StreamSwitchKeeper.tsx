'use client'

import { useEffect } from 'react'
import { JOURNAL_STREAM_COOKIE } from '@/lib/journal/stream-switch'

/**
 * Keeps the Journal stream switch: `?stream=0` (old day screens) or `?stream=1` (the stream) is stored for a
 * year, then the address is cleaned. Mounted on both faces, so `?stream=0` sticks on the old screens too.
 */
export function JournalStreamSwitchKeeper() {
  useEffect(() => {
    const url = new URL(window.location.href)
    const v = url.searchParams.get('stream')
    if (v !== '1' && v !== '0') return
    document.cookie = `${JOURNAL_STREAM_COOKIE}=${v}; path=/; max-age=31536000; samesite=lax`
    url.searchParams.delete('stream')
    window.history.replaceState(window.history.state, '', url.toString())
  }, [])
  return null
}
