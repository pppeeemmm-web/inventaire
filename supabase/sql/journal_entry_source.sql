-- Journal entries: where a transcript came from (journal step 4). NOT APPLIED — needs owner GO.
--
-- A transcript made by a machine is an ADDED entry (kind voice / handwriting, unverified). These
-- columns say what it was made from and by what, so the day page can show the audio or the page
-- photo next to it and mark it ✦ AI:
--   voice_note_id  the voice note whose audio was transcribed
--   source_key     R2 key of the page photo (handwriting)
--   engine         'faster-whisper large-v3', 'qwen2.5vl:7b', … (null = written by a person)
-- All three are fixed at insert (append-only guard below). One transcript per note and engine.
--
-- Decision inside this file: `on delete restrict` — a voice note that has a transcript can no
-- longer be deleted from Notes (the audio is the reference). Say so if you want it otherwise.

alter table public.journal_entry
  add column if not exists voice_note_id uuid references public.voice_note (id) on delete restrict,
  add column if not exists source_key    text,
  add column if not exists engine        text;

create unique index if not exists journal_entry_voice_engine_uq
  on public.journal_entry (voice_note_id, engine) where voice_note_id is not null;

create or replace function public.journal_entry_guard()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'journal_no_delete' using errcode = '42501',
      detail = 'Journal entries are never deleted; an admin can hide one.';
  end if;

  if new.body is distinct from old.body
     or new.kind is distinct from old.kind
     or new.event_on is distinct from old.event_on
     or new.event_precision is distinct from old.event_precision
     or new.created_at is distinct from old.created_at
     or new.author_id is distinct from old.author_id
     or new.provenance is distinct from old.provenance
     or new.corrects_id is distinct from old.corrects_id
     or new.voice_note_id is distinct from old.voice_note_id
     or new.source_key is distinct from old.source_key
     or new.engine is distinct from old.engine then
    raise exception 'journal_append_only' using errcode = '23514',
      detail = 'An entry is never edited; write a new entry that corrects it.';
  end if;

  if (new.visibility is distinct from old.visibility
      or new.hidden_at is distinct from old.hidden_at
      or new.hidden_by is distinct from old.hidden_by)
     and auth.uid() is not null and not is_admin() then
    raise exception 'journal_admin_only' using errcode = '42501',
      detail = 'Only an admin changes visibility or hides an entry.';
  end if;

  return new;
end;
$$;

revoke execute on function public.journal_entry_guard() from public, anon, authenticated;
