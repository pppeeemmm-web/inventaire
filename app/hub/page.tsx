// Hub home — thin launcher redirecting into Atelier tab rooms.
// Executive dashboard lives at /atelier?tab=overview (canonical).
import { HubLauncherClient } from '@/components/hub/HubLauncherClient'
import { getFieldPulseData } from '@/app/atelier/field-inbox/data'

export default async function HubPage() {
  const fieldPulse = await getFieldPulseData()
  return <HubLauncherClient fieldPulse={fieldPulse} />
}
