import { redirect } from 'next/navigation'
import { AtelierTeamPortalLoader } from '@/components/atelier/AtelierTeamPortalLoader'
import { loadAtelierShellProps } from '@/lib/atelier/load-atelier-shell-props'
import { legacyTabRedirectPath } from '@/lib/atelier/tab-routes'

export const dynamic = 'force-dynamic'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function AtelierPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const tab = typeof params.tab === 'string' ? params.tab : undefined
  const segmentRedirect = legacyTabRedirectPath(tab)
  if (segmentRedirect) {
    const qs = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) {
      if (k === 'tab' || v == null) continue
      if (Array.isArray(v)) v.forEach((x) => qs.append(k, x))
      else qs.set(k, v)
    }
    const q = qs.toString()
    redirect(q ? `${segmentRedirect}?${q}` : segmentRedirect)
  }

  const props = await loadAtelierShellProps()
  return <AtelierTeamPortalLoader {...props} />
}
