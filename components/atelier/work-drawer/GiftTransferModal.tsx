'use client'

// Work card « Don… » / « Dépôt… » / « Prêt… » / « Vendu… » (TODO R7, v2 « a hand change in the
// work card becomes a draft order »): the chip opens the new-order form on that kind with this
// work; it creates a draft (G / D / P / V-YYYY-NNN) with its paper. Nothing moves here: the
// steps are taken in Commandes, and a draft made by a team member shows in Pem's Fil.
// Was (gift): an immediate status change + a separate slip.

import { useState } from 'react'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n/context'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { NewOrderForm, type OrderContact } from '@/app/atelier/(portal)/sales/_components/NewOrderForm'
import type { WorkOrderKind } from '@/app/atelier/(portal)/sales/orders-actions'

export function GiftTransferModal({
  oeuvreId,
  kind = 'gift',
  recipients,
  onClose,
  onGifted,
}: {
  oeuvreId: number
  kind?: WorkOrderKind
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
        initial={{ kind, lockKind: true, workIds: [oeuvreId] }}
        intro={t(kind === 'gift' ? 'ord_gift_intro' : 'ord_card_intro')}
        onClose={onClose}
        onCreated={(id, ref) => setCreated({ id, ref })}
      />
    )
  }

  return (
    <div role="dialog" aria-modal="true" aria-label={t('ord_title')} onClick={onGifted} style={{
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
