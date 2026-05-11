'use client'

import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { normalizePemTheme, type PemTheme } from '@/lib/theme-path'

type Props = {
  /** When false, only emoji (narrow header / mobile drawer). */
  showLabels?: boolean
  /** Button horizontal padding (default matches Atelier bar). */
  padding?: string
}

export function PemThemeToggle({ showLabels = true, padding }: Props) {
  const pad = padding ?? (showLabels ? '4px 10px' : '4px 8px')
  const [theme, setTheme] = useState<PemTheme>('light')

  useLayoutEffect(() => {
    try {
      const raw = localStorage.getItem('pem_theme')
      if (raw) setTheme(normalizePemTheme(raw))
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem('pem_theme', theme)
    } catch {
      /* ignore */
    }
  }, [theme])

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== 'pem_theme') return
      setTheme(normalizePemTheme(e.newValue))
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const cycle = useCallback(() => {
    setTheme((t) => (t === 'dark' ? 'light' : t === 'light' ? 'standard' : 'dark'))
  }, [])

  return (
    <button
      type="button"
      onClick={cycle}
      style={{
        padding: pad,
        background: 'transparent',
        color: 'var(--tx2)',
        fontWeight: 600,
        borderRight: '1px solid var(--bd)',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 10,
        letterSpacing: 1,
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      {theme === 'dark' ? '🌙' : theme === 'light' ? '☀️' : '◼'}
      {showLabels && (
        <span>{theme === 'dark' ? 'NIGHT' : theme === 'light' ? 'DAY' : 'STD'}</span>
      )}
    </button>
  )
}
