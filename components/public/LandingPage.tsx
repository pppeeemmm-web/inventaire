'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import WavingCircle from '@/components/public/WavingCircle'
import { useI18n } from '@/lib/i18n/context'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { getOrCreatePublicVisitorId } from '@/lib/public-visitor-id'
import { trackView } from '@/lib/track'
import {
  DEFAULT_NAV_ORDER,
  landingInlineNavRoutes,
} from '@/lib/site-block-visibility'
import {
  landingChromeTextShadowNow,
  LANDING_SHADOW_TICK_MS,
  type LandingChromeTextShadow,
  type LandingShadowTuning,
} from '@/lib/landing-text-shadow'
import type { CSSProperties } from 'react'
import HeroRenderer, { type HeroFields } from '@/lib/site-blocks/hero/HeroRenderer'
import IdentityRenderer, { type IdentityFields } from '@/lib/site-blocks/identity/IdentityRenderer'
import { LandingHeroCtx, type LandingHeroCtxValue } from '@/lib/site-blocks/hero/LandingHeroCtx'
import { resolveKnobs, DEFAULT_KNOBS_CONFIG } from '@/lib/site-blocks'
import { applyCircadianToKnobs } from '@/lib/circadian-knobs'
import { LandingAtomicClock } from './LandingAtomicClock'
import type { Block, KnobsConfig } from '@/lib/portfolio-config-types'
import type { KnobValues } from '@/lib/site-blocks/knob-types'

/** Hub entry dot on public landing — visual only; name from i18n aria-label. */
const LANDING_HUB_DOT_PX = 7
const LANDING_HUB_TAP_MIN_PX = 44

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
  heroWhiteKey: boolean
  shadowTuning: LandingShadowTuning
  hiddenNavRoutes?: string[]
  navOrder?: string[]
  /** Registry blocks for the landing page — drives HeroRenderer + IdentityRenderer. */
  landingBlocks?: Block[]
  /** Site knobs config — resolved for 'landing' page and circadian-applied each tick. */
  knobs?: KnobsConfig
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
  heroWhiteKey,
  shadowTuning,
  hiddenNavRoutes = [],
  navOrder,
  landingBlocks,
  knobs,
}: LandingPageProps) {
  const { lang, setLang, t } = useI18n()
  const [navOpen, setNavOpen] = useState(false)
  const [chromeShadow, setChromeShadow] = useState<LandingChromeTextShadow>(() =>
    landingChromeTextShadowNow(new Date(), { tuning: shadowTuning }),
  )
  const pubNarrow = useMediaQuery('(max-width: 767px)')
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const hiddenSet = useMemo(() => new Set(hiddenNavRoutes), [hiddenNavRoutes])

  const order = navOrder ?? [...DEFAULT_NAV_ORDER]
  const inlineNavRoutes = useMemo(
    () => landingInlineNavRoutes(order, hiddenNavRoutes),
    [order, hiddenNavRoutes],
  )

  // ── §4.1 Block registry ────────────────────────────────────────────────────
  const heroBlock = useMemo(() => landingBlocks?.find(b => b.kind === 'hero'), [landingBlocks])
  const identityBlock = useMemo(() => landingBlocks?.find(b => b.kind === 'identity'), [landingBlocks])

  // ── §4.2 Circadian knobs ───────────────────────────────────────────────────
  const resolvedBase = useMemo(
    () => resolveKnobs(knobs ?? DEFAULT_KNOBS_CONFIG, 'landing'),
    [knobs],
  )
  // Start from the static base so SSR and the first client render match — applying
  // circadian here (new Date()) caused a hydration mismatch that made the page
  // flash/reset. Circadian is applied post-mount by the tick effect below.
  const [effectiveKnobs, setEffectiveKnobs] = useState<KnobValues>(resolvedBase)

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

  // §4.5 — a11y knobs: sync type zoom + high contrast to html root
  useEffect(() => {
    const root = document.documentElement
    const { type_size_step, high_contrast } = effectiveKnobs.a11y
    if (type_size_step !== 1) {
      root.style.setProperty('--pem-root-zoom', String(type_size_step))
    } else {
      root.style.removeProperty('--pem-root-zoom')
    }
    if (high_contrast) {
      root.dataset.highContrast = 'true'
    } else {
      delete root.dataset.highContrast
    }
    return () => {
      root.style.removeProperty('--pem-root-zoom')
      delete root.dataset.highContrast
    }
  }, [effectiveKnobs.a11y])

  useEffect(() => {
    const apply = () => {
      const now = new Date()
      setChromeShadow(
        landingChromeTextShadowNow(now, {
          compact: window.matchMedia('(max-width: 767px)').matches,
          reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
          tuning: shadowTuning,
        }),
      )
      // §4.2 — circadian knobs: update effective knobs on each shadow tick
      setEffectiveKnobs(
        applyCircadianToKnobs(resolvedBase, now.getHours() * 60 + now.getMinutes()),
      )
    }
    apply()
    const tick = window.setInterval(apply, LANDING_SHADOW_TICK_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') apply()
    }
    document.addEventListener('visibilitychange', onVisible)
    const mqNarrow = window.matchMedia('(max-width: 767px)')
    const mqMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    mqNarrow.addEventListener('change', apply)
    mqMotion.addEventListener('change', apply)
    return () => {
      window.clearInterval(tick)
      document.removeEventListener('visibilitychange', onVisible)
      mqNarrow.removeEventListener('change', apply)
      mqMotion.removeEventListener('change', apply)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shadowTuning.topTintHex, shadowTuning.bottomTintHex, shadowTuning.heroBevelPx, resolvedBase])

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
      heroDiscCastFilter={chromeShadow.heroDiscCastFilter}
      heroWhiteKey={heroWhiteKey}
      heroBackdropCss={landingBackgroundCss}
    />
  )

  // ── §4.1 / §4.2 Context value ──────────────────────────────────────────────
  const ctxValue: LandingHeroCtxValue = {
    heroImageUrl,
    heroImageUnoptimized,
    heroGlossEnabled,
    heroGlossBackground,
    heroGlossMixBlendMode,
    heroWhiteKey,
    heroBackdropCss: landingBackgroundCss,
    heroDiscCastFilter: chromeShadow.heroDiscCastFilter,
    heroLinked,
    artistName,
    heroCaptionFr,
    heroCaptionEn,
    landingChromeText,
    landingBodyMutedText,
    landingBodyText,
    pubNarrow,
    effectiveKnobs,
  }

  return (
    <LandingHeroCtx.Provider value={ctxValue}>
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
          overflow-x: visible;
          overflow-y: auto;
          isolation: isolate;
        }
        .landing-center {
          display: flex; flex-direction: column; align-items: center;
          max-width: 100%; padding: 0 12px;
          gap: clamp(22px, 4vh, 36px);
          position: relative;
          z-index: 1;
          pointer-events: none;
        }
        .landing-center a, .landing-center button { pointer-events: auto; }
        .landing-chrome-shadow {
          text-shadow: var(--landing-chrome-text-shadow);
          transition: text-shadow 1.4s ease;
        }
        .landing-body-shadow {
          text-shadow: var(--landing-chrome-text-shadow-soft);
          transition: text-shadow 1.4s ease;
        }
        .wordmark {
          position: absolute;
          top: max(clamp(12px, 3vh, 28px), env(safe-area-inset-top, 0px));
          left: max(clamp(12px, 3vw, 32px), env(safe-area-inset-left, 0px));
          font-size: clamp(7px, 1.4vmin, 9px); letter-spacing: clamp(1.5px, 0.35vmin, 3px); text-transform: uppercase;
          color: ${landingChromeText}; text-decoration: none;
          padding: 10px 8px;
          padding-inline-start: calc(8px + var(--landing-shadow-pad-inline-start, 0px));
          min-height: 44px; display: inline-flex; align-items: center;
          font-weight: 400;
          overflow: visible;
          z-index: 30;
        }
        .wordmark a { color: inherit; text-decoration: none; }
        .lang-toggle {
          position: absolute;
          top: max(clamp(10px, 2.8vh, 24px), env(safe-area-inset-top, 0px));
          right: max(clamp(12px, 3vw, 32px), env(safe-area-inset-right, 0px));
          font-size: clamp(7px, 1.4vmin, 9px); letter-spacing: clamp(1px, 0.3vmin, 2px); text-transform: uppercase;
          color: ${landingChromeText}; background: rgba(255,255,255,0.35); border: 1px solid ${landingChromeBorder};
          padding: 4px 10px;
          padding-inline-end: calc(10px + var(--landing-shadow-pad-inline-end, 0px));
          cursor: pointer; transition: all .15s; font-family: inherit;
          min-height: 44px; min-width: 44px; display: inline-flex; align-items: center; justify-content: center;
          overflow: visible;
          z-index: 30;
        }
        .lang-toggle:hover { color: ${landingChromeTextHover}; border-color: ${landingChromeTextHover}; }
        .hero-orbit-wrap {
          position: relative;
          flex-shrink: 0;
          z-index: 0;
          overflow: visible;
          pointer-events: auto;
          /* Pendulum Y-rotate + skew + long drop-shadow paint outside the box — reserve space for caption. */
          --hero-cast-reserve: clamp(48px, 9vmin, 88px);
          padding-bottom: var(--hero-cast-reserve);
          margin-bottom: clamp(4px, 1vh, 12px);
          --hero-base: min(68dvh, 68vw);
          --hero-cap-v: calc(100dvh - 360px);
          --hero-cap-h: calc(100vw - 96px);
          --hero-size: min(var(--hero-base), var(--hero-cap-h), var(--hero-cap-v), 780px);
          width: var(--hero-size);
          height: var(--hero-size);
          box-sizing: content-box;
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
          margin-top: clamp(4px, 1vh, 12px);
          flex-shrink: 0;
          position: relative;
          z-index: 12;
          pointer-events: auto;
          max-width: min(520px, 90vw);
          text-align: center;
          isolation: isolate;
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
          z-index: 10;
          pointer-events: auto;
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
          color: ${landingBodyMutedText};
          text-decoration: none;
          opacity: 0.52;
          transition: color 0.2s, opacity 0.2s;
          min-height: ${LANDING_HUB_TAP_MIN_PX}px;
          min-width: ${LANDING_HUB_TAP_MIN_PX}px;
          padding: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          box-sizing: border-box;
        }
        .hub-link--corner {
          position: absolute;
          bottom: max(clamp(12px, 3vh, 32px), env(safe-area-inset-bottom, 0px));
          right: max(clamp(14px, 4vw, 40px), env(safe-area-inset-right, 0px));
          z-index: 30;
        }
        .hub-dot {
          width: ${LANDING_HUB_DOT_PX}px;
          height: ${LANDING_HUB_DOT_PX}px;
          border-radius: 50%;
          background: currentColor;
          flex-shrink: 0;
        }
        .hub-link:hover {
          opacity: 0.72 !important;
          color: ${landingBodyText} !important;
        }
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
        .landing-drawer-link {
          font-size: 10px; letter-spacing: 2px; text-transform: uppercase;
          color: #5a5650; text-decoration: none; padding: 14px 8px;
          border-bottom: 1px solid #e8e4de;
        }
        .landing-drawer-heading {
          font-size: 9px; letter-spacing: 3px; text-transform: uppercase; color: #b0aca6;
        }
        .landing-drawer-close {
          font-size: 10px; letter-spacing: 1px; text-transform: uppercase;
          color: #7a7670; background: none; border: 1px solid #dedad4;
          padding: 8px 14px; cursor: pointer; font-family: inherit;
        }
        .landing-drawer-hub {
          margin-top: 8px; font-size: 10px; letter-spacing: 2px; text-transform: uppercase;
          color: #8a8680; text-decoration: none; padding: 14px 8px;
        }
        @media (prefers-reduced-motion: reduce) {
          .landing-chrome-shadow, .landing-body-shadow { transition: color 0.15s, border-color 0.15s, opacity 0.3s !important; }
          .wordmark, .lang-toggle, .landing-nav-btn { transition: color 0.15s, border-color 0.15s, opacity 0.3s !important; }
        }
        @media (max-width: 767px) {
          .landing-inline-nav { display: none !important; }
          .landing-nav-btn { display: inline-flex; align-items: center; justify-content: center; }
        }
        @media (max-width: 767px) {
          html, body { overflow: hidden; height: 100dvh; }
          .wordmark { white-space: nowrap; font-size: 9px; letter-spacing: 2px; }
          .landing-center {
            gap: clamp(18px, 3.5vh, 28px);
            max-height: calc(100dvh - 100px);
          }
          .hero-orbit-wrap {
            --hero-cast-reserve: clamp(40px, 10vw, 64px);
            --hero-base: min(64vw, calc(100dvh - 380px));
            --hero-cap-v: calc(100dvh - 380px);
            --hero-cap-h: calc(100vw - 48px);
          }
        }
      `}</style>

      <main
        className="stage pem-fadeIn pem-grain"
        style={{
          '--landing-chrome-text-shadow': chromeShadow.chrome,
          '--landing-chrome-text-shadow-soft': chromeShadow.chromeSoft,
          '--landing-shadow-pad-inline-start': `${chromeShadow.padInlineStart}px`,
          '--landing-shadow-pad-inline-end': `${chromeShadow.padInlineEnd}px`,
          ...(pubNarrow ? { paddingBottom: 'calc(56px + env(safe-area-inset-bottom, 0px))' } : {}),
        } as CSSProperties}
      >
        {/* §4.2 — circadian atmosphere tint overlay (renders only when tint_opacity > 0) */}
        {effectiveKnobs.atm.tint_opacity > 0 ? (
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              background: `linear-gradient(180deg, ${effectiveKnobs.atm.sky_top}, ${effectiveKnobs.atm.sky_bottom})`,
              opacity: effectiveKnobs.atm.tint_opacity,
              pointerEvents: 'none',
              zIndex: 0,
            }}
          />
        ) : null}

        <h1 className="wordmark landing-chrome-shadow">
          {identityBlock && identityBlock.visible !== false ? (
            <IdentityRenderer
              block={identityBlock}
              fields={identityBlock.fields as IdentityFields}
              ctx={{ page: 'landing', lang }}
            />
          ) : (
            <Link href="/">{artistName}</Link>
          )}
        </h1>
        <button
          type="button"
          className="lang-toggle landing-body-shadow"
          style={{ display: pubNarrow ? 'none' : undefined }}
          onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')}
          aria-label={t('pub_aria_switch_language')}
        >
          {t(lang === 'fr' ? 'pub_lang_target_en' : 'pub_lang_target_fr')}
        </button>

        <button
          type="button"
          className="landing-nav-btn landing-body-shadow"
          style={{ display: pubNarrow ? 'none' : undefined }}
          onClick={() => setNavOpen(true)}
          aria-expanded={navOpen}
          aria-controls="landing-site-nav"
          aria-label={t('pub_aria_open_site_menu')}
        >
          {t('pub_menu_button')}
        </button>

        <div className="landing-center">
          {/* §4.1 — registry-driven hero (HeroRenderer reads LandingHeroCtx) */}
          {heroBlock && heroBlock.visible !== false ? (
            <HeroRenderer
              block={heroBlock}
              fields={heroBlock.fields as HeroFields}
              ctx={{ page: 'landing', lang }}
            />
          ) : (
            /* Legacy fallback — used when no hero block is present */
            <>
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
                <p className="hero-caption landing-body-shadow">{heroCaption}</p>
              ) : null}
            </>
          )}

          {inlineNavRoutes.length > 0 ? (
            <nav className="landing-inline-nav" aria-label={t('pub_landing_footer_nav_aria')}>
              {inlineNavRoutes.map(href => {
                const labelKey = ROUTE_LABEL_KEYS[href]
                if (!labelKey) return null
                return (
                  <Link
                    key={href}
                    href={href}
                    className="landing-inline-link landing-body-shadow"
                    data-testid={href === '/enquiry' ? 'landing-enquiry-link' : undefined}
                  >
                    {t(labelKey)}
                  </Link>
                )
              })}
            </nav>
          ) : null}
        </div>

        <Link
          href="/hub"
          className="hub-link hub-link--corner landing-body-shadow"
          style={{ display: pubNarrow ? 'none' : undefined }}
          aria-label={t('pub_hub_short')}
          title={t('pub_hub_short')}
        >
          <span className="hub-dot" aria-hidden="true" />
        </Link>
      </main>

      {/* Visitor's local time as units of vibration — bottom-left chrome,
          desktop only (mobile toolbar owns the bottom edge on narrow). */}
      <div
        className="landing-chrome-shadow"
        style={{
          position: 'fixed',
          bottom: 'max(14px, env(safe-area-inset-bottom, 0px))',
          left: 'max(16px, env(safe-area-inset-left, 0px))',
          zIndex: 150,
          color: '#3a3834',
          pointerEvents: 'none',
          display: pubNarrow ? 'none' : undefined,
        }}
      >
        <LandingAtomicClock />
      </div>

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
            className="landing-body-shadow"
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
            onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')}
            aria-label={t('pub_aria_switch_language')}
            className="landing-body-shadow"
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
              className="hub-link landing-body-shadow"
              aria-label={t('pub_hub_short')}
              title={t('pub_hub_short')}
            >
              <span className="hub-dot" aria-hidden="true" />
            </Link>
            <span
              className="landing-body-shadow"
              style={{ fontSize: 7, letterSpacing: 0.5, color: '#c0bdb7', whiteSpace: 'nowrap' }}
            >
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
              <span className="landing-drawer-heading landing-body-shadow">
                {t('pub_mobile_nav_heading')}
              </span>
              <button
                type="button"
                className="landing-drawer-close landing-body-shadow"
                onClick={() => setNavOpen(false)}
              >
                {t('close')}
              </button>
            </div>
            {drawerLinks.map(([href, label]) => (
              <Link
                key={href}
                href={href}
                onClick={() => setNavOpen(false)}
                className="landing-drawer-link landing-body-shadow"
              >
                {label}
              </Link>
            ))}
            <Link
              href="/hub"
              onClick={() => setNavOpen(false)}
              className="landing-drawer-hub landing-body-shadow"
            >
              {t('pub_hub_short')}
            </Link>
          </nav>
        </>
      )}
    </>
    </LandingHeroCtx.Provider>
  )
}
