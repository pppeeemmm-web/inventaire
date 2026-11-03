/**
 * "www.thepemworkshop.com 3.0" — what's new for the team (owner 2026-11-03). Shown once as a popup
 * in the Atelier (until "Don't show again") and listed in Kaizen → What's new. Copy:
 * `lib/i18n/messages/whats-new.messages.ts` (`wn_<id>_t` / `wn_<id>_d`). Browser-safe.
 *
 * A new release = a new `WHATS_NEW_RELEASE` (people who dismissed the old one see it again) + items.
 */

// '3.0.1' (2026-11-03 pm): safety, destroyed / lost, live list rows, earlier items not yet listed.
// '3.0.2' (2026-11-03 eve): owner / custodian / address (docs/WORK_CUSTODY_MODEL.md).
export const WHATS_NEW_RELEASE = '3.0.2'

/** localStorage: release the viewer chose not to see again. sessionStorage: already shown this visit. */
export const WHATS_NEW_DISMISSED_KEY = 'pem_whats_new_dismissed'
export const WHATS_NEW_SEEN_SESSION_KEY = 'pem_whats_new_seen_session'

export type WhatsNewItem = { id: string; day: string }

/** Newest first. Team-facing features only (admin-only tools are in the admin guide). */
export const WHATS_NEW_ITEMS: readonly WhatsNewItem[] = [
  { id: 'custody', day: '2026-11-03' },
  { id: 'safety', day: '2026-11-03' },
  { id: 'lifetime_rules', day: '2026-11-03' },
  { id: 'destroyed_lost', day: '2026-11-03' },
  { id: 'live_list', day: '2026-11-03' },
  { id: 'private_archive_gone', day: '2026-11-03' },
  { id: 'status_colours', day: '2026-11-03' },
  { id: 'rules', day: '2026-11-03' },
  { id: 'period_source', day: '2026-11-03' },
  { id: 'bulk_source', day: '2026-11-03' },
  { id: 'fiscal', day: '2026-11-03' },
  { id: 'qr', day: '2026-11-03' },
  { id: 'kaizen', day: '2026-11-02' },
  { id: 'constats', day: '2026-11-02' },
  { id: 'reports', day: '2026-11-02' },
  { id: 'colours', day: '2026-11-02' },
  { id: 'notes', day: '2026-11-02' },
  { id: 'sidebar', day: '2026-11-02' },
  { id: 'drawer_clearer', day: '2026-11-02' },
  { id: 'production_dates', day: '2026-11-01' },
  { id: 'holder_address', day: '2026-11-01' },
  { id: 'image_download', day: '2026-11-01' },
  { id: 'overview', day: '2026-11-01' },
  { id: 'planning_zoom', day: '2026-11-01' },
  { id: 'map_filters', day: '2026-11-01' },
  { id: 'no_field_wipe', day: '2026-10-31' },
]
