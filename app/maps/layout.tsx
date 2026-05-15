import { requireSession } from '@/lib/require-session'
import { InternalSessionChrome } from '@/components/shared/InternalSessionChrome'

export default async function MapsLayout({ children }: { children: React.ReactNode }) {
  await requireSession()
  return <InternalSessionChrome>{children}</InternalSessionChrome>
}
