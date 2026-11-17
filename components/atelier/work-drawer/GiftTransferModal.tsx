'use client'

// Work card « Don… » (TODO R7 step 2): a gift is an order like the other three. The chip opens
// the new-order form on Don with this work; it creates a draft G-YYYY-NNN with its deed
// (« Acte de don », Vault Commandes/Dons). Nothing moves here: « Acte signé » and « Remise »
// are steps of the order in Commandes. Was: an immediate status change + a separate slip.

import { useState } from 'react'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n/context'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { NewOrderForm, type OrderContact } from '@/app/atelier/(portal)/sales/_components/NewOrderForm'

export function GiftTransferModal({
  oeuvreId,
  recipients,
  onClose,
  onGifted,
}: {
  oeuvreId: number
  recipients: OrderContact[]
  onClose: () => void
  /** A draft order now holds the work (the card reloads to show it). */
  onGifted: () => void
}) {
  const { t } = useI18n()
  const narrow = useMediaQuery('(max-width: 767px)')
  const [created, setCreated] = useState<{ id: string; ref: string | null } | null>(null)

  if (!created) {
    return (
      <NewOrderForm
        narrow={narrow}
        contacts={recipients}
        initial={{ kind: 'gift', lockKind: true, workIds: [oeuvreId] }}
        intro={t('ord_gift_intro')}
        onClose={onClose}
        onCreated={(id, ref) => setCreated({ id, ref })}
      />
    )
  }

  return (
    <div role="dialog" aria-modal="true" aria-label={t('ord_kind_gift')} onClick={onGifted} style={{
      position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: 'var(--bg1)', border: '1px solid var(--ac)', borderRadius: 8, padding: 20, width: '100%', maxWidth: 440, boxSizing: 'border-box',
        display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        <div style={{ fontSize: 14, color: 'var(--tx2)' }}>{t('ord_created_draft').replace('{ref}', created.ref ?? '')}</div>
        <div style={{ display: 'flex', gap: 8, flexDirection: narrow ? 'column' : 'row', justifyContent: 'flex-end' }}>
          <button type="button" className="btn ghost" onClick={onGifted} style={{ minHeight: 44 }}>{t('ord_new_cancel')}</button>
          <Link className="btn primary" href={`/atelier/sales?order=${created.id}`} style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            {t('ord_open_order')}
          </Link>
        </div>
      </div>
    </div>
  )
}
