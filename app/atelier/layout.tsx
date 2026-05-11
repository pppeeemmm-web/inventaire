import { requireSession } from '@/lib/require-session'
import { AtelierOfflineFlush } from '@/components/mobile/AtelierOfflineFlush'

export default async function AtelierLayout({ children }: { children: React.ReactNode }) {
  await requireSession()
  return (
    <>
      <AtelierOfflineFlush />
      {children}
    </>
  )
}
