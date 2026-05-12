-- Inventory broadcast: operator gate on Oeuvres + dedupe log per platform.
-- Run in Supabase SQL editor or your migration pipeline.

alter table "Oeuvres"
  add column if not exists broadcast_ready boolean not null default false;

comment on column "Oeuvres".broadcast_ready is
  'When true (with is_public + cover image), work may appear in broadcast feed; middleware confirms via oeuvre_broadcasts.';

create table if not exists oeuvre_broadcasts (
  id                uuid primary key default gen_random_uuid(),
  oeuvre_id         integer not null references "Oeuvres"("OeuvreID") on delete cascade,
  platform          text not null,
  external_post_id  text null,
  broadcast_at      timestamptz not null default now(),
  metadata          jsonb null,
  unique (oeuvre_id, platform)
);

create index if not exists idx_oeuvre_broadcasts_oeuvre on oeuvre_broadcasts (oeuvre_id);
create index if not exists idx_oeuvre_broadcasts_platform_at on oeuvre_broadcasts (platform, broadcast_at desc);

alter table oeuvre_broadcasts enable row level security;

-- Inserts from app use service_role (Route Handler); authenticated users have no direct write.
drop policy if exists "oeuvre_broadcasts_admin_select" on oeuvre_broadcasts;
create policy "oeuvre_broadcasts_admin_select"
  on oeuvre_broadcasts
  for select to authenticated
  using (is_admin());

comment on table oeuvre_broadcasts is
  'One row per published broadcast per platform; unique (oeuvre_id, platform) prevents duplicate posts.';
