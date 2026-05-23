import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { DictKey } from '@/lib/i18n/dictionary'
import type { Database } from '@/lib/types/supabase.generated'

type ReminderRow = Database['public']['Tables']['suivi_reminder']['Row']
type ShareInboxRow = Database['public']['Tables']['share_inbox']['Row']
type StudioTaskRow = Database['public']['Tables']['studio_task']['Row']
type WorkSessionRow = Database['public']['Tables']['work_session']['Row']

export type FieldPulseMetricKey = 'past_due' | 'today' | 'pending_review' | 'inbox'
export type FieldPulseCardKind =
  | 'reminder'
  | 'session'
  | 'share'
  | 'field_issue'
  | 'triage'

export type FieldPulseMetric = {
  key: FieldPulseMetricKey
  count: number
  href: string
  tone: 'urgent' | 'today' | 'neutral'
}

export type FieldPulseCard = {
  id: string
  kind: FieldPulseCardKind
  title?: string
  titleKey?: DictKey
  titleVars?: Record<string, string>
  detail?: string
  detailKey: DictKey
  detailVars?: Record<string, string>
  href: string
  dueAt: string | null
  priority: number
}

export type FieldPulseData = {
  generatedAt: string
  metrics: FieldPulseMetric[]
  cards: FieldPulseCard[]
}

const OPEN_TASK_STATUSES = ['active', 'requested', 'in-progress']
const MAX_CARDS = 12

function startOfToday(now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

function startOfTomorrow(now = new Date()) {
  const d = startOfToday(now)
  d.setDate(d.getDate() + 1)
  return d
}

function titleFromShare(row: ShareInboxRow): string | null {
  const payload = row.payload
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const title = 'title' in payload && typeof payload.title === 'string' ? payload.title.trim() : ''
    const text = 'text' in payload && typeof payload.text === 'string' ? payload.text.trim() : ''
    const url = 'url' in payload && typeof payload.url === 'string' ? payload.url.trim() : ''
    return title || text || url || null
  }
  return null
}

function sortCards(cards: FieldPulseCard[]) {
  return cards
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority
      const ad = a.dueAt ? Date.parse(a.dueAt) : Number.POSITIVE_INFINITY
      const bd = b.dueAt ? Date.parse(b.dueAt) : Number.POSITIVE_INFINITY
      if (ad !== bd) return ad - bd
      return (a.title ?? a.titleKey ?? '').localeCompare(b.title ?? b.titleKey ?? '')
    })
    .slice(0, MAX_CARDS)
}

export async function getFieldPulseData(): Promise<FieldPulseData> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const now = new Date()
  const todayIso = startOfToday(now).toISOString()
  const tomorrowIso = startOfTomorrow(now).toISOString()

  const empty = {
    generatedAt: now.toISOString(),
    metrics: [
      { key: 'past_due' as const, count: 0, href: '/atelier/field-inbox', tone: 'urgent' as const },
      { key: 'today' as const, count: 0, href: '/atelier/field-inbox', tone: 'today' as const },
      { key: 'pending_review' as const, count: 0, href: '/atelier/session/new', tone: 'neutral' as const },
      { key: 'inbox' as const, count: 0, href: '/atelier/field-inbox', tone: 'neutral' as const },
    ],
    cards: [],
  }

  if (!user) return empty

  const { data: isAdmin } = await supabase.rpc('is_admin')

  const [
    overdueReminders,
    todayReminders,
    pendingSessions,
    shareRows,
    fieldIssues,
    openEnquiries,
    queuedBroadcasts,
  ] = await Promise.all([
    supabase
      .from('suivi_reminder')
      .select('id, process_id, etape_id, message, remind_at, lu')
      .eq('lu', false)
      .lt('remind_at', todayIso)
      .order('remind_at', { ascending: true })
      .limit(20),
    supabase
      .from('suivi_reminder')
      .select('id, process_id, etape_id, message, remind_at, lu')
      .eq('lu', false)
      .gte('remind_at', todayIso)
      .lt('remind_at', tomorrowIso)
      .order('remind_at', { ascending: true })
      .limit(20),
    supabase
      .from('work_session')
      .select('id, created_at, updated_at, expires_at, user_id, oeuvre_id, status, payload')
      .eq('status', 'pending_review')
      .order('updated_at', { ascending: false })
      .limit(20),
    supabase
      .from('share_inbox')
      .select('id, created_at, expires_at, user_id, payload')
      .eq('user_id', user.id)
      .gt('expires_at', now.toISOString())
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('studio_task')
      .select('id, created_at, updated_at, due_at, action, details, type, priority, status, kind, severity, photo_r2_key, author_id, completed_at, oeuvre_id, work_action_type_id')
      .eq('kind', 'field')
      .in('status', OPEN_TASK_STATUSES)
      .order('updated_at', { ascending: false })
      .limit(20),
    supabase
      .from('inquiry')
      .select('id, created_at, name, email, message, status')
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(20),
    isAdmin
      ? createServiceClient()
        .from('oeuvre_broadcasts')
        .select('id, queued_at, oeuvre_id, platform, status')
        .eq('status', 'queued')
        .order('queued_at', { ascending: false })
        .limit(20)
      : Promise.resolve({ data: [], error: null }),
  ])

  const overdue = (overdueReminders.data ?? []) as ReminderRow[]
  const today = (todayReminders.data ?? []) as ReminderRow[]
  const sessions = (pendingSessions.data ?? []) as WorkSessionRow[]
  const shares = (shareRows.data ?? []) as ShareInboxRow[]
  const issues = (fieldIssues.data ?? []) as StudioTaskRow[]
  const enquiries = (openEnquiries.data ?? []) as Array<{
    id: string
    created_at: string
    name: string | null
    email: string | null
    message: string | null
  }>
  const broadcasts = (queuedBroadcasts.data ?? []) as Array<{
    id: string
    queued_at: string | null
    oeuvre_id: number | null
    platform: string | null
  }>

  const cards: FieldPulseCard[] = [
    ...overdue.map((row): FieldPulseCard => ({
      id: `reminder-${row.id}`,
      kind: 'reminder' as const,
      title: row.message,
      detailKey: 'field_card_reminder_overdue',
      href: '/atelier/pipeline',
      dueAt: row.remind_at,
      priority: 0,
    })),
    ...today.map((row): FieldPulseCard => ({
      id: `reminder-${row.id}`,
      kind: 'reminder' as const,
      title: row.message,
      detailKey: 'field_card_reminder_today',
      href: '/atelier/pipeline',
      dueAt: row.remind_at,
      priority: 1,
    })),
    ...sessions.map((row): FieldPulseCard => ({
      id: `session-${row.id}`,
      kind: 'session' as const,
      title: row.oeuvre_id ? `#${row.oeuvre_id}` : undefined,
      titleKey: row.oeuvre_id ? undefined : 'field_card_session_title',
      detailKey: 'field_card_session_detail',
      href: '/atelier/journal',
      dueAt: row.updated_at,
      priority: 2,
    })),
    ...shares.map((row): FieldPulseCard => ({
      id: `share-${row.id}`,
      kind: 'share' as const,
      title: titleFromShare(row)?.slice(0, 90),
      titleKey: titleFromShare(row) ? undefined : 'field_card_share_title',
      detailKey: 'field_card_share_detail',
      href: `/atelier/share-triage?inbox=${encodeURIComponent(row.id)}`,
      dueAt: row.created_at,
      priority: 3,
    })),
    ...issues.map((row): FieldPulseCard => ({
      id: `field-issue-${row.id}`,
      kind: 'field_issue' as const,
      title: row.action,
      detailKey: 'field_card_issue_detail',
      href: '/atelier/production',
      dueAt: row.due_at ?? row.updated_at,
      priority: row.severity === 'critical' ? 0 : row.severity === 'high' ? 1 : 4,
    })),
    ...enquiries.map((row): FieldPulseCard => ({
      id: `triage-enquiry-${row.id}`,
      kind: 'triage' as const,
      title: row.name || row.email || undefined,
      titleKey: row.name || row.email ? undefined : 'field_card_enquiry_title',
      detail: row.message ? row.message.slice(0, 90) : undefined,
      detailKey: row.message ? 'field_card_enquiry_detail_with_message' : 'field_card_enquiry_detail',
      href: '/atelier/triage',
      dueAt: row.created_at,
      priority: 3,
    })),
    ...broadcasts.map((row): FieldPulseCard => ({
      id: `triage-broadcast-${row.id}`,
      kind: 'triage' as const,
      title: row.oeuvre_id ? `#${row.oeuvre_id}` : undefined,
      titleKey: row.oeuvre_id ? undefined : 'field_card_broadcast_title',
      detailKey: row.platform ? 'field_card_broadcast_platform' : 'field_card_broadcast_detail',
      detailVars: row.platform ? { platform: row.platform } : undefined,
      href: '/atelier/triage',
      dueAt: row.queued_at,
      priority: 4,
    })),
  ]

  const inboxCount = shares.length + issues.length + enquiries.length + broadcasts.length

  return {
    generatedAt: now.toISOString(),
    metrics: [
      { key: 'past_due', count: overdue.length, href: '/atelier/field-inbox', tone: 'urgent' },
      { key: 'today', count: today.length, href: '/atelier/field-inbox', tone: 'today' },
      { key: 'pending_review', count: sessions.length, href: '/atelier/session/new', tone: 'neutral' },
      { key: 'inbox', count: inboxCount, href: '/atelier/field-inbox', tone: 'neutral' },
    ],
    cards: sortCards(cards),
  }
}
