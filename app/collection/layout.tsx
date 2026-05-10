import { requireSession } from '@/lib/require-session'

export default async function CollectionLayout({ children }: { children: React.ReactNode }) {
  await requireSession()
  return <>{children}</>
}
