'use client'

// WorldMapTab — contacts + works on an interactive Leaflet map.
// Fetches contact_addresses (multiple per contact) and Contact.Ville/Pays as fallback.
// Both fetches run in parallel; pin building only starts when BOTH complete.

import { useState, useEffect, useRef, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import type { Oeuvre } from '@/lib/types/database'
import { LoadingShell } from '@/components/shared/LoadingShell'

interface ContactRow {
  ContactID:      number
  NomInstitution: string | null
  Nom:            string | null
  Prénom:         string | null
  Role:           string | null
  Ville?:         string | null
  Pays?:          string | null
}

interface ContactAddress {
  id:          number
  contact_id:  number
  label:       string | null
  ville:       string | null
  pays:        string | null
}

export interface Props {
  contacts:        ContactRow[]
  oeuvres:         Oeuvre[]
  /** Technique id → label (works filter) */
  tM:              Record<number, string>
  /** Theme id → label (works filter) */
  thM?:            Record<number, string>
  statusLabelMap:  Record<number, string>
  oeuvreThemeMap?: Map<number, number[]>
  onOpenContact?:  (id: number) => void
  /** Context menu on work-mode pins: right-click = first work, Ctrl+right-click = second if clustered. */
  onOpenOeuvreById?: (oeuvreId: number) => void
}

export interface Pin {
  id:         string
  lat:        number
  lng:        number
  label:      string
  sub:        string
  color:      string
  count:      number
  contactId?: number
  works?:     string[]
  workThumbs?: string[]   // parallel array of txtImageNameLink paths
  contacts?:  { id: number; name: string; role: string | null }[]  // for multi-contact pins
  oeuvreIds?: number[]    // works-mode pin: OeuvreIDs at this location (order matches thumbs)
}

export const ROLE_COLORS: Record<string, string> = {
  Artiste:        '#c0a060',
  Galeriste:      '#6090c0',
  Collectionneur: '#80c080',
  Curateur:       '#c08080',
  Institution:    '#a060c0',
  Presse:         '#60c0b0',
  Magasin:        '#e0a040',
  Famille:        '#e06080',
  Transporteur:   '#70b0b0',
  Fabricant:      '#b0b060',
  Autre:          '#888888',
}

export function roleColor(role: string | null): string {
  return (role && ROLE_COLORS[role]) ?? '#aaaaaa'
}

// ── Geocode cache — module-level + localStorage (survives new browser sessions) ─
const GEO_STORAGE_KEY = 'pem_geo_cache'
const geoCache = new Map<string, [number, number] | null>()

function readGeoStorage(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const fromLocal = window.localStorage.getItem(GEO_STORAGE_KEY)
    if (fromLocal) return fromLocal
    const legacy = window.sessionStorage.getItem(GEO_STORAGE_KEY)
    if (legacy) {
      window.localStorage.setItem(GEO_STORAGE_KEY, legacy)
      window.sessionStorage.removeItem(GEO_STORAGE_KEY)
    }
    return legacy
  } catch {
    return null
  }
}

// Hydrate on module load — skip null entries (do not persist failed lookups)
try {
  const stored = readGeoStorage()
  if (stored) {
    const parsed = JSON.parse(stored) as Record<string, [number, number] | null>
    Object.entries(parsed).forEach(([k, v]) => {
      if (v !== null) geoCache.set(k, v)
    })
  }
} catch {
  /* invalid JSON */
}

function persistGeoCache() {
  if (typeof window === 'undefined') return
  try {
    const obj: Record<string, [number, number] | null> = {}
    geoCache.forEach((v, k) => {
      obj[k] = v
    })
    window.localStorage.setItem(GEO_STORAGE_KEY, JSON.stringify(obj))
  } catch {
    /* quota or private browsing */
  }
}

async function geocode(city: string, country: string): Promise<[number, number] | null> {
  const key = `${city}|${country}`.toLowerCase().trim()
  if (!key || key === '|') return null
  if (geoCache.has(key)) return geoCache.get(key)!
  try {
    const params = new URLSearchParams()
    if (city) params.set('city', city)
    if (country) params.set('country', country)
    const res = await fetch(`/api/geocode?${params}`, { cache: 'no-store' })
    if (res.status === 404 || !res.ok) return null
    const data = (await res.json()) as { lat?: number; lng?: number } | null
    if (data && typeof data.lat === 'number' && typeof data.lng === 'number') {
      const tuple: [number, number] = [data.lat, data.lng]
      geoCache.set(key, tuple)
      persistGeoCache()
      return tuple
    }
  } catch { /* network */ }
  // Do NOT cache null — transient failures (rate limit, network) would permanently block geocoding.
  // A failed location simply skips; it will be retried on next render.
  return null
}

// ── Leaflet dynamic import ─────────────────────────────────────────────
interface MapProps {
  pins: Pin[]
  mapKey: string
  onOpenContact?: (id: number) => void
  onOpenOeuvreById?: (oeuvreId: number) => void
}
const LeafletMap = dynamic<MapProps>(
  () => import('./WorldMapInner').then(m => m.WorldMapInner),
  { ssr: false, loading: () => <div style={{ flex: 1, background: '#0d0d0d' }} /> },
)

type Mode = 'contacts' | 'works'

// ── Component ──────────────────────────────────────────────────────────
const SANS_ROLE = '(Sans rôle)'
const EMPTY_THEME_MAP = new Map<number, number[]>()

export function WorldMapTab({
  contacts,
  oeuvres,
  tM,
  thM = {},
  statusLabelMap,
  oeuvreThemeMap: oeuvreThemeMapProp,
  onOpenContact,
  onOpenOeuvreById,
}: Props) {
  const oeuvreThemeMap = oeuvreThemeMapProp ?? EMPTY_THEME_MAP
  const [mode,      setMode]      = useState<Mode>('contacts')
  const [pins,      setPins]      = useState<Pin[]>([])
  const [loading,   setLoading]   = useState(false)
  const [dataReady, setDataReady] = useState(false)
  const [addresses, setAddresses] = useState<ContactAddress[]>([])
  const abortRef = useRef(false)

  /** Contacts mode: hidden roles (empty = show all roles) */
  const [hiddenRoles, setHiddenRoles] = useState<Set<string>>(() => new Set())
  /** Contacts mode: '' = all countries */
  const [countryFilter, setCountryFilter] = useState('')
  /** Works mode: hidden status ids */
  const [hiddenStatusIds, setHiddenStatusIds] = useState<Set<number>>(() => new Set())
  /** Works mode: hidden theme ids */
  const [hiddenThemeIds, setHiddenThemeIds] = useState<Set<number>>(() => new Set())
  /** Works mode: hidden technique ids */
  const [hiddenTechniqueIds, setHiddenTechniqueIds] = useState<Set<number>>(() => new Set())

  const rolesInData = useMemo(() => {
    const s = new Set<string>()
    contacts.forEach((c) => s.add(c.Role || SANS_ROLE))
    return [...s].sort((a, b) => a.localeCompare(b, 'fr'))
  }, [contacts])

  const paysOptions = useMemo(() => {
    const s = new Set<string>()
    addresses.forEach((a) => {
      if (a.pays?.trim()) s.add(a.pays.trim())
    })
    contacts.forEach((c) => {
      if (c.Pays?.trim()) s.add(c.Pays.trim())
    })
    return [...s].sort((a, b) => a.localeCompare(b, 'fr'))
  }, [addresses, contacts])

  const statusIdsInData = useMemo(() => {
    const s = new Set<number>()
    oeuvres.forEach((o) => {
      if (o.statusId != null) s.add(o.statusId)
    })
    return [...s].sort((a, b) => a - b)
  }, [oeuvres])

  const themeIdsInData = useMemo(() => {
    const s = new Set<number>()
    oeuvreThemeMap.forEach((ids) => ids.forEach((id) => s.add(id)))
    return [...s].sort((a, b) => a - b)
  }, [oeuvreThemeMap])

  const techniqueIdsInData = useMemo(() => {
    const s = new Set<number>()
    oeuvres.forEach((o) => {
      if (o.Technique != null) s.add(o.Technique)
    })
    return [...s].sort((a, b) => a - b)
  }, [oeuvres])

  function roleKey(role: string | null | undefined) {
    return role || SANS_ROLE
  }

  function passesContactFilters(c: ContactRow): boolean {
    if (hiddenRoles.has(roleKey(c.Role))) return false
    return true
  }

  function passesCountryOnEntry(ville: string, pays: string): boolean {
    if (!countryFilter) return true
    return (pays || '').trim().toLowerCase() === countryFilter.trim().toLowerCase()
  }

  const oeuvresFiltered = useMemo(
    () => oeuvres.filter((o) => {
      if (o.statusId != null && hiddenStatusIds.has(o.statusId)) return false
      if (o.statusId == null && hiddenStatusIds.has(-1)) return false
      if (o.Technique != null && hiddenTechniqueIds.has(o.Technique)) return false
      if (o.Technique == null && hiddenTechniqueIds.has(-1)) return false
      if (oeuvreThemeMap.size === 0) return true
      const tids = oeuvreThemeMap.get(o.OeuvreID)
      if (!tids?.length) return !hiddenThemeIds.has(-1)
      return tids.some((id) => !hiddenThemeIds.has(id))
    }),
    [oeuvres, hiddenStatusIds, hiddenThemeIds, hiddenTechniqueIds, oeuvreThemeMap],
  )

  const hasWorksSansStatus = useMemo(
    () => oeuvres.some((o) => o.statusId == null),
    [oeuvres],
  )
  const hasWorksSansTechnique = useMemo(
    () => oeuvres.some((o) => o.Technique == null),
    [oeuvres],
  )
  const hasWorksSansTheme = useMemo(
    () => oeuvreThemeMap.size > 0 && oeuvres.some((o) => !oeuvreThemeMap.get(o.OeuvreID)?.length),
    [oeuvres, oeuvreThemeMap],
  )

  const filtersActive =
    hiddenRoles.size > 0 ||
    countryFilter !== '' ||
    hiddenStatusIds.size > 0 ||
    hiddenThemeIds.size > 0 ||
    hiddenTechniqueIds.size > 0

  // Contacts come from page.tsx props — no re-fetch needed.
  // Only fetch contact_addresses (not loaded server-side).
  useEffect(() => {
    const sb = createClient()
    ;(sb.from('contact_addresses') as any)
      .select('id, contact_id, label, ville, pays')
      .order('position')
      .then(({ data }: { data: ContactAddress[] | null }) => {
        if (data) setAddresses(data)
        setDataReady(true)
      })
      .catch(() => setDataReady(true))
  }, [])

  // Build pins once data FIS ready, or when mode / filters change
  useEffect(() => {
    if (!dataReady) return
    abortRef.current = false
    setLoading(true)
    setPins([])
    if (mode === 'contacts') void buildContactPins()
    else void buildWorkPins()
    return () => { abortRef.current = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    dataReady,
    mode,
    contacts,
    addresses,
    countryFilter,
    hiddenRoles,
    oeuvresFiltered,
  ])

  async function buildContactPins() {
    const result: Pin[] = []
    const contactMap = new Map<number, ContactRow>()
    contacts.forEach(c => contactMap.set(c.ContactID, c))

    // Build location entries: prefer contact_addresses, fallback to Contact.Ville/Pays
    interface LocEntry { contact_id: number; ville: string; pays: string; label: string | null }
    const locEntries: LocEntry[] = []

    if (addresses.length > 0) {
      // Contacts with any ville/pays on an address row: never fall back to the Contact card for the map
      // (keeps country-filter behaviour when rows exist but are filtered out). Placeholder-only rows
      // (label/street, no city/country) must NOT block Contact.Ville/Pays.
      const contactsWithGeocodableAddressRow = new Set<number>()
      addresses.forEach((a) => {
        if (a.ville || a.pays) contactsWithGeocodableAddressRow.add(a.contact_id)
      })
      addresses.forEach(a => {
        if (a.ville || a.pays) {
          const contact = contactMap.get(a.contact_id)
          if (!contact || !passesContactFilters(contact)) return
          if (!passesCountryOnEntry(a.ville ?? '', a.pays ?? '')) return
          locEntries.push({ contact_id: a.contact_id, ville: a.ville ?? '', pays: a.pays ?? '', label: a.label })
        }
      })
      contacts.forEach(c => {
        if (!contactsWithGeocodableAddressRow.has(c.ContactID) && (c.Ville || c.Pays)) {
          if (!passesContactFilters(c)) return
          if (!passesCountryOnEntry(c.Ville ?? '', c.Pays ?? '')) return
          locEntries.push({ contact_id: c.ContactID, ville: c.Ville ?? '', pays: c.Pays ?? '', label: null })
        }
      })
    } else {
      // No contact_addresses at all — fall back to Contact.Ville/Pays
      contacts.forEach(c => {
        if (c.Ville || c.Pays) {
          if (!passesContactFilters(c)) return
          if (!passesCountryOnEntry(c.Ville ?? '', c.Pays ?? '')) return
          locEntries.push({ contact_id: c.ContactID, ville: c.Ville ?? '', pays: c.Pays ?? '', label: null })
        }
      })
    }

    if (locEntries.length === 0) { setLoading(false); return }

    // Group by ville|pays
    const groups = new Map<string, { contactId: number; contact: ContactRow }[]>()
    locEntries.forEach(e => {
      const key = `${e.ville}|${e.pays}`
      const contact = contactMap.get(e.contact_id)
      if (!contact) return
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push({ contactId: e.contact_id, contact })
    })

    for (const [key, entries] of groups) {
      if (abortRef.current) break
      const [city, country] = key.split('|')
      const coords = await geocode(city, country)
      if (!coords || abortRef.current) continue

      const lat = coords[0] + (Math.random() - 0.5) * 0.008
      const lng = coords[1] + (Math.random() - 0.5) * 0.008

      const unique = [...new Map(entries.map(e => [e.contactId, e.contact])).values()]
      const roleCount: Record<string, number> = {}
      unique.forEach(c => { if (c.Role) roleCount[c.Role] = (roleCount[c.Role] ?? 0) + 1 })
      const topRole = Object.entries(roleCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

      const label = unique.length === 1
        ? (unique[0].NomInstitution || `${unique[0].Prénom ?? ''} ${unique[0].Nom ?? ''}`.trim() || `#${unique[0].ContactID}`)
        : `${unique.length} contacts`
      const sub   = [city, country].filter(Boolean).join(', ') + (topRole ? ` · ${topRole}` : '')

      const ids      = new Set(unique.map(c => c.ContactID))
      const assoc    = oeuvresFiltered.filter(o =>
        (o.ContactID != null && ids.has(o.ContactID)) ||
        ((o as any).AcheteurID != null && ids.has((o as any).AcheteurID))
      )
      const workTitles  = assoc.map(o => o.Titre ?? `#${o.OeuvreID}`).filter(Boolean).slice(0, 12) as string[]
      const workThumbs  = assoc.map(o => o.txtImageNameLink ?? '').filter(Boolean).slice(0, 6) as string[]
      const contactList = unique.slice(0, 12).map(c => ({
        id:   c.ContactID,
        name: c.NomInstitution || `${c.Prénom ?? ''} ${c.Nom ?? ''}`.trim() || `#${c.ContactID}`,
        role: c.Role,
      }))

      result.push({
        id: key, lat, lng, label, sub,
        color: roleColor(topRole), count: unique.length,
        works: workTitles,
        workThumbs,
        contacts: unique.length > 1 ? contactList : undefined,
        contactId: unique.length === 1 ? unique[0].ContactID : undefined,
      })
      if (!abortRef.current) setPins([...result])
    }
    if (!abortRef.current) setLoading(false)
  }

  async function buildWorkPins() {
    const result: Pin[] = []

    // Build contactLocMap: ContactID → { city, country }
    // Priority: Contact.Ville/Pays first, then contact_addresses as supplement.
    const contactLocMap = new Map<number, { city: string; country: string }>()
    contacts.forEach(c => {
      if (c.Ville || c.Pays) contactLocMap.set(c.ContactID, { city: c.Ville ?? '', country: c.Pays ?? '' })
    })
    if (addresses.length > 0) {
      addresses.forEach(a => {
        if ((a.ville || a.pays) && !contactLocMap.has(a.contact_id)) {
          contactLocMap.set(a.contact_id, { city: a.ville ?? '', country: a.pays ?? '' })
        }
      })
    }

    // Location priority: LocalisationID (where work FIS stored) → ContactID → PEM (13).
    // LocalisationDetail FIS free text (e.g. "Atelier", "Cave") — NOT used for geocoding.
    interface WorkLocMeta { city: string; country: string; label: string }
    const groups  = new Map<string, Oeuvre[]>()
    const keyMeta = new Map<string, WorkLocMeta>()

    oeuvresFiltered.forEach(o => {
      const locId = (o as any).LocalisationID as number | null
      const cid   = locId ?? o.ContactID ?? 13
      const addr  = contactLocMap.get(cid) ?? contactLocMap.get(13)
      if (!addr) return
      const { city, country } = addr
      if (!city && !country) return
      const locLabel = [city, country].filter(Boolean).join(', ')
      const key = `${city}|${country}`
      if (!groups.has(key)) { groups.set(key, []); keyMeta.set(key, { city, country, label: locLabel }) }
      groups.get(key)!.push(o)
    })

    for (const [key, group] of groups) {
      if (abortRef.current) break
      const meta   = keyMeta.get(key)!
      const coords = await geocode(meta.city, meta.country)
      if (!coords || abortRef.current) continue
      const lat   = coords[0] + (Math.random() - 0.5) * 0.008
      const lng   = coords[1] + (Math.random() - 0.5) * 0.008
      const label = group.length === 1 ? (group[0].Titre ?? `#${group[0].OeuvreID}`) : `${group.length} œuvres`
      const workThumbs = group.map(o => o.txtImageNameLink ?? '').filter(Boolean).slice(0, 6) as string[]
      result.push({
        id: key,
        lat,
        lng,
        label,
        sub: meta.label,
        color: '#c0a060',
        count: group.length,
        workThumbs,
        oeuvreIds: group.map((w) => w.OeuvreID),
      })
      if (!abortRef.current) setPins([...result])
    }
    if (!abortRef.current) setLoading(false)
  }

  const addrCount = addresses.length > 0
    ? addresses.length
    : contacts.filter(c => c.Ville || c.Pays).length
  const worksWithLoc = oeuvresFiltered.length

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        padding: '10px 28px', borderBottom: '1px solid var(--bd)',
        background: 'var(--bg1)', flexShrink: 0,
      }}>
        <div className="t-label">Vue</div>
        {(['contacts', 'works'] as Mode[]).map(m => (
          <button key={m} className="btn ghost sm" onClick={() => setMode(m)}
            style={{ opacity: mode === m ? 1 : 0.45, fontWeight: mode === m ? 700 : 400 }}
          >
            {m === 'contacts' ? `Contacts (${addrCount} adresses)` : `Œuvres (${worksWithLoc})`}
          </button>
        ))}
        {mode === 'works' && (
          <span className="t-mono-sm" style={{ color: 'var(--tx3)', fontSize: 9 }}>
            Marqueur · clic dr. → fiche · Ctrl+clic dr. → 2e œuvre si plusieurs au point
          </span>
        )}
        {loading && (
          <div className="t-mono-sm" style={{ color: 'var(--tx3)' }}>
            Géocodage… {pins.length} point{pins.length > 1 ? 's' : ''}
          </div>
        )}
        {!loading && !dataReady && (
          <LoadingShell />
        )}
        {!loading && dataReady && (
          <button className="btn ghost sm" onClick={() => {
            geoCache.clear()
            try { sessionStorage.removeItem(GEO_STORAGE_KEY) } catch { /* */ }
            setDataReady(false)
            setTimeout(() => setDataReady(true), 10)
          }} style={{ opacity: 0.5, fontSize: 9 }}>
            ↺ Rafraîchir
          </button>
        )}
        {filtersActive && (
          <button
            type="button"
            className="btn ghost sm"
            style={{ marginLeft: 'auto', fontSize: 9 }}
            onClick={() => {
              setHiddenRoles(new Set())
              setCountryFilter('')
              setHiddenStatusIds(new Set())
              setHiddenThemeIds(new Set())
              setHiddenTechniqueIds(new Set())
            }}
          >
            ✕ Filtres
          </button>
        )}
      </div>

      {/* Filters */}
      {dataReady && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
          padding: '8px 28px 10px', borderBottom: '1px solid var(--bd)',
          background: 'var(--bg0)', flexShrink: 0,
        }}>
          {mode === 'contacts' && (
            <>
              {paysOptions.length > 0 && (
                <>
                  <div className="t-label">Pays</div>
                  <select
                    className="btn ghost sm"
                    style={{ fontSize: 10, maxWidth: 200, padding: '4px 8px' }}
                    value={countryFilter}
                    onChange={(e) => setCountryFilter(e.target.value)}
                  >
                    <option value="">Tous pays</option>
                    {paysOptions.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </>
              )}
              {rolesInData.length > 0 && (
                <>
                  <div className="t-label">Rôles</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    {rolesInData.map((role) => {
                      const hidden = hiddenRoles.has(role)
                      const dot = role === SANS_ROLE ? '#888' : roleColor(role)
                      return (
                        <button
                          key={role}
                          type="button"
                          className="btn ghost sm"
                          title={hidden ? 'Afficher sur la carte' : 'Masquer'}
                          style={{
                            opacity: hidden ? 0.35 : 1,
                            fontSize: 10,
                            borderLeft: `3px solid ${dot}`,
                            paddingLeft: 8,
                          }}
                          onClick={() => setHiddenRoles((prev) => {
                            const n = new Set(prev)
                            if (n.has(role)) n.delete(role)
                            else n.add(role)
                            return n
                          })}
                        >
                          {role === SANS_ROLE ? 'Sans rôle' : role}
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
            </>
          )}
          {mode === 'works' && (
            <>
              {(statusIdsInData.length > 0 || hasWorksSansStatus) && (
              <>
              <div className="t-label">Statut</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                {statusIdsInData.map((id) => (
                  <button
                    key={id}
                    type="button"
                    className="btn ghost sm"
                    style={{ fontSize: 10, opacity: hiddenStatusIds.has(id) ? 0.35 : 1 }}
                    onClick={() => setHiddenStatusIds((prev) => {
                      const n = new Set(prev)
                      if (n.has(id)) n.delete(id)
                      else n.add(id)
                      return n
                    })}
                  >
                    {statusLabelMap[id] ?? `#${id}`}
                  </button>
                ))}
                {hasWorksSansStatus && (
                  <button
                    type="button"
                    className="btn ghost sm"
                    style={{ fontSize: 10, opacity: hiddenStatusIds.has(-1) ? 0.35 : 1 }}
                    onClick={() => setHiddenStatusIds((prev) => {
                      const n = new Set(prev)
                      if (n.has(-1)) n.delete(-1)
                      else n.add(-1)
                      return n
                    })}
                  >
                    Sans statut
                  </button>
                )}
              </div>
              </>
              )}
              {oeuvreThemeMap.size > 0 && (themeIdsInData.length > 0 || hasWorksSansTheme) && (
                <>
                  <div className="t-label">Thème</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    {themeIdsInData.map((id) => (
                      <button
                        key={id}
                        type="button"
                        className="btn ghost sm"
                        style={{ fontSize: 10, opacity: hiddenThemeIds.has(id) ? 0.35 : 1 }}
                        onClick={() => setHiddenThemeIds((prev) => {
                          const n = new Set(prev)
                          if (n.has(id)) n.delete(id)
                          else n.add(id)
                          return n
                        })}
                      >
                        {thM[id] ?? `#${id}`}
                      </button>
                    ))}
                    {hasWorksSansTheme && (
                      <button
                        type="button"
                        className="btn ghost sm"
                        style={{ fontSize: 10, opacity: hiddenThemeIds.has(-1) ? 0.35 : 1 }}
                        onClick={() => setHiddenThemeIds((prev) => {
                          const n = new Set(prev)
                          if (n.has(-1)) n.delete(-1)
                          else n.add(-1)
                          return n
                        })}
                      >
                        Sans thème
                      </button>
                    )}
                  </div>
                </>
              )}
              {(techniqueIdsInData.length > 0 || hasWorksSansTechnique) && (
              <>
              <div className="t-label">Technique</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                {techniqueIdsInData.map((id) => (
                  <button
                    key={id}
                    type="button"
                    className="btn ghost sm"
                    style={{ fontSize: 10, opacity: hiddenTechniqueIds.has(id) ? 0.35 : 1 }}
                    onClick={() => setHiddenTechniqueIds((prev) => {
                      const n = new Set(prev)
                      if (n.has(id)) n.delete(id)
                      else n.add(id)
                      return n
                    })}
                  >
                    {tM[id] ?? `#${id}`}
                  </button>
                ))}
                {hasWorksSansTechnique && (
                  <button
                    type="button"
                    className="btn ghost sm"
                    style={{ fontSize: 10, opacity: hiddenTechniqueIds.has(-1) ? 0.35 : 1 }}
                    onClick={() => setHiddenTechniqueIds((prev) => {
                      const n = new Set(prev)
                      if (n.has(-1)) n.delete(-1)
                      else n.add(-1)
                      return n
                    })}
                  >
                    Sans technique
                  </button>
                )}
              </div>
              </>
              )}
            </>
          )}
        </div>
      )}

      {/* Map */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        {pins.length === 0 && !loading && dataReady && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none', zIndex: 500,
          }}>
            <div className="t-mono-sm" style={{ color: 'var(--tx3)' }}>
              {mode === 'contacts'
                ? 'Aucune adresse trouvée. Ajoutez Ville/Pays dans l\'onglet Contacts.'
                : 'Aucune œuvre trouvée.'}
            </div>
          </div>
        )}
        <LeafletMap
          pins={pins}
          mapKey={mode}
          onOpenContact={onOpenContact}
          onOpenOeuvreById={onOpenOeuvreById}
        />
      </div>
    </div>
  )
}
