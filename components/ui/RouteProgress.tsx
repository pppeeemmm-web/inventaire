'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

function isInternalNav(a: HTMLAnchorElement) {
  const href = a.getAttribute('href') || ''
  if (!href) return false
  if (href.startsWith('#')) return false
  if (href.startsWith('mailto:') || href.startsWith('tel:')) return false
  if (a.target && a.target !== '_self') return false
  if (a.hasAttribute('download')) return false
  return true
}

export function RouteProgress() {
  const pathname = usePathname() ?? ''
  const [active, setActive] = useState(false)
  const [pct, setPct] = useState(0)
  const lastPath = useRef(pathname)
  const timer = useRef<number | null>(null)
  const doneTimer = useRef<number | null>(null)

  const style = useMemo(
    () => ({
      transform: `scaleX(${Math.max(0, Math.min(1, pct / 100))})`,
      opacity: active ? 1 : 0,
    }),
    [pct, active],
  )

  function clearTimers() {
    if (timer.current != null) window.clearInterval(timer.current)
    if (doneTimer.current != null) window.clearTimeout(doneTimer.current)
    timer.current = null
    doneTimer.current = null
  }

  function start() {
    clearTimers()
    setActive(true)
    setPct(0)
    const startedAt = Date.now()
    timer.current = window.setInterval(() => {
      const t = Date.now() - startedAt
      // Ease up to ~82% while navigation is pending.
      const eased = 82 * (1 - Math.exp(-t / 420))
      setPct((p) => Math.max(p, Math.min(82, eased)))
    }, 50)
  }

  function finish() {
    clearTimers()
    setPct(100)
    doneTimer.current = window.setTimeout(() => {
      setActive(false)
      setPct(0)
    }, 220)
  }

  useEffect(() => {
    const onClick = (ev: MouseEvent) => {
      if (ev.defaultPrevented) return
      if (ev.button !== 0) return
      if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return

      const el = ev.target as HTMLElement | null
      const a = el?.closest?.('a') as HTMLAnchorElement | null
      if (!a) return
      if (!isInternalNav(a)) return

      const href = a.getAttribute('href') || ''
      // Same-page links should not show a progress bar.
      if (href && href === lastPath.current) return
      start()
    }

    const onPop = () => start()

    document.addEventListener('click', onClick, true)
    window.addEventListener('popstate', onPop)
    return () => {
      document.removeEventListener('click', onClick, true)
      window.removeEventListener('popstate', onPop)
      clearTimers()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (pathname === lastPath.current) return
    lastPath.current = pathname
    if (active) finish()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  return (
    <div className="pem-routeProgress" aria-hidden>
      <div className="pem-routeProgressBar" style={style} />
    </div>
  )
}

