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
