'use client'

import { useState } from 'react'
import { markAsGift } from '@/app/atelier/works/gift-actions'
import { FIS } from './drawer-widgets'
import type { DrawerContactRow } from './drawer-content-props'

export function GiftTransferModal({
  oeuvreId,
  recipients,
  cName,
  t,
  onClose,
  onGifted,
}: {
  oeuvreId: number
  recipients: DrawerContactRow[]
  cName: (c: DrawerContactRow) => string
  t: (k: import('@/lib/i18n/dictionary').DictKey) => string
  onClose: () => void
  onGifted: () => void
}) {
  const [recipientId, setRecipientId] = useState('')
  const [deliveryDate, setDeliveryDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 220, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={() => !busy && onClose()}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: 'var(--bg1)', border: '1px solid var(--ac)', borderRadius: 8, padding: 24, width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ac)' }}>{t('workDrawer_gift_title')}</div>
          <div style={{ fontSize: 12, color: 'var(--tx3)', marginTop: 4 }}>
            {t('workDrawer_gift_body')}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 10, color: 'var(--tx3)' }}>{t('workDrawer_gift_recipient')} *</label>
          <select className="input" value={recipientId} onChange={e => setRecipientId(e.target.value)} style={FIS} autoFocus>
            <option value="">{t('workDrawer_gift_recipient_ph')}</option>
            {recipients.map((c) => (
              <option key={c.ContactID} value={c.ContactID}>{cName(c)}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 10, color: 'var(--tx3)' }}>{t('workDrawer_gift_delivery')}</label>
          <input type="date" className="input" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} style={FIS} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 10, color: 'var(--tx3)' }}>{t('wf_comments')}</label>
          <textarea className="input" value={notes} onChange={e => setNotes(e.target.value)} style={{ ...FIS, height: 72, resize: 'vertical' }} placeholder={t('workDrawer_gift_notes_ph')} />
        </div>

        {error && <div style={{ color: '#c0392b', fontSize: 10 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="btn ghost sm" disabled={busy} onClick={onClose} style={{ fontSize: 11 }}>{t('workDrawer_gift_cancel')}</button>
          <button
            type="button"
            className="btn primary sm"
            disabled={busy || !recipientId}
            onClick={async () => {
              setBusy(true); setError(null)
              try {
                const fd = new FormData()
                fd.append('oeuvre_id', String(oeuvreId))
                fd.append('recipient_id', recipientId)
                if (deliveryDate) fd.append('delivery_date', deliveryDate)
                if (notes.trim())  fd.append('notes', notes.trim())
                const res = await markAsGift(fd)
                if ('error' in res) {
                  setError(res.error)
                } else {
                  onGifted()
                }
              } catch (err) {
                setError(err instanceof Error ? err.message : String(err))
              } finally {
                setBusy(false)
              }
            }}
            style={{ fontSize: 11 }}
          >
            {busy ? '…' : t('workDrawer_gift_confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
