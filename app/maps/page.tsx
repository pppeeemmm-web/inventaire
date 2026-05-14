import type { Metadata } from 'next'
import { listConstellationMaps } from '@/app/atelier/constellation/actions'
import { MapsIndexClient } from '@/components/maps/MapsIndexClient'
import { routeMetadata } from '@/lib/i18n/route-metadata'

export const metadata: Metadata = routeMetadata('maps', 'en')

export const dynamic = 'force-dynamic'

export default async function MapsPage() {
  const result = await listConstellationMaps()
  const maps = 'ok' in result ? result.maps : []
  const listError = 'error' in result ? result.error : null
  return <MapsIndexClient maps={maps} listError={listError} />
}
