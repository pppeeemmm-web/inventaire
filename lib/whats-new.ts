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
// '3.1.5' (2026-11-13): Batch modify redesigned as a mixer (B2); Overview one-glance dashboard (B1).
// '3.1.6' (2026-11-14): AI descriptions in the work card, rated for usefulness (A2); place + weather recorded by themselves on the phone (A4).
// '3.1.7' (2026-11-14): periods by date + place made per work (A3).
// '3.1.8' (2026-11-14): export with a live preview + Labels + CSV/XLSX tabs (B3); money signal ■ when net < 0 (D3); Constellation arrows; export images by screen / print, 72 / 150 / 300 dpi, colour / black & white.
// '3.1.9' (2026-11-14): export options on one screen (no scroll), frame size apart from pixels, light black & white.
// '3.1.10' (2026-11-14): places continued — add a place from the work card; a work's place follows its period; Inventory place line + filter.
// '3.1.11' (2026-11-14): voice notes record first — saved on stop, details after, clear saved / not-saved feedback.
// '3.1.12' (2026-11-14): place suggested from the field session (nearest saved place, ≤ 2 km).
// '3.1.13' (2026-11-14): « Historique de création » — dated lines, each with a place (replaces the single place).
// '3.1.14' (2026-11-14): session photos waiting (not on the work yet) shown; production start / end as year, month or day; new / found in the new-work form.
// '3.1.15' (2026-11-14): desktop sidebar — Catalogue moved up, Inventaire inside it.
// '3.1.16' (2026-11-14): Inventory says « en cours » (not « — ») for a work in production with no year; phone works get their 2026 / Marseille; duplicate-work fix.
// '3.1.17' (2026-11-15): slideshow from the selection + saved slideshows (« Diaporamas » in Catalogue).
// '3.1.18' (2026-11-15): slideshow export — animated GIF or full-colour frames (ZIP), frame sizes, whole / fill.
// '3.1.19' (2026-11-15): QR code on export labels (opens the work in the Atelier).
// '3.1.20' (2026-11-15): bug batch 1 — PC transcripts in Notes, unsaved-transcript guard, pivots collapsed, Vault buttons + text preview, « 1 photo ».
// '3.1.21' (2026-11-15): palette names a work's main colours (white chalk, a touch of red), every cover recomputed.
// '3.1.22' (2026-11-15): Exhibitions list shows every event type, dated or not (TODO B3).
// '3.1.23' (2026-11-15): Exhibitions = accepted exhibitions only (applications stay in Pipeline); 3.1.22 item rewritten.
// '3.1.24' (2026-11-15): exhibition floor plan — place a work group, moves kept, double-click opens the work (TODO B4).
// '3.1.25' (2026-11-15): Constellation blank canvas + selection kept for the browser session (TODO B5).
// '3.1.26' (2026-11-15): Constellation eraser removes one whole object per click (stroke, text, else link) (TODO B6).
// '3.1.27' (2026-11-16): labels print the work's image; text cut to one line, never overlapping (TODO B7).
// '3.1.28' (2026-11-16): parallel batch 1 — Inventory / work card quick fixes (B9), small round GIFs (21), Constellation undo / marquee / arrows / how-to (20).
// '3.1.29' (2026-11-16): batch 2 — work card + Overview open in one read (18), Journal ✦ loupe (B12), Constellation panel (B11).
// '3.1.30' (2026-11-16): the rest of the catalogue in one request (TODO 19).
// '3.1.31' (2026-11-16): a ?work= link opens one card (Inventory panel); Overview counts right from the start (TODO 18).
// '3.1.32' (2026-11-16): R3 step 1 — the work card re-laid out (top block, Création / Objet, Replié / Développé).
// '3.1.33' (2026-11-17): R3 step 2 — card Objet: logistics, commission, presentation gates, hover captions; Montée kept on save.
// '3.1.34' (2026-11-17): R3 step 3 — phone recording screen (Nouvelle œuvre / Reprise), card rules, 44 px phone taps.
// '3.1.35' (2026-11-17): phone long-press preview closes on a tap (B13); small GIF captions fit the frame (B14).
// '3.1.36' (2026-11-17): R2 — « Aujourd'hui » light phone page; one input bar on every phone screen.
// '3.1.37' (2026-11-17): R2 — the Hub opens on « Aujourd'hui » (streamed: bar first), « Bureau » fold; Journal quick row → the bar on the phone.
// '3.1.38' (2026-11-17): R2 — « À revoir » actions on Aujourd'hui, one at a time; « Plus tard » (back after 7 days).
// '3.1.39' (2026-11-17): Triage — swipe, 6 s to undo (shared swipe deck).
export const WHATS_NEW_RELEASE = '3.1.39'
/** Popup on Atelier open — off for now (Pem 2026-11-14: "remove the pop up what's new for now"). The list stays in Kaizen → What's new. */
export const WHATS_NEW_POPUP = false

/** localStorage: release the viewer chose not to see again. sessionStorage: already shown this visit. */
export const WHATS_NEW_DISMISSED_KEY = 'pem_whats_new_dismissed'
export const WHATS_NEW_SEEN_SESSION_KEY = 'pem_whats_new_seen_session'

export type WhatsNewItem = { id: string; day: string }

/** Newest first. Team-facing features only (admin-only tools are in the admin guide). */
export const WHATS_NEW_ITEMS: readonly WhatsNewItem[] = [
  { id: 'triage_swipe_undo', day: '2026-11-17' },
  { id: 'see_again_later', day: '2026-11-17' },
  { id: 'hub_opens_today', day: '2026-11-17' },
  { id: 'phone_today_bar', day: '2026-11-17' },
  { id: 'loupe_gif_caption_fixes', day: '2026-11-17' },
  { id: 'work_record_phone', day: '2026-11-17' },
  { id: 'work_card_objet', day: '2026-11-17' },
  { id: 'work_card_r3', day: '2026-11-16' },
  { id: 'work_link_one_card', day: '2026-11-16' },
  { id: 'overview_counts_server', day: '2026-11-16' },
  { id: 'catalogue_one_call', day: '2026-11-16' },
  { id: 'open_one_read', day: '2026-11-16' },
  { id: 'journal_suggestion_loupe', day: '2026-11-16' },
  { id: 'constellation_tools', day: '2026-11-16' },
  { id: 'slideshow_small_gifs', day: '2026-11-16' },
  { id: 'inventory_card_fixes', day: '2026-11-16' },
  { id: 'labels_image', day: '2026-11-16' },
  { id: 'constellation_eraser', day: '2026-11-15' },
  { id: 'constellation_session', day: '2026-11-15' },
  { id: 'floor_plan_groups', day: '2026-11-15' },
  { id: 'exhibitions_all', day: '2026-11-15' },
  { id: 'palette_main_colours', day: '2026-11-15' },
  { id: 'bug_batch_1', day: '2026-11-15' },
  { id: 'labels_qr', day: '2026-11-15' },
  { id: 'slideshow_export', day: '2026-11-15' },
  { id: 'slideshow', day: '2026-11-15' },
  { id: 'inventory_states', day: '2026-11-14' },
  { id: 'inventory_year_in_progress', day: '2026-11-14' },
  { id: 'sidebar_catalogue_up', day: '2026-11-14' },
  { id: 'staged_photos_dates', day: '2026-11-14' },
  { id: 'journal_phone_tidy', day: '2026-11-14' },
  { id: 'creation_history', day: '2026-11-14' },
  { id: 'place_from_session', day: '2026-11-14' },
  { id: 'voice_record_first', day: '2026-11-14' },
  { id: 'place_from_period', day: '2026-11-14' },
  { id: 'place_add_from_card', day: '2026-11-14' },
  { id: 'export_panel_light', day: '2026-11-14' },
  { id: 'export_image_quality', day: '2026-11-14' },
  { id: 'constellation_arrows', day: '2026-11-14' },
  { id: 'export_preview', day: '2026-11-14' },
  { id: 'periods_dates_places', day: '2026-11-14' },
  { id: 'field_context_auto', day: '2026-11-14' },
  { id: 'ai_description_rating', day: '2026-11-14' },
  { id: 'overview_dashboard', day: '2026-11-13' },
  { id: 'batch_modify_mixer', day: '2026-11-13' },
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
