'use client'

import type { Dispatch, SetStateAction } from 'react'
import { useI18n } from '@/lib/i18n/context'
import type { ContactAddress } from '@/components/atelier/contact-editor-types'

/**
 * Pin a work to ONE of its holding contact's addresses.
 *
 * `Oeuvres.LocalisationID` says WHICH contact holds the work; this says which of that
 * contact's `contact_addresses` rows. The artist has "Principal" and "Atelier", a gallery
 * can have two sites — without this, every work at a contact is indistinguishable.
 *
 * With zero or one address there is no choice: it shows that address (the DB trigger
 * oeuvre_location_by_stage stores it) or "not specified", never a one-option select.
 */
export function LocationAddressPicker({
  addresses,
  value,
  onChange,
}: {
  addresses: ContactAddress[]
  value: string
  onChange: Dispatch<SetStateAction<string>>
}) {
  const { t } = useI18n()
  if (addresses.length < 2) {
    const a = addresses[0]
    return (
      <span style={{ fontSize: 10, color: a ? 'var(--tx)' : 'var(--tx3)', flex: 1, minWidth: 0 }}>
        {a ? [a.label, a.ville].filter(Boolean).join(' — ') : t('custody_address_none')}
      </span>
    )
  }
  return (
    <select
      className="input"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={t('wf_location_address_label')}
      style={{
        fontSize: 10,
        width: '100%',
        minWidth: 0,
        flex: 1,
        padding: '4px 6px',
        background: 'var(--bg0)',
        border: '1px solid var(--bd)',
        color: 'var(--tx)',
      }}
    >
      <option value="">{t('wf_location_address_any')}</option>
      {addresses.map((a) => (
        <option key={a.id} value={String(a.id)}>
          {[a.label, a.ville].filter(Boolean).join(' — ')}
        </option>
      ))}
    </select>
  )
}
