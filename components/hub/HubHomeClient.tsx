'use client'

import { useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n/context'
import { thumbUrl } from '@/lib/data'

interface Props {
  stats: { total: number; thisYear: number }
  recentImages: { OeuvreID: number; txtImageNameLink: string | null }[]
}

export function HubHomeClient({ stats, recentImages }: Props) {
  const { lang, setLang, t } = useI18n()
  const router = useRouter()

  const dateLabel = new Date().toLocaleDateString(
    lang === 'fr' ? 'fr-FR' : 'en-GB',
    { weekday: 'long', day: 'numeric', month: 'long' }
  )

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
      <div style={{ flex: 1, padding: '40px 56px 32px', overflow: 'auto' }}>

        {/* Headline + stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 40, alignItems: 'end', marginBottom: 52 }}>
          <div>
            <div className="t-eyebrow" style={{ color: 'var(--tx3)', marginBottom: 18 }}>
              Atelier · {dateLabel}
            </div>
            <h1 className="serif s-display" style={{ color: 'var(--tx)', marginBottom: 18 }}>
              {lang === 'fr'
                ? <><span>Faire.</span><br /><span>Garder trace.</span><br /><span style={{ color: 'var(--ac)' }}>Rencontrer.</span></>
                : <><span>Make.</span><br /><span>Keep record.</span><br /><span style={{ color: 'var(--ac)' }}>Meet.</span></>}
            </h1>
            <div className="t-mono" style={{ color: 'var(--tx2)', maxWidth: '56ch', marginTop: 14 }}>
              {lang === 'fr'
                ? "Un outil d'atelier. Inventaire, production, et curation de l'œuvre. Les galeries et les collectionneurs restent au cœur — ceci ne les remplace pas."
                : "A studio tool. Inventory, production, and curation of the œuvre. Galleries and collectors remain central — this doesn't replace them."}
            </div>
          </div>
          <div style={{ borderLeft: '1px solid var(--bd)', paddingLeft: 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
              <div className="stat"><span className="l">{t('works_cap')}</span><span className="v">{stats.total}</span></div>
              <div className="stat"><span className="l">{t('thisYear')}</span><span className="v" style={{ color: 'var(--ac)' }}>{stats.thisYear}</span></div>
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

        {/* Recent works ticker */}
        <div style={{ marginTop: 40 }}>
          <div className="t-label" style={{ marginBottom: 14 }}>{t('recentlyAdded')}</div>
          <div style={{ display: 'flex', gap: 6, overflow: 'hidden' }}>
            {recentImages.slice(0, 18).map((o) => (
              <div key={o.OeuvreID} className="thumb" style={{ flex: '0 0 72px', height: 72 }}>
                {o.txtImageNameLink
                  ? <img src={thumbUrl(o.txtImageNameLink, 128) ?? ''} loading="lazy" alt="" />
                  : <div className="ph" />}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '14px 28px', borderTop: '1px solid var(--bd)', display: 'flex', justifyContent: 'space-between', color: 'var(--tx3)', fontSize: 10, letterSpacing: 1 }}>
        <span>PEM · Atelier interne — accès restreint</span>
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
        borderRight: '1px solid var(--bd)', padding: '36px 28px 32px',
        textAlign: 'left', minHeight: emphasis ? 280 : 240,
        display: 'flex', flexDirection: 'column', gap: 16, transition: 'background .2s',
        width: '100%',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg1)' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
      <div className="row gap-sm">
        <div style={{ color: 'var(--ac)', fontSize: 10, letterSpacing: 3, fontWeight: 500 }}>{code}</div>
        {emphasis && <div style={{ width: 8, height: 8, background: 'var(--ac)', borderRadius: '50%' }} />}
      </div>
      <h3 className="serif" style={{ fontSize: emphasis ? 44 : 28, color: 'var(--tx)', lineHeight: 1.05, letterSpacing: '-0.02em' }}>{title}</h3>
      <p style={{ fontSize: 11, color: 'var(--tx2)', lineHeight: 1.6, maxWidth: '36ch' }}>{desc}</p>
      {detail && (
        <div className="row gap-lg" style={{ paddingTop: 12, borderTop: '1px dashed var(--bd2)', marginTop: 'auto' }}>
          <div className="col gap-xs">
            <span style={{ fontSize: 9, letterSpacing: 2, color: 'var(--tx3)', textTransform: 'uppercase' }}>Œuvres</span>
            <span style={{ fontSize: 22, color: 'var(--tx)', fontFamily: "'Instrument Serif', serif" }}>{detail.works}</span>
          </div>
        </div>
      )}
      <div className="row gap-sm" style={{ marginTop: detail ? 0 : 'auto', color: 'var(--ac)', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', fontWeight: 500 }}>
        <span>{lang === 'fr' ? 'Entrer' : 'Enter'}</span><span>→</span>
      </div>
    </button>
  )
}
