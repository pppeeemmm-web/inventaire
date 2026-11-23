-- Places — phase A: the shape only.
-- Design: docs/design/2026-11-23/Places.md §3 (approved by Pem 2026-11-23).
--
-- Additive. Nothing the app reads today changes:
--   * new columns on public.place (nullable or defaulted);
--   * public.place.kind filled on the 8 existing creation places (studio if named like a studio, else 'other');
--   * public.place.root_id filled (= id) on the existing places;
--   * new tables public.contact_place (a person at a place, with a role) and public.place_address_map
--     (old contact_addresses.id -> place), both empty here;
--   * a tree guard on public.place (no loops, root kept by the database).
-- No row of Oeuvres / work_order / shipment / contact_addresses is touched. No pointer moves.
-- The backfill (addresses -> places) is a separate file, run in the same landing as the readers
-- (places_phase_b_backfill.sql). Re-runnable.
--
-- Live: only with Pem's own OK, after the Docker proof (scripts/stress/README.md).
-- RLS: both new tables follow public.place — team only (is_team()), no anon.

begin;

-- 1. place: new columns ---------------------------------------------------------------------------
alter table public.place
  add column if not exists postcode        text,
  add column if not exists complement      text,
  add column if not exists kind            text,
  add column if not exists parent_id       bigint references public.place(id),
  add column if not exists root_id         bigint references public.place(id),
  add column if not exists code            text,
  add column if not exists description     text,
  add column if not exists photo_key       text,
  add column if not exists fragile         boolean not null default false,
  add column if not exists risk            text    not null default 'none',
  add column if not exists conservation    text,
  add column if not exists shipping_notes  text,
  add column if not exists plan            jsonb,
  add column if not exists plan_image_key  text,
  add column if not exists access          jsonb,
  add column if not exists keeps           jsonb,
  add column if not exists archived_at     timestamptz,
  add column if not exists archived_by     uuid;

comment on column public.place.kind is
  'address | venue | studio | zone | furniture | container | motif | other. zone/furniture/container = storage (Places.md §3a).';
comment on column public.place.root_id is
  'Top of the tree (the address). Kept by trigger place_tree; never written by the app.';
comment on column public.place.access is
  'Ordered steps to reach this place from its parent: [{kind, text, photo_key, key_name}]. Door codes are NOT stored here.';
comment on column public.place.keeps is
  'Storage hint for a box: {max_cm, num_from, num_to, period_id, fragile_only}. A hint, never a refusal.';

-- The 8 creation places: a kind the readers can filter on later.
update public.place
   set kind = case when name ~* '(atelier|studio)' then 'studio' else 'other' end
 where kind is null;

-- Default 'other': the creation-place screen (period-source-actions.ts) inserts without a kind today.
alter table public.place alter column kind set default 'other';
alter table public.place alter column kind set not null;

-- Names stay unique for creation places (the screen answers « duplicate » on 23505), not for
-- addresses (two people in « Paris ») or storage (« Tiroir 4 » in two chests) — those have codes.
drop index if exists public.place_name_uq;
create unique index if not exists place_name_creation_uq
  on public.place (lower(btrim(name))) where kind in ('studio','venue','motif','other');

alter table public.place drop constraint if exists place_kind_check;
alter table public.place add  constraint place_kind_check
  check (kind in ('address','venue','studio','zone','furniture','container','motif','other'));
alter table public.place drop constraint if exists place_risk_check;
alter table public.place add  constraint place_risk_check check (risk in ('none','watch','high'));
alter table public.place drop constraint if exists place_not_own_parent;
alter table public.place add  constraint place_not_own_parent check (parent_id is null or parent_id <> id);
alter table public.place drop constraint if exists place_archived_pair;
alter table public.place add  constraint place_archived_pair check (archived_by is null or archived_at is not null);

create unique index if not exists place_code_live_uq
  on public.place (lower(code)) where code is not null and archived_at is null;
create index if not exists place_parent_idx on public.place (parent_id);
create index if not exists place_root_idx   on public.place (root_id);

-- 2. tree guard: no loops, root kept by the database ----------------------------------------------
create or replace function public.place_tree()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  cur   bigint;
  steps int := 0;
  proot bigint;
begin
  if new.parent_id is null then
    new.root_id := new.id;
    return new;
  end if;
  cur := new.parent_id;
  while cur is not null loop
    if cur = new.id then
      raise exception 'place_cycle' using errcode = '23514', hint = 'Un lieu ne peut pas être dans lui-même.';
    end if;
    steps := steps + 1;
    if steps > 50 then
      raise exception 'place_too_deep' using errcode = '23514';
    end if;
    select p.parent_id into cur from public.place p where p.id = cur;
  end loop;
  select coalesce(p.root_id, p.id) into proot from public.place p where p.id = new.parent_id;
  new.root_id := proot;
  return new;
end;
$$;

create or replace function public.place_tree_children()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  -- Children recompute their own root from this row (their BEFORE trigger reads it).
  update public.place c set root_id = new.root_id where c.parent_id = new.id and c.root_id is distinct from new.root_id;
  return null;
end;
$$;

drop trigger if exists trg_place_tree on public.place;
create trigger trg_place_tree
  before insert or update of parent_id, root_id on public.place
  for each row execute function public.place_tree();

drop trigger if exists trg_place_tree_children on public.place;
create trigger trg_place_tree_children
  after update of parent_id, root_id on public.place
  for each row when (old.root_id is distinct from new.root_id)
  execute function public.place_tree_children();

revoke all on function public.place_tree()          from public, anon, authenticated;
revoke all on function public.place_tree_children() from public, anon, authenticated;

update public.place set root_id = id where parent_id is null and root_id is null;

-- 3. contact_place: a person at a place, with a role ----------------------------------------------
create table if not exists public.contact_place (
  id                bigint generated always as identity primary key,
  contact_id        integer not null references public."Contact"("ContactID") on delete cascade,
  place_id          bigint  not null references public.place(id) on delete restrict,
  role              text    not null,
  label             text,
  is_primary        boolean not null default false,
  position          smallint,
  since             date,
  until             date,
  level             smallint,
  knows_code_since  date,
  key_name          text,
  created_at        timestamptz not null default now(),
  created_by        uuid default auth.uid(),
  constraint contact_place_role_check  check (role in ('home','work','works_kept','delivery','authorised','other')),
  constraint contact_place_dates_check check (until is null or since is null or until >= since),
  constraint contact_place_level_check check (level is null or level between 1 and 4),
  constraint contact_place_level_role  check ((role = 'authorised') = (level is not null))
);
comment on table public.contact_place is
  'A person at a place (Places.md §3b). Replaces contact_addresses after phase B. « Retirer » sets until; the place stays. Team only.';
comment on column public.contact_place.level is
  'Authorised people only: 1 accompagné · 2 code · 3 clé · 4 équipe (Places.md §6e).';

create unique index if not exists contact_place_live_uq
  on public.contact_place (contact_id, place_id, role) where until is null;
create unique index if not exists contact_place_one_primary_uq
  on public.contact_place (contact_id) where is_primary and until is null;
create index if not exists contact_place_place_idx on public.contact_place (place_id);

alter table public.contact_place enable row level security;
drop policy if exists contact_place_team_all on public.contact_place;
create policy contact_place_team_all on public.contact_place
  for all to authenticated using (public.is_team()) with check (public.is_team());
revoke all on public.contact_place from anon;
grant select, insert, update, delete on public.contact_place to authenticated;
grant all on public.contact_place to service_role;

-- 4. place_address_map: old address row -> place (kept after contact_addresses is dropped,
--    so old version snapshots and pending changes that name an address id can be read) --------------
create table if not exists public.place_address_map (
  address_id  integer primary key,
  place_id    bigint not null references public.place(id) on delete restrict,
  link_id     bigint references public.contact_place(id) on delete set null,
  mapped_at   timestamptz not null default now()
);
comment on table public.place_address_map is
  'contact_addresses.id -> place.id, written once by places_phase_b_backfill.sql. Read only for the app.';

alter table public.place_address_map enable row level security;
drop policy if exists place_address_map_team_read on public.place_address_map;
create policy place_address_map_team_read on public.place_address_map
  for select to authenticated using (public.is_team());
revoke all on public.place_address_map from anon;
grant select on public.place_address_map to authenticated;
grant all on public.place_address_map to service_role;

commit;
