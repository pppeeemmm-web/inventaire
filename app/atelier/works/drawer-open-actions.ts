'use server'

// Work card open (TODO 18, owner GO 2026-11-16): the drawer's sections used to read one after
// another (8–10 Server Actions, Next runs them in sequence, 3.5–7 s to settle). This is the one
// read the card makes when a work opens; sections take their slice via `lib/atelier/open-reads.ts`
// and keep calling their own action for reloads after an edit. Reads only; each action keeps its guard.

import { listWorkDrawerImages, loadOeuvreLongText } from '@/app/atelier/works/actions'
import { listWorkLinks } from '@/app/atelier/works/work-link-actions'
import { listLinkedVoiceNotes } from '@/app/atelier/(portal)/notes/actions'
import { listConditionReports } from '@/app/atelier/works/condition-actions'
import { listWorkSessionsForOeuvre } from '@/app/atelier/session/actions'
import { fetchWorkSessionLocations } from '@/app/atelier/works/period-source-actions'
import { getWorkDescription } from '@/app/atelier/works/description-actions'
import { fetchWorkCost } from '@/app/atelier/(portal)/fiscal/cost-actions'
import { getReturnWindowHintForOeuvre } from '@/app/atelier/(portal)/sales/cooling-off-actions'
import { drawerOpenKey as k, type DrawerOpenOptions, type OpenReadBundle } from '@/lib/atelier/open-read-keys'
import { runOpenReads } from '@/lib/atelier/open-read-server'

export async function loadWorkDrawerOpen(oeuvreId: number, opts: DrawerOpenOptions): Promise<OpenReadBundle> {
  if (!Number.isInteger(oeuvreId) || oeuvreId <= 0) return {}
  const id = oeuvreId
  const jobs: [string, () => Promise<unknown>][] = [
    [k.images(id), () => listWorkDrawerImages(id)],
    [k.longText(id), () => loadOeuvreLongText(id)],
    [k.links(id), () => listWorkLinks(id)],
    [k.voiceNotes(id), () => listLinkedVoiceNotes('oeuvre_id', id)],
    [k.conditionReports(id), () => listConditionReports(id)],
    [k.sessions(id), () => listWorkSessionsForOeuvre(id)],
    [k.sessionLocations(id), () => fetchWorkSessionLocations(id)],
    [k.description(id), () => getWorkDescription(id)],
  ]
  // Only what the card will show: cost is admin-only, the return-window banner only on sold works.
  if (opts.cost) jobs.push([k.cost(id), () => fetchWorkCost(id)])
  if (opts.returnHint) jobs.push([k.returnHint(id), () => getReturnWindowHintForOeuvre(id)])
  return runOpenReads(jobs)
}
