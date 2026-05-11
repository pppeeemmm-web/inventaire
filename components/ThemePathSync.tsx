'use client'

import { useEffect, useLayoutEffect } from 'react'
import { usePathname } from 'next/navigation'
import { resolveDocumentTheme, type PemTheme } from '@/lib/theme-path'

function applyTheme(theme: PemTheme) {
  document.documentElement.setAttribute('data-theme', theme)
}

export function ThemePathSync() {
  const pathname = usePathname() ?? ''

  useLayoutEffect(() => {
    let stored: string | null
    try {
      stored = localStorage.getItem('pem_theme')
    } catch {
      stored = null
    }
    applyTheme(resolveDocumentTheme(pathname, stored))
  }, [pathname])

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== 'pem_theme') return
      let stored: string | null
      try {
        stored = localStorage.getItem('pem_theme')
      } catch {
        stored = null
      }
      applyTheme(resolveDocumentTheme(pathname, stored))
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [pathname])

  return null
}
