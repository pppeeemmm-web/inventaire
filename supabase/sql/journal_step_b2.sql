-- Journal Step B, part 2 (design docs/design/2026-11-22/JournalDesign.md §5, JournalDesk.md §6;
-- Pem 2026-11-23 « Yes, plan it », answers: a person named in the Journal is never deleted — merge instead;
-- removing a photo that has text hides its entry (it can come back); the photo's place (GPS) is kept, admin only).
--   1. `@` links a person: journal_entry_link.contact_id. One target per link, immutable — except that
--      merge_contacts moves a link to the kept contact (its only change; a duplicate on the same entry goes).
--      Contact → journal link is ON DELETE RESTRICT: a person named in the Journal cannot be deleted.
--   2. A photo's text is a Journal entry (journal_entry.photo_id): one door, inspiration_photo_set_text, writes
--      the entry (first text) or a correction (later text), the caption, and the `#` / `@` links, all or nothing.
--      The 3 photos that already have text get their entry here. inspiration_photo_remove: a photo with an
--      entry is hidden (entry + photo), never deleted; one without is deleted (the door recycles its image).
--   3. The photo's own data: inspiration_photo.meta (team read); its place in inspiration_photo_place (admin
--      only). A `gps` key written into meta is moved into the place row by the database.
-- Not here: re-suggesting entries corrected before journal_suggest_from_shown_text — checked live 2026-11-23,
-- the 3 corrected entries were all proposed again after their correction (nothing to do).
-- Proven on the throwaway copy first (scripts/stress), then live with Pem's OK.

begin;

-- ── 1. Person links ──────────────────────────────────────────────────────────────────────────────────────
alter table public.journal_entry_link
  add column if not exists contact_id integer references public."Contact"("ContactID") on delete restrict;

alter table public.journal_entry_link drop constraint if exists journal_entry_link_target_ck;
alter table public.journal_entry_link add constraint journal_entry_link_target_ck
  check (num_nonnulls(oeuvre_id, concept_id, target_entry_id, contact_id) = 1);
create unique index if not exists journal_entry_link_contact_uq
  on public.journal_entry_link (entry_id, contact_id) where contact_id is not null;
create index if not exists journal_entry_link_contact_idx
  on public.journal_entry_link (contact_id) where contact_id is not null;

-- A link never changes or goes — except inside merge_contacts (pem.contact_merge = 'on'): there a person link
-- may point to the kept contact, or go when the entry already names the kept one.
create or replace function public.journal_entry_link_guard()
returns trigger language plpgsql set search_path to 'public' as $$
declare
  v_merging boolean := coalesce(current_setting('pem.contact_merge', true), '') = 'on';
begin
  if tg_op = 'DELETE' then
    if v_merging and old.contact_id is not null then
      return old;
    end if;
    raise exception 'journal_no_delete' using errcode = '42501';
  end if;
  if new.entry_id is distinct from old.entry_id
     or new.oeuvre_id is distinct from old.oeuvre_id
     or new.concept_id is distinct from old.concept_id
     or new.target_entry_id is distinct from old.target_entry_id
     or (new.contact_id is distinct from old.contact_id and not (v_merging and old.contact_id is not null and new.contact_id is not null))
     or new.relation is distinct from old.relation
     or new.proposed_by is distinct from old.proposed_by
     or new.created_by is distinct from old.created_by then
    raise exception 'journal_append_only' using errcode = '23514';
  end if;
  return new;
end;
$$;

-- The team links only to a person it can see (a « Privé » contact is admin only).
drop policy if exists journal_entry_link_team_insert on public.journal_entry_link;
create policy journal_entry_link_team_insert on public.journal_entry_link for insert to authenticated
  with check (
    is_team() and created_by = (select auth.uid())
    and exists (select 1 from public.journal_entry e where e.id = journal_entry_link.entry_id)
    and (contact_id is null or exists (select 1 from public."Contact" c where c."ContactID" = journal_entry_link.contact_id))
  );

-- merge_contacts (live body, patched in place): move the lost contact's Journal links before it is deleted.
do $patch$
declare
  v_def    text := pg_get_functiondef('public.merge_contacts(integer, integer)'::regprocedure);
  v_anchor text := '  update public.page_view      set team_contact_id = p_keep where team_contact_id = p_lose;';
  v_add    text := $add$
  -- Journal person links (journal_step_b2.sql): a duplicate on the same entry goes, the rest move.
  perform set_config('pem.contact_merge', 'on', true);
  delete from public.journal_entry_link l
   where l.contact_id = p_lose
     and exists (select 1 from public.journal_entry_link k where k.contact_id = p_keep and k.entry_id = l.entry_id);
  update public.journal_entry_link set contact_id = p_keep where contact_id = p_lose;
  perform set_config('pem.contact_merge', '', true);$add$;
begin
  if position('journal_entry_link' in v_def) > 0 then
    raise notice 'merge_contacts already moves Journal links';
  elsif position(v_anchor in v_def) = 0 then
    raise exception 'merge_contacts: anchor line not found — patch by hand';
  else
    execute replace(v_def, v_anchor, v_anchor || v_add);
  end if;
end;
$patch$;

-- ── 2. A photo's text is a Journal entry ─────────────────────────────────────────────────────────────────
alter table public.inspiration_photo
  add column if not exists hidden_at timestamptz,
  add column if not exists meta jsonb;
alter table public.inspiration_photo drop constraint if exists inspiration_photo_meta_ck;
alter table public.inspiration_photo add constraint inspiration_photo_meta_ck
  check (meta is null or jsonb_typeof(meta) = 'object');

alter table public.journal_entry
  add column if not exists photo_id uuid references public.inspiration_photo(id) on delete restrict;
create unique index if not exists journal_entry_photo_uq
  on public.journal_entry (photo_id) where photo_id is not null;

-- photo_id joins the frozen columns.
create or replace function public.journal_entry_guard()
returns trigger language plpgsql set search_path to 'public' as $$
declare
  v_moving boolean := coalesce(current_setting('pem.journal_move', true), '') = 'on';
begin
  if tg_op = 'DELETE' then
    raise exception 'journal_no_delete' using errcode = '42501',
      detail = 'Journal entries are never deleted; an admin can hide one.';
  end if;

  if new.body is distinct from old.body
     or new.kind is distinct from old.kind
     or ((new.event_on is distinct from old.event_on or new.event_precision is distinct from old.event_precision) and not v_moving)
     or new.created_at is distinct from old.created_at
     or new.author_id is distinct from old.author_id
     or new.provenance is distinct from old.provenance
     or new.corrects_id is distinct from old.corrects_id
     or new.voice_note_id is distinct from old.voice_note_id
     or new.photo_id is distinct from old.photo_id
     or new.source_key is distinct from old.source_key
     or new.engine is distinct from old.engine then
    raise exception 'journal_append_only' using errcode = '23514',
      detail = 'An entry is never edited; write a new entry that corrects it.';
  end if;

  if (new.visibility is distinct from old.visibility
      or new.hidden_at is distinct from old.hidden_at
      or new.hidden_by is distinct from old.hidden_by)
     and auth.uid() is not null and not is_admin() then
    raise exception 'journal_admin_only' using errcode = '42501',
      detail = 'Only an admin changes visibility or hides an entry.';
  end if;

  return new;
end;
$$;

-- The photo follows its entry: hiding / showing the entry hides / shows the photo (one place decides).
create or replace function public.journal_entry_photo_hidden_sync()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  update public.inspiration_photo set hidden_at = new.hidden_at
   where id = new.photo_id and hidden_at is distinct from new.hidden_at;
  return new;
end;
$$;
drop trigger if exists trg_journal_entry_photo_hidden_sync on public.journal_entry;
create trigger trg_journal_entry_photo_hidden_sync
  after update of hidden_at on public.journal_entry
  for each row when (new.photo_id is not null and new.hidden_at is distinct from old.hidden_at)
  execute function public.journal_entry_photo_hidden_sync();

-- The one door for a photo's text (admin, as every photo write). p_links: [{"kind":"oeuvre"|"concept"|"contact","id":…}].
-- Answers {entry_id, caption, changed}. Raises: not_allowed, not_found, hidden, text_required, bad_link.
create or replace function public.inspiration_photo_set_text(p_photo uuid, p_text text, p_links jsonb default '[]'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid     uuid := auth.uid();
  v_photo   public.inspiration_photo;
  v_text    text := nullif(btrim(coalesce(p_text, '')), '');
  v_root    public.journal_entry;
  v_shown   text;
  v_entry   bigint;
  v_changed boolean := false;
  v_link    jsonb;
  v_kind    text;
  v_n       integer;
begin
  if v_uid is null or not is_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select * into v_photo from public.inspiration_photo where id = p_photo for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_photo.hidden_at is not null then
    raise exception 'hidden' using errcode = '23514';
  end if;
  if v_text is not null and length(v_text) > 2000 then
    v_text := left(v_text, 2000);
  end if;
  if jsonb_typeof(coalesce(p_links, '[]'::jsonb)) <> 'array' then
    raise exception 'bad_link' using errcode = '22023';
  end if;

  select * into v_root from public.journal_entry where photo_id = p_photo and corrects_id is null;
  if found then
    -- Shown text = its latest visible correction, else its own body (as node_search_text reads it).
    select coalesce(
      (select c.body from public.journal_entry c where c.corrects_id = v_root.id and c.hidden_at is null
        order by c.created_at desc, c.id desc limit 1),
      v_root.body) into v_shown;
    if v_text is null then
      raise exception 'text_required' using errcode = '23514',
        detail = 'The text of a photo in the Journal is corrected, never emptied.';
    end if;
    v_entry := v_root.id;
    if v_text is distinct from v_shown then
      insert into public.journal_entry (event_on, event_precision, kind, body, provenance, verification, visibility, author_id, corrects_id)
      values (v_root.event_on, v_root.event_precision, v_root.kind, v_text, 'photo', 'verified', v_root.visibility, v_uid, v_root.id);
      v_changed := true;
    end if;
  elsif v_text is not null then
    -- ai_links_at set: a photo's text gets no ✦ proposals (its card has no place to decide them); its links are typed.
    insert into public.journal_entry (event_on, event_precision, kind, body, provenance, verification, visibility, author_id, photo_id, ai_links_at)
    values (v_photo.day, 'day', 'note', v_text, 'photo', 'verified', 'team', v_uid, p_photo, now())
    returning id into v_entry;
    v_changed := true;
  end if;

  if v_photo.caption is distinct from v_text then
    update public.inspiration_photo set caption = v_text where id = p_photo;
    v_changed := true;
  end if;

  if v_entry is not null then
    for v_link in select * from jsonb_array_elements(coalesce(p_links, '[]'::jsonb)) loop
      v_kind := v_link->>'kind';
      if v_kind = 'oeuvre' and (v_link->>'id') ~ '^\d{1,6}$' then
        insert into public.journal_entry_link (entry_id, oeuvre_id, relation, proposed_by, validated_at, created_by)
        values (v_entry, (v_link->>'id')::int, 'about', 'pem', now(), v_uid) on conflict do nothing;
      elsif v_kind = 'concept' and (v_link->>'id') ~* '^[0-9a-f-]{36}$' then
        insert into public.journal_entry_link (entry_id, concept_id, relation, proposed_by, validated_at, created_by)
        values (v_entry, (v_link->>'id')::uuid, 'about', 'pem', now(), v_uid) on conflict do nothing;
      elsif v_kind = 'contact' and (v_link->>'id') ~ '^\d{1,9}$' then
        insert into public.journal_entry_link (entry_id, contact_id, relation, proposed_by, validated_at, created_by)
        values (v_entry, (v_link->>'id')::int, 'about', 'pem', now(), v_uid) on conflict do nothing;
      else
        raise exception 'bad_link' using errcode = '22023';
      end if;
      get diagnostics v_n = row_count;
      if v_n > 0 then v_changed := true; end if;
    end loop;
    -- The photo's own two columns keep their first work / idea (their readers stay as they are).
    update public.inspiration_photo p set
      oeuvre_id  = coalesce(p.oeuvre_id,  (select (l->>'id')::int  from jsonb_array_elements(p_links) l where l->>'kind' = 'oeuvre'  limit 1)),
      concept_id = coalesce(p.concept_id, (select (l->>'id')::uuid from jsonb_array_elements(p_links) l where l->>'kind' = 'concept' limit 1))
    where p.id = p_photo
      and ((p.oeuvre_id is null and p_links @> '[{"kind":"oeuvre"}]') or (p.concept_id is null and p_links @> '[{"kind":"concept"}]'));
  elsif jsonb_array_length(coalesce(p_links, '[]'::jsonb)) > 0 then
    raise exception 'text_required' using errcode = '23514', detail = 'A link is written with text.';
  end if;

  return jsonb_build_object('entry_id', v_entry, 'caption', v_text, 'changed', v_changed);
end;
$$;

-- Removing a photo (admin). With an entry: hidden (entry + photo, by the sync trigger), answers 'hidden'.
-- Without: the row goes, answers 'deleted' with its image key (the server door recycles the files).
create or replace function public.inspiration_photo_remove(p_photo uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid   uuid := auth.uid();
  v_photo public.inspiration_photo;
  v_entry bigint;
begin
  if v_uid is null or not is_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select * into v_photo from public.inspiration_photo where id = p_photo for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  select id into v_entry from public.journal_entry where photo_id = p_photo and corrects_id is null;
  if v_entry is not null then
    if v_photo.hidden_at is not null then
      raise exception 'hidden' using errcode = '23514';
    end if;
    update public.journal_entry set hidden_at = now(), hidden_by = v_uid where id = v_entry;
    return jsonb_build_object('result', 'hidden', 'entry_id', v_entry);
  end if;
  delete from public.inspiration_photo where id = p_photo;
  return jsonb_build_object('result', 'deleted', 'image_key', v_photo.image_key);
end;
$$;

revoke all on function public.inspiration_photo_set_text(uuid, text, jsonb) from public, anon;
revoke all on function public.inspiration_photo_remove(uuid) from public, anon;
grant execute on function public.inspiration_photo_set_text(uuid, text, jsonb) to authenticated;
grant execute on function public.inspiration_photo_remove(uuid) to authenticated;
revoke all on function public.journal_entry_photo_hidden_sync() from public, anon, authenticated;

-- A correction asks for new ✦ proposals (journal_suggest_from_shown_text.sql) — never for a photo's text.
create or replace function public.journal_correction_resuggest()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if new.corrects_id is not null and new.hidden_at is null
     and not exists (select 1 from public.journal_entry r where r.id = new.corrects_id and r.photo_id is not null) then
    update public.journal_entry set ai_links_at = null where id = new.corrects_id and ai_links_at is not null;
    perform public.graph_mark_nodes_pending('journal_entry', new.corrects_id::text);
  end if;
  return new;
end;
$$;

-- The 3 photos that already have text: their entry, written as by their author on their day, with their links.
insert into public.journal_entry (event_on, event_precision, kind, body, provenance, verification, visibility, author_id, photo_id, ai_links_at)
select p.day, 'day', 'note', left(btrim(p.caption), 2000), 'photo', 'verified', 'team', p.author_id, p.id, now()
from public.inspiration_photo p
where nullif(btrim(coalesce(p.caption, '')), '') is not null
  and not exists (select 1 from public.journal_entry e where e.photo_id = p.id);

insert into public.journal_entry_link (entry_id, oeuvre_id, relation, proposed_by, validated_at, created_by)
select e.id, p.oeuvre_id, 'about', 'pem', now(), p.author_id
from public.inspiration_photo p join public.journal_entry e on e.photo_id = p.id and e.corrects_id is null
where p.oeuvre_id is not null
on conflict do nothing;
insert into public.journal_entry_link (entry_id, concept_id, relation, proposed_by, validated_at, created_by)
select e.id, p.concept_id, 'about', 'pem', now(), p.author_id
from public.inspiration_photo p join public.journal_entry e on e.photo_id = p.id and e.corrects_id is null
where p.concept_id is not null
on conflict do nothing;

-- The day counts: a photo's entry is counted as the photo (once), a hidden photo not at all.
create or replace function public.journal_scale(p_before date default null::date, p_limit integer default 14, p_grain text default 'day'::text)
returns table(bucket date, entries integer, voices integer, photos integer, remarks integer, creation integer, proposals integer)
language sql
stable
set search_path to 'public'
as $function$
  with src as (
    select e.event_on as d, case when e.photo_id is null then 1 else 0 end as e, 0 as v, 0 as p, 0 as r, 0 as c,
      (select count(*) from journal_entry_link l
        where l.entry_id = e.id and l.proposed_by = 'ai' and l.validated_at is null and l.rejected_at is null)::int as s
    from journal_entry e
    where e.corrects_id is null and e.hidden_at is null
    union all
    select (v.created_at at time zone 'Europe/Paris')::date, 0, 1, 0, 0, 0, 0
    from voice_note v
    where not exists (select 1 from journal_entry e where e.voice_note_id = v.id)
    union all
    select p.day, 0, 0, 1, 0, 0, 0 from inspiration_photo p where p.hidden_at is null
    union all
    select (n.created_at at time zone 'Europe/Paris')::date, 0, 0, 0, 1, 0, 0 from note_line n where n.discarded_at is null
    union all
    select (k.created_at at time zone 'Europe/Paris')::date, 0, 0, 0, 0, 1, 0 from kaizen_item k where k.section = 'creation'
  ),
  b as (
    select (case p_grain
              when 'month' then date_trunc('month', d)
              when 'year' then date_trunc('year', d)
              else d end)::date as bucket,
           e, v, p, r, c, s
    from src
  )
  select bucket, sum(e)::int, sum(v)::int, sum(p)::int, sum(r)::int, sum(c)::int, sum(s)::int
  from b
  where p_before is null or bucket < p_before
  group by bucket
  order by bucket desc
  limit least(greatest(coalesce(p_limit, 14), 1), 400)
$function$;

-- ── 3. The photo's own data; its place, admin only ───────────────────────────────────────────────────────
create table if not exists public.inspiration_photo_place (
  photo_id   uuid primary key references public.inspiration_photo(id) on delete cascade,
  lat        double precision not null,
  lon        double precision not null,
  alt        double precision,
  created_at timestamptz not null default now(),
  constraint inspiration_photo_place_ck check (lat between -90 and 90 and lon between -180 and 180)
);
alter table public.inspiration_photo_place enable row level security;
drop policy if exists inspiration_photo_place_admin on public.inspiration_photo_place;
create policy inspiration_photo_place_admin on public.inspiration_photo_place for all to authenticated
  using (is_admin()) with check (is_admin());
revoke all on public.inspiration_photo_place from anon, authenticated, public;
grant select, insert, update, delete on public.inspiration_photo_place to authenticated;

-- A `gps` {lat, lon, alt} written into meta (the photo doors send it there) goes to the place row; meta keeps
-- the rest, which the team reads. Bad coordinates are dropped, never stored in meta.
create or replace function public.inspiration_photo_meta_place()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare
  v_gps jsonb := new.meta->'gps';
begin
  if v_gps is null then
    return new;
  end if;
  if jsonb_typeof(v_gps) = 'object'
     and (v_gps->>'lat') ~ '^-?\d+(\.\d+)?$' and (v_gps->>'lon') ~ '^-?\d+(\.\d+)?$'
     and abs((v_gps->>'lat')::float8) <= 90 and abs((v_gps->>'lon')::float8) <= 180 then
    insert into public.inspiration_photo_place (photo_id, lat, lon, alt)
    values (new.id, (v_gps->>'lat')::float8, (v_gps->>'lon')::float8,
            case when (v_gps->>'alt') ~ '^-?\d+(\.\d+)?$' then (v_gps->>'alt')::float8 end)
    on conflict (photo_id) do update set lat = excluded.lat, lon = excluded.lon, alt = excluded.alt;
  end if;
  update public.inspiration_photo set meta = meta - 'gps' where id = new.id;
  return new;
end;
$$;
revoke all on function public.inspiration_photo_meta_place() from public, anon, authenticated;
drop trigger if exists trg_inspiration_photo_meta_place on public.inspiration_photo;
create trigger trg_inspiration_photo_meta_place
  after insert or update of meta on public.inspiration_photo
  for each row when (new.meta ? 'gps')
  execute function public.inspiration_photo_meta_place();

commit;
