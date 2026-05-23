import { AtelierTeamPortalLoader } from '@/components/atelier/AtelierTeamPortalLoader'
import { loadAtelierShellProps } from '@/lib/atelier/load-atelier-shell-props'

export const dynamic = 'force-dynamic'

export default async function AtelierBroadcastPage() {
  const props = await loadAtelierShellProps({ routeTab: 'broadcast' })
  return <AtelierTeamPortalLoader {...props} />
}
