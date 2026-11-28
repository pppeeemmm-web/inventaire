'use client'

// Floating « ⚑ » on every phone screen (ReviewTool.md step 5; Pem 2026-11-28: « something you can call from any
// place that comes on top … otherwise, if I have to switch screens, I'll lose the flow »). One tap opens the review
// sheet over the screen in use; the screen stays underneath, its address and build go with the report. It sits
// above the bottom chrome (`--pem-bottom-chrome-h`), under every sheet and modal. The sheet's code loads on tap only.
import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { PEM_Z_INDEX } from '@/components/shared/BottomStack'

const PhoneReviewSheet = dynamic(() => import('@/components/atelier/review/ReviewWindow').then((m) => m.PhoneReviewSheet), { ssr: false })

export function PhoneReviewFab() {
  const { t } = useI18n()
  const narrow = useMediaQuery('(max-width: 767px)')
  const [open, setOpen] = useState(false)
  // `?review=1` opens the sheet at once — what the iPhone's triple back-tap Shortcut opens (Pem 2026-11-28); the
  // parameter is taken out of the address so a reload does not open it again.
  useEffect(() => {
    const url = new URL(window.location.href)
    if (url.searchParams.get('review') !== '1') return
    url.searchParams.delete('review')
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
    setOpen(true)
  }, [])
  if (!narrow) return null
  return (
    <>
      {open ? null : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t('review_open')}
          title={t('review_open')}
          data-testid="phone-review-fab"
          style={{
            position: 'fixed',
            right: 'max(10px, env(safe-area-inset-right, 0px))',
            // Same rule as the toasts (globals.css): above the bar when there is one, else above the home indicator.
            bottom: 'calc(12px + max(var(--pem-bottom-chrome-h, 0px), env(safe-area-inset-bottom, 0px)))',
            zIndex: PEM_Z_INDEX.mobileActionBar + 1,
            width: 44,
            height: 44,
            borderRadius: 22,
            border: '1px solid var(--bd)',
            background: 'color-mix(in srgb, var(--bg1) 88%, transparent)',
            color: 'var(--tx)',
            boxShadow: '0 2px 10px rgba(0,0,0,.25)',
            fontSize: 18,
            lineHeight: 1,
            cursor: 'pointer',
          }}
        >
          ⚑
        </button>
      )}
      {open ? <PhoneReviewSheet onClose={() => setOpen(false)} /> : null}
    </>
  )
}
