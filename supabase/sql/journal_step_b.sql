-- Journal Step B, part 1 (design docs/design/2026-11-22/JournalDesign.md §5; Pem 2026-11-23 « Start Step B SQL »).
-- Three things, nothing moved, nothing deleted:
--   1. Labels beside an entry (journal_entry_label): several per entry, added and removed by the team; the
--      entry's own `kind` stays frozen as its origin.
--   2. Links from an entry to another entry (journal_entry_link.target_entry_id, relation 'suite' | 'cite'):
--      Delacroix's later remark written beside the note it answers.
--   3. Moving an entry to another day (Pem: « not too stiff, one action »): one door,
--      journal_move_entry(id, day, precision), for the author or an admin; it moves the entry and its
--      corrections together and keeps the old day in journal_entry_day_change. Text, author and the time it
--      was written stay frozen.
-- Not here: links to a person (waits for merge_contacts to repoint them — the repo file and the live function
-- differ) and an entry for every capture (part 2).
-- Proven on the throwaway copy first (scripts/stress), then live with Pem's OK.

begin;

-- ── 1. Labels ────────────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.journal_entry_label (
  id          bigint generated always as identity primary key,
  entry_id    bigint not null references public.journal_entry(id) on delete restrict,
  label       text   not null,
  created_by  uuid   not null default auth.uid(),
  created_at  timestamptz not null default now(),
  removed_at  timestamptz,
  removed_by  uuid,
  constraint journal_entry_label_label_ck check (label in ('process', 'materials', 'spark', 'trigger', 'reflection', 'note', 'idea', 'research')),
  constraint journal_entry_label_removed_ck check ((removed_at is null) = (removed_by is null))
);
-- One live label of each kind per entry; a removed one stays as history.
create unique index if not exists journal_entry_label_live_uq on public.journal_entry_label (entry_id, label) where removed_at is null;
create index if not exists journal_entry_label_label_idx on public.journal_entry_label (label) where removed_at is null;

alter table public.journal_entry_label enable row level security;

drop policy if exists journal_entry_label_select on public.journal_entry_label;
create policy journal_entry_label_select on public.journal_entry_label for select to authenticated
  using (is_team() and exists (select 1 from public.journal_entry e where e.id = journal_entry_label.entry_id));

drop policy if exists journal_entry_label_insert on public.journal_entry_label;
create policy journal_entry_label_insert on public.journal_entry_label for insert to authenticated
  with check (is_team() and created_by = (select auth.uid()) and removed_at is null
              and exists (select 1 from public.journal_entry e where e.id = journal_entry_label.entry_id));

-- Removing = setting removed_at / removed_by (the guard below refuses anything else).
drop policy if exists journal_entry_label_update on public.journal_entry_label;
create policy journal_entry_label_update on public.journal_entry_label for update to authenticated
  using (is_team() and exists (select 1 from public.journal_entry e where e.id = journal_entry_label.entry_id))
  with check (is_team() and removed_by = (select auth.uid()));

create or replace function public.journal_entry_label_guard()
returns trigger language plpgsql set search_path to 'public' as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'journal_no_delete' using errcode = '42501';
  end if;
  if new.entry_id is distinct from old.entry_id or new.label is distinct from old.label
     or new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at
     or old.removed_at is not null then
    raise exception 'journal_append_only' using errcode = '23514',
      detail = 'A label is only removed (once); add a new one instead of changing it.';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_journal_entry_label_guard on public.journal_entry_label;
create trigger trg_journal_entry_label_guard before update or delete on public.journal_entry_label
  for each row execute function public.journal_entry_label_guard();

-- Supabase's default privileges give new tables ALL (delete, truncate) to anon and authenticated: take them back.
revoke all on public.journal_entry_label from anon, authenticated, public;
grant select, insert, update on public.journal_entry_label to authenticated;

-- ── 2. Entry → entry links ───────────────────────────────────────────────────────────────────────────────
alter table public.journal_entry_link
  add column if not exists target_entry_id bigint references public.journal_entry(id) on delete restrict;

alter table public.journal_entry_link drop constraint if exists journal_entry_link_target_ck;
alter table public.journal_entry_link add constraint journal_entry_link_target_ck
  check (num_nonnulls(oeuvre_id, concept_id, target_entry_id) = 1);
alter table public.journal_entry_link drop constraint if exists journal_entry_link_entry_target_ck;
alter table public.journal_entry_link add constraint journal_entry_link_entry_target_ck
  check (target_entry_id is null or (target_entry_id <> entry_id and relation in ('suite', 'cite')));
create index if not exists journal_entry_link_target_entry_idx on public.journal_entry_link (target_entry_id) where target_entry_id is not null;

create or replace function public.journal_entry_link_guard()
returns trigger language plpgsql set search_path to 'public' as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'journal_no_delete' using errcode = '42501';
  end if;
  if new.entry_id is distinct from old.entry_id
     or new.oeuvre_id is distinct from old.oeuvre_id
     or new.concept_id is distinct from old.concept_id
     or new.target_entry_id is distinct from old.target_entry_id
     or new.relation is distinct from old.relation
     or new.proposed_by is distinct from old.proposed_by
     or new.created_by is distinct from old.created_by then
    raise exception 'journal_append_only' using errcode = '23514';
  end if;
  return new;
end;
$$;

-- ── 3. Moving an entry to another day ────────────────────────────────────────────────────────────────────
create table if not exists public.journal_entry_day_change (
  id             bigint generated always as identity primary key,
  entry_id       bigint not null references public.journal_entry(id) on delete restrict,
  from_day       date not null,
  from_precision text not null,
  to_day         date not null,
  to_precision   text not null,
  changed_by     uuid,
  changed_at     timestamptz not null default now()
);
create index if not exists journal_entry_day_change_entry_idx on public.journal_entry_day_change (entry_id);
alter table public.journal_entry_day_change enable row level security;
drop policy if exists journal_entry_day_change_select on public.journal_entry_day_change;
create policy journal_entry_day_change_select on public.journal_entry_day_change for select to authenticated
  using (is_team() and exists (select 1 from public.journal_entry e where e.id = journal_entry_day_change.entry_id));
revoke all on public.journal_entry_day_change from anon, authenticated, public;
grant select on public.journal_entry_day_change to authenticated;
-- Written only by journal_move_entry (security definer); no insert / update / delete for anyone else.

-- The entry guard: as before, except event_on / event_precision may change inside journal_move_entry
-- (transaction-local flag set by that door only).
create or replace function public.journal_entry_guard()
returns trigger language plpgsql set search_path to 'public' as $$
declare
  v_moving boolean := coalesce(current_setting('pem.journal_move', true), '') = 'on';
begin
  if tg_op = 'DELETE' then
    raise exception 'journal_no_delete' using errcode = '42501',
      detail = 'Journal entries are never deleted; an admin can hide one.';
  end if;

  if new.body is distinct from old.body
     or new.kind is distinct from old.kind
     or ((new.event_on is distinct from old.event_on or new.event_precision is distinct from old.event_precision) and not v_moving)
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

-- The one door. Moves an original entry (never a correction on its own) and all its corrections to `p_day`
-- (stored as the first day of the month / year for a rough date, as createJournalEntry does).
-- Answers: the number of rows moved (≥ 1), or raises: not_found, not_allowed, is_correction, bad_day, same_day.
create or replace function public.journal_move_entry(p_entry bigint, p_day date, p_precision text default 'day')
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid   uuid := auth.uid();
  v_root  public.journal_entry;
  v_day   date;
  v_n     integer;
begin
  if v_uid is null or not is_team() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select * into v_root from public.journal_entry where id = p_entry for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_root.corrects_id is not null then
    raise exception 'is_correction' using errcode = '23514', detail = 'Move the entry it corrects.';
  end if;
  if not (is_admin() or v_root.author_id = v_uid) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  -- A private entry of someone else: an admin may see it; nobody else reaches here (author check above).
  if p_precision not in ('day', 'month', 'year') or p_day is null or p_day > (now() at time zone 'Europe/Paris')::date then
    raise exception 'bad_day' using errcode = '22023';
  end if;
  v_day := case p_precision when 'year' then date_trunc('year', p_day)::date when 'month' then date_trunc('month', p_day)::date else p_day end;
  if v_day = v_root.event_on and p_precision = v_root.event_precision then
    raise exception 'same_day' using errcode = '23514';
  end if;

  perform set_config('pem.journal_move', 'on', true);
  insert into public.journal_entry_day_change (entry_id, from_day, from_precision, to_day, to_precision, changed_by)
    values (v_root.id, v_root.event_on, v_root.event_precision, v_day, p_precision, v_uid);
  update public.journal_entry set event_on = v_day, event_precision = p_precision
    where id = v_root.id or corrects_id = v_root.id;
  get diagnostics v_n = row_count;
  perform set_config('pem.journal_move', '', true);
  return v_n;
end;
$$;

revoke execute on function public.journal_move_entry(bigint, date, text) from public, anon;
grant execute on function public.journal_move_entry(bigint, date, text) to authenticated;

commit;
