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
    { count: publicWorks },
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
      .select('*', { count: 'exact', head: true })
      .eq('is_public', true),
    supabase
      .from('Oeuvres')
      .select('OeuvreID, txtImageNameLink')
      .not('txtImageNameLink', 'is', null)
      .order('OeuvreID', { ascending: false })
      .limit(16),
    supabase
      .from('stock_item')
      .select('*', { count: 'exact', head: true })
      .filter('quantity', 'lte', 'min_stock'),
    supabase
      .from('suivi_process')
      .select('id, nom, statut, created_at')
      .order('created_at', { ascending: false })
      .limit(6),
    supabase
      .from('concept')
      .select('id, titre, energie, medium')
      .not('statut', 'eq', 'archived')
      .order('created_at', { ascending: false })
      .limit(4),
    supabase
      .from('system_log')
      .select('id, created_at, action, details, type, status, priority')
      .not('action', 'is', null)
      .order('created_at', { ascending: false })
      .limit(8),
  ])

  return (
    <HubHomeClient
      stats={{
        total: total ?? 0,
        thisYear: thisYear ?? 0,
        stockAlerts: stockAlerts ?? 0,
        publicWorks: publicWorks ?? 0,
      }}
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
      systemLogs={(systemLogs ?? []).map((l: any) => ({
        id:         l.id,
        action:     l.action as string,
        details:    l.details as string | null,
        type:       l.type   as string | null,
        status:     l.status as string | null,
        priority:   l.priority as string | null,
        created_at: l.created_at as string,
      }))}
    />
  )
}
