'use client'

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
import { createClient } from '@/lib/supabase/client'
import { useI18n } from '@/lib/i18n/context'
import { useUnsavedCloseGuard } from '@/hooks/useUnsavedCloseGuard'
import type { Oeuvre } from '@/lib/types/database'
import type {
  ContactAddress,
  ContactEmail,
  ContactPhone,
  ContactRow,
  ContactSocial,
  ContactWebsite,
} from '@/components/atelier/contact-editor-types'

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
  Website: string
  Instagram: string
  LinkedIn: string
  Facebook: string
  Twitter: string
  PersonneResponsable: string
  RoleResponsable: string
  Notes: string
  Actif: boolean
  is_private: boolean
}

type AddrForm = {
  id?: number
  label: string
  adresse: string
  code_postal: string
  ville: string
  pays: string
  shipping_notes: string
}

function emptyAddr(): AddrForm {
  return { label: '', adresse: '', code_postal: '', ville: '', pays: '', shipping_notes: '' }
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
            #{o.OeuvreID} {o.Titre ?? '—'}
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
  /** Bump after successful save (same contact) so dirty baseline resets */
  baselineEpoch: number
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
      baselineEpoch,
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
      Website: contact?.Website ?? '',
      Instagram: contact?.Instagram ?? '',
      LinkedIn: contact?.LinkedIn ?? '',
      Facebook: contact?.Facebook ?? '',
      Twitter: contact?.Twitter ?? '',
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
            shipping_notes: a.shipping_notes ?? '',
          }))
        : [
            {
              label: 'Principal',
              adresse: contact?.Adresse ?? '',
              code_postal: contact?.CodePostal ?? '',
              ville: contact?.Ville ?? '',
              pays: contact?.Pays ?? '',
              shipping_notes: '',
            },
          ],
    )

    const [emailList, setEmailList] = useState<ContactEmail[]>(initialEmails)
    const [phoneList, setPhoneList] = useState<ContactPhone[]>(initialPhones)
    const [webList, setWebList] = useState<ContactWebsite[]>(initialWebsites)
    const [socialList, setSocialList] = useState<ContactSocial[]>(initialSocials)

    const [busy, setBusy] = useState(false)
    const [err, setErr] = useState<string | null>(null)

    const contactKey = contact?.ContactID ?? 'new'

    function f(k: keyof Omit<FormState, 'Actif'>) {
      return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setForm((p) => ({ ...p, [k]: e.target.value }))
      }
    }

    function b(k: keyof Omit<FormState, 'Actif' | 'Email' | 'Website' | 'Instagram' | 'LinkedIn' | 'Facebook' | 'Twitter' | 'Notes'>) {
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
        const sb = createClient()
        const validAddrs = addrList.filter((a) => a.adresse || a.ville || a.pays || a.code_postal)
        const primaryVille = validAddrs[0]?.ville || null
        const primaryPays = validAddrs[0]?.pays || null

        const payload: Record<string, unknown> = {
          NomInstitution: form.NomInstitution || null,
          Nom: form.Nom || null,
          Prénom: form.Prénom || null,
          Genre: form.Genre || null,
          Role: form.Role || null,
          Email: form.Email || null,
          IndicatifPays1: form.IndicatifPays1 || null,
          Téléphone1: form.Téléphone1 || null,
          IndicatifPays2: form.IndicatifPays2 || null,
          Téléphone2: form.Téléphone2 || null,
          Website: form.Website || null,
          Adresse: validAddrs[0]?.adresse || null,
          CodePostal: validAddrs[0]?.code_postal || null,
          Ville: primaryVille,
          Pays: primaryPays,
          Instagram: form.Instagram || null,
          LinkedIn: form.LinkedIn || null,
          Facebook: form.Facebook || null,
          Twitter: form.Twitter || null,
          PersonneResponsable: form.PersonneResponsable || null,
          RoleResponsable: form.RoleResponsable || null,
          Notes: form.Notes || null,
          Actif: form.Actif,
          is_private: isAdminUser ? form.is_private : false,
        }

        let contactId: number
        const normalizedRole = form.Role === 'Encadreur' ? 'Framer' : form.Role
        payload.Role = normalizedRole

        if (isNew) {
          const { data: maxRow } = await (sb.from('Contact') as any)
            .select('ContactID')
            .order('ContactID', { ascending: false })
            .limit(1)
            .single()
          contactId = ((maxRow as { ContactID?: number })?.ContactID ?? 0) + 1
          payload.ContactID = contactId
          const { error } = await (sb.from('Contact') as any).insert(payload)
          if (error) throw new Error((error as { message?: string }).message)
        } else {
          contactId = contact!.ContactID
          const { error } = await (sb.from('Contact') as any).update(payload).eq('ContactID', contactId)
          if (error) throw new Error((error as { message?: string }).message)
        }

        await Promise.all([
          (sb.from('contact_addresses') as any).delete().eq('contact_id', contactId),
          (sb.from('contact_emails') as any).delete().eq('contact_id', contactId),
          (sb.from('contact_phones') as any).delete().eq('contact_id', contactId),
          (sb.from('contact_websites') as any).delete().eq('contact_id', contactId),
          (sb.from('contact_socials') as any).delete().eq('contact_id', contactId),
        ])

        let savedAddrs: ContactAddress[] = []
        if (validAddrs.length > 0) {
          const insertRows = validAddrs.map((a, i) => ({
            contact_id: contactId,
            label: a.label || (validAddrs.length === 1 ? 'Principal' : `Adresse ${i + 1}`),
            adresse: a.adresse || null,
            code_postal: a.code_postal || null,
            ville: a.ville || null,
            pays: a.pays || null,
            position: i,
            shipping_notes: a.shipping_notes || null,
          }))
          const { data, error } = await (sb.from('contact_addresses') as any).insert(insertRows).select()
          if (error) throw error
          savedAddrs = data || []
        }

        let savedEmails: ContactEmail[] = []
        if (emailList.length > 0) {
          const rows = emailList.map((e) => ({
            contact_id: contactId,
            email: e.email,
            label: e.label,
            is_primary: e.is_primary,
          }))
          const { data, error } = await (sb.from('contact_emails') as any).insert(rows).select()
          if (error) throw error
          savedEmails = data || []
        }

        let savedPhones: ContactPhone[] = []
        if (phoneList.length > 0) {
          const rows = phoneList.map((p) => ({
            contact_id: contactId,
            phone: p.phone,
            country_code: p.country_code,
            label: p.label,
            is_primary: p.is_primary,
          }))
          const { data, error } = await (sb.from('contact_phones') as any).insert(rows).select()
          if (error) throw error
          savedPhones = data || []
        }

        let savedWebs: ContactWebsite[] = []
        if (webList.length > 0) {
          const rows = webList.map((w) => ({ contact_id: contactId, url: w.url, label: w.label }))
          const { data, error } = await (sb.from('contact_websites') as any).insert(rows).select()
          if (error) throw error
          savedWebs = data || []
        }

        let savedSocials: ContactSocial[] = []
        if (socialList.length > 0) {
          const rows = socialList.map((s) => ({ contact_id: contactId, platform: s.platform, handle: s.handle }))
          const { data, error } = await (sb.from('contact_socials') as any).insert(rows).select()
          if (error) throw error
          savedSocials = data || []
        }

        const savedContact = { ContactID: contactId, ...payload } as ContactRow
        if (isNew) {
          onCreated(savedContact, savedAddrs, savedEmails, savedPhones, savedWebs, savedSocials)
        } else {
          onUpdated(savedContact, savedAddrs, savedEmails, savedPhones, savedWebs, savedSocials)
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
      webList,
    ])

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
            flex: narrow ? 'none' : '0 0 min(420px, 42vw)',
            width: narrow ? '100%' : undefined,
            maxWidth: narrow ? '100%' : undefined,
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
