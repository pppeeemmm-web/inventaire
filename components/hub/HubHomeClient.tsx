'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n/context'
import type { DictKey } from '@/lib/i18n/dictionary'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { atelierTabHref } from '@/lib/atelier/tab-routes'
import { PemThemeToggle } from '@/components/PemThemeToggle'
import { WorkThumb } from '@/components/atelier/WorkThumb'

interface SystemLogEntry {
  id: number
  action: string
  details: string | null
  type: string | null
  status: string | null
  priority: string | null
  event_type: string | null
  table_name: string | null
  row_id: string | null
  metadata: unknown
  created_at: string
  feedSource: 'audit' | 'studio'
}

interface Props {
  stats: { total: number; thisYear: number; stockAlerts: number; publicWorks: number }
  recentImages: { OeuvreID: number; txtImageNameLink: string | null }[]
  recentProcess: { id: number; label: string; status: string; created_at: string }[]
  burningIdeas:  { id: number; title: string; energy: number | null; medium: string | null }[]
  auditFeed:     SystemLogEntry[]
  taskFeed:      SystemLogEntry[]
}

function priorityColor(p: string | null | undefined) {
  if (p === 'P1') return '#e05252'
  if (p === 'P2') return '#d4843a'
  if (p === 'P4') return 'var(--tx3)'
  return 'var(--ac)'
}

const HUB_TASK_TYPE_KEYS: Partial<Record<string, DictKey>> = {
  suggestion: 'system_task_type_suggestion',
  improvement: 'system_task_type_improvement',
  maintenance: 'system_task_type_maintenance',
  backlog: 'system_task_type_backlog',
  bug: 'system_task_type_bug',
}

function logScore(l: SystemLogEntry): number {
  // Higher = more important.
  if (l.event_type === 'GATE_BYPASS') return 100
  if (l.event_type === 'VISIBILITY_GATE') return 95
  if (l.event_type === 'PAYMENT_GRAIN') return 92
  if (l.event_type === 'ORDER_CREATED') return 90
  if (l.event_type === 'STATUS_CHANGE') return 80
  if (l.event_type === 'LOCATION_MOVE') return 72
  if (l.event_type === 'PRICE_CHANGE') return 70
  if (l.type === 'bug') return 68
  if (l.type === 'maintenance') return 60
  if (l.type === 'improvement') return 55
  if (l.type === 'suggestion') return 40
  return 50
}

export function HubHomeClient({ stats, recentImages, recentProcess, burningIdeas, auditFeed, taskFeed }: Props) {
  const { lang, setLang, t } = useI18n()
  const router = useRouter()
  const hubNavCompact = useMediaQuery('(max-width: 767px)')
  const [hubMenuOpen, setHubMenuOpen] = useState(false)

  const dateLabel = new Date().toLocaleDateString(
    lang === 'fr' ? 'fr-FR' : 'en-GB',
    { weekday: 'long', day: 'numeric', month: 'long' }
  )

  const systemLogs = useMemo(() => [...auditFeed, ...taskFeed], [auditFeed, taskFeed])

  function hubLogTypeLabel(log: SystemLogEntry): string | null {
    if (!log.type) return null
    if (log.feedSource === 'studio') {
      const key = HUB_TASK_TYPE_KEYS[log.type]
      if (key) return t(key)
    }
    return log.type
  }

  const displayLogs: SystemLogEntry[] = useMemo(
    () =>
      systemLogs
        .filter((l) => l.event_type !== 'ATELIER_VIEW')
        .slice()
        .sort((a, b) => {
          const ds = logScore(b) - logScore(a)
          if (ds !== 0) return ds
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        }),
    [systemLogs]
  )

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg0)' }}>

      {/* Top bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: hubNavCompact ? '12px max(16px, env(safe-area-inset-right)) 12px max(16px, env(safe-area-inset-left))' : '16px 28px',
        borderBottom: '1px solid var(--bd)',
        minWidth: 0,
      }}>
        <div className="row gap-md" style={{ minWidth: 0, flex: 1 }}>
          <div style={{ width: 24, height: 24, flexShrink: 0, border: '1px solid var(--ac)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ac)', fontSize: 11, fontFamily: "'Instrument Serif', serif", lineHeight: 1 }}>P</div>
          <div style={{ minWidth: 0 }}>
            <div className="t-eyebrow" style={{ color: 'var(--tx)' }}>{t('hub')}</div>
            {!hubNavCompact && (
              <div className="t-mono-sm" style={{ color: 'var(--tx3)' }}>— {t('tagline')}</div>
            )}
          </div>
        </div>
        {hubNavCompact ? (
          <div className="row gap-sm" style={{ flexShrink: 0 }}>
            <div style={{ display: 'flex', border: '1px solid var(--bd)', fontSize: 10, letterSpacing: 1 }}>
              <PemThemeToggle showLabels={false} />
            </div>
            <button
              type="button"
              onClick={() => setHubMenuOpen(true)}
              aria-expanded={hubMenuOpen}
              aria-controls="hub-drawer-nav"
              style={{
                flexShrink: 0,
                padding: '8px 14px',
                fontSize: 10,
                letterSpacing: 1,
                textTransform: 'uppercase',
                color: 'var(--tx2)',
                background: 'var(--bg2)',
                border: '1px solid var(--bd)',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {t('hub_menu')}
            </button>
          </div>
        ) : (
          <div className="row gap-md" style={{ flexShrink: 0 }}>
            <div className="t-mono-sm" style={{ color: 'var(--tx3)' }}>{t('signedAs')} · {t('hub_nav_signature_suffix')}</div>
            <Link href="/Atelier_Studio_Bible.pdf" target="_blank" className="t-mono-sm" style={{ color: 'var(--tx2)', textDecoration: 'none', marginLeft: 12 }}>
              {t('hub_studio_bible')}
            </Link>
            <div className="vline" style={{ height: 12, margin: '0 12px', opacity: 0.3 }} />
            <Link href="/atelier/system" className="t-mono-sm" style={{ color: 'var(--tx2)', textDecoration: 'none' }}>
              {t('hub_suggestions')}
            </Link>
            <div className="vline" style={{ height: 12, margin: '0 12px', opacity: 0.3 }} />
            <Link href="/" className="t-mono-sm" style={{ color: 'var(--ac)', textDecoration: 'none', border: '1px solid var(--ac)', padding: '2px 8px' }}>
              {t('hub_public_site')}
            </Link>
            <div style={{ display: 'flex', border: '1px solid var(--bd)', fontSize: 10, letterSpacing: 1 }}>
              <PemThemeToggle showLabels={!hubNavCompact} />
              {(['fr', 'en'] as const).map((l) => (
                <button key={l} onClick={() => setLang(l)}
                  style={{ padding: '4px 10px', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: lang === l ? 'var(--ac)' : 'var(--tx3)', background: lang === l ? 'var(--bg2)' : 'transparent', borderRight: l === 'fr' ? '1px solid var(--bd)' : 'none' }}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {hubNavCompact && hubMenuOpen && (
        <>
          <div
            role="presentation"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 400,
              background: 'rgba(0,0,0,0.45)',
            }}
            onClick={() => setHubMenuOpen(false)}
          />
          <nav
            id="hub-drawer-nav"
            aria-label={t('hub_drawer_aria')}
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              bottom: 0,
              zIndex: 401,
              width: 'min(320px, calc(100vw - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px)))',
              paddingTop: 'max(20px, env(safe-area-inset-top, 0px))',
              paddingBottom: 'max(20px, env(safe-area-inset-bottom, 0px))',
              paddingLeft: 20,
              paddingRight: 'max(20px, env(safe-area-inset-right, 0px))',
              background: 'var(--bg1)',
              borderLeft: '1px solid var(--bd)',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              boxShadow: '-12px 0 32px rgba(0,0,0,0.35)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="t-mono-sm" style={{ color: 'var(--tx3)' }}>{t('signedAs')} · {t('hub_nav_signature_suffix')}</span>
              <button
                type="button"
                onClick={() => setHubMenuOpen(false)}
                style={{
                  padding: '6px 12px',
                  fontSize: 10,
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                  color: 'var(--tx2)',
                  background: 'transparent',
                  border: '1px solid var(--bd)',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {t('close')}
              </button>
            </div>
            <Link href="/Atelier_Studio_Bible.pdf" target="_blank" onClick={() => setHubMenuOpen(false)} className="t-mono-sm" style={{ color: 'var(--tx2)', textDecoration: 'none' }}>
              {t('hub_studio_bible')}
            </Link>
            <Link href="/atelier/system" onClick={() => setHubMenuOpen(false)} className="t-mono-sm" style={{ color: 'var(--tx2)', textDecoration: 'none' }}>
              {t('hub_drawer_alerts_link')}
              {stats.stockAlerts > 0 ? ` · ${stats.stockAlerts}` : ''}
              <span style={{ display: 'block', opacity: 0.65, fontSize: 9, marginTop: 4 }}>{t('hub_suggestions')}</span>
            </Link>
            <Link href="/" onClick={() => setHubMenuOpen(false)} className="t-mono-sm" style={{ color: 'var(--ac)', textDecoration: 'none', border: '1px solid var(--ac)', padding: '8px 12px', alignSelf: 'flex-start' }}>
              {t('hub_public_site')}
            </Link>
            <div style={{ display: 'flex', border: '1px solid var(--bd)', alignSelf: 'flex-start' }}>
              {(['fr', 'en'] as const).map((l) => (
                <button key={l} onClick={() => setLang(l)}
                  style={{ padding: '8px 14px', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: lang === l ? 'var(--ac)' : 'var(--tx3)', background: lang === l ? 'var(--bg2)' : 'transparent', borderRight: l === 'fr' ? '1px solid var(--bd)' : 'none' }}>
                  {l}
                </button>
              ))}
            </div>
          </nav>
        </>
      )}

      {/* Main Content Area */}
      <div style={{
        flex: 1,
        padding: hubNavCompact ? '18px max(16px, env(safe-area-inset-right)) 22px max(16px, env(safe-area-inset-left))' : '32px clamp(20px, 4vw, 56px)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'auto',
        gap: hubNavCompact ? 18 : 40,
        width: '100%',
        maxWidth: 1920,
        margin: '0 auto',
        boxSizing: 'border-box',
      }}>
        {hubNavCompact ? (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="serif" style={{ fontSize: 28, color: 'var(--tx)', letterSpacing: '-0.03em', lineHeight: 1.05 }}>
                {t('hub')}
              </div>
              <div className="t-eyebrow" style={{ color: 'var(--tx3)', letterSpacing: 2 }}>
                {dateLabel} · {stats.total} {t('works_cap')} · {stats.publicWorks} {t('hubWorksOnline')}
              </div>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 12,
              marginTop: 8,
            }}>
              <MobileActionTile
                dataTestId="hub-tile-atelier"
                title={t('hub_continue')}
                subtitle={t('inventory')}
                onClick={() => router.push('/atelier')}
              />
              <MobileActionTile
                dataTestId="hub-tile-new-work"
                title={t('newWork')}
                subtitle={t('hub_capture')}
                onClick={() => router.push('/atelier/works/new')}
              />
              <MobileActionTile
                dataTestId="hub-tile-pipeline"
                title={t('pipeline')}
                subtitle={t('hub_tile_pipeline_sub')}
                onClick={() => router.push('/atelier/pipeline')}
              />
              <MobileActionTile
                dataTestId="hub-tile-production"
                title={t('production')}
                subtitle={t('hub_tile_production_sub')}
                onClick={() => router.push('/atelier/production')}
              />
              <MobileActionTile
                dataTestId="hub-tile-concepts"
                title={t('concepts')}
                subtitle={t('hub_tile_concepts_sub')}
                onClick={() => router.push('/atelier/concepts')}
              />
              <MobileActionTile
                dataTestId="hub-tile-contacts"
                title={t('contacts')}
                subtitle={t('hub_tile_contacts_sub')}
                onClick={() => router.push(atelierTabHref('contacts'))}
              />
              <MobileActionTile
                dataTestId="hub-tile-scan"
                title={t('scan_page_title')}
                subtitle={t('hub_tile_scan_sub')}
                onClick={() => router.push('/atelier/scan')}
              />
            </div>

            <div style={{ marginTop: 6 }}>
              <div className="t-eyebrow" style={{ marginBottom: 10, opacity: 0.55 }}>
                {t('hub_swipe_cards')}
              </div>
              <div style={{
                display: 'flex',
                gap: 12,
                overflowX: 'auto',
                paddingBottom: 6,
                scrollSnapType: 'x mandatory',
                WebkitOverflowScrolling: 'touch',
              }}>
                <MobileSwipeCard
                  kicker={`01 · ${t('pipeline')}`}
                  onClick={() => router.push('/atelier/pipeline')}
                  items={recentProcess.slice(0, 3).map((p) => ({
                    a: p.label,
                    b: p.status,
                    c: new Date(p.created_at).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB'),
                  }))}
                  emptyLabel={t('empty')}
                />
                <MobileSwipeCard
                  kicker={`02 · ${t('concepts')}`}
                  onClick={() => router.push('/atelier/concepts')}
                  items={burningIdeas.slice(0, 3).map((i) => ({
                    a: i.title,
                    b: i.medium || t('hub_concept_fallback'),
                    c: i.energy != null ? `E${i.energy}` : '—',
                  }))}
                  emptyLabel={t('empty')}
                />
                <MobileSwipeCard
                  kicker={`03 · ${t('hub_pulse_ledger')}`}
                  onClick={() => router.push('/atelier/system')}
                  items={displayLogs.slice(0, 3).map((l) => ({
                    a: l.action,
                    b: l.priority ?? 'P3',
                    c: new Date(l.created_at).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB'),
                  }))}
                  emptyLabel={t('hub_ledger_empty')}
                />
              </div>
            </div>

            <div style={{ marginTop: 2 }}>
              <div className="t-eyebrow" style={{ marginBottom: 10, opacity: 0.55 }}>
                {t('hub_recent_images')}
              </div>
              <div style={{
                display: 'flex',
                gap: 10,
                overflowX: 'auto',
                paddingBottom: 8,
                WebkitOverflowScrolling: 'touch',
              }}>
                {recentImages.slice(0, 12).map((o) => (
                  <button
                    key={o.OeuvreID}
                    type="button"
                    onClick={() => router.push('/atelier/inventory')}
                    style={{
                      width: 88,
                      height: 88,
                      flexShrink: 0,
                      background: 'var(--bg1)',
                      border: '1px solid var(--bd2)',
                      overflow: 'hidden',
                      position: 'relative',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                    aria-label={`#${o.OeuvreID}`}
                  >
                    {o.txtImageNameLink
                      ? <WorkThumb file={o.txtImageNameLink} size={256} alt="" />
                      : <div style={{ width: '100%', height: '100%', background: 'var(--bg2)' }} />}
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Section 1: Executive Summary */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: 'clamp(24px, 4vw, 48px)',
              alignItems: 'end',
            }}>
              <div>
                <div className="serif" style={{ fontSize: 'clamp(32px, 4vw, 48px)', color: 'var(--tx)', marginBottom: 8, letterSpacing: '-0.03em' }}>
                  {t('hub')}
                </div>
                <div className="t-eyebrow" style={{ color: 'var(--tx3)', letterSpacing: 2 }}>
                  {dateLabel} · {stats.total} {t('works_cap')} · {stats.publicWorks} {t('hubWorksOnline')}
                </div>
              </div>
              
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'clamp(16px, 3vw, 28px)', paddingBottom: 6, alignItems: 'flex-end' }}>
                <div className="stat-v2">
                  <span className="label">{t('thisYear')}</span>
                  <span className="value">{stats.thisYear}</span>
                </div>
                <div className="vline" style={{ height: 32, opacity: 0.1 }} />
                <div className="stat-v2">
                  <span className="label">{t('hubLastLog')}</span>
                  <span className="value" style={{ fontSize: 14, fontFamily: 'var(--font-ui)', letterSpacing: 0 }}>{displayLogs[0]?.action ?? '—'}</span>
                </div>
                {stats.stockAlerts > 0 && (
                  <>
                    <div className="vline" style={{ height: 32, opacity: 0.1 }} />
                    <div className="stat-v2">
                      <span className="label">{t('hubStockLow')}</span>
                      <span className="value" style={{ color: 'var(--ac)' }}>{stats.stockAlerts}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Section 2: Navigation Matrix (The 4 Portals) — Relations publiques second (moved left) */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              borderTop: '1px solid var(--bd)',
              borderBottom: '1px solid var(--bd)',
            }}>
              <PortalTile code="01" title={t('team')} desc={t('teamDesc')} href="/atelier"
                detail={{ works: stats.total, caption: t('works_cap') }} />
              <PortalTile code="02" title={t('public')} desc={t('publicDesc')} href="/works"
                detail={{ works: stats.publicWorks, caption: t('hubWorksOnline') }} />
              <PortalTile code="03" title={t('clients')} desc={t('clientsDesc')} href="/collection" wip />
              <PortalTile code="04" title={t('galleries')} desc={t('galleriesDesc')} href="/galerie" wip />
            </div>

            {/* Section 3: Live Pulse */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 'clamp(28px, 4vw, 48px)',
            }}>
              
              {/* Suivi / Pipeline */}
              <div>
                <div className="t-eyebrow" style={{ marginBottom: 24, opacity: 0.5 }}>01 · {t('pipeline')}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {recentProcess.slice(0, 12).map(p => (
                    <div key={p.id} onClick={() => router.push('/atelier/pipeline')} style={{ cursor: 'pointer', borderBottom: '1px solid var(--bd2)', paddingBottom: 12 }}>
                      <div className="serif" style={{ fontSize: 16, color: 'var(--tx)', marginBottom: 4 }}>{p.label}</div>
                      <div className="row gap-sm" style={{ justifyContent: 'space-between' }}>
                        <span className="t-mono-sm" style={{ color: 'var(--ac)', letterSpacing: 1 }}>{p.status}</span>
                        <span className="t-mono-sm" style={{ color: 'var(--tx3)' }}>{new Date(p.created_at).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Concepts */}
              <div>
                <div className="t-eyebrow" style={{ marginBottom: 24, opacity: 0.5 }}>02 · {t('concepts')}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {burningIdeas.slice(0, 8).map(i => (
                    <div key={i.id} onClick={() => router.push('/atelier/concepts')} 
                      style={{ padding: '12px 16px', background: 'var(--bg1)', border: '1px solid var(--bd2)', cursor: 'pointer', transition: 'border-color .2s' }}>
                      <div className="t-mono-sm" style={{ fontSize: 8, color: 'var(--tx3)', marginBottom: 4, textTransform: 'uppercase' }}>{i.medium || t('hub_concept_fallback')}</div>
                      <div className="serif" style={{ fontSize: 15, color: 'var(--tx)' }}>{i.title}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* System Ledger */}
              <div>
                <div className="t-eyebrow" style={{ marginBottom: 24, opacity: 0.5 }}>03 · {t('hub_pulse_ledger')}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {displayLogs.length === 0 ? (
                    <div className="t-mono-sm" style={{ color: 'var(--tx3)', opacity: 0.5 }}>{t('hub_ledger_empty')}</div>
                  ) : displayLogs.slice(0, 10).map((log) => {
                    const typeLine = hubLogTypeLabel(log)
                    return (
                    <div key={`${log.feedSource}-${log.id}`} onClick={() => router.push('/atelier/system')}
                      style={{ display: 'flex', gap: 10, alignItems: 'flex-start', borderBottom: '1px solid var(--bd2)', paddingBottom: 10, cursor: 'pointer' }}>
                      <span style={{ fontWeight: 700, fontSize: 9, color: priorityColor(log.priority), letterSpacing: 0.5, paddingTop: 2, flexShrink: 0 }}>
                        {log.priority ?? 'P3'}
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div className="t-mono" style={{ fontSize: 10, fontWeight: 600, color: 'var(--tx)', lineHeight: 1.3 }}>{log.action}</div>
                        {typeLine && <div style={{ fontSize: 8, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: 1, marginTop: 3 }}>{typeLine}</div>}
                      </div>
                    </div>
                  )})}
                </div>
                <div onClick={() => router.push('/atelier/system')}
                  style={{ marginTop: 16, fontSize: 8, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--tx3)', cursor: 'pointer' }}>
                  {t('hub_ledger_view_all')}
                </div>
              </div>

              {/* Recently Added */}
              <div>
                <div className="t-eyebrow" style={{ marginBottom: 24, opacity: 0.5 }}>04 · {t('recentlyAdded')}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
                  {recentImages.slice(0, 16).map((o) => (
                    <div key={o.OeuvreID} onClick={() => router.push('/atelier/inventory')}
                      style={{ aspectRatio: '1', background: 'var(--bg1)', border: '1px solid var(--bd2)', overflow: 'hidden', position: 'relative', cursor: 'pointer' }}>
                      {o.txtImageNameLink
                        ? <WorkThumb file={o.txtImageNameLink} size={256} alt="" />
                        : <div style={{ width: '100%', height: '100%', background: 'var(--bg2)' }} />}
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </>
        )}

      </div>

      <style jsx>{`
        .stat-v2 { display: flex; flexDirection: column; gap: 4px; }
        .stat-v2 .label { font-size: 8px; letter-spacing: 2px; text-transform: uppercase; color: var(--tx3); }
        .stat-v2 .value { font-size: 24px; color: var(--tx); font-family: 'Instrument Serif', serif; line-height: 1; }
      `}</style>

      {/* Footer */}
      <div style={{ padding: '10px 28px', borderTop: '1px solid var(--bd)', display: 'flex', justifyContent: 'space-between', color: 'var(--tx3)', fontSize: 9, letterSpacing: 1 }}>
        <span>{t('hub_footer_internal')}</span>
        <span>v0.1 · {new Date().toISOString().slice(0, 10)}</span>
      </div>
    </div>
  )
}

function MobileActionTile({
  title,
  subtitle,
  onClick,
  emphasis,
  dataTestId,
}: {
  title: string
  subtitle: string
  onClick: () => void
  emphasis?: boolean
  dataTestId?: string
}) {
  return (
    <button
      type="button"
      data-testid={dataTestId}
      onClick={onClick}
      style={{
        background: emphasis ? 'color-mix(in srgb, var(--ac) 12%, var(--bg1))' : 'var(--bg1)',
        border: emphasis ? '1px solid color-mix(in srgb, var(--ac) 55%, var(--bd))' : '1px solid var(--bd)',
        padding: '14px 14px 12px',
        textAlign: 'left',
        cursor: 'pointer',
        minHeight: 76,
        minWidth: 0,
      }}
    >
      <div className="serif" style={{ fontSize: 18, color: 'var(--tx)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
        {title}
      </div>
      <div className="t-mono-sm" style={{ marginTop: 6, fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--tx3)' }}>
        {subtitle}
      </div>
    </button>
  )
}

function MobileSwipeCard({
  kicker,
  items,
  onClick,
  emptyLabel,
}: {
  kicker: string
  items: { a: string; b: string; c: string }[]
  onClick: () => void
  emptyLabel: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: 286,
        flexShrink: 0,
        scrollSnapAlign: 'start',
        background: 'var(--bg1)',
        border: '1px solid var(--bd)',
        padding: 14,
        textAlign: 'left',
        cursor: 'pointer',
      }}
    >
      <div className="t-eyebrow" style={{ opacity: 0.55, marginBottom: 12 }}>
        {kicker}
      </div>
      {items.length === 0 ? (
        <div className="t-mono-sm" style={{ color: 'var(--tx3)', opacity: 0.6 }}>
          {emptyLabel}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map((x, idx) => (
            <div key={idx} style={{ borderBottom: idx === items.length - 1 ? 'none' : '1px solid var(--bd2)', paddingBottom: idx === items.length - 1 ? 0 : 10 }}>
              <div className="serif" style={{ fontSize: 14, color: 'var(--tx)', lineHeight: 1.15 }}>
                {x.a}
              </div>
              <div className="row gap-sm" style={{ justifyContent: 'space-between', marginTop: 6 }}>
                <span className="t-mono-sm" style={{ color: 'var(--ac)', letterSpacing: 1, fontSize: 9 }}>
                  {x.b}
                </span>
                <span className="t-mono-sm" style={{ color: 'var(--tx3)', fontSize: 9 }}>
                  {x.c}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </button>
  )
}

function PortalTile({
  code, title, desc, href, emphasis, detail, wip
}: {
  code: string; title: string; desc: string; href: string
  emphasis?: boolean; detail?: { works: number; caption: string }; wip?: boolean
}) {
  const router = useRouter()
  const { t } = useI18n()
  return (
    <button onClick={() => !wip && router.push(href)}
      style={{
        background: 'transparent', border: 'none',
        borderRight: '1px solid var(--bd)', padding: '24px 20px 20px',
        textAlign: 'left', minHeight: emphasis ? 180 : 160,
        display: 'flex', flexDirection: 'column', gap: 10, transition: 'background .2s',
        width: '100%', cursor: wip ? 'default' : 'pointer',
        opacity: wip ? 0.7 : 1
      }}
      onMouseEnter={(e) => { if (!wip) (e.currentTarget as HTMLElement).style.background = 'var(--bg1)' }}
      onMouseLeave={(e) => { if (!wip) (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
      <div className="row gap-sm" style={{ justifyContent: 'space-between', width: '100%' }}>
        <div className="row gap-sm">
          <div style={{ color: 'var(--ac)', fontSize: 9, letterSpacing: 3, fontWeight: 500 }}>{code}</div>
          {emphasis && <div style={{ width: 6, height: 6, background: 'var(--ac)', borderRadius: '50%' }} />}
        </div>
        {wip && (
          <span style={{ 
            fontSize: 7, letterSpacing: 1, textTransform: 'uppercase', 
            color: 'var(--bg0)', background: 'var(--ac)', 
            padding: '2px 6px', fontWeight: 600 
          }}>
            {t('hub_tile_wip')}
          </span>
        )}
      </div>
      <h3 className="serif" style={{ fontSize: emphasis ? 32 : 22, color: 'var(--tx)', lineHeight: 1.05, letterSpacing: '-0.02em', opacity: wip ? 0.4 : 1 }}>{title}</h3>
      <p style={{ fontSize: 10, color: 'var(--tx2)', lineHeight: 1.5, maxWidth: '28ch', opacity: wip ? 0.6 : 1 }}>{desc}</p>
      {detail && (
        <div className="row gap-lg" style={{ paddingTop: 8, borderTop: '1px dashed var(--bd2)', marginTop: 'auto' }}>
          <div className="col gap-xs">
            <span style={{ fontSize: 8, letterSpacing: 2, color: 'var(--tx3)', textTransform: 'uppercase' }}>{detail.caption}</span>
            <span style={{ fontSize: 18, color: 'var(--tx)', fontFamily: "'Instrument Serif', serif" }}>{detail.works}</span>
          </div>
        </div>
      )}
      <div className="row gap-sm" style={{ marginTop: detail ? 0 : 'auto', color: wip ? 'var(--tx3)' : 'var(--ac)', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', fontWeight: 600 }}>
        <span>{wip ? t('hub_tile_soon') : t('hub_tile_enter')}</span>{!wip && <span>→</span>}
      </div>
    </button>
  )
}
