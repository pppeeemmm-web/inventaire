'use client'

// R6 — the event's people with a role (Q4): any contact, several per event, role from a list or typed.
// « Créer la commande » offers all of them as the order's other party, the place first.

import { useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { useEventsSqlLive } from './events-sql-live'
import type { EventPerson } from '@/app/atelier/(portal)/exhibitions/event-actions'
import { contactName, type EventContact } from './events-shared'
import { compareContactsByName, pickableContacts } from '@/lib/contacts/contact-display'
import { useIsAdmin } from '@/hooks/useIsAdmin'

const ROLE_KEYS = ['ev_role_venue', 'ev_role_curator', 'ev_role_organiser', 'ev_role_gallery', 'ev_role_partner', 'ev_role_printer'] as const

interface Props {
  people: EventPerson[]
  contacts: EventContact[]
  contactsById: Map<number, EventContact>
  onAdd: (contactId: number, role: string) => Promise<string | null>
  onRemove: (id: string) => Promise<string | null>
}

export function EventPeople({ people, contacts, contactsById, onAdd, onRemove }: Props) {
  const { t, lang } = useI18n()
  const isAdmin = useIsAdmin()
  const sqlLive = useEventsSqlLive()
  const [adding, setAdding] = useState(false)
  const [contactId, setContactId] = useState('')
  const [role, setRole] = useState('')
  const [err, setErr] = useState<string | null>(null)

  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 8, fontSize: 12 }}>
      <span style={{ color: 'var(--tx3)' }}>{t('ev_people')}</span>
      {people.map((p) => (
        <span key={p.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: '1px solid var(--bd)', padding: '2px 4px 2px 8px', borderRadius: 12 }}>
          {contactName(contactsById.get(p.contact_id), p.contact_id)}
          <span style={{ color: 'var(--tx3)', fontSize: 11 }}>{p.role}</span>
          <button type="button" aria-label={`${t('ev_people_remove')} — ${contactName(contactsById.get(p.contact_id), p.contact_id)}`}
            onClick={async () => setErr(await onRemove(p.id))}
            style={{ border: 'none', background: 'transparent', color: 'var(--tx3)', cursor: 'pointer', minWidth: 24, minHeight: 24 }}>×</button>
        </span>
      ))}
      {!adding ? (
        <button type="button" className="btn ghost sm" disabled={!sqlLive} title={sqlLive ? undefined : t('ev_sql_waiting_short')}
          onClick={() => setAdding(true)} style={{ minHeight: 28 }}>{t('ev_people_add')}</button>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            if (!contactId || !role.trim()) return
            const r = await onAdd(Number(contactId), role.trim())
            setErr(r)
            if (!r) { setAdding(false); setContactId(''); setRole('') }
          }}
          style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}
        >
          <select className="input" aria-label={t('ev_people_contact')} value={contactId} onChange={(e) => setContactId(e.target.value)} style={{ minHeight: 32, fontSize: 12, maxWidth: 200 }}>
            <option value="">{t('ev_people_contact')}</option>
            {/* « Privé » contacts are not offered to the team (Pem 2026-11-19); the current value stays. */}
            {[...pickableContacts(contacts, { isAdmin, keepIds: [contactId] })].sort(compareContactsByName(lang)).map((c) => <option key={c.ContactID} value={c.ContactID}>{contactName(c)}</option>)}
          </select>
          <input className="input" list="ev-role-list" aria-label={t('ev_people_role')} placeholder={t('ev_people_role')} value={role} onChange={(e) => setRole(e.target.value)} style={{ minHeight: 32, fontSize: 12, width: 140 }} />
          <datalist id="ev-role-list">{ROLE_KEYS.map((k) => <option key={k} value={t(k)} />)}</datalist>
          <button type="submit" className="btn sm" style={{ minHeight: 32 }}>{t('ev_people_add_do')}</button>
          <button type="button" className="btn ghost sm" onClick={() => setAdding(false)} style={{ minHeight: 32 }}>{t('cancel')}</button>
        </form>
      )}
      {err && <span role="alert" style={{ color: 'var(--rust)', fontSize: 11 }}>{err}</span>}
    </div>
  )
}
