-- Supabase linter: unindexed_foreign_keys (lint 0001)
-- Idempotent. Run in SQL editor after related table migrations.
-- Does not drop "unused" indexes — see comment block at end.

-- calendar_event_link.suivi_etape_id (process_id already has calendar_event_link_process_idx)
create index if not exists calendar_event_link_etape_idx
  on public.calendar_event_link (suivi_etape_id)
  where suivi_etape_id is not null;

-- oeuvre_versions.changed_by
create index if not exists idx_oeuvre_versions_changed_by
  on public.oeuvre_versions (changed_by)
  where changed_by is not null;

-- pending_changes (status+created_at index exists; FK columns need own indexes)
create index if not exists idx_pending_changes_oeuvre_id
  on public.pending_changes (oeuvre_id);

create index if not exists idx_pending_changes_author_id
  on public.pending_changes (author_id)
  where author_id is not null;

create index if not exists idx_pending_changes_reviewer_id
  on public.pending_changes (reviewer_id)
  where reviewer_id is not null;

-- private_link / working_group: legacy tables (no create-table script in repo)
create index if not exists idx_private_link_created_by
  on public.private_link (created_by)
  where created_by is not null;

create index if not exists idx_working_group_created_by
  on public.working_group (created_by)
  where created_by is not null;

-- studio_task.author_id
create index if not exists idx_studio_task_author_id
  on public.studio_task (author_id)
  where author_id is not null;

-- voice_note.process_id / sketchbook_id (oeuvre_id already indexed)
create index if not exists idx_voice_note_process_id
  on public.voice_note (process_id)
  where process_id is not null;

create index if not exists idx_voice_note_sketchbook_id
  on public.voice_note (sketchbook_id)
  where sketchbook_id is not null;

-- ── unused_index (lint 0005) ────────────────────────────────────────────────
-- Do NOT drop indexes from the linter report without production evidence:
--   • pg_stat_user_indexes resets; "never used" ≠ dead forever.
--   • Field/calendar/broadcast/sketchbook paths are low volume or recent.
--   • idx_oeuvres_deleted_at supports soft-delete filters even if stats lag.
-- Revisit drops only after EXPLAIN on real queries + a full stats cycle.
