'use server'

import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/types/supabase.generated'
import type { ContactAddress } from '@/components/atelier/contact-editor-types'
import type { AtelierOverviewBootstrap, TeamPortalClientProps } from '@/components/atelier/team-portal-types'
import {
  computePipelinePulseItems,
  type PulseEtape,
  type PulseProcess,
} from '@/lib/pipeline-deadlines'
import { buildPipelineCalendarEvents } from '@/lib/pipeline-calendar'
import type {
  ConceptBurningRow,
  SuiviEtapePulseRow,
  SuiviProcessPulseRow,
  SuiviReminderListRow,
} from '@/lib/types/database'
import {
  deriveAtelierJunctionState,
  fetchOeuvrePublicFlagsForIds,
  fetchOeuvreThemeLinksForOeuvreIds,
  fetchWorkingGroupWorkLinksForOeuvreIds,
  type AtelierJunctionDerived,
} from '@/lib/atelier/atelier-junction-bootstrap'

function buildPulseProcesses(
  procs: SuiviProcessPulseRow[],
  etapes: SuiviEtapePulseRow[],
): PulseProcess[] {
  const etapeMap: Record<string, PulseEtape[]> = {}
  for (const e of etapes) {
    if (!etapeMap[e.process_id]) etapeMap[e.process_id] = []
    etapeMap[e.process_id].push({
      id: e.id,
      nom: e.nom,
      statut: e.statut,
      date_echeance: e.date_echeance,
      overdue_override: e.overdue_override ?? false,
    })
  }
  return procs.map((p) => ({
    id: p.id,
    nom: p.nom,
    type: p.type,
    statut: p.statut,
    date_fin: p.date_fin,
    deadline_time: p.deadline_time,
    etapes: etapeMap[p.id] ?? [],
  }))
}

/** Expense + pipeline pulse + calendar events + burning concepts for Atelier overview (RSC bootstrap). */
export async function fetchAtelierOverviewBootstrap(
  fiscalYear: number,
  reminders: SuiviReminderListRow[],
  /** Reuse an RSC-scoped client to skip a second `createServerClient` in the same request. */
  client?: SupabaseClient<Database>,
): Promise<AtelierOverviewBootstrap> {
  const supabase = client ?? (await createClient())

  const [expRes, proRes, etRes, conceptRes] = await Promise.all([
    supabase.from('expense').select('montant_ttc').eq('fiscal_year', fiscalYear),
    supabase
      .from('suivi_process')
      .select('id, nom, type, date_fin, deadline_time, statut')
      .not('statut', 'in', '("perdu","annule","termine")'),
    supabase
      .from('suivi_etape')
      .select('id, process_id, nom, statut, date_echeance, overdue_override, position')
      .order('position'),
    supabase
      .from('concept')
      .select('id, titre, energie')
      .gte('energie', 4)
      .not('statut', 'eq', 'abandonne')
      .not('statut', 'eq', 'devenu_oeuvre')
      .order('energie', { ascending: false })
      .limit(5),
  ])

  if (expRes.error) console.error('[atelier overview] expense:', expRes.error.message)
  if (proRes.error) console.error('[atelier overview] suivi_process:', proRes.error.message)
  if (etRes.error) console.error('[atelier overview] suivi_etape:', etRes.error.message)
  if (conceptRes.error) console.error('[atelier overview] concept:', conceptRes.error.message)

  const expenseRows = (expRes.data ?? []) as { montant_ttc: number | null }[]
  const expenseTotalTtc = expenseRows.reduce((s, e) => s + (e.montant_ttc ?? 0), 0)

  const procs = (proRes.data ?? []) as SuiviProcessPulseRow[]
  const etapes = (etRes.data ?? []) as SuiviEtapePulseRow[]
  const processes = buildPulseProcesses(procs, etapes)

  const reminderInputs = reminders.map((r) => ({
    id: r.id,
    message: r.message,
    remind_at: r.remind_at,
    process_id: r.process_id,
    lu: r.lu,
  }))

  return {
    expenseTotalTtc,
    upcomingPulse: computePipelinePulseItems(processes).slice(0, 8),
    overviewCalendarEvents: buildPipelineCalendarEvents(processes, reminderInputs),
    burningConcepts: (conceptRes.data ?? []) as ConceptBurningRow[],
  }
}

/**
 * Theme + working-group junction rows for the given œuvre IDs (post–first-paint;
 * RSC no longer scans full `oeuvre_theme` / `working_group_work` tables).
 */
export async function fetchAtelierJunctionHydrationForOeuvreIds(
  oeuvreIds: number[],
): Promise<{ ok: true; data: AtelierJunctionDerived } | { ok: false; error: string }> {
  const uniq = [...new Set(oeuvreIds)].filter((id) => Number.isFinite(id) && id > 0)
  if (uniq.length === 0) {
    return { ok: true, data: deriveAtelierJunctionState([], [], []) }
  }
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: 'unauthenticated' }

    const [flags, themeRows, groupRows] = await Promise.all([
      fetchOeuvrePublicFlagsForIds(supabase, uniq),
      fetchOeuvreThemeLinksForOeuvreIds(supabase, uniq),
      fetchWorkingGroupWorkLinksForOeuvreIds(supabase, uniq),
    ])
    const works = uniq.map((id) => ({
      OeuvreID: id,
      is_public: flags.get(id) ?? false,
    }))
    return { ok: true, data: deriveAtelierJunctionState(works, themeRows, groupRows) }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export type AtelierContactBootstrapRow = TeamPortalClientProps['contacts'][number]

export type AtelierShellPostPaintPayload = {
  contacts: AtelierContactBootstrapRow[]
  addresses: ContactAddress[]
  techniques: TeamPortalClientProps['techniques']
  supports: TeamPortalClientProps['supports']
  formats: TeamPortalClientProps['formats']
  themes: TeamPortalClientProps['themes']
  statuses: { id: number; label: string }[]
  groups: { id: string; name: string; created_at: string }[]
  presentations: TeamPortalClientProps['presentations']
}

/**
 * Deferred Atelier lookups (post–first-paint): contacts, addresses, and catalogue reference tables
 * in one server round-trip (`Promise.all` on a single Supabase client).
 */
export async function fetchAtelierShellPostPaint(
  client?: SupabaseClient<Database>,
): Promise<AtelierShellPostPaintPayload> {
  const supabase = client ?? (await createClient())
  const queryLabels = [
    'Contact',
    'contact_addresses',
    'Technique',
    'Support',
    'Format',
    'theme',
    'OeuvreStatus',
    'working_group',
    'tblPresentation',
  ] as const
  const [
    contactRes,
    addrRes,
    techRes,
    supRes,
    fmtRes,
    themeRes,
    statusRes,
    grpRes,
    presRes,
  ] = await Promise.all([
    supabase.from('Contact').select('ContactID, NomInstitution, Nom, "Prénom", Role, Ville, Pays').order('ContactID'),
    supabase
      .from('contact_addresses')
      .select('id, contact_id, label, adresse, code_postal, ville, pays, position, shipping_notes')
      .order('position'),
    supabase.from('Technique').select('TechniqueID, Technique').order('TechniqueID'),
    supabase.from('Support').select('SupportID, Support').order('SupportID'),
    supabase.from('Format').select('FormatID, Format').order('FormatID'),
    supabase.from('theme').select('id, name').order('id'),
    supabase.from('OeuvreStatus').select('id, label').order('id'),
    supabase.from('working_group').select('id, name, created_at').order('created_at', { ascending: false }).limit(100),
    supabase.from('tblPresentation').select('PresentationID, Nom').order('PresentationID'),
  ])
  ;[contactRes, addrRes, techRes, supRes, fmtRes, themeRes, statusRes, grpRes, presRes].forEach((r, i) => {
    if (r?.error) console.error(`[atelier shell post-paint] ${queryLabels[i]}:`, r.error.message)
  })
  return {
    contacts: (contactRes.data ?? []) as AtelierContactBootstrapRow[],
    addresses: (addrRes.data ?? []) as ContactAddress[],
    techniques: (techRes.data ?? []) as TeamPortalClientProps['techniques'],
    supports: (supRes.data ?? []) as TeamPortalClientProps['supports'],
    formats: (fmtRes.data ?? []) as TeamPortalClientProps['formats'],
    themes: (themeRes.data ?? []) as TeamPortalClientProps['themes'],
    statuses: (statusRes.data ?? []) as { id: number; label: string }[],
    groups: (grpRes.data ?? []) as { id: string; name: string; created_at: string }[],
    presentations: (presRes.data ?? []) as TeamPortalClientProps['presentations'],
  }
}

/** @deprecated Prefer `fetchAtelierShellPostPaint` when loading both slices. */
export async function fetchAtelierContacts(
  client?: SupabaseClient<Database>,
): Promise<AtelierContactBootstrapRow[]> {
  return (await fetchAtelierShellPostPaint(client)).contacts
}

/** @deprecated Prefer `fetchAtelierShellPostPaint` when loading both slices. */
export async function fetchAtelierContactAddresses(
  client?: SupabaseClient<Database>,
): Promise<ContactAddress[]> {
  return (await fetchAtelierShellPostPaint(client)).addresses
}
