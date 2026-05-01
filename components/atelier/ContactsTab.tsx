'use client'

// ContactsTab — searchable, filterable contact list with full field set + edit/create.
// Supports multiple addresses per contact via contact_addresses table.

import { useState, useMemo, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { deleteContacts } from '@/app/atelier/contacts/actions'
import { useI18n } from '@/lib/i18n/context'
import type { Oeuvre } from '@/lib/types/database'

// ── Types ────────────────────────────────────────────────────────────

interface ContactRow {
  ContactID:          number
  NomInstitution:     string | null
  Nom:                string | null
  Prénom:             string | null
  Role:               string | null
  Genre?:             string | null
  TypeContact?:       number | null
  Email?:             string | null
  IndicatifPays1?:    string | null
  Téléphone1?:        string | null
  IndicatifPays2?:    string | null
  Téléphone2?:        string | null
  Website?:           string | null
  Adresse?:           string | null
  CodePostal?:        string | null
  Ville?:             string | null
  Pays?:              string | null
  Notes?:             string | null
  Instagram?:         string | null
  LinkedIn?:          string | null
  Facebook?:          string | null
  Twitter?:           string | null
  PersonneResponsable?: string | null
  RoleResponsable?:   string | null
  Actif?:             boolean | null
}

interface ContactAddress {
  id?:         number
  contact_id:  number
  label:       string
  adresse:     string | null
  code_postal: string | null
  ville:       string | null
  pays:        string | null
  position:    number
}

interface Props {
  contacts: ContactRow[]
  oeuvres:  Oeuvre[]
}

// ── Helpers ──────────────────────────────────────────────────────────

function displayName(c: ContactRow): string {
  return c.NomInstitution || `${c.Prénom ?? ''} ${c.Nom ?? ''}`.trim() || `#${c.ContactID}`
}

function fmtPhone(ind: string | null | undefined, num: string | null | undefined): string | null {
  if (!num) return null
  return ind ? `${ind} ${num}` : num
}

function cap(s: string): string {
  if (!s) return s
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// ── Component ────────────────────────────────────────────────────────

export function ContactsTab({ contacts: initialContacts, oeuvres }: Props) {
  const { t, lang } = useI18n()
  const [contacts,   setContacts]   = useState<ContactRow[]>(initialContacts)
  const [q,          setQ]          = useState('')
  const [searchBy,   setSearchBy]   = useState('all')
  const [role,       setRole]       = useState('all')
  const [sortBy,     setSortBy]     = useState<'alpha' | 'role'>('alpha')
  const [activeId,   setActiveId]   = useState<number | null>(null)
  const [editing,    setEditing]    = useState<ContactRow | 'new' | null>(null)
  const [selected,   setSelected]   = useState<Set<number>>(new Set())
  const [busy,       setBusy]       = useState(false)

  // Full contact data fetched client-side (extra fields not in server prop)
  const [extra,      setExtra]      = useState<Record<number, ContactRow>>({})
  // Multiple addresses per contact
  const [addresses,  setAddresses]  = useState<Record<number, ContactAddress[]>>({})

  // List of all roles from tblRole
  const [allRoles,   setAllRoles]   = useState<string[]>([])

  // Re-fetch everything on mount so edits appear without page reload
  useEffect(() => {
    const sb = createClient()
    ;(sb.from('Contact') as any)
      .select('ContactID, NomInstitution, Nom, Prénom, Role, Ville, Pays')
      .order('"ContactID"')
      .then(({ data }: { data: ContactRow[] | null }) => {
        if (data) setContacts(data)
      })
    ;(sb.from('Contact') as any)
      .select('ContactID, Email, IndicatifPays1, Téléphone1, IndicatifPays2, Téléphone2, Website, Adresse, CodePostal, Ville, Pays, Notes, Instagram, LinkedIn, Facebook, Twitter, PersonneResponsable, RoleResponsable, Actif, Genre')
      .then(({ data }: { data: ContactRow[] | null }) => {
        if (!data) return
        const map: Record<number, ContactRow> = {}
        data.forEach((r) => { map[r.ContactID] = r })
        setExtra(map)
      })
    ;(sb.from('contact_addresses') as any)
      .select('id, contact_id, label, adresse, code_postal, ville, pays, position')
      .order('position')
      .then(({ data }: { data: ContactAddress[] | null }) => {
        if (!data) return
        const map: Record<number, ContactAddress[]> = {}
        data.forEach((a) => {
          if (!map[a.contact_id]) map[a.contact_id] = []
          map[a.contact_id].push(a)
        })
        setAddresses(map)
      })
    // Fetch all roles to ensure filter dropdown FIS complete
    ;(sb.from('tblRole') as any)
      .select('Nom')
      .order('Nom')
      .then(({ data }: { data: { Nom: string }[] | null }) => {
        if (data) setAllRoles(data.map(r => r.Nom).filter(Boolean))
      })
  }, [])

  // Auto-open a contact card when navigated from Map
  useEffect(() => {
    const raw = sessionStorage.getItem('pem_open_contact')
    if (!raw) return
    sessionStorage.removeItem('pem_open_contact')
    const id = parseInt(raw)
    if (!isNaN(id)) setActiveId(id)
  }, [])

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
    return [...set].sort((a, b) => a.localeCompare(b, 'fr'))
  }, [contacts, allRoles])

  const filtered = useMemo(() => {
    const sq = q.trim().toLowerCase()
    const base = contacts.filter((c) => {
      if (role !== 'all' && c.Role !== role) return false
      if (sq) {
        const ex = extra[c.ContactID]
        const addrs = addresses[c.ContactID] ?? []
        const addrStr = addrs.map((a) => [a.ville, a.pays, a.adresse, a.label].filter(Boolean).join(' ')).join(' ')
        
        let target = ''
        if (searchBy === 'all') {
          target = [
            c.NomInstitution, c.Nom, c.Prénom, c.Role,
            ex?.Email, ex?.Téléphone1, ex?.Website, ex?.Notes,
            ex?.Instagram, ex?.LinkedIn, ex?.Facebook, ex?.Twitter,
            ex?.PersonneResponsable, ex?.RoleResponsable,
            addrStr,
          ].filter(Boolean).join(' ')
        } else if (searchBy === 'name') {
          target = [c.NomInstitution, c.Nom, c.Prénom].filter(Boolean).join(' ')
        } else if (searchBy === 'city') {
          target = addrStr || [c.Ville, c.Pays].filter(Boolean).join(' ')
        } else if (searchBy === 'email') {
          target = ex?.Email || ''
        } else if (searchBy === 'notes') {
          target = ex?.Notes || ''
        }

        if (!target.toLowerCase().includes(sq)) return false
      }
      return true
    })
    function contactLabel(c: ContactRow) {
      return (c.NomInstitution || `${c.Prénom ?? ''} ${c.Nom ?? ''}`.trim() || '').toLowerCase()
    }
    if (sortBy === 'alpha') {
      return [...base].sort((a, b) => contactLabel(a).localeCompare(contactLabel(b), 'fr'))
    }
    return [...base].sort((a, b) => {
      const ra = (a.Role ?? 'Zzz').toLowerCase()
      const rb = (b.Role ?? 'Zzz').toLowerCase()
      if (ra !== rb) return ra.localeCompare(rb, 'fr')
      return contactLabel(a).localeCompare(contactLabel(b), 'fr')
    })
  }, [contacts, q, role, sortBy, extra, addresses])

  const active = filtered.find((c) => c.ContactID === activeId) ?? filtered[0] ?? null

  // Ville for list view: prefer first contact_address, fallback to Contact.Ville
  function listVille(id: number): string {
    const addrs = addresses[id]
    if (addrs && addrs.length > 0) {
      const cities = addrs.map((a) => a.ville).filter(Boolean) as string[]
      if (cities.length > 0) return cities.join(' / ')
    }
    return extra[id]?.Ville ?? '—'
  }

  const handleCreated = useCallback((c: ContactRow, addrs: ContactAddress[]) => {
    setContacts((prev) => [...prev, c])
    setExtra((prev) => ({ ...prev, [c.ContactID]: c }))
    setAddresses((prev) => ({ ...prev, [c.ContactID]: addrs }))
    setActiveId(c.ContactID)
    setEditing(null)
  }, [])

  const handleUpdated = useCallback((c: ContactRow, addrs: ContactAddress[]) => {
    setContacts((prev) => prev.map((x) => x.ContactID === c.ContactID ? { ...x, ...c } : x))
    setExtra((prev) => ({ ...prev, [c.ContactID]: { ...prev[c.ContactID], ...c } }))
    setAddresses((prev) => ({ ...prev, [c.ContactID]: addrs }))
    setEditing(null)
  }, [])

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

  async function handleDeleteSelected() {
    if (!selected.size) return
    if (!confirm(`Supprimer ${selected.size} contacts ?`)) return
    setBusy(true)
    const ids = Array.from(selected)
    const res = await deleteContacts(ids)
    if ('error' in res) { alert(res.error); setBusy(false); return }
    setContacts(prev => prev.filter(c => !selected.has(c.ContactID)))
    setSelected(new Set())
    if (activeId && selected.has(activeId)) setActiveId(null)
    setBusy(false)
  }

  async function handleDeleteOne(id: number) {
    if (!confirm('Supprimer ce contact ?')) return
    setBusy(true)
    const res = await deleteContacts([id])
    if ('error' in res) { alert(res.error); setBusy(false); return }
    setContacts(prev => prev.filter(c => c.ContactID !== id))
    if (activeId === id) setActiveId(null)
    setBusy(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {editing !== null && (
        <ContactEditModal
          contact={editing === 'new' ? null : { ...editing, ...extra[editing.ContactID] }}
          initialAddresses={editing === 'new' ? [] : (addresses[(editing as ContactRow).ContactID] ?? [])}
          onClose={() => setEditing(null)}
          onCreated={handleCreated}
          onUpdated={handleUpdated}
        />
      )}

      {/* Filter bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '12px 28px', borderBottom: '1px solid var(--bd)', flexShrink: 0,
      }}>
        <div className="t-mono-sm" style={{ color: 'var(--tx3)', whiteSpace: 'nowrap' }}>
          {filtered.length}<span style={{ opacity: 0.5 }}>/{contacts.length}</span>
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('searchPlaceholderContacts')}
          style={{ ...FIS, flex: 1 }}
        />
        <select value={searchBy} onChange={(e) => setSearchBy(e.target.value)} style={{ ...FIS, maxWidth: 110 }}>
          <option value="all">{t('searchFieldAll')}</option>
          <option value="name">{t('searchFieldName')}</option>
          <option value="city">{t('searchFieldCity')}</option>
          <option value="email">{t('searchFieldEmail')}</option>
          <option value="notes">{t('searchFieldNotes')}</option>
        </select>
        <select value={role} onChange={(e) => setRole(e.target.value)} style={FIS}>
          <option value="all">{t('allRoles')}</option>
          {roles.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>

        {selected.size > 0 && (
          <button className="btn sm" onClick={handleDeleteSelected} disabled={busy} style={{ background: 'var(--rust)', borderColor: 'var(--rust)' }}>
            {t('deleteSelected')} ({selected.size})
          </button>
        )}
        {/* Sort toggles */}
        <div style={{ display: 'flex', border: '1px solid var(--bd)', flexShrink: 0 }}>
          {(['alpha', 'role'] as const).map((s) => (
            <button
              key={s}
              className="btn ghost sm"
              onClick={() => setSortBy(s)}
              style={{
                padding: '4px 10px', fontSize: 9, letterSpacing: 1,
                opacity: sortBy === s ? 1 : 0.4,
                fontWeight: sortBy === s ? 700 : 400,
                borderRight: s === 'alpha' ? '1px solid var(--bd)' : 'none',
              }}
            >
              {s === 'alpha' ? 'A–Z' : 'Rôle'}
            </button>
          ))}
        </div>
        <button
          className="btn ghost sm"
          onClick={() => setEditing('new')}
          style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
        >
          + Nouveau contact
        </button>
      </div>

      {/* Table + detail */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <div style={{ flex: 1, overflow: 'auto', borderRight: '1px solid var(--bd)' }}>
          <table className="tbl" style={{ tableLayout: 'auto' }}>
            <thead>
              <tr>
                <th style={{ width: 30 }}>
                  <input type="checkbox" checked={selected.size > 0 && selected.size === filtered.length} onChange={toggleAll} />
                </th>
                <th style={{ width: 36 }}>ID</th>
                <th>Nom / Institution</th>
                <th>Rôle</th>
                <th>Ville(s)</th>
                <th>Email</th>
                <th>Tél.</th>
                <th className="num" title="Oeuvres associées">Œ</th>
                <th className="num" title="En localisation">Loc</th>
                <th className="num" title="Achats">Ach</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const isFoc    = c.ContactID === (active?.ContactID ?? -1)
                const ex       = extra[c.ContactID]
                const inactive = ex?.Actif === false
                return (
                  <tr
                    key={c.ContactID}
                    onClick={() => setActiveId(c.ContactID)}
                    style={{ cursor: 'pointer', background: isFoc ? 'var(--bg2)' : '', opacity: inactive ? 0.45 : 1 }}
                  >
                    <td>
                      <input
                        type="checkbox"
                        checked={selected.has(c.ContactID)}
                        onChange={(e) => { e.stopPropagation(); toggleOne(c.ContactID) }}
                      />
                    </td>
                    <td style={{ color: 'var(--tx3)', fontSize: 10 }}>{c.ContactID}</td>
                    <td style={{ fontWeight: isFoc ? 600 : undefined }}>{displayName(c)}</td>
                    <td style={{ color: 'var(--tx3)', fontSize: 10 }}>{c.Role ?? '—'}</td>
                    <td style={{ color: 'var(--tx3)', fontSize: 10 }}>{listVille(c.ContactID)}</td>
                    <td style={{ color: 'var(--tx3)', fontSize: 10 }}>{ex?.Email ?? <span style={{ opacity: 0.3 }}>…</span>}</td>
                    <td style={{ color: 'var(--tx3)', fontSize: 10 }}>{fmtPhone(ex?.IndicatifPays1, ex?.Téléphone1) ?? '—'}</td>
                    <td className="num">{workCounts.owner[c.ContactID] ?? '—'}</td>
                    <td className="num" style={{ color: 'var(--tx3)' }}>{workCounts.loc[c.ContactID] ?? '—'}</td>
                    <td className="num" style={{ color: 'var(--tx3)' }}>{workCounts.buyer[c.ContactID] ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {active ? (
          <ContactDetail
            contact={{ ...active, ...extra[active.ContactID] }}
            addresses={addresses[active.ContactID] ?? []}
            workCounts={workCounts}
            oeuvres={oeuvres}
            onEdit={() => setEditing({ ...active, ...extra[active.ContactID] })}
            onDelete={() => handleDeleteOne(active.ContactID)}
          />
        ) : (
          <div style={{ width: 340, padding: 20, color: 'var(--tx3)' }} className="t-mono-sm">—</div>
        )}
      </div>
    </div>
  )
}

// ── Detail panel ─────────────────────────────────────────────────────

function ContactDetail({
  contact, addresses, workCounts, oeuvres, onEdit, onDelete,
}: {
  contact:    ContactRow
  addresses:  ContactAddress[]
  workCounts: { owner: Record<number, number>; loc: Record<number, number>; buyer: Record<number, number> }
  oeuvres:    Oeuvre[]
  onEdit:     () => void
  onDelete:   () => void
}) {
  const { t } = useI18n()
  const id   = contact.ContactID
  const works = oeuvres.filter((o) => o.ContactID === id)
  const locs  = oeuvres.filter((o) => o.LocalisationID === id)
  const buys  = oeuvres.filter((o) => o.AcheteurID === id)

  function Row({ label, value, href }: { label: string; value: React.ReactNode; href?: string }) {
    if (!value && value !== 0) return null
    return (
      <div style={{ display: 'flex', gap: 8, padding: '5px 0', borderBottom: '1px solid var(--bd)' }}>
        <div className="t-mono-sm" style={{ color: 'var(--tx3)', minWidth: 110, flexShrink: 0 }}>{label}</div>
        <div style={{ fontSize: 11, color: 'var(--tx)', wordBreak: 'break-word' }}>
          {href
            ? <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--ac)' }}>{value}</a>
            : value}
        </div>
      </div>
    )
  }

  const phone1 = fmtPhone(contact.IndicatifPays1, contact.Téléphone1)
  const phone2 = fmtPhone(contact.IndicatifPays2, contact.Téléphone2)

  return (
    <div style={{ width: 340, flexShrink: 0, overflow: 'auto', padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--tx)', flex: 1, marginRight: 8 }}>
          {displayName(contact)}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="btn ghost sm" onClick={onEdit}>{t('edit')}</button>
          <button className="btn ghost sm" onClick={onDelete} style={{ color: 'var(--rust)' }}>{t('close')}</button>
        </div>
      </div>

      {contact.Actif === false && (
        <div className="t-mono-sm" style={{ color: 'var(--tx3)', marginBottom: 8 }}>Inactif</div>
      )}

      {/* Identity */}
      <div style={{ marginBottom: 12 }}>
        <Row label="ID"           value={contact.ContactID} />
        <Row label="Institution"  value={contact.NomInstitution} />
        <Row label="Nom"          value={[contact.Prénom, contact.Nom].filter(Boolean).join(' ')} />
        <Row label="Rôle"         value={contact.Role} />
        <Row label="Genre"        value={contact.Genre} />
        {contact.PersonneResponsable && (
          <Row label="Responsable" value={`${contact.PersonneResponsable}${contact.RoleResponsable ? ` · ${contact.RoleResponsable}` : ''}`} />
        )}
      </div>

      {/* Contact details */}
      {(contact.Email || phone1 || phone2 || contact.Website) && (
        <div style={{ marginBottom: 12 }}>
          <div className="t-label" style={{ marginBottom: 4 }}>Contact</div>
          {contact.Email && (
            <Row label="Email" value={contact.Email} href={`mailto:${contact.Email}`} />
          )}
          {phone1 && <Row label="Tél. 1" value={phone1} href={`tel:${phone1.replace(/\s/g, '')}`} />}
          {phone2 && <Row label="Tél. 2" value={phone2} href={`tel:${phone2.replace(/\s/g, '')}`} />}
          {contact.Website && (
            <Row label="Web" value={contact.Website} href={contact.Website.startsWith('http') ? contact.Website : `https://${contact.Website}`} />
          )}
        </div>
      )}

      {/* Multiple addresses */}
      {addresses.length > 0 ? (
        <div style={{ marginBottom: 12 }}>
          <div className="t-label" style={{ marginBottom: 4 }}>
            {addresses.length === 1 ? 'Adresse' : `Adresses (${addresses.length})`}
          </div>
          {addresses.map((addr, i) => {
            const parts = [
              addr.adresse,
              [addr.code_postal, addr.ville].filter(Boolean).join(' '),
              addr.pays,
            ].filter(Boolean)
            if (parts.length === 0) return null
            return (
              <div key={addr.id ?? i} style={{ marginBottom: i < addresses.length - 1 ? 10 : 0 }}>
                {addresses.length > 1 && addr.label && (
                  <div className="t-mono-sm" style={{ color: 'var(--tx3)', fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 }}>
                    {addr.label}
                  </div>
                )}
                <div style={{ fontSize: 11, color: 'var(--tx)', lineHeight: 1.6 }}>
                  {parts.map((line, li) => <div key={li}>{line}</div>)}
                </div>
              </div>
            )
          })}
        </div>
      ) : (contact.Adresse || contact.CodePostal || contact.Ville || contact.Pays) ? (
        <div style={{ marginBottom: 12 }}>
          <div className="t-label" style={{ marginBottom: 4 }}>Adresse</div>
          <div style={{ fontSize: 11, color: 'var(--tx)', lineHeight: 1.6 }}>
            {[
              contact.Adresse,
              [contact.CodePostal, contact.Ville].filter(Boolean).join(' '),
              contact.Pays,
            ]
              .filter(Boolean)
              .map((line, i) => (
                <div key={i}>{line}</div>
              ))}
          </div>
        </div>
      ) : null}

      {/* Social */}
      {(contact.Instagram || contact.LinkedIn || contact.Facebook || contact.Twitter) && (
        <div style={{ marginBottom: 12 }}>
          <div className="t-label" style={{ marginBottom: 4 }}>Réseaux</div>
          {contact.Instagram && (
            <Row label="Instagram" value={contact.Instagram}
              href={contact.Instagram.startsWith('http') ? contact.Instagram : `https://instagram.com/${contact.Instagram.replace('@', '')}`} />
          )}
          {contact.LinkedIn && (
            <Row label="LinkedIn" value={contact.LinkedIn}
              href={contact.LinkedIn.startsWith('http') ? contact.LinkedIn : `https://linkedin.com/in/${contact.LinkedIn}`} />
          )}
          {contact.Facebook && (
            <Row label="Facebook" value={contact.Facebook}
              href={contact.Facebook.startsWith('http') ? contact.Facebook : `https://facebook.com/${contact.Facebook}`} />
          )}
          {contact.Twitter && (
            <Row label="Twitter / X" value={contact.Twitter}
              href={contact.Twitter.startsWith('http') ? contact.Twitter : `https://x.com/${contact.Twitter.replace('@', '')}`} />
          )}
        </div>
      )}

      {/* Notes */}
      {contact.Notes && (
        <div style={{ marginBottom: 12 }}>
          <div className="t-label" style={{ marginBottom: 4 }}>Notes</div>
          <div style={{ fontSize: 11, color: 'var(--tx2)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{contact.Notes}</div>
        </div>
      )}

      {/* Works */}
      {works.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <WorkMini label="Oeuvres associées" items={works} />
          <button className="btn sm ghost" onClick={() => {
            const win = (window as any)
            if (win.setSelection) {
              win.setSelection(new Set(works.map(o => o.OeuvreID)))
              alert(`${works.length} œuvres sélectionnées dans l'inventaire.`)
            }
          }} style={{ width: '100%', fontSize: 9 }}>Sélectionner ces {works.length} œuvres</button>
        </div>
      )}
      {locs.length  > 0 && <WorkMini label="En localisation"   items={locs}  />}
      {buys.length  > 0 && <WorkMini label="Achats"             items={buys}  />}
    </div>
  )
}

function WorkMini({ label, items }: { label: string; items: Oeuvre[] }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div className="t-label" style={{ marginBottom: 6 }}>{label} ({items.length})</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 140, overflow: 'auto' }}>
        {items.slice(0, 30).map((o) => (
          <div key={o.OeuvreID} className="t-mono-sm" style={{ color: 'var(--tx2)' }}>
            #{o.OeuvreID} {o.Titre ?? '—'}
          </div>
        ))}
        {items.length > 30 && (
          <div className="t-mono-sm" style={{ color: 'var(--tx3)' }}>+ {items.length - 30} autres</div>
        )}
      </div>
    </div>
  )
}

// ── Modal sub-components ──────────────────────────────────────────────

const FIS: React.CSSProperties = {
  width: '100%', padding: '6px 8px', fontSize: 11,
  background: 'var(--bg0)', border: '1px solid var(--bd)',
  color: 'var(--tx)', outline: 'none',
}

function Section({ title }: { title: string }) {
  return (
    <div style={{
      fontSize: 8, letterSpacing: '0.12em', textTransform: 'uppercase',
      color: 'var(--tx3)', marginTop: 16, marginBottom: 8,
      paddingBottom: 4, borderBottom: '1px solid var(--bd)',
    }}>{title}</div>
  )
}

function FRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="t-label" style={{ marginBottom: 3 }}>{label}</div>
      {children}
    </div>
  )
}

function Grid2({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px' }}>{children}</div>
}

// ── ContactEditModal ──────────────────────────────────────────────────

type FormState = {
  NomInstitution: string; Nom: string; Prénom: string; Genre: string; Role: string
  Email: string; IndicatifPays1: string; Téléphone1: string; IndicatifPays2: string; Téléphone2: string
  Website: string
  Instagram: string; LinkedIn: string; Facebook: string; Twitter: string
  PersonneResponsable: string; RoleResponsable: string; Notes: string; Actif: boolean
}

type AddrForm = {
  id?:         number
  label:       string
  adresse:     string
  code_postal: string
  ville:       string
  pays:        string
}

function emptyAddr(): AddrForm {
  return { label: '', adresse: '', code_postal: '', ville: '', pays: '' }
}

function ContactEditModal({
  contact, initialAddresses, onClose, onCreated, onUpdated,
}: {
  contact?:          ContactRow | null
  initialAddresses:  ContactAddress[]
  onClose:           () => void
  onCreated:         (c: ContactRow, addrs: ContactAddress[]) => void
  onUpdated:         (c: ContactRow, addrs: ContactAddress[]) => void
}) {
  const isNew = !contact

  const [roleOptions, setRoleOptions] = useState<string[]>([])
  useEffect(() => {
    ;(createClient().from('tblRole') as any)
      .select('Nom').order('Nom')
      .then(({ data }: { data: { Nom: string }[] | null }) => {
        const defaults = ['Team', 'Client', 'Gallery', 'Artist', 'Supplier', 'Press', 'Museum', 'Collector', 'Restorer', 'Framer']
        const fetched = data ? data.map((r) => r.Nom) : []
        const merged = Array.from(new Set([...defaults, ...fetched])).sort()
        setRoleOptions(merged)
      })
  }, [])

  const [form, setForm] = useState<FormState>({
    NomInstitution:     contact?.NomInstitution     ?? '',
    Nom:                contact?.Nom                ?? '',
    Prénom:             contact?.Prénom             ?? '',
    Genre:              contact?.Genre              ?? '',
    Role:               contact?.Role               ?? '',
    Email:              contact?.Email              ?? '',
    IndicatifPays1:     contact?.IndicatifPays1     ?? '',
    Téléphone1:         contact?.Téléphone1         ?? '',
    IndicatifPays2:     contact?.IndicatifPays2     ?? '',
    Téléphone2:         contact?.Téléphone2         ?? '',
    Website:            contact?.Website            ?? '',
    Instagram:          contact?.Instagram          ?? '',
    LinkedIn:           contact?.LinkedIn           ?? '',
    Facebook:           contact?.Facebook           ?? '',
    Twitter:            contact?.Twitter            ?? '',
    PersonneResponsable: contact?.PersonneResponsable ?? '',
    RoleResponsable:    contact?.RoleResponsable    ?? '',
    Notes:              contact?.Notes              ?? '',
    Actif:              contact?.Actif              ?? true,
  })

  const [addrList, setAddrList] = useState<AddrForm[]>(
    initialAddresses.length > 0
      ? initialAddresses.map((a) => ({
          id:          a.id,
          label:       a.label ?? '',
          adresse:     a.adresse ?? '',
          code_postal: a.code_postal ?? '',
          ville:       a.ville ?? '',
          pays:        a.pays ?? '',
        }))
      : [{
          label:       'Principal',
          adresse:     contact?.Adresse ?? '',
          code_postal: contact?.CodePostal ?? '',
          ville:       contact?.Ville ?? '',
          pays:        contact?.Pays ?? '',
        }]
  )

  const [busy, setBusy] = useState(false)
  const [err,  setErr]  = useState<string | null>(null)

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
      const next = prev.map((a, j) => j === i ? { ...a, [k]: v } : a)
      // Address induction for FR
      if (k === 'code_postal' && v.length === 5 && /^\d+$/.test(v)) {
        fetch(`https://api-adresse.data.gouv.fr/search/?q=${v}&type=municipality&limit=1`)
          .then(r => r.json())
          .then(data => {
            const feat = data.features?.[0]
            if (feat) {
              const city = feat.properties.city
              setAddrList(cur => cur.map((a, j) => j === i ? { ...a, ville: city, pays: 'France' } : a))
            }
          })
          .catch(() => {
             // Fallback to international zip
             fetch(`https://api.zippopotam.us/fr/${v}`)
              .then(r => r.json())
              .then(data => {
                if (data.places?.[0]) {
                  const city = data.places[0]['place name']
                  setAddrList(cur => cur.map((a, j) => j === i ? { ...a, ville: city, pays: 'France' } : a))
                }
              }).catch(() => {})
          })
      }
      return next
    })
  }

  async function handleSave() {
    setBusy(true)
    setErr(null)
    try {
      const sb = createClient()
      // Filter out completely empty address blocks
      const validAddrs = addrList.filter((a) => a.adresse || a.ville || a.pays || a.code_postal)

      // Sync primary Ville/Pays to Contact table for map/list compat
      const primaryVille = validAddrs[0]?.ville || null
      const primaryPays  = validAddrs[0]?.pays  || null

      const payload: Record<string, unknown> = {
        NomInstitution:     form.NomInstitution     || null,
        Nom:                form.Nom                || null,
        Prénom:             form.Prénom             || null,
        Genre:              form.Genre              || null,
        Role:               form.Role               || null,
        Email:              form.Email              || null,
        IndicatifPays1:     form.IndicatifPays1     || null,
        Téléphone1:         form.Téléphone1         || null,
        IndicatifPays2:     form.IndicatifPays2     || null,
        Téléphone2:         form.Téléphone2         || null,
        Website:            form.Website            || null,
        Adresse:            validAddrs[0]?.adresse  || null,
        CodePostal:         validAddrs[0]?.code_postal || null,
        Ville:              primaryVille,
        Pays:               primaryPays,
        Instagram:          form.Instagram          || null,
        LinkedIn:           form.LinkedIn           || null,
        Facebook:           form.Facebook           || null,
        Twitter:            form.Twitter            || null,
        PersonneResponsable: form.PersonneResponsable || null,
        RoleResponsable:    form.RoleResponsable    || null,
        Notes:              form.Notes              || null,
        Actif:              form.Actif,
      }

      let contactId: number

      if (isNew) {
        const { data: maxRow } = await (sb.from('Contact') as any)
          .select('ContactID').order('ContactID', { ascending: false }).limit(1).single()
        contactId = ((maxRow as any)?.ContactID ?? 0) + 1
        payload.ContactID = contactId
        const { error } = await (sb.from('Contact') as any).insert(payload)
        if (error) throw new Error((error as any).message)
      } else {
        contactId = contact!.ContactID
        const { error } = await (sb.from('Contact') as any)
          .update(payload).eq('ContactID', contactId)
        if (error) throw new Error((error as any).message)
      }

      // Replace all addresses for this contact
      await (sb.from('contact_addresses') as any)
        .delete().eq('contact_id', contactId)

      let savedAddrs: ContactAddress[] = []
      if (validAddrs.length > 0) {
        const insertRows = validAddrs.map((a, i) => ({
          contact_id:  contactId,
          label:       a.label || (validAddrs.length === 1 ? 'Principal' : `Adresse ${i + 1}`),
          adresse:     a.adresse  || null,
          code_postal: a.code_postal || null,
          ville:       a.ville    || null,
          pays:        a.pays     || null,
          position:    i,
        }))
        const { data: insertedAddrs, error: addrErr } = await (sb.from('contact_addresses') as any)
          .insert(insertRows).select()
        if (addrErr) throw new Error((addrErr as any).message)
        savedAddrs = (insertedAddrs ?? []) as ContactAddress[]
      }

      const savedContact = { ContactID: contactId, ...payload } as ContactRow
      if (isNew) {
        onCreated(savedContact, savedAddrs)
      } else {
        onUpdated(savedContact, savedAddrs)
      }
    } catch (e) {
      setErr(String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{
        background: 'var(--bg1)', border: '1px solid var(--bd)',
        width: '100%', maxWidth: 600,
        maxHeight: '90vh', overflow: 'auto',
        padding: 28,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--tx3)' }}>
            {isNew ? 'Nouveau contact' : `Modifier · #${contact!.ContactID}`}
          </div>
          <button className="btn ghost sm" onClick={onClose} disabled={busy}>✕</button>
        </div>

        {/* Identité */}
        <Section title="Identité" />
        <Grid2>
          <FRow label="Institution"><input value={form.NomInstitution} onChange={f('NomInstitution')} style={FIS} /></FRow>
          <FRow label="Rôle">
            <select value={form.Role} onChange={f('Role')} style={FIS}>
              <option value="">— Choisir</option>
              {form.Role && !roleOptions.includes(form.Role) && (
                <option value={form.Role}>{form.Role}</option>
              )}
              {roleOptions.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </FRow>
          <FRow label="Prénom"><input value={form.Prénom} onChange={f('Prénom')} onBlur={b('Prénom')} style={FIS} /></FRow>
          <FRow label="Nom"><input value={form.Nom} onChange={f('Nom')} onBlur={b('Nom')} style={FIS} /></FRow>
          <FRow label="Genre">
            <select value={form.Genre} onChange={f('Genre')} style={FIS}>
              <option value="">—</option>
              <option value="M.">M.</option>
              <option value="Mme">Mme</option>
              <option value="Mx">Mx</option>
            </select>
          </FRow>
          <FRow label="Actif">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, fontSize: 11, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.Actif} onChange={(e) => setForm((p) => ({ ...p, Actif: e.target.checked }))} />
              Actif
            </label>
          </FRow>
        </Grid2>

        <Grid2>
          <FRow label="Personne responsable"><input value={form.PersonneResponsable} onChange={f('PersonneResponsable')} style={FIS} /></FRow>
          <FRow label="Rôle responsable"><input value={form.RoleResponsable} onChange={f('RoleResponsable')} style={FIS} /></FRow>
        </Grid2>

        {/* Contact */}
        <Section title="Contact" />
        <Grid2>
          <FRow label="Email"><input type="email" value={form.Email} onChange={f('Email')} style={FIS} /></FRow>
          <FRow label="Website"><input value={form.Website} onChange={f('Website')} placeholder="https://..." style={FIS} /></FRow>
          <FRow label="Indicatif + Tél. 1">
            <div style={{ display: 'flex', gap: 4 }}>
              <input value={form.IndicatifPays1} onChange={f('IndicatifPays1')} placeholder="+" style={{ ...FIS, width: 56, flexShrink: 0 }} />
              <input value={form.Téléphone1} onChange={f('Téléphone1')} placeholder="Numéro" style={{ ...FIS, flex: 1 }} />
            </div>
          </FRow>
          <FRow label="Indicatif + Tél. 2">
            <div style={{ display: 'flex', gap: 4 }}>
              <input value={form.IndicatifPays2} onChange={f('IndicatifPays2')} placeholder="+" style={{ ...FIS, width: 56, flexShrink: 0 }} />
              <input value={form.Téléphone2} onChange={f('Téléphone2')} placeholder="..." style={{ ...FIS, flex: 1 }} />
            </div>
          </FRow>
        </Grid2>

        {/* Adresses — multiple */}
        <Section title="Adresses" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {addrList.map((addr, i) => (
            <div
              key={i}
              style={{
                border: '1px solid var(--bd)', padding: '14px 16px',
                background: 'var(--bg0)', position: 'relative',
                marginBottom: 4,
              }}
            >
              {addrList.length > 1 && (
                <button
                  onClick={() => removeAddr(i)}
                  style={{
                    position: 'absolute', top: 8, right: 8,
                    background: 'none', border: 'none',
                    color: 'var(--tx3)', cursor: 'pointer', fontSize: 10,
                  }}
                >✕</button>
              )}
              <Grid2>
                <FRow label="Libellé (ex: Principal)"><input value={addr.label} onChange={(e) => updateAddr(i, 'label', e.target.value)} onBlur={e => updateAddr(i, 'label', cap(e.target.value))} placeholder="Bureau, Domicile..." style={FIS} /></FRow>
                <FRow label="Code Postal"><input value={addr.code_postal} onChange={(e) => updateAddr(i, 'code_postal', e.target.value)} placeholder="75001..." style={FIS} /></FRow>
                <FRow label="Ville"><input value={addr.ville} onChange={(e) => updateAddr(i, 'ville', e.target.value)} onBlur={e => updateAddr(i, 'ville', cap(e.target.value))} style={FIS} /></FRow>
                <FRow label="Pays"><input value={addr.pays} onChange={(e) => updateAddr(i, 'pays', e.target.value)} onBlur={e => updateAddr(i, 'pays', cap(e.target.value))} style={FIS} /></FRow>
              </Grid2>
              <div style={{ marginTop: 8 }}>
                <FRow label="Adresse (rue, n°, etc.)"><input value={addr.adresse} onChange={(e) => updateAddr(i, 'adresse', e.target.value)} onBlur={e => updateAddr(i, 'adresse', cap(e.target.value))} style={FIS} /></FRow>
              </div>
            </div>
          ))}
          <button
            onClick={addAddr}
            style={{
              background: 'none', border: '1px dashed var(--bd)',
              color: 'var(--tx3)', padding: '8px',
              cursor: 'pointer', fontSize: 10, letterSpacing: 0.5,
              textAlign: 'center' as const,
            }}
          >
            + Ajouter une adresse
          </button>
        </div>

        {/* Réseaux sociaux */}
        <Section title="Réseaux sociaux" />
        <Grid2>
          <FRow label="Instagram"><input value={form.Instagram} onChange={f('Instagram')} placeholder="@handle ou URL" style={FIS} /></FRow>
          <FRow label="LinkedIn"><input value={form.LinkedIn} onChange={f('LinkedIn')} placeholder="handle ou URL" style={FIS} /></FRow>
          <FRow label="Facebook"><input value={form.Facebook} onChange={f('Facebook')} placeholder="handle ou URL" style={FIS} /></FRow>
          <FRow label="Twitter / X"><input value={form.Twitter} onChange={f('Twitter')} placeholder="@handle ou URL" style={FIS} /></FRow>
        </Grid2>

        {/* Notes */}
        <Section title="Notes" />
        <textarea
          value={form.Notes}
          onChange={f('Notes')}
          rows={3}
          style={{ ...FIS, resize: 'vertical', lineHeight: 1.6 }}
          placeholder="Notes libres..."
        />

        {err && <div style={{ fontSize: 11, color: 'var(--rust)', marginTop: 10 }}>{err}</div>}

        <div className="row gap-sm" style={{ marginTop: 20, justifyContent: 'flex-end' }}>
          <button className="btn ghost sm" onClick={onClose} disabled={busy}>Annuler</button>
          <button className="btn primary sm" onClick={() => void handleSave()} disabled={busy}>
            {busy ? '...' : isNew ? 'Créer' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}
