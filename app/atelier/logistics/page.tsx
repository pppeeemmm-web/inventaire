import { AtelierTeamPortalLoader } from '@/components/atelier/AtelierTeamPortalLoader'
import { loadAtelierShellProps } from '@/lib/atelier/load-atelier-shell-props'

export const dynamic = 'force-dynamic'

export default async function AtelierLogisticsPage() {
  const props = await loadAtelierShellProps({ routeTab: 'logistics' })
  return <AtelierTeamPortalLoader {...props} />
}
