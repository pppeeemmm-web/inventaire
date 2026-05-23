import { AtelierTeamPortalLoader } from '@/components/atelier/AtelierTeamPortalLoader'
import { loadAtelierShellProps } from '@/lib/atelier/load-atelier-shell-props'

export const dynamic = 'force-dynamic'

/** Shared portal shell — persists across segment tab navigations (no remount). */
export default async function AtelierPortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const props = await loadAtelierShellProps({ shellPersistsAcrossTabs: true })
  return (
    <>
      <AtelierTeamPortalLoader {...props} />
      {children}
    </>
  )
}
