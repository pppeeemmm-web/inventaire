-- R1 « Inputs → one feed » — build step 5 (docs/design/2026-11-17/R1_InputsFeed.notes.md).
-- Applied to the live DB 2026-11-17 with Pem's OK (« Apply it »), migration `r1_feed`.
-- Live schema read 2026-11-17 (Supabase): concept.id uuid, Oeuvres."OeuvreID" integer,
-- kaizen_item.id bigint, pending_changes.id bigint; is_team() / is_admin() via "Contact".
--
-- What it adds (decisions in the R1 brief):
--   1. concept: idea weight (Petite / Recherche), maturity (Graine / Pousse / Mûre) instead of the
--      1–5 « énergie » heat, and a « closed » mark for an idea's discussion.
--   2. note_line: one line = one comment, with author + date — on a work, on an idea, or a free
--      « Proposer une idée ». Live at once (accepted by default); Pem can discard one line, which
--      hides it (logged, recallable). Never deleted.
--   3. feed_item_state: Pem's « seen » / « discarded » per feed item (lines, Kaizen items, work-fact
--      approvals…), kept as the discard log Audit reads, with « Rappeler » (recall).
-- Not here (no schema needed): cooling (« Refroidies » = older than ~14 days and untouched, computed),
-- team notifications (their own lines' discarded_at, read in their « Pour vous »), Kaizen and
-- pending_changes (read as they are).
-- After applying: npm run gen:types, then supabase/sql/grant_audit_queries.sql.

begin;

-- ─── 1. concept = Idées ───────────────────────────────────────────────────────────────────

alter table public.concept
  add column if not exists weight text not null default 'petite',
  add column if not exists maturity text not null default 'graine',
  add column if not exists discussion_closed_at timestamptz;

alter table public.concept drop constraint if exists concept_weight_ck;
alter table public.concept add constraint concept_weight_ck check (weight in ('petite', 'recherche'));
alter table public.concept drop constraint if exists concept_maturity_ck;
alter table public.concept add constraint concept_maturity_ck check (maturity in ('graine', 'pousse', 'mure'));

comment on column public.concept.weight is 'R1: Petite (a try, an observation) or Recherche (a subject to dig into).';
comment on column public.concept.maturity is 'R1: Graine (just noted) · Pousse (being worked) · Mûre (ready for a work session). Replaces energie (kept, no longer shown).';
comment on column public.concept.discussion_closed_at is 'R1: Pem closed the discussion — still readable, no new lines.';

-- The 7 live ideas: « en cours » were being worked → Pousse; the rest stay Graine.
update public.concept set maturity = 'pousse' where statut = 'en_cours' and maturity = 'graine';

-- ─── 2. note_line ─────────────────────────────────────────────────────────────────────────

create table if not exists public.note_line (
  id              bigint generated always as identity primary key,
  target_kind     text not null,
  oeuvre_id       integer references public."Oeuvres" ("OeuvreID") on delete cascade,
  concept_id      uuid references public.concept (id) on delete cascade,
  body            text not null,
  image_key       text,
  -- Nullable only so a removed account keeps its lines (on delete set null); inserts set it (policy).
  author_id       uuid default auth.uid() references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  -- Team nudge « Une idée pour Pem ? »: shows first in the feed.
  flagged_for_pem boolean not null default false,
  -- Pem's discard: the line is hidden for everyone but Pem and its author; recall clears both.
  discarded_at    timestamptz,
  discarded_by    uuid references auth.users (id) on delete set null,
  constraint note_line_kind_ck check (target_kind in ('work', 'idea', 'proposal')),
  constraint note_line_target_ck check (
    (target_kind = 'work' and oeuvre_id is not null and concept_id is null)
    or (target_kind = 'idea' and concept_id is not null and oeuvre_id is null)
    -- « Proposer une idée »: free text, optionally about one work (#1234).
    or (target_kind = 'proposal' and concept_id is null)
  ),
  constraint note_line_body_ck check (char_length(btrim(body)) between 1 and 20000),
  constraint note_line_discard_ck check ((discarded_at is null) = (discarded_by is null))
);

create index if not exists note_line_oeuvre_idx on public.note_line (oeuvre_id, created_at) where oeuvre_id is not null;
create index if not exists note_line_concept_idx on public.note_line (concept_id, created_at) where concept_id is not null;
create index if not exists note_line_created_idx on public.note_line (created_at desc);

alter table public.note_line enable row level security;

-- Read: the team reads every live line; a discarded line only by Pem (admin) and its author
-- (that is the author's notification).
drop policy if exists note_line_select on public.note_line;
create policy note_line_select on public.note_line
  for select to authenticated
  using ((select public.is_team()) and (discarded_at is null or (select public.is_admin()) or author_id = (select auth.uid())));

-- Write: any team member adds a line as themself, live at once; not on a closed discussion.
drop policy if exists note_line_insert on public.note_line;
create policy note_line_insert on public.note_line
  for insert to authenticated
  with check (
    (select public.is_team())
    and author_id = (select auth.uid())
    and discarded_at is null
    and (
      note_line.concept_id is null
      or not exists (select 1 from public.concept c where c.id = note_line.concept_id and c.discussion_closed_at is not null)
    )
  );

-- Change: the text is never edited (append-only, like journal_entry); no delete.
-- Only three columns can change at all (column grant below):
--   · Pem (admin): discard / recall (discarded_at, discarded_by) and the flag;
--   · the author: the « Une idée pour Pem ? » flag on their own live line, nothing else.
drop policy if exists note_line_admin_update on public.note_line;
create policy note_line_admin_update on public.note_line
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists note_line_author_flag on public.note_line;
create policy note_line_author_flag on public.note_line
  for update to authenticated
  using ((select public.is_team()) and author_id = (select auth.uid()) and discarded_at is null)
  with check (author_id = (select auth.uid()) and discarded_at is null and discarded_by is null);

revoke all on public.note_line from anon, authenticated;
grant select, insert on public.note_line to authenticated;
grant update (flagged_for_pem, discarded_at, discarded_by) on public.note_line to authenticated;

-- ─── 3. feed_item_state (Pem's seen / discard log) ──────────────────────────────────────

create table if not exists public.feed_item_state (
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_kind   text not null,
  -- The item's own id as text (bigint / uuid); for an idea discussion, the concept id
  -- (« Le tore · 3 nouvelles lignes »: one feed item per idea, seen up to `at`).
  item_id     text not null,
  state       text not null,
  at          timestamptz not null default now(),
  -- Audit « Rappeler »: a recalled discard stays in the log, marked recalled.
  recalled_at timestamptz,
  constraint feed_item_state_pkey primary key (user_id, item_kind, item_id),
  constraint feed_item_state_kind_ck check (item_kind in ('note_line', 'idea', 'kaizen_item', 'pending_change')),
  constraint feed_item_state_state_ck check (state in ('seen', 'discarded'))
);

create index if not exists feed_item_state_discarded_idx on public.feed_item_state (at desc) where state = 'discarded';

alter table public.feed_item_state enable row level security;

-- The feed is Pem's (admin): own rows only. Nothing for other team members or anon.
drop policy if exists feed_item_state_own on public.feed_item_state;
create policy feed_item_state_own on public.feed_item_state
  for all to authenticated
  using (user_id = (select auth.uid()) and (select public.is_admin()))
  with check (user_id = (select auth.uid()) and (select public.is_admin()));

revoke all on public.feed_item_state from anon, authenticated;
grant select, insert, update on public.feed_item_state to authenticated;

commit;
