import { AtelierTeamPortalLoader } from '@/components/atelier/AtelierTeamPortalLoader'
import { loadAtelierShellProps } from '@/lib/atelier/load-atelier-shell-props'

export const dynamic = 'force-dynamic'

export default async function AtelierMapPage() {
  const props = await loadAtelierShellProps({ routeTab: 'map' })
  return <AtelierTeamPortalLoader {...props} />
}
