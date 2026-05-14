-- Field Verb 2 — voice_note (audio + transcript; optional links).
-- Requires public.is_team(), public.is_admin(), sketchbook table. Run after sketchbook.sql.

create table if not exists public.voice_note (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default timezone('utc', now()),
  updated_at      timestamptz not null default timezone('utc', now()),
  user_id         uuid not null references auth.users (id) default auth.uid(),
  kind            text not null default 'memo'
                  check (kind in ('memo', 'dictation', 'meeting', 'field')),
  bucket          text not null default 'general'
                  check (bucket in ('terrain', 'studio', 'commercial', 'general')),
  subject         text null,
  transcript      text not null default '',
  audio_r2_key    text null,
  audio_mime      text null,
  duration_ms     integer null,
  oeuvre_id       integer null references public."Oeuvres" ("OeuvreID") on delete set null,
  process_id      uuid null references public.suivi_process (id) on delete set null,
  sketchbook_id   uuid null references public.sketchbook (id) on delete set null
);

create index if not exists idx_voice_note_user_created
  on public.voice_note (user_id, created_at desc);

create index if not exists idx_voice_note_oeuvre
  on public.voice_note (oeuvre_id)
  where oeuvre_id is not null;

comment on table public.voice_note is
  'Field voice / dictation notes: optional R2 audio + transcript; optional links to œuvre, pipeline, sketchbook.';

drop trigger if exists voice_note_touch on public.voice_note;
create or replace function public.voice_note_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

create trigger voice_note_touch
  before update on public.voice_note
  for each row execute function public.voice_note_touch();

alter table public.voice_note enable row level security;

drop policy if exists "voice_note_team_select" on public.voice_note;
create policy "voice_note_team_select"
  on public.voice_note
  for select
  to authenticated
  using (is_team() and (user_id = auth.uid() or is_admin()));

drop policy if exists "voice_note_team_insert" on public.voice_note;
create policy "voice_note_team_insert"
  on public.voice_note
  for insert
  to authenticated
  with check (is_team() and user_id = auth.uid());

drop policy if exists "voice_note_team_update" on public.voice_note;
create policy "voice_note_team_update"
  on public.voice_note
  for update
  to authenticated
  using (is_team() and (user_id = auth.uid() or is_admin()))
  with check (is_team() and (user_id = auth.uid() or is_admin()));

drop policy if exists "voice_note_team_delete" on public.voice_note;
create policy "voice_note_team_delete"
  on public.voice_note
  for delete
  to authenticated
  using (is_team() and (user_id = auth.uid() or is_admin()));

grant select, insert, update, delete on public.voice_note to authenticated;
