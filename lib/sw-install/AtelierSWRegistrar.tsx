'use client'

import { useEffect } from 'react'
import { isChunkLoadError, PEM_CHUNK_RELOAD_KEY } from '@/lib/is-chunk-load-error'

/** Registers Serwist service worker in production (Slice 1). */
export function AtelierSWRegistrar() {
  useEffect(() => {
    sessionStorage.removeItem(PEM_CHUNK_RELOAD_KEY)

    const onChunkFailure = (reason: unknown) => {
      if (!isChunkLoadError(reason)) return
      if (sessionStorage.getItem(PEM_CHUNK_RELOAD_KEY) === '1') return
      sessionStorage.setItem(PEM_CHUNK_RELOAD_KEY, '1')
      window.location.reload()
    }

    const onError = (event: ErrorEvent) => onChunkFailure(event.error ?? event.message)
    const onRejection = (event: PromiseRejectionEvent) => onChunkFailure(event.reason)

    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)

    if (process.env.NODE_ENV !== 'production') {
      return () => {
        window.removeEventListener('error', onError)
        window.removeEventListener('unhandledrejection', onRejection)
      }
    }

    if (!('serviceWorker' in navigator)) {
      return () => {
        window.removeEventListener('error', onError)
        window.removeEventListener('unhandledrejection', onRejection)
      }
    }

    void (async () => {
      const { Serwist } = await import('@serwist/window')
      const serwist = new Serwist('/sw.js', { scope: '/' })
      await serwist.register()
    })().catch((err) => {
      console.warn('[AtelierSWRegistrar]', err)
    })

    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  return null
}
