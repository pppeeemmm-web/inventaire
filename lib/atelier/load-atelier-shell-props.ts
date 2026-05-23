import { createClient } from '@/lib/supabase/server'
import { fetchAtelierOverviewBootstrap } from '@/app/atelier/atelier-data-actions'
import { getUnreadReminderCountCached, listUnreadSuiviReminders } from '@/app/atelier/reminders-actions'
import { emptyAtelierJunctionDerived } from '@/lib/atelier/atelier-junction-bootstrap'
import type { SegmentedAtelierTab } from '@/lib/atelier/tab-routes'
import type { Oeuvre, SuiviReminderListRow } from '@/lib/types/database'
import type { AtelierOverviewBootstrap, TeamPortalClientProps } from '@/components/atelier/team-portal-types'
import {
  ATELIER_CONTACTS_EMPTY,
  ATELIER_FORMATS_EMPTY,
  ATELIER_GROUPS_EMPTY,
  ATELIER_PRESENTATIONS_EMPTY,
  ATELIER_SUPPORTS_EMPTY,
  ATELIER_TECHNIQUES_EMPTY,
  ATELIER_THEMES_EMPTY,
} from '@/components/atelier/team-portal-types'

/** First œuvres chunk (keyset continuation via `fetchOeuvresKeysetPage`). */
const ATELIER_OEUVRE_PAGE = 50

const overviewDefault: AtelierOverviewBootstrap = {
  expenseTotalTtc: 0,
  upcomingPulse: [],
  overviewCalendarEvents: [],
  burningConcepts: [],
}

export type AtelierShellLoaderProps = TeamPortalClientProps & {
  routeTab?: SegmentedAtelierTab
  /** When true, layout owns the shell; tab comes from URL; client keeps catalogue across hops. */
  shellPersistsAcrossTabs?: boolean
}

/** Shared RSC loader for `/atelier` and segmented tab routes. */
export async function loadAtelierShellProps(
  opts?: { routeTab?: SegmentedAtelierTab; shellPersistsAcrossTabs?: boolean },
): Promise<AtelierShellLoaderProps> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const overviewYear = new Date().getFullYear()

  const reminderPromise: Promise<readonly [number, SuiviReminderListRow[]]> =
    user?.id != null
      ? Promise.all([getUnreadReminderCountCached(user.id), listUnreadSuiviReminders(100)])
      : Promise.resolve([0, []] as const)

  const queryLabels = ['Oeuvres.count', 'Oeuvres'] as const
  const catalogPromise = Promise.all([
    supabase.from('Oeuvres').select('OeuvreID', { count: 'exact', head: true }).is('deleted_at', null),
    supabase
      .from('Oeuvres')
      .select('OeuvreID, Titre, Technique, Support, "Année", Format, Hauteur, Largeur, Profondeur, Exposable, broadcast_ready, broadcast_caption_seed, Prix, PrixFinal, Discount, statusId, "Catalogué", txtImageNameLink, ContactID, LocalisationID, LocalisationDetail, is_public, Encadree, IsCommission, PresentationID, ReturnDate, DateLivraison, AcheteurID, NeedsPhotograph, anonymity_level, admin_override_anonymity')
      .is('deleted_at', null)
      .order('OeuvreID', { ascending: false })
      .limit(ATELIER_OEUVRE_PAGE),
  ])

  const [[initialReminderUnread, initialReminders], { data: isAdminOnLoad }, [oeCountRes, oeuvresRes]] =
    await Promise.all([reminderPromise, supabase.rpc('is_admin'), catalogPromise])

  const [initialOverviewBootstrap, pendingHead] = await Promise.all([
    user?.id != null
      ? fetchAtelierOverviewBootstrap(overviewYear, initialReminders, supabase)
      : Promise.resolve(overviewDefault),
    isAdminOnLoad
      ? supabase.from('pending_changes').select('id', { count: 'exact', head: true }).eq('status', 'pending')
      : Promise.resolve(null),
  ])
  const initialPendingReviewCount = pendingHead?.count ?? 0

  if (oeCountRes.error) console.error('[atelier loader] Oeuvres count:', oeCountRes.error.message)
  const oeuvreTotalCount = oeCountRes.count ?? 0

  const results = [oeuvresRes]
  results.forEach((r, i) => {
    if (r?.error) console.error(`[atelier loader] ${queryLabels[i + 1]}:`, r.error.message)
  })

  const oeuvres: Oeuvre[] = Array.isArray(results[0]?.data)
    ? results[0]!.data.flatMap((row) => (typeof row === 'object' && row != null ? [row as unknown as Oeuvre] : []))
    : []
  const oeuvresPaging =
    oeuvres.length < oeuvreTotalCount
      ? {
          totalCount: oeuvreTotalCount,
          nextCursor: oeuvres.length > 0 ? oeuvres[oeuvres.length - 1]!.OeuvreID : null,
          pageSize: 500,
        }
      : undefined

  const junctionBootstrap = emptyAtelierJunctionDerived()

  return {
    routeTab: opts?.routeTab,
    shellPersistsAcrossTabs: opts?.shellPersistsAcrossTabs,
    initialPendingReviewCount,
    initialReminderUnread,
    initialReminders,
    initialOverviewBootstrap,
    atelierShellNonce: 0,
    initialIsAdmin: !!isAdminOnLoad,
    oeuvresPaging,
    oeuvres: oeuvres ?? [],
    techniques: ATELIER_TECHNIQUES_EMPTY,
    supports: ATELIER_SUPPORTS_EMPTY,
    formats: ATELIER_FORMATS_EMPTY,
    themes: ATELIER_THEMES_EMPTY,
    contacts: ATELIER_CONTACTS_EMPTY,
    initialGroups: ATELIER_GROUPS_EMPTY,
    presentations: ATELIER_PRESENTATIONS_EMPTY,
    themePublicStats: junctionBootstrap.themePublicStats,
    themePrivateWorks: junctionBootstrap.themePrivateWorks,
    themeWorkCount: junctionBootstrap.themeWorkCount,
    groupWorkCount: junctionBootstrap.groupWorkCount,
    groupPrivateWorks: junctionBootstrap.groupPrivateWorks,
    oeuvreThemeIdsByOeuvre: junctionBootstrap.oeuvreThemeIdsByOeuvre,
    oeuvreGroupIdsByOeuvre: junctionBootstrap.oeuvreGroupIdsByOeuvre,
    themeToGroups: junctionBootstrap.themeToGroups,
    groupToThemes: junctionBootstrap.groupToThemes,
  }
}
