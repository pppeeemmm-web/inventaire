'use server'

// Saved reports (owner 2026-11-02): named, Access-style. Team reads all; author or admin edits.

import { createClient } from '@/lib/supabase/server'
import type { Json } from '@/lib/types/supabase.generated'
import type { ReportConfig } from '@/lib/reports/engine'
import { parseReportConfig, parseReportSource, type SavedReport } from '@/lib/reports/saved-report'

type Err = { error: string }

function toSaved(r: {
  id: number
  name: string
  source: string
  config: unknown
  owner_id: string | null
  updated_at: string
}): SavedReport {
  const source = parseReportSource(r.source) ?? 'works'
  return { ...r, source, config: parseReportConfig(r.config) }
}

export async function listSavedReports(): Promise<{ reports: SavedReport[]; me: string; isAdmin: boolean } | Err> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'auth' }
  const [res, adminRes] = await Promise.all([
    supabase.from('saved_report').select('id, name, source, config, owner_id, updated_at').order('name'),
    supabase.rpc('is_admin'),
  ])
  if (res.error) return { error: res.error.message }
  return { reports: (res.data ?? []).map(toSaved), me: user.id, isAdmin: adminRes.data === true }
}

/** Creates a report, or updates `id` (RLS: author or admin). */
export async function saveReport(input: {
  id?: number
  name: string
  source: string
  config: ReportConfig
}): Promise<{ ok: true; report: SavedReport } | Err> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'auth' }
  const name = input.name.trim().slice(0, 120)
  if (!name) return { error: 'empty' }
  const source = parseReportSource(input.source)
  if (!source) return { error: 'source' }
  const config = parseReportConfig(input.config) as unknown as Json

  const res = input.id
    ? await supabase
        .from('saved_report')
        .update({ name, source, config })
        .eq('id', input.id)
        .select('id, name, source, config, owner_id, updated_at')
        .maybeSingle()
    : await supabase
        .from('saved_report')
        .insert({ owner_id: user.id, name, source, config })
        .select('id, name, source, config, owner_id, updated_at')
        .single()
  if (res.error) return { error: res.error.message }
  if (!res.data) return { error: 'forbidden' }
  return { ok: true, report: toSaved(res.data) }
}

export async function deleteSavedReport(id: number): Promise<{ ok: true } | Err> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('saved_report').delete().eq('id', id).select('id')
  if (error) return { error: error.message }
  if (!data?.length) return { error: 'forbidden' }
  return { ok: true }
}
