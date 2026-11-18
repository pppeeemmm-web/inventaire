'use client'

// One line at the top of a tab that changed (TODO 24): « Nouveau : <title> », then « Compris » hides it for good
// in this browser and clears the menu dot. The titles load on demand (whats-new-items is kept out of page JS).

import { useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { markWhatsNewSeen } from '@/lib/whats-new-dots'
import type { WhatsNewItem } from '@/lib/whats-new'

type ItemCopy = Record<string, { fr: string; en?: string } | undefined>

export function WhatsNewSpotNotice({ items }: { items: WhatsNewItem[] }) {
  const { t, lang } = useI18n()
  const [copy, setCopy] = useState<ItemCopy | null>(null)
  useEffect(() => {
    let alive = true
    void import('@/lib/i18n/messages/whats-new-items.messages').then((m) => {
      if (alive) setCopy(m.whatsNewItemMessages as unknown as ItemCopy)
    })
    return () => {
      alive = false
    }
  }, [])
  if (!items.length || !copy) return null
  const title = (id: string) => {
    const m = copy[`wn_${id}_t`]
    return m ? (lang === 'en' ? m.en ?? m.fr : m.fr) : ''
  }
  return (
    <div
      role="status"
      data-testid="whats-new-spot"
      style={{
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', margin: '0 0 12px', padding: '8px 12px',
        border: '1px solid var(--ac)', borderLeftWidth: 3, background: 'var(--bg1)', fontSize: 13, color: 'var(--tx)',
      }}
    >
      <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--ac)', flex: 'none' }} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <b style={{ color: 'var(--ac)', fontWeight: 600 }}>{t('wn_spot_new')}</b> {items.map((i) => title(i.id)).filter(Boolean).join(' · ')}
      </span>
      <button type="button" className="btn sm" style={{ minHeight: 36 }} onClick={() => markWhatsNewSeen(items.map((i) => i.id))}>
        {t('wn_spot_ok')}
      </button>
    </div>
  )
}
