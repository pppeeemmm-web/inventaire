-- Review tool, step 1 (docs/design/2026-11-28/ReviewTool.md; Pem « Build feedback tool », 2026-11-28).
-- A report from the review window is a Kaizen item in the new section « app ». Added:
--   context      jsonb        page, build, device, pointed element — written once, at creation.
--   fixed_sha    text         the build that fixes it (set with « done »).
--   verified_at  timestamptz  Pem confirms on that build.
--   approved_at  timestamptz  Pem's OK to act. Pem's own reports are approved at creation; a team member's report
--                             stays « proposé » (null) until Pem approves. Only an admin sets it (the rule is here).
-- States are read from the columns (no state column): proposé (approved_at null) → ouvert → à vérifier (done_at set,
-- verified_at null) → confirmé (verified_at set). Reopen = done_at cleared, which also clears fixed_sha / verified_at.
-- Writers: createKaizen / updateKaizen / setKaizenDone / reviewKaizen (app/atelier/(portal)/kaizen/actions.ts).
-- Readers unchanged by the new columns: listKaizen `select *`, Journal « Création » (section = 'creation' only), Fil.

alter table public.kaizen_item add column if not exists context jsonb;
alter table public.kaizen_item add column if not exists fixed_sha text;
alter table public.kaizen_item add column if not exists verified_at timestamptz;
alter table public.kaizen_item add column if not exists approved_at timestamptz;

alter table public.kaizen_item drop constraint if exists kaizen_item_section_check;
alter table public.kaizen_item add constraint kaizen_item_section_check
  check (section in ('creation', 'website', 'business', 'app'));
alter table public.kaizen_item drop constraint if exists kaizen_item_suggested_section_check;
alter table public.kaizen_item add constraint kaizen_item_suggested_section_check
  check (suggested_section in ('creation', 'website', 'business', 'app'));
alter table public.kaizen_item drop constraint if exists kaizen_item_verified_done_ck;
alter table public.kaizen_item add constraint kaizen_item_verified_done_ck
  check (verified_at is null or done_at is not null);

-- Items filed before this rule were all read by Pem as they came: they count as approved (before the guard exists).
update public.kaizen_item set approved_at = created_at where approved_at is null;

create or replace function public.kaizen_item_review_guard() returns trigger
  language plpgsql set search_path to 'public' as $$
declare
  v_admin boolean := public.is_admin();
  v_db boolean := (select auth.uid()) is null; -- migrations / service role (no signed-in user)
begin
  if tg_op = 'INSERT' then
    if v_admin then
      new.approved_at := coalesce(new.approved_at, now());
    elsif not v_db then
      new.approved_at := null;
      new.verified_at := null;
    end if;
    return new;
  end if;

  if not v_admin and not v_db
     and (new.approved_at is distinct from old.approved_at or new.verified_at is distinct from old.verified_at) then
    raise exception 'kaizen_admin_only' using errcode = '42501';
  end if;
  -- App reports: a team member cannot tick a report Pem has not approved, nor reopen one Pem confirmed.
  if not v_admin and not v_db and new.section = 'app' then
    if new.done_at is not null and old.done_at is null and new.approved_at is null then
      raise exception 'kaizen_not_approved' using errcode = '42501';
    end if;
    if old.verified_at is not null and new.done_at is distinct from old.done_at then
      raise exception 'kaizen_admin_only' using errcode = '42501';
    end if;
  end if;
  if new.context is distinct from old.context and old.context is not null then
    raise exception 'kaizen_context_fixed' using errcode = '22023';
  end if;
  -- Reopen: the fix and its confirmation go with it.
  if old.done_at is not null and new.done_at is null then
    new.fixed_sha := null;
    new.verified_at := null;
  end if;
  return new;
end;
$$;

revoke execute on function public.kaizen_item_review_guard() from public, anon, authenticated;

drop trigger if exists kaizen_item_review_guard on public.kaizen_item;
create trigger kaizen_item_review_guard before insert or update on public.kaizen_item
  for each row execute function public.kaizen_item_review_guard();

create index if not exists kaizen_item_open_app_idx on public.kaizen_item (created_at desc)
  where section = 'app' and verified_at is null;
