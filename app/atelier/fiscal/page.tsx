import { AtelierTeamPortalLoader } from '@/components/atelier/AtelierTeamPortalLoader'
import { loadAtelierShellProps } from '@/lib/atelier/load-atelier-shell-props'

export const dynamic = 'force-dynamic'

export default async function AtelierFiscalPage() {
  const props = await loadAtelierShellProps({ routeTab: 'fiscal' })
  return <AtelierTeamPortalLoader {...props} />
}
