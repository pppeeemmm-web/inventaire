import {
  resolveLandingBackground,
  type LandingBackgroundResolved,
} from '@/lib/landing-background'
import {
  resolveNavBarStyle,
  resolvePublicPageTheme,
  type PublicPageKey,
} from '@/lib/page-background'
import type { LandingConfig, SiteBlock } from '@/lib/portfolio-config-types'

export type { PublicPageKey }

/** Public-site chrome + page background (from portfolio landing config). */
export type PublicSiteTheme = LandingBackgroundResolved

export function resolvePublicSiteTheme(
  landing?: Partial<LandingConfig> | null,
): PublicSiteTheme {
  return resolveLandingBackground(landing)
}

export function resolvePublicSiteThemeForPage(
  page: PublicPageKey,
  landing?: Partial<LandingConfig> | null,
  blocks?: SiteBlock[],
): PublicSiteTheme {
  return resolvePublicPageTheme(page, landing, blocks)
}

export function resolvePublicNavBarStyle(
  page: PublicPageKey,
  blocks?: SiteBlock[],
): 'transparent' | 'bar' {
  return resolveNavBarStyle(page, blocks)
}

/** Base `html` / `body` background and text colours. */
export function publicSiteBaseCss(theme: PublicSiteTheme): string {
  return `
    html, body {
      background: ${theme.backgroundCss};
      color: ${theme.bodyMutedText};
      font-family: var(--font-ui, 'Sofia Sans', ui-sans-serif, system-ui, sans-serif);
    }
  `
}

export type PublicNavBarOptions = {
  /** No solid bar or bottom rule — gradient runs to the viewport top. */
  transparent?: boolean
}

/** Sticky top nav bar (PublicNav prefixes: w, a, p, e, …). */
export function publicNavBarCss(
  prefix: string,
  theme: PublicSiteTheme,
  opts?: PublicNavBarOptions,
): string {
  const p = prefix
  const navSurface = opts?.transparent
    ? `background: transparent; backdrop-filter: none; border-bottom: none;`
    : `background: ${theme.toolbarBackground}; backdrop-filter: blur(8px); border-bottom: 1px solid ${theme.chromeBorder};`
  return `
    .${p}-nav {
      ${navSurface}
    }
    .${p}-logo { color: ${theme.chromeText}; }
    .${p}-navlink {
      color: ${theme.bodyMutedText};
    }
    .${p}-navlink:hover, .${p}-navlink.active { color: ${theme.bodyText}; }
    .${p}-lang {
      color: ${theme.chromeText};
      border-color: ${theme.chromeBorder};
    }
    .${p}-lang:hover {
      color: ${theme.chromeTextHover};
      border-color: ${theme.chromeTextHover};
    }
  `
}
