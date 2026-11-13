-- "See again" card (owner GO 2026-11-13, HANDOFF_2026-11-13_OPUS task D).
-- The card picks, once a day (seed = the date), three things to look at again: an old journal
-- entry ("then"), a work with no link ("alone"), a close pair of works with no relation ("close").
-- No AI text: it only chooses what to show. This table remembers what a person hid or answered
-- "not related", so it is not shown to them again. Own rows only; nothing for anon.

create table if not exists public.see_again_dismissed (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind    text not null,
  a       text not null,
  b       text not null default '',
  at      timestamptz not null default now(),
  constraint see_again_dismissed_pkey primary key (user_id, kind, a, b),
  constraint see_again_dismissed_kind_ck check (kind in ('then', 'alone', 'close'))
);

alter table public.see_again_dismissed enable row level security;

drop policy if exists see_again_dismissed_own_select on public.see_again_dismissed;
create policy see_again_dismissed_own_select on public.see_again_dismissed
  for select to authenticated using (user_id = auth.uid());

drop policy if exists see_again_dismissed_own_insert on public.see_again_dismissed;
create policy see_again_dismissed_own_insert on public.see_again_dismissed
  for insert to authenticated with check (user_id = auth.uid() and public.is_team());

drop policy if exists see_again_dismissed_own_delete on public.see_again_dismissed;
create policy see_again_dismissed_own_delete on public.see_again_dismissed
  for delete to authenticated using (user_id = auth.uid());

-- Default privileges grant everything to authenticated: take it back, then grant only what is used.
revoke all on public.see_again_dismissed from authenticated, anon;
grant select, insert, delete on public.see_again_dismissed to authenticated;
