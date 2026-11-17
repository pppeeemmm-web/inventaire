'use client'

import { useEffect, useState } from 'react'
import { openReadOr } from '@/lib/atelier/open-reads'
import { drawerOpenKey } from '@/lib/atelier/open-read-keys'
import { getReturnWindowHintForOeuvre, type SaleReturnHint } from '@/app/atelier/(portal)/sales/cooling-off-actions'
import { useI18n } from '@/lib/i18n/context'
import { useCaption } from './WorkCardCaption'

export function SaleReturnWindowBanner({ oeuvreId }: { oeuvreId: number }) {
  const { t } = useI18n()
  const [hint, setHint] = useState<SaleReturnHint | null | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const h = await openReadOr(drawerOpenKey.returnHint(oeuvreId), () => getReturnWindowHintForOeuvre(oeuvreId))
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

  // R3: a warning chip in the top block (sold works only), its caption on hover / long-press.
  const text = hint.skipped
    ? t('wf_return_window_skipped')
    : !hint.startsAt
      ? t('wf_return_window_no_start')
      : t('wf_return_window_banner_fmt').replace(/\{days\}/g, String(hint.daysLeft ?? 0))
  const live = !hint.skipped && !!hint.startsAt
  return <ReturnWindowChip text={text} live={live} caption={t('wc_return_window_tt')} />
}

function ReturnWindowChip({ text, live, caption }: { text: string; live: boolean; caption: string }) {
  const { bind, node } = useCaption(caption)
  return (
    <>
      <span
        data-testid="work-card-return-window"
        tabIndex={0}
        {...bind}
        style={{
          display: 'inline-block',
          padding: '3px 9px',
          fontSize: 12,
          lineHeight: 1.3,
          color: live ? 'var(--yellow)' : 'var(--tx2)',
          border: `1px solid ${live ? 'var(--yellow)' : 'var(--bd2)'}`,
          borderRadius: 12,
          overflowWrap: 'anywhere',
          cursor: 'help',
          WebkitTouchCallout: 'none',
        }}
      >
        {text}
      </span>
      {node}
    </>
  )
}
