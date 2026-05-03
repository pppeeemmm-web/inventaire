'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import WavingCircle from '@/components/public/WavingCircle'
import { useI18n } from '@/lib/i18n/context'
import { createClient } from '@/lib/supabase/client'

export default function LandingPage() {
  const { lang, setLang, t } = useI18n()
  const [artistName, setArtistName] = useState('Atelier PEM')

  useEffect(() => {
    async function fetchName() {
      const sb = createClient()
      const { data: configDoc } = await (sb.from('document') as any)
        .select('storage_path').eq('name', 'portfolio_sections.json').maybeSingle()
      if (!configDoc?.storage_path) return
      const { data: fileData } = await sb.storage.from('vault').download(configDoc.storage_path)
      if (!fileData) return
      try {
        const cfg = JSON.parse(await fileData.text())
        if (cfg?.general?.artist_name) setArtistName(cfg.general.artist_name)
      } catch { }
    }
    fetchName()
  }, [])

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { width: 100%; height: 100%; overflow: hidden; }
        body { background: #edeae4; font-family: 'JetBrains Mono', monospace; color: #9a9690; }
        .stage { position: fixed; top: 0; left: 0; right: 0; bottom: 0; display: grid; place-items: center; }
        .wordmark {
          position: absolute; top: 28px; left: 32px;
          font-size: 9px; letter-spacing: 3px; text-transform: uppercase;
          color: #b0aca6; text-decoration: none;
        }
        .lang-toggle {
          position: absolute; top: 24px; right: 32px;
          font-size: 9px; letter-spacing: 2px; text-transform: uppercase;
          color: #b0aca6; background: none; border: 1px solid #dedad4;
          padding: 4px 10px; cursor: pointer; transition: all .15s; font-family: inherit;
        }
        .lang-toggle:hover { color: #6b6760; border-color: #b0aca6; }
        .circle-wrap {
          position: relative;
          width: clamp(300px, 42vmin, 520px);
          height: clamp(300px, 42vmin, 520px);
          flex-shrink: 0;
        }
        .orb {
          position: absolute; font-size: 9px; letter-spacing: 3px; text-transform: uppercase;
          color: #b0aca6; text-decoration: none;
          display: flex; align-items: center; gap: 10px; white-space: nowrap; transition: color .25s;
        }
        .orb:hover { color: #5a5650; }
        .orb-top    { bottom: 100%; left: 50%; transform: translateX(-50%); flex-direction: column; padding-bottom: 52px; }
        .orb-top::after    { content: ''; display: block; width: 1px; height: 28px; background: currentColor; opacity: .4; }
        .orb-bottom { top: 100%;  left: 50%; transform: translateX(-50%); flex-direction: column-reverse; padding-top: 52px; }
        .orb-bottom::after { content: ''; display: block; width: 1px; height: 28px; background: currentColor; opacity: .4; }
        .orb-left   { right: 100%; top: 50%; transform: translateY(-50%); flex-direction: row; padding-right: 52px; }
        .orb-left::after   { content: ''; display: block; height: 1px; width: 28px; background: currentColor; opacity: .4; }
        .orb-right  { left: 100%;  top: 50%; transform: translateY(-50%); flex-direction: row-reverse; padding-left: 52px; }
        .orb-right::after  { content: ''; display: block; height: 1px; width: 28px; background: currentColor; opacity: .4; }
        .hub-link:hover { opacity: 1 !important; color: #1a1a1a !important; }
      `}</style>

      <div className="stage">
        <Link href="/" className="wordmark">{artistName}</Link>
        <button
          className="lang-toggle"
          onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')}
          aria-label="Switch language"
        >
          {lang === 'fr' ? 'EN' : 'FR'}
        </button>

        <div className="circle-wrap">
          <WavingCircle
            src="https://pub-a352e674a992412fa243598ffd6b659c.r2.dev/thumbs/W_2190_01_20260411-20260411-_PE16262_-_pe_moulin_-_pe_moulin.avif"
            alt={artistName}
          />
          <Link href="/works"    className="orb orb-top">{t('pub_works')}</Link>
          <Link href="/about"    className="orb orb-left">{t('pub_about')}</Link>
          <Link href="/practice" className="orb orb-right">{t('pub_practice')}</Link>
          <Link href="/enquiry"  className="orb orb-bottom">{t('pub_enquiry')}</Link>
        </div>

        <Link href="/hub" style={{
          position: 'absolute', bottom: 32, right: 40,
          fontSize: 9, letterSpacing: 2, textTransform: 'uppercase',
          color: '#8a8680', textDecoration: 'none', opacity: 0.7,
          transition: 'all 0.3s', fontWeight: 600
        }} className="hub-link">[ Hub ]</Link>
      </div>
    </>
  )
}
