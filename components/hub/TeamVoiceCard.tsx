'use client'

// Pem's voice card on Aujourd'hui (TODO 24): the latest « #équipe » voice note by an admin, with up to three
// team-facing novelties under it. « Écouté » hides it in this browser. Loaded lazily by TodayClient (phone budget).

import { useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { imageUrl } from '@/lib/data'
import { WHATS_NEW_ITEMS } from '@/lib/whats-new'
import { getTeamVoiceCard, type TeamVoiceCard as Card } from '@/app/atelier/team-voice-actions'

const SEEN_KEY = 'pem_team_voice_seen'
type ItemCopy = Record<string, { fr: string; en?: string } | undefined>

function seenId(): string | null {
  try {
    return window.localStorage.getItem(SEEN_KEY)
    // eslint-disable-next-line pem-i18n/no-silent-catch -- storage blocked: the card shows, nothing else depends on it
  } catch {
    return null
  }
}

export default function TeamVoiceCard() {
  const { t, lang } = useI18n()
  const [card, setCard] = useState<Card | null>(null)
  const [copy, setCopy] = useState<ItemCopy | null>(null)

  useEffect(() => {
    let alive = true
    void getTeamVoiceCard()
      .then((c) => {
        if (!alive || !c || seenId() === c.id) return
        setCard(c)
        return import('@/lib/i18n/messages/whats-new-items.messages').then((m) => {
          if (alive) setCopy(m.whatsNewItemMessages as unknown as ItemCopy)
        })
      })
      // eslint-disable-next-line pem-i18n/no-silent-catch -- a card that cannot load simply does not show
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  if (!card) return null
  const highlights = WHATS_NEW_ITEMS.filter((i) => i.spot).slice(0, 3)
  const title = (id: string) => {
    const m = copy?.[`wn_${id}_t`]
    return m ? (lang === 'en' ? m.en ?? m.fr : m.fr) : ''
  }
  const done = () => {
    try {
      window.localStorage.setItem(SEEN_KEY, card.id)
      // eslint-disable-next-line pem-i18n/no-silent-catch -- storage blocked: the card may show again next visit
    } catch {
      /* storage unavailable */
    }
    setCard(null)
  }

  return (
    <section
      data-testid="team-voice-card"
      style={{ margin: '10px 12px', padding: '12px 14px', border: '1px solid var(--ac)', borderLeftWidth: 3, background: 'var(--bg1)' }}
    >
      <div className="t-eyebrow" style={{ fontSize: 10, color: 'var(--ac)', marginBottom: 6 }}>
        {t('wn_voice_card_title').replace('{name}', card.author)}
      </div>
      {card.subject ? <p style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 600, lineHeight: 1.4 }}>{card.subject}</p> : null}
      <audio controls preload="none" src={imageUrl(card.audioKey) ?? undefined} style={{ width: '100%', margin: '2px 0 8px' }} />
      {card.transcript ? <p style={{ margin: '0 0 8px', fontSize: 13, lineHeight: 1.45, color: 'var(--tx2)' }}>{card.transcript}</p> : null}
      {copy && highlights.length ? (
        <>
          <div className="t-eyebrow" style={{ fontSize: 10, color: 'var(--tx3)', margin: '4px 0 4px' }}>{t('wn_voice_card_new')}</div>
          <ul style={{ margin: '0 0 8px', paddingLeft: 18, fontSize: 13, lineHeight: 1.45 }}>
            {highlights.map((i) => <li key={i.id}>{title(i.id)}</li>)}
          </ul>
        </>
      ) : null}
      <button type="button" className="btn sm" onClick={done} style={{ minHeight: 44 }}>
        {t('wn_voice_card_ok')}
      </button>
    </section>
  )
}
