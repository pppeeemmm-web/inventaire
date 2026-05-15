-- Verb 8 — extra columns on studio_task.
-- PREREQUISITE: run supabase/sql/studio_task.sql first (creates the table + RLS).
-- Error 42P01 "relation studio_task does not exist" → run studio_task.sql, then re-run this file.
-- After both: npm run gen:types

alter table public.studio_task
  add column if not exists kind text not null default 'studio',
  add column if not exists severity text check (severity in ('low', 'medium', 'high', 'critical')),
  add column if not exists photo_r2_key text;

comment on column public.studio_task.kind is 'studio | field | …';
comment on column public.studio_task.severity is 'low | medium | high | critical';
comment on column public.studio_task.photo_r2_key is 'Dedicated R2 key for issue photo (replaces [photo:…] in details when set).';
