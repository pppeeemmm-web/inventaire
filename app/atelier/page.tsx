// Team portal — loads all reference data server-side, hands off to the
// fully-interactive client shell (tabs, constellation, drawer, etc.)
import { createClient } from '@/lib/supabase/server'
import { fetchAtelierOverviewBootstrap } from '@/app/atelier/atelier-data-actions'
import { getUnreadReminderCountCached, listUnreadSuiviReminders } from '@/app/atelier/reminders-actions'
import { AtelierTeamPortalLoader } from '@/components/atelier/AtelierTeamPortalLoader'
import type { Oeuvre, SuiviReminderListRow } from '@/lib/types/database'
import type { AtelierOverviewBootstrap } from '@/components/atelier/team-portal-types'

/** Junction tables must always reflect DB after edits (theme/group removals, batch, etc.) */
export const dynamic = 'force-dynamic'

/** First œuvres chunk (keyset continuation via `fetchOeuvresKeysetPage`). */
const ATELIER_OEUVRE_PAGE = 1000

/** PostgREST default max rows per response — paginate for full junction payloads */
const SUPABASE_RANGE_PAGE = 1000

async function fetchAllOeuvreThemeLinks(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<{ oeuvre_id: number; theme_id: number }[]> {
  const rows: { oeuvre_id: number; theme_id: number }[] = []
  for (let from = 0; ; from += SUPABASE_RANGE_PAGE) {
    const { data, error } = await supabase
      .from('oeuvre_theme')
      .select('oeuvre_id, theme_id')
      .order('oeuvre_id', { ascending: true })
      .order('theme_id', { ascending: true })
      .range(from, from + SUPABASE_RANGE_PAGE - 1)
    if (error) {
      console.error('[atelier loader] oeuvre_theme:', error.message)
      break
    }
    if (!data?.length) break
    rows.push(...(data as { oeuvre_id: number; theme_id: number }[]))
    if (data.length < SUPABASE_RANGE_PAGE) break
  }
  return rows
}

async function fetchAllWorkingGroupWorkLinks(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<{ group_id: string; oeuvre_id: number }[]> {
  const rows: { group_id: string; oeuvre_id: number }[] = []
  for (let from = 0; ; from += SUPABASE_RANGE_PAGE) {
    const { data, error } = await supabase
      .from('working_group_work')
      .select('group_id, oeuvre_id')
      .order('oeuvre_id', { ascending: true })
      .order('group_id', { ascending: true })
      .range(from, from + SUPABASE_RANGE_PAGE - 1)
    if (error) {
      console.error('[atelier loader] working_group_work:', error.message)
      break
    }
    if (!data?.length) break
    rows.push(...(data as { group_id: string; oeuvre_id: number }[]))
    if (data.length < SUPABASE_RANGE_PAGE) break
  }
  return rows
}

export default async function AtelierPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  let initialReminderUnread = 0
  let initialReminders: SuiviReminderListRow[] = []
  if (user?.id != null) {
    ;[initialReminderUnread, initialReminders] = await Promise.all([
      getUnreadReminderCountCached(user.id),
      listUnreadSuiviReminders(100),
    ])
  }

  const overviewYear = new Date().getFullYear()
  let initialOverviewBootstrap: AtelierOverviewBootstrap = {
    expenseTotalTtc: 0,
    upcomingPulse: [],
    overviewCalendarEvents: [],
    burningConcepts: [],
  }
  if (user?.id != null) {
    initialOverviewBootstrap = await fetchAtelierOverviewBootstrap(overviewYear, initialReminders)
  }

  let initialPendingReviewCount = 0
  const { data: isAdminOnLoad } = await supabase.rpc('is_admin')
  if (isAdminOnLoad) {
    const { count: pendCount } = await supabase
      .from('pending_changes')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')
    initialPendingReviewCount = pendCount ?? 0
  }

  const { count: oeuvreTotalCountRaw, error: oeCountErr } = await supabase
    .from('Oeuvres')
    .select('OeuvreID', { count: 'exact', head: true })
    .is('deleted_at', null)
  if (oeCountErr) console.error('[atelier loader] Oeuvres count:', oeCountErr.message)
  const oeuvreTotalCount = oeuvreTotalCountRaw ?? 0

  /** Reference tables + first œuvres chunk in one round-trip; optional per-tab lazy split deferred (architecture.md). */
  const queryLabels = [
    'Oeuvres', 'Technique', 'Support', 'Format', 'theme', 'Contact',
    'OeuvreStatus', 'working_group', 'tblPresentation',
  ] as const
  const [results, oeuvreThemeRows, workingGroupWorkRows] = await Promise.all([
    Promise.all([
      supabase
        .from('Oeuvres')
        .select('OeuvreID, Titre, Technique, Support, "Année", Format, Hauteur, Largeur, Profondeur, Exposable, broadcast_ready, broadcast_caption_seed, Prix, PrixFinal, Discount, statusId, "Catalogué", txtImageNameLink, ContactID, LocalisationID, LocalisationDetail, is_public, Encadree, IsCommission, PresentationID, ReturnDate, DateLivraison, AcheteurID, NeedsPhotograph, anonymity_level, admin_override_anonymity')
        .is('deleted_at', null)
        .order('OeuvreID', { ascending: false })
        .limit(ATELIER_OEUVRE_PAGE),
      supabase.from('Technique').select('TechniqueID, Technique').order('TechniqueID'),
      supabase.from('Support').select('SupportID, Support').order('SupportID'),
      supabase.from('Format').select('FormatID, Format').order('FormatID'),
      supabase.from('theme').select('id, name').order('id'),
      supabase.from('Contact').select('ContactID, NomInstitution, Nom, "Prénom", Role, Ville, Pays').order('ContactID'),
      supabase.from('OeuvreStatus').select('id, label').order('id'),
      supabase.from('working_group').select('id, name, created_at').order('created_at', { ascending: false }).limit(100),
      supabase.from('tblPresentation').select('PresentationID, Nom').order('PresentationID'),
    ]),
    fetchAllOeuvreThemeLinks(supabase),
    fetchAllWorkingGroupWorkLinks(supabase),
  ])

  // Surface query errors to the server console so silent RLS / schema regressions don't render as empty tabs.
  results.forEach((r, i) => {
    if (r?.error) console.error(`[atelier loader] ${queryLabels[i]}:`, r.error.message)
  })

  const oeuvres: Oeuvre[] = Array.isArray(results[0]?.data)
    ? results[0]!.data.flatMap((row) => (typeof row === 'object' && row != null ? [row as unknown as Oeuvre] : []))
    : []
  const oeuvresPaging =
    oeuvres.length < oeuvreTotalCount
      ? {
          totalCount: oeuvreTotalCount,
          nextCursor: oeuvres.length > 0 ? oeuvres[oeuvres.length - 1]!.OeuvreID : null,
          pageSize: ATELIER_OEUVRE_PAGE,
        }
      : undefined

  const techniques     = results[1]?.data
  const supports       = results[2]?.data
  const formats        = results[3]?.data
  const themes         = results[4]?.data
  const contacts       = results[5]?.data
  const statuses       = results[6]?.data
  const groups         = results[7]?.data
  const presentations  = results[8]?.data

  // Build a flat id→label map for fast status lookups on the client
  const statusLabelMap: Record<number, string> = {}
  for (const s of (statuses ?? []) as { id: number; label: string }[]) statusLabelMap[s.id] = s.label

  // Build per-theme public/total counts for the Public tab warning
  const oeuvreIsPublic: Record<number, boolean> = {}
  for (const o of (oeuvres ?? []) as { OeuvreID: number; is_public: boolean }[])
    oeuvreIsPublic[o.OeuvreID] = o.is_public ?? false

  const themePublicStats: Record<number, { total: number; pub: number }> = {}
  const themeAllWorks: Record<number, number[]> = {}

  const oeuvreThemeIdsByOeuvre: Record<number, number[]> = {}
  const oeuvreGroupIdsByOeuvre: Record<number, string[]> = {}

  const themeWorkCount: Record<number, number> = {}
  const groupWorkCount: Record<string, number> = {}
  const themeToGroups:  Record<number, Set<string>> = {}
  const groupToThemes:  Record<string, Set<number>> = {}
  const groupAllWorks:  Record<string, number[]> = {}

  /** Bulk-loaded œuvre IDs — junction rows pointing elsewhere are skipped (matches legacy ThemeWork guard). */
  const oeuvreMap: Record<number, true> = {}
  for (const o of (oeuvres ?? []) as { OeuvreID: number }[]) oeuvreMap[o.OeuvreID] = true

  // Canonical oeuvre_theme junction
  for (const row of oeuvreThemeRows) {
    if (!oeuvreMap[row.oeuvre_id]) continue
    if (!themePublicStats[row.theme_id]) themePublicStats[row.theme_id] = { total: 0, pub: 0 }
    themePublicStats[row.theme_id].total++
    themeWorkCount[row.theme_id] = (themeWorkCount[row.theme_id] ?? 0) + 1
    if (oeuvreIsPublic[row.oeuvre_id]) themePublicStats[row.theme_id].pub++
    if (!themeAllWorks[row.theme_id]) themeAllWorks[row.theme_id] = []
    themeAllWorks[row.theme_id].push(row.oeuvre_id)

    if (!oeuvreThemeIdsByOeuvre[row.oeuvre_id]) oeuvreThemeIdsByOeuvre[row.oeuvre_id] = []
    oeuvreThemeIdsByOeuvre[row.oeuvre_id].push(row.theme_id)
  }

  // Canonical working_group_work junction
  for (const row of workingGroupWorkRows) {
    if (!oeuvreMap[row.oeuvre_id]) continue
    groupWorkCount[row.group_id] = (groupWorkCount[row.group_id] ?? 0) + 1
    if (!groupAllWorks[row.group_id]) groupAllWorks[row.group_id] = []
    groupAllWorks[row.group_id].push(row.oeuvre_id)

    if (!oeuvreGroupIdsByOeuvre[row.oeuvre_id]) oeuvreGroupIdsByOeuvre[row.oeuvre_id] = []
    oeuvreGroupIdsByOeuvre[row.oeuvre_id].push(row.group_id)

    // Cross-link relationships
    if (oeuvreThemeIdsByOeuvre[row.oeuvre_id]) {
      for (const tId of oeuvreThemeIdsByOeuvre[row.oeuvre_id]) {
        if (!themeToGroups[tId]) themeToGroups[tId] = new Set()
        themeToGroups[tId].add(row.group_id)
        if (!groupToThemes[row.group_id]) groupToThemes[row.group_id] = new Set()
        groupToThemes[row.group_id].add(tId)
      }
    }
  }

  // Convert Sets to arrays for transport
  const t2g: Record<number, string[]> = {}
  for (const [k, v] of Object.entries(themeToGroups)) t2g[Number(k)] = Array.from(v)
  const g2t: Record<string, number[]> = {}
  for (const [k, v] of Object.entries(groupToThemes)) g2t[k] = Array.from(v)

  return (
    <AtelierTeamPortalLoader
      initialPendingReviewCount={initialPendingReviewCount}
      initialReminderUnread={initialReminderUnread}
      initialReminders={initialReminders}
      initialOverviewBootstrap={initialOverviewBootstrap}
      oeuvresPaging={oeuvresPaging}
      oeuvres={oeuvres ?? []}
      techniques={techniques ?? []}
      supports={supports ?? []}
      formats={formats ?? []}
      themes={themes ?? []}
      contacts={contacts ?? []}
      statusLabelMap={statusLabelMap}
      initialGroups={(groups ?? [] as { id: string; name: string; created_at: string }[]).map((g) => ({ id: g.id, name: g.name }))}
      presentations={presentations ?? []}
      themePublicStats={themePublicStats}
      themePrivateWorks={themeAllWorks}
      themeWorkCount={themeWorkCount}
      groupWorkCount={groupWorkCount}
      groupPrivateWorks={groupAllWorks}
      oeuvreThemeIdsByOeuvre={oeuvreThemeIdsByOeuvre}
      oeuvreGroupIdsByOeuvre={oeuvreGroupIdsByOeuvre}
      themeToGroups={t2g}
      groupToThemes={g2t}
    />
  )
}

