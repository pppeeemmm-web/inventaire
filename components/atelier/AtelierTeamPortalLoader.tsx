'use client'

import dynamic from 'next/dynamic'
import { useI18n } from '@/lib/i18n/context'
import type { TeamPortalClientProps } from '@/components/atelier/team-portal-types'
import { InlineSpinner } from '@/components/ui/InlineSpinner'

/** The splash renders inside the root layout's <I18nProvider> (no `dict` here: it would ship FR + EN to the browser). */
function AtelierBootSplash() {
  const { t } = useI18n()
  const label = t('loadingAtelier')
  return (
    <div
      data-testid="atelier-boot-splash"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--bg0)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--tx3)',
      }}
      className="t-mono-sm"
    >
      <span className="row gap-sm" style={{ alignItems: 'center' }}>
        <InlineSpinner size={14} />
        <span>{label}</span>
      </span>
    </div>
  )
}

/** Must live in a Client Component — next/dynamic + ssr:false is forbidden in Server Components */
const TeamPortalClient = dynamic(
  () => import('@/components/atelier/TeamPortalClient').then((m) => ({ default: m.TeamPortalClient })),
  {
    ssr: false,
    loading: () => <AtelierBootSplash />,
  },
)

export function AtelierTeamPortalLoader(props: TeamPortalClientProps) {
  return <TeamPortalClient {...props} />
}
