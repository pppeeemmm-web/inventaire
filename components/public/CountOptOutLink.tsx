'use client'

import { useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { isPublicCountingOptedOut, setPublicCountingOptedOut } from '@/lib/public-visitor-id'

/**
 * « Ne pas être compté·e » / « Don't count me » (legal A.2 n° 5). Sets a localStorage flag and drops the
 * visitor id; `trackPublicView` (lib/track-public.ts) then records nothing from this browser.
 * Footer link on the public site until the cookie page carries the switch.
 */
export default function CountOptOutLink() {
  const { t } = useI18n()
  // Read after mount: the server has no localStorage, so the first paint is the default.
  const [optedOut, setOptedOut] = useState(false)
  useEffect(() => { setOptedOut(isPublicCountingOptedOut()) }, [])

  return (
    <button
      type="button"
      onClick={() => {
        const next = !optedOut
        setPublicCountingOptedOut(next)
        setOptedOut(next)
      }}
      title={t(optedOut ? 'pub_count_optout_on_title' : 'pub_count_optout_title')}
      aria-pressed={optedOut}
      style={{
        background: 'none',
        border: 'none',
        padding: '0 8px',
        minHeight: 44,
        display: 'inline-flex',
        alignItems: 'center',
        font: 'inherit',
        letterSpacing: 'inherit',
        textTransform: 'inherit',
        color: 'inherit',
        textDecoration: 'underline',
        textUnderlineOffset: 3,
        cursor: 'pointer',
      }}
    >
      {t(optedOut ? 'pub_count_optout_on' : 'pub_count_optout')}
    </button>
  )
}
