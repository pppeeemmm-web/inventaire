'use client'

// The phone menu (docs/design/2026-11-18/PhoneNav.notes.md, option A — Pem's answers 2026-11-18):
// one sheet, the same on every phone screen, over the page. Top: « #numéro ou titre » → the work card.
// Then 9 tiles with their counts (grey at 0; counts stream in after the sheet opens). Then « Tout le
// reste » and « Actions » (the old Bureau), both folded. The account sits at the bottom.
// Its own chunk (PhoneMenu.tsx loads it): nothing here weighs on the first screen of /hub.
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode, type TouchEvent } from 'react'
import { useI18n } from '@/lib/i18n/context'
import type { DictKey } from '@/lib/i18n/dictionary'
import { thumbUrl } from '@/lib/data'
import { PemModalOverlay } from '@/components/shared/PemModalOverlay'
import { AccountActions } from '@/components/shared/AccountActions'
import type { PhoneNavigate } from '@/components/shared/PhoneMenu'
import { getPhoneMenuData, getPhoneMenuFilCount, searchMenuWorks, type MenuWork, type PhoneMenuData } from '@/app/hub/menu-actions'

/** Counts survive closing and reopening the sheet on the same page for a minute. */
let cache: { data: PhoneMenuData; fil: number | null; at: number } | null = null
const CACHE_MS = 60_000

const workHref = (id: number) => `/atelier/inventory?work=${id}`

type Tile = { key: string; icon: string; label: DictKey; href: string; sub: (d: PhoneMenuData | null, fil: number | null) => { text: string; n: number | null } }

/** « Tout le reste »: today's menu groups minus the tiles (Pem 2026-11-18, answer 3). */
const REST: Array<{ label: DictKey; items: Array<{ label: DictKey; href: string; admin?: boolean }> }> = [
  { label: 'tab_kaizen', items: [{ label: 'tab_audit', href: '/atelier/audit', admin: true }, { label: 'kaizen_group_ops', href: '/atelier/kaizen-ops' }, { label: 'aide_tab', href: '/atelier/aide' }] },
  { label: 'nav_group_studio', items: [{ label: 'overview', href: '/atelier/overview' }, { label: 'pipeline', href: '/atelier/pipeline' }, { label: 'tab_stock', href: '/atelier/stock' }] },
  {
    label: 'nav_group_catalogue',
    items: [
      { label: 'tab_reports', href: '/atelier/reports' },
      { label: 'themes', href: '/atelier/themes' },
      { label: 'constellation', href: '/atelier/constellation' },
      { label: 'ss_tab', href: '/atelier/slideshows' },
    ],
  },
  {
    label: 'nav_group_business',
    items: [
      { label: 'contacts', href: '/atelier/contacts' },
      { label: 'map', href: '/atelier/map' },
      { label: 'fiscal', href: '/atelier/fiscal' },
      { label: 'vault', href: '/atelier/vault' },
    ],
  },
  {
    label: 'nav_group_public_tab',
    items: [
      { label: 'portfolio_subtab_website', href: '/atelier/site' },
      { label: 'portfolio_subtab_portfolio', href: '/atelier/portfolio' },
      { label: 'portfolio_subtab_analytics', href: '/atelier/analytics' },
      { label: 'tab_broadcast', href: '/atelier/broadcast', admin: true },
    ],
  },
]

/** The old Bureau rows of Aujourd'hui (they are navigation, not the day). */
const ACTIONS: Array<{ testId: string; emoji: string; label: DictKey; href: string }> = [
  { testId: 'hub-field-verb-sale', emoji: '💳', label: 'hub_field_sale', href: '/atelier/sale/new' },
  { testId: 'hub-field-verb-contact', emoji: '👤', label: 'hub_field_contact', href: '/atelier/capture?mode=card' },
  { testId: 'hub-field-verb-document', emoji: '✍️', label: 'hub_field_document', href: '/atelier/documents/new' },
  { testId: 'hub-field-verb-issue', emoji: '⚠️', label: 'hub_field_issue', href: '/atelier/issue/new' },
  { testId: 'hub-field-verb-pipeline', emoji: '📅', label: 'hub_field_pipeline', href: '/atelier/pipeline' },
  { testId: 'hub-field-verb-triage', emoji: '📣', label: 'hub_field_triage', href: '/atelier/triage' },
]

const summary: CSSProperties = { minHeight: 44, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '0 16px', fontSize: 14, color: 'var(--tx2)' }
const row: CSSProperties = { minHeight: 44, display: 'flex', alignItems: 'center', gap: 12, color: 'var(--tx)', textDecoration: 'none', fontSize: 15 }

export function PhoneMenuSheet({ onClose, onNavigate }: { onClose: () => void; onNavigate?: PhoneNavigate }) {
  const { t, lang, setLang } = useI18n()
  const pathname = usePathname() || ''
  const router = useRouter()
  const fresh = cache && Date.now() - cache.at < CACHE_MS ? cache : null
  const [data, setData] = useState<PhoneMenuData | null>(fresh?.data ?? null)
  const [fil, setFil] = useState<number | null>(fresh?.fil ?? null)
  const [failed, setFailed] = useState(false)
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<MenuWork[] | 'busy' | null>(null)
  const dragY = useRef<number | null>(null)
  const [drag, setDrag] = useState(0)

  useEffect(() => {
    if (fresh) return
    let live = true
    void getPhoneMenuData()
      .then((res) => {
        if (!live) return
        if ('error' in res) {
          setFailed(true)
          return
        }
        setData(res)
        cache = { data: res, fil: null, at: Date.now() }
        if (!res.isAdmin) return
        void getPhoneMenuFilCount().then((n) => {
          if (!live) return
          setFil(n)
          if (cache) cache = { ...cache, fil: n }
        })
      })
      .catch(() => live && setFailed(true))
    return () => {
      live = false
    }
    // Once per opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Search as you type (a short pause first); a number alone also opens on Enter.
  useEffect(() => {
    const term = q.trim()
    if (!term || term === '#') {
      setHits(null)
      return
    }
    setHits('busy')
    let live = true
    const id = window.setTimeout(() => {
      void searchMenuWorks(term)
        .then((r) => live && setHits(r))
        .catch(() => live && setHits([]))
    }, 250)
    return () => {
      live = false
      window.clearTimeout(id)
    }
  }, [q])

  function go(href: string, e?: MouseEvent) {
    if (onNavigate) {
      e?.preventDefault()
      onClose()
      onNavigate(href)
      return
    }
    onClose()
  }

  const link = (href: string, children: ReactNode, style: CSSProperties, testId?: string) => (
    <Link key={href} href={href} onClick={(e) => go(href, e)} data-testid={testId} style={style}>
      {children}
    </Link>
  )

  const n = (x: number | undefined | null) => (x == null ? null : x)
  const today = new Date().toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB', { weekday: 'short', day: 'numeric', timeZone: 'Europe/Paris' })
  const isAdmin = data?.isAdmin ?? false
  const TILES: Tile[] = [
    { key: 'today', icon: '☀️', label: 'today_nav_today', href: '/hub', sub: () => ({ text: today, n: null }) },
    { key: 'works', icon: '🖼️', label: 'pn_tile_works', href: '/atelier/inventory', sub: (d) => ({ text: d ? String(d.works) : '', n: n(d?.works) }) },
    { key: 'production', icon: '🛠️', label: 'pn_tile_production', href: '/atelier/production', sub: (d) => ({ text: d ? t('pn_sub_under_way').replace('{n}', String(d.production)) : '', n: n(d?.production) }) },
    {
      key: 'ideas', icon: '💡', label: 'today_nav_ideas', href: '/atelier/concepts',
      sub: (d) => ({ text: d ? (d.ripe ? `${d.ideas} · ${t('pn_sub_ripe').replace('{n}', String(d.ripe))}` : String(d.ideas)) : '', n: n(d?.ideas) }),
    },
    ...(isAdmin
      ? [{ key: 'fil', icon: '🧵', label: 'pn_tile_fil' as DictKey, href: '/hub/fil', sub: (_d: PhoneMenuData | null, f: number | null) => ({ text: f == null ? '' : t('pn_sub_to_sort').replace('{n}', String(f)), n: f }) }]
      : []),
    { key: 'orders', icon: '📦', label: 'pn_tile_orders', href: '/atelier/sales', sub: (d) => ({ text: d ? t('pn_sub_under_way').replace('{n}', String(d.orders)) : '', n: n(d?.orders) }) },
    { key: 'logistics', icon: '🚚', label: 'pn_tile_logistics', href: '/atelier/logistics', sub: (d) => ({ text: d ? t('pn_sub_shipments').replace('{n}', String(d.logistics)) : '', n: n(d?.logistics) }) },
    { key: 'events', icon: '🏛️', label: 'pn_tile_events', href: '/atelier/exhibitions', sub: (d) => ({ text: d ? t('pn_sub_events').replace('{n}', String(d.events)) : '', n: n(d?.events) }) },
    { key: 'journal', icon: '📅', label: 'pn_tile_journal', href: '/atelier/journal', sub: () => ({ text: t('pn_sub_days'), n: null }) },
  ]
  const here = (href: string) => (href === '/hub' ? pathname === '/hub' || pathname === '/hub/today' : pathname.startsWith(href))

  const onTouchStart = (e: TouchEvent) => {
    dragY.current = e.touches[0]?.clientY ?? null
  }
  const onTouchMove = (e: TouchEvent) => {
    if (dragY.current == null) return
    setDrag(Math.max(0, (e.touches[0]?.clientY ?? dragY.current) - dragY.current))
  }
  const onTouchEnd = () => {
    dragY.current = null
    if (drag > 80) onClose()
    else setDrag(0)
  }

  const term = q.trim().replace(/^#/, '')
  const submit = () => {
    if (!/^\d+$/.test(term)) return
    const href = workHref(Number(term))
    onClose()
    if (onNavigate) onNavigate(href)
    else router.push(href)
  }

  return (
    <PemModalOverlay
      onClose={onClose}
      panelStyle={{
        alignSelf: 'flex-end', width: '100%', maxWidth: 560, maxHeight: 'calc(100dvh - 46px)', overflowY: 'auto', overflowX: 'hidden',
        background: 'var(--bg0)', borderRadius: '16px 16px 0 0', border: 0,
        paddingBottom: 'max(16px, env(safe-area-inset-bottom, 0px))',
        transform: drag ? `translateY(${drag}px)` : undefined, transition: drag ? 'none' : 'transform 160ms ease-out',
      }}
    >
      <div data-testid="phone-menu-sheet">
        <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} style={{ position: 'sticky', top: 0, background: 'var(--bg0)', zIndex: 1, paddingTop: 6 }}>
          <div aria-hidden="true" style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--bd3, var(--bd2))', margin: '0 auto 4px' }} />
          <div style={{ display: 'flex', alignItems: 'center', padding: '0 4px 6px 16px' }}>
            <h2 style={{ fontSize: 16, margin: 0, flex: 1 }}>{t('pn_menu_title')}</h2>
            <button type="button" onClick={onClose} aria-label={t('pn_close')} data-testid="phone-menu-close" style={{ minWidth: 44, minHeight: 44, background: 'none', border: 0, fontSize: 18, color: 'var(--tx2)', cursor: 'pointer' }}>
              ✕
            </button>
          </div>
        </div>

        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
          style={{ margin: '0 16px 10px' }}
        >
          <input
            type="search"
            inputMode="search"
            enterKeyHint="go"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('pn_search_placeholder')}
            aria-label={t('pn_search_aria')}
            data-testid="phone-menu-search"
            style={{ width: '100%', boxSizing: 'border-box', minHeight: 44, padding: '0 12px', fontSize: 16, border: '1px solid var(--bd2)', borderRadius: 8, background: 'var(--bg1)', color: 'var(--tx)' }}
          />
          {hits === 'busy' ? (
            <p style={{ fontSize: 13, color: 'var(--tx3)', margin: '8px 2px 0' }}>{t('pn_search_busy')}</p>
          ) : hits ? (
            hits.length ? (
              <div data-testid="phone-menu-hits" style={{ display: 'grid', marginTop: 6 }}>
                {hits.map((w) => {
                  const src = thumbUrl(w.thumb)
                  return link(
                    workHref(w.id),
                    <>
                      {src ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={src} alt="" width={40} height={40} loading="lazy" style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover', flex: 'none' }} />
                      ) : (
                        <span style={{ width: 40, height: 40, borderRadius: 6, background: 'var(--bg2)', flex: 'none' }} />
                      )}
                      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 14 }}>
                        <span style={{ color: 'var(--tx3)' }}>#{w.id} </span>
                        {w.title || t('wr_untitled')}
                      </span>
                    </>,
                    { ...row, minHeight: 48, borderBottom: '1px solid var(--bd)' },
                    `phone-menu-hit-${w.id}`,
                  )
                })}
              </div>
            ) : (
              <p style={{ fontSize: 13, color: 'var(--tx3)', margin: '8px 2px 0' }}>{t('pn_search_none')}</p>
            )
          ) : null}
        </form>

        <nav data-testid="phone-menu-tiles" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 4, padding: '0 8px 10px' }}>
          {TILES.map((tile) => {
            const s = tile.sub(data, fil)
            const on = here(tile.href)
            return link(
              tile.href,
              <>
                <span style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
                  <span aria-hidden="true" style={{ fontSize: 14 }}>{tile.icon}</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t(tile.label)}</span>
                </span>
                <span style={{ fontSize: 12, color: s.n === 0 ? 'var(--tx3)' : 'var(--tx2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minHeight: 15 }}>{s.text}</span>
              </>,
              {
                minHeight: 66, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 4,
                padding: '8px 6px', borderRadius: 8, textDecoration: 'none', color: 'var(--tx)',
                border: `1px solid ${on ? 'var(--ac)' : 'var(--bd)'}`,
                background: on ? 'color-mix(in srgb, var(--ac) 8%, var(--bg1))' : 'var(--bg1)',
              },
              `phone-menu-tile-${tile.key}`,
            )
          })}
        </nav>
        {failed ? <p style={{ fontSize: 12, color: 'var(--tx3)', margin: '0 16px 8px' }}>{t('today_load_error')}</p> : null}

        <details className="pem-fold" data-testid="phone-menu-rest" style={{ borderTop: '1px solid var(--bd)' }}>
          <summary style={summary}>{t('pn_rest')}</summary>
          <div style={{ padding: '0 16px 8px', display: 'grid', gap: 8 }}>
            {REST.map((g) => (
              <div key={g.label}>
                <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--tx3)', margin: '4px 0 2px' }}>{t(g.label)}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', columnGap: 12 }}>
                  {g.items
                    .filter((i) => !i.admin || isAdmin)
                    .map((i) => (
                      <span key={i.href} style={{ minWidth: 0 }}>
                        {link(i.href, <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t(i.label)}</span>, { ...row, fontSize: 14, color: here(i.href) ? 'var(--ac)' : 'var(--tx)' })}
                      </span>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </details>

        <details className="pem-fold" data-testid="phone-menu-actions" style={{ borderTop: '1px solid var(--bd)' }}>
          <summary style={summary}>
            {t('pn_actions')}
            <span style={{ fontSize: 11, color: 'var(--tx3)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t('pn_actions_sub')}</span>
          </summary>
          <div style={{ padding: '0 16px 8px' }}>
            {ACTIONS.map((a) =>
              link(
                a.href,
                <>
                  <span aria-hidden="true" style={{ width: 22, textAlign: 'center' }}>{a.emoji}</span>
                  {t(a.label)}
                </>,
                { ...row, borderBottom: '1px solid var(--bd)' },
                a.testId,
              ),
            )}
          </div>
        </details>

        <div data-testid="phone-menu-account" style={{ borderTop: '1px solid var(--bd)', padding: '10px 16px 4px', display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{data?.name ?? ''}</span>
            <span role="group" aria-label={t('pn_lang')} style={{ display: 'inline-flex', border: '1px solid var(--bd2)', borderRadius: 6, overflow: 'hidden', flex: 'none' }}>
              {(['fr', 'en'] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  aria-pressed={lang === l}
                  onClick={() => setLang(l)}
                  style={{ minWidth: 44, minHeight: 44, border: 0, cursor: 'pointer', fontSize: 12, background: lang === l ? 'var(--bg2)' : 'transparent', color: lang === l ? 'var(--tx)' : 'var(--tx3)', fontWeight: lang === l ? 600 : 400 }}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </span>
          </div>
          <AccountActions compact />
        </div>
      </div>
    </PemModalOverlay>
  )
}
