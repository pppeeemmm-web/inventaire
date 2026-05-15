'use client'

import Link from 'next/link'
import type { CSSProperties } from 'react'
import { useI18n } from '@/lib/i18n/context'

/** Ring B — return to `/hub` field launchpad from standalone field verb pages. */
export function FieldHubBackLink({
  className = 'btn ghost',
  style,
}: {
  className?: string
  style?: CSSProperties
}) {
  const { t } = useI18n()
  return (
    <Link
      href="/hub"
      data-testid="field-hub-back"
      className={className}
      style={{
        minHeight: 44,
        marginTop: 12,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        ...style,
      }}
    >
      {t('field_stub_cta_hub')}
    </Link>
  )
}
