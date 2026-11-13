'use client'

// Work drawer → contact card as a pop-up over the drawer (Kaizen #34, owner 2026-11-12: the
// round trip to the Contacts tab was "kind of heavy"). The work stays open underneath; closing
// returns to it with no reload. Same editor as the Contacts tab, with its own unsaved guard.

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ContactEditorPanel, type ContactEditorPanelHandle } from '@/components/atelier/ContactEditorPanel'
import type {
  ContactAddress,
  ContactEmail,
  ContactPhone,
  ContactRow,
  ContactSocial,
  ContactWebsite,
} from '@/components/atelier/contact-editor-types'
import type { Oeuvre } from '@/lib/types/database'
import { useI18n } from '@/lib/i18n/context'
import { toast } from '@/lib/ui/toast'

type Loaded = {
  contact: ContactRow
  addresses: ContactAddress[]
  emails: ContactEmail[]
  phones: ContactPhone[]
  websites: ContactWebsite[]
  socials: ContactSocial[]
  roles: string[]
  isAdmin: boolean
  oeuvres: Oeuvre[]
}

export function ContactQuickModal({
  contactId,
  narrow,
  onClose,
  onSaved,
}: {
  contactId: number
  narrow: boolean
  onClose: () => void
  /** The drawer refreshes the contact's name in its pickers. */
  onSaved: (c: ContactRow) => void
}) {
  const { t } = useI18n()
  const [data, setData] = useState<Loaded | null>(null)
  const [epoch, setEpoch] = useState(0)
  const editorRef = useRef<ContactEditorPanelHandle | null>(null)

  const load = useCallback(async () => {
    const sb = createClient()
    const [adminRes, cRes, addrRes, emailRes, phoneRes, webRes, socialRes, rolesRes, worksRes] = await Promise.all([
      sb.rpc('is_admin'),
      sb.from('Contact').select('*').eq('ContactID', contactId).maybeSingle(),
      sb.from('contact_addresses')
        .select('id, contact_id, label, adresse, code_postal, ville, pays, position, shipping_notes')
        .eq('contact_id', contactId)
        .order('position'),
      sb.from('contact_emails').select('*').eq('contact_id', contactId),
      sb.from('contact_phones').select('*').eq('contact_id', contactId),
      sb.from('contact_websites').select('*').eq('contact_id', contactId),
      sb.from('contact_socials').select('*').eq('contact_id', contactId),
      sb.from('tblRole').select('Nom').order('Nom'),
      sb.from('Oeuvres')
        .select('*')
        .or(`ContactID.eq.${contactId},LocalisationID.eq.${contactId},AcheteurID.eq.${contactId}`)
        .is('deleted_at', null)
        .limit(500),
    ])
    const err = [cRes, addrRes, emailRes, phoneRes, webRes, socialRes, rolesRes, worksRes].find((r) => r.error)?.error
    if (err || !cRes.data) {
      toast.error(`${t('error_prefix')} ${err?.message ?? t('cq_not_found')}`)
      onClose()
      return
    }
    const roles = new Set(((rolesRes.data ?? []) as { Nom: string }[]).map((r) => r.Nom).filter(Boolean))
    const contact = cRes.data as unknown as ContactRow
    if (contact.Role) roles.add(contact.Role)
    setData({
      contact,
      addresses: (addrRes.data ?? []) as ContactAddress[],
      emails: (emailRes.data ?? []) as ContactEmail[],
      phones: (phoneRes.data ?? []) as ContactPhone[],
      websites: (webRes.data ?? []) as ContactWebsite[],
      socials: (socialRes.data ?? []) as ContactSocial[],
      roles: [...roles].sort((a, b) => a.localeCompare(b)),
      isAdmin: adminRes.data === true,
      oeuvres: (worksRes.data ?? []) as unknown as Oeuvre[],
    })
  }, [contactId, onClose, t])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('cq_title')}
      data-testid="contact-quick-modal"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 210,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: narrow ? 'stretch' : 'center',
        padding: narrow ? 0 : 24,
      }}
    >
      <div
        style={{
          background: 'var(--bg0)',
          border: narrow ? 'none' : '1px solid var(--bd)',
          width: '100%',
          maxWidth: narrow ? undefined : 760,
          height: narrow ? '100dvh' : 'min(88vh, 900px)',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          paddingTop: narrow ? 'env(safe-area-inset-top, 0px)' : 0,
          paddingBottom: narrow ? 'max(8px, env(safe-area-inset-bottom, 0px))' : 0,
          boxSizing: 'border-box',
        }}
      >
        {data ? (
          <ContactEditorPanel
            key={`${contactId}-${epoch}`}
            ref={editorRef}
            contact={data.contact}
            initialAddresses={data.addresses}
            initialEmails={data.emails}
            initialPhones={data.phones}
            initialWebsites={data.websites}
            initialSocials={data.socials}
            roleOptions={data.roles}
            isAdminUser={data.isAdmin}
            narrow={narrow}
            oeuvres={data.oeuvres}
            onCreated={() => undefined}
            onUpdated={(c, addrs, e, p, w, s) => {
              setData((d) => (d ? { ...d, contact: c, addresses: addrs, emails: e, phones: p, websites: w, socials: s } : d))
              setEpoch((n) => n + 1)
              onSaved(c)
            }}
            onDismissEditor={onClose}
            baselineEpoch={epoch}
          />
        ) : (
          <div className="t-mono-sm" style={{ padding: 24, color: 'var(--tx3)' }}>
            {t('cq_loading')}
          </div>
        )}
      </div>
    </div>
  )
}
