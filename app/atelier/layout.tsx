import { requireSession } from '@/lib/require-session'
import { AtelierOfflineFlush } from '@/components/mobile/AtelierOfflineFlush'
import { AtelierSWRegistrar } from '@/lib/sw-install/AtelierSWRegistrar'
import { InternalSessionChrome } from '@/components/shared/InternalSessionChrome'

export default async function AtelierLayout({ children }: { children: React.ReactNode }) {
  await requireSession()
  return (
    <InternalSessionChrome>
      <AtelierSWRegistrar />
      <AtelierOfflineFlush />
      {children}
    </InternalSessionChrome>
  )
}
