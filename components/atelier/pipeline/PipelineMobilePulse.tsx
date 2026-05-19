'use client'

import { daysUntil, type PipelinePulseItem } from '@/lib/pipeline-deadlines'
import { TYPE_COLORS, type ProcessType, type Reminder } from '@/components/atelier/pipeline/pipeline-shared'

function urgencyColor(days: number): string {
  if (days < 0) return '#c06060'
  if (days <= 7) return '#c08040'
  if (days <= 21) return '#a0a040'
  return 'var(--tx3)'
}

export function PipelineMobilePulse({
  upcoming,
  reminders,
  dateLocTag,
  t,
  onOpenProcess,
  onTickEtape,
  onDismissReminder,
}: {
  upcoming: PipelinePulseItem[]
  reminders: Reminder[]
  dateLocTag: 'fr-FR' | 'en-GB'
  t: (k: string) => string
  onOpenProcess: (processId: string) => void
  onTickEtape: (etapeId: string) => Promise<void> | void
  onDismissReminder: (reminderId: string) => Promise<void> | void
}) {
  return (
    <div
      data-testid="pipeline-mobile-pulse"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        padding: '8px 16px max(20px, env(safe-area-inset-bottom, 0px))',
        minWidth: 0,
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
      }}
    >
      <section style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
        <div className="t-eyebrow" style={{ marginBottom: 4 }}>
          {t('pipeline_upcoming_deadlines')}
        </div>
        {upcoming.length === 0 ? (
          <div className="t-mono-sm" style={{ color: 'var(--tx3)', padding: '8px 0' }}>
            {t('pipeline_no_upcoming_60')}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {upcoming.map((item, i) => {
              const days = daysUntil(item.date)
              const col = urgencyColor(days)
              const borderColor = TYPE_COLORS[item.type as ProcessType] ?? '#888'
              return (
                <div
                  key={`${item.processId}-${item.etapeId ?? 'fin'}-${item.date}-${i}`}
                  role="button"
                  tabIndex={0}
                  aria-label={t('pipeline_sidebar_open_process_aria')}
                  onClick={() => onOpenProcess(item.processId)}
                  onKeyDown={(ev) => {
                    if (ev.key === 'Enter' || ev.key === ' ') {
                      ev.preventDefault()
                      onOpenProcess(item.processId)
                    }
                  }}
                  style={{
                    padding: '12px 14px',
                    borderLeft: `3px solid ${borderColor}`,
                    background: 'var(--bg0)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    cursor: 'pointer',
                    minWidth: 0,
                    boxSizing: 'border-box',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, color: 'var(--tx)', fontWeight: 500, lineHeight: 1.35 }}>
                      {item.label}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: col,
                        fontWeight: days <= 7 ? 700 : 400,
                        marginTop: 6,
                      }}
                    >
                      {days < 0
                        ? t('pipeline_sidebar_overdue_fmt').replace(/\{days\}/g, String(Math.abs(days)))
                        : days === 0
                          ? t('pipeline_sidebar_today')
                          : t('pipeline_sidebar_in_days_fmt').replace(/\{days\}/g, String(days))}
                      {' · '}
                      {new Date(item.date).toLocaleDateString(dateLocTag, { day: 'numeric', month: 'short' })}
                      {item.deadline_time ? ` · ${item.deadline_time}` : ''}
                    </div>
                  </div>
                  {item.etapeId && (
                    <button
                      type="button"
                      onClick={async (ev) => {
                        ev.stopPropagation()
                        try {
                          await onTickEtape(item.etapeId!)
                        } catch (err) {
                          alert(`${t('error_prefix')} ${err instanceof Error ? err.message : String(err)}`)
                        }
                      }}
                      title={t('pipeline_etape_tick_title')}
                      aria-label={t('pipeline_etape_tick_title')}
                      style={{
                        flexShrink: 0,
                        minWidth: 44,
                        minHeight: 44,
                        width: 44,
                        height: 44,
                        border: '1px solid var(--bd)',
                        background: 'var(--bg1)',
                        color: 'var(--tx3)',
                        cursor: 'pointer',
                        fontSize: 15,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      ✓
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {reminders.length > 0 && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
          <div className="t-eyebrow" style={{ marginBottom: 4 }}>
            {t('pipeline_reminders_header')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {reminders.map((r) => {
              const days = daysUntil(r.remind_at)
              return (
                <div
                  key={r.id}
                  style={{
                    padding: '12px 14px',
                    background: 'var(--bg0)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      color: urgencyColor(days),
                      marginTop: 2,
                      flexShrink: 0,
                    }}
                  >
                    {days <= 0 ? '●' : '○'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, color: 'var(--tx)', lineHeight: 1.35 }}>{r.message}</div>
                    <div style={{ fontSize: 12, color: 'var(--tx3)', marginTop: 6 }}>
                      {new Date(r.remind_at).toLocaleDateString(dateLocTag, { day: 'numeric', month: 'short' })}
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label={t('delete')}
                    onClick={() => void onDismissReminder(r.id)}
                    style={{
                      fontSize: 12,
                      color: 'var(--tx3)',
                      flexShrink: 0,
                      minHeight: 44,
                      minWidth: 44,
                    }}
                  >
                    ×
                  </button>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
