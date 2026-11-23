'use client'

import { WorkRef } from '@/components/atelier/WorkRef'
import {
  useState,
  useEffect,
  useMemo,
  useLayoutEffect,
  useCallback,
  useImperativeHandle,
  forwardRef,
  useRef,
} from 'react'
import { saveContact, type ContactCard, type ContactFields } from '@/app/atelier/(portal)/contacts/save-contact'
import { saveContactRefusalText } from '@/lib/contacts/save-contact-message'
import { confirmIfSimilarContact } from '@/lib/contacts/similar-contact-warning'
import { useI18n } from '@/lib/i18n/context'
import { useUnsavedCloseGuard } from '@/hooks/useUnsavedCloseGuard'
import type { Oeuvre } from '@/lib/types/database'
import {
  connectTeamStudioAccess,
  getContactTeamAccessState,
  sendAuthInviteToContact,
  setContactTeamMember,
  type TeamAccessState,
} from '@/app/atelier/(portal)/contacts/team-actions'
import { toast } from '@/lib/ui/toast'
import { primaryContactEmail } from '@/lib/contacts/primary-contact-email'
import type {
  ContactAddress,
  ContactEmail,
  ContactPhone,
  ContactRow,
  ContactSocial,
  ContactWebsite,
} from '@/components/atelier/contact-editor-types'
import { ContactKitsSection } from '@/components/atelier/kits/ContactKitsSection'
import { decideAiJob } from '@/app/atelier/(portal)/ai/actions'
import { sameAddress, sameEmail, samePhone, sameUrl, type CardSuggestion } from '@/lib/ai-card-suggestion'
import { contactLinks, LINK_GLYPH } from '@/lib/contacts/contact-links'

export type ContactEditorPanelHandle = {
  save: () => Promise<boolean>
  getDirty: () => boolean
}

function cap(s: string): string {
  if (!s) return s
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const FIS: React.CSSProperties = {
  width: '100%',
  padding: '6px 8px',
  fontSize: 11,
  background: 'var(--bg0)',
  border: '1px solid var(--bd)',
  color: 'var(--tx)',
  outline: 'none',
}

function Section({ title }: { title: string }) {
  return (
    <div
      style={{
        fontSize: 8,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: 'var(--tx3)',
        marginTop: 16,
        marginBottom: 8,
        paddingBottom: 4,
        borderBottom: '1px solid var(--bd)',
      }}
    >
      {title}
    </div>
  )
}

function FRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="t-label" style={{ marginBottom: 3 }}>
        {label}
      </div>
      {children}
    </div>
  )
}

function Grid2({ narrow, children }: { narrow: boolean; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: narrow ? '1fr' : '1fr 1fr',
        gap: '8px 12px',
      }}
    >
      {children}
    </div>
  )
}

type FormState = {
  NomInstitution: string
  Nom: string
  Prénom: string
  Genre: string
  Role: string
  Email: string
  IndicatifPays1: string
  Téléphone1: string
  IndicatifPays2: string
  Téléphone2: string
  PersonneResponsable: string
  RoleResponsable: string
  Notes: string
  Actif: boolean
  is_private: boolean
}

type AddrForm = {
  /** The live link person ↔ place (`contact_place_lines.id`); absent for a new address. */
  id?: number
  label: string
  adresse: string
  code_postal: string
  ville: string
  pays: string
  complement: string
  shipping_notes: string
}

function emptyAddr(): AddrForm {
  return { label: '', adresse: '', code_postal: '', ville: '', pays: '', complement: '', shipping_notes: '' }
}

function WorkMini({ label, items }: { label: string; items: Oeuvre[] }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div className="t-label" style={{ marginBottom: 6 }}>
        {label} ({items.length})
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 140, overflow: 'auto' }}>
        {items.slice(0, 30).map((o) => (
          <div key={o.OeuvreID} className="t-mono-sm" style={{ color: 'var(--tx2)' }}>
            <WorkRef id={o.OeuvreID} style={{ color: 'var(--ac)' }} />
          </div>
        ))}
        {items.length > 30 && (
          <div className="t-mono-sm" style={{ color: 'var(--tx3)' }}>
            + {items.length - 30}
          </div>
        )}
      </div>
    </div>
  )
}

export type ContactEditorPanelProps = {
  contact: ContactRow | null
  initialAddresses: ContactAddress[]
  initialEmails: ContactEmail[]
  initialPhones: ContactPhone[]
  initialWebsites: ContactWebsite[]
  initialSocials: ContactSocial[]
  roleOptions: string[]
  isAdminUser: boolean
  narrow: boolean
  oeuvres: Oeuvre[]
  onDirtyChange?: (dirty: boolean) => void
  onCreated: (
    c: ContactRow,
    addrs: ContactAddress[],
    e: ContactEmail[],
    p: ContactPhone[],
    w: ContactWebsite[],
    s: ContactSocial[],
  ) => void
  onUpdated: (
    c: ContactRow,
    addrs: ContactAddress[],
    e: ContactEmail[],
    p: ContactPhone[],
    w: ContactWebsite[],
    s: ContactSocial[],
  ) => void
  onDismissEditor: () => void
  onDeleteContact?: () => void
  /** After invite / team flag change from server actions */
  onTeamAccessUpdated?: (patch: Pick<ContactRow, 'ContactID' | 'is_team_member' | 'auth_user_id' | 'Email'>) => void
  /** Bump after successful save (same contact) so dirty baseline resets */
  baselineEpoch: number
  /** Fill the parent (a pop-up) instead of sizing as the Contacts tab's side panel. */
  fill?: boolean
  /** Bureau IA « Ouvrir et vérifier » (AI desk phase 3): a business card read by the PC agent. Pre-filled by the rule
   *  of lib/ai-card-suggestion.ts (empty fields only, missing rows added); accepted once this editor's Save succeeds. */
  aiSuggestion?: { jobId: number; contact: CardSuggestion } | null
  onAiSuggestionDone?: () => void
}

export const ContactEditorPanel = forwardRef<ContactEditorPanelHandle, ContactEditorPanelProps>(
  function ContactEditorPanel(
    {
      contact,
      initialAddresses,
      initialEmails,
      initialPhones,
      initialWebsites,
      initialSocials,
      roleOptions,
      isAdminUser,
      narrow,
      oeuvres,
      onDirtyChange,
      onCreated,
      onUpdated,
      onDismissEditor,
      onDeleteContact,
      onTeamAccessUpdated,
      baselineEpoch,
      fill = false,
      aiSuggestion = null,
      onAiSuggestionDone,
    },
    ref,
  ) {
    const { t } = useI18n()
    const isNew = !contact

    const [form, setForm] = useState<FormState>({
      NomInstitution: contact?.NomInstitution ?? '',
      Nom: contact?.Nom ?? '',
      Prénom: contact?.Prénom ?? '',
      Genre: contact?.Genre ?? '',
      Role: contact?.Role ?? '',
      Email: contact?.Email ?? '',
      IndicatifPays1: contact?.IndicatifPays1 ?? '',
      Téléphone1: contact?.Téléphone1 ?? '',
      IndicatifPays2: contact?.IndicatifPays2 ?? '',
      Téléphone2: contact?.Téléphone2 ?? '',
      PersonneResponsable: contact?.PersonneResponsable ?? '',
      RoleResponsable: contact?.RoleResponsable ?? '',
      Notes: contact?.Notes ?? '',
      Actif: contact?.Actif ?? true,
      is_private: contact?.is_private ?? false,
    })

    const [addrList, setAddrList] = useState<AddrForm[]>(
      initialAddresses.length > 0
        ? initialAddresses.map((a) => ({
            id: a.id,
            label: a.label ?? '',
            adresse: a.adresse ?? '',
            code_postal: a.code_postal ?? '',
            ville: a.ville ?? '',
            pays: a.pays ?? '',
            complement: a.complement ?? '',
            shipping_notes: a.shipping_notes ?? '',
          }))
        : [
            {
              label: 'Principal',
              adresse: contact?.Adresse ?? '',
              code_postal: contact?.CodePostal ?? '',
              ville: contact?.Ville ?? '',
              pays: contact?.Pays ?? '',
              complement: '',
              shipping_notes: '',
            },
          ],
    )

    const [emailList, setEmailList] = useState<ContactEmail[]>(initialEmails)
    const [phoneList, setPhoneList] = useState<ContactPhone[]>(initialPhones)
    const [webList, setWebList] = useState<ContactWebsite[]>(initialWebsites)
    const [socialList, setSocialList] = useState<ContactSocial[]>(initialSocials)

    // AI desk phase 3: pre-fill once per card job; the form turns dirty, nothing is written until Save.
    const aiAppliedJob = useRef<number | null>(null)
    useEffect(() => {
      if (!aiSuggestion || isNew || aiAppliedJob.current === aiSuggestion.jobId) return
      aiAppliedJob.current = aiSuggestion.jobId
      const s = aiSuggestion.contact
      const cid = contact!.ContactID
      // Same « already there » as Bureau IA's list: the rows plus the contact's old single columns (websites: rows only).
      const oldEmail = contact?.Email ? [contact.Email] : []
      const oldPhones = [contact?.Téléphone1, contact?.Téléphone2].filter((x): x is string => !!x)
      setForm((p) => ({
        ...p,
        Prénom: p.Prénom.trim() ? p.Prénom : s.prenom ?? '',
        Nom: p.Nom.trim() ? p.Nom : s.nom ?? '',
        NomInstitution: p.NomInstitution.trim() ? p.NomInstitution : s.institution ?? '',
      }))
      setEmailList((prev) => {
        const add = s.emails.filter((e) => !prev.some((x) => sameEmail(x.email, e.email)) && !oldEmail.some((x) => sameEmail(x, e.email)))
        return [...prev, ...add.map((e, i) => ({ contact_id: cid, email: e.email, label: e.label, is_primary: prev.length === 0 && i === 0 }))]
      })
      setPhoneList((prev) => {
        const add = s.phones.filter((ph) => !prev.some((x) => samePhone(x.phone, ph.phone)) && !oldPhones.some((x) => samePhone(x, ph.phone)))
        return [...prev, ...add.map((ph, i) => ({ contact_id: cid, phone: ph.phone, country_code: ph.country_code, label: ph.label, is_primary: prev.length === 0 && i === 0 }))]
      })
      setWebList((prev) => [
        ...prev,
        ...s.websites.filter((w) => !prev.some((x) => sameUrl(x.url, w.url))).map((w) => ({ contact_id: cid, url: w.url, label: w.label })),
      ])
      setAddrList((prev) => {
        const add = s.addresses.filter((a) => !prev.some((x) => sameAddress(x, a)))
        if (add.length === 0) return prev
        const rows = add.map((a) => ({ ...emptyAddr(), label: a.label, adresse: a.adresse ?? '', code_postal: a.code_postal ?? '', ville: a.ville ?? '', pays: a.pays ?? '' }))
        // One blank address row (a contact with no address) is replaced, not kept beside the new one.
        const blankOnly = prev.length === 1 && !prev[0].id && !prev[0].adresse && !prev[0].code_postal && !prev[0].ville && !prev[0].pays
        return blankOnly ? rows : [...prev, ...rows]
      })
    }, [aiSuggestion, isNew, contact])

    const [busy, setBusy] = useState(false)
    const [accessState, setAccessState] = useState<TeamAccessState | null>(null)
    const [accessLoading, setAccessLoading] = useState(false)
    const [connectBusy, setConnectBusy] = useState(false)
    const [inviteBusy, setInviteBusy] = useState(false)
    const [err, setErr] = useState<string | null>(null)
    const [teamMember, setTeamMember] = useState(Boolean(contact?.is_team_member))
    const [authUserId, setAuthUserId] = useState<string | null>(contact?.auth_user_id ?? null)

    const contactKey = contact?.ContactID ?? 'new'

    const refreshAccessState = useCallback(async (contactId: number) => {
      setAccessLoading(true)
      const res = await getContactTeamAccessState(contactId)
      setAccessLoading(false)
      if ('error' in res) {
        setErr(res.error)
        return
      }
      setAccessState(res)
      setTeamMember(res.isTeamMember)
      setAuthUserId(res.authUserId)
    }, [])

    useEffect(() => {
      if (!isAdminUser || isNew || contact == null) {
        setAccessState(null)
        return
      }
      void refreshAccessState(contact.ContactID)
    }, [contact?.ContactID, isAdminUser, isNew, refreshAccessState, baselineEpoch])

    function f(k: keyof Omit<FormState, 'Actif'>) {
      return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setForm((p) => ({ ...p, [k]: e.target.value }))
      }
    }

    function b(k: keyof Omit<FormState, 'Actif' | 'Email' | 'Notes'>) {
      return (e: React.FocusEvent<HTMLInputElement>) => {
        setForm((p) => ({ ...p, [k]: cap(e.target.value) }))
      }
    }

    function addAddr() {
      setAddrList((prev) => [...prev, emptyAddr()])
    }

    function removeAddr(i: number) {
      setAddrList((prev) => prev.filter((_, j) => j !== i))
    }

    function updateAddr(i: number, k: keyof AddrForm, v: string) {
      setAddrList((prev) => {
        const next = prev.map((a, j) => (j === i ? { ...a, [k]: v } : a))
        if (k === 'code_postal' && v.length === 5 && /^\d+$/.test(v)) {
          fetch(`https://api-adresse.data.gouv.fr/search/?q=${v}&type=municipality&limit=1`)
            .then((r) => r.json())
            .then((data) => {
              const feat = data.features?.[0]
              if (feat) {
                const city = feat.properties.city
                setAddrList((cur) => cur.map((a, j) => (j === i ? { ...a, ville: city, pays: 'France' } : a)))
              }
            })
            .catch(() => {
              fetch(`https://api.zippopotam.us/fr/${v}`)
                .then((r) => r.json())
                .then((data) => {
                  if (data.places?.[0]) {
                    const city = data.places[0]['place name']
                    setAddrList((cur) => cur.map((a, j) => (j === i ? { ...a, ville: city, pays: 'France' } : a)))
                  }
                })
                .catch(() => {})
            })
        }
        return next
      })
    }

    const handleSave = useCallback(async (): Promise<boolean> => {
      setBusy(true)
      setErr(null)
      try {
        const validAddrs = addrList.filter((a) => a.adresse || a.ville || a.pays || a.code_postal)
        // The primary address stays the one stored when it is still on the card, else the first row (no « primary » control yet).
        const storedPrimary = initialAddresses.find((a) => a.is_primary)?.id
        const primaryId = validAddrs.some((a) => a.id != null && a.id === storedPrimary) ? storedPrimary : undefined

        // The one door (saveContact → SQL save_contact): who asks, stale check, child rows by id, the addresses through
        // save_contact_places (Places phase B: the same full line is the same building, « Étage / appartement » a floor,
        // an edited line corrected for everyone, a removed address ends this card's link only), all in one transaction. The fields and lists this screen read go with it, so a change made
        // meanwhile in another tab is refused instead of overwritten.
        const fields: ContactFields = {
          NomInstitution: form.NomInstitution,
          Nom: form.Nom,
          Prénom: form.Prénom,
          Genre: form.Genre,
          Role: form.Role,
          IndicatifPays1: form.IndicatifPays1,
          Téléphone1: form.Téléphone1,
          IndicatifPays2: form.IndicatifPays2,
          Téléphone2: form.Téléphone2,
          PersonneResponsable: form.PersonneResponsable,
          RoleResponsable: form.RoleResponsable,
          Notes: form.Notes,
          Actif: form.Actif,
          // With email rows the door writes `Email` from the primary row; without any, the old single field is kept.
          ...(emailList.length === 0 ? { Email: form.Email } : {}),
          // Only an admin changes « Privé »; « Membre équipe » of an existing contact is saved by its own toggle.
          ...(isAdminUser ? { is_private: form.is_private } : {}),
          ...(isNew && isAdminUser && teamMember ? { is_team_member: true, IsTeamMember: true } : {}),
        }
        const read: ContactFields | null = isNew
          ? null
          : {
              NomInstitution: contact!.NomInstitution ?? null,
              Nom: contact!.Nom ?? null,
              Prénom: contact!.Prénom ?? null,
              Genre: contact!.Genre ?? null,
              Role: contact!.Role ?? null,
              IndicatifPays1: contact!.IndicatifPays1 ?? null,
              Téléphone1: contact!.Téléphone1 ?? null,
              IndicatifPays2: contact!.IndicatifPays2 ?? null,
              Téléphone2: contact!.Téléphone2 ?? null,
              PersonneResponsable: contact!.PersonneResponsable ?? null,
              RoleResponsable: contact!.RoleResponsable ?? null,
              Notes: contact!.Notes ?? null,
              Actif: contact!.Actif ?? null,
              Email: contact!.Email ?? null,
              is_private: contact!.is_private ?? null,
            }

        // A new card with the same email or name as one already there: warn first (not a refusal).
        if (isNew) {
          const email = emailList.find((e) => e.is_primary)?.email || emailList[0]?.email || form.Email
          const go = await confirmIfSimilarContact(
            { nom: form.Nom, prenom: form.Prénom, institution: form.NomInstitution, email },
            t,
          )
          if (!go) return false
        }

        const res = await saveContact({
          id: isNew ? null : contact!.ContactID,
          fields,
          read,
          lists: {
            addresses: validAddrs.map((a, i) => ({
              id: a.id,
              label: a.label || (validAddrs.length === 1 ? 'Principal' : `Adresse ${i + 1}`),
              adresse: a.adresse || null,
              code_postal: a.code_postal || null,
              ville: a.ville || null,
              pays: a.pays || null,
              complement: a.complement || null,
              shipping_notes: a.shipping_notes || null,
              is_primary: primaryId != null ? a.id === primaryId : i === 0,
              position: i,
            })),
            emails: emailList.map((e) => ({ id: e.id, email: e.email, label: e.label, is_primary: e.is_primary })),
            phones: phoneList.map((p) => ({ id: p.id, phone: p.phone, country_code: p.country_code, label: p.label, is_primary: p.is_primary })),
            websites: webList.map((w) => ({ id: w.id, url: w.url, label: w.label })),
            socials: socialList.map((s) => ({ id: s.id, platform: s.platform, handle: s.handle })),
          },
          readLists: isNew
            ? null
            : {
                addresses: initialAddresses,
                emails: initialEmails,
                phones: initialPhones,
                websites: initialWebsites,
                socials: initialSocials,
              },
        })
        const refusal = saveContactRefusalText(res, t)
        if (refusal) {
          // Changed elsewhere: the card as stored now comes back with the refusal; showing it means the next
          // save starts from the fresh copy (else « Rouvrez-la » would loop on the same old copy).
          const fresh = 'refused' in res && res.refused === 'stale' ? res.card : undefined
          if (fresh && !isNew) {
            toast.error(refusal)
            onUpdated(fresh.contact, fresh.addresses, fresh.emails, fresh.phones, fresh.websites, fresh.socials)
          } else {
            setErr(refusal)
          }
          return false
        }
        if ('unchanged' in res) toast.info(t('contact_save_unchanged'))
        const card = (res as { card: ContactCard }).card
        const savedContact = { ...card.contact, auth_user_id: authUserId ?? card.contact.auth_user_id ?? null } as ContactRow
        if ((savedContact.Email ?? '') !== form.Email) {
          setForm((p) => ({ ...p, Email: savedContact.Email ?? '' }))
        }
        if (isNew) {
          onCreated(savedContact, card.addresses, card.emails, card.phones, card.websites, card.socials)
        } else {
          onUpdated(savedContact, card.addresses, card.emails, card.phones, card.websites, card.socials)
        }
        // The card reading is accepted only now that its fields are saved (a Discard leaves it on Bureau IA).
        if (aiSuggestion && aiAppliedJob.current === aiSuggestion.jobId) {
          const jobId = aiSuggestion.jobId
          onAiSuggestionDone?.() // cleared first: the editor remounts after a save and must not pre-fill again
          void decideAiJob(jobId, 'accepted').catch((e: unknown) => console.error('[contact-editor] ai accept', e))
        }
        return true
      } catch (e) {
        setErr(String(e))
        return false
      } finally {
        setBusy(false)
      }
    }, [
      addrList,
      contact,
      emailList,
      form,
      isAdminUser,
      isNew,
      onCreated,
      onUpdated,
      phoneList,
      socialList,
      teamMember,
      authUserId,
      webList,
      aiSuggestion,
      onAiSuggestionDone,
      initialAddresses,
      initialEmails,
      initialPhones,
      initialWebsites,
      initialSocials,
      t,
    ])

    const inviteEmail = useMemo(
      () => primaryContactEmail(emailList, form.Email) ?? '',
      [emailList, form.Email],
    )

    async function handleTeamMemberToggle(checked: boolean) {
      setTeamMember(checked)
      if (isNew || contact == null) return
      const res = await setContactTeamMember(contact.ContactID, checked)
      if ('error' in res) {
        setTeamMember(!checked)
        setErr(res.error)
        return
      }
      onTeamAccessUpdated?.({
        ContactID: contact.ContactID,
        is_team_member: checked,
        auth_user_id: authUserId,
      })
    }

    async function handleConnectStudio() {
      if (isNew || contact == null) return
      if (!inviteEmail) {
        setErr(t('contact_team_save_email_first'))
        return
      }
      setConnectBusy(true)
      setErr(null)
      const res = await connectTeamStudioAccess(contact.ContactID, inviteEmail)
      setConnectBusy(false)
      if ('error' in res) {
        setErr(res.error)
        return
      }
      setTeamMember(true)
      setAuthUserId(res.authUserId)
      onTeamAccessUpdated?.({
        ContactID: contact.ContactID,
        is_team_member: true,
        auth_user_id: res.authUserId,
        Email: res.email,
      })
      toast.success(`${t('contact_team_connect_ok')} ${res.email}`)
      void refreshAccessState(contact.ContactID)
    }

    async function handleSendInvite() {
      if (isNew || contact == null) return
      if (!inviteEmail) {
        setErr(t('contact_team_invite_no_email'))
        return
      }
      if (!window.confirm(`${t('contact_team_invite_confirm')}\n\n${inviteEmail}`)) return
      setInviteBusy(true)
      setErr(null)
      const res = await sendAuthInviteToContact(contact.ContactID, inviteEmail)
      setInviteBusy(false)
      if ('error' in res) {
        setErr(res.error)
        return
      }
      setTeamMember(true)
      setAuthUserId(res.authUserId)
      onTeamAccessUpdated?.({
        ContactID: contact.ContactID,
        is_team_member: true,
        auth_user_id: res.authUserId,
      })
      toast.success(`${t('contact_team_invite_ok_invited')} ${res.email}`)
      void refreshAccessState(contact.ContactID)
    }

    const formPayload = useMemo(
      () => JSON.stringify({ form, addrList, emailList, phoneList, webList, socialList }),
      [form, addrList, emailList, phoneList, webList, socialList],
    )
    const [baselinePayload, setBaselinePayload] = useState<string | null>(null)
    useLayoutEffect(() => {
      setBaselinePayload(formPayload)
      // eslint-disable-next-line react-hooks/exhaustive-deps -- baseline when contact or post-save remount
    }, [contactKey, baselineEpoch])
    const isDirty = baselinePayload != null && formPayload !== baselinePayload

    useEffect(() => {
      onDirtyChange?.(isDirty)
    }, [isDirty, onDirtyChange])

    const isDirtyRef = useRef(isDirty)
    useEffect(() => {
      isDirtyRef.current = isDirty
    }, [isDirty])

    useImperativeHandle(
      ref,
      () => ({
        save: () => handleSave(),
        getDirty: () => isDirtyRef.current,
      }),
      [handleSave],
    )

    const performSave = useCallback(async () => handleSave(), [handleSave])

    const { attemptClose, unsavedDialog } = useUnsavedCloseGuard({
      isDirty,
      onClose: onDismissEditor,
      performSave,
    })

    const mergedRoleOptions = useMemo(() => {
      const s = new Set(roleOptions)
      if (form.Role) s.add(form.Role)
      return [...s].sort((a, b) => a.localeCompare(b))
    }, [roleOptions, form.Role])

    const id = contact?.ContactID
    const works = id != null ? oeuvres.filter((o) => o.ContactID === id) : []
    const locs = id != null ? oeuvres.filter((o) => o.LocalisationID === id) : []
    const buys = id != null ? oeuvres.filter((o) => o.AcheteurID === id) : []

    // One clickable row: email, phone, websites, social profiles (TODO §1 social links, 2026-11-19).
    const linkRow = useMemo(() => {
      const out: { key: string; glyph: string; aria: string; href: string; external: boolean }[] = []
      for (const e of emailList) {
        const v = e.email.trim()
        if (v) out.push({ key: `m${out.length}`, glyph: '✉', aria: t('contact_links_email_fmt').replace('{label}', v), href: `mailto:${v}`, external: false })
      }
      for (const p of phoneList) {
        const cc = (p.country_code ?? '').replace(/[^\d+]/g, '')
        const num = p.phone.replace(/[^\d+]/g, '')
        // +33 06… → +336… (the trunk 0 is dropped after a country code; a number already starting with + is kept)
        const v = num.startsWith('+') || !cc ? num : `${cc.startsWith('+') ? cc : `+${cc}`}${num.replace(/^0/, '')}`
        if (v) out.push({ key: `p${out.length}`, glyph: '☎', aria: t('contact_links_phone_fmt').replace('{label}', `${p.country_code ?? ''} ${p.phone}`.trim()), href: `tel:${v}`, external: false })
      }
      for (const l of contactLinks(webList, socialList)) {
        out.push({ key: `l${out.length}`, glyph: LINK_GLYPH[l.kind] ?? '↗', aria: t('contact_links_open_fmt').replace('{label}', l.label), href: l.href, external: true })
      }
      return out
    }, [emailList, phoneList, webList, socialList, t])

    const rowFlex: React.CSSProperties = narrow
      ? { display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'stretch' }
      : { display: 'flex', gap: 6, alignItems: 'center' }

    return (
      <>
        {unsavedDialog}
        <div
          data-testid="contact-editor-root"
          style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            minHeight: 0,
            minWidth: 0,
            flex: fill ? '1 1 auto' : narrow ? 'none' : '0 0 min(420px, 42vw)',
            width: narrow ? '100%' : undefined,
            maxWidth: narrow ? '100%' : undefined,
            background: 'var(--bg1)',
          }}
        >
          <div
            style={{
              flex: 1,
              overflow: 'auto',
              minHeight: 0,
              padding: narrow ? '12px max(12px, env(safe-area-inset-right)) 12px max(12px, env(safe-area-inset-left))' : '16px 20px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, gap: 8 }}>
              <div style={{ fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--tx3)', flex: 1 }}>
                {isNew ? t('contactEditorNew') : `${t('contactEditorEdit')} #${contact!.ContactID}`}
              </div>
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                {!isNew && onDeleteContact && (
                  <button
                    type="button"
                    className="btn ghost sm"
                    onClick={onDeleteContact}
                    disabled={busy}
                    style={{ color: 'var(--rust)', minHeight: 44 }}
                  >
                    {t('delete')}
                  </button>
                )}
                <button type="button" className="btn ghost sm" onClick={attemptClose} disabled={busy} aria-label={t('close')} style={{ minHeight: 44 }}>
                  ✕
                </button>
              </div>
            </div>

            {aiSuggestion && !isNew ? (
              <div
                data-testid="contact-editor-ai-banner"
                style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--tx2)', padding: '8px 10px', border: '1px solid var(--bd)', borderLeft: '3px solid var(--sage)', background: 'var(--bg0)', marginBottom: 8 }}
              >
                {t('ai_card_banner')}
              </div>
            ) : null}

            {linkRow.length > 0 ? (
              <div data-testid="contact-editor-links" role="group" aria-label={t('contact_links_row')} style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {linkRow.map((l) => (
                  <a
                    key={l.key}
                    href={l.href}
                    aria-label={l.aria}
                    title={l.aria}
                    {...(l.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 44, height: 44, padding: '0 8px', border: '1px solid var(--bd)', borderRadius: 22, background: 'var(--bg0)', color: 'var(--tx1)', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}
                  >
                    {l.glyph}
                  </a>
                ))}
              </div>
            ) : null}

            <Section title={t('contactEditorSectionIdentity')} />
            <Grid2 narrow={narrow}>
              <FRow label={t('contactEditorInstitution')}>
                <input data-testid="contact-editor-institution" value={form.NomInstitution} onChange={f('NomInstitution')} style={FIS} />
              </FRow>
              <FRow label={t('contactEditorRole')}>
                <select value={form.Role} onChange={f('Role')} style={FIS}>
                  <option value="">{t('contactEditorRolePick')}</option>
                  {form.Role && !mergedRoleOptions.includes(form.Role) && (
                    <option value={form.Role}>{form.Role}</option>
                  )}
                  {mergedRoleOptions.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </FRow>
              <FRow label={t('contactEditorFirstName')}>
                <input value={form.Prénom} onChange={f('Prénom')} onBlur={b('Prénom')} style={FIS} />
              </FRow>
              <FRow label={t('contactEditorLastName')}>
                <input value={form.Nom} onChange={f('Nom')} onBlur={b('Nom')} style={FIS} />
              </FRow>
              <FRow label={t('contactEditorGenre')}>
                <select value={form.Genre} onChange={f('Genre')} style={FIS}>
                  <option value="">—</option>
                  <option value="M.">M.</option>
                  <option value="Mme">Mme</option>
                  <option value="Mx">Mx</option>
                </select>
              </FRow>
              <FRow label={t('contactEditorActive')}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginTop: 6,
                    fontSize: 11,
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={form.Actif}
                    onChange={(e) => setForm((p) => ({ ...p, Actif: e.target.checked }))}
                  />
                  {t('contactEditorActiveLabel')}
                </label>
              </FRow>
            </Grid2>
            {isAdminUser && (
              <FRow label={t('contactEditorPrivate')}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginTop: 6,
                    fontSize: 11,
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={form.is_private ?? false}
                    onChange={(e) => setForm((p) => ({ ...p, is_private: e.target.checked }))}
                  />
                  {t('contactEditorPrivateHint')}
                </label>
              </FRow>
            )}

            {isAdminUser && (
              <div
                data-testid="contact-team-access"
                style={{
                  marginTop: 12,
                  marginBottom: 12,
                  padding: 12,
                  border: '1px solid var(--bd)',
                  background: 'var(--bg1)',
                }}
              >
                <Section title={t('contact_team_section')} />
                {!isNew && contact != null ? (
                  <p className="t-mono-sm" style={{ color: 'var(--tx3)', margin: '0 0 10px' }}>
                    {t('contact_team_contact_id')} #{contact.ContactID}
                    {accessLoading ? ` · ${t('loading')}` : null}
                  </p>
                ) : null}
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    fontSize: 11,
                    cursor: 'pointer',
                    marginBottom: 10,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={teamMember}
                    onChange={(e) => void handleTeamMemberToggle(e.target.checked)}
                    disabled={busy || connectBusy || inviteBusy || accessLoading}
                    data-testid="contact-team-member"
                  />
                  <span>
                    <span style={{ display: 'block', fontWeight: 600 }}>{t('contact_team_member')}</span>
                    <span className="t-mono-sm" style={{ color: 'var(--tx3)', lineHeight: 1.4 }}>
                      {t('contact_team_member_hint')}
                    </span>
                  </span>
                </label>
                <p className="t-mono-sm" style={{ color: 'var(--tx3)', margin: '0 0 6px', lineHeight: 1.4 }}>
                  {accessState?.authUserId
                    ? `${t('contact_team_linked')} · ${accessState.authUserId.slice(0, 8)}…`
                    : t('contact_team_not_linked')}
                </p>
                {accessState?.linkedOtherContactId ? (
                  <p className="t-mono-sm" style={{ color: 'var(--rust)', margin: '0 0 8px', lineHeight: 1.4 }}>
                    {t('contact_team_linked_other').replace('{id}', String(accessState.linkedOtherContactId))}
                  </p>
                ) : null}
                {!accessState?.authUserId && accessState?.authUserIdForEmail ? (
                  <p className="t-mono-sm" style={{ color: 'var(--tx2)', margin: '0 0 8px', lineHeight: 1.4 }}>
                    {t('contact_team_auth_exists')}
                  </p>
                ) : null}
                <p className="t-mono-sm" style={{ color: 'var(--tx3)', margin: '0 0 10px', lineHeight: 1.4 }}>
                  {inviteEmail || t('contact_team_save_email_first')}
                </p>
                <button
                  type="button"
                  className="btn sm"
                  disabled={busy || connectBusy || inviteBusy || accessLoading || isNew || !inviteEmail || Boolean(accessState?.linkedOtherContactId)}
                  onClick={() => void handleConnectStudio()}
                  data-testid="contact-team-connect"
                  style={{
                    minHeight: 44,
                    width: '100%',
                    marginBottom: 8,
                    border: '1px solid var(--ac)',
                    background: 'var(--ac)',
                    color: 'var(--bg0)',
                  }}
                >
                  {connectBusy ? t('contact_team_connecting') : t('contact_team_connect')}
                </button>
                {!accessState?.authUserIdForEmail ? (
                  <button
                    type="button"
                    className="btn ghost sm"
                    disabled={busy || connectBusy || inviteBusy || accessLoading || isNew || !inviteEmail}
                    onClick={() => void handleSendInvite()}
                    data-testid="contact-team-invite"
                    style={{ minHeight: 44, width: '100%' }}
                  >
                    {inviteBusy ? t('contact_team_invite_sending') : t('contact_team_invite_send')}
                  </button>
                ) : null}
                {isNew ? (
                  <p className="t-mono-sm" style={{ color: 'var(--tx3)', margin: '8px 0 0', lineHeight: 1.4 }}>
                    {t('contact_team_invite_save_first')}
                  </p>
                ) : null}
              </div>
            )}

            <Grid2 narrow={narrow}>
              <FRow label={t('contactEditorResponsible')}>
                <input value={form.PersonneResponsable} onChange={f('PersonneResponsable')} style={FIS} />
              </FRow>
              <FRow label={t('contactEditorResponsibleRole')}>
                <input value={form.RoleResponsable} onChange={f('RoleResponsable')} style={FIS} />
              </FRow>
            </Grid2>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Section title={t('contactEditorSectionEmails')} />
              <button
                type="button"
                className="btn ghost sm"
                onClick={() => setEmailList([...emailList, { contact_id: 0, email: '', label: '', is_primary: false }])}
                style={{ fontSize: 9, minHeight: 44 }}
              >
                +
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {emailList.map((e, i) => (
                <div key={i} style={rowFlex}>
                  <input
                    value={e.email}
                    onChange={(ev) =>
                      setEmailList(emailList.map((x, j) => (i === j ? { ...x, email: ev.target.value } : x)))
                    }
                    placeholder={t('contactEditorEmailPh')}
                    style={{ ...FIS, flex: narrow ? undefined : 2 }}
                  />
                  <input
                    value={e.label}
                    onChange={(ev) =>
                      setEmailList(emailList.map((x, j) => (i === j ? { ...x, label: ev.target.value } : x)))
                    }
                    placeholder={t('contactEditorEmailLabelPh')}
                    style={{ ...FIS, flex: narrow ? undefined : 1 }}
                  />
                  <button type="button" className="btn ghost sm" style={{ minHeight: 44 }} onClick={() => setEmailList(emailList.filter((_, j) => i !== j))}>
                    ✕
                  </button>
                </div>
              ))}
              {emailList.length === 0 && (
                <div className="t-mono-sm" style={{ color: 'var(--tx3)', opacity: 0.5 }}>
                  {t('contactEditorNoEmails')}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Section title={t('contactEditorSectionPhones')} />
              <button
                type="button"
                className="btn ghost sm"
                onClick={() => setPhoneList([...phoneList, { contact_id: 0, phone: '', label: '', is_primary: false }])}
                style={{ fontSize: 9, minHeight: 44 }}
              >
                +
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {phoneList.map((p, i) => (
                <div key={i} style={rowFlex}>
                  <input
                    value={p.country_code || ''}
                    onChange={(ev) =>
                      setPhoneList(phoneList.map((x, j) => (i === j ? { ...x, country_code: ev.target.value } : x)))
                    }
                    placeholder="+33"
                    style={{ ...FIS, width: narrow ? '100%' : 50 }}
                  />
                  <input
                    value={p.phone}
                    onChange={(ev) =>
                      setPhoneList(phoneList.map((x, j) => (i === j ? { ...x, phone: ev.target.value } : x)))
                    }
                    placeholder={t('contactEditorPhonePh')}
                    style={{ ...FIS, flex: narrow ? undefined : 2 }}
                  />
                  <input
                    value={p.label}
                    onChange={(ev) =>
                      setPhoneList(phoneList.map((x, j) => (i === j ? { ...x, label: ev.target.value } : x)))
                    }
                    placeholder={t('contactEditorLabelPh')}
                    style={{ ...FIS, flex: narrow ? undefined : 1 }}
                  />
                  <button type="button" className="btn ghost sm" style={{ minHeight: 44 }} onClick={() => setPhoneList(phoneList.filter((_, j) => i !== j))}>
                    ✕
                  </button>
                </div>
              ))}
              {phoneList.length === 0 && (
                <div className="t-mono-sm" style={{ color: 'var(--tx3)', opacity: 0.5 }}>
                  {t('contactEditorNoPhones')}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Section title={t('contactEditorSectionWebsites')} />
              <button
                type="button"
                className="btn ghost sm"
                onClick={() => setWebList([...webList, { contact_id: 0, url: '', label: '' }])}
                style={{ fontSize: 9, minHeight: 44 }}
              >
                +
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {webList.map((w, i) => (
                <div key={i} style={rowFlex}>
                  <input
                    value={w.url}
                    onChange={(ev) => setWebList(webList.map((x, j) => (i === j ? { ...x, url: ev.target.value } : x)))}
                    placeholder="https://…"
                    style={{ ...FIS, flex: narrow ? undefined : 2 }}
                  />
                  <input
                    value={w.label}
                    onChange={(ev) => setWebList(webList.map((x, j) => (i === j ? { ...x, label: ev.target.value } : x)))}
                    placeholder={t('contactEditorLabelPh')}
                    style={{ ...FIS, flex: narrow ? undefined : 1 }}
                  />
                  <button type="button" className="btn ghost sm" style={{ minHeight: 44 }} onClick={() => setWebList(webList.filter((_, j) => i !== j))}>
                    ✕
                  </button>
                </div>
              ))}
              {webList.length === 0 && (
                <div className="t-mono-sm" style={{ color: 'var(--tx3)', opacity: 0.5 }}>
                  {t('contactEditorNoWebsites')}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Section title={t('contactEditorSectionSocials')} />
              <button
                type="button"
                className="btn ghost sm"
                onClick={() => setSocialList([...socialList, { contact_id: 0, platform: 'Instagram', handle: '' }])}
                style={{ fontSize: 9, minHeight: 44 }}
              >
                +
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {socialList.map((s, i) => (
                <div key={i} style={rowFlex}>
                  <select
                    value={s.platform}
                    onChange={(ev) =>
                      setSocialList(socialList.map((x, j) => (i === j ? { ...x, platform: ev.target.value } : x)))
                    }
                    style={{ ...FIS, flex: narrow ? undefined : 1 }}
                  >
                    <option value="Instagram">Instagram</option>
                    <option value="LinkedIn">LinkedIn</option>
                    <option value="Facebook">Facebook</option>
                    <option value="X">X (Twitter)</option>
                    <option value="Behance">Behance</option>
                    <option value="Vimeo">Vimeo</option>
                    <option value="Pinterest">Pinterest</option>
                    <option value="Autre">Autre</option>
                  </select>
                  <input
                    value={s.handle}
                    onChange={(ev) =>
                      setSocialList(socialList.map((x, j) => (i === j ? { ...x, handle: ev.target.value } : x)))
                    }
                    placeholder="@handle or URL"
                    style={{ ...FIS, flex: narrow ? undefined : 2 }}
                  />
                  <button type="button" className="btn ghost sm" style={{ minHeight: 44 }} onClick={() => setSocialList(socialList.filter((_, j) => i !== j))}>
                    ✕
                  </button>
                </div>
              ))}
              {socialList.length === 0 && (
                <div className="t-mono-sm" style={{ color: 'var(--tx3)', opacity: 0.5 }}>
                  {t('contactEditorNoSocials')}
                </div>
              )}
            </div>

            <Section title={t('contactEditorSectionAddresses')} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {addrList.map((addr, i) => (
                <div
                  key={i}
                  style={{
                    border: '1px solid var(--bd)',
                    padding: '14px 16px',
                    background: 'var(--bg0)',
                    position: 'relative',
                    marginBottom: 4,
                  }}
                >
                  {addrList.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeAddr(i)}
                      style={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        background: 'none',
                        border: 'none',
                        color: 'var(--tx3)',
                        cursor: 'pointer',
                        fontSize: 10,
                      }}
                    >
                      ✕
                    </button>
                  )}
                  <Grid2 narrow={narrow}>
                    <FRow label={t('contactEditorAddrLabel')}>
                      <input
                        value={addr.label}
                        onChange={(e) => updateAddr(i, 'label', e.target.value)}
                        onBlur={(e) => updateAddr(i, 'label', cap(e.target.value))}
                        placeholder={t('contactEditorAddrLabelPh')}
                        style={FIS}
                      />
                    </FRow>
                    <FRow label={t('contactEditorPostal')}>
                      <input value={addr.code_postal} onChange={(e) => updateAddr(i, 'code_postal', e.target.value)} placeholder="75001…" style={FIS} />
                    </FRow>
                    <FRow label={t('contactEditorCity')}>
                      <input
                        value={addr.ville}
                        onChange={(e) => updateAddr(i, 'ville', e.target.value)}
                        onBlur={(e) => updateAddr(i, 'ville', cap(e.target.value))}
                        style={FIS}
                      />
                    </FRow>
                    <FRow label={t('contactEditorCountry')}>
                      <input
                        value={addr.pays}
                        onChange={(e) => updateAddr(i, 'pays', e.target.value)}
                        onBlur={(e) => updateAddr(i, 'pays', cap(e.target.value))}
                        style={FIS}
                      />
                    </FRow>
                  </Grid2>
                  <div style={{ marginTop: 8 }}>
                    <FRow label={t('contactEditorStreet')}>
                      <input
                        value={addr.adresse}
                        onChange={(e) => updateAddr(i, 'adresse', e.target.value)}
                        onBlur={(e) => updateAddr(i, 'adresse', cap(e.target.value))}
                        style={FIS}
                      />
                    </FRow>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <FRow label={t('contact_editor_complement')}>
                      <input
                        value={addr.complement}
                        onChange={(e) => updateAddr(i, 'complement', e.target.value)}
                        placeholder={t('contact_editor_complement_ph')}
                        style={FIS}
                      />
                    </FRow>
                  </div>
                  {addr.id != null && (initialAddresses.find((a) => a.id === addr.id)?.others ?? 0) > 0 && (
                    <div className="t-mono-sm" style={{ marginTop: 6, color: 'var(--tx3)' }}>
                      {t('contact_editor_place_others_fmt').replace(
                        '{n}',
                        String(initialAddresses.find((a) => a.id === addr.id)?.others ?? 0),
                      )}
                    </div>
                  )}
                  <div style={{ marginTop: 8 }}>
                    <FRow label={t('contactEditorShippingNotes')}>
                      <input
                        value={addr.shipping_notes}
                        onChange={(e) => updateAddr(i, 'shipping_notes', e.target.value)}
                        placeholder={t('contactEditorShippingNotesPh')}
                        style={FIS}
                      />
                    </FRow>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={addAddr}
                style={{
                  background: 'none',
                  border: '1px dashed var(--bd)',
                  color: 'var(--tx3)',
                  padding: '8px',
                  cursor: 'pointer',
                  fontSize: 10,
                  letterSpacing: 0.5,
                  textAlign: 'center',
                  minHeight: 44,
                }}
              >
                {t('contactEditorAddAddress')}
              </button>
            </div>

            <Section title={t('contactEditorSectionNotes')} />
            <textarea
              value={form.Notes}
              onChange={f('Notes')}
              rows={3}
              style={{ ...FIS, resize: 'vertical', lineHeight: 1.6 }}
              placeholder={t('contactEditorNotesPh')}
            />

            {!isNew && (
              <>
                {works.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <WorkMini label={t('contactEditorWorksLinked')} items={works} />
                    <button
                      type="button"
                      className="btn sm ghost"
                      onClick={() => {
                        const win = window as unknown as { setSelection?: (s: Set<number>) => void }
                        if (win.setSelection) {
                          win.setSelection(new Set(works.map((o) => o.OeuvreID)))
                          window.alert(`${works.length} ${t('contactEditorWorksSelectedTail')}`)
                        }
                      }}
                      style={{ width: '100%', fontSize: 9, minHeight: 44 }}
                    >
                      {`${t('contactEditorSelectWorks')} (${works.length})`}
                    </button>
                  </div>
                )}
                {locs.length > 0 && <WorkMini label={t('contactEditorWorksLoc')} items={locs} />}
                {buys.length > 0 && <WorkMini label={t('contactEditorWorksBuyer')} items={buys} />}
                <ContactKitsSection contactId={contact!.ContactID} />
              </>
            )}

            {err && (
              <div style={{ fontSize: 11, color: 'var(--rust)', marginTop: 10 }}>{err}</div>
            )}
          </div>

          <div
            style={{
              flexShrink: 0,
              borderTop: '1px solid var(--bd)',
              padding: narrow
                ? '10px max(12px, env(safe-area-inset-right)) max(12px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left))'
                : '12px 20px',
              background: 'var(--bg1)',
              display: 'flex',
              gap: 8,
              justifyContent: 'flex-end',
              flexWrap: 'wrap',
            }}
          >
            <button type="button" className="btn ghost sm" onClick={attemptClose} disabled={busy} style={{ minHeight: 44 }}>
              {t('cancel')}
            </button>
            <button type="button" className="btn primary sm" onClick={() => void handleSave()} disabled={busy} style={{ minHeight: 44 }}>
              {busy ? '…' : isNew ? t('contactEditorCreate') : t('save')}
            </button>
          </div>
        </div>
      </>
    )
  },
)

ContactEditorPanel.displayName = 'ContactEditorPanel'
