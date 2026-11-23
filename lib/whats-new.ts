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
// '3.1.40' (2026-11-17): Œuvre and Vocal sheets on the phone bar; the Fil (admin) + Audit « Retirés du Fil ».
// '3.1.41' (2026-11-17): Idées — Petite / Recherche, Graine · Pousse · Mûre, discussions, « Proposer une idée ».
// '3.1.42' (2026-11-17): Aujourd'hui — step between days, ✦ rows, folds; phone menu Aujourd'hui · Fil · Idées.
// '3.1.43' (2026-11-17): work notes as lines (author + date), « Pour vous » on Overview; readable names for changed fields.
// '3.1.44' (2026-11-17): R2 speed — Aujourd'hui opens from the phone's last copy, then refreshes.
// '3.1.45' (2026-11-17): R1 step 7 — voice notes in the Journal (« Relier… »), Notes screen gone, quieter ✦.
// '3.1.46' (2026-11-17): R7 — « Commandes » in Sales, one paper per order in the Vault.
// '3.1.47' (2026-11-17): lighter pages (one language sent), public site first fixes.
// '3.1.48' (2026-11-17): a destroyed / lost work — card shows the fate, report writes the history; R7 step 2 — every way of starting a sale / deposit / loan / gift makes an order.
// '3.1.49' (2026-11-17): Archive = the shelf — catalogued first, tasks paused, back out by choice.
// '3.1.50' (2026-11-17): R7 closes — « Confié » orders, 14-day return on every sale with the money held until definitive; work state follows one rule (WORK_RULES batch 1).
// '3.1.51' (2026-11-17): work rules batch 2 — history kept on save, photo validation asks first, batch edit needs a photo, Audit → Règles.
// '3.1.52' (2026-11-18): R6 — one « Expositions & événements » tab on the orders; What's new copy loads on open (lighter phone pages).
// '3.1.63' (2026-11-18): business-card capture works outdoors (Live Text first, AI optional with a limit, photo kept).
// '3.1.64' (2026-11-18): stress-test fixes — no double sale / payment, shipments follow orders, Sales past 200 orders.
// '3.1.65' (2026-11-18): in-app Aide — team guide FR + EN, chapters 1–2 (scope, getting started).
// '3.1.66' (2026-11-18): Aide — Œuvres + Production how-to cards; QR label link opens the work again.
// '3.1.67' (2026-11-18): Aide — day & Journal, Ideas, Orders, Logistics, Events chapters.
// '3.1.68' (2026-11-18): Aide — Contacts, Supplies, Reports, Public, the rules, glossary: team guide complete.
// '3.1.76' (2026-11-19): contact names one way (DUPONT Marie in lists, sorted by family name); phone fixes (R&D at 375, 44 px taps), Overview « envois à faire », card photo sent once.
// '3.1.77' (2026-11-19): a work card open in two tabs (or by two people) no longer undoes the other save.
// '3.1.78' (2026-11-19): a retouched image shows everywhere straight away (new file per retouch).
// '3.1.79' (2026-11-19): Thèmes — copy a theme as a working group, or a group as a theme; portfolio PDF from a working group.
// '3.1.80' (2026-11-19): private contacts hidden from the team's lists and searches, still named where linked.
// '3.1.85' (2026-11-20): a voice note sent to a new idea brings its transcript; Bureau IA « Lancer » starts the PC at the click.
// '3.1.86' (2026-11-21): a text beside each inspiration photo, added or changed later (desk + phone); hover shows the photo large.
// '3.1.87' (2026-11-21): a day holding only an inspiration photo is listed in the Journal; search finds a photo by its text (desk ⌘K, phone ☰).
// '3.1.88' (2026-11-21): the work card saves field by field.
// '3.1.89' (2026-11-22): « Corriger » a Journal transcript; a deleted contact no longer breaks a restore or an approval; a save landing at the same instant as another change writes nothing.
// '3.1.90' (2026-11-23): saving a contact keeps the works, orders and shipments linked to its addresses.
// '3.1.91' (2026-11-23): the Journal as one stream of days (to try), captures kept offline, voice note in the Journal at once, labels / suite / another day.
// '3.1.92' (2026-11-23): the Journal opens on the stream of days for everyone (?stream=0 keeps the old screens).
// '3.1.93' (2026-11-23): Idées become a tree fed by the Journal.
// '3.1.94' (2026-11-23): the Journal day shows its ideas (planted, moved, reworked, grafted).
// '3.1.95' (2026-11-23): phone new work — « Tous les champs » keeps what was typed.
// '3.1.96' (2026-11-23): 🎤 inside an idea; idea changes in Mois / Années and on the old day page; Overview ideas open the idea.
// '3.1.97' (2026-11-23): a contact saved from two places no longer overwrites; Journal links open, « Relier » lists sorted.
// '3.1.98' (2026-11-23): addresses become places — a floor / flat, one building shared, removing an address ends the link only; works flagged when their place is no longer linked to their holder.
// '3.1.99' (2026-11-23): phone menu — theme switch beside FR / EN, Suggestions, Œuvres en ligne, Site public.
export const WHATS_NEW_RELEASE = '3.1.99'
/** Popup on Atelier open — off for now (Pem 2026-11-14: "remove the pop up what's new for now"). The list stays in Kaizen → What's new. */
export const WHATS_NEW_POPUP = false

/** localStorage: release the viewer chose not to see again. sessionStorage: already shown this visit. */
export const WHATS_NEW_DISMISSED_KEY = 'pem_whats_new_dismissed'
export const WHATS_NEW_SEEN_SESSION_KEY = 'pem_whats_new_seen_session'

/**
 * `spot` (TODO 24, Pem 2026-11-18 « dots + voice card »): the Atelier tab where the change sits. A team member
 * (not an admin) sees a dot on that menu entry and, on opening the tab, one line « Nouveau : <title> » until
 * « Compris ». Only items with a spot, newer than WHATS_NEW_DOT_DAYS. Seen = per browser (`lib/whats-new-dots.ts`).
 */
/** `admin`: shown to admins only (admin screens: Bureau IA, Audit…); everything else is for everyone. */
export type WhatsNewItem = { id: string; day: string; spot?: string; admin?: boolean }

/** The items this viewer sees: admins see every item, the team only the team-facing ones. */
export function whatsNewItemsFor(isAdmin: boolean): readonly WhatsNewItem[] {
  return isAdmin ? WHATS_NEW_ITEMS : WHATS_NEW_ITEMS.filter((i) => !i.admin)
}

/** A dot shows only for items this recent. */
export const WHATS_NEW_DOT_DAYS = 21

/** Newest first. Team-facing features only (admin-only tools are in the admin guide). */
export const WHATS_NEW_ITEMS: readonly WhatsNewItem[] = [
  { id: 'phone_menu_theme', day: '2026-11-23' },
  { id: 'addresses_are_places', day: '2026-11-23', spot: 'contacts' },
  { id: 'contact_save_door', day: '2026-11-23', spot: 'contacts' },
  { id: 'journal_links_sorted', day: '2026-11-23', spot: 'journal' },
  { id: 'idea_mic', day: '2026-11-23', spot: 'concepts' },
  { id: 'work_record_all_fields', day: '2026-11-23', spot: 'inventory' },
  { id: 'journal_idea_lines', day: '2026-11-23', spot: 'journal' },
  { id: 'ideas_tree', day: '2026-11-23', spot: 'concepts' },
  { id: 'idea_from_moment', day: '2026-11-23', spot: 'journal' },
  { id: 'journal_stream_default', day: '2026-11-23', spot: 'journal' },
  { id: 'journal_stream', day: '2026-11-23', spot: 'journal' },
  { id: 'capture_offline', day: '2026-11-23', spot: 'journal' },
  { id: 'voice_entry_at_once', day: '2026-11-23', spot: 'journal' },
  { id: 'journal_labels_suite_move', day: '2026-11-23', spot: 'journal' },
  { id: 'contact_save_keeps_addresses', day: '2026-11-23', spot: 'contacts' },
  { id: 'journal_correct', day: '2026-11-22', spot: 'journal', admin: true },
  { id: 'deleted_contact_restore', day: '2026-11-22', spot: 'inventory', admin: true },
  { id: 'work_save_field_by_field', day: '2026-11-21', spot: 'inventory', admin: true },
  { id: 'inspiration_found', day: '2026-11-21', spot: 'journal' },
  { id: 'inspiration_text', day: '2026-11-21', spot: 'journal' },
  { id: 'voice_note_idea_text', day: '2026-11-20', spot: 'journal' },
  { id: 'ai_desk_launch_click', day: '2026-11-20', spot: 'ai', admin: true },
  { id: 'journal_day_once', day: '2026-11-19', spot: 'journal' },
  { id: 'contact_merge_safe', day: '2026-11-19' },
  { id: 'contact_links_row', day: '2026-11-19', spot: 'contacts' },
  { id: 'admin_ai_on_demand', day: '2026-11-19', spot: 'ai', admin: true },
  { id: 'admin_ai_cards', day: '2026-11-19', spot: 'ai', admin: true },
  { id: 'private_contacts_pickers', day: '2026-11-19', spot: 'contacts' },
  { id: 'pdf_from_group', day: '2026-11-19', spot: 'portfolio' },
  { id: 'theme_group_copy', day: '2026-11-19', spot: 'themes' },
  { id: 'retouch_shows_now', day: '2026-11-19', spot: 'inventory' },
  { id: 'two_tabs_safe', day: '2026-11-19', spot: 'inventory' },
  { id: 'contact_names_one_way', day: '2026-11-19', spot: 'contacts' },
  { id: 'phone_fixes_1119', day: '2026-11-19', spot: 'overview' },
  { id: 'admin_ai_desk', day: '2026-11-18', spot: 'ai', admin: true },
  { id: 'admin_works_bin', day: '2026-11-18', spot: 'audit', admin: true },
  { id: 'admin_approval_conflicts', day: '2026-11-18', spot: 'audit', admin: true },
  { id: 'layout_titles_phone_bar', day: '2026-11-18', spot: 'inventory' },
  { id: 'proposals_reasons', day: '2026-11-18', spot: 'overview' },
  { id: 'contact_delete_safe', day: '2026-11-18', spot: 'contacts' },
  { id: 'small_slips_1118', day: '2026-11-18', spot: 'stock' },
  { id: 'aide_complete', day: '2026-11-18', spot: 'aide' },
  { id: 'map_back_card_names', day: '2026-11-18', spot: 'map' },
  { id: 'contacts_badge_vault_tree', day: '2026-11-18', spot: 'contacts' },
  { id: 'help_pdf_and_panel', day: '2026-11-18', spot: 'aide' },
  { id: 'bible_to_aide', day: '2026-11-18', spot: 'aide' },
  { id: 'sign_out_this_device', day: '2026-11-18' },
  { id: 'scroll_keeps_numbers', day: '2026-11-18', spot: 'sales' },
  { id: 'light_controls_contact_popup', day: '2026-11-18', spot: 'inventory' },
  { id: 'aide_team_complete', day: '2026-11-18', spot: 'aide' },
  { id: 'aide_day_orders_events', day: '2026-11-18', spot: 'aide' },
  { id: 'aide_works_production', day: '2026-11-18', spot: 'aide' },
  { id: 'qr_link_opens_work', day: '2026-11-18', spot: 'inventory' },
  { id: 'aide_guides', day: '2026-11-18', spot: 'aide' },
  { id: 'orders_double_click', day: '2026-11-18', spot: 'sales' },
  { id: 'shipments_follow_orders', day: '2026-11-18', spot: 'logistics' },
  { id: 'card_live_text', day: '2026-11-18', spot: 'contacts' },
  { id: 'paid_from_payments', day: '2026-11-18', spot: 'sales' },
  { id: 'order_address_return', day: '2026-11-18', spot: 'sales' },
  { id: 'search_by_number', day: '2026-11-18' },
  { id: 'faster_tabs', day: '2026-11-18' },
  { id: 'phone_nav', day: '2026-11-18' },
  { id: 'share_kit', day: '2026-11-18', spot: 'themes' },
  { id: 'record_draft', day: '2026-11-18' },
  { id: 'old_comments_gone', day: '2026-11-18', spot: 'inventory' },
  { id: 'order_leftovers', day: '2026-11-18', spot: 'sales' },
  { id: 'ideas_visible', day: '2026-11-18', spot: 'concepts' },
  { id: 'expense_year', day: '2026-11-18', spot: 'fiscal' },
  { id: 'ideas_one_place', day: '2026-11-18', spot: 'concepts' },
  { id: 'supply_orders', day: '2026-11-18', spot: 'stock' },
  { id: 'order_calendar', day: '2026-11-18', spot: 'sales' },
  { id: 'order_cascade', day: '2026-11-18', spot: 'logistics' },
  { id: 'theme_notes', day: '2026-11-18', spot: 'themes' },
  { id: 'news_where_it_happened', day: '2026-11-18' },
  { id: 'inputs_review', day: '2026-11-18', spot: 'journal' },
  { id: 'image_room_stolen', day: '2026-11-18', spot: 'inventory' },
  { id: 'orders_review', day: '2026-11-18', spot: 'sales' },
  { id: 'events_tab', day: '2026-11-18', spot: 'exhibitions' },
  { id: 'previews_everywhere', day: '2026-11-17' },
  { id: 'work_rules_checked', day: '2026-11-17' },
  { id: 'work_state_one_rule', day: '2026-11-17' },
  { id: 'return_14_days_confie', day: '2026-11-17' },
  { id: 'orders_values_gift_handover', day: '2026-11-17' },
  { id: 'timeline_map_previews', day: '2026-11-17' },
  { id: 'archive_shelf', day: '2026-11-17' },
  { id: 'orders_everywhere', day: '2026-11-17' },
  { id: 'fate_card_history', day: '2026-11-17' },
  { id: 'lighter_pages_site', day: '2026-11-17' },
  { id: 'orders_papers', day: '2026-11-17' },
  { id: 'voice_in_journal', day: '2026-11-17' },
  { id: 'today_cached_copy', day: '2026-11-17' },
  { id: 'work_note_lines', day: '2026-11-17' },
  { id: 'field_names_readable', day: '2026-11-17' },
  { id: 'today_days_menu', day: '2026-11-17' },
  { id: 'ideas_team', day: '2026-11-17' },
  { id: 'phone_work_voice_sheets', day: '2026-11-17' },
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
