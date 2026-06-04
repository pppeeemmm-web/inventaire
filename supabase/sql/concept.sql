-- Concept / Idea space — canonical DDL (idempotent; safe to re-run).
-- Captures the live `public.concept` table that previously had no checked-in migration.
-- Server actions: app/atelier/(portal)/concepts/actions.ts (guardTeam + anon client under RLS).
-- Run in Supabase SQL editor.

create table if not exists public.concept (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  titre       text not null default '',
  description text,
  medium      text,
  themes      text[],
  statut      text not null default 'idee',
  oeuvre_id   integer,
  image_note  text,
  energie     integer,
  notes       text
);

-- Concept lane (artistic | business | logistics | other). Added 2026-06-04: code
-- inserted `category` before the column existed, so every create/update failed
-- with `column "category" does not exist`. Mirrors CATEGORY_IDS in
-- components/atelier/concepts/concept-constants.ts.
alter table public.concept
  add column if not exists category text not null default 'artistic'
  check (category in ('artistic','business','logistics','other'));

comment on column public.concept.category is
  'Concept lane: artistic | business | logistics | other. Default artistic.';

-- ── RLS: any team member (is_team()) reads + writes ─────────────────────────────
alter table public.concept enable row level security;

drop policy if exists "concept_team" on public.concept;
create policy "concept_team"
  on public.concept for all
  using (is_team())
  with check (is_team());

grant select, insert, update, delete on public.concept to authenticated;
grant select, insert, update, delete on public.concept to anon;
