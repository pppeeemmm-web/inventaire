import { redirect } from 'next/navigation'
import { AtelierTeamPortalLoader } from '@/components/atelier/AtelierTeamPortalLoader'
import { loadAtelierShellProps } from '@/lib/atelier/load-atelier-shell-props'
import { legacyTabRedirectPath } from '@/lib/atelier/tab-routes'

export const dynamic = 'force-dynamic'

type SearchParams = Promise<{ tab?: string; map?: string; work?: string; batch?: string }>

export default async function AtelierPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const segmentRedirect = legacyTabRedirectPath(params.tab)
  if (segmentRedirect) redirect(segmentRedirect)

  const props = await loadAtelierShellProps()
  return <AtelierTeamPortalLoader {...props} />
}
