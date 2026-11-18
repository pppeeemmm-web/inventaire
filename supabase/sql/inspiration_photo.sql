-- APPLIED 2026-11-18 (live migration `inspiration_photo`, by the lead, with the `revoke … from authenticated` below).
-- Inspiration photo (R1 / R2, Pem 2026-11-18: « Go » for the SQL).
-- A photo taken on the phone (Photo · doc → Inspiration) that joins the day's entries in the Journal and
-- can also be linked to a work and / or an idée (concept). docs/design/2026-11-17/PhoneToday.notes.md
-- (v3 answer 3, « Needs a home »), R1_InputsFeed.notes.md (only Pem writes the Journal, the team reads).
--
-- Images: AVIF, 2100 px long side + 400 px thumb, R2 EU endpoint, keys
--   inspiration/I_{yyyymmdd}_{rand8}_{hash8}.avif  and  thumbs/inspiration/…  (app/atelier/capture/inspiration-actions.ts)
-- A removed photo goes to R2 recycle/ (r2SoftDeleteObject), never a hard delete of the object.
--
-- Access (no anon):
--   read   = team (is_team()), like the Journal;
--   write  = admin only (is_admin()): the Journal is Pem's notebook, the team reads (R1);
--   the row's author is the signed-in admin (author_id = auth.uid()).
-- After it runs: flip INSPIRATION_SQL_LIVE in lib/inspiration-photo.ts, then `npm run gen:types`.
-- Idempotent.

begin;

create table if not exists public.inspiration_photo (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  -- The Paris calendar day it joins in the Journal (the day it was taken, from the phone's clock).
  day         date not null,
  author_id   uuid not null default auth.uid() references auth.users (id) on delete restrict,
  image_key   text not null,
  caption     text,
  oeuvre_id   integer references public."Oeuvres" ("OeuvreID") on delete set null,
  concept_id  uuid references public.concept (id) on delete set null,
  constraint inspiration_photo_image_key_check check (image_key like 'inspiration/%'),
  constraint inspiration_photo_caption_len check (caption is null or char_length(caption) <= 2000)
);

comment on table public.inspiration_photo is
  'Inspiration photos from the phone (R1/R2): on a Journal day, optionally linked to a work and/or a concept. Team reads, admin writes.';

create index if not exists inspiration_photo_day_idx on public.inspiration_photo (day);
create index if not exists inspiration_photo_oeuvre_idx on public.inspiration_photo (oeuvre_id) where oeuvre_id is not null;
create index if not exists inspiration_photo_concept_idx on public.inspiration_photo (concept_id) where concept_id is not null;

alter table public.inspiration_photo enable row level security;

drop policy if exists inspiration_photo_team_select on public.inspiration_photo;
create policy inspiration_photo_team_select on public.inspiration_photo
  for select to authenticated
  using (is_team());

drop policy if exists inspiration_photo_admin_insert on public.inspiration_photo;
create policy inspiration_photo_admin_insert on public.inspiration_photo
  for insert to authenticated
  with check (is_admin() and author_id = (select auth.uid()));

drop policy if exists inspiration_photo_admin_update on public.inspiration_photo;
create policy inspiration_photo_admin_update on public.inspiration_photo
  for update to authenticated
  using (is_admin())
  with check (is_admin());

drop policy if exists inspiration_photo_admin_delete on public.inspiration_photo;
create policy inspiration_photo_admin_delete on public.inspiration_photo
  for delete to authenticated
  using (is_admin());

revoke all on public.inspiration_photo from anon;
revoke all on public.inspiration_photo from public;
-- Supabase default privileges also give authenticated TRUNCATE / REFERENCES / TRIGGER: reset, then grant only DML.
revoke all on public.inspiration_photo from authenticated;
grant select, insert, update, delete on public.inspiration_photo to authenticated;

commit;

-- Check after:
-- select grantee, privilege_type from information_schema.role_table_grants where table_name = 'inspiration_photo';
-- select policyname, cmd from pg_policies where tablename = 'inspiration_photo';
