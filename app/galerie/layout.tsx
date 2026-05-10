import { requireSession } from '@/lib/require-session'

export default async function GalerieLayout({ children }: { children: React.ReactNode }) {
  await requireSession()
  return <>{children}</>
}
