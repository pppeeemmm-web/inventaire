'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import WavingCircle from '@/components/public/WavingCircle'
import { useI18n } from '@/lib/i18n/context'
import { trackView } from '@/lib/track'

const artistName = 'Pierre Emmanuel Moulin'

export default function LandingPage() {
  const { lang, setLang, t } = useI18n()

  useEffect(() => { trackView('/', document.referrer || null) }, [])

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { width: 100%; height: 100%; overflow: hidden; }
        body { background: #edeae4; font-family: 'JetBrains Mono', monospace; color: #9a9690; }
        .stage { position: fixed; top: 0; left: 0; right: 0; bottom: 0; display: grid; place-items: center; }
        .wordmark {
          position: absolute; top: clamp(12px, 3vh, 28px); left: clamp(12px, 3vw, 32px);
          font-size: clamp(7px, 1.3vmin, 9px); letter-spacing: clamp(1.5px, 0.4vmin, 3px); text-transform: uppercase;
          color: #b0aca6; text-decoration: none;
        }
        .lang-toggle {
          position: absolute; top: clamp(10px, 2.8vh, 24px); right: clamp(12px, 3vw, 32px);
          font-size: clamp(7px, 1.3vmin, 9px); letter-spacing: clamp(1px, 0.3vmin, 2px); text-transform: uppercase;
          color: #b0aca6; background: none; border: 1px solid #dedad4;
          padding: 4px 10px; cursor: pointer; transition: all .15s; font-family: inherit;
        }
        .lang-toggle:hover { color: #6b6760; border-color: #b0aca6; }
        .circle-wrap {
          position: relative;
          width: clamp(120px, 38vmin, 520px);
          height: clamp(120px, 38vmin, 520px);
          flex-shrink: 0;
        }
        .orb {
          position: absolute; font-size: clamp(8px, 1.4vmin, 10px); letter-spacing: clamp(1.5px, 0.4vmin, 3px); text-transform: uppercase;
          color: #7a7670; text-decoration: none;
          display: flex; align-items: center; gap: clamp(4px, 1.2vmin, 10px); white-space: nowrap; transition: color .25s;
        }
        .orb:hover { color: #3a3834; }
        .orb-top    { bottom: 100%; left: 50%; transform: translateX(-50%); flex-direction: column; padding-bottom: clamp(20px, 6vh, 52px); }
        .orb-top::after    { content: ''; display: block; width: 1px; height: clamp(14px, 3vmin, 28px); background: currentColor; opacity: .4; }
        .orb-bottom { top: 100%;  left: 50%; transform: translateX(-50%); flex-direction: column-reverse; padding-top: clamp(20px, 6vh, 52px); }
        .orb-bottom::after { content: ''; display: block; width: 1px; height: clamp(14px, 3vmin, 28px); background: currentColor; opacity: .4; }
        .orb-left   { right: 100%; top: 50%; transform: translateY(-50%); flex-direction: row; padding-right: clamp(20px, 6vw, 52px); }
        .orb-left::after   { content: ''; display: block; height: 1px; width: clamp(14px, 3vmin, 28px); background: currentColor; opacity: .4; }
        .orb-right  { left: 100%;  top: 50%; transform: translateY(-50%); flex-direction: row-reverse; padding-left: clamp(20px, 6vw, 52px); }
        .orb-right::after  { content: ''; display: block; height: 1px; width: clamp(14px, 3vmin, 28px); background: currentColor; opacity: .4; }
        .hub-link:hover { opacity: 1 !important; color: #1a1a1a !important; }
        .mobile-nav { display: none; }
        .mobile-nav a { font-size: 9px; letter-spacing: 3px; text-transform: uppercase; color: #7a7670; text-decoration: none; transition: color .25s; }
        .mobile-nav a:hover { color: #3a3834; }
        @media (max-width: 480px) {
          .stage { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 28px; }
          .circle-wrap { width: min(240px, 70vw); height: min(240px, 70vw); }
          .desktop-orb { display: none; }
          .mobile-nav { display: flex; flex-direction: column; align-items: center; gap: 18px; }
        }
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
          <Link href="/works"    className="orb orb-top desktop-orb">{t('pub_works')}</Link>
          <Link href="/about"    className="orb orb-left desktop-orb">{t('pub_about')}</Link>
          <Link href="/practice" className="orb orb-right desktop-orb">{t('pub_practice')}</Link>
          <Link href="/enquiry"  className="orb orb-bottom desktop-orb">{t('pub_enquiry')}</Link>
        </div>

        <nav className="mobile-nav">
          <Link href="/works">{t('pub_works')}</Link>
          <Link href="/practice">{t('pub_practice')}</Link>
          <Link href="/about">{t('pub_about')}</Link>
          <Link href="/enquiry">{t('pub_enquiry')}</Link>
        </nav>

        <Link href="/hub" style={{
          position: 'absolute', bottom: 'clamp(10px, 3vh, 32px)', right: 'clamp(12px, 4vw, 40px)',
          fontSize: 'clamp(7px, 1.3vmin, 9px)', letterSpacing: 2, textTransform: 'uppercase',
          color: '#8a8680', textDecoration: 'none', opacity: 0.7,
          transition: 'all 0.3s', fontWeight: 600
        }} className="hub-link">[ Hub ]</Link>
      </div>
    </>
  )
}
