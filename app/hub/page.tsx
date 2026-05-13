// Hub home — server component fetches stats, client shell handles lang + nav.
import { createClient } from '@/lib/supabase/server'
import { HubHomeClient } from '@/components/hub/HubHomeClient'

function mapHubLogRow(l: Record<string, unknown>, feedSource: 'audit' | 'studio') {
  return {
    id: l.id as number,
    action: l.action as string,
    details: l.details as string | null,
    type: l.type as string | null,
    status: l.status as string | null,
    priority: l.priority as string | null,
    event_type: (l.event_type ?? null) as string | null,
    table_name: (l.table_name ?? null) as string | null,
    row_id: (l.row_id ?? null) as string | null,
    metadata: l.metadata as unknown,
    created_at: l.created_at as string,
    feedSource,
  }
}

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
    { data: auditFeedRaw },
    { data: taskFeedRaw },
  ] = await Promise.all([
    supabase.from('Oeuvres').select('*', { count: 'exact', head: true }).is('deleted_at', null),
    supabase
      .from('Oeuvres')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null)
      .gte('Année', yearStart),
    supabase
      .from('Oeuvres')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null)
      .eq('is_public', true),
    supabase
      .from('Oeuvres')
      .select('OeuvreID, txtImageNameLink')
      .is('deleted_at', null)
      .not('txtImageNameLink', 'is', null)
      .order('OeuvreID', { ascending: false })
      .limit(32),
    supabase
      .from('stock_item')
      .select('*', { count: 'exact', head: true })
      .filter('quantity', 'lte', 'min_stock'),
    supabase
      .from('suivi_process')
      .select('id, nom, statut, created_at')
      .order('created_at', { ascending: false })
      .limit(12),
    supabase
      .from('concept')
      .select('id, titre, energie, medium')
      .not('statut', 'eq', 'archived')
      .order('created_at', { ascending: false })
      .limit(8),
    supabase
      .from('system_log')
      .select('id, created_at, action, details, type, status, priority, event_type, table_name, row_id, metadata')
      .not('action', 'is', null)
      .not('event_type', 'is', null)
      .neq('event_type', 'ATELIER_VIEW')
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('studio_task')
      .select('id, created_at, action, details, type, status, priority')
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  const auditFeed = (auditFeedRaw ?? []).map((l) => mapHubLogRow(l as Record<string, unknown>, 'audit'))
  const taskFeed = (taskFeedRaw ?? []).map((l) => mapHubLogRow(l as Record<string, unknown>, 'studio'))

  return (
    <HubHomeClient
      stats={{
        total: total ?? 0,
        thisYear: thisYear ?? 0,
        stockAlerts: stockAlerts ?? 0,
        publicWorks: publicWorks ?? 0,
      }}
      recentImages={recentImages ?? []}
      recentProcess={(recentProcess ?? []).map((p: { id: number; nom: string; statut: string; created_at: string }) => ({
        id: p.id,
        label: p.nom,
        status: p.statut,
        created_at: p.created_at
      }))}
      burningIdeas={(burningIdeas ?? []).map((i: { id: number; titre: string; energie: number | null; medium: string | null }) => ({
        id: i.id,
        title: i.titre,
        energy: i.energie,
        medium: i.medium
      }))}
      auditFeed={auditFeed}
      taskFeed={taskFeed}
    />
  )
}
