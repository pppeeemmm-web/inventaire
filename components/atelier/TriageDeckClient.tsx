'use client'

// Hub Triage on the shared swipe deck (R1 + R2 build step 4): left = reject / archive, right = approve,
// each with a 6 s « Annuler » before it is sent (components/shared/SwipeDeck.tsx).
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { toast } from '@/lib/ui/toast'
import { SwipeDeck, type SwipeDecision } from '@/components/shared/SwipeDeck'
import {
  approveBroadcast,
  approveEnquiry,
  archiveEnquiry,
  listTriageDeck,
  rejectBroadcast,
  type TriageDeckCard,
} from '@/app/atelier/triage/actions'

function cardKey(card: TriageDeckCard): string {
  return card.kind === 'broadcast' ? `b:${card.broadcastId}` : `e:${card.id}`
}

export function TriageDeckClient() {
  const { t, lang } = useI18n()
  const [cards, setCards] = useState<TriageDeckCard[] | null>(null)
  const locale = lang === 'fr' ? 'fr-FR' : 'en-GB'

  const refresh = useCallback(() => {
    void listTriageDeck().then((res) => {
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      setCards(res.cards)
    })
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Same actions as before; sent by the deck once the undo window is over.
  const decide = useCallback((card: TriageDeckCard, decision: SwipeDecision) => {
    if (card.kind === 'broadcast') {
      return decision === 'keep' ? approveBroadcast(card.broadcastId) : rejectBroadcast(card.broadcastId)
    }
    return decision === 'keep' ? approveEnquiry(card.id) : archiveEnquiry(card.id)
  }, [])

  const renderCard = (card: TriageDeckCard) => (
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
          <Link href="/atelier/broadcast" className="btn ghost sm" style={{ minHeight: 44, marginTop: 12, display: 'inline-flex', alignItems: 'center' }}>
            {t('triage_deck_edit')}
          </Link>
        </>
      ) : (
        <>
          <div style={{ fontWeight: 600 }}>{card.name}</div>
          <p className="t-mono-sm" style={{ fontSize: 11, margin: '4px 0 8px' }}>{card.email}</p>
          <p style={{ fontSize: 13, lineHeight: 1.5, margin: 0, overflowWrap: 'anywhere' }}>{card.message}</p>
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
  )

  return (
    <main
      data-testid="triage-deck-root"
      style={{
        padding: 'max(16px, env(safe-area-inset-top)) 16px max(24px, env(safe-area-inset-bottom))',
        maxWidth: 560,
        margin: '0 auto',
      }}
    >
      <h1 className="serif" style={{ fontSize: 22 }}>{t('triage_deck_title')}</h1>
      <p className="t-mono-sm" style={{ fontSize: 12, color: 'var(--tx2)', lineHeight: 1.5, marginBottom: 16 }}>
        {t('triage_deck_intro')}
      </p>

      {cards == null ? null : (
        <SwipeDeck
          items={cards}
          getKey={cardKey}
          renderCard={renderCard}
          onDecide={decide}
          keepLabel={t('triage_deck_approve')}
          discardLabel={t('triage_deck_reject')}
          emptyText={t('triage_deck_empty')}
          testId="triage-deck"
        />
      )}

      <Link href="/hub" className="btn ghost" style={{ minHeight: 44, marginTop: 16, display: 'block', textAlign: 'center' }}>
        {t('field_stub_cta_hub')}
      </Link>
    </main>
  )
}
