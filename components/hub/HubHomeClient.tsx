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
          <Link href="/atelier?tab=system" className="t-mono-sm" style={{ color: 'var(--tx2)', textDecoration: 'none', marginLeft: 12 }}>
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

      {/* Main */}
      <div style={{ flex: 1, padding: '24px 40px 24px', display: 'flex', flexDirection: 'column', overflow: 'hidden', gap: 24 }}>

        {/* System Log + stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '2.5fr 1fr', gap: 32, alignItems: 'start' }}>
          <div>
            <div className="t-eyebrow" style={{ color: 'var(--tx3)', marginBottom: 16 }}>
              Atelier · {dateLabel}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
               <h2 className="serif" style={{ fontSize: 24, color: 'var(--tx)', marginBottom: 4 }}>Improvements & Maintenance</h2>
               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  {displayLogs.map(log => (
                    <div key={log.id} 
                      onClick={() => router.push('/atelier?tab=system')}
                      style={{ border: '1px solid var(--bd2)', padding: '10px 14px', background: 'var(--bg1)', cursor: 'pointer' }}>
                       <div className="row gap-sm" style={{ marginBottom: 4 }}>
                          <span style={{ fontSize: 8, textTransform: 'uppercase', color: 'var(--ac)', letterSpacing: 1, border: '1px solid var(--ac)', padding: '1px 4px' }}>{log.type}</span>
                          <span style={{ fontSize: 9, color: 'var(--tx2)', fontWeight: 600 }}>{log.label}</span>
                       </div>
                       <div style={{ fontSize: 10, color: 'var(--tx3)', lineHeight: 1.4 }}>{log.details}</div>
                    </div>
                  ))}
               </div>
            </div>
          </div>
          <div style={{ borderLeft: '1px solid var(--bd)', paddingLeft: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
               <div className="stat" style={{ padding: '4px 0' }}><span className="l">{t('works_cap')}</span><span className="v" style={{ fontSize: 16 }}>{stats.total}</span></div>
               <div className="stat" style={{ padding: '4px 0' }}><span className="l">{t('thisYear')}</span><span className="v" style={{ color: 'var(--ac)', fontSize: 16 }}>{stats.thisYear}</span></div>
               {stats.stockAlerts > 0 && (
                 <div className="stat" style={{ padding: '4px 0' }}>
                   <span className="l" style={{ color: 'var(--rust)' }}>Alerte Stock</span>
                   <span className="v" style={{ color: 'var(--rust)', fontSize: 16 }}>{stats.stockAlerts}</span>
                 </div>
               )}
            </div>
          </div>
        </div>

        {/* Portal grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', borderTop: '1px solid var(--bd)', borderBottom: '1px solid var(--bd)' }}>
          <PortalTile code="01" emphasis title={t('team')}     desc={t('teamDesc')}     href="/atelier"    detail={{ works: stats.total }} lang={lang} />
          <PortalTile code="02"         title={t('clients')}   desc={t('clientsDesc')}  href="/collection" lang={lang} />
          <PortalTile code="03"         title={t('galleries')} desc={t('galleriesDesc')} href="/galerie"   lang={lang} />
          <PortalTile code="04"         title={t('public')}    desc={t('publicDesc')}   href="/portfolio"  lang={lang} />
        </div>

        {/* Live Feed Row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 40, flex: 1, minHeight: 0 }}>
           {/* Column 1: Pipeline Pulse */}
           <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
             <div className="t-eyebrow" style={{ marginBottom: 12, opacity: 0.6, fontSize: 9 }}>{t('pipeline')} ↑</div>
             <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflow: 'auto', flex: 1 }}>
                {recentProcess.length === 0 ? (
                  <div className="t-mono-sm" style={{ color: 'var(--tx3)' }}>Aucun projet actif</div>
                ) : recentProcess.map(p => (
                  <div key={p.id} 
                    onClick={() => router.push('/atelier?tab=pipeline')}
                    style={{ paddingBottom: 8, borderBottom: '1px solid var(--bd2)', cursor: 'pointer' }}>
                    <div className="t-mono-sm" style={{ color: 'var(--tx)', fontSize: 10 }}>{p.label}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                       <span style={{ fontSize: 8, textTransform: 'uppercase', color: 'var(--ac)', letterSpacing: 1 }}>{p.status}</span>
                       <span style={{ fontSize: 8, color: 'var(--tx3)' }}>{new Date(p.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
             </div>
           </div>

           {/* Column 2: Burning Ideas */}
           <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
             <div className="t-eyebrow" style={{ marginBottom: 12, opacity: 0.6, fontSize: 9 }}>{t('concepts')} ⚡</div>
             <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflow: 'auto', flex: 1 }}>
                {burningIdeas.length === 0 ? (
                  <div className="t-mono-sm" style={{ color: 'var(--tx3)' }}>Pas d'idées brûlantes</div>
                ) : burningIdeas.map(i => (
                  <div key={i.id} 
                    onClick={() => router.push('/atelier?tab=concepts')}
                    style={{ padding: '6px 10px', background: 'var(--bg1)', borderLeft: '2px solid var(--ac)', cursor: 'pointer' }}>
                    <div style={{ fontSize: 8, color: 'var(--tx3)', marginBottom: 2, textTransform: 'uppercase' }}>{i.medium || 'Concept'}</div>
                    <div className="serif" style={{ fontSize: 13, color: 'var(--tx)' }}>{i.title}</div>
                  </div>
                ))}
             </div>
           </div>

           {/* Column 3: Recent Activity */}
           <div>
             <div className="t-eyebrow" style={{ marginBottom: 12, opacity: 0.6, fontSize: 9 }}>{t('recentlyAdded')}</div>
             <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
                {recentImages.slice(0, 12).map((o) => (
                  <div key={o.OeuvreID} className="thumb" style={{ aspectRatio: '1', height: 'auto' }}>
                    {o.txtImageNameLink
                      ? <img src={thumbUrl(o.txtImageNameLink, 128) ?? ''} loading="lazy" alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <div className="ph" />}
                  </div>
                ))}
             </div>
           </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '10px 28px', borderTop: '1px solid var(--bd)', display: 'flex', justifyContent: 'space-between', color: 'var(--tx3)', fontSize: 9, letterSpacing: 1 }}>
        <span>PEM · Atelier interne</span>
        <span>v0.1 · {new Date().toISOString().slice(0, 10)}</span>
      </div>
    </div>
  )
}

function PortalTile({
  code, title, desc, href, emphasis, detail, lang,
}: {
  code: string; title: string; desc: string; href: string
  emphasis?: boolean; detail?: { works: number }; lang: string
}) {
  const router = useRouter()
  return (
    <button onClick={() => router.push(href)}
      style={{
        background: 'transparent', border: 'none',
        borderRight: '1px solid var(--bd)', padding: '24px 20px 20px',
        textAlign: 'left', minHeight: emphasis ? 180 : 160,
        display: 'flex', flexDirection: 'column', gap: 10, transition: 'background .2s',
        width: '100%',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg1)' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
      <div className="row gap-sm">
        <div style={{ color: 'var(--ac)', fontSize: 9, letterSpacing: 3, fontWeight: 500 }}>{code}</div>
        {emphasis && <div style={{ width: 6, height: 6, background: 'var(--ac)', borderRadius: '50%' }} />}
      </div>
      <h3 className="serif" style={{ fontSize: emphasis ? 32 : 22, color: 'var(--tx)', lineHeight: 1.05, letterSpacing: '-0.02em' }}>{title}</h3>
      <p style={{ fontSize: 10, color: 'var(--tx2)', lineHeight: 1.5, maxWidth: '28ch' }}>{desc}</p>
      {detail && (
        <div className="row gap-lg" style={{ paddingTop: 8, borderTop: '1px dashed var(--bd2)', marginTop: 'auto' }}>
          <div className="col gap-xs">
            <span style={{ fontSize: 8, letterSpacing: 2, color: 'var(--tx3)', textTransform: 'uppercase' }}>Œuvres</span>
            <span style={{ fontSize: 18, color: 'var(--tx)', fontFamily: "'Instrument Serif', serif" }}>{detail.works}</span>
          </div>
        </div>
      )}
      <div className="row gap-sm" style={{ marginTop: detail ? 0 : 'auto', color: 'var(--ac)', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', fontWeight: 500 }}>
        <span>{lang === 'fr' ? 'Entrer' : 'Enter'}</span><span>→</span>
      </div>
    </button>
  )
}
