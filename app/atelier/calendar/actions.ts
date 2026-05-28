'use server'

import { createClient } from '@/lib/supabase/server'
import { appOrigin } from '@/lib/calendar/app-origin'
import { googleAuthUrl } from '@/lib/calendar/google-calendar'
import { microsoftAuthUrl } from '@/lib/calendar/microsoft-graph'
import { signOAuthState } from '@/lib/calendar/oauth-state'
import { syncExhibitionProcess } from '@/lib/calendar/sync-exhibition'
import type { Lang } from '@/lib/i18n/dictionary'
import { dict } from '@/lib/i18n/dictionary'
import type { CalendarProvider } from '@/lib/calendar/types'

async function guardTeam() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'auth' as const, supabase: null as null, user: null as null }
  const { data: isTeam } = await supabase.rpc('is_team')
  if (!isTeam) return { error: 'team' as const, supabase: null, user: null }
  return { error: null as null, supabase, user }
}

export async function getCalendarConnectStatus(): Promise<
  | { ok: true; google: boolean; microsoft: boolean }
  | { ok: false; errKey: 'calendar_err_auth' | 'calendar_err_team' }
> {
  const g = await guardTeam()
  if (g.error === 'auth') return { ok: false, errKey: 'calendar_err_auth' }
  if (g.error === 'team') return { ok: false, errKey: 'calendar_err_team' }
  const { data, error } = await g.supabase
    .from('calendar_account')
    .select('provider')
    .eq('auth_user_id', g.user.id)
  if (error) return { ok: false, errKey: 'calendar_err_team' }
  const set = new Set((data ?? []).map((r: { provider: string }) => r.provider))
  return { ok: true, google: set.has('google'), microsoft: set.has('microsoft') }
}

export async function startCalendarOAuth(provider: CalendarProvider): Promise<
  { ok: true; url: string } | { ok: false; errKey: string }
> {
  const g = await guardTeam()
  if (g.error === 'auth') return { ok: false, errKey: 'calendar_err_auth' }
  if (g.error === 'team') return { ok: false, errKey: 'calendar_err_team' }
  const origin = appOrigin()
  const state = signOAuthState({ sub: g.user.id, provider })
  try {
    if (provider === 'google') {
      const url = googleAuthUrl(state, `${origin}/api/calendar/google/callback`)
      return { ok: true, url }
    }
    const url = microsoftAuthUrl(state, `${origin}/api/calendar/microsoft/callback`)
    return { ok: true, url }
  } catch (e) {
    console.error('[startCalendarOAuth]', e)
    return { ok: false, errKey: 'calendar_err_oauth_config' }
  }
}

export async function disconnectCalendar(provider: CalendarProvider): Promise<
  { ok: true } | { ok: false; errKey: string }
> {
  const g = await guardTeam()
  if (g.error === 'auth') return { ok: false, errKey: 'calendar_err_auth' }
  if (g.error === 'team') return { ok: false, errKey: 'calendar_err_team' }
  const { error } = await g.supabase
    .from('calendar_account')
    .delete()
    .eq('auth_user_id', g.user.id)
    .eq('provider', provider)
  if (error) return { ok: false, errKey: 'calendar_err_disconnect' }
  return { ok: true }
}

export async function pushExhibitionToCalendars(
  processId: string,
  lang: Lang,
): Promise<
  | { ok: true; pushed: number }
  | { ok: false; errKey: string; detail?: string }
> {
  const g = await guardTeam()
  if (g.error === 'auth') return { ok: false, errKey: 'calendar_err_auth' }
  if (g.error === 'team') return { ok: false, errKey: 'calendar_err_team' }

  const d = dict[lang]
  const labels = {
    processSummary: (name: string) => d.calendar_sync_process_title.replace('{name}', name),
    stepSummary: (processName: string, stepName: string) =>
      d.calendar_sync_step_title.replace('{process}', processName).replace('{step}', stepName),
    fieldLocation: d.pd_row_location,
    fieldUrl: d.pd_row_url,
    fieldNotes: d.notes,
  }

  try {
    const res = await syncExhibitionProcess(g.supabase, g.user.id, processId, labels)
    if (!res.ok) {
      const k = res.message
      if (k === 'calendar_err_no_accounts') return { ok: false, errKey: 'calendar_err_no_accounts' }
      if (k === 'calendar_err_not_found') return { ok: false, errKey: 'calendar_err_not_found' }
      if (k === 'calendar_err_token') return { ok: false, errKey: 'calendar_err_token' }
      return { ok: false, errKey: 'calendar_err_sync_generic', detail: k }
    }
    return { ok: true, pushed: res.pushed }
  } catch (e) {
    return {
      ok: false,
      errKey: 'calendar_err_sync_generic',
      detail: e instanceof Error ? e.message : String(e),
    }
  }
}
