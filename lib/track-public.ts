import { trackView } from '@/lib/track'
import { getOrCreatePublicVisitorId, isPublicCountingOptedOut } from '@/lib/public-visitor-id'

/**
 * Browser-only: count one public-site page view, unless this browser chose « Ne pas être compté·e ».
 * The opt-out flag lives in localStorage, which the server action `trackView` cannot read, so the skip is here.
 */
export function trackPublicView(path: string, referrer: string | null = null): void {
  if (typeof window === 'undefined' || isPublicCountingOptedOut()) return
  void trackView(path, referrer, null, getOrCreatePublicVisitorId())
}
