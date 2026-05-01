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
    { count: stockAlerts },
    { data: recentProcess },
    { data: burningIdeas },
    { data: systemLogs },
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
    supabase
      .from('stock_item')
      .select('*', { count: 'exact', head: true })
      .filter('quantity', 'lte', 'min_stock'),
    supabase
      .from('suivi_process')
      .select('id, nom, statut, created_at')
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('concept')
      .select('id, titre, energie, medium')
      .not('statut', 'eq', 'archived')
      .order('created_at', { ascending: false })
      .limit(3),
    supabase
      .from('system_log')
      .select('*')
      .order('id', { ascending: false })
      .limit(4),
  ])

  return (
    <HubHomeClient
      stats={{ total: total ?? 0, thisYear: thisYear ?? 0, stockAlerts: stockAlerts ?? 0 }}
      recentImages={recentImages ?? []}
      recentProcess={(recentProcess ?? []).map((p: any) => ({
        id: p.id,
        label: p.nom,
        status: p.statut,
        created_at: p.created_at
      }))}
      burningIdeas={(burningIdeas ?? []).map((i: any) => ({
        id: i.id,
        title: i.titre,
        energy: i.energie,
        medium: i.medium
      }))}
      systemLogs={systemLogs ?? []}
    />
  )
}
