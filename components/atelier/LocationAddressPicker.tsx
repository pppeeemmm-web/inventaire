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
 * Renders nothing unless there is a real choice: with zero or one address the contact
 * already answers "where", and a one-option select is noise.
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
  if (addresses.length < 2) return null
  return (
    <select
      className="input"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={t('wf_location_address_label')}
      style={{
        marginTop: 6,
        fontSize: 10,
        width: '100%',
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
