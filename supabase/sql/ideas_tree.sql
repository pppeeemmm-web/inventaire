-- Idées — the idea tree fed by the Journal (design docs/design/2026-11-23/IdeasDesign.md, approved by Pem 2026-11-23;
-- « start the build »). Nothing moved, nothing deleted.
--   1. Branches: concept.parent_id (an idea grows on another idea, any depth, never a loop).
--   2. Who planted it: concept.created_by (today's ideas → the admin; the author moves the stage).
--   3. History: concept_change (planted, stage, title, text, branch moved) — the Journal and the idea's Fil read it.
--   4. Rules (commandments 1, 2): the team reads and writes ideas; the stage moves only for the author or an admin;
--      created_by never changes; only an admin deletes (and a delete is refused while moments or branches point to it).
--   5. The one door in: idea_plant(title, body, from_entry, parent) — the idea, its moment (written on today when none
--      is given), the link and the label Idée, all or nothing.
--   6. The list read: idea_list(stage, limit, offset) — ideas by last moment, with counts asked of the database.
-- Proven on the throwaway copy first (scripts/stress), then live with Pem's OK.

begin;

-- ── 1 + 2. Columns ──────────────────────────────────────────────────────────────────────────────────────
alter table public.concept add column if not exists parent_id  uuid references public.concept(id) on delete restrict;
alter table public.concept add column if not exists created_by uuid default auth.uid();
create index if not exists concept_parent_idx on public.concept (parent_id) where parent_id is not null;

-- Ideas made before this change were all made by the admin (createConcept was admin-only).
update public.concept
   set created_by = (select c.auth_user_id from public."Contact" c where c.is_admin and c.auth_user_id is not null order by c.auth_user_id limit 1)
 where created_by is null;

-- ── 3. History ──────────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.concept_change (
  id          bigint generated always as identity primary key,
  concept_id  uuid not null references public.concept(id) on delete cascade,
  what        text not null,
  from_value  text,
  to_value    text,
  changed_by  uuid,
  changed_at  timestamptz not null default now(),
  constraint concept_change_what_ck check (what in ('planted', 'stage', 'title', 'text', 'parent'))
);
create index if not exists concept_change_concept_idx on public.concept_change (concept_id, changed_at desc);
create index if not exists concept_change_at_idx on public.concept_change (changed_at desc);
alter table public.concept_change enable row level security;
drop policy if exists concept_change_select on public.concept_change;
create policy concept_change_select on public.concept_change for select to authenticated using (is_team());
revoke all on public.concept_change from anon, authenticated, public;
grant select on public.concept_change to authenticated;
-- Written only by the trigger below (security definer); nobody inserts, edits or deletes by hand.

-- ── 4. Rules ────────────────────────────────────────────────────────────────────────────────────────────
-- Before insert / update: the stage rule, created_by frozen, no loop in the tree.
create or replace function public.concept_guard()
returns trigger language plpgsql set search_path to 'public' as $$
declare
  v_uid uuid := auth.uid();
  v_hit boolean;
begin
  if tg_op = 'INSERT' then
    if v_uid is not null then new.created_by := v_uid; end if;
  else
    if new.created_by is distinct from old.created_by and v_uid is not null then
      raise exception 'idea_author_frozen' using errcode = '42501';
    end if;
    if new.maturity is distinct from old.maturity and v_uid is not null
       and not is_admin() and old.created_by is distinct from v_uid then
      raise exception 'idea_stage_not_allowed' using errcode = '42501',
        detail = 'The stage of an idea is moved by its author (or an admin).';
    end if;
  end if;

  if new.parent_id is not null and (tg_op = 'INSERT' or new.parent_id is distinct from old.parent_id) then
    if new.parent_id = new.id then
      raise exception 'idea_loop' using errcode = '23514';
    end if;
    with recursive up(id) as (
      select c.parent_id from public.concept c where c.id = new.parent_id
      union
      select c.parent_id from public.concept c join up on c.id = up.id where c.parent_id is not null
    )
    select exists (select 1 from up where up.id = new.id) into v_hit;
    if v_hit then
      raise exception 'idea_loop' using errcode = '23514',
        detail = 'An idea cannot grow on one of its own branches.';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_concept_guard on public.concept;
create trigger trg_concept_guard before insert or update on public.concept
  for each row execute function public.concept_guard();

-- After insert / update: one history line per change that the Journal shows.
create or replace function public.concept_log_change()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare
  v_uid uuid := coalesce(auth.uid(), new.created_by);
begin
  if tg_op = 'INSERT' then
    insert into public.concept_change (concept_id, what, to_value, changed_by) values (new.id, 'planted', new.maturity, v_uid);
    return new;
  end if;
  if new.maturity is distinct from old.maturity then
    insert into public.concept_change (concept_id, what, from_value, to_value, changed_by) values (new.id, 'stage', old.maturity, new.maturity, v_uid);
  end if;
  if new.titre is distinct from old.titre then
    insert into public.concept_change (concept_id, what, from_value, to_value, changed_by) values (new.id, 'title', old.titre, new.titre, v_uid);
  end if;
  if new.description is distinct from old.description then
    insert into public.concept_change (concept_id, what, from_value, to_value, changed_by) values (new.id, 'text', old.description, new.description, v_uid);
  end if;
  if new.parent_id is distinct from old.parent_id then
    insert into public.concept_change (concept_id, what, from_value, to_value, changed_by) values (new.id, 'parent', old.parent_id::text, new.parent_id::text, v_uid);
  end if;
  return new;
end;
$$;
revoke execute on function public.concept_log_change() from public, anon, authenticated;
drop trigger if exists trg_concept_log_change on public.concept;
create trigger trg_concept_log_change after insert or update on public.concept
  for each row execute function public.concept_log_change();

-- Policies: was one « is_team() for everything » (any team member could delete an idea from a browser file).
drop policy if exists concept_team on public.concept;
drop policy if exists concept_select on public.concept;
drop policy if exists concept_insert on public.concept;
drop policy if exists concept_update on public.concept;
drop policy if exists concept_delete on public.concept;
create policy concept_select on public.concept for select to authenticated using (is_team());
create policy concept_insert on public.concept for insert to authenticated with check (is_team());
create policy concept_update on public.concept for update to authenticated using (is_team()) with check (is_team());
create policy concept_delete on public.concept for delete to authenticated using (is_admin());
revoke truncate, trigger, references on public.concept from anon, authenticated;

-- ── 5. The door in ──────────────────────────────────────────────────────────────────────────────────────
-- Plants an idea (graine). With p_from_entry: that moment becomes its first page and stays on its day.
-- Without: a moment is written on today (Paris) with p_body (or the title). Then the link (human, validated) and
-- the label Idée on the moment. Invoker: every write goes through the table rules above and the Journal's.
-- Answers {concept_id, entry_id}, or raises: not_allowed, empty, not_found (entry or parent).
create or replace function public.idea_plant(p_title text, p_body text default null, p_from_entry bigint default null, p_parent uuid default null)
returns jsonb
language plpgsql
security invoker
set search_path to 'public'
as $$
declare
  v_uid     uuid := auth.uid();
  v_title   text := left(btrim(coalesce(p_title, '')), 200);
  v_body    text := left(btrim(coalesce(p_body, '')), 20000);
  v_entry   bigint;
  v_concept uuid;
begin
  if v_uid is null or not is_team() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if v_title = '' then
    raise exception 'empty' using errcode = '22023';
  end if;
  if p_parent is not null and not exists (select 1 from public.concept where id = p_parent) then
    raise exception 'not_found' using errcode = 'P0002', detail = 'parent';
  end if;

  if p_from_entry is not null then
    select e.id into v_entry from public.journal_entry e where e.id = p_from_entry;
    if v_entry is null then
      raise exception 'not_found' using errcode = 'P0002', detail = 'entry';
    end if;
  else
    insert into public.journal_entry (kind, body, provenance, verification, visibility, author_id)
      values ('spark', case when v_body = '' then v_title else v_body end, 'typed', 'verified', 'team', v_uid)
      returning id into v_entry;
  end if;

  insert into public.concept (titre, statut, category, weight, maturity, parent_id, created_by)
    values (v_title, 'idee', 'artistic', 'petite', 'graine', p_parent, v_uid)
    returning id into v_concept;

  insert into public.journal_entry_link (entry_id, concept_id, relation, proposed_by, validated_at, created_by)
    values (v_entry, v_concept, 'about', 'pem', now(), v_uid);

  if not exists (select 1 from public.journal_entry_label l where l.entry_id = v_entry and l.label = 'idea' and l.removed_at is null) then
    insert into public.journal_entry_label (entry_id, label, created_by) values (v_entry, 'idea', v_uid);
  end if;

  return jsonb_build_object('concept_id', v_concept, 'entry_id', v_entry);
end;
$$;
revoke execute on function public.idea_plant(text, text, bigint, uuid) from public, anon;
grant execute on function public.idea_plant(text, text, bigint, uuid) to authenticated;

-- ── 6. The list ─────────────────────────────────────────────────────────────────────────────────────────
-- Ideas by last moment (newest first). Counts asked of the database (commandment 7); a moment = a visible original
-- entry (not hidden, not a correction) linked to the idea and validated. Invoker: RLS hides others' private entries.
create or replace function public.idea_list(p_stage text default null, p_limit integer default 50, p_offset integer default 0)
returns table (
  id uuid, titre text, maturity text, parent_id uuid, created_by uuid, oeuvre_id integer, created_at timestamptz,
  moments integer, days integer, works integer, documents integer, branches integer, last_at timestamptz
)
language sql
stable
security invoker
set search_path to 'public'
as $$
  with m as (
    select l.concept_id, e.id as entry_id, e.event_on, e.created_at
      from public.journal_entry_link l
      join public.journal_entry e on e.id = l.entry_id
     where l.concept_id is not null and l.validated_at is not null and l.rejected_at is null
       and e.hidden_at is null and e.corrects_id is null
  ),
  w as (
    select m.concept_id, l2.oeuvre_id
      from m join public.journal_entry_link l2 on l2.entry_id = m.entry_id
     where l2.oeuvre_id is not null and l2.validated_at is not null and l2.rejected_at is null
  )
  select c.id, c.titre, c.maturity, c.parent_id, c.created_by, c.oeuvre_id, c.created_at,
         (select count(distinct m.entry_id) from m where m.concept_id = c.id)::int,
         (select count(distinct m.event_on) from m where m.concept_id = c.id)::int,
         (select count(distinct x.oeuvre_id) from (select w.oeuvre_id from w where w.concept_id = c.id
                                                   union select c.oeuvre_id where c.oeuvre_id is not null) x)::int,
         (select count(*) from public.document d where d.concept_id = c.id)::int,
         (select count(*) from public.concept k where k.parent_id = c.id)::int,
         greatest(c.created_at,
                  (select max(m.created_at) from m where m.concept_id = c.id),
                  (select max(h.changed_at) from public.concept_change h where h.concept_id = c.id))
    from public.concept c
   where p_stage is null or c.maturity = p_stage
   order by 13 desc, c.id
   limit greatest(1, least(coalesce(p_limit, 50), 200)) offset greatest(0, coalesce(p_offset, 0));
$$;
revoke execute on function public.idea_list(text, integer, integer) from public, anon;
grant execute on function public.idea_list(text, integer, integer) to authenticated;

commit;
