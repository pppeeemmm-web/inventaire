'use client'

import { useEffect } from 'react'

/** Registers Serwist service worker in production (Slice 1). */
export function AtelierSWRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return

    void (async () => {
      const { Serwist } = await import('@serwist/window')
      const serwist = new Serwist('/sw.js', { scope: '/' })
      await serwist.register()
    })().catch((err) => {
      console.warn('[AtelierSWRegistrar]', err)
    })
  }, [])

  return null
}
