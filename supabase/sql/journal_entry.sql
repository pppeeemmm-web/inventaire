-- Journal entries — build step 1 (owner GO 2026-11-12, docs/JOURNAL_PROPOSAL.md).
--
-- The day is the unit: an entry carries its event date; the journal day page gathers entries,
-- field changes (oeuvre_versions) and voice notes of that date. No "day" table.
--
-- Invariants (brief): append only — text, kind, dates, author, provenance never change after
-- insert (a correction is a new entry with corrects_id); no physical deletion (hide instead,
-- admin only); two dates (created_at = entered, event_on + precision = happened); provenance +
-- verification on every entry; Pem's text kept as written.
--
-- Access: team only (is_team()); default visibility 'team'; 'private' = author + admins.
-- Nothing for anon. Rights granted explicitly (CLAUDE.md: missing grant => 42501 despite RLS).
-- Guard functions: SECURITY INVOKER, fixed search_path, trigger-only (not callable via the API).

-- ── Entries ──────────────────────────────────────────────────────────────────────────────────
create table if not exists public.journal_entry (
  id               bigint generated always as identity primary key,
  created_at       timestamptz not null default now(),
  event_on         date not null default ((now() at time zone 'Europe/Paris')::date),
  event_precision  text not null default 'day',
  kind             text not null,
  body             text not null,
  provenance       text not null default 'typed',
  verification     text not null default 'verified',
  visibility       text not null default 'team',
  author_id        uuid default auth.uid(),
  corrects_id      bigint references public.journal_entry (id) on delete restrict,
  hidden_at        timestamptz,
  hidden_by        uuid,
  constraint journal_entry_precision_ck    check (event_precision in ('day', 'month', 'year')),
  constraint journal_entry_kind_ck         check (kind in ('spark', 'trigger', 'reflection', 'note', 'voice', 'handwriting', 'atlas')),
  constraint journal_entry_body_ck         check (length(btrim(body)) > 0),
  constraint journal_entry_provenance_ck   check (provenance in ('typed', 'voice', 'photo', 'import', 'ai')),
  constraint journal_entry_verification_ck check (verification in ('verified', 'unverified')),
  constraint journal_entry_visibility_ck   check (visibility in ('team', 'private'))
);

create index if not exists journal_entry_event_on_idx on public.journal_entry (event_on);
create index if not exists journal_entry_corrects_idx on public.journal_entry (corrects_id) where corrects_id is not null;

-- ── Links: entry → work or concept (AI proposals later: proposed_by 'ai', validated_at null) ──
create table if not exists public.journal_entry_link (
  id            bigint generated always as identity primary key,
  created_at    timestamptz not null default now(),
  created_by    uuid default auth.uid(),
  entry_id      bigint not null references public.journal_entry (id) on delete restrict,
  oeuvre_id     integer references public."Oeuvres" ("OeuvreID") on delete restrict,
  concept_id    uuid references public.concept (id) on delete restrict,
  relation      text not null default 'about',
  proposed_by   text not null default 'pem',
  validated_at  timestamptz,
  constraint journal_entry_link_target_ck   check ((oeuvre_id is null) <> (concept_id is null)),
  constraint journal_entry_link_proposed_ck check (proposed_by in ('pem', 'ai'))
);

create unique index if not exists journal_entry_link_work_uq    on public.journal_entry_link (entry_id, oeuvre_id)  where oeuvre_id is not null;
create unique index if not exists journal_entry_link_concept_uq on public.journal_entry_link (entry_id, concept_id) where concept_id is not null;
create index if not exists journal_entry_link_oeuvre_idx on public.journal_entry_link (oeuvre_id) where oeuvre_id is not null;

-- ── Guards ───────────────────────────────────────────────────────────────────────────────────
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
     or new.corrects_id is distinct from old.corrects_id then
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

drop trigger if exists trg_journal_entry_guard on public.journal_entry;
create trigger trg_journal_entry_guard
before update or delete on public.journal_entry
for each row execute function public.journal_entry_guard();

create or replace function public.journal_entry_link_guard()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'journal_no_delete' using errcode = '42501';
  end if;
  if new.entry_id is distinct from old.entry_id
     or new.oeuvre_id is distinct from old.oeuvre_id
     or new.concept_id is distinct from old.concept_id
     or new.proposed_by is distinct from old.proposed_by
     or new.created_by is distinct from old.created_by then
    raise exception 'journal_append_only' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_journal_entry_link_guard on public.journal_entry_link;
create trigger trg_journal_entry_link_guard
before update or delete on public.journal_entry_link
for each row execute function public.journal_entry_link_guard();

revoke execute on function public.journal_entry_guard() from public, anon, authenticated;
revoke execute on function public.journal_entry_link_guard() from public, anon, authenticated;

-- ── RLS ──────────────────────────────────────────────────────────────────────────────────────
alter table public.journal_entry enable row level security;
alter table public.journal_entry_link enable row level security;

drop policy if exists journal_entry_team_select on public.journal_entry;
create policy journal_entry_team_select on public.journal_entry
  for select to authenticated
  using (is_team() and (visibility = 'team' or author_id = (select auth.uid()) or is_admin()));

drop policy if exists journal_entry_team_insert on public.journal_entry;
create policy journal_entry_team_insert on public.journal_entry
  for insert to authenticated
  with check (is_team() and author_id = (select auth.uid()));

drop policy if exists journal_entry_author_or_admin_update on public.journal_entry;
create policy journal_entry_author_or_admin_update on public.journal_entry
  for update to authenticated
  using (is_team() and (author_id = (select auth.uid()) or is_admin()))
  with check (is_team() and (author_id = (select auth.uid()) or is_admin()));

-- A link is visible when its entry is (the subquery runs under journal_entry's RLS).
drop policy if exists journal_entry_link_team_select on public.journal_entry_link;
create policy journal_entry_link_team_select on public.journal_entry_link
  for select to authenticated
  using (is_team() and exists (select 1 from public.journal_entry e where e.id = entry_id));

drop policy if exists journal_entry_link_team_insert on public.journal_entry_link;
create policy journal_entry_link_team_insert on public.journal_entry_link
  for insert to authenticated
  with check (is_team() and created_by = (select auth.uid())
              and exists (select 1 from public.journal_entry e where e.id = entry_id));

drop policy if exists journal_entry_link_admin_update on public.journal_entry_link;
create policy journal_entry_link_admin_update on public.journal_entry_link
  for update to authenticated
  using (is_admin()) with check (is_admin());

-- ── Grants (no delete for anyone; nothing for anon) ─────────────────────────────────────────
revoke all on public.journal_entry, public.journal_entry_link from anon;
revoke delete, truncate on public.journal_entry, public.journal_entry_link from authenticated;
grant select, insert, update on public.journal_entry, public.journal_entry_link to authenticated;
grant all on public.journal_entry, public.journal_entry_link to service_role;
