import { requireSession } from '@/lib/require-session'
import { InternalSessionChrome } from '@/components/shared/InternalSessionChrome'

export default async function GalerieLayout({ children }: { children: React.ReactNode }) {
  await requireSession()
  return <InternalSessionChrome>{children}</InternalSessionChrome>
}
