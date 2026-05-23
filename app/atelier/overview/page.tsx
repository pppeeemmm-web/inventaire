import { AtelierTeamPortalLoader } from '@/components/atelier/AtelierTeamPortalLoader'
import { loadAtelierShellProps } from '@/lib/atelier/load-atelier-shell-props'

export const dynamic = 'force-dynamic'

export default async function AtelierOverviewPage() {
  const props = await loadAtelierShellProps({ routeTab: 'overview' })
  return <AtelierTeamPortalLoader {...props} />
}
