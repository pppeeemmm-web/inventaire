-- Calendar export (Google Calendar + Microsoft Graph): per-user OAuth tokens + event id map.
-- Run in Supabase SQL editor after deploy.

create table if not exists calendar_account (
  id                      uuid primary key default gen_random_uuid(),
  auth_user_id            uuid not null references auth.users (id) on delete cascade,
  provider                text not null check (provider in ('google', 'microsoft')),
  tenant_id               text,
  refresh_token_encrypted text not null,
  token_salt              text,
  scopes                  text,
  primary_calendar_id     text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (auth_user_id, provider)
);

create index if not exists calendar_account_auth_user_id_idx
  on calendar_account (auth_user_id);

create table if not exists calendar_event_link (
  id                  uuid primary key default gen_random_uuid(),
  auth_user_id        uuid not null references auth.users (id) on delete cascade,
  calendar_account_id uuid not null references calendar_account (id) on delete cascade,
  provider            text not null check (provider in ('google', 'microsoft')),
  suivi_process_id    uuid references suivi_process (id) on delete cascade,
  suivi_etape_id      uuid references suivi_etape (id) on delete cascade,
  external_event_id   text not null,
  sync_etag           text,
  updated_at          timestamptz not null default now(),
  check (
    (suivi_process_id is not null and suivi_etape_id is null)
    or (suivi_process_id is null and suivi_etape_id is not null)
  )
);

create unique index if not exists calendar_event_link_process_uniq
  on calendar_event_link (calendar_account_id, suivi_process_id)
  where suivi_process_id is not null;

create unique index if not exists calendar_event_link_step_uniq
  on calendar_event_link (calendar_account_id, suivi_etape_id)
  where suivi_etape_id is not null;

create index if not exists calendar_event_link_auth_user_id_idx
  on calendar_event_link (auth_user_id);

create index if not exists calendar_event_link_process_idx
  on calendar_event_link (suivi_process_id)
  where suivi_process_id is not null;

create index if not exists calendar_event_link_etape_idx
  on calendar_event_link (suivi_etape_id)
  where suivi_etape_id is not null;

comment on table calendar_account is 'OAuth refresh tokens (app-encrypted) for exhibition calendar export.';
comment on table calendar_event_link is 'Maps suivi_process / suivi_etape rows to provider calendar event ids.';

alter table calendar_account enable row level security;
alter table calendar_event_link enable row level security;

drop policy if exists calendar_account_owner_select on calendar_account;
create policy calendar_account_owner_select
  on calendar_account for select to authenticated
  using (auth_user_id = (select auth.uid()));

drop policy if exists calendar_account_owner_insert on calendar_account;
create policy calendar_account_owner_insert
  on calendar_account for insert to authenticated
  with check (auth_user_id = (select auth.uid()));

drop policy if exists calendar_account_owner_update on calendar_account;
create policy calendar_account_owner_update
  on calendar_account for update to authenticated
  using (auth_user_id = (select auth.uid()))
  with check (auth_user_id = (select auth.uid()));

drop policy if exists calendar_account_owner_delete on calendar_account;
create policy calendar_account_owner_delete
  on calendar_account for delete to authenticated
  using (auth_user_id = (select auth.uid()));

drop policy if exists calendar_event_link_owner_select on calendar_event_link;
create policy calendar_event_link_owner_select
  on calendar_event_link for select to authenticated
  using (auth_user_id = (select auth.uid()));

drop policy if exists calendar_event_link_owner_insert on calendar_event_link;
create policy calendar_event_link_owner_insert
  on calendar_event_link for insert to authenticated
  with check (auth_user_id = (select auth.uid()));

drop policy if exists calendar_event_link_owner_update on calendar_event_link;
create policy calendar_event_link_owner_update
  on calendar_event_link for update to authenticated
  using (auth_user_id = (select auth.uid()))
  with check (auth_user_id = (select auth.uid()));

drop policy if exists calendar_event_link_owner_delete on calendar_event_link;
create policy calendar_event_link_owner_delete
  on calendar_event_link for delete to authenticated
  using (auth_user_id = (select auth.uid()));
