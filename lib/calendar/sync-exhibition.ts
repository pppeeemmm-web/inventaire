import type { SupabaseClient } from '@supabase/supabase-js'
import {
  deleteGoogleEvent,
  refreshGoogleAccessToken,
  upsertGoogleEvent,
} from '@/lib/calendar/google-calendar'
import {
  deleteMicrosoftEvent,
  refreshMicrosoftAccessToken,
  upsertMicrosoftEvent,
} from '@/lib/calendar/microsoft-graph'
import type { CalendarEventDraft, CalendarProvider } from '@/lib/calendar/types'
import { decryptSecret } from '@/lib/calendar/token-crypto'

export type SyncLabels = {
  processSummary: (name: string) => string
  stepSummary: (processName: string, stepName: string) => string
  fieldLocation: string
  fieldUrl: string
  fieldNotes: string
}

function dateKey(d: string | null): string | null {
  if (!d) return null
  const s = String(d).trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const x = new Date(s)
  if (Number.isNaN(x.getTime())) return null
  return x.toISOString().slice(0, 10)
}

function addDays(ymd: string, n: number): string {
  const d = new Date(`${ymd}T12:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

function buildProcessRange(
  dateDebut: string | null,
  dateFin: string | null,
): { startDate: string; endExclusive: string } | null {
  const a = dateKey(dateDebut)
  const b = dateKey(dateFin)
  if (a && b) {
    if (a <= b) return { startDate: a, endExclusive: addDays(b, 1) }
    return { startDate: b, endExclusive: addDays(a, 1) }
  }
  if (a) return { startDate: a, endExclusive: addDays(a, 1) }
  if (b) return { startDate: b, endExclusive: addDays(b, 1) }
  return null
}

function buildDescription(
  labels: SyncLabels,
  lieu: string | null,
  url: string | null,
  notes: string | null,
): string {
  const lines: string[] = []
  if (lieu) lines.push(`${labels.fieldLocation}: ${lieu}`)
  if (url) lines.push(`${labels.fieldUrl}: ${url}`)
  if (notes) lines.push(`${labels.fieldNotes}:\n${notes}`)
  return lines.join('\n') || '—'
}

type AccountRow = {
  id: string
  provider: CalendarProvider
  refresh_token_encrypted: string
  tenant_id: string | null
}

type LinkRow = {
  id: string
  suivi_process_id: string | null
  suivi_etape_id: string | null
  external_event_id: string
  sync_etag: string | null
}

function linkKey(row: LinkRow): string {
  if (row.suivi_process_id) return `p:${row.suivi_process_id}`
  return `s:${row.suivi_etape_id ?? ''}`
}

async function accessForAccount(acc: AccountRow): Promise<string> {
  const refresh = decryptSecret(acc.refresh_token_encrypted)
  if (acc.provider === 'google') {
    const { access_token } = await refreshGoogleAccessToken(refresh)
    return access_token
  }
  const { access_token } = await refreshMicrosoftAccessToken(refresh)
  return access_token
}

async function upsertRemote(
  provider: CalendarProvider,
  access: string,
  draft: CalendarEventDraft,
  existingId: string | null,
  etag: string | null,
) {
  if (provider === 'google') return upsertGoogleEvent(access, draft, existingId, etag)
  return upsertMicrosoftEvent(access, draft, existingId, etag)
}

async function deleteRemote(provider: CalendarProvider, access: string, eventId: string) {
  if (provider === 'google') return deleteGoogleEvent(access, eventId)
  return deleteMicrosoftEvent(access, eventId)
}

export async function syncExhibitionProcess(
  supabase: SupabaseClient,
  userId: string,
  processId: string,
  labels: SyncLabels,
): Promise<{ ok: true; pushed: number } | { ok: false; message: string }> {
  const { data: accounts, error: accErr } = await supabase
    .from('calendar_account' as never)
    .select('id, provider, refresh_token_encrypted, tenant_id')
    .eq('auth_user_id', userId)

  if (accErr) return { ok: false, message: accErr.message }
  const accRows = (accounts ?? []) as AccountRow[]
  if (accRows.length === 0) return { ok: false, message: 'calendar_err_no_accounts' }

  const { data: proc, error: pErr } = await supabase
    .from('suivi_process')
    .select('id, nom, date_debut, date_fin, localisation, url, notes')
    .eq('id', processId)
    .maybeSingle()

  if (pErr || !proc) return { ok: false, message: 'calendar_err_not_found' }

  const p = proc as {
    id: string
    nom: string
    date_debut: string | null
    date_fin: string | null
    localisation: string | null
    url: string | null
    notes: string | null
  }

  const { data: steps, error: sErr } = await supabase
    .from('suivi_etape')
    .select('id, nom, date_echeance')
    .eq('process_id', processId)

  if (sErr) return { ok: false, message: sErr.message }
  const stepRows = (steps ?? []) as { id: string; nom: string; date_echeance: string | null }[]

  const desc = buildDescription(labels, p.localisation, p.url, p.notes)
  const processRange = buildProcessRange(p.date_debut, p.date_fin)
  const processDraft: CalendarEventDraft | null = processRange
    ? {
        summary: labels.processSummary(p.nom),
        description: desc,
        startDate: processRange.startDate,
        endExclusive: processRange.endExclusive,
        location: p.localisation,
      }
    : null

  const stepDrafts: { stepId: string; draft: CalendarEventDraft }[] = []
  for (const st of stepRows) {
    const dk = dateKey(st.date_echeance)
    if (!dk) continue
    stepDrafts.push({
      stepId: st.id,
      draft: {
        summary: labels.stepSummary(p.nom, st.nom),
        description: desc,
        startDate: dk,
        endExclusive: addDays(dk, 1),
        location: p.localisation,
      },
    })
  }

  const desiredKeys = new Set<string>()
  if (processDraft) desiredKeys.add(`p:${processId}`)
  for (const s of stepDrafts) desiredKeys.add(`s:${s.stepId}`)

  let pushed = 0

  for (const acc of accRows) {
    let access: string
    try {
      access = await accessForAccount(acc)
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : 'calendar_err_token' }
    }

    const { data: linkRows } = await supabase
      .from('calendar_event_link' as never)
      .select('id, suivi_process_id, suivi_etape_id, external_event_id, sync_etag')
      .eq('calendar_account_id', acc.id)
      .eq('auth_user_id', userId)

    const links = (linkRows ?? []) as LinkRow[]
    const stepIdSet = new Set(stepRows.map((s) => s.id))
    const relevant = links.filter(
      (row) =>
        row.suivi_process_id === processId ||
        (row.suivi_etape_id != null && stepIdSet.has(row.suivi_etape_id)),
    )

    for (const row of relevant) {
      const k = linkKey(row)
      if (!desiredKeys.has(k)) {
        try {
          await deleteRemote(acc.provider, access, row.external_event_id)
        } catch {
          /* ignore delete errors */
        }
        await supabase.from('calendar_event_link' as never).delete().eq('id', row.id)
      }
    }

    const { data: linkRowsAfter } = await supabase
      .from('calendar_event_link' as never)
      .select('id, suivi_process_id, suivi_etape_id, external_event_id, sync_etag')
      .eq('calendar_account_id', acc.id)
      .eq('auth_user_id', userId)

    const linksAfter = (linkRowsAfter ?? []) as LinkRow[]
    const find = (key: string) => linksAfter.find((r) => linkKey(r) === key)

    if (processDraft) {
      const key = `p:${processId}`
      const row = find(key)
      try {
        const res = await upsertRemote(
          acc.provider,
          access,
          processDraft,
          row?.external_event_id ?? null,
          row?.sync_etag ?? null,
        )
        pushed += 1
        const payload = {
          auth_user_id: userId,
          calendar_account_id: acc.id,
          provider: acc.provider,
          suivi_process_id: processId,
          suivi_etape_id: null,
          external_event_id: res.externalEventId,
          sync_etag: res.etag,
          updated_at: new Date().toISOString(),
        }
        if (row) {
          await supabase.from('calendar_event_link' as never).update(payload as never).eq('id', row.id)
        } else {
          await supabase.from('calendar_event_link' as never).insert(payload as never)
        }
      } catch (e) {
        return { ok: false, message: e instanceof Error ? e.message : 'calendar_err_sync' }
      }
    } else {
      const row = find(`p:${processId}`)
      if (row) {
        try {
          await deleteRemote(acc.provider, access, row.external_event_id)
        } catch {
          /* */
        }
        await supabase.from('calendar_event_link' as never).delete().eq('id', row.id)
      }
    }

    const { data: linkRowsForSteps } = await supabase
      .from('calendar_event_link' as never)
      .select('id, suivi_process_id, suivi_etape_id, external_event_id, sync_etag')
      .eq('calendar_account_id', acc.id)
      .eq('auth_user_id', userId)
    const linksForSteps = (linkRowsForSteps ?? []) as LinkRow[]
    const findStep = (key: string) => linksForSteps.find((r) => linkKey(r) === key)

    for (const { stepId, draft } of stepDrafts) {
      const key = `s:${stepId}`
      const row = findStep(key)
      try {
        const res = await upsertRemote(
          acc.provider,
          access,
          draft,
          row?.external_event_id ?? null,
          row?.sync_etag ?? null,
        )
        pushed += 1
        const payload = {
          auth_user_id: userId,
          calendar_account_id: acc.id,
          provider: acc.provider,
          suivi_process_id: null,
          suivi_etape_id: stepId,
          external_event_id: res.externalEventId,
          sync_etag: res.etag,
          updated_at: new Date().toISOString(),
        }
        if (row) {
          await supabase.from('calendar_event_link' as never).update(payload as never).eq('id', row.id)
        } else {
          await supabase.from('calendar_event_link' as never).insert(payload as never)
        }
      } catch (e) {
        return { ok: false, message: e instanceof Error ? e.message : 'calendar_err_sync' }
      }
    }
  }

  return { ok: true, pushed }
}
