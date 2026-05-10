import { requireSession } from '@/lib/require-session'

export default async function HubLayout({ children }: { children: React.ReactNode }) {
  await requireSession()
  return <>{children}</>
}
