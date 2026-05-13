'use client'

import { useEffect, useState } from 'react'
import { getReturnWindowHintForOeuvre, type SaleReturnHint } from '@/app/atelier/sales/actions'
import { useI18n } from '@/lib/i18n/context'

export function SaleReturnWindowBanner({ oeuvreId }: { oeuvreId: number }) {
  const { t } = useI18n()
  const [hint, setHint] = useState<SaleReturnHint | null | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const h = await getReturnWindowHintForOeuvre(oeuvreId)
        if (!cancelled) setHint(h)
      } catch {
        if (!cancelled) setHint(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [oeuvreId])

  if (hint === undefined || hint === null) return null

  if (hint.skipped) {
    return (
      <div
        style={{
          marginBottom: 14,
          padding: '10px 12px',
          fontSize: 12,
          color: 'var(--tx2)',
          border: '1px solid var(--bd)',
          borderRadius: 8,
          background: 'var(--bg2)',
        }}
      >
        {t('wf_return_window_skipped')}
      </div>
    )
  }

  if (!hint.startsAt) {
    return (
      <div
        style={{
          marginBottom: 14,
          padding: '10px 12px',
          fontSize: 12,
          color: 'var(--tx2)',
          border: '1px solid var(--bd)',
          borderRadius: 8,
          background: 'var(--bg2)',
        }}
      >
        {t('wf_return_window_no_start')}
      </div>
    )
  }

  return (
    <div
      style={{
        marginBottom: 14,
        padding: '10px 12px',
        fontSize: 12,
        color: 'var(--tx2)',
        border: '1px solid var(--dust)',
        borderRadius: 8,
        background: 'var(--dust)11',
      }}
    >
      {t('wf_return_window_banner_fmt').replace(/\{days\}/g, String(hint.daysLeft ?? 0))}
    </div>
  )
}
