'use client'

import type { Dispatch, SetStateAction } from 'react'
import { FIS } from './drawer-widgets'

export type NewContactDraft = {
  inst: string
  prenom: string
  nom: string
  role: string
  email: string
  phone: string
  ville: string
  pays: string
  notes: string
}

export const EMPTY_CONTACT_DRAFT: NewContactDraft = { inst: '', prenom: '', nom: '', role: '', email: '', phone: '', ville: '', pays: '', notes: '' }

export function NewContactModal({
  newC,
  setNewC,
  creating,
  t,
  onCreate,
  onClose,
}: {
  newC: NewContactDraft
  setNewC: Dispatch<SetStateAction<NewContactDraft>>
  creating: boolean
  t: (k: import('@/lib/i18n/dictionary').DictKey) => string
  onCreate: () => void
  onClose: () => void
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: 'var(--bg1)', border: '1px solid var(--bd)', borderRadius: 8, padding: 24, width: '100%', maxWidth: 520, maxHeight: '85vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--tx3)' }}>{t('wf_new_contact')}</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 10, color: 'var(--tx3)' }}>{t('contactEditorInstitution')}</label>
          <input className="input" value={newC.inst} onChange={e => setNewC(p => ({ ...p, inst: e.target.value }))} style={FIS} placeholder={t('contacts_quick_inst')} autoFocus />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 10, color: 'var(--tx3)' }}>{t('contactEditorFirstName')}</label>
            <input className="input" value={newC.prenom} onChange={e => setNewC(p => ({ ...p, prenom: e.target.value }))} style={FIS} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 10, color: 'var(--tx3)' }}>{t('contactEditorLastName')}</label>
            <input className="input" value={newC.nom} onChange={e => setNewC(p => ({ ...p, nom: e.target.value }))} style={FIS} />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 10, color: 'var(--tx3)' }}>{t('contactEditorRole')}</label>
          <input className="input" value={newC.role} onChange={e => setNewC(p => ({ ...p, role: e.target.value }))} style={FIS} placeholder={t('contactEditorRolePick')} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 10, color: 'var(--tx3)' }}>{t('contactEditorEmailPh')}</label>
            <input className="input" type="email" value={newC.email} onChange={e => setNewC(p => ({ ...p, email: e.target.value }))} style={FIS} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 10, color: 'var(--tx3)' }}>{t('contactEditorPhonePh')}</label>
            <input className="input" type="tel" value={newC.phone} onChange={e => setNewC(p => ({ ...p, phone: e.target.value }))} style={FIS} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 10, color: 'var(--tx3)' }}>{t('contactEditorCity')}</label>
            <input className="input" value={newC.ville} onChange={e => setNewC(p => ({ ...p, ville: e.target.value }))} style={FIS} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 10, color: 'var(--tx3)' }}>{t('contactEditorCountry')}</label>
            <input className="input" value={newC.pays} onChange={e => setNewC(p => ({ ...p, pays: e.target.value }))} style={FIS} />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 10, color: 'var(--tx3)' }}>{t('notes')}</label>
          <textarea className="input" value={newC.notes} onChange={e => setNewC(p => ({ ...p, notes: e.target.value }))} style={{ ...FIS, height: 72, resize: 'vertical' }} />
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn ghost sm" onClick={onClose} style={{ fontSize: 11 }}>{t('cancel')}</button>
          <button className="btn primary sm" onClick={onCreate} disabled={creating || (!newC.inst && !newC.prenom && !newC.nom)} style={{ fontSize: 11 }}>
            {creating ? '…' : t('contactEditorCreate')}
          </button>
        </div>
      </div>
    </div>
  )
}
