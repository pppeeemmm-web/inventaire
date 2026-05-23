import { AtelierTeamPortalLoader } from '@/components/atelier/AtelierTeamPortalLoader'
import { loadAtelierShellProps } from '@/lib/atelier/load-atelier-shell-props'

export const dynamic = 'force-dynamic'

export default async function AtelierNotesPage() {
  const props = await loadAtelierShellProps({ routeTab: 'notes' })
  return <AtelierTeamPortalLoader {...props} />
}
