import { requireSession } from '@/lib/require-session'
import { AtelierSWRegistrar } from '@/lib/sw-install/AtelierSWRegistrar'
import { InternalSessionChrome } from '@/components/shared/InternalSessionChrome'

export default async function HubLayout({ children }: { children: React.ReactNode }) {
  await requireSession()
  return (
    <InternalSessionChrome>
      <AtelierSWRegistrar />
      {children}
    </InternalSessionChrome>
  )
}
