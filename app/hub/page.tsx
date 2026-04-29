// Hub home — server component fetches stats, client shell handles lang + nav.
import { createClient } from '@/lib/supabase/server'
import { HubHomeClient } from '@/components/hub/HubHomeClient'

export default async function HubPage() {
  const supabase = await createClient()

  const currentYear = new Date().getFullYear()
  const yearStart   = `${currentYear}-01-01`

  const [
    { count: total },
    { count: thisYear },
    { data: recentImages },
  ] = await Promise.all([
    supabase.from('Oeuvres').select('*', { count: 'exact', head: true }),
    supabase
      .from('Oeuvres')
      .select('*', { count: 'exact', head: true })
      .gte('Année', yearStart),
    supabase
      .from('Oeuvres')
      .select('OeuvreID, txtImageNameLink')
      .not('txtImageNameLink', 'is', null)
      .order('OeuvreID', { ascending: false })
      .limit(24),
  ])

  return (
    <HubHomeClient
      stats={{ total: total ?? 0, thisYear: thisYear ?? 0 }}
      recentImages={recentImages ?? []}
    />
  )
}
