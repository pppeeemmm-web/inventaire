/**
 * "www.thepemworkshop.com 3.0" — what's new for the team (owner 2026-11-03). Shown once as a popup
 * in the Atelier (until "Don't show again") and listed in Kaizen → What's new. Copy:
 * `lib/i18n/messages/whats-new.messages.ts` (`wn_<id>_t` / `wn_<id>_d`). Browser-safe.
 *
 * A new release = a new `WHATS_NEW_RELEASE` (people who dismissed the old one see it again) + items.
 */

// '3.0.1' (2026-11-03 pm): safety, destroyed / lost, live list rows, earlier items not yet listed.
// '3.0.2' (2026-11-03 eve): owner / custodian / address (docs/WORK_CUSTODY_MODEL.md).
// '3.0.3' (2026-11-12): owner bug review fixes (docs/archive/AUDIT_2026-11.md).
// '3.0.4' (2026-11-12): journal entries (docs/archive/JOURNAL_PROPOSAL.md step 1).
// '3.0.5' (2026-11-12): journal on the phone + dictation; drawer field mode (step 2).
// '3.0.6' (2026-11-12): readable entries, concept link, new-work field mode, AI link suggestions (step 5).
// '3.0.7' (2026-11-12): the Journal is the main field tab (Hub → today; capture inside the day).
// '3.0.8' (2026-11-12): capture tidy (apply bar, photo first, location folded).
// '3.0.9' (2026-11-12): journal in search + Constellation, stricter ✦, phone drawer + inventory tidy.
// '3.1.0' (2026-11-12): work → contact bounce, Production ✎ fix, journal day tidy + ✦ day counts.
// '3.1.1' (2026-11-13): wider search text for works (supabase/sql/oeuvre_search_text_wider.sql).
// '3.1.2' (2026-11-13): sign out + password, see again, contact pop-up, #1234 preview, work links, Production drag-back, voice transcripts.
// '3.1.3' (2026-11-13): Journal date jump; See again link type + direction; Inventory loupe; batch modify.
// '3.1.4' (2026-11-13): Inventory table tidy (compact prices, two-line cells, narrow layout); Overview thumbnails open the work.
export const WHATS_NEW_RELEASE = '3.1.4'

/** localStorage: release the viewer chose not to see again. sessionStorage: already shown this visit. */
export const WHATS_NEW_DISMISSED_KEY = 'pem_whats_new_dismissed'
export const WHATS_NEW_SEEN_SESSION_KEY = 'pem_whats_new_seen_session'

export type WhatsNewItem = { id: string; day: string }

/** Newest first. Team-facing features only (admin-only tools are in the admin guide). */
export const WHATS_NEW_ITEMS: readonly WhatsNewItem[] = [
  { id: 'inventory_table_tidy', day: '2026-11-13' },
  { id: 'batch_modify', day: '2026-11-13' },
  { id: 'inventory_loupe', day: '2026-11-13' },
  { id: 'see_again_link_type', day: '2026-11-13' },
  { id: 'journal_jump', day: '2026-11-13' },
  { id: 'sign_out', day: '2026-11-13' },
  { id: 'see_again', day: '2026-11-13' },
  { id: 'contact_popup', day: '2026-11-13' },
  { id: 'work_preview', day: '2026-11-13' },
  { id: 'work_links', day: '2026-11-13' },
  { id: 'production_drag', day: '2026-11-13' },
  { id: 'voice_transcripts', day: '2026-11-13' },
  { id: 'search_wider', day: '2026-11-13' },
  { id: 'contact_bounce', day: '2026-11-12' },
  { id: 'journal_day_tidy', day: '2026-11-12' },
  { id: 'journal_search', day: '2026-11-12' },
  { id: 'phone_drawer_inventory', day: '2026-11-12' },
  { id: 'capture_tidy', day: '2026-11-12' },
  { id: 'journal_main_tab', day: '2026-11-12' },
  { id: 'journal_links', day: '2026-11-12' },
  { id: 'new_work_field_mode', day: '2026-11-12' },
  { id: 'drawer_field_mode', day: '2026-11-12' },
  { id: 'journal_phone', day: '2026-11-12' },
  { id: 'journal_entries', day: '2026-11-12' },
  { id: 'drawer_lists', day: '2026-11-12' },
  { id: 'history_fields', day: '2026-11-12' },
  { id: 'production_cascade', day: '2026-11-12' },
  { id: 'vault_types', day: '2026-11-12' },
  { id: 'period_start', day: '2026-11-12' },
  { id: 'single_address', day: '2026-11-12' },
  { id: 'fate_report_only', day: '2026-11-12' },
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
