-- Kaizen (owner 2026-11-02): ideas and improvements, split from the System ledger.
--   section: 'creation' (ideas for works, trends, trains of thought, concepts)
--            'website' / 'business' (Opérations & Stratégie)
--            NULL = waiting for the owner to confirm `suggested_section` (migrated entries).
--   Entries can be ticked done (and unticked) but never erased: no DELETE policy or grant.
--   No automatic dates: ideas never become dated tasks.
-- The 33 suggestions in `system_log` (event_type IS NULL) are copied here with a proposed
-- section; the System ledger hides them via `metadata.kaizen_id` (rows kept, never deleted).

create table if not exists public.kaizen_item (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  author_id uuid references auth.users(id) on delete set null default auth.uid(),
  section text check (section in ('creation', 'website', 'business')),
  suggested_section text check (suggested_section in ('creation', 'website', 'business')),
  title text not null check (length(trim(title)) > 0),
  body text,
  work_ids integer[] not null default '{}',
  done_at timestamptz,
  done_by uuid references auth.users(id) on delete set null,
  legacy_system_log_id bigint unique
);

create index if not exists kaizen_item_section_idx on public.kaizen_item (section, done_at);
create index if not exists kaizen_item_author_idx on public.kaizen_item (author_id);
create index if not exists kaizen_item_done_by_idx on public.kaizen_item (done_by);

create or replace function public.kaizen_item_touch() returns trigger
  language plpgsql set search_path to 'public' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists kaizen_item_touch on public.kaizen_item;
create trigger kaizen_item_touch before update on public.kaizen_item
  for each row execute function public.kaizen_item_touch();

alter table public.kaizen_item enable row level security;

drop policy if exists kaizen_item_team_select on public.kaizen_item;
create policy kaizen_item_team_select on public.kaizen_item
  for select to authenticated using (is_team());

drop policy if exists kaizen_item_team_insert on public.kaizen_item;
create policy kaizen_item_team_insert on public.kaizen_item
  for insert to authenticated with check (is_team() and author_id = (select auth.uid()));

drop policy if exists kaizen_item_author_or_admin_update on public.kaizen_item;
create policy kaizen_item_author_or_admin_update on public.kaizen_item
  for update to authenticated
  using (is_team() and (author_id = (select auth.uid()) or is_admin()))
  with check (is_team() and (author_id = (select auth.uid()) or is_admin()));

-- No delete policy: Kaizen keeps its history.
revoke all on public.kaizen_item from anon;
revoke delete, truncate on public.kaizen_item from authenticated;
grant select, insert, update on public.kaizen_item to authenticated;

-- ── Copy the System ledger suggestions, pre-sorted (owner reviews before they count) ──
insert into public.kaizen_item (created_at, author_id, suggested_section, title, body, work_ids, legacy_system_log_id)
select
  l.created_at,
  coalesce(l.author_id, l.user_id),
  case
    when l.id in (1035, 1060, 1136, 1161, 1168, 1194) then 'website'
    when l.id in (1056, 1154, 1190, 1195, 1215) then 'business'
    else 'creation'
  end,
  left(coalesce(nullif(trim(l.action), ''), 'Note'), 300),
  nullif(trim(l.details), ''),
  coalesce((
    select array_agg(distinct n order by n)
    from (
      select (m[1])::int n from regexp_matches(coalesce(l.action, '') || ' ' || coalesce(l.details, ''), '#\s?(\d{1,5})', 'g') m
      union
      select (m[1])::int from regexp_matches(l.action, '^\s*(\d{3,5})(?:\s*,\s*(\d{3,5}))?\s*$') m
      union
      select (m[2])::int from regexp_matches(l.action, '^\s*(\d{3,5})(?:\s*,\s*(\d{3,5}))?\s*$') m where m[2] is not null
    ) nums
    where exists (select 1 from public."Oeuvres" o where o."OeuvreID" = nums.n)
  ), '{}'),
  l.id
from public.system_log l
where l.event_type is null
  and coalesce(l.metadata->>'kaizen_id', '') = ''
on conflict (legacy_system_log_id) do nothing;

update public.system_log l
set metadata = coalesce(l.metadata, '{}'::jsonb) || jsonb_build_object('kaizen_id', k.id)
from public.kaizen_item k
where k.legacy_system_log_id = l.id
  and coalesce(l.metadata->>'kaizen_id', '') = '';
