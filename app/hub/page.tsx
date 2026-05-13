// Hub home — thin launcher redirecting into Atelier tab rooms.
// Executive dashboard lives at /atelier?tab=overview (canonical).
import { HubLauncherClient } from '@/components/hub/HubLauncherClient'

export default function HubPage() {
  return <HubLauncherClient />
}
