'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import WavingCircle from '@/components/public/WavingCircle'
import LandingPdfPopup from '@/components/portfolio/LandingPdfPopup'
import { useI18n } from '@/lib/i18n/context'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { getOrCreatePublicVisitorId } from '@/lib/public-visitor-id'
import { trackView } from '@/lib/track'

type LandingPageProps = {
  /** Resolved absolute URL (config or default). */
  heroImageUrl: string
  artistName: string
  /** Custom hero hosts may be outside `images.remotePatterns`. */
  heroImageUnoptimized: boolean
}

export default function LandingPage({
  heroImageUrl,
  artistName,
  heroImageUnoptimized,
}: LandingPageProps) {
  const { lang, setLang, t } = useI18n()
  const [pdfOpen, setPdfOpen] = useState(false)
  const [navOpen, setNavOpen] = useState(false)
  const pubNarrow = useMediaQuery('(max-width: 767px)')

  useEffect(() => {
    void trackView('/', document.referrer || null, null, getOrCreatePublicVisitorId())
  }, [])

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { width: 100%; min-height: 100dvh; overflow-x: hidden; overflow-y: auto; }
        body { background: #edeae4; font-family: var(--font-ui, 'Sofia Sans', ui-sans-serif, system-ui, sans-serif); color: #9a9690; }
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
          font-weight: 400;
        }
        .wordmark a { color: inherit; text-decoration: none; }
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
        .landing-nav-btn {
          display: none;
          position: absolute;
          top: max(clamp(10px, 2.8vh, 24px), env(safe-area-inset-top, 0px));
          left: 50%;
          transform: translateX(-50%);
          z-index: 50;
          font-size: clamp(7px, 1.4vmin, 9px);
          letter-spacing: clamp(1px, 0.3vmin, 2px);
          text-transform: uppercase;
          color: #6b6760;
          background: #edeae4;
          border: 1px solid #dedad4;
          padding: 8px 18px;
          cursor: pointer;
          font-family: inherit;
          font-weight: 600;
          min-height: 44px;
        }
        .landing-nav-btn:hover { border-color: #b0aca6; color: #3a3834; }
        @media (max-width: 767px) {
          .orb { display: none !important; }
          .landing-nav-btn { display: inline-flex; align-items: center; justify-content: center; }
        }
        @media (max-width: 767px) {
          html, body { overflow: hidden; height: 100dvh; }
          .wordmark { white-space: nowrap; font-size: 9px; letter-spacing: 2px; color: #6b6760; }
          .circle-wrap { --orbit: min(76vw, calc(100dvh - 110px), 520px); }
        }
      `}</style>

      <main
        className="stage pem-fadeIn pem-grain"
        style={pubNarrow ? { paddingBottom: 'calc(56px + env(safe-area-inset-bottom, 0px))' } : undefined}
      >
        <h1 className="wordmark">
          <Link href="/">{artistName}</Link>
        </h1>
        <button
          type="button"
          className="lang-toggle"
          style={{ display: pubNarrow ? 'none' : undefined }}
          onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')}
          aria-label={t('pub_aria_switch_language')}
        >
          {t(lang === 'fr' ? 'pub_lang_target_en' : 'pub_lang_target_fr')}
        </button>

        <button
          type="button"
          className="landing-nav-btn"
          style={{ display: pubNarrow ? 'none' : undefined }}
          onClick={() => setNavOpen(true)}
          aria-expanded={navOpen}
          aria-controls="landing-site-nav"
          aria-label={t('pub_aria_open_site_menu')}
        >
          {t('pub_menu_button')}
        </button>

        <nav className="circle-wrap" aria-label={t('pub_mobile_nav_heading')}>
          <WavingCircle
            src={heroImageUrl}
            alt={artistName}
            priority
            sizes="(max-width: 480px) min(42vmin, calc(100vw - 48px)), min(38vmin, 520px)"
            unoptimized={heroImageUnoptimized}
          />
          <Link href="/works" className="orb orb-top">
            {t('pub_works')}
          </Link>
          <Link href="/about" className="orb orb-left">
            {t('pub_about')}
          </Link>
          <Link href="/practice" className="orb orb-right">
            {t('pub_practice')}
          </Link>
          <Link href="/enquiry" className="orb orb-bottom">
            {t('pub_enquiry')}
          </Link>
        </nav>

        <button
          type="button"
          className="pdf-link"
          style={{ display: pubNarrow ? 'none' : undefined }}
          onClick={() => setPdfOpen(true)}
          aria-label={t('pub_aria_download_portfolio_pdf')}
        >
          [ {t('pub_portfolio_pdf_strip')} ]
        </button>

        <Link href="/hub" className="hub-link" style={{ display: pubNarrow ? 'none' : undefined }}>
          {t('pub_hub_link_strip')}
        </Link>
      </main>

      {pubNarrow && (
        <div
          data-testid="landing-mobile-toolbar"
          role="toolbar"
          aria-label={t('pub_mobile_nav_heading')}
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 200,
            display: 'flex',
            flexWrap: 'nowrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 4,
            paddingTop: 8,
            paddingRight: 'max(12px, env(safe-area-inset-right, 0px))',
            paddingBottom: 'max(8px, env(safe-area-inset-bottom, 0px))',
            paddingLeft: 'max(12px, env(safe-area-inset-left, 0px))',
            background: 'rgba(237, 234, 228, 0.96)',
            borderTop: '1px solid #dedad4',
            backdropFilter: 'blur(8px)',
          }}
        >
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            aria-expanded={navOpen}
            aria-controls="landing-site-nav"
            aria-label={t('pub_aria_open_site_menu')}
            style={{
              fontSize: 11, letterSpacing: 2, textTransform: 'uppercase',
              color: '#3a3834', background: 'none', border: 'none',
              padding: '10px 14px', minHeight: 44, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
            }}
          >
            {t('pub_menu_button')}
          </button>
          <button
            type="button"
            onClick={() => setPdfOpen(true)}
            aria-label={t('pub_aria_download_portfolio_pdf')}
            style={{
              fontSize: 11, letterSpacing: 2, textTransform: 'uppercase',
              color: '#3a3834', background: 'none', border: 'none',
              padding: '10px 12px', minHeight: 44, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
            }}
          >
            {t('pub_portfolio_pdf_strip')}
          </button>
          <button
            type="button"
            onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')}
            aria-label={t('pub_aria_switch_language')}
            style={{
              fontSize: 11, letterSpacing: 2, textTransform: 'uppercase',
              color: '#3a3834', background: 'none', border: 'none',
              padding: '10px 12px', minHeight: 44, minWidth: 44, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {t(lang === 'fr' ? 'pub_lang_target_en' : 'pub_lang_target_fr')}
          </button>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, padding: '4px 0' }}>
            <Link
              href="/hub"
              style={{
                fontSize: 8, letterSpacing: 1, textTransform: 'uppercase',
                color: '#b0aca6', textDecoration: 'none',
                padding: '4px 4px', display: 'inline-flex', alignItems: 'center',
                opacity: 0.55,
              }}
            >
              [ {t('pub_hub_short')} ]
            </Link>
            <span style={{ fontSize: 7, letterSpacing: 0.5, color: '#c0bdb7', whiteSpace: 'nowrap' }}>
              © {new Date().getFullYear()} the pem workshop
            </span>
          </div>
        </div>
      )}

      {navOpen && (
        <>
          <div
            role="presentation"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 300,
              background: 'rgba(26, 26, 26, 0.35)',
              backdropFilter: 'blur(4px)',
            }}
            onClick={() => setNavOpen(false)}
            onKeyDown={(e) => e.key === 'Escape' && setNavOpen(false)}
          />
          <nav
            id="landing-site-nav"
            aria-label={t('pub_aria_site_navigation_drawer')}
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              bottom: 0,
              zIndex: 301,
              width: 'min(320px, calc(100vw - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px)))',
              paddingTop: 'max(20px, env(safe-area-inset-top, 0px))',
              paddingBottom: 'max(20px, env(safe-area-inset-bottom, 0px))',
              paddingLeft: 20,
              paddingRight: 'max(20px, env(safe-area-inset-right, 0px))',
              background: '#edeae4',
              borderLeft: '1px solid #dedad4',
              boxShadow: '-10px 0 28px rgba(0,0,0,0.12)',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', color: '#b0aca6' }}>
                {t('pub_mobile_nav_heading')}
              </span>
              <button
                type="button"
                onClick={() => setNavOpen(false)}
                style={{
                  fontSize: 10,
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                  color: '#7a7670',
                  background: 'none',
                  border: '1px solid #dedad4',
                  padding: '8px 14px',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {t('close')}
              </button>
            </div>
            {(
              [
                ['/works', t('pub_works')],
                ['/about', t('pub_about')],
                ['/practice', t('pub_practice')],
                ['/enquiry', t('pub_enquiry')],
              ] as const
            ).map(([href, label]) => (
              <Link
                key={href}
                href={href}
                onClick={() => setNavOpen(false)}
                style={{
                  fontSize: 10,
                  letterSpacing: 2,
                  textTransform: 'uppercase',
                  color: '#5a5650',
                  textDecoration: 'none',
                  padding: '14px 8px',
                  borderBottom: '1px solid #e8e4de',
                }}
              >
                {label}
              </Link>
            ))}
            <button
              type="button"
              onClick={() => {
                setNavOpen(false)
                setPdfOpen(true)
              }}
              style={{
                marginTop: 12,
                fontSize: 10,
                letterSpacing: 1,
                textTransform: 'uppercase',
                color: '#6b6760',
                background: 'none',
                border: '1px solid #dedad4',
                padding: '12px 14px',
                cursor: 'pointer',
                fontFamily: 'inherit',
                textAlign: 'left',
              }}
            >
              {t('pub_portfolio_pdf_strip')}
            </button>
            <Link
              href="/hub"
              onClick={() => setNavOpen(false)}
              style={{
                marginTop: 8,
                fontSize: 10,
                letterSpacing: 2,
                textTransform: 'uppercase',
                color: '#8a8680',
                textDecoration: 'none',
                padding: '14px 8px',
              }}
            >
              {t('pub_hub_short')}
            </Link>
          </nav>
        </>
      )}

      <LandingPdfPopup open={pdfOpen} onClose={() => setPdfOpen(false)} />
    </>
  )
}
