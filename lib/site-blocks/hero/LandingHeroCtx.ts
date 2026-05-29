'use client'

/**
 * React context threaded through LandingPage so HeroRenderer and
 * IdentityRenderer can access visual settings (gloss, shadow, bevel,
 * theme colours, circadian knobs) without prop-drilling through the
 * block-renderer interface.
 *
 * Provider: components/public/LandingPage.tsx
 * Consumers: HeroRenderer.tsx, IdentityRenderer.tsx
 */

import { createContext, useContext } from 'react'
import type { CSSProperties } from 'react'
import type { KnobValues } from '@/lib/site-blocks/knob-types'

export interface LandingHeroCtxValue {
  // ── Image + visual ────────────────────────────────────────────────
  heroImageUrl: string
  heroImageUnoptimized: boolean
  heroGlossEnabled: boolean
  heroGlossBackground: string
  heroGlossMixBlendMode: CSSProperties['mixBlendMode']
  heroWhiteKey: boolean
  heroBackdropCss: string
  /** Time-varying stacked drop-shadow filter (from chromeShadow tick). */
  heroDiscCastFilter: string
  heroLinked: boolean
  // ── Fallback text values (used when block fields are empty) ───────
  artistName: string
  heroCaptionFr: string
  heroCaptionEn: string
  // ── Theme colours ─────────────────────────────────────────────────
  landingChromeText: string
  landingBodyMutedText: string
  landingBodyText: string
  // ── Layout helpers ────────────────────────────────────────────────
  pubNarrow: boolean
  // ── §4.2 Circadian knobs (resolved + applied) ─────────────────────
  /** Effective knobs for the landing page after cascade + circadian. */
  effectiveKnobs: KnobValues
}

export const LandingHeroCtx = createContext<LandingHeroCtxValue | null>(null)

export function useLandingHeroCtx(): LandingHeroCtxValue {
  const v = useContext(LandingHeroCtx)
  if (!v) throw new Error('useLandingHeroCtx: must be inside LandingPage')
  return v
}
