'use client'

import { useEffect, useRef } from 'react'
import type { Pin } from './WorldMapTab'
import { thumbUrl, imageUrl } from '@/lib/data'

interface Props {
  pins:           Pin[]
  mapKey:         string
  onOpenContact?: (id: number) => void
}

export function WorldMapInner({ pins, mapKey, onOpenContact }: Props) {
  const divRef   = useRef<HTMLDivElement>(null)
  const mapRef   = useRef<any>(null)
  const layerRef = useRef<any>(null)

  // Expose callback to window so Leaflet popup onclick can call it
  useEffect(() => {
    ;(window as any).__pemOpenContact = onOpenContact ?? null
    // Fallback for broken thumbnails in Leaflet popups
    ;(window as any).__pemHandleThumbError = (el: HTMLImageElement, path: string) => {
      const full = imageUrl(path)
      if (full && el.src !== full) el.src = full
    }
    return () => { 
      ;(window as any).__pemOpenContact = null
      ;(window as any).__pemHandleThumbError = null
    }
  }, [onOpenContact])

  // ── Leaflet CSS ──────────────────────────────────────────────────────
  useEffect(() => {
    const id = 'leaflet-css'
    if (!document.getElementById(id)) {
      const lnk = document.createElement('link')
      lnk.id = id; lnk.rel = 'stylesheet'
      lnk.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(lnk)
    }
  }, [])

  // ── Init map ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!divRef.current) return

    async function init() {
      const L = await import('leaflet')
      const el = divRef.current as any
      if (el._leaflet_id) { mapRef.current?.remove(); mapRef.current = null; delete el._leaflet_id }
      if (!divRef.current) return

      const map = L.map(divRef.current, { center: [20, 10], zoom: 2, minZoom: 1, scrollWheelZoom: true })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        className: 'pem-tile',
      }).addTo(map)

      if (!document.getElementById('pem-leaflet-style')) {
        const s = document.createElement('style')
        s.id = 'pem-leaflet-style'
        s.textContent = `
          .pem-tile { filter: invert(1) hue-rotate(180deg) brightness(0.85) contrast(0.9); }
          .leaflet-container { background: #0d0d0d !important; }
          .leaflet-popup-content-wrapper {
            background: #111; border: 1px solid #333; border-radius: 0;
            box-shadow: none; color: #ccc; font-family: monospace;
            min-width: 160px; max-width: 290px;
          }
          .leaflet-popup-content { margin: 10px 12px; }
          .leaflet-popup-tip { background: #333; }
          .leaflet-popup-close-button { color: #666 !important; }
          .pem-popup-works { margin-top: 8px; padding-top: 7px; border-top: 1px solid #2a2a2a; }
          .pem-popup-work  { font-size: 10px; opacity: 0.75; white-space: nowrap; overflow: hidden;
                             text-overflow: ellipsis; line-height: 1.65; }
          .pem-popup-more  { font-size: 9px; opacity: 0.38; margin-top: 2px; }
          .pem-popup-link  {
            display: inline-block; margin-top: 10px; padding: 5px 10px;
            border: 1px solid #444; color: #c8a86e; font-size: 9px;
            letter-spacing: 1px; text-transform: uppercase; cursor: pointer;
            background: none; font-family: monospace; text-decoration: none;
          }
          .pem-popup-link:hover { border-color: #c8a86e; background: rgba(200,168,110,0.08); }
        `
        document.head.appendChild(s)
      }

      mapRef.current   = map
      layerRef.current = L.layerGroup().addTo(map)
    }

    init()
    return () => { mapRef.current?.remove(); mapRef.current = null; layerRef.current = null }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapKey])

  // ── Update markers ────────────────────────────────────────────────────
  useEffect(() => {
    const map   = mapRef.current
    const layer = layerRef.current
    if (!map || !layer) return
    let cancelled = false

    import('leaflet').then((L) => {
      // Abort if this effect fired again or the map was re-created since
      if (cancelled || mapRef.current !== map || layerRef.current !== layer) return
      layer.clearLayers()
      if (pins.length === 0) return
      const latlngs: [number, number][] = []

      // Build thumb URL using canonical helper
      const mkThumb = (path: string) => thumbUrl(path, 64) ?? ''

      pins.forEach((pin) => {
        const isWork = pin.id.startsWith('work-')
        const radius = isWork ? 5 : Math.max(6, Math.min(20, 6 + pin.count * 2))

        // Work thumbnails strip
        const thumbsHtml = pin.workThumbs && pin.workThumbs.length > 0
          ? `<div style="display:flex;gap:3px;margin-top:6px;flex-wrap:wrap">
               ${pin.workThumbs.slice(0, 6).map((p) =>
                 `<img src="${mkThumb(p)}" width="44" height="44"
                       onerror="window.__pemHandleThumbError(this, '${p}')"
                       style="object-fit:cover;border:1px solid #2a2a2a;flex-shrink:0;display:block" />`
               ).join('')}
             </div>`
          : ''

        // Work titles list (only shown if no thumbs)
        const worksHtml = !thumbsHtml && pin.works && pin.works.length > 0
          ? `<div class="pem-popup-works">
               <div style="font-size:9px;letter-spacing:1px;opacity:0.35;margin-bottom:3px">WORKS</div>
               ${pin.works.slice(0, 6).map((t) =>
                 `<div class="pem-popup-work">· ${t.replace(/</g, '&lt;')}</div>`
               ).join('')}
               ${pin.works.length > 6 ? `<div class="pem-popup-more">+${pin.works.length - 6} more</div>` : ''}
             </div>`
          : ''

        // Multi-contact list with individual "→" links
        const contactsHtml = pin.contacts && pin.contacts.length > 1
          ? `<div class="pem-popup-works">
               <div style="font-size:9px;letter-spacing:1px;opacity:0.35;margin-bottom:4px">CONTACTS</div>
               ${pin.contacts.slice(0, 8).map((c) =>
                 `<div style="display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:3px">
                    <span style="font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;opacity:0.8">${c.name.replace(/</g, '&lt;')}</span>
                    <a class="pem-popup-link" style="margin-top:0;padding:2px 7px;font-size:8px;flex-shrink:0"
                       href="#" onclick="event.preventDefault();var fn=window.__pemOpenContact;if(fn)fn(${c.id});">→</a>
                  </div>`
               ).join('')}
               ${pin.contacts.length > 8 ? `<div class="pem-popup-more">+${pin.contacts.length - 8} more</div>` : ''}
             </div>`
          : ''

        // Single-contact "View card →" button (only when not showing multi-contact list)
        const cardLink = pin.contactId != null && !contactsHtml
          ? `<a class="pem-popup-link"
               href="#"
               onclick="event.preventDefault(); var fn=window.__pemOpenContact; if(fn) fn(${pin.contactId});">
               View card →
             </a>`
          : ''

        const circle = L.circleMarker([pin.lat, pin.lng], {
          radius,
          fillColor:   pin.color,
          color:       isWork ? '#c8a86e' : pin.color,
          fillOpacity: isWork ? 0.6 : 0.85,
          weight:      isWork ? 1 : 1.5,
          dashArray:   isWork ? '3,3' : undefined,
        })

        circle.bindPopup(`
          <div style="line-height:1.5">
            <div style="font-weight:700;font-size:11px;margin-bottom:2px">${pin.label.replace(/</g, '&lt;')}</div>
            <div style="font-size:10px;opacity:0.55">${pin.sub.replace(/</g, '&lt;')}</div>
            ${pin.count > 1 ? `<div style="margin-top:4px;font-size:9px;opacity:0.35">${pin.count} entries</div>` : ''}
            ${thumbsHtml}
            ${worksHtml}
            ${contactsHtml}
            ${cardLink}
          </div>
        `, { maxWidth: 280 })

        layer.addLayer(circle)
        latlngs.push([pin.lat, pin.lng])
      })

      const safeFit = () => {
        const m = mapRef.current
        if (cancelled || !m || m !== map || layerRef.current !== layer) return
        const el = m.getContainer?.()
        if (!el?.isConnected) return
        try {
          if (latlngs.length === 1) {
            m.setView(latlngs[0], 6)
            return
          }
          if (latlngs.length > 1) {
            const b = L.latLngBounds(latlngs)
            if (b.isValid()) m.fitBounds(b, { padding: [60, 60], maxZoom: 5 })
          }
        } catch {
          /* map torn down mid-zoom */
        }
      }

      map.whenReady(() => {
        requestAnimationFrame(safeFit)
      })
    })

    return () => { cancelled = true }
  }, [pins])

  return <div ref={divRef} style={{ width: '100%', height: '100%', background: '#0d0d0d' }} />
}
