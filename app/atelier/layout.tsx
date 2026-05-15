import { requireSession } from '@/lib/require-session'
import { AtelierOfflineFlush } from '@/components/mobile/AtelierOfflineFlush'
import { InternalSessionChrome } from '@/components/shared/InternalSessionChrome'

export default async function AtelierLayout({ children }: { children: React.ReactNode }) {
  await requireSession()
  return (
    <InternalSessionChrome>
      <AtelierOfflineFlush />
      {children}
    </InternalSessionChrome>
  )
}
