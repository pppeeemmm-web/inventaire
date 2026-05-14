'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { deleteWorkSessionAdmin, listWorkSessionsForOeuvre } from '@/app/atelier/session/actions'
import type { WorkSessionRow } from '@/lib/types/database'
import { parseWorkSessionPayload } from '@/lib/work-session-payload'
import { toast } from '@/lib/ui/toast'
import type { DictKey, Lang } from '@/lib/i18n/dictionary'

type TFn = (key: DictKey) => string

function statusKey(status: string): DictKey {
  switch (status) {
    case 'pending_review':
      return 'session_status_pending_review'
    case 'applied':
      return 'session_status_applied'
    case 'rejected':
      return 'session_status_rejected'
    case 'abandoned':
      return 'session_status_abandoned'
    default:
      return 'session_status_draft'
  }
}

export function DrawerWorkSessionsSection({
  oeuvreId,
  isAdmin,
  lang,
  t,
}: {
  oeuvreId: number
  isAdmin: boolean
  lang: Lang
  t: TFn
}) {
  const [rows, setRows] = useState<WorkSessionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [, startDel] = useTransition()

  const refresh = useCallback(() => {
    void listWorkSessionsForOeuvre(oeuvreId).then((r) => {
      setRows(r)
      setLoading(false)
    })
  }, [oeuvreId])

  useEffect(() => {
    setLoading(true)
    refresh()
  }, [refresh])

  const locale = lang === 'fr' ? 'fr-FR' : 'en-GB'

  return (
    <details
      data-testid="drawer-work-sessions-section"
      open
      style={{ marginTop: 14, borderTop: '1px solid var(--bd)', paddingTop: 12 }}
    >
      <summary className="t-eyebrow" style={{ cursor: 'pointer', userSelect: 'none' }}>
        {t('drawer_work_sessions_heading')}
      </summary>
      <div
        className="t-mono-sm"
        style={{ marginTop: 10, color: 'var(--tx2)' }}
        aria-busy={loading}
      >
        {!loading && rows.length === 0 ? t('drawer_work_sessions_empty') : null}
        {!loading &&
          rows.map((row) => {
            const payload = parseWorkSessionPayload(row.payload)
            const n = payload.shots?.length ?? 0
            const updated = row.updated_at
              ? new Date(row.updated_at).toLocaleString(locale, {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })
              : '—'
            return (
              <div
                key={row.id}
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 0',
                  borderBottom: '1px solid var(--bd)',
                }}
              >
                <span style={{ flex: '1 1 140px', minWidth: 0 }}>
                  {updated} · {t(statusKey(row.status))} · {n} {t('drawer_work_sessions_shots')}
                </span>
                {isAdmin ? (
                  <button
                    type="button"
                    className="btn ghost sm"
                    style={{ minHeight: 44 }}
                    onClick={() => {
                      if (!window.confirm(t('drawer_work_sessions_delete_confirm'))) return
                      startDel(() => {
                        void deleteWorkSessionAdmin(row.id).then((r) => {
                          if ('error' in r) toast.error(r.error)
                          else {
                            toast.success(t('session_toast_saved'))
                            refresh()
                          }
                        })
                      })
                    }}
                  >
                    {t('drawer_work_sessions_delete')}
                  </button>
                ) : null}
              </div>
            )
          })}
      </div>
    </details>
  )
}
