'use client'

// WorldMapTab — contacts + works on an interactive Leaflet map.
// Fetches contact_addresses (multiple per contact) and Contact.Ville/Pays as fallback.
// Both fetches run in parallel; pin building only starts when BOTH complete.
// R4 (Pem 2026-11-17): « Création » mode = where works were made, at the `place` rows' own coordinates
// (no geocoding); « Œuvres » places a work at its own address (custody model), not its custodian's card
// city; pin offsets are stable (no random jitter).

import { useState, useEffect, useRef, useMemo, type Dispatch, type MouseEvent, type SetStateAction } from 'react'
import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Oeuvre } from '@/lib/types/database'
import { LoadingShell } from '@/components/shared/LoadingShell'
import { useI18n } from '@/lib/i18n/context'
import { interpolateMessage } from '@/lib/i18n/message-core'
import { loadTimePlaceData, type TimePlaceData } from '@/app/atelier/time-place-actions'
import { nearestPlace } from '@/lib/work-periods'
import { untitledLine } from '@/lib/work-preview-cache'
import { FIELD_PLACE_COLOR, inSpan, monthKey, parseMonthKey, placeColor, studioOrder } from '@/lib/time-place'

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
  /** « Création » pins: fixed radius, ring (place read from the period), dotted (GPS suggestion). */
  radius?:    number
  hollow?:    boolean
  dashed?:    boolean
  /** Parallel to `workThumbs`: each thumbnail links to its work. */
  thumbIds?:  number[]
  /** A link under the popup (« Voir dans le temps » → the Chronologie). */
  link?:      { href: string; label: string }
}

/** Stable small offset (was random on every load: the same pin moved a little each time). */
function stableOffset(key: string): [number, number] {
  let h = 2166136261
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  const u = h >>> 0
  return [((u % 1000) / 1000 - 0.5) * 0.008, (((u >>> 10) % 1000) / 1000 - 0.5) * 0.008]
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
  /** « Création »: Pem's route between studios, in period order. */
  route?: [number, number][]
  mapKey: string
  onOpenContact?: (id: number) => void
  onOpenOeuvreById?: (oeuvreId: number) => void
}
const LeafletMap = dynamic<MapProps>(
  () => import('./WorldMapInner').then(m => m.WorldMapInner),
  { ssr: false, loading: () => <div style={{ flex: 1, background: '#0d0d0d' }} /> },
)

type Mode = 'contacts' | 'works' | 'creation'

// ── Component ──────────────────────────────────────────────────────────
const SANS_ROLE = '(Sans rôle)'
const EMPTY_THEME_MAP = new Map<number, number[]>()

/**
 * Chip filter update. Plain click toggles one chip; `solo` shows only that chip,
 * and soloing the chip that is already alone shows everything again.
 */
function chipFilterUpdate<T>(prev: Set<T>, key: T, all: T[], solo: boolean): Set<T> {
  if (!solo) {
    const n = new Set(prev)
    if (n.has(key)) n.delete(key)
    else n.add(key)
    return n
  }
  const alreadyAlone = !prev.has(key) && all.every((k) => k === key || prev.has(k))
  return alreadyAlone ? new Set<T>() : new Set(all.filter((k) => k !== key))
}

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
  const { t } = useI18n()
  const oeuvreThemeMap = oeuvreThemeMapProp ?? EMPTY_THEME_MAP
  const params = useSearchParams()
  const [mode,      setMode]      = useState<Mode>(() => (params?.get('mode') === 'creation' ? 'creation' : 'contacts'))
  /** « Voir sur la carte » from the Chronologie: `?mode=creation&from=2026-05&to=2026-11`. */
  const [span, setSpan] = useState<{ from: number; to: number } | null>(() => {
    const from = parseMonthKey(params?.get('from'))
    const to = parseMonthKey(params?.get('to'))
    return from != null && to != null && from <= to ? { from, to } : null
  })
  // The tab can stay mounted while the URL changes (« Voir sur la carte » from the Chronologie, Carte → Création):
  // follow `?mode=creation` / `?from=&to=` when they appear, not only on the first render.
  const urlMode = params?.get('mode') ?? null
  const urlFrom = params?.get('from') ?? null
  const urlTo = params?.get('to') ?? null
  useEffect(() => {
    if (urlMode !== 'creation') return
    setMode('creation')
    const from = parseMonthKey(urlFrom)
    const to = parseMonthKey(urlTo)
    if (from != null && to != null && from <= to) setSpan({ from, to })
  }, [urlMode, urlFrom, urlTo])
  const [pins,      setPins]      = useState<Pin[]>([])
  const [loading,   setLoading]   = useState(false)
  const [dataReady, setDataReady] = useState(false)
  const [addresses, setAddresses] = useState<ContactAddress[]>([])
  const abortRef = useRef(false)
  /** « Création »: the whole catalogue's places of making, loaded on first use. */
  const [tp, setTp] = useState<TimePlaceData | null>(null)
  const [tpError, setTpError] = useState(false)
  /** « Création »: only works of this period (null = all). */
  const [periodFilter, setPeriodFilter] = useState<number | null>(null)

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
  /** Every chip key per group (-1 = "no status/theme/technique"), for solo and None. */
  const allStatusKeys = useMemo(
    () => (hasWorksSansStatus ? [...statusIdsInData, -1] : statusIdsInData),
    [statusIdsInData, hasWorksSansStatus],
  )
  const allThemeKeys = useMemo(
    () => (hasWorksSansTheme ? [...themeIdsInData, -1] : themeIdsInData),
    [themeIdsInData, hasWorksSansTheme],
  )
  const allTechniqueKeys = useMemo(
    () => (hasWorksSansTechnique ? [...techniqueIdsInData, -1] : techniqueIdsInData),
    [techniqueIdsInData, hasWorksSansTechnique],
  )

  /** Click toggles; Alt-click, right-click or long-press (contextmenu) shows only this chip. */
  const chipHandlers = <T,>(setHidden: Dispatch<SetStateAction<Set<T>>>, all: T[], key: T) => ({
    title: t('map_chip_hint'),
    onClick: (e: MouseEvent) => setHidden((prev) => chipFilterUpdate(prev, key, all, e.altKey)),
    onContextMenu: (e: MouseEvent) => {
      e.preventDefault()
      setHidden((prev) => chipFilterUpdate(prev, key, all, true))
    },
  })

  const chipGroupLabel = <T,>(label: string, setHidden: Dispatch<SetStateAction<Set<T>>>, all: T[]) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <div className="t-label">{label}</div>
      <button type="button" className="btn ghost sm" style={{ fontSize: 9, padding: '2px 6px' }}
        onClick={() => setHidden(new Set<T>())}>{t('map_chips_all')}</button>
      <button type="button" className="btn ghost sm" style={{ fontSize: 9, padding: '2px 6px' }}
        onClick={() => setHidden(new Set(all))}>{t('map_chips_none')}</button>
    </div>
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
    void (sb.from('contact_addresses')
      .select('id, contact_id, label, ville, pays')
      .order('position')
      .then(
        ({ data }: { data: ContactAddress[] | null }) => {
          if (data) setAddresses(data)
          setDataReady(true)
        },
        () => setDataReady(true),
      ))
  }, [])

  // Build pins once data FIS ready, or when mode / filters change
  useEffect(() => {
    if (!dataReady) return
    abortRef.current = false
    setLoading(true)
    setPins([])
    if (mode === 'contacts') void buildContactPins()
    else if (mode === 'works') void buildWorkPins()
    else setLoading(false)
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

      const [dLat, dLng] = stableOffset(key)
      const lat = coords[0] + dLat
      const lng = coords[1] + dLng

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
        (o.AcheteurID != null && ids.has(o.AcheteurID))
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
    const addrById = new Map(addresses.map((a) => [a.id, a]))

    oeuvresFiltered.forEach(o => {
      // The work's own address first (custody model: always one of its custodian's addresses) —
      // #1653 sits at its custodian's Rutali address while that contact's card says Marseille.
      const own   = o.localisation_address_id != null ? addrById.get(o.localisation_address_id) : undefined
      const locId = o.LocalisationID
      const cid   = locId ?? o.ContactID ?? 13
      const addr  = own && (own.ville || own.pays)
        ? { city: own.ville ?? '', country: own.pays ?? '' }
        : (contactLocMap.get(cid) ?? contactLocMap.get(13))
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
      const [dLat, dLng] = stableOffset(key)
      const lat   = coords[0] + dLat
      const lng   = coords[1] + dLng
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

  // « Création »: load the whole catalogue's places of making once, on first use.
  useEffect(() => {
    if (mode !== 'creation' || tp || tpError) return
    let cancelled = false
    void loadTimePlaceData().then(
      (res) => {
        if (cancelled) return
        if ('error' in res) setTpError(true)
        else setTp(res)
      },
      () => {
        if (!cancelled) setTpError(true)
      },
    )
    return () => {
      cancelled = true
    }
  }, [mode, tp, tpError])

  const creation = useMemo(() => {
    if (!tp) return null
    const periodsInOrder = [...tp.periods].sort((a, b) => a.start_on.localeCompare(b.start_on))
    const studioIds = studioOrder(tp.periods)
    const colorOf = (placeId: number) => placeColor(placeId, studioIds)
    let works = periodFilter == null ? tp.works : tp.works.filter((w) => w.periodId === periodFilter)
    // From the Chronologie (« Voir sur la carte »): only works made in that span.
    if (span) works = works.filter((w) => inSpan(w.day, w.year, span.from, span.to))
    const byPlace = new Map<number, typeof works>()
    let none = 0
    for (const w of works) {
      if (w.placeId == null) { none++; continue }
      const list = byPlace.get(w.placeId) ?? []
      list.push(w)
      byPlace.set(w.placeId, list)
    }
    const result: Pin[] = []
    let precise = 0
    let byPeriod = 0
    for (const [placeId, list] of byPlace) {
      const place = tp.places.find((p) => p.id === placeId)
      const own = list.filter((w) => w.precise).length
      precise += own
      byPeriod += list.length - own
      if (!place || place.latitude == null || place.longitude == null) continue
      // Own places first, then the most recent works.
      const shown = [...list].sort((a, b) => Number(b.precise) - Number(a.precise) || b.id - a.id).filter((w) => w.image).slice(0, 12)
      result.push({
        id: `place-${placeId}`,
        lat: place.latitude,
        lng: place.longitude,
        label: place.name,
        sub: [interpolateMessage(t('map_creation_works_fmt'), { count: String(list.length) }),
          interpolateMessage(t('map_creation_pin_sub_fmt'), { precise: String(own), byPeriod: String(list.length - own) })].join(' · '),
        color: colorOf(placeId),
        count: list.length,
        radius: Math.min(28, 5 + Math.sqrt(list.length) * 0.9),
        // Ring = mostly read from the period (Marseille: 1 own place of 458); solid = mostly the works' own place.
        hollow: own * 2 < list.length,
        workThumbs: shown.map((w) => w.image as string),
        thumbIds: shown.map((w) => w.id),
        oeuvreIds: list.map((w) => w.id),
        link: {
          href: `/atelier/chronologie?place=${placeId}${span ? `&from=${monthKey(span.from)}&to=${monthKey(span.to)}` : ''}`,
          label: t('map_creation_see_in_time'),
        },
      })
    }
    // A session's GPS (field sessions since 3.1.6) for works with no place of their own: a dotted
    // suggestion at the spot, named after the nearest known place within 2 km. Shown, never written.
    const workById = new Map(works.map((w) => [w.id, w]))
    for (const s of tp.sessions) {
      if (s.lat == null || s.lon == null) continue
      const ws = s.oeuvreIds.map((id) => workById.get(id)).filter((w): w is NonNullable<typeof w> => !!w && !w.precise)
      if (!ws.length) continue
      const near = nearestPlace(s.lat, s.lon, tp.places)
      const shown = ws.filter((w) => w.image).slice(0, 6)
      result.push({
        id: `session-${s.id}`,
        lat: s.lat,
        lng: s.lon,
        label: near
          ? interpolateMessage(t('map_creation_gps_fmt'), { day: s.day, place: near.name })
          : interpolateMessage(t('map_creation_gps_none_fmt'), { day: s.day }),
        // R4: never the number alone — an untitled work reads « Sans titre · year · technique ».
        sub: ws.map((w) => `#${w.id} ${w.title?.trim() || untitledLine({ year: w.year != null ? String(w.year) : null, technique: w.technique != null ? (tM[w.technique] ?? null) : null }, t('wr_untitled'))}`).join(' · '),
        color: FIELD_PLACE_COLOR,
        count: ws.length,
        radius: 5,
        dashed: true,
        workThumbs: shown.map((w) => w.image as string),
        thumbIds: shown.map((w) => w.id),
        oeuvreIds: ws.map((w) => w.id),
      })
    }
    // Pem's route: the studios in period order.
    const route: [number, number][] = []
    for (const p of periodsInOrder) {
      const pl = tp.places.find((x) => x.id === p.default_place_id)
      if (pl?.latitude != null && pl.longitude != null) route.push([pl.latitude, pl.longitude])
    }
    return { pins: result, route, placed: precise + byPeriod, precise, byPeriod, none, total: works.length, periods: periodsInOrder }
  }, [tp, periodFilter, span, t, tM])

  const shownPins = mode === 'creation' ? (creation?.pins ?? []) : pins

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        padding: '10px 28px', borderBottom: '1px solid var(--bd)',
        background: 'var(--bg1)', flexShrink: 0,
      }}>
        <div className="t-label">{t('map_view_label')}</div>
        {(['contacts', 'works', 'creation'] as Mode[]).map(m => (
          <button key={m} className="btn ghost sm" onClick={() => setMode(m)}
            style={{ opacity: mode === m ? 1 : 0.45, fontWeight: mode === m ? 700 : 400 }}
          >
            {m === 'contacts'
              ? interpolateMessage(t('map_mode_contacts_fmt'), { count: String(addrCount) })
              : m === 'works'
                ? interpolateMessage(t('map_mode_works_fmt'), { count: String(worksWithLoc) })
                : interpolateMessage(t('map_mode_creation_fmt'), { count: String(tp?.works.length ?? '…') })}
          </button>
        ))}
        {mode === 'works' && (
          <span className="t-mono-sm" style={{ color: 'var(--tx3)', fontSize: 9 }}>
            {t('map_works_marker_hint')}
          </span>
        )}
        {mode === 'creation' && (
          <span className="t-mono-sm" data-testid="map-creation-summary" style={{ color: 'var(--tx3)', fontSize: 9 }}>
            {creation
              ? interpolateMessage(t('map_creation_summary_fmt'), {
                  placed: String(creation.placed),
                  precise: String(creation.precise),
                  byPeriod: String(creation.byPeriod),
                  none: String(creation.none),
                })
              : tpError
                ? t('map_creation_error')
                : t('map_creation_loading')}
          </span>
        )}
        {loading && (
          <div className="t-mono-sm" style={{ color: 'var(--tx3)' }}>
            {pins.length > 1
              ? interpolateMessage(t('map_geocoding_plural_fmt'), { count: String(pins.length) })
              : interpolateMessage(t('map_geocoding_fmt'), { count: String(pins.length) })}
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
            {t('map_refresh')}
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
            {t('map_clear_filters')}
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
                  <div className="t-label">{t('map_country_label')}</div>
                  <select
                    className="btn ghost sm"
                    style={{ fontSize: 10, maxWidth: 200, padding: '4px 8px' }}
                    value={countryFilter}
                    onChange={(e) => setCountryFilter(e.target.value)}
                  >
                    <option value="">{t('map_all_countries')}</option>
                    {paysOptions.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </>
              )}
              {rolesInData.length > 0 && (
                <>
                  {chipGroupLabel(t('map_roles_label'), setHiddenRoles, rolesInData)}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    {rolesInData.map((role) => {
                      const hidden = hiddenRoles.has(role)
                      const dot = role === SANS_ROLE ? '#888' : roleColor(role)
                      return (
                        <button
                          key={role}
                          type="button"
                          className="btn ghost sm"
                          style={{
                            opacity: hidden ? 0.35 : 1,
                            fontSize: 10,
                            borderLeft: `3px solid ${dot}`,
                            paddingLeft: 8,
                          }}
                          {...chipHandlers(setHiddenRoles, rolesInData, role)}
                        >
                          {role === SANS_ROLE ? t('map_no_role') : role}
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
            </>
          )}
          {mode === 'creation' && creation && (
            <>
              <div className="t-label">{t('map_creation_period_label')}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn ghost sm"
                  style={{ fontSize: 10, opacity: periodFilter == null ? 1 : 0.45, fontWeight: periodFilter == null ? 700 : 400 }}
                  onClick={() => setPeriodFilter(null)}
                >
                  {t('map_creation_all_periods')}
                </button>
                {creation.periods.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="btn ghost sm"
                    style={{ fontSize: 10, opacity: periodFilter === p.id ? 1 : 0.45, fontWeight: periodFilter === p.id ? 700 : 400 }}
                    onClick={() => setPeriodFilter((cur) => (cur === p.id ? null : p.id))}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
              {span ? (
                <button type="button" className="btn ghost sm" data-testid="map-creation-span" style={{ fontSize: 10, borderColor: 'var(--ac)' }} onClick={() => setSpan(null)}>
                  {interpolateMessage(t('map_creation_span_fmt'), { from: monthKey(span.from), to: monthKey(span.to) })} ✕
                </button>
              ) : null}
              <span className="t-mono-sm" style={{ color: 'var(--tx3)', fontSize: 9 }}>{t('map_creation_hint')}</span>
            </>
          )}
          {mode === 'works' && (
            <>
              {(statusIdsInData.length > 0 || hasWorksSansStatus) && (
              <>
              {chipGroupLabel(t('map_status_label'), setHiddenStatusIds, allStatusKeys)}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                {statusIdsInData.map((id) => (
                  <button
                    key={id}
                    type="button"
                    className="btn ghost sm"
                    style={{ fontSize: 10, opacity: hiddenStatusIds.has(id) ? 0.35 : 1 }}
                    {...chipHandlers(setHiddenStatusIds, allStatusKeys, id)}
                  >
                    {statusLabelMap[id] ?? `#${id}`}
                  </button>
                ))}
                {hasWorksSansStatus && (
                  <button
                    type="button"
                    className="btn ghost sm"
                    style={{ fontSize: 10, opacity: hiddenStatusIds.has(-1) ? 0.35 : 1 }}
                    {...chipHandlers(setHiddenStatusIds, allStatusKeys, -1)}
                  >
                    {t('map_no_status')}
                  </button>
                )}
              </div>
              </>
              )}
              {oeuvreThemeMap.size > 0 && (themeIdsInData.length > 0 || hasWorksSansTheme) && (
                <>
                  {chipGroupLabel(t('map_theme_label'), setHiddenThemeIds, allThemeKeys)}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    {themeIdsInData.map((id) => (
                      <button
                        key={id}
                        type="button"
                        className="btn ghost sm"
                        style={{ fontSize: 10, opacity: hiddenThemeIds.has(id) ? 0.35 : 1 }}
                        {...chipHandlers(setHiddenThemeIds, allThemeKeys, id)}
                      >
                        {thM[id] ?? `#${id}`}
                      </button>
                    ))}
                    {hasWorksSansTheme && (
                      <button
                        type="button"
                        className="btn ghost sm"
                        style={{ fontSize: 10, opacity: hiddenThemeIds.has(-1) ? 0.35 : 1 }}
                        {...chipHandlers(setHiddenThemeIds, allThemeKeys, -1)}
                      >
                        {t('map_no_theme')}
                      </button>
                    )}
                  </div>
                </>
              )}
              {(techniqueIdsInData.length > 0 || hasWorksSansTechnique) && (
              <>
              {chipGroupLabel(t('map_technique_label'), setHiddenTechniqueIds, allTechniqueKeys)}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                {techniqueIdsInData.map((id) => (
                  <button
                    key={id}
                    type="button"
                    className="btn ghost sm"
                    style={{ fontSize: 10, opacity: hiddenTechniqueIds.has(id) ? 0.35 : 1 }}
                    {...chipHandlers(setHiddenTechniqueIds, allTechniqueKeys, id)}
                  >
                    {tM[id] ?? `#${id}`}
                  </button>
                ))}
                {hasWorksSansTechnique && (
                  <button
                    type="button"
                    className="btn ghost sm"
                    style={{ fontSize: 10, opacity: hiddenTechniqueIds.has(-1) ? 0.35 : 1 }}
                    {...chipHandlers(setHiddenTechniqueIds, allTechniqueKeys, -1)}
                  >
                    {t('map_no_technique')}
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
        {mode === 'creation' && !creation && (
          <div
            data-testid="map-creation-loading"
            role="status"
            style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 500 }}
          >
            <div className="t-mono-sm" style={{ color: tpError ? 'var(--rust)' : 'var(--tx2)', background: 'var(--bg1)', border: '1px solid var(--bd)', borderRadius: 6, padding: '8px 12px' }}>
              {tpError ? t('map_creation_error') : t('map_creation_loading')}
            </div>
          </div>
        )}
        {shownPins.length === 0 && !loading && dataReady && mode !== 'creation' && (
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
          pins={shownPins}
          route={mode === 'creation' ? creation?.route : undefined}
          mapKey={mode}
          onOpenContact={onOpenContact}
          onOpenOeuvreById={onOpenOeuvreById}
        />
      </div>
    </div>
  )
}
