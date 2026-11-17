'use client'

// Audit « Retirés du Fil » (R1 step 6, docs/design/2026-11-17/R1_InputsFeed.notes.md « Effect on
// Audit »): every discard from the Fil, newest first, with « Rappeler ». A recalled item goes back
// where it was and into the Fil; the row stays here, marked « Rappelé ».
import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { toast } from '@/lib/ui/toast'
import { listFilLog, recallFil, type FilKind, type FilLogEntry } from '@/app/atelier/fil/actions'

const KIND_LABEL = {
  note_line: 'fil_log_kind_note_line',
  idea: 'fil_log_kind_idea',
  kaizen_item: 'fil_log_kind_kaizen_item',
  pending_change: 'fil_log_kind_pending_change',
} as const satisfies Record<FilKind, string>

export function FilLog() {
  const { t, lang } = useI18n()
  const [entries, setEntries] = useState<FilLogEntry[] | null>(null)
  const [failed, setFailed] = useState<'admin' | 'load' | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const locale = lang === 'fr' ? 'fr-FR' : 'en-GB'

  const reload = useCallback(() => {
    void listFilLog()
      .then((res) => {
        if (!('error' in res)) setEntries(res.entries)
        else setFailed(res.error === 'admin' || res.error === 'auth' ? 'admin' : 'load')
      })
      .catch(() => setFailed('load'))
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  async function recall(e: FilLogEntry) {
    const key = `${e.kind}:${e.id}`
    setBusyKey(key)
    const res = await recallFil(e.kind, e.id)
    setBusyKey(null)
    if ('error' in res) {
      toast.error(res.error === 'image' ? t('fil_log_image') : res.error)
      return
    }
    toast.info(t('fil_log_done'))
    reload()
  }

  return (
    <div data-testid="audit-fil-log" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '12px 28px', borderBottom: '1px solid var(--bd)' }}>
        <div className="t-eyebrow" style={{ fontSize: 10 }}>
          {t('fil_log_title')}
          {entries ? ` · ${entries.length}` : ''}
        </div>
        <p style={{ fontSize: 12, color: 'var(--tx3)', margin: '4px 0 0' }}>{t('fil_log_intro')}</p>
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {failed === 'admin' ? (
          <div data-testid="audit-fil-log-admin-only" style={{ padding: 40, opacity: 0.6 }} className="t-mono-sm">{t('fil_admin_only')}</div>
        ) : failed ? (
          <div style={{ padding: 40, color: 'var(--rust)' }} className="t-mono-sm">{t('fil_load_error')}</div>
        ) : !entries ? (
          <div style={{ padding: 40, opacity: 0.5 }} className="t-mono-sm">{t('fil_loading')}</div>
        ) : entries.length === 0 ? (
          <div data-testid="audit-fil-log-empty" style={{ padding: 40, opacity: 0.5 }} className="t-mono-sm">{t('fil_log_empty')}</div>
        ) : (
          <table className="tbl" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: 150 }}>{t('fil_log_col_date')}</th>
                <th style={{ width: 90 }}>{t('fil_log_col_kind')}</th>
                <th>{t('fil_log_col_what')}</th>
                <th style={{ width: 170 }} />
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const key = `${e.kind}:${e.id}`
                return (
                  <tr key={key} data-testid={`audit-fil-log-row-${key}`}>
                    <td style={{ fontSize: 11, color: 'var(--tx3)', whiteSpace: 'nowrap' }}>{new Date(e.at).toLocaleString(locale)}</td>
                    <td style={{ fontSize: 11 }}>{t(KIND_LABEL[e.kind])}</td>
                    <td style={{ fontSize: 12, overflowWrap: 'anywhere' }}>{e.label}</td>
                    <td style={{ textAlign: 'right' }}>
                      {e.recalledAt ? (
                        <span style={{ fontSize: 11, color: 'var(--tx3)' }}>
                          {t('fil_log_recalled')}
                          {' · '}
                          {new Date(e.recalledAt).toLocaleDateString(locale)}
                        </span>
                      ) : !e.recallable ? (
                        <span style={{ fontSize: 11, color: 'var(--tx3)' }}>{t('fil_log_image')}</span>
                      ) : (
                        <button
                          type="button"
                          className="btn ghost sm"
                          data-testid={`audit-fil-log-recall-${key}`}
                          disabled={busyKey === key}
                          onClick={() => void recall(e)}
                        >
                          {t('fil_log_recall')}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
