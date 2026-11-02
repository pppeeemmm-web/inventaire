'use client'

// Access-style "Rapport" button: opens Studio → Rapports on this section's source.

import type { CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n/context'
import type { ReportSource } from '@/lib/reports/saved-report'

export function ReportLinkButton({ source, style }: { source: ReportSource; style?: CSSProperties }) {
  const { t } = useI18n()
  const router = useRouter()
  return (
    <button
      type="button"
      className="btn sm"
      data-testid={`open-report-${source}`}
      onClick={() => router.push(`/atelier/reports?source=${source}`)}
      title={t('prod_report_btn_title')}
      style={{ minHeight: 44, whiteSpace: 'nowrap', flexShrink: 0, ...style }}
    >
      {t('prod_report_btn')}
    </button>
  )
}
