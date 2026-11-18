'use client'

// Phone header pieces shared by every phone screen (docs/design/2026-11-18/PhoneNav.notes.md, option A):
// ☰ opens the menu sheet at once, over the page (no Overview detour); « Aujourd'hui » is the one name
// of home. This file stays tiny: the sheet itself is its own chunk, fetched after first paint so the
// tap never waits on it and the light /hub routes keep their JS budget.
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useEffect, useState, type CSSProperties, type MouseEvent } from 'react'
import { useI18n } from '@/lib/i18n/context'

const PhoneMenuSheet = dynamic(() => import('@/components/shared/PhoneMenuSheet').then((m) => m.PhoneMenuSheet), { ssr: false })

/** Inside the Atelier, navigation goes through the shell's unsaved-changes guard. */
export type PhoneNavigate = (href: string) => void

const iconBtn: CSSProperties = {
  minWidth: 44, minHeight: 44, display: 'grid', placeItems: 'center', flex: 'none',
  fontSize: 20, lineHeight: 1, color: 'var(--tx)', background: 'none', border: 0, padding: 0, cursor: 'pointer',
}

export function PhoneMenuButton({ onNavigate, style }: { onNavigate?: PhoneNavigate; style?: CSSProperties }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  useEffect(() => {
    // The sheet's code, fetched once the page is idle.
    const id = window.setTimeout(() => void import('@/components/shared/PhoneMenuSheet'), 1200)
    return () => window.clearTimeout(id)
  }, [])
  return (
    <>
      <button type="button" aria-label={t('today_menu')} aria-expanded={open} data-testid="phone-menu-open" onClick={() => setOpen(true)} style={{ ...iconBtn, ...style }}>
        ☰
      </button>
      {open ? <PhoneMenuSheet onClose={() => setOpen(false)} onNavigate={onNavigate} /> : null}
    </>
  )
}

/** « ☀️ Aujourd'hui » chip, right of every phone header but the day itself (replaces « HUB »). */
export function PhoneHomeChip({ onNavigate }: { onNavigate?: PhoneNavigate }) {
  const { t } = useI18n()
  const go = (e: MouseEvent<HTMLAnchorElement>) => {
    if (!onNavigate) return
    e.preventDefault()
    onNavigate('/hub')
  }
  return (
    <Link
      href="/hub"
      onClick={go}
      data-testid="phone-home-chip"
      style={{
        minHeight: 44, display: 'inline-flex', alignItems: 'center', gap: 4, flex: 'none',
        padding: '0 10px', border: '1px solid var(--bd2)', borderRadius: 22,
        fontSize: 13, color: 'var(--tx2)', textDecoration: 'none', whiteSpace: 'nowrap',
      }}
    >
      <span aria-hidden="true" style={{ fontSize: 15 }}>☀️</span>
      {t('today_nav_today')}
    </Link>
  )
}
