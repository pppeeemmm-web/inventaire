'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { toast } from '@/lib/ui/toast'
import {
  approveBroadcast,
  approveEnquiry,
  archiveEnquiry,
  listTriageDeck,
  rejectBroadcast,
  type TriageDeckCard,
} from '@/app/atelier/triage/actions'

export function TriageDeckClient() {
  const { t, lang } = useI18n()
  const [cards, setCards] = useState<TriageDeckCard[]>([])
  const [idx, setIdx] = useState(0)
  const [pending, startTransition] = useTransition()
  const touchStart = useRef<number | null>(null)
  const locale = lang === 'fr' ? 'fr-FR' : 'en-GB'

  const refresh = useCallback(() => {
    void listTriageDeck().then((res) => {
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      setCards(res.cards)
      setIdx(0)
    })
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const card = cards[idx]

  const act = (fn: () => Promise<{ ok: true } | { error: string }>) => {
    startTransition(async () => {
      const res = await fn()
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      toast.success(t('triage_deck_ok'))
      refresh()
    })
  }

  const onApprove = () => {
    if (!card) return
    if (card.kind === 'broadcast') act(() => approveBroadcast(card.broadcastId))
    else act(() => approveEnquiry(card.id))
  }

  const onReject = () => {
    if (!card) return
    if (card.kind === 'broadcast') act(() => rejectBroadcast(card.broadcastId))
    else act(() => archiveEnquiry(card.id))
  }

  const onTouchStart = (e: React.TouchEvent) => {
    touchStart.current = e.touches[0]?.clientX ?? null
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    const x0 = touchStart.current
    touchStart.current = null
    if (x0 == null || !card) return
    const x1 = e.changedTouches[0]?.clientX ?? x0
    const dx = x1 - x0
    if (Math.abs(dx) < 72) return
    if (dx < 0) onReject()
    else onApprove()
  }

  return (
    <main
      data-testid="triage-deck-root"
      style={{
        padding: 'max(16px, env(safe-area-inset-top)) 16px max(24px, env(safe-area-inset-bottom))',
        maxWidth: 560,
        margin: '0 auto',
      }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <h1 className="serif" style={{ fontSize: 22 }}>{t('triage_deck_title')}</h1>
      <p className="t-mono-sm" style={{ fontSize: 12, color: 'var(--tx2)', lineHeight: 1.5, marginBottom: 16 }}>
        {t('triage_deck_intro')}
      </p>

      {!card ? (
        <p className="t-mono-sm" style={{ fontSize: 12, color: 'var(--tx3)' }}>{t('triage_deck_empty')}</p>
      ) : (
        <article
          style={{
            border: '1px solid var(--bd)',
            borderRadius: 8,
            padding: 16,
            background: 'var(--bg1)',
            minHeight: 200,
          }}
        >
          <div className="t-eyebrow" style={{ marginBottom: 8 }}>
            {card.kind === 'broadcast' ? t('triage_deck_broadcast') : t('triage_deck_enquiry')}
          </div>
          {card.kind === 'broadcast' ? (
            <>
              {card.thumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={card.thumb} alt="" style={{ width: '100%', maxHeight: 160, objectFit: 'contain', marginBottom: 12 }} />
              ) : null}
              <div style={{ fontWeight: 600, marginBottom: 6 }}>{card.titre ?? `#${card.oeuvreId}`}</div>
              <p className="t-mono-sm" style={{ fontSize: 11, margin: 0 }}>{card.platform}</p>
            </>
          ) : (
            <>
              <div style={{ fontWeight: 600 }}>{card.name}</div>
              <p className="t-mono-sm" style={{ fontSize: 11, margin: '4px 0 8px' }}>{card.email}</p>
              <p style={{ fontSize: 13, lineHeight: 1.5, margin: 0 }}>{card.message}</p>
            </>
          )}
          <p className="t-mono-sm" style={{ fontSize: 10, color: 'var(--tx3)', marginTop: 12 }}>
            {card.kind === 'broadcast'
              ? card.queuedAt
                ? new Date(card.queuedAt).toLocaleString(locale)
                : ''
              : new Date(card.createdAt).toLocaleString(locale)}
          </p>
        </article>
      )}

      {card ? (
        <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
          <button type="button" className="btn ghost" style={{ minHeight: 44, flex: 1 }} disabled={pending} onClick={onReject}>
            {t('triage_deck_reject')}
          </button>
          <button type="button" className="btn primary" style={{ minHeight: 44, flex: 1 }} disabled={pending} onClick={onApprove}>
            {t('triage_deck_approve')}
          </button>
          {card.kind === 'broadcast' ? (
            <Link href="/atelier?tab=broadcast" className="btn ghost sm" style={{ minHeight: 44, width: '100%', textAlign: 'center' }}>
              {t('triage_deck_edit')}
            </Link>
          ) : null}
        </div>
      ) : null}

      <Link href="/hub" className="btn ghost" style={{ minHeight: 44, marginTop: 16, display: 'block', textAlign: 'center' }}>
        {t('field_stub_cta_hub')}
      </Link>
    </main>
  )
}
