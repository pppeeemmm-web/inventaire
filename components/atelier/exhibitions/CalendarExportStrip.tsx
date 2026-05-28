'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  disconnectCalendar,
  getCalendarConnectStatus,
  pushExhibitionToCalendars,
  startCalendarOAuth,
} from '@/app/atelier/calendar/actions'
import { useI18n } from '@/lib/i18n/context'
import type { DictKey } from '@/lib/i18n/dictionary'
import type { Exhibition } from './exhibitions-types'

export function CalendarExportStrip({ exhibition }: { exhibition: Exhibition }) {
  const { t, lang } = useI18n()
  const [google,    setGoogle]    = useState(false)
  const [microsoft, setMicrosoft] = useState(false)
  const [busy,      setBusy]      = useState(false)
  const [msg,       setMsg]       = useState<string | null>(null)

  const load = useCallback(async () => {
    const r = await getCalendarConnectStatus()
    if (!r.ok) return
    setGoogle(r.google)
    setMicrosoft(r.microsoft)
  }, [])

  useEffect(() => { void load() }, [load])

  const hasExportableDates = !!(
    exhibition.date_debut ||
    exhibition.date_fin ||
    exhibition.steps.some((s) => s.date_echeance)
  )

  async function connect(provider: 'google' | 'microsoft') {
    setMsg(null)
    const r = await startCalendarOAuth(provider)
    if (r.ok) {
      window.location.href = r.url
      return
    }
    setMsg(t(r.errKey as DictKey))
  }

  async function disconnect(provider: 'google' | 'microsoft') {
    setMsg(null)
    const r = await disconnectCalendar(provider)
    if (!r.ok) {
      setMsg(t(r.errKey as DictKey))
      return
    }
    await load()
  }

  async function push() {
    setMsg(null)
    if (!hasExportableDates) { setMsg(t('calendar_sync_nothing')); return }
    if (!google && !microsoft) { setMsg(t('calendar_err_no_accounts')); return }
    setBusy(true)
    const r = await pushExhibitionToCalendars(exhibition.id, lang)
    setBusy(false)
    if (!r.ok) {
      const base = t(r.errKey as DictKey)
      setMsg(r.detail ? `${base} (${r.detail})` : base)
      return
    }
    if (r.pushed === 0) setMsg(t('calendar_sync_nothing'))
    else setMsg(t('calendar_sync_done').replace('{n}', String(r.pushed)))
  }

  return (
    <div style={{ marginBottom: 24, padding: 14, border: '1px solid var(--bd)', borderRadius: 6, background: 'var(--bg1)' }}>
      <div style={{ fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--tx3)', marginBottom: 10 }}>
        {t('calendar_export_heading')}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
        {!google && (
          <button type="button" className="btn sm" style={{ minHeight: 44 }} onClick={() => void connect('google')}>
            {t('calendar_connect_google_btn')}
          </button>
        )}
        {google && (
          <button type="button" className="btn ghost sm" style={{ minHeight: 44 }} onClick={() => void disconnect('google')}>
            {t('calendar_disconnect_google_btn')}
          </button>
        )}
        {!microsoft && (
          <button type="button" className="btn sm" style={{ minHeight: 44 }} onClick={() => void connect('microsoft')}>
            {t('calendar_connect_microsoft_btn')}
          </button>
        )}
        {microsoft && (
          <button type="button" className="btn ghost sm" style={{ minHeight: 44 }} onClick={() => void disconnect('microsoft')}>
            {t('calendar_disconnect_microsoft_btn')}
          </button>
        )}
      </div>
      <button
        type="button" className="btn primary sm" style={{ minHeight: 44 }}
        disabled={busy || (!google && !microsoft)}
        onClick={() => void push()}
      >
        {busy ? t('calendar_sync_busy') : t('calendar_push_btn')}
      </button>
      {msg && (
        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--tx2)', whiteSpace: 'pre-wrap' }} role="status">
          {msg}
        </div>
      )}
    </div>
  )
}
