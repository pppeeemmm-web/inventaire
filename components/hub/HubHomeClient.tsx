'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n/context'
import { thumbUrl } from '@/lib/data'

interface Props {
  stats: { total: number; thisYear: number; stockAlerts: number }
  recentImages: { OeuvreID: number; txtImageNameLink: string | null }[]
  recentProcess: { id: number; label: string; status: string; created_at: string }[]
  burningIdeas:  { id: number; title: string; energy: number | null; medium: string | null }[]
  systemLogs:    { id: number; type: string; label: string; details: string; status: string }[]
}

export function HubHomeClient({ stats, recentImages, recentProcess, burningIdeas, systemLogs }: Props) {
  const { lang, setLang, t } = useI18n()
  const router = useRouter()

  const dateLabel = new Date().toLocaleDateString(
    lang === 'fr' ? 'fr-FR' : 'en-GB',
    { weekday: 'long', day: 'numeric', month: 'long' }
  )

  const displayLogs = systemLogs.length > 0 ? systemLogs : [
    { id: -1, type: 'feature', label: 'Stock-take Inventory Audit', details: 'Added physical quantity verification with automatic discrepancy calculation.', status: 'completed' },
    { id: -2, type: 'data', label: 'Material Import (178 items)', details: 'Migrated studio supplies from Excel files into the stock database.', status: 'completed' },
    { id: -3, type: 'data', label: 'Docket Processing Pipeline', details: 'Integrated digital receipt processing for Jackson\'s, Leroux, and Kremer.', status: 'active' },
    { id: -4, type: 'ui', label: 'Hub Intelligence Optimization', details: 'Redesigned Hub into a no-scroll executive dashboard surfacing Live Pipeline.', status: 'completed' }
  ]

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg0)' }}>

      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 28px', borderBottom: '1px solid var(--bd)' }}>
        <div className="row gap-md">
          <div style={{ width: 24, height: 24, border: '1px solid var(--ac)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ac)', fontSize: 11, fontFamily: "'Instrument Serif', serif", lineHeight: 1 }}>P</div>
          <div className="t-eyebrow" style={{ color: 'var(--tx)' }}>{t('hub')}</div>
          <div className="t-mono-sm" style={{ color: 'var(--tx3)' }}>— {t('tagline')}</div>
        </div>
        <div className="row gap-md">
          <div className="t-mono-sm" style={{ color: 'var(--tx3)' }}>{t('signedAs')} · atelier</div>
          <Link href="/Atelier_Studio_Bible.pdf" target="_blank" className="t-mono-sm" style={{ color: 'var(--tx2)', textDecoration: 'none', marginLeft: 12 }}>
            Studio Bible 📕
          </Link>
          <div className="vline" style={{ height: 12, margin: '0 12px', opacity: 0.3 }} />
          <Link href="/atelier?tab=system" className="t-mono-sm" style={{ color: 'var(--tx2)', textDecoration: 'none' }}>
            Suggestions 💡
          </Link>
          <div className="vline" style={{ height: 12, margin: '0 12px', opacity: 0.3 }} />
          <Link href="/" className="t-mono-sm" style={{ color: 'var(--ac)', textDecoration: 'none', border: '1px solid var(--ac)', padding: '2px 8px' }}>
            {lang === 'fr' ? 'Site Public' : 'Public Site'}
          </Link>
          <div style={{ display: 'flex', border: '1px solid var(--bd)' }}>
            {(['fr', 'en'] as const).map((l) => (
              <button key={l} onClick={() => setLang(l)}
                style={{ padding: '4px 10px', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: lang === l ? 'var(--ac)' : 'var(--tx3)', background: lang === l ? 'var(--bg2)' : 'transparent', borderRight: l === 'fr' ? '1px solid var(--bd)' : 'none' }}>
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, padding: '40px 40px', display: 'flex', flexDirection: 'column', overflow: 'auto', gap: 48 }}>
        
        {/* Section 1: Executive Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 60, alignItems: 'end' }}>
          <div>
            <div className="serif" style={{ fontSize: 'clamp(32px, 4vw, 48px)', color: 'var(--tx)', marginBottom: 8, letterSpacing: '-0.03em' }}>
              {t('hub')}
            </div>
            <div className="t-eyebrow" style={{ color: 'var(--tx3)', letterSpacing: 2 }}>
              {dateLabel} · {stats.total} {t('works_cap')}
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: 32, paddingBottom: 6 }}>
            <div className="stat-v2">
              <span className="label">{t('thisYear')}</span>
              <span className="value">{stats.thisYear}</span>
            </div>
            <div className="vline" style={{ height: 32, opacity: 0.1 }} />
            <div className="stat-v2">
              <span className="label">Maintenance</span>
              <span className="value" style={{ fontSize: 14, fontFamily: 'monospace', letterSpacing: 0 }}>{displayLogs[0].label}</span>
            </div>
          </div>
        </div>

        {/* Section 2: Navigation Matrix (The 4 Portals) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderTop: '1px solid var(--bd)', borderBottom: '1px solid var(--bd)' }}>
          <PortalTile code="01" title={t('team')}     desc={t('teamDesc')}     href="/atelier"    detail={{ works: stats.total }} lang={lang} />
          <PortalTile code="02" title={t('clients')}   desc={t('clientsDesc')}  href="/collection" lang={lang} wip={true} />
          <PortalTile code="03" title={t('galleries')} desc={t('galleriesDesc')} href="/galerie"   lang={lang} wip={true} />
          <PortalTile code="04" title={t('public')}    desc={t('publicDesc')}   href="/portfolio"  lang={lang} />
        </div>

        {/* Section 3: Live Pulse */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: 60 }}>
          
          {/* Suivi / Pipeline */}
          <div>
            <div className="t-eyebrow" style={{ marginBottom: 24, opacity: 0.5 }}>01 · {t('pipeline')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {recentProcess.slice(0, 5).map(p => (
                <div key={p.id} onClick={() => router.push('/atelier?tab=pipeline')} style={{ cursor: 'pointer', borderBottom: '1px solid var(--bd2)', paddingBottom: 12 }}>
                  <div className="serif" style={{ fontSize: 16, color: 'var(--tx)', marginBottom: 4 }}>{p.label}</div>
                  <div className="row gap-sm" style={{ justifyContent: 'space-between' }}>
                    <span className="t-mono-sm" style={{ color: 'var(--ac)', letterSpacing: 1 }}>{p.status}</span>
                    <span className="t-mono-sm" style={{ color: 'var(--tx3)' }}>{new Date(p.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Concepts */}
          <div>
            <div className="t-eyebrow" style={{ marginBottom: 24, opacity: 0.5 }}>02 · {t('concepts')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {burningIdeas.slice(0, 4).map(i => (
                <div key={i.id} onClick={() => router.push('/atelier?tab=concepts')} 
                  style={{ padding: '12px 16px', background: 'var(--bg1)', border: '1px solid var(--bd2)', cursor: 'pointer', transition: 'border-color .2s' }}>
                  <div className="t-mono-sm" style={{ fontSize: 8, color: 'var(--tx3)', marginBottom: 4, textTransform: 'uppercase' }}>{i.medium || 'Concept'}</div>
                  <div className="serif" style={{ fontSize: 15, color: 'var(--tx)' }}>{i.title}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Recently Added */}
          <div>
            <div className="t-eyebrow" style={{ marginBottom: 24, opacity: 0.5 }}>03 · {t('recentlyAdded')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {recentImages.slice(0, 12).map((o) => (
                <div key={o.OeuvreID} style={{ aspectRatio: '1', background: 'var(--bg1)', border: '1px solid var(--bd2)', overflow: 'hidden' }}>
                  {o.txtImageNameLink
                    ? <img src={thumbUrl(o.txtImageNameLink, 256) ?? ''} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }} />
                    : <div style={{ width: '100%', height: '100%', background: 'var(--bg2)' }} />}
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

      <style jsx>{`
        .stat-v2 { display: flex; flexDirection: column; gap: 4px; }
        .stat-v2 .label { font-size: 8px; letter-spacing: 2px; text-transform: uppercase; color: var(--tx3); }
        .stat-v2 .value { font-size: 24px; color: var(--tx); font-family: 'Instrument Serif', serif; line-height: 1; }
      `}</style>

      {/* Footer */}
      <div style={{ padding: '10px 28px', borderTop: '1px solid var(--bd)', display: 'flex', justifyContent: 'space-between', color: 'var(--tx3)', fontSize: 9, letterSpacing: 1 }}>
        <span>PEM · Atelier interne</span>
        <span>v0.1 · {new Date().toISOString().slice(0, 10)}</span>
      </div>
    </div>
  )
}

function PortalTile({
  code, title, desc, href, emphasis, detail, lang, wip
}: {
  code: string; title: string; desc: string; href: string
  emphasis?: boolean; detail?: { works: number }; lang: string; wip?: boolean
}) {
  const router = useRouter()
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
            WIP
          </span>
        )}
      </div>
      <h3 className="serif" style={{ fontSize: emphasis ? 32 : 22, color: 'var(--tx)', lineHeight: 1.05, letterSpacing: '-0.02em', opacity: wip ? 0.4 : 1 }}>{title}</h3>
      <p style={{ fontSize: 10, color: 'var(--tx2)', lineHeight: 1.5, maxWidth: '28ch', opacity: wip ? 0.6 : 1 }}>{desc}</p>
      {detail && (
        <div className="row gap-lg" style={{ paddingTop: 8, borderTop: '1px dashed var(--bd2)', marginTop: 'auto' }}>
          <div className="col gap-xs">
            <span style={{ fontSize: 8, letterSpacing: 2, color: 'var(--tx3)', textTransform: 'uppercase' }}>Œuvres</span>
            <span style={{ fontSize: 18, color: 'var(--tx)', fontFamily: "'Instrument Serif', serif" }}>{detail.works}</span>
          </div>
        </div>
      )}
      <div className="row gap-sm" style={{ marginTop: detail ? 0 : 'auto', color: wip ? 'var(--tx3)' : 'var(--ac)', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', fontWeight: 600 }}>
        <span>{wip ? (lang === 'fr' ? 'Bientôt' : 'Soon') : (lang === 'fr' ? 'Entrer' : 'Enter')}</span>{!wip && <span>→</span>}
      </div>
    </button>
  )
}
