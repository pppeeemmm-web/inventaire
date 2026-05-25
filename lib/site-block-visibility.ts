import type { SiteBlock } from './portfolio-config-types'

/** Map block kinds to public nav routes. hero/identity have no route. */
const BLOCK_ROUTE: Record<string, string | null> = {
  works_modes: '/works',
  about:       '/about',
  practice:    '/practice',
  hero:        null,
  identity:    null,
}

export const DEFAULT_NAV_ORDER = ['/works', '/about', '/practice', '/enquiry'] as const

export function hiddenNavRoutes(blocks: SiteBlock[]): string[] {
  const routes: string[] = []
  for (const b of blocks) {
    if (!b.visible) {
      const route = BLOCK_ROUTE[b.kind]
      if (route) routes.push(route)
    }
  }
  return routes
}

export function orderedNavRoutes(blocks: SiteBlock[]): string[] {
  const routes: string[] = []
  for (const b of blocks) {
    if (b.visible) {
      const route = BLOCK_ROUTE[b.kind]
      if (route) routes.push(route)
    }
  }
  if (!routes.includes('/enquiry')) routes.push('/enquiry')
  return routes
}

const LANDING_SATELLITE_ROUTES = ['/about', '/practice'] as const
export type LandingOrbPosition = 'orb-top' | 'orb-left' | 'orb-right'

const ORB_POSITIONS: LandingOrbPosition[] = ['orb-top', 'orb-left', 'orb-right']

/** Hero circle links to /works when the works_modes block is visible. */
export function isLandingHeroLinked(blocks: SiteBlock[]): boolean {
  return blocks.some(b => b.kind === 'works_modes' && b.visible)
}

/**
 * Footer row on landing: block order, enquiry last.
 * Skips /works when the hero disc already links there.
 */
export function landingInlineNavRoutes(
  navOrder: string[],
  hiddenNavRoutes: string[],
  heroLinked: boolean,
): string[] {
  const hidden = new Set(hiddenNavRoutes)
  const visible = navOrder.filter(h => !hidden.has(h))
  const withoutWorks = heroLinked ? visible.filter(h => h !== '/works') : visible
  const rest = withoutWorks.filter(h => h !== '/enquiry')
  const enquiry = withoutWorks.includes('/enquiry') ? (['/enquiry'] as const) : []
  return [...rest, ...enquiry]
}

/** About / Practice satellite orbs around the hero (not Works or Enquiry). */
export function landingSatelliteRoutes(
  blocks: SiteBlock[],
  navOrder?: string[],
): string[] {
  const order = navOrder ?? orderedNavRoutes(blocks)
  return order.filter(
    (r): r is (typeof LANDING_SATELLITE_ROUTES)[number] =>
      (LANDING_SATELLITE_ROUTES as readonly string[]).includes(r),
  )
}

/** Map satellite routes to orb CSS classes (order follows pub-tab block order). */
export function assignOrbPositions(
  routes: string[],
): { href: string; position: LandingOrbPosition }[] {
  return routes.slice(0, ORB_POSITIONS.length).map((href, i) => ({
    href,
    position: ORB_POSITIONS[i],
  }))
}
