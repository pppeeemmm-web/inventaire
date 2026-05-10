'use server'

import { logSystemEvent } from '@/lib/utils/logging'

/** Optional breadcrumb: opening a work in the drawer (dedupe per tab session in the client). */
export async function logAtelierOeuvreView(oeuvreId: number): Promise<void> {
  await logSystemEvent({
    eventType: 'ATELIER_VIEW',
    tableName: 'Oeuvres',
    rowId: oeuvreId,
    metadata: { source: 'drawer' },
  })
}
