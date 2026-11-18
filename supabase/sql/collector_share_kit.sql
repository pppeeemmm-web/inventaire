-- APPLIED 2026-11-18, migration collector_share_kit (Pem's own OK; lead checked policies + grants after).
-- Collector share kit (TODO 11b, Pem build GO 2026-11-18).
-- Design: docs/design/2026-11-18/Collector_ShareKit.notes.md (Pem's 8 answers at the bottom).
--
-- What it does, in one transaction:
--   1. Reshapes `private_link` (0 rows ever, read live 2026-11-18) into a « kit »: the collector (Contact), FR/EN,
--      Pem's message, revoke stamp, the PDF (private Vault key + date + downloads), first / last opened.
--      `viewed_at` → renamed `last_opened_at`; `recipient_email` dropped (never written; the collector's email is
--      never shown on the page). `recipient_name` stays = the full name shown on the page (snapshot at creation).
--      Token must be ≥ 22 characters (~128 bits). Deleting a working group no longer deletes its kits
--      (group_id: CASCADE → SET NULL — the kit is provenance).
--   2. New `private_link_work`: the frozen list of works of a kit (order + price snapshot, shown or not).
--   3. `inquiry.private_link_token`: an enquiry sent from a kit points to it (Triage shows « Kit · <name> »).
--      The public insert policies now refuse that column (only the server, after the token check, sets it).
--   4. Two counters for the server (service_role only, atomic): an open (at most once per 30 min) and a PDF download.
--   5. Grants: anon loses its SELECT grant on private_link (it had no policy, so it read nothing). Team = RLS
--      `is_team()` on both tables. The collector page and /c/<token>/pdf read with the service role after the token check.
--
-- After apply: `npm run gen:types` on main, then `npm run typecheck` (the worktree hand-edited the generated types to
-- match this file; on a clash in lib/types/supabase.generated.ts take main's regenerated file).
-- Revert block at the bottom (commented).

begin;

-- ── 1. private_link → kit ─────────────────────────────────────────────────────────────────────────────────────
alter table public.private_link rename column viewed_at to last_opened_at;
alter table public.private_link drop column if exists recipient_email;

alter table public.private_link
  add column if not exists contact_id integer references public."Contact"("ContactID") on delete set null,
  add column if not exists lang text not null default 'fr',
  add column if not exists message text,
  add column if not exists revoked_at timestamptz,
  add column if not exists pdf_key text,
  add column if not exists pdf_made_at timestamptz,
  add column if not exists pdf_downloads integer not null default 0,
  add column if not exists pdf_last_downloaded_at timestamptz,
  add column if not exists first_opened_at timestamptz;

alter table public.private_link
  add constraint private_link_lang_check check (lang in ('fr', 'en')),
  add constraint private_link_token_length check (char_length(token) >= 22),
  add constraint private_link_message_length check (message is null or char_length(message) <= 1000);

-- A kit is provenance: keep it when its working group is deleted.
alter table public.private_link drop constraint if exists private_link_group_id_fkey;
alter table public.private_link
  add constraint private_link_group_id_fkey foreign key (group_id) references public.working_group(id) on delete set null;

create index if not exists private_link_contact_id_idx on public.private_link (contact_id);
-- (group_id is already covered by the live index private_link_group_idx)

comment on table public.private_link is
  'Collector share kit: one private link /c/<token> for one Contact, a frozen list of works (private_link_work), a PDF in the Vault. Team = RLS is_team(); the public page and PDF route read with the service role after the token check.';

-- ── 2. private_link_work — the frozen works of a kit ──────────────────────────────────────────────────────────
create table if not exists public.private_link_work (
  token      text    not null references public.private_link(token) on delete cascade,
  oeuvre_id  integer not null references public."Oeuvres"("OeuvreID") on delete cascade,
  position   integer not null,
  show_price boolean not null default false,
  price      numeric(12, 2),            -- snapshot at creation, only when show_price (shown « indicatif »)
  primary key (token, oeuvre_id),
  constraint private_link_work_price_check check (price is null or price >= 0)
);
create index if not exists private_link_work_oeuvre_id_idx on public.private_link_work (oeuvre_id);

comment on table public.private_link_work is
  'Works of a collector kit, frozen at creation (order + price snapshot). Editing the working group later does not change the kit.';

-- ── 3. inquiry → kit ──────────────────────────────────────────────────────────────────────────────────────────
alter table public.inquiry
  add column if not exists private_link_token text references public.private_link(token) on delete set null;
create index if not exists inquiry_private_link_token_idx on public.inquiry (private_link_token);

-- Public inserts (/enquiry form) may not claim a kit: only the server action (service role, token checked) sets it.
drop policy if exists inquiry_anon_insert on public.inquiry;
create policy inquiry_anon_insert on public.inquiry
  for insert to anon with check (private_link_token is null);
drop policy if exists inquiry_authenticated_insert on public.inquiry;
create policy inquiry_authenticated_insert on public.inquiry
  for insert to authenticated with check (private_link_token is null);

-- ── 4. Counters (server only) ─────────────────────────────────────────────────────────────────────────────────
-- An open: counted at most once per 30 minutes per kit, only while the kit is active.
create or replace function public.private_link_count_open(p_token text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.private_link
     set view_count      = view_count + 1,
         first_opened_at = coalesce(first_opened_at, now()),
         last_opened_at  = now()
   where token = p_token
     and revoked_at is null
     and (expires_at is null or expires_at > now())
     and (last_opened_at is null or last_opened_at < now() - interval '30 minutes');
$$;

create or replace function public.private_link_count_pdf(p_token text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.private_link
     set pdf_downloads          = pdf_downloads + 1,
         pdf_last_downloaded_at = now()
   where token = p_token
     and revoked_at is null
     and (expires_at is null or expires_at > now());
$$;

revoke all on function public.private_link_count_open(text) from public, anon, authenticated;
revoke all on function public.private_link_count_pdf(text)  from public, anon, authenticated;
grant execute on function public.private_link_count_open(text) to service_role;
grant execute on function public.private_link_count_pdf(text)  to service_role;

-- ── 5. RLS + grants ───────────────────────────────────────────────────────────────────────────────────────────
alter table public.private_link      enable row level security;
alter table public.private_link_work enable row level security;

drop policy if exists "private_link: team all" on public.private_link;
create policy "private_link: team all" on public.private_link
  for all to authenticated using (public.is_team()) with check (public.is_team());

drop policy if exists "private_link_work: team all" on public.private_link_work;
create policy "private_link_work: team all" on public.private_link_work
  for all to authenticated using (public.is_team()) with check (public.is_team());

-- Supabase defaults add TRUNCATE / REFERENCES / TRIGGER: start from nothing, grant only what the app uses.
revoke all on table public.private_link      from anon, authenticated;
revoke all on table public.private_link_work from anon, authenticated;
grant select, insert, update, delete on table public.private_link      to authenticated;
grant select, insert, update, delete on table public.private_link_work to authenticated;
grant all on table public.private_link      to service_role;
grant all on table public.private_link_work to service_role;

commit;

-- ── Checks after apply (read-only) ────────────────────────────────────────────────────────────────────────────
-- select grantee, privilege_type from information_schema.role_table_grants
--  where table_name in ('private_link','private_link_work') and grantee in ('anon','authenticated') order by 1, 2;
--   → authenticated: DELETE, INSERT, SELECT, UPDATE on both; anon: nothing.
-- select tablename, policyname, roles, cmd from pg_policies where tablename in ('private_link','private_link_work','inquiry');
-- select has_function_privilege('anon', 'public.private_link_count_open(text)', 'execute');  → false

-- ── Revert (only while private_link has no real kits) ─────────────────────────────────────────────────────────
-- begin;
-- drop policy if exists inquiry_anon_insert on public.inquiry;
-- create policy inquiry_anon_insert on public.inquiry for insert to anon with check (true);
-- drop policy if exists inquiry_authenticated_insert on public.inquiry;
-- create policy inquiry_authenticated_insert on public.inquiry for insert to authenticated with check (true);
-- alter table public.inquiry drop column if exists private_link_token;
-- drop function if exists public.private_link_count_open(text);
-- drop function if exists public.private_link_count_pdf(text);
-- drop table if exists public.private_link_work;
-- alter table public.private_link drop constraint if exists private_link_lang_check,
--   drop constraint if exists private_link_token_length, drop constraint if exists private_link_message_length;
-- alter table public.private_link drop column if exists contact_id, drop column if exists lang,
--   drop column if exists message, drop column if exists revoked_at, drop column if exists pdf_key,
--   drop column if exists pdf_made_at, drop column if exists pdf_downloads, drop column if exists pdf_last_downloaded_at,
--   drop column if exists first_opened_at;
-- alter table public.private_link add column if not exists recipient_email text;
-- alter table public.private_link rename column last_opened_at to viewed_at;
-- alter table public.private_link drop constraint if exists private_link_group_id_fkey;
-- alter table public.private_link add constraint private_link_group_id_fkey foreign key (group_id)
--   references public.working_group(id) on delete cascade;
-- commit;
