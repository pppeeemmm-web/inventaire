'use client'

import dynamic from 'next/dynamic'
import type { TeamPortalClientProps } from '@/components/atelier/team-portal-types'

/** Must live in a Client Component — next/dynamic + ssr:false is forbidden in Server Components */
const TeamPortalClient = dynamic(
  () => import('@/components/atelier/TeamPortalClient').then((m) => ({ default: m.TeamPortalClient })),
  {
    ssr: false,
    loading: () => (
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
        Chargement Atelier...
      </div>
    ),
  },
)

export function AtelierTeamPortalLoader(props: TeamPortalClientProps) {
  return <TeamPortalClient {...props} />
}
