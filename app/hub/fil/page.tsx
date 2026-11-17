// R1 step 6 — the Fil on the phone (docs/design/2026-11-17/R1_InputsFeed.notes.md; PhoneToday.notes.md,
// phone 7): everything the team puts in, one swipe deck per section. Light route outside the Atelier
// shell, like /hub/today. The header and the input bar paint at once; the deck reads `listFil()` after
// first paint (same pattern as Hub Triage). `listFil()` is admin-only and says so (non-admin → message).
import { FilClient } from '@/components/hub/FilClient'

export const dynamic = 'force-dynamic'

export default function FilPage() {
  return <FilClient />
}
