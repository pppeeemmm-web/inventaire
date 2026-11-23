'use client'

// What waits on the phone (lib/mobile/capture-queue.ts): the sender, and the « en attente d'envoi » cards on
// today's page of the stream. The sender runs when a page opens, when the network returns and every minute
// while something waits; each card offers « Envoyer maintenant » (its one action) and « Supprimer » under ⋯.

import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { toast } from '@/lib/ui/toast'
import { MAIN_ACTION_STYLE } from '@/lib/ui/main-action'
import { CAPTURE_QUEUE_EVENT, flushCaptures, listCaptures, removeCapture, type QueuedCapture } from '@/lib/mobile/capture-queue'

export function useCaptureQueue(): QueuedCapture[] {
  const [items, setItems] = useState<QueuedCapture[]>([])
  useEffect(() => {
    let alive = true
    const load = () =>
      void listCaptures()
        .then((rows) => {
          if (alive) setItems(rows)
        })
        // eslint-disable-next-line pem-i18n/no-silent-catch -- no IndexedDB (private window): nothing can wait here
        .catch(() => undefined)
    load()
    window.addEventListener(CAPTURE_QUEUE_EVENT, load)
    return () => {
      alive = false
      window.removeEventListener(CAPTURE_QUEUE_EVENT, load)
    }
  }, [])
  return items
}

/** Sends what waits: on open, when the network returns, and every minute while something waits. */
export function CaptureQueueFlusher({ onSent }: { onSent?: () => void }) {
  const items = useCaptureQueue()
  const { t } = useI18n()
  const waiting = items.length > 0
  const run = useCallback(() => {
    void flushCaptures().then((n) => {
      if (n > 0) {
        toast.success(`${t('cq_sent')} (${n})`)
        onSent?.()
      }
    })
  }, [onSent, t])
  useEffect(() => {
    run()
    window.addEventListener('online', run)
    return () => window.removeEventListener('online', run)
  }, [run])
  useEffect(() => {
    if (!waiting) return
    const id = window.setInterval(run, 60_000)
    return () => window.clearInterval(id)
  }, [waiting, run])
  return null
}

const card: CSSProperties = { border: '1px dashed var(--ac2)', borderRadius: 10, background: 'var(--bg2)', padding: '10px 12px' }

function QueuedCard({ c, onSent }: { c: QueuedCapture; onSent?: () => void }) {
  const { t, lang } = useI18n()
  const [url, setUrl] = useState<string | null>(null)
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    const u = URL.createObjectURL(c.blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [c.blob])
  const time = new Date(c.createdAt).toLocaleTimeString(lang === 'fr' ? 'fr-FR' : 'en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })
  const sendNow = async () => {
    setBusy(true)
    const n = await flushCaptures()
    setBusy(false)
    if (n > 0) {
      toast.success(`${t('cq_sent')} (${n})`)
      onSent?.()
    } else if (typeof navigator !== 'undefined' && navigator.onLine === false) toast.error(t('cq_still_offline'))
  }
  return (
    <article data-testid={`js-queued-${c.id}`} style={card}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, fontSize: 12, color: 'var(--tx3)' }}>
        <span>{time}</span>
        <span style={{ color: 'var(--ac)' }}>{t(c.kind === 'voice' ? 'js_kind_voice' : 'js_kind_photo')}</span>
        <span style={{ color: c.error ? 'var(--rust)' : 'var(--tx3)' }}>· {c.error ? t('cq_refused').replace('{msg}', c.error) : t('cq_waiting')}</span>
      </div>
      {url && c.kind === 'voice' ? <audio controls preload="none" src={url} style={{ display: 'block', width: '100%', margin: '6px 0', height: 36 }} /> : null}
      {/* eslint-disable-next-line @next/next/no-img-element -- local picture waiting on the phone */}
      {url && c.kind === 'photo' ? <img src={url} alt="" style={{ display: 'block', maxWidth: '100%', maxHeight: 260, objectFit: 'contain', borderRadius: 8, margin: '6px 0' }} /> : null}
      {c.fields.transcript?.trim() ? <p style={{ margin: '4px 0', fontSize: 15, lineHeight: 1.5 }}>{c.fields.transcript}</p> : null}
      {c.fields.caption?.trim() ? <p style={{ margin: '4px 0', fontSize: 15, lineHeight: 1.5 }}>{c.fields.caption}</p> : null}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
        <button type="button" className="btn sm" disabled={busy} onClick={() => void sendNow()} style={{ minHeight: 44, ...MAIN_ACTION_STYLE }}>
          {t('cq_send_now')}
        </button>
        <button type="button" aria-label={t('js_menu_delete')} onClick={() => setAsking(true)} style={{ marginLeft: 'auto', minWidth: 44, minHeight: 44, background: 'none', border: 0, color: 'var(--tx3)', cursor: 'pointer', fontSize: 18 }}>
          ⋯
        </button>
      </div>
      {asking ? (
        <div role="alertdialog" style={{ marginTop: 8, padding: 10, border: '1px solid var(--rust)', borderRadius: 8, display: 'grid', gap: 8 }}>
          <p style={{ margin: 0, fontSize: 13 }}>{t('cq_delete_ask')}</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn sm" onClick={() => void removeCapture(c.id)} style={{ minHeight: 44, color: 'var(--rust)', borderColor: 'var(--rust)' }}>
              {t('je_voice_delete_yes')}
            </button>
            <button type="button" className="btn ghost sm" onClick={() => setAsking(false)} style={{ minHeight: 44 }}>
              {t('je_voice_delete_no')}
            </button>
          </div>
        </div>
      ) : null}
    </article>
  )
}

/** The captures waiting on this phone, as cards (top of today's page in the stream). */
export function QueuedCaptureCards({ onSent }: { onSent?: () => void }) {
  const items = useCaptureQueue()
  if (!items.length) return null
  return (
    <div data-testid="js-queued" style={{ display: 'grid', gap: 10, paddingTop: 10 }}>
      {items.map((c) => (
        <QueuedCard key={c.id} c={c} onSent={onSent} />
      ))}
    </div>
  )
}
