'use client'

// ContactsTab — searchable, filterable contact list with full field set + edit/create.
// Supports multiple addresses per contact via contact_addresses table.

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useState, useMemo, useEffect, useCallback, useLayoutEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  checkOllamaListening,
  deleteContacts,
  importGoogleContacts,
  mergeContacts,
  previewContactFromUrl,
  saveContactWithConflictCheck,
  type ImportedContact,
  type UrlEnrichMeta,
} from '@/app/atelier/(portal)/contacts/actions'
import { runOllamaInstructionScript } from '@/app/atelier/ollama/actions'
import { OLLAMA_SCRIPT_INSTRUCTIONS } from '@/lib/ollama-script'
import { useI18n } from '@/lib/i18n/context'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { toast } from '@/lib/ui/toast'
import { useUnsavedActionGuard } from '@/hooks/useUnsavedActionGuard'
import { useUnsavedCloseGuard } from '@/hooks/useUnsavedCloseGuard'
import type { Oeuvre } from '@/lib/types/database'
import {
  ContactEditorPanel,
  type ContactEditorPanelHandle,
} from '@/components/atelier/ContactEditorPanel'
import type {
  ContactAddress,
  ContactEmail,
  ContactPhone,
  ContactRow,
  ContactSocial,
  ContactWebsite,
} from '@/components/atelier/contact-editor-types'

function SortInd({ k, current, dir }: { k: string; current: string; dir: 'asc' | 'desc' }) {
  if (k !== current) return <span style={{ opacity: 0.2, marginLeft: 4, fontSize: 13 }}>↕</span>
  return <span style={{ color: 'var(--ac)', marginLeft: 4, fontSize: 13 }}>{dir === 'asc' ? '↑' : '↓'}</span>
}

// ── Types ────────────────────────────────────────────────────────────

interface Props {
  contacts: ContactRow[]
  oeuvres:  Oeuvre[]
  conflicts?: any[]
}

// ── Helpers ──────────────────────────────────────────────────────────

function displayName(c: ContactRow): string {
  return c.NomInstitution || `${c.Prénom ?? ''} ${c.Nom ?? ''}`.trim() || `#${c.ContactID}`
}

function fmtPhone(ind: string | null | undefined, num: string | null | undefined): string | null {
  if (!num) return null
  return ind ? `${ind} ${num}` : num
}

/** First primary or first row, else legacy Contact.Email */
function primaryListEmail(
  id: number,
  extra: Record<number, ContactRow>,
  byContact: Record<number, ContactEmail[]>,
): string {
  const list = byContact[id] ?? []
  const prim = list.find((e) => e.is_primary)
  return prim?.email ?? list[0]?.email ?? extra[id]?.Email ?? ''
}

/** First primary or first phone row, else legacy Téléphone1 */
function primaryListPhone(
  id: number,
  extra: Record<number, ContactRow>,
  byContact: Record<number, ContactPhone[]>,
): string {
  const list = byContact[id] ?? []
  const prim = list.find((p) => p.is_primary)
  const row = prim ?? list[0]
  if (row) return fmtPhone(row.country_code, row.phone) ?? row.phone
  return fmtPhone(extra[id]?.IndicatifPays1, extra[id]?.Téléphone1) ?? ''
}

// ── Component ────────────────────────────────────────────────────────

export function ContactsTab({ contacts: initialContacts, oeuvres, conflicts = [] }: Props) {
  const { t, lang } = useI18n()
  const listLocale = lang === 'fr' ? 'fr-FR' : 'en-GB'
  const narrow = useMediaQuery('(max-width: 767px)')
  const [quickBusy, setQuickBusy] = useState(false)
  const [isAdmin,    setIsAdmin]    = useState(false)
  const [contacts,   setContacts]   = useState<ContactRow[]>(initialContacts)
  const [q,          setQ]          = useState('')
  const [searchBy,   setSearchBy]   = useState('all')
  const [role,       setRole]       = useState('all')
  const [sortKey,    setSortKey]    = useState<string>('alpha')
  const [sortDir,    setSortDir]    = useState<'asc' | 'desc'>('asc')
  const toggleSort = (k: string) => {
    if (sortKey === k) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(k)
      setSortDir('asc')
    }
  }
  const [activeId,   setActiveId]   = useState<number | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [editorNonce, setEditorNonce] = useState(0)
  const [editorDirty, setEditorDirty] = useState(false)
  const editorRef = useRef<ContactEditorPanelHandle | null>(null)
  const pendingProceedRef = useRef<(() => void) | null>(null)
  const activeIdRef = useRef<number | null>(null)
  useEffect(() => {
    activeIdRef.current = activeId
  }, [activeId])
  const [selected,   setSelected]   = useState<Set<number>>(new Set())
  const [busy,       setBusy]       = useState(false)
  const [importing,  setImporting]  = useState(false)
  const [urlModalOpen, setUrlModalOpen] = useState(false)

  // Full contact data fetched client-side (extra fields not in server prop)
  const [extra,      setExtra]      = useState<Record<number, ContactRow>>({})
  // Multiple data per contact
  const [addresses,  setAddresses]  = useState<Record<number, ContactAddress[]>>({})
  const [emails,     setEmails]     = useState<Record<number, ContactEmail[]>>({})
  const [phones,     setPhones]     = useState<Record<number, ContactPhone[]>>({})
  const [websites,   setWebsites]   = useState<Record<number, ContactWebsite[]>>({})
  const [socials,    setSocials]    = useState<Record<number, ContactSocial[]>>({})

  // List of all roles from tblRole
  const [allRoles,   setAllRoles]   = useState<string[]>([])

  /** Same loads as mount — must run after merge/import so list + editor junctions match DB. */
  const refreshContactsClientData = useCallback(async (): Promise<boolean> => {
    const sb = createClient()
    try {
      const [
        adminRes,
        listRes,
        extraRes,
        addrRes,
        emailRes,
        phoneRes,
        webRes,
        socialRes,
        rolesRes,
      ] = await Promise.all([
        sb.rpc('is_admin'),
        sb.from('Contact')
          .select('ContactID, NomInstitution, Nom, "Prénom", Role, Ville, Pays, is_private')
          .order('ContactID'),
        sb.from('Contact')
          .select('ContactID, Email, IndicatifPays1, "Téléphone1", IndicatifPays2, "Téléphone2", Website, Adresse, CodePostal, Ville, Pays, Notes, Instagram, LinkedIn, Facebook, Twitter, PersonneResponsable, RoleResponsable, Actif, Genre, is_team_member, auth_user_id'),
        sb.from('contact_addresses')
          .select('id, contact_id, label, adresse, code_postal, ville, pays, position, shipping_notes')
          .order('position'),
        sb.from('contact_emails').select('*'),
        sb.from('contact_phones').select('*'),
        sb.from('contact_websites').select('*'),
        sb.from('contact_socials').select('*'),
        sb.from('tblRole').select('Nom').order('Nom'),
      ])

      if (adminRes.error) throw adminRes.error
      if (listRes.error) throw listRes.error
      if (extraRes.error) throw extraRes.error
      if (addrRes.error) throw addrRes.error
      if (emailRes.error) throw emailRes.error
      if (phoneRes.error) throw phoneRes.error
      if (webRes.error) throw webRes.error
      if (socialRes.error) throw socialRes.error
      if (rolesRes.error) throw rolesRes.error

      setIsAdmin(!!adminRes.data)
      if (listRes.data) setContacts(listRes.data as ContactRow[])

      const extraMap: Record<number, ContactRow> = {}
      for (const r of (extraRes.data ?? []) as ContactRow[]) extraMap[r.ContactID] = r
      setExtra(extraMap)

      const addrMap: Record<number, ContactAddress[]> = {}
      for (const a of (addrRes.data ?? []) as ContactAddress[]) {
        if (!addrMap[a.contact_id]) addrMap[a.contact_id] = []
        addrMap[a.contact_id].push(a)
      }
      setAddresses(addrMap)

      const emailMap: Record<number, ContactEmail[]> = {}
      for (const x of (emailRes.data ?? []) as ContactEmail[]) {
        if (!emailMap[x.contact_id]) emailMap[x.contact_id] = []
        emailMap[x.contact_id].push(x)
      }
      setEmails(emailMap)

      const phoneMap: Record<number, ContactPhone[]> = {}
      for (const x of (phoneRes.data ?? []) as ContactPhone[]) {
        if (!phoneMap[x.contact_id]) phoneMap[x.contact_id] = []
        phoneMap[x.contact_id].push(x)
      }
      setPhones(phoneMap)

      const webMap: Record<number, ContactWebsite[]> = {}
      for (const x of (webRes.data ?? []) as ContactWebsite[]) {
        if (!webMap[x.contact_id]) webMap[x.contact_id] = []
        webMap[x.contact_id].push(x)
      }
      setWebsites(webMap)

      const socialMap: Record<number, ContactSocial[]> = {}
      for (const x of (socialRes.data ?? []) as ContactSocial[]) {
        if (!socialMap[x.contact_id]) socialMap[x.contact_id] = []
        socialMap[x.contact_id].push(x)
      }
      setSocials(socialMap)

      if (rolesRes.data) {
        setAllRoles((rolesRes.data as { Nom: string }[]).map((r) => r.Nom).filter(Boolean))
      }
      return true
    } catch (err) {
      console.error('[contacts refresh]', err)
      toast.error(`${t('error_prefix')} ${err instanceof Error ? err.message : String(err)}`)
      return false
    }
  }, [t])

  useEffect(() => {
    refreshContactsClientData()
  }, [refreshContactsClientData])

  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Auto-open a contact card when navigated from Map / share-triage / capture
  useEffect(() => {
    const fromQuery = searchParams.get('contact')
    if (fromQuery) {
      const id = parseInt(fromQuery, 10)
      if (!isNaN(id)) setActiveId(id)
      const next = new URLSearchParams(searchParams.toString())
      next.delete('contact')
      const q = next.toString()
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false })
      return
    }
    const raw = sessionStorage.getItem('pem_open_contact')
    if (!raw) return
    sessionStorage.removeItem('pem_open_contact')
    const id = parseInt(raw, 10)
    if (!isNaN(id)) setActiveId(id)
  }, [pathname, router, searchParams])

  // Work counts
  const workCounts = useMemo(() => {
    const owner: Record<number, number> = {}
    const loc:   Record<number, number> = {}
    const buyer: Record<number, number> = {}
    oeuvres.forEach((o) => {
      if (o.ContactID      != null) owner[o.ContactID]      = (owner[o.ContactID]      ?? 0) + 1
      if (o.LocalisationID != null) loc[o.LocalisationID]   = (loc[o.LocalisationID]   ?? 0) + 1
      if (o.AcheteurID     != null) buyer[o.AcheteurID]     = (buyer[o.AcheteurID]     ?? 0) + 1
    })
    return { owner, loc, buyer }
  }, [oeuvres])

  const roles = useMemo(() => {
    const set = new Set<string>(allRoles)
    contacts.forEach((c) => { if (c.Role) set.add(c.Role) })
    return [...set].sort((a, b) => a.localeCompare(b, listLocale))
  }, [contacts, allRoles, listLocale])

  const listVille = useCallback((id: number): string => {
    const addrs = addresses[id]
    if (addrs && addrs.length > 0) {
      const cities = addrs.map((a) => a.ville).filter(Boolean) as string[]
      if (cities.length > 0) return cities.join(' / ')
    }
    return extra[id]?.Ville ?? '—'
  }, [addresses, extra])

  const filtered = useMemo(() => {
    const sq = q.trim().toLowerCase()
    const base = contacts.filter((c) => {
      if (role !== 'all' && c.Role !== role) return false
      if (sq) {
        const id = c.ContactID
        const ex = extra[id]
        const addrs = addresses[id] ?? []
        const addrStr = addrs.map((a) => [a.ville, a.pays, a.adresse, a.label].filter(Boolean).join(' ')).join(' ')
        const emailRows = emails[id] ?? []
        const phoneRows = phones[id] ?? []
        const webRows = websites[id] ?? []
        const socialRows = socials[id] ?? []
        const multiEmailStr = emailRows.map((e) => e.email).join(' ')
        const multiPhoneStr = phoneRows.map((p) => fmtPhone(p.country_code, p.phone) ?? p.phone).join(' ')
        const webStr = webRows.map((w) => `${w.url} ${w.label}`).join(' ')
        const socialStr = socialRows.map((s) => `${s.platform} ${s.handle}`).join(' ')

        let target = ''
        if (searchBy === 'all') {
          target = [
            c.NomInstitution, c.Nom, c.Prénom, c.Role,
            multiEmailStr, ex?.Email,
            multiPhoneStr, ex?.Téléphone1, ex?.Téléphone2,
            webStr, ex?.Website,
            ex?.Notes,
            ex?.Instagram, ex?.LinkedIn, ex?.Facebook, ex?.Twitter,
            socialStr,
            ex?.PersonneResponsable, ex?.RoleResponsable,
            addrStr,
          ].filter(Boolean).join(' ')
        } else if (searchBy === 'name') {
          target = [c.NomInstitution, c.Nom, c.Prénom].filter(Boolean).join(' ')
        } else if (searchBy === 'city') {
          target = addrStr || [c.Ville, c.Pays].filter(Boolean).join(' ')
        } else if (searchBy === 'email') {
          target = [multiEmailStr, ex?.Email].filter(Boolean).join(' ')
        } else if (searchBy === 'notes') {
          target = ex?.Notes || ''
        }

        if (!target.toLowerCase().includes(sq)) return false
      }
      return true
    })
    
    const list = [...base]
    list.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1
      
      if (sortKey === 'alpha') {
        return displayName(a).localeCompare(displayName(b), listLocale) * dir
      }
      if (sortKey === 'role') {
        const ra = (a.Role || 'Zzz').toLowerCase()
        const rb = (b.Role || 'Zzz').toLowerCase()
        if (ra !== rb) return ra.localeCompare(rb, listLocale) * dir
        return displayName(a).localeCompare(displayName(b), listLocale) * dir
      }
      if (sortKey === 'ContactID') {
        return (a.ContactID - b.ContactID) * dir
      }
      if (sortKey === 'ville') {
        return listVille(a.ContactID).localeCompare(listVille(b.ContactID), listLocale) * dir
      }
      if (sortKey === 'email') {
        const ea = primaryListEmail(a.ContactID, extra, emails)
        const eb = primaryListEmail(b.ContactID, extra, emails)
        return ea.localeCompare(eb, listLocale) * dir
      }
      if (sortKey === 'phone') {
        const pa = primaryListPhone(a.ContactID, extra, phones)
        const pb = primaryListPhone(b.ContactID, extra, phones)
        return pa.localeCompare(pb, listLocale) * dir
      }
      if (sortKey === 'works') {
        return ((workCounts.owner[a.ContactID] || 0) - (workCounts.owner[b.ContactID] || 0)) * dir
      }
      if (sortKey === 'loc') {
        return ((workCounts.loc[a.ContactID] || 0) - (workCounts.loc[b.ContactID] || 0)) * dir
      }
      if (sortKey === 'buyer') {
        return ((workCounts.buyer[a.ContactID] || 0) - (workCounts.buyer[b.ContactID] || 0)) * dir
      }
      return 0
    })
    return list
  }, [contacts, q, role, searchBy, sortKey, sortDir, extra, addresses, emails, phones, websites, socials, workCounts, listVille, listLocale])

  const handleCreated = useCallback((c: ContactRow, addrs: ContactAddress[], e: ContactEmail[], p: ContactPhone[], w: ContactWebsite[], s: ContactSocial[]) => {
    setContacts((prev) => [...prev, c])
    setExtra((prev) => ({ ...prev, [c.ContactID]: c }))
    setAddresses((prev) => ({ ...prev, [c.ContactID]: addrs }))
    setEmails((prev) => ({ ...prev, [c.ContactID]: e }))
    setPhones((prev) => ({ ...prev, [c.ContactID]: p }))
    setWebsites((prev) => ({ ...prev, [c.ContactID]: w }))
    setSocials((prev) => ({ ...prev, [c.ContactID]: s }))
    setActiveId(c.ContactID)
    setIsCreating(false)
    setEditorNonce((n) => n + 1)
  }, [])

  const handleUpdated = useCallback((c: ContactRow, addrs: ContactAddress[], e: ContactEmail[], p: ContactPhone[], w: ContactWebsite[], s: ContactSocial[]) => {
    setContacts((prev) => prev.map((x) => x.ContactID === c.ContactID ? { ...x, ...c } : x))
    setExtra((prev) => ({ ...prev, [c.ContactID]: { ...prev[c.ContactID], ...c } }))
    setAddresses((prev) => ({ ...prev, [c.ContactID]: addrs }))
    setEmails((prev) => ({ ...prev, [c.ContactID]: e }))
    setPhones((prev) => ({ ...prev, [c.ContactID]: p }))
    setWebsites((prev) => ({ ...prev, [c.ContactID]: w }))
    setSocials((prev) => ({ ...prev, [c.ContactID]: s }))
    setEditorNonce((n) => n + 1)
  }, [])

  const handleTeamAccessUpdated = useCallback(
    (patch: Pick<ContactRow, 'ContactID' | 'is_team_member' | 'auth_user_id' | 'Email'>) => {
      setExtra((prev) => ({
        ...prev,
        [patch.ContactID]: { ...prev[patch.ContactID], ...patch },
      }))
    },
    [],
  )

  const dismissEditor = useCallback(() => {
    setIsCreating(false)
    setActiveId(null)
  }, [])

  const { attemptAction: attemptUnsavedProceed, unsavedDialog: navUnsavedDialog } = useUnsavedActionGuard({
    isDirty: editorDirty,
    onProceed: () => {
      pendingProceedRef.current?.()
      pendingProceedRef.current = null
    },
    performSave: async () => editorRef.current?.save() ?? Promise.resolve(false),
  })

  const requestSelectContact = useCallback(
    (id: number) => {
      if (id === activeId && !isCreating) return
      const go = () => {
        setActiveId(id)
        setIsCreating(false)
      }
      if (!editorDirty) {
        go()
        return
      }
      pendingProceedRef.current = go
      attemptUnsavedProceed()
    },
    [activeId, attemptUnsavedProceed, editorDirty, isCreating],
  )

  const requestStartCreate = useCallback(() => {
    const go = () => {
      setIsCreating(true)
      setActiveId(null)
    }
    if (!editorDirty) {
      go()
      return
    }
    pendingProceedRef.current = go
    attemptUnsavedProceed()
  }, [attemptUnsavedProceed, editorDirty])

  const requestOpenBatch = useCallback(() => {
    const go = () => setBatchEditing(true)
    if (!editorDirty) {
      go()
      return
    }
    pendingProceedRef.current = go
    attemptUnsavedProceed()
  }, [attemptUnsavedProceed, editorDirty])

  const requestOpenMerge = useCallback(
    (pair: [number, number], keepId: number) => {
      const go = () => {
        setMergePair(pair)
        setMergeKeepId(keepId)
        setMergeOpen(true)
      }
      if (!editorDirty) {
        go()
        return
      }
      pendingProceedRef.current = go
      attemptUnsavedProceed()
    },
    [attemptUnsavedProceed, editorDirty],
  )

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set())
    else setSelected(new Set(filtered.map(c => c.ContactID)))
  }

  const toggleOne = (id: number) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  const [batchEditing, setBatchEditing] = useState(false)
  const [mergeOpen, setMergeOpen] = useState(false)
  const [mergePair, setMergePair] = useState<[number, number] | null>(null)
  const [mergeKeepId, setMergeKeepId] = useState<number | null>(null)

  async function handleBatchSave(data: { Role?: string; Actif?: boolean; Notes?: string; appendNotes?: boolean }): Promise<boolean> {
    setBusy(true)
    const sb = createClient()
    const ids = Array.from(selected)
    
    try {
      const updates: Record<number, any> = {}
      for (const id of ids) {
        const update: any = {}
        if (data.Role !== undefined) update.Role = data.Role === 'Encadreur' ? 'Framer' : data.Role
        if (data.Actif !== undefined) update.Actif = data.Actif
        if (data.Notes !== undefined) {
          if (data.appendNotes) {
            const currentNotes = extra[id]?.Notes || ''
            update.Notes = currentNotes ? `${currentNotes}\n${data.Notes}` : data.Notes
          } else {
            update.Notes = data.Notes
          }
        }

        const { error } = await (sb.from('Contact') as any).update(update).eq('ContactID', id)
        if (error) throw error
        updates[id] = update
      }

      // Bulk local update
      setContacts(prev => prev.map(c => updates[c.ContactID] ? { ...c, ...updates[c.ContactID] } : c))
      setExtra(prev => {
        const next = { ...prev }
        Object.entries(updates).forEach(([id, u]) => {
          const numId = parseInt(id)
          next[numId] = { ...next[numId], ...u }
        })
        return next
      })

      setSelected(new Set())
      setBatchEditing(false)
      return true
    } catch (err) {
      alert(`${t('error_prefix')} ${err instanceof Error ? err.message : String(err)}`)
      return false
    } finally {
      setBusy(false)
    }
  }

  async function handleDeleteSelected() {
    if (!selected.size) return
    if (!confirm(t('contacts_delete_n_confirm_fmt').replace('{n}', String(selected.size)))) return
    setBusy(true)
    const ids = Array.from(selected)
    const res = await deleteContacts(ids)
    if ('error' in res) { alert(`${t('error_prefix')} ${res.error}`); setBusy(false); return }
    setContacts(prev => prev.filter(c => !selected.has(c.ContactID)))
    setSelected(new Set())
    if (activeId && selected.has(activeId)) {
      setActiveId(null)
      setIsCreating(false)
    }
    setBusy(false)
  }

  async function handleQuickAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setQuickBusy(true)
    const fd = new FormData(e.currentTarget)
    const res = await saveContactWithConflictCheck(fd)
    setQuickBusy(false)
    if ('error' in res) {
      toast.error(`${t('error_prefix')} ${res.error}`)
      return
    }
    toast.success(t('saveDoneUndoHint'))
    e.currentTarget.reset()
    refreshContactsClientData()
    window.setTimeout(() => setActiveId(res.id), 500)
  }

  const handleDeleteOne = useCallback(async (id: number) => {
    if (!confirm(t('contactDeleteOneConfirm'))) return
    setBusy(true)
    const res = await deleteContacts([id])
    if ('error' in res) { alert(`${t('error_prefix')} ${res.error}`); setBusy(false); return }
    setContacts(prev => prev.filter(c => c.ContactID !== id))
    if (activeIdRef.current === id) {
      setActiveId(null)
      setIsCreating(false)
    }
    setBusy(false)
  }, [t])

  const requestDeleteActive = useCallback(() => {
    if (activeId == null) return
    const id = activeId
    const go = () => void handleDeleteOne(id)
    if (!editorDirty) {
      void go()
      return
    }
    pendingProceedRef.current = go
    attemptUnsavedProceed()
  }, [activeId, attemptUnsavedProceed, editorDirty, handleDeleteOne])

  const showEditor = isCreating || activeId != null
  const editorSourceRow = activeId != null ? contacts.find((c) => c.ContactID === activeId) ?? null : null
  const editorContactResolved: ContactRow | null =
    !isCreating && activeId != null && editorSourceRow ? { ...editorSourceRow, ...extra[activeId] } : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {navUnsavedDialog}

      {narrow && !showEditor && (
        <div
          data-testid="contacts-quick-add"
          style={{
            flexShrink: 0,
            borderBottom: '1px solid var(--bd)',
            padding: '12px max(12px, env(safe-area-inset-right)) 14px max(12px, env(safe-area-inset-left))',
            background: 'var(--bg1)',
          }}
        >
          <div className="t-eyebrow" style={{ marginBottom: 10, color: 'var(--tx3)' }}>{t('contacts_quick_title')}</div>
          <form onSubmit={(e) => void handleQuickAdd(e)} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input name="institution" placeholder={t('contacts_quick_inst')} style={{ ...FIS, minHeight: 44 }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <input name="prenom" placeholder={t('contacts_quick_first')} style={{ ...FIS, minHeight: 44 }} />
              <input name="nom" placeholder={t('contacts_quick_last')} style={{ ...FIS, minHeight: 44 }} />
            </div>
            <input name="email" type="email" placeholder={t('contacts_quick_email')} style={{ ...FIS, minHeight: 44 }} />
            <label className="t-mono-sm" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: 'var(--tx2)' }}>
              <input type="checkbox" name="is_private" value="true" style={{ width: 18, height: 18 }} />
              {t('contacts_quick_private')}
            </label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingBottom: 'max(4px, env(safe-area-inset-bottom, 0px))' }}>
              <button type="submit" className="btn sm" disabled={quickBusy} style={{ minHeight: 44, flex: 1 }}>
                {quickBusy ? t('contacts_quick_saving') : t('contacts_quick_save')}
              </button>
              <Link
                href="/atelier/capture?mode=card#capture-card-live-text"
                className="btn ghost sm"
                style={{ minHeight: 44, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                {t('contacts_quick_live_text')}
              </Link>
              <button type="button" className="btn ghost sm" style={{ minHeight: 44, flex: 1 }} onClick={requestStartCreate}>
                {t('contacts_quick_full')}
              </button>
            </div>
          </form>
        </div>
      )}

      {batchEditing && (
        <BatchEditModal
          count={selected.size}
          roleOptions={roles}
          onClose={() => setBatchEditing(false)}
          onSave={handleBatchSave}
          busy={busy}
        />
      )}

      {/* Filter bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: narrow ? '10px max(12px, env(safe-area-inset-right)) 10px max(12px, env(safe-area-inset-left))' : '12px 28px',
        borderBottom: '1px solid var(--bd)', flexShrink: 0, flexWrap: 'wrap',
      }}>
        <div className="t-mono-sm" style={{ color: 'var(--tx3)', whiteSpace: 'nowrap' }}>
          {filtered.length}<span style={{ opacity: 0.5 }}>/{contacts.length}</span>
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('searchPlaceholderContacts')}
          style={{ ...FIS, flex: 1, minWidth: narrow ? 0 : 200, width: narrow ? '100%' : undefined }}
        />
        <select value={searchBy} onChange={(e) => setSearchBy(e.target.value)} style={{ ...FIS, maxWidth: 110 }}>
          <option value="all">{t('searchFieldAll')}</option>
          <option value="name">{t('searchFieldName')}</option>
          <option value="city">{t('searchFieldCity')}</option>
          <option value="email">{t('searchFieldEmail')}</option>
          <option value="notes">{t('searchFieldNotes')}</option>
        </select>
        <select value={role} onChange={(e) => setRole(e.target.value)} style={{ ...FIS, width: 'auto', minWidth: 140 }}>
          <option value="all">{t('allRoles')}</option>
          {roles.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>

        {selected.size > 0 && (
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="btn sm" onClick={requestOpenBatch} disabled={busy} style={{ background: 'var(--ac)', borderColor: 'var(--ac)' }}>
              {t('contacts_bulk_modify_fmt').replace('{n}', String(selected.size))}
            </button>
            {selected.size === 2 && (
              <button
                type="button"
                className="btn sm"
                onClick={() => {
                  const sorted = Array.from(selected).sort((a, b) => a - b)
                  requestOpenMerge([sorted[0], sorted[1]], sorted[0])
                }}
                disabled={busy}
                style={{ background: 'var(--bg2)', borderColor: 'var(--bd)' }}
              >
                {t('contacts_bulk_merge')}
              </button>
            )}
            <button className="btn sm" onClick={handleDeleteSelected} disabled={busy} style={{ background: 'var(--rust)', borderColor: 'var(--rust)' }}>
              {t('contacts_bulk_delete_short')}
            </button>
          </div>
        )}
        {/* Sort toggles */}
        <div style={{ display: 'flex', border: '1px solid var(--bd)', flexShrink: 0 }}>
          {(['alpha', 'role'] as const).map((s) => (
            <button
              key={s}
              className="btn ghost sm"
              type="button"
              onClick={() => toggleSort(s)}
              style={{
                padding: '6px 12px', fontSize: 11, letterSpacing: 1,
                opacity: sortKey === s ? 1 : 0.4,
                fontWeight: sortKey === s ? 700 : 400,
                borderRight: s === 'alpha' ? '1px solid var(--bd)' : 'none',
              }}
            >
              {s === 'alpha' ? t('contacts_sort_alpha') : t('contactEditorRole')}
              {sortKey === s ? <span style={{ marginLeft: 4, color: 'var(--ac)', fontSize: 11 }}>{sortDir === 'asc' ? '↑' : '↓'}</span> : null}
            </button>
          ))}
        </div>
        <button
          className="btn ghost sm"
          onClick={requestStartCreate}
          style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
        >
          {t('contacts_new_btn')}
        </button>
        <button
          className="btn ghost sm"
          onClick={() => setImporting(true)}
          style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
        >
          {t('contacts_google_csv')}
        </button>
        <button
          className="btn ghost sm"
          onClick={() => setUrlModalOpen(true)}
          style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
          title={t('contacts_url_tooltip')}
        >
          URL
        </button>
      </div>

      {importing && (
        <ImportGoogleModal
          onClose={() => setImporting(false)}
          onDone={(_n) => {
            setImporting(false)
            refreshContactsClientData()
          }}
        />
      )}

      {urlModalOpen && (
        <ImportUrlModal
          onClose={() => setUrlModalOpen(false)}
          onDone={() => {
            setUrlModalOpen(false)
            refreshContactsClientData()
          }}
        />
      )}

      {mergeOpen && mergePair && mergeKeepId != null && (
        <div
          role="presentation"
          style={{
            position: 'fixed', inset: 0, zIndex: 120,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24,
          }}
          onClick={() => !busy && setMergeOpen(false)}
        >
          <div
            role="dialog"
            aria-labelledby="merge-title"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--bg1)', border: '1px solid var(--bd)',
              maxWidth: 440, width: '100%', padding: 24,
            }}
          >
            <div id="merge-title" className="t-eyebrow" style={{ marginBottom: 12 }}>
              {t('contacts_merge_title')}
            </div>
            <p className="t-mono-sm" style={{ color: 'var(--tx3)', lineHeight: 1.6, marginBottom: 16 }}>
              {t('contacts_merge_body')}
            </p>
            {[mergePair[0], mergePair[1]].map((id) => {
              const base = contacts.find((c) => c.ContactID === id)
              const label = base
                ? displayName({ ...base, ...extra[id] } as ContactRow)
                : `#${id}`
              return (
              <label
                key={id}
                style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, cursor: 'pointer' }}
              >
                <input
                  type="radio"
                  name="merge-keep"
                  checked={mergeKeepId === id}
                  onChange={() => setMergeKeepId(id)}
                  disabled={busy}
                />
                <span style={{ fontSize: 13 }}>
                  #{id} — {label}
                </span>
              </label>
              )
            })}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
              <button type="button" className="btn ghost sm" onClick={() => setMergeOpen(false)} disabled={busy}>
                {t('cancel')}
              </button>
              <button
                type="button"
                className="btn sm"
                style={{ background: 'var(--ac)', borderColor: 'var(--ac)' }}
                disabled={busy}
                onClick={async () => {
                  if (!mergePair || mergeKeepId == null) return
                  const fromId = mergePair[0] === mergeKeepId ? mergePair[1] : mergePair[0]
                  setBusy(true)
                  try {
                    const res = await mergeContacts(mergeKeepId, fromId)
                    if ('error' in res) {
                      toast.error(`${t('error_prefix')} ${res.error}`)
                      return
                    }
                    setContacts((prev) => prev.filter((c) => c.ContactID !== fromId))
                    setExtra((prev) => {
                      const next = { ...prev }
                      delete next[fromId]
                      return next
                    })
                    setEmails((prev) => {
                      const next = { ...prev }
                      delete next[fromId]
                      return next
                    })
                    setPhones((prev) => {
                      const next = { ...prev }
                      delete next[fromId]
                      return next
                    })
                    setWebsites((prev) => {
                      const next = { ...prev }
                      delete next[fromId]
                      return next
                    })
                    setSocials((prev) => {
                      const next = { ...prev }
                      delete next[fromId]
                      return next
                    })
                    setAddresses((prev) => {
                      const next = { ...prev }
                      delete next[fromId]
                      return next
                    })
                    const refreshed = await refreshContactsClientData()
                    if (!refreshed) {
                      toast.error(`${t('error_prefix')} ${t('contacts_merge_refresh_failed')}`)
                      return
                    }
                    setSelected(new Set())
                    setActiveId(res.keptId)
                    setEditorNonce((n) => n + 1)
                    setMergeOpen(false)
                    setMergePair(null)
                    toast.success(t('contacts_merge_success'))
                  } catch (err) {
                    console.error('[contacts merge]', err)
                    toast.error(`${t('error_prefix')} ${err instanceof Error ? err.message : String(err)}`)
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                {busy ? t('loading') : t('contacts_merge_submit')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table + editor drawer */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: narrow && showEditor ? 'column' : 'row',
          minHeight: 0,
          minWidth: 0,
        }}
      >
        <div
          className={narrow ? undefined : 'contacts-list-scroll'}
          style={{
            flex: 1,
            minWidth: 0,
            overflow: 'auto',
            borderRight: narrow ? 'none' : '1px solid var(--bd)',
            borderBottom: narrow && showEditor ? '1px solid var(--bd)' : undefined,
            maxHeight: narrow && showEditor ? 'min(42vh, 360px)' : undefined,
          }}
        >
          <table
            className="tbl"
            style={{
              width: '100%',
              tableLayout: 'fixed',
              /* Fixed sibling cols sum ~886px; without a floor the lone `auto` name col collapses + clips on mid-width panes */
              minWidth: narrow ? Math.max(720, 886 + 168) : 886 + 168,
            }}
          >
            <thead>
              <tr>
                <th style={{ width: 40 }}>
                  <input type="checkbox" checked={selected.size > 0 && selected.size === filtered.length} onChange={toggleAll} />
                </th>
                <th onClick={() => toggleSort('ContactID')} style={{ width: 46, cursor: 'pointer' }}>{t('contacts_col_id')} <SortInd k="ContactID" current={sortKey} dir={sortDir} /></th>
                <th
                  onClick={() => toggleSort('alpha')}
                  style={{ width: 'auto', minWidth: 168, cursor: 'pointer' }}
                >
                  {t('contacts_col_name_institution')} <SortInd k="alpha" current={sortKey} dir={sortDir} />
                </th>
                <th onClick={() => toggleSort('role')} style={{ width: 120, cursor: 'pointer' }}>{t('contactEditorRole')} <SortInd k="role" current={sortKey} dir={sortDir} /></th>
                <th onClick={() => toggleSort('ville')} style={{ width: 180, cursor: 'pointer' }}>{t('contacts_col_cities')} <SortInd k="ville" current={sortKey} dir={sortDir} /></th>
                <th onClick={() => toggleSort('email')} style={{ width: 220, cursor: 'pointer' }}>{t('contacts_col_email')} <SortInd k="email" current={sortKey} dir={sortDir} /></th>
                <th onClick={() => toggleSort('phone')} style={{ width: 160, cursor: 'pointer' }}>{t('contacts_col_phone_abbr')} <SortInd k="phone" current={sortKey} dir={sortDir} /></th>
                <th onClick={() => toggleSort('works')} style={{ width: 40, cursor: 'pointer' }} className="num" title={t('contactEditorWorksLinked')}>{t('contacts_col_works_abbr')} <SortInd k="works" current={sortKey} dir={sortDir} /></th>
                <th onClick={() => toggleSort('loc')} style={{ width: 40, cursor: 'pointer' }} className="num" title={t('contactEditorWorksLoc')}>{t('contacts_col_loc_abbr')} <SortInd k="loc" current={sortKey} dir={sortDir} /></th>
                <th onClick={() => toggleSort('buyer')} style={{ width: 40, cursor: 'pointer' }} className="num" title={t('contactEditorWorksBuyer')}>{t('contacts_col_buyer_abbr')} <SortInd k="buyer" current={sortKey} dir={sortDir} /></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const isFoc    = c.ContactID === activeId && !isCreating
                const ex       = extra[c.ContactID]
                const rowEmail = primaryListEmail(c.ContactID, extra, emails)
                const rowPhone = primaryListPhone(c.ContactID, extra, phones)
                const inactive = ex?.Actif === false
                return (
                  <tr
                    key={c.ContactID}
                    onClick={() => requestSelectContact(c.ContactID)}
                    style={{ cursor: 'pointer', background: isFoc ? 'var(--bg2)' : '', opacity: inactive ? 0.45 : 1 }}
                  >
                    <td>
                      <input
                        type="checkbox"
                        checked={selected.has(c.ContactID)}
                        onChange={(e) => { e.stopPropagation(); toggleOne(c.ContactID) }}
                      />
                    </td>
                    <td style={{ color: 'var(--tx3)', fontSize: 11 }}>{c.ContactID}</td>
                    <td
                      style={{
                        fontWeight: isFoc ? 600 : undefined,
                        fontSize: 13,
                        minWidth: 168,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {displayName(c)}
                      {conflicts.some(conf => conf.public_contact_id === c.ContactID) && (
                        <span style={{ marginLeft: 8, background: 'var(--rust)', color: '#fff', fontSize: 8, padding: '1px 4px', borderRadius: 2, letterSpacing: 0.5, verticalAlign: 'middle' }}>
                          {t('contacts_conflict_badge')}
                        </span>
                      )}
                    </td>
                    <td style={{ color: 'var(--tx3)', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.Role ?? '—'}</td>
                    <td style={{ color: 'var(--tx3)', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{listVille(c.ContactID)}</td>
                    <td style={{ color: 'var(--tx3)', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{rowEmail || <span style={{ opacity: 0.3 }}>…</span>}</td>
                    <td style={{ color: 'var(--tx3)', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{rowPhone || '—'}</td>
                    <td className="num">{workCounts.owner[c.ContactID] ?? '—'}</td>
                    <td className="num" style={{ color: 'var(--tx3)' }}>{workCounts.loc[c.ContactID] ?? '—'}</td>
                    <td className="num" style={{ color: 'var(--tx3)' }}>{workCounts.buyer[c.ContactID] ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {showEditor && (isCreating || (activeId != null && editorContactResolved)) ? (
          <ContactEditorPanel
            key={`${isCreating ? 'new' : activeId}-${editorNonce}`}
            ref={editorRef}
            contact={isCreating ? null : editorContactResolved}
            initialAddresses={isCreating || activeId == null ? [] : (addresses[activeId] ?? [])}
            initialEmails={isCreating || activeId == null ? [] : (emails[activeId] ?? [])}
            initialPhones={isCreating || activeId == null ? [] : (phones[activeId] ?? [])}
            initialWebsites={isCreating || activeId == null ? [] : (websites[activeId] ?? [])}
            initialSocials={isCreating || activeId == null ? [] : (socials[activeId] ?? [])}
            roleOptions={roles}
            isAdminUser={isAdmin}
            narrow={narrow}
            oeuvres={oeuvres}
            onDirtyChange={setEditorDirty}
            onCreated={handleCreated}
            onUpdated={handleUpdated}
            onTeamAccessUpdated={handleTeamAccessUpdated}
            onDismissEditor={dismissEditor}
            onDeleteContact={!isCreating && activeId != null ? requestDeleteActive : undefined}
            baselineEpoch={editorNonce}
          />
        ) : (
          !narrow && (
            <div style={{ width: 120, flexShrink: 0, padding: 20, color: 'var(--tx3)' }} className="t-mono-sm">
              —
            </div>
          )
        )}
      </div>
    </div>
  )
}

// ── Modal sub-components (batch edit) ───────────────────────────────

const FIS: React.CSSProperties = {
  width: '100%', padding: '6px 8px', fontSize: 11,
  background: 'var(--bg0)', border: '1px solid var(--bd)',
  color: 'var(--tx)', outline: 'none',
}

function FRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="t-label" style={{ marginBottom: 3 }}>{label}</div>
      {children}
    </div>
  )
}

function BatchEditModal({
  count, roleOptions, onClose, onSave, busy
}: {
  count: number; roleOptions: string[]; onClose: () => void; onSave: (data: any) => Promise<boolean>; busy: boolean
}) {
  const { t } = useI18n()
  const [role,   setRole]   = useState<string | undefined>()
  const [actif,  setActif]  = useState<'unchanged' | 'true' | 'false'>('unchanged')
  const [notes,  setNotes]  = useState<string | undefined>()
  const [append, setAppend] = useState(true)

  const hasChange = role !== undefined || actif !== 'unchanged' || notes !== undefined

  async function applyBatch() {
    const payload: any = {}
    if (role !== undefined)    payload.Role  = role
    if (actif !== 'unchanged') payload.Actif = actif === 'true'
    if (notes !== undefined)   { payload.Notes = notes; payload.appendNotes = append }
    return onSave(payload)
  }

  const { attemptClose, unsavedDialog } = useUnsavedCloseGuard({
    isDirty: hasChange,
    onClose,
    performSave: applyBatch,
  })

  return (
    <>
    {unsavedDialog}
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
      onClick={attemptClose}
    >
      <div
        style={{
          background: 'var(--bg1)', border: '1px solid var(--bd)',
          width: '100%', maxWidth: 400, padding: 28,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--tx3)', marginBottom: 20 }}>
          {t('batchEdit')} · {count} {count === 1 ? t('contacts_batch_unit') : t('contacts_batch_unit_plural')}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <FRow label={t('contactEditorRole')}>
            <select value={role ?? ''} onChange={e => setRole(e.target.value || undefined)} style={FIS}>
              <option value="">{t('contacts_batch_no_change')}</option>
              {roleOptions.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </FRow>

          <FRow label={t('contactEditorActive')}>
            <select value={actif} onChange={e => setActif(e.target.value as any)} style={FIS}>
              <option value="unchanged">{t('contacts_batch_no_change')}</option>
              <option value="true">{t('contactEditorActiveLabel')}</option>
              <option value="false">{t('contacts_batch_inactive')}</option>
            </select>
          </FRow>

          <FRow label={t('contactEditorSectionNotes')}>
            <textarea
              value={notes ?? ''}
              onChange={e => setNotes(e.target.value || undefined)}
              placeholder={t('contacts_batch_notes_placeholder')}
              style={{ ...FIS, height: 80, resize: 'vertical' }}
            />
            {notes && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: 10, color: 'var(--tx3)', cursor: 'pointer' }}>
                <input type="checkbox" checked={append} onChange={e => setAppend(e.target.checked)} />
                {t('contacts_batch_append_label')}
              </label>
            )}
          </FRow>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
          <button type="button" className="btn sm ghost" onClick={attemptClose} disabled={busy} style={{ flex: 1 }}>{t('cancel')}</button>
          <button type="button" className="btn sm" onClick={() => void applyBatch()} disabled={busy || !hasChange} style={{ flex: 1, background: 'var(--ac)', borderColor: 'var(--ac)' }}>
            {busy ? t('modifying') : t('contacts_batch_apply')}
          </button>
        </div>
      </div>
    </div>
    </>
  )
}

// ── Google CSV Import ─────────────────────────────────────────────────────────

function parseGoogleCSV(text: string): ImportedContact[] {
  // Strip UTF-8 BOM
  const clean = text.replace(/^﻿/, '')

  // Auto-detect delimiter from first line (Google CSV = comma, some locales = semicolon)
  const firstLine = clean.split(/\r?\n/)[0] ?? ''
  const delim = firstLine.split(';').length > firstLine.split(',').length ? ';' : ','

  function parseRow(line: string): string[] {
    const fields: string[] = []
    let cur = '', inQ = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++ }
        else inQ = !inQ
      } else if (ch === delim && !inQ) {
        fields.push(cur); cur = ''
      } else {
        cur += ch
      }
    }
    fields.push(cur)
    return fields
  }

  const lines = clean.split(/\r?\n/)
  if (lines.length < 2) return []
  const headers = parseRow(lines[0]).map(h => h.trim().replace(/^﻿/, ''))

  const contacts: ImportedContact[] = []

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue
    const vals = parseRow(lines[i])
    const get  = (h: string) => {
      const idx = headers.indexOf(h)
      return idx >= 0 ? (vals[idx] ?? '').trim() : ''
    }

    const prenom      = get('First Name') || get('Given Name') || null
    const nom         = get('Last Name')  || get('Family Name') || null
    const institution = get('Organization Name') || get('Organization 1 - Name') || null
    const role        = get('Organization Title') || get('Organization 1 - Title') || null
    const notes       = get('Notes') || null

    // Fallback: if Given/Family empty, split the Name field
    let resolvedPrenom = prenom
    let resolvedNom    = nom
    if (!resolvedPrenom && !resolvedNom) {
      const fullName = get('Name')
      if (fullName) {
        // Google sometimes stores as "Last, First"
        if (fullName.includes(',')) {
          const [last, ...rest] = fullName.split(',')
          resolvedNom    = last.trim() || null
          resolvedPrenom = rest.join(',').trim() || null
        } else {
          const parts = fullName.trim().split(/\s+/)
          resolvedPrenom = parts.slice(0, -1).join(' ') || fullName || null
          resolvedNom    = parts.length > 1 ? parts[parts.length - 1] : null
        }
      }
    }

    // Accept any row with at least a name or institution (email alone is not enough)
    if (!resolvedPrenom && !resolvedNom && !institution) continue

    // Emails — Google exports as "E-mail N - Value" / "E-mail N - Label"
    const emails: ImportedContact['emails'] = []
    for (let n = 1; n <= 10; n++) {
      const val   = get(`E-mail ${n} - Value`)
      const label = get(`E-mail ${n} - Label`)
      if (val) emails.push({ email: val, label: label || 'Personnel' })
    }

    // Phones — "Phone N - Value" / "Phone N - Label"
    // Google CSV sometimes packs multiple numbers in one cell separated by ' ::: '
    const phones: ImportedContact['phones'] = []
    for (let n = 1; n <= 10; n++) {
      const raw   = get(`Phone ${n} - Value`)
      const label = get(`Phone ${n} - Label`)
      if (!raw) continue
      const parts = raw.split(/\s+:::\s+/)
      for (const part of parts) {
        const p = part.trim()
        if (!p) continue
        const m = p.match(/^(\+\d{1,3})\s*(.+)$/)
        phones.push({
          country_code: m ? m[1] : null,
          phone:        m ? m[2].replace(/\s/g, '') : p.replace(/\s/g, ''),
          label:        label || 'Mobile',
        })
      }
    }

    // Addresses — "Address N - Street/City/Postal Code/Country"
    const addresses: ImportedContact['addresses'] = []
    for (let n = 1; n <= 5; n++) {
      const street  = get(`Address ${n} - Street`)
      const city    = get(`Address ${n} - City`)
      const postal  = get(`Address ${n} - Postal Code`)
      const country = get(`Address ${n} - Country`)
      const label   = get(`Address ${n} - Label`)
      if (street || city || country) {
        addresses.push({ label: label || 'Principal', adresse: street || null, code_postal: postal || null, ville: city || null, pays: country || null })
      }
    }

    // Websites — "Website N - Value" / "Website N - Label"
    const websites: ImportedContact['websites'] = []
    for (let n = 1; n <= 5; n++) {
      const url   = get(`Website ${n} - Value`)
      const label = get(`Website ${n} - Label`)
      if (url) websites.push({ url, label: label || 'Web' })
    }

    contacts.push({ prenom: resolvedPrenom, nom: resolvedNom, institution, role, notes, emails, phones, addresses, websites })
  }

  return contacts
}

const PEM_HIDE_OLLAMA_TIP = 'pem_hide_ollama_url_tip'

function ImportUrlModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { t } = useI18n()
  const [url, setUrl] = useState('')
  const [refineLlm, setRefineLlm] = useState(true)
  const [busy, setBusy] = useState(false)
  const [parsed, setParsed] = useState<ImportedContact | null>(null)
  const [meta, setMeta] = useState<UrlEnrichMeta | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null)
  const [showOllamaTip, setShowOllamaTip] = useState(true)
  const [scriptBusy, setScriptBusy] = useState(false)
  const [scriptOut, setScriptOut] = useState<string | null>(null)

  useEffect(() => {
    try {
      if (sessionStorage.getItem(PEM_HIDE_OLLAMA_TIP) === '1') setShowOllamaTip(false)
    } catch {
      /* ignore */
    }
  }, [])

  function dismissOllamaTip() {
    try {
      sessionStorage.setItem(PEM_HIDE_OLLAMA_TIP, '1')
    } catch {
      /* ignore */
    }
    setShowOllamaTip(false)
  }

  type OllamaPing =
    | { phase: 'checking' }
    | { phase: 'done'; ok: true; host: string }
    | { phase: 'done'; ok: false; host: string; message: string }

  const [ollamaPing, setOllamaPing] = useState<OllamaPing>({ phase: 'checking' })

  const runOllamaPing = useCallback(async () => {
    setOllamaPing({ phase: 'checking' })
    const r = await checkOllamaListening()
    if (r.ok) setOllamaPing({ phase: 'done', ok: true, host: r.host })
    else setOllamaPing({ phase: 'done', ok: false, host: r.host, message: r.message })
  }, [])

  useEffect(() => {
    runOllamaPing()
  }, [runOllamaPing])

  async function handleExtract() {
    const u = url.trim()
    if (!u) return
    setBusy(true)
    setErr(null)
    setParsed(null)
    setMeta(null)
    const res = await previewContactFromUrl(u, { refineWithLlm: refineLlm })
    setBusy(false)
    if ('error' in res) {
      setErr(res.error)
      return
    }
    setParsed(res.contact)
    setMeta(res.meta)
  }

  async function handleImport() {
    if (!parsed) return
    setBusy(true)
    setErr(null)
    const res = await importGoogleContacts([parsed])
    setBusy(false)
    if ('error' in res) {
      setErr(res.error)
      return
    }
    setResult({ imported: res.imported, skipped: res.skipped })
  }

  async function handleOllamaScript() {
    setScriptBusy(true)
    setScriptOut(null)
    const r = await runOllamaInstructionScript()
    setScriptBusy(false)
    if ('error' in r) setScriptOut(r.error)
    else setScriptOut(`— ${r.host} · ${r.model}\n\n${r.reply}`)
  }

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg1)',
          border: '1px solid var(--bd)',
          width: 520,
          maxWidth: '96vw',
          maxHeight: '92vh',
          overflowY: 'auto',
          padding: 28,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="t-eyebrow">{t('contacts_url_title')}</div>
          <button type="button" className="btn ghost sm" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="t-mono-sm" style={{ color: 'var(--tx3)', lineHeight: 1.6 }}>
          {t('contacts_url_intro')}
        </div>

        {!result ? (
          <>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                flexWrap: 'wrap',
                padding: '10px 12px',
                border: '1px solid var(--bd)',
                background: 'var(--bg2)',
              }}
            >
              <span style={{ fontSize: 18, lineHeight: 1 }} aria-hidden>
                {ollamaPing.phase === 'checking' ? (
                  <span style={{ opacity: 0.45 }}>◌</span>
                ) : ollamaPing.phase === 'done' && ollamaPing.ok ? (
                  <span style={{ color: '#2ecc71' }} title={t('contacts_url_ollama_dot_ok_title')}>●</span>
                ) : (
                  <span style={{ color: 'var(--rust)' }} title={t('contacts_url_ollama_dot_fail_title')}>●</span>
                )}
              </span>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div className="t-mono-sm" style={{ fontSize: 11, color: 'var(--tx)', lineHeight: 1.45 }}>
                  {ollamaPing.phase === 'checking' ? (
                    <>{t('contacts_url_ollama_checking')}</>
                  ) : ollamaPing.phase === 'done' && ollamaPing.ok ? (
                    <>
                      <strong>{t('contacts_url_ollama_up')}</strong>
                      {' · '}
                      <code style={{ fontSize: 10 }}>{ollamaPing.host}</code>
                      <span style={{ color: 'var(--tx3)', marginLeft: 6 }}>{t('contacts_url_ollama_tags_ok')}</span>
                    </>
                  ) : ollamaPing.phase === 'done' ? (
                    <>
                      <strong>{t('contacts_url_ollama_down')}</strong>
                      {ollamaPing.host ? (
                        <>
                          {' · '}
                          <code style={{ fontSize: 10 }}>{ollamaPing.host}</code>
                        </>
                      ) : null}
                      {ollamaPing.message ? (
                        <span style={{ color: 'var(--rust)', display: 'block', marginTop: 4, fontSize: 10 }}>
                          {ollamaPing.message}
                        </span>
                      ) : null}
                    </>
                  ) : null}
                </div>
                <div className="t-mono-sm" style={{ fontSize: 9, color: 'var(--tx3)', marginTop: 4, lineHeight: 1.4 }}>
                  {t('contacts_url_server_note')}
                </div>
              </div>
              <button type="button" className="btn ghost sm" onClick={() => runOllamaPing()} disabled={ollamaPing.phase === 'checking'}>
                {t('contacts_url_verify')}
              </button>
            </div>

            {showOllamaTip && (
              <div
                role="dialog"
                aria-label={t('contacts_url_tip_title')}
                style={{
                  position: 'relative',
                  padding: '14px 16px',
                  border: '1px solid var(--ac)',
                  background: 'var(--bg2)',
                  borderRadius: 2,
                  boxShadow: '0 8px 28px rgba(0,0,0,0.35)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
                  <div className="t-eyebrow" style={{ margin: 0 }}>
                    {t('contacts_url_tip_title')}
                  </div>
                  <button type="button" className="btn ghost sm" onClick={dismissOllamaTip} style={{ flexShrink: 0 }}>
                    {t('contacts_url_tip_hide')}
                  </button>
                </div>
                <pre
                  className="t-mono-sm"
                  style={{
                    margin: 0,
                    padding: '12px 14px',
                    background: 'var(--bg1)',
                    border: '1px solid var(--bd)',
                    color: 'var(--tx)',
                    fontSize: 11,
                    lineHeight: 1.55,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                  }}
                >
                  {t('contacts_url_ollama_pre')}
                </pre>
                <p className="t-mono-sm" style={{ margin: '12px 0 0', color: 'var(--tx3)', fontSize: 10, lineHeight: 1.6 }}>
                  {t('contacts_url_env_note')}
                </p>
                <p className="t-mono-sm" style={{ margin: '10px 0 0', color: 'var(--tx3)', fontSize: 10, lineHeight: 1.6 }}>
                  {t('contacts_url_model_note')}
                </p>
              </div>
            )}

            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={t('contacts_url_url_ph')}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid var(--bd)',
                background: 'var(--bg2)',
                color: 'var(--tx)',
                fontSize: 13,
              }}
            />
            <label style={{ display: 'flex', gap: 10, alignItems: 'center', cursor: 'pointer' }}>
              <input type="checkbox" checked={refineLlm} onChange={(e) => setRefineLlm(e.target.checked)} />
              <span className="t-mono-sm">{t('contacts_url_refine_llm')}</span>
            </label>

            <button type="button" className="btn sm" onClick={handleExtract} disabled={busy || !url.trim()} style={{ alignSelf: 'flex-start' }}>
              {busy && !parsed ? t('contacts_url_extracting') : t('contacts_url_extract')}
            </button>

            {meta && (
              <div className="t-mono-sm" style={{ color: 'var(--tx3)', fontSize: 10, lineHeight: 1.6 }}>
                <div>
                  <strong>{t('contacts_url_sources')}</strong>: {meta.sources.length ? meta.sources.join(' · ') : '—'}
                </div>
                <div>
                  <strong>{t('contacts_url_llm')}</strong>: {meta.llm}
                  {meta.llmNote ? ` — ${meta.llmNote}` : ''}
                </div>
              </div>
            )}

            {parsed && (
              <div className="t-mono-sm" style={{ color: 'var(--tx)', lineHeight: 1.85, borderTop: '1px solid var(--bd)', paddingTop: 12 }}>
                <div><strong>{[parsed.prenom, parsed.nom].filter(Boolean).join(' ') || '—'}</strong></div>
                <div>{parsed.institution || '—'}</div>
                <div style={{ color: 'var(--tx3)', marginTop: 6 }}>
                  {parsed.emails.length > 0 && <div>{t('contacts_url_preview_email')} {parsed.emails.map((e) => e.email).join(', ')}</div>}
                  {parsed.phones.length > 0 && <div>{t('contacts_url_preview_phone')} {parsed.phones.map((p) => p.phone).join(', ')}</div>}
                  {parsed.websites.length > 0 && <div>{t('contacts_url_preview_web')} {parsed.websites.map((w) => w.url).join(', ')}</div>}
                  {parsed.role && <div>{t('contacts_url_preview_role')} {parsed.role}</div>}
                  {parsed.notes && (
                    <div style={{ marginTop: 6, maxHeight: 100, overflow: 'auto' }}>{t('contacts_url_preview_notes')} {parsed.notes}</div>
                  )}
                </div>
              </div>
            )}

            {err && <div className="t-mono-sm" style={{ color: 'var(--rust)' }}>{err}</div>}

            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn ghost sm" onClick={onClose} style={{ flex: 1 }}>
                {t('cancel')}
              </button>
              <button
                type="button"
                className="btn sm"
                onClick={handleImport}
                disabled={!parsed || busy}
                style={{ flex: 1, background: 'var(--ac)', borderColor: 'var(--ac)' }}
              >
                {busy && parsed ? t('contacts_url_importing') : t('contacts_url_import_this')}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="t-mono-sm" style={{ lineHeight: 1.8 }}>
              <div>
                ✓{' '}
                {result.imported === 1
                  ? t('contacts_url_done_imported_1')
                  : t('contacts_url_done_imported_n').replace('{n}', String(result.imported))}
              </div>
              {result.skipped > 0 && (
                <div style={{ color: 'var(--tx3)' }}>
                  {t('contacts_url_done_skipped_fmt').replace('{n}', String(result.skipped))}
                </div>
              )}
            </div>
            <button type="button" className="btn sm" onClick={onDone} style={{ background: 'var(--ac)', borderColor: 'var(--ac)' }}>
              {t('close')}
            </button>
          </>
        )}

        <div style={{ borderTop: '1px solid var(--bd)', paddingTop: 14 }}>
          <div className="t-eyebrow" style={{ marginBottom: 8 }}>
            {t('contacts_url_script_heading')}
          </div>
          <div className="t-mono-sm" style={{ color: 'var(--tx3)', fontSize: 10, marginBottom: 8, lineHeight: 1.45 }}>
            {t('contacts_url_script_inline_code_help')}
          </div>
          <pre
            className="t-mono-sm"
            style={{
              margin: '0 0 12px',
              padding: '10px 12px',
              background: 'var(--bg2)',
              border: '1px solid var(--bd)',
              color: 'var(--tx3)',
              fontSize: 10,
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              maxHeight: 140,
              overflow: 'auto',
            }}
          >
            {OLLAMA_SCRIPT_INSTRUCTIONS}
          </pre>
          <button
            type="button"
            className="btn sm"
            onClick={handleOllamaScript}
            disabled={scriptBusy}
            style={{ background: 'var(--bg2)', borderColor: 'var(--bd)' }}
          >
            {scriptBusy ? t('contacts_url_script_running') : t('contacts_url_run_script')}
          </button>
          {scriptOut && (
            <div
              className="t-mono-sm"
              style={{
                marginTop: 12,
                padding: 12,
                background: 'var(--bg0)',
                border: '1px solid var(--bd)',
                color: 'var(--tx)',
                fontSize: 10,
                lineHeight: 1.55,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                maxHeight: 220,
                overflow: 'auto',
              }}
            >
              {scriptOut}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ImportGoogleModal({ onClose, onDone }: { onClose: () => void; onDone: (n: number) => void }) {
  const { t } = useI18n()
  const [parsed,  setParsed]  = useState<ImportedContact[] | null>(null)
  const [busy,    setBusy]    = useState(false)
  const [result,  setResult]  = useState<{ imported: number; skipped: number } | null>(null)
  const [err,     setErr]     = useState<string | null>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const contacts = parseGoogleCSV(text)
      setParsed(contacts)
    }
    reader.readAsText(file, 'UTF-8')
  }

  async function handleImport() {
    if (!parsed) return
    setBusy(true)
    setErr(null)
    const res = await importGoogleContacts(parsed)
    setBusy(false)
    if ('error' in res) { setErr(res.error); return }
    setResult({ imported: res.imported, skipped: res.skipped })
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg1)', border: '1px solid var(--bd)', width: 440, padding: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="t-eyebrow">{t('contacts_import_google_title')}</div>
          <button type="button" className="btn ghost sm" onClick={onClose} aria-label={t('close')}>✕</button>
        </div>

        <div className="t-mono-sm" style={{ color: 'var(--tx3)', lineHeight: 1.6 }}>
          {t('contacts_import_google_help')}
        </div>

        {!result ? (
          <>
            <label style={{ cursor: 'pointer' }}>
              <input type="file" accept=".csv" onChange={handleFile} style={{ display: 'none' }} />
              <div className="btn ghost sm" style={{ display: 'inline-block' }}>
                {t('contacts_import_pick_csv')}
              </div>
            </label>

            {parsed !== null && (
              <div className="t-mono-sm" style={{ color: 'var(--tx)', lineHeight: 1.8 }}>
                <div><strong>{parsed.length}</strong> {t('contacts_import_found_tail')}</div>
                {parsed.length > 0 && (
                  <div style={{ color: 'var(--tx3)', fontSize: 9, marginTop: 6, lineHeight: 1.6 }}>
                    {parsed.slice(0, 5).map((c, i) => (
                      <div key={i}>{[c.prenom, c.nom, c.institution].filter(Boolean).join(' ') || '—'}</div>
                    ))}
                    {parsed.length > 5 && <div>{t('contacts_import_more_fmt').replace('{n}', String(parsed.length - 5))}</div>}
                  </div>
                )}
                {parsed.length === 0 && (
                  <div style={{ color: 'var(--rust)', marginTop: 4 }}>
                    {t('contacts_import_none_recognized')}
                  </div>
                )}
              </div>
            )}

            {err && <div className="t-mono-sm" style={{ color: 'var(--rust)' }}>{err}</div>}

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn ghost sm" onClick={onClose} style={{ flex: 1 }}>{t('cancel')}</button>
              <button
                className="btn sm"
                onClick={handleImport}
                disabled={!parsed || busy}
                style={{ flex: 1, background: 'var(--ac)', borderColor: 'var(--ac)' }}
              >
                {busy ? t('contacts_import_busy') : t('contacts_import_btn_fmt').replace('{n}', String(parsed?.length ?? 0))}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="t-mono-sm" style={{ lineHeight: 1.8 }}>
              <div>
                ✓{' '}
                {result.imported === 1
                  ? t('contacts_import_done_1')
                  : t('contacts_import_done_n').replace('{n}', String(result.imported))}
              </div>
              {result.skipped > 0 && (
                <div style={{ color: 'var(--tx3)' }}>
                  {t('contacts_import_skipped_fmt').replace('{n}', String(result.skipped))}
                </div>
              )}
            </div>
            <button className="btn sm" onClick={() => onDone(result.imported)} style={{ background: 'var(--ac)', borderColor: 'var(--ac)' }}>
              {t('close')}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
