'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { dict, type Lang } from '@/lib/i18n/dictionary'
import type { TeamPortalClientProps } from '@/components/atelier/team-portal-types'
import { InlineSpinner } from '@/components/ui/InlineSpinner'

/** next/dynamic `loading` can render outside <I18nProvider>; mirror provider lang sync. */
function AtelierBootSplash() {
  const [lang, setLang] = useState<Lang>('fr')
  useEffect(() => {
    const stored = localStorage.getItem('pem_lang') as Lang | null
    if (stored === 'fr' || stored === 'en') setLang(stored)
  }, [])
  const label = dict[lang].loadingAtelier
  return (
    <div
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
