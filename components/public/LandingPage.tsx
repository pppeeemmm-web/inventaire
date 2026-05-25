'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import WavingCircle from '@/components/public/WavingCircle'
import LandingPdfPopup from '@/components/portfolio/LandingPdfPopup'
import { useI18n } from '@/lib/i18n/context'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { getOrCreatePublicVisitorId } from '@/lib/public-visitor-id'
import { trackView } from '@/lib/track'
import {
  DEFAULT_NAV_ORDER,
  landingInlineNavRoutes,
} from '@/lib/site-block-visibility'
import type { CSSProperties } from 'react'

type LandingPageProps = {
  heroImageUrl: string
  artistName: string
  heroImageUnoptimized: boolean
  heroCaptionFr: string
  heroCaptionEn: string
  heroLinked: boolean
  landingBackgroundCss: string
  landingBottomHex: string
  landingToolbarBackground: string
  landingChromeText: string
  landingChromeTextHover: string
  landingChromeBorder: string
  landingBodyMutedText: string
  landingBodyText: string
  heroGlossEnabled: boolean
  heroGlossBackground: string
  heroGlossMixBlendMode: CSSProperties['mixBlendMode']
  heroBevelEnabled: boolean
  heroBevelBoxShadow: string
  hiddenNavRoutes?: string[]
  navOrder?: string[]
}

const ROUTE_LABEL_KEYS: Record<string, 'pub_works' | 'pub_about' | 'pub_practice' | 'pub_enquiry'> = {
  '/works': 'pub_works',
  '/about': 'pub_about',
  '/practice': 'pub_practice',
  '/enquiry': 'pub_enquiry',
}

export default function LandingPage({
  heroImageUrl,
  artistName,
  heroImageUnoptimized,
  heroCaptionFr,
  heroCaptionEn,
  heroLinked,
  landingBackgroundCss,
  landingBottomHex,
  landingToolbarBackground,
  landingChromeText,
  landingChromeTextHover,
  landingChromeBorder,
  landingBodyMutedText,
  landingBodyText,
  heroGlossEnabled,
  heroGlossBackground,
  heroGlossMixBlendMode,
  heroBevelEnabled,
  heroBevelBoxShadow,
  hiddenNavRoutes = [],
  navOrder,
}: LandingPageProps) {
  const { lang, setLang, t } = useI18n()
  const [pdfOpen, setPdfOpen] = useState(false)
  const [navOpen, setNavOpen] = useState(false)
  const pubNarrow = useMediaQuery('(max-width: 767px)')
  const hiddenSet = useMemo(() => new Set(hiddenNavRoutes), [hiddenNavRoutes])

  const order = navOrder ?? [...DEFAULT_NAV_ORDER]
  const inlineNavRoutes = useMemo(
    () => landingInlineNavRoutes(order, hiddenNavRoutes),
    [order, hiddenNavRoutes],
  )

  const heroCaption = lang === 'en'
    ? (heroCaptionEn || heroCaptionFr)
    : (heroCaptionFr || heroCaptionEn)

  const drawerLinks = useMemo(() => {
    const labels: Record<string, string> = {
      '/works': t('pub_works'),
      '/about': t('pub_about'),
      '/practice': t('pub_practice'),
      '/enquiry': t('pub_enquiry'),
    }
    return order
      .filter(href => !hiddenSet.has(href) && labels[href])
      .map(href => [href, labels[href]] as [string, string])
  }, [order, hiddenSet, t])

  /** Match displayed hero (~85vmin); avoid old 520px cap that forced a small src via next/image. */
  const heroSizes = pubNarrow
    ? '(max-width: 767px) min(80vw, 100vw)'
    : 'min(80vw, 80vh, 1200px)'

  useEffect(() => {
    void trackView('/', document.referrer || null, null, getOrCreatePublicVisitorId())
  }, [])

  const heroImage = (
    <WavingCircle
      src={heroImageUrl}
      alt={artistName}
      priority
      sizes={heroSizes}
      unoptimized={heroImageUnoptimized}
      glossEnabled={heroGlossEnabled}
      glossBackground={heroGlossBackground}
      glossMixBlendMode={heroGlossMixBlendMode}
      bevelEnabled={heroBevelEnabled}
      bevelBoxShadow={heroBevelBoxShadow}
    />
  )

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { width: 100%; min-height: 100dvh; overflow-x: hidden; overflow-y: auto; }
        body {
          background: ${landingBackgroundCss};
          font-family: var(--font-ui, 'Sofia Sans', ui-sans-serif, system-ui, sans-serif);
          color: ${landingBodyMutedText};
        }
        .stage {
          position: fixed; inset: 0; min-height: 100dvh;
          background: ${landingBackgroundCss};
          padding-top: env(safe-area-inset-top, 0px);
          padding-bottom: env(safe-area-inset-bottom, 0px);
          padding-left: env(safe-area-inset-left, 0px);
          padding-right: env(safe-area-inset-right, 0px);
          display: flex; align-items: center; justify-content: center;
          overflow-x: hidden;
          overflow-y: auto;
        }
        .landing-center {
          display: flex; flex-direction: column; align-items: center;
          max-width: 100%; padding: 0 12px;
          gap: clamp(14px, 2.5vh, 22px);
          position: relative;
          z-index: 1;
        }
        .wordmark {
          position: absolute;
          top: max(clamp(12px, 3vh, 28px), env(safe-area-inset-top, 0px));
          left: max(clamp(12px, 3vw, 32px), env(safe-area-inset-left, 0px));
          font-size: clamp(7px, 1.4vmin, 9px); letter-spacing: clamp(1.5px, 0.35vmin, 3px); text-transform: uppercase;
          color: ${landingChromeText}; text-decoration: none;
          text-shadow: 0 0 12px rgba(255,255,255,0.5), 0 1px 2px rgba(0,0,0,0.08);
          padding: 10px 8px; min-height: 44px; display: inline-flex; align-items: center;
          font-weight: 400;
        }
        .wordmark a { color: inherit; text-decoration: none; }
        .lang-toggle {
          position: absolute;
          top: max(clamp(10px, 2.8vh, 24px), env(safe-area-inset-top, 0px));
          right: max(clamp(12px, 3vw, 32px), env(safe-area-inset-right, 0px));
          font-size: clamp(7px, 1.4vmin, 9px); letter-spacing: clamp(1px, 0.3vmin, 2px); text-transform: uppercase;
          color: ${landingChromeText}; background: rgba(255,255,255,0.35); border: 1px solid ${landingChromeBorder};
          padding: 4px 10px; cursor: pointer; transition: all .15s; font-family: inherit;
          min-height: 44px; min-width: 44px; display: inline-flex; align-items: center; justify-content: center;
          text-shadow: 0 0 8px rgba(255,255,255,0.4);
        }
        .lang-toggle:hover { color: ${landingChromeTextHover}; border-color: ${landingChromeTextHover}; }
        .hero-orbit-wrap {
          position: relative;
          flex-shrink: 0;
          overflow: visible;
          --hero-base: max(80dvh, 80vw);
          --hero-cap-v: calc(100dvh - 220px);
          --hero-cap-h: calc(100vw - 48px);
          --hero-size: min(var(--hero-base), var(--hero-cap-h), var(--hero-cap-v), 900px);
          width: var(--hero-size);
          height: var(--hero-size);
        }
        .circle-wrap {
          position: relative;
          width: 100%;
          height: 100%;
        }
        .hero-hit {
          display: block; position: relative; width: 100%; height: 100%;
          text-decoration: none; color: inherit;
          outline-offset: 4px;
        }
        .hero-static { position: relative; width: 100%; height: 100%; }
        .hero-caption {
          margin: 0;
          flex-shrink: 0;
          position: relative;
          z-index: 5;
          max-width: min(520px, 90vw);
          text-align: center;
          font-size: clamp(8px, 1.5vmin, 10px);
          letter-spacing: clamp(0.5px, 0.2vmin, 1.5px);
          line-height: 1.6;
          color: ${landingBodyMutedText};
          font-style: italic;
        }
        .landing-inline-nav {
          margin: 0;
          flex-shrink: 0;
          position: relative;
          z-index: 5;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: center;
          gap: clamp(4px, 1.5vmin, 12px);
          max-width: min(96vw, 640px);
        }
        .landing-inline-link {
          font-size: clamp(8px, 2.5vmin, 10px);
          letter-spacing: clamp(1.5px, 0.35vmin, 3px);
          text-transform: uppercase;
          color: ${landingBodyText};
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 44px;
          min-width: 44px;
          padding: 8px clamp(10px, 2vmin, 18px);
          transition: color .25s;
          white-space: nowrap;
        }
        .landing-inline-link:hover { color: ${landingChromeTextHover}; }
        .hub-link {
          position: absolute;
          bottom: max(clamp(12px, 3vh, 32px), env(safe-area-inset-bottom, 0px));
          right: max(clamp(14px, 4vw, 40px), env(safe-area-inset-right, 0px));
          font-size: clamp(7px, 1.4vmin, 9px); letter-spacing: clamp(1px, 0.3vmin, 2px); text-transform: uppercase;
          color: ${landingBodyMutedText}; text-decoration: none; opacity: 0.85;
          transition: all 0.3s; font-weight: 600;
          min-height: 44px; padding: 10px 8px; display: inline-flex; align-items: center;
        }
        .hub-link:hover { opacity: 1 !important; color: ${landingChromeTextHover} !important; }
        .pdf-link {
          position: absolute;
          bottom: max(clamp(12px, 3vh, 32px), env(safe-area-inset-bottom, 0px));
          left: max(clamp(14px, 4vw, 40px), env(safe-area-inset-left, 0px));
          font-size: clamp(7px, 1.4vmin, 9px); letter-spacing: clamp(1px, 0.3vmin, 2px); text-transform: uppercase;
          color: ${landingBodyMutedText}; background: none; border: none;
          padding: 10px 8px; min-height: 44px;
          opacity: 0.7; transition: all 0.3s;
          font-family: inherit; font-weight: 600; cursor: pointer;
          display: inline-flex; align-items: center;
        }
        .pdf-link:hover { opacity: 1; color: ${landingChromeTextHover}; }
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
          color: ${landingChromeText};
          background: ${landingBottomHex};
          border: 1px solid ${landingChromeBorder};
          padding: 8px 18px;
          cursor: pointer;
          font-family: inherit;
          font-weight: 600;
          min-height: 44px;
        }
        .landing-nav-btn:hover { border-color: ${landingChromeBorder}; color: ${landingChromeTextHover}; }
        @media (max-width: 767px) {
          .landing-inline-nav { display: none !important; }
          .landing-nav-btn { display: inline-flex; align-items: center; justify-content: center; }
        }
        @media (max-width: 767px) {
          html, body { overflow: hidden; height: 100dvh; }
          .wordmark { white-space: nowrap; font-size: 9px; letter-spacing: 2px; }
          .landing-center {
            gap: 12px;
            max-height: calc(100dvh - 100px);
          }
          .hero-orbit-wrap {
            --hero-base: min(78vw, calc(100dvh - 280px));
            --hero-cap-v: calc(100dvh - 280px);
            --hero-cap-h: calc(100vw - 32px);
          }
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

        <div className="landing-center">
          <div className="hero-orbit-wrap">
            <nav className="circle-wrap" aria-label={t('pub_mobile_nav_heading')}>
              {heroLinked ? (
                <Link
                  href="/works"
                  className="hero-hit"
                  aria-label={t('pub_landing_hero_works_link_aria')}
                >
                  {heroImage}
                </Link>
              ) : (
                <div className="hero-static">{heroImage}</div>
              )}
            </nav>
          </div>

          {heroCaption.trim() ? (
            <p className="hero-caption">{heroCaption}</p>
          ) : null}

          {inlineNavRoutes.length > 0 ? (
            <nav className="landing-inline-nav" aria-label={t('pub_landing_footer_nav_aria')}>
              {inlineNavRoutes.map(href => {
                const labelKey = ROUTE_LABEL_KEYS[href]
                if (!labelKey) return null
                return (
                  <Link
                    key={href}
                    href={href}
                    className="landing-inline-link"
                    data-testid={href === '/enquiry' ? 'landing-enquiry-link' : undefined}
                  >
                    {t(labelKey)}
                  </Link>
                )
              })}
            </nav>
          ) : null}
        </div>

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
            background: landingToolbarBackground,
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
              background: landingBottomHex,
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
            {drawerLinks.map(([href, label]) => (
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
