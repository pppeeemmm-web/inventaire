import {
  ATELIER_SEGMENTED_TAB_ROUTES,
  type SegmentedAtelierTab,
} from '@/lib/atelier/tab-routes'

const PATH_TO_TAB = new Map<string, SegmentedAtelierTab>(
  Object.entries(ATELIER_SEGMENTED_TAB_ROUTES).map(([tab, path]) => [
    path,
    tab as SegmentedAtelierTab,
  ]),
)

/** Map `/atelier/<segment>` to portal tab id (Slice 3 routes). */
export function routeTabFromPathname(pathname: string): SegmentedAtelierTab | undefined {
  return PATH_TO_TAB.get(pathname)
}
