-- Inventory broadcast — Phase 2: caption seed, queued/posted lifecycle, generic events log.
-- Idempotent: safe to re-run.

-- ── 1. Per-work caption seed (operator hint for middleware AI) ──────────────
alter table "Oeuvres"
  add column if not exists broadcast_caption_seed text;

comment on column "Oeuvres".broadcast_caption_seed is
  'Optional artist note (phrase, memory, context cue) exposed to middleware AI as caption guidance — practice/vision framing, not sales.';

-- ── 2. oeuvre_broadcasts lifecycle ──────────────────────────────────────────
alter table oeuvre_broadcasts
  add column if not exists status text not null default 'posted'
    check (status in ('queued', 'posted')),
  add column if not exists queued_at timestamptz null,
  add column if not exists attempt_count int not null default 0,
  add column if not exists external_url text null,
  add column if not exists caption_final text null;

comment on column oeuvre_broadcasts.status is
  'queued = middleware has locked the work but post not confirmed yet; posted = live on platform.';
comment on column oeuvre_broadcasts.queued_at is
  'Timestamp of most recent queue attempt; cleared on posted transition by the confirm endpoint.';

create index if not exists idx_oeuvre_broadcasts_status on oeuvre_broadcasts (status, queued_at desc);

-- ── 3. broadcast_events — lightweight activity log (VIP comments, errors, etc.) ───
create table if not exists broadcast_events (
  id           uuid primary key default gen_random_uuid(),
  oeuvre_id    integer null references "Oeuvres"("OeuvreID") on delete set null,
  platform     text not null,
  event_type   text not null,
  priority     text not null default 'normal' check (priority in ('vip', 'normal')),
  summary      text null,
  external_url text null,
  payload      jsonb null,
  created_at   timestamptz not null default now()
);

create index if not exists idx_broadcast_events_created on broadcast_events (created_at desc);
create index if not exists idx_broadcast_events_priority on broadcast_events (priority, created_at desc);
create index if not exists idx_broadcast_events_oeuvre on broadcast_events (oeuvre_id);

alter table broadcast_events enable row level security;

drop policy if exists "broadcast_events_admin_select" on broadcast_events;
create policy "broadcast_events_admin_select"
  on broadcast_events
  for select to authenticated
  using (is_admin());

comment on table broadcast_events is
  'Lightweight log: queued/posted echoes, VIP-tagged comments, errors. Read in atelier Broadcast tab Activity view; written via service_role from Route Handlers.';
