'use client'

// WorldMapTab — contacts + works on an interactive Leaflet map.
// Fetches contact_addresses (multiple per contact) and Contact.Ville/Pays as fallback.
// Both fetches run in parallel; pin building only starts when BOTH complete.

import { useState, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import type { Oeuvre } from '@/lib/types/database'

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
  contacts:       ContactRow[]
  oeuvres:        Oeuvre[]
  tM:             Record<number, string>
  statusLabelMap: Record<number, string>
  onOpenContact?: (id: number) => void
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

// ── Geocode cache — module-level (survives tab switches) + sessionStorage (survives page reload) ─
const GEO_STORAGE_KEY = 'pem_geo_cache'
const geoCache = new Map<string, [number, number] | null>()

// Hydrate from sessionStorage on module load — skip null entries (stale failures)
try {
  const stored = sessionStorage.getItem(GEO_STORAGE_KEY)
  if (stored) {
    const parsed = JSON.parse(stored) as Record<string, [number, number] | null>
    Object.entries(parsed).forEach(([k, v]) => { if (v !== null) geoCache.set(k, v) })
  }
} catch { /* SSR or private browsing */ }

function persistGeoCache() {
  try {
    const obj: Record<string, [number, number] | null> = {}
    geoCache.forEach((v, k) => { obj[k] = v })
    sessionStorage.setItem(GEO_STORAGE_KEY, JSON.stringify(obj))
  } catch { /* quota or SSR */ }
}

async function geocode(city: string, country: string): Promise<[number, number] | null> {
  const key = `${city}|${country}`.toLowerCase().trim()
  if (!key || key === '|') return null
  if (geoCache.has(key)) return geoCache.get(key)!
  try {
    const q   = [city, country].filter(Boolean).join(', ')
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`,
      { headers: { 'User-Agent': 'pem-artdb/1.0' } },
    )
    const data = await res.json()
    if (data?.[0]) {
      const coords: [number, number] = [parseFloat(data[0].lat), parseFloat(data[0].lon)]
      geoCache.set(key, coords)
      persistGeoCache()
      return coords
    }
  } catch { /* network */ }
  // Do NOT cache null — transient failures (rate limit, network) would permanently block geocoding.
  // A failed location simply skips; it will be retried on next render.
  return null
}

// ── Leaflet dynamic import ─────────────────────────────────────────────
interface MapProps { pins: Pin[]; mapKey: string; onOpenContact?: (id: number) => void }
const LeafletMap = dynamic<MapProps>(
  () => import('./WorldMapInner').then(m => m.WorldMapInner),
  { ssr: false, loading: () => <div style={{ flex: 1, background: '#0d0d0d' }} /> },
)

type Mode = 'contacts' | 'works'

// ── Component ──────────────────────────────────────────────────────────
export function WorldMapTab({ contacts, oeuvres, onOpenContact }: Props) {
  const [mode,      setMode]      = useState<Mode>('contacts')
  const [pins,      setPins]      = useState<Pin[]>([])
  const [loading,   setLoading]   = useState(false)
  const [dataReady, setDataReady] = useState(false)
  const [addresses, setAddresses] = useState<ContactAddress[]>([])
  const abortRef = useRef(false)

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

  // Build pins once data FIS ready, or when mode changes
  useEffect(() => {
    if (!dataReady) return
    abortRef.current = false
    setLoading(true)
    setPins([])
    if (mode === 'contacts') void buildContactPins()
    else void buildWorkPins()
    return () => { abortRef.current = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataReady, mode])

  async function buildContactPins() {
    const result: Pin[] = []
    const contactMap = new Map<number, ContactRow>()
    contacts.forEach(c => contactMap.set(c.ContactID, c))

    // Build location entries: prefer contact_addresses, fallback to Contact.Ville/Pays
    interface LocEntry { contact_id: number; ville: string; pays: string; label: string | null }
    const locEntries: LocEntry[] = []

    if (addresses.length > 0) {
      addresses.forEach(a => {
        if (a.ville || a.pays) {
          locEntries.push({ contact_id: a.contact_id, ville: a.ville ?? '', pays: a.pays ?? '', label: a.label })
        }
      })
      // Also include contacts with Ville/Pays that have NO entry in contact_addresses
      const coveredIds = new Set(addresses.map(a => a.contact_id))
      contacts.forEach(c => {
        if (!coveredIds.has(c.ContactID) && (c.Ville || c.Pays)) {
          locEntries.push({ contact_id: c.ContactID, ville: c.Ville ?? '', pays: c.Pays ?? '', label: null })
        }
      })
    } else {
      // No contact_addresses at all — fall back to Contact.Ville/Pays
      contacts.forEach(c => {
        if (c.Ville || c.Pays) {
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
      const assoc    = oeuvres.filter(o =>
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

    oeuvres.forEach(o => {
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
      result.push({ id: key, lat, lng, label, sub: meta.label, color: '#c0a060', count: group.length, workThumbs })
      if (!abortRef.current) setPins([...result])
    }
    if (!abortRef.current) setLoading(false)
  }

  const addrCount = addresses.length > 0
    ? addresses.length
    : contacts.filter(c => c.Ville || c.Pays).length
  const worksWithLoc = oeuvres.length  // all works now shown (fallback to contact location)

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
        {loading && (
          <div className="t-mono-sm" style={{ color: 'var(--tx3)' }}>
            Géocodage… {pins.length} point{pins.length > 1 ? 's' : ''}
          </div>
        )}
        {!loading && !dataReady && (
          <div className="t-mono-sm" style={{ color: 'var(--tx3)' }}>Chargement…</div>
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
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {Object.entries(ROLE_COLORS)
            .filter(([r]) => contacts.some(c => c.Role === r))
            .map(([role, color]) => (
              <div key={role} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
                <span className="t-mono-sm" style={{ color: 'var(--tx3)', fontSize: 9 }}>{role}</span>
              </div>
            ))}
        </div>
      </div>

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
        <LeafletMap pins={pins} mapKey={mode} onOpenContact={onOpenContact} />
      </div>
    </div>
  )
}
