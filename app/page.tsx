'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import WavingCircle from '@/components/public/WavingCircle'
import LandingPdfPopup from '@/components/portfolio/LandingPdfPopup'
import { useI18n } from '@/lib/i18n/context'
import { trackView } from '@/lib/track'

const artistName = 'Pierre Emmanuel Moulin'

export default function LandingPage() {
  const { lang, setLang, t } = useI18n()
  const [pdfOpen, setPdfOpen] = useState(false)

  useEffect(() => { trackView('/', document.referrer || null) }, [])

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { width: 100%; min-height: 100dvh; overflow-x: hidden; overflow-y: auto; }
        body { background: #edeae4; font-family: 'JetBrains Mono', monospace; color: #9a9690; }
        .stage {
          position: fixed; inset: 0; min-height: 100dvh;
          padding-top: env(safe-area-inset-top, 0px);
          padding-bottom: env(safe-area-inset-bottom, 0px);
          padding-left: env(safe-area-inset-left, 0px);
          padding-right: env(safe-area-inset-right, 0px);
          display: grid; place-items: center;
        }
        .wordmark {
          position: absolute;
          top: max(clamp(12px, 3vh, 28px), env(safe-area-inset-top, 0px));
          left: max(clamp(12px, 3vw, 32px), env(safe-area-inset-left, 0px));
          font-size: clamp(7px, 1.4vmin, 9px); letter-spacing: clamp(1.5px, 0.35vmin, 3px); text-transform: uppercase;
          color: #b0aca6; text-decoration: none;
          padding: 10px 8px; min-height: 44px; display: inline-flex; align-items: center;
        }
        .lang-toggle {
          position: absolute;
          top: max(clamp(10px, 2.8vh, 24px), env(safe-area-inset-top, 0px));
          right: max(clamp(12px, 3vw, 32px), env(safe-area-inset-right, 0px));
          font-size: clamp(7px, 1.4vmin, 9px); letter-spacing: clamp(1px, 0.3vmin, 2px); text-transform: uppercase;
          color: #b0aca6; background: none; border: 1px solid #dedad4;
          padding: 4px 10px; cursor: pointer; transition: all .15s; font-family: inherit;
          min-height: 44px; min-width: 44px; display: inline-flex; align-items: center; justify-content: center;
        }
        .lang-toggle:hover { color: #6b6760; border-color: #b0aca6; }
        .circle-wrap {
          position: relative;
          --orbit: min(38vmin, calc(100vw - 108px), calc(100dvh - 180px), 520px);
          width: max(140px, min(var(--orbit), 520px));
          height: max(140px, min(var(--orbit), 520px));
          flex-shrink: 0;
          max-width: min(520px, calc(100vw - 24px));
        }
        .orb {
          position: absolute;
          font-size: clamp(8px, 2.5vmin, 10px); letter-spacing: clamp(1.5px, 0.35vmin, 3px); text-transform: uppercase;
          color: #7a7670; text-decoration: none;
          display: flex; align-items: center; justify-content: center;
          gap: clamp(4px, 1vmin, 10px); white-space: nowrap; transition: color .25s;
          min-height: 44px; min-width: 44px;
        }
        .orb:hover { color: #3a3834; }
        .orb-top    { bottom: 100%; left: 50%; transform: translateX(-50%); flex-direction: column; padding: 8px 18px clamp(18px, 5vmin, 52px); }
        .orb-top::after    { content: ''; display: block; width: 1px; height: clamp(12px, 2.8vmin, 28px); background: currentColor; opacity: .4; }
        .orb-bottom { top: 100%;  left: 50%; transform: translateX(-50%); flex-direction: column-reverse; padding: clamp(18px, 5vmin, 52px) 18px 8px; }
        .orb-bottom::after { content: ''; display: block; width: 1px; height: clamp(12px, 2.8vmin, 28px); background: currentColor; opacity: .4; }
        .orb-left   { right: 100%; top: 50%; transform: translateY(-50%); flex-direction: row; padding: 8px clamp(12px, 4vmin, 52px) 8px 18px; }
        .orb-left::after   { content: ''; display: block; height: 1px; width: clamp(12px, 2.8vmin, 28px); background: currentColor; opacity: .4; }
        .orb-right  { left: 100%;  top: 50%; transform: translateY(-50%); flex-direction: row-reverse; padding: 8px 18px 8px clamp(12px, 4vmin, 52px); }
        .orb-right::after  { content: ''; display: block; height: 1px; width: clamp(12px, 2.8vmin, 28px); background: currentColor; opacity: .4; }
        .hub-link {
          position: absolute;
          bottom: max(clamp(12px, 3vh, 32px), env(safe-area-inset-bottom, 0px));
          right: max(clamp(14px, 4vw, 40px), env(safe-area-inset-right, 0px));
          font-size: clamp(7px, 1.4vmin, 9px); letter-spacing: clamp(1px, 0.3vmin, 2px); text-transform: uppercase;
          color: #8a8680; text-decoration: none; opacity: 0.7;
          transition: all 0.3s; font-weight: 600;
          min-height: 44px; padding: 10px 8px; display: inline-flex; align-items: center;
        }
        .hub-link:hover { opacity: 1 !important; color: #1a1a1a !important; }
        .pdf-link {
          position: absolute;
          bottom: max(clamp(12px, 3vh, 32px), env(safe-area-inset-bottom, 0px));
          left: max(clamp(14px, 4vw, 40px), env(safe-area-inset-left, 0px));
          font-size: clamp(7px, 1.4vmin, 9px); letter-spacing: clamp(1px, 0.3vmin, 2px); text-transform: uppercase;
          color: #8a8680; background: none; border: none;
          padding: 10px 8px; min-height: 44px;
          opacity: 0.7; transition: all 0.3s;
          font-family: inherit; font-weight: 600; cursor: pointer;
          display: inline-flex; align-items: center;
        }
        .pdf-link:hover { opacity: 1; color: #1a1a1a; }
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

        <button
          type="button"
          className="pdf-link"
          onClick={() => setPdfOpen(true)}
          aria-label={lang === 'fr' ? 'Télécharger le portfolio PDF' : 'Download portfolio PDF'}
        >
          [ {lang === 'fr' ? 'Portfolio PDF' : 'Portfolio PDF'} ]
        </button>

        <Link href="/hub" className="hub-link">[ Hub ]</Link>
      </div>

      <LandingPdfPopup open={pdfOpen} onClose={() => setPdfOpen(false)} lang={lang} />
    </>
  )
}
