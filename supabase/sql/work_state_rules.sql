-- Work state rules, build batch 1 (Pem's GO 2026-11-17, SQL included). Rules: docs/WORK_RULES.md.
--
--   Rule 5   In the studio (status 1 / 2, no fate) the status follows the stage:
--            Prêt (catalogued + photo validated) = Disponible, otherwise En production.
--   Rule 6/7 Tasks follow the stage: Cataloguer open ⇔ not catalogued; Photographier open ⇔
--            catalogued with the photo still to take. A ticked task keeps the day it was ticked.
--   Rule 8   Finished = the day the work becomes Prêt; leaving Prêt clears it + a history line
--            (Pem 2026-11-17; was « the day it is catalogued »).
--   Rule 12  Set aside: Archive (3) and Lost (10) pause open tasks, Destroyed (9) closes them —
--            same column (`paused_at`): out of every list; they come back only when the work comes
--            back (archive exit, lost found, a destruction report removed as a mistake).
--   Rule 14  Every change of status, owner or custodian writes its Historique line and its status
--            event here, in the database — the screens stop writing them.
--
-- Enforced here so the work card, batch edit, the Production board, the phone, orders, constats,
-- approved pending changes, restores and scripts all follow the same rule.
-- Supersedes: the task half of archive_shelf.sql (oeuvre_archive_tasks, work_action_archive_pause)
-- and oeuvre_production_span from archive_shelf.sql.
-- Repairs: work_state_repairs.sql (separate, run after this file).
-- No GRANT / RLS change. Trigger-only SECURITY DEFINER functions: EXECUTE revoked from API roles.
-- After applying: npm run gen:types

-- ── Rule 5: status follows the stage in the studio ────────────────────────────────────────────
-- Named to run first among the work's BEFORE triggers that read the status (name order).

create or replace function public.oeuvre_status_follows_stage()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.fate is null and new."statusId" in (1, 2) then
    new."statusId" := case
      when coalesce(new."Catalogué", false) and not coalesce(new."NeedsPhotograph", false) then 2
      else 1
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_oeuvre_a_status_follows_stage on public."Oeuvres";
create trigger trg_oeuvre_a_status_follows_stage
  before insert or update of "statusId", "Catalogué", "NeedsPhotograph", fate on public."Oeuvres"
  for each row execute function public.oeuvre_status_follows_stage();

-- The status can now change on a statement that only names the stage: is_public must follow.
drop trigger if exists trg_sync_is_public on public."Oeuvres";
create trigger trg_sync_is_public
  before insert or update of "statusId", fate, "Catalogué", "NeedsPhotograph" on public."Oeuvres"
  for each row execute function public.sync_is_public_from_status();

-- ── Rule 8: finished = Prêt ──────────────────────────────────────────────────────────────────

create or replace function public.oeuvre_production_span()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  today date := (now() at time zone 'Europe/Paris')::date;
  was_ready boolean := coalesce(old."Catalogué", false) and not coalesce(old."NeedsPhotograph", false);
  is_ready  boolean := coalesce(new."Catalogué", false) and not coalesce(new."NeedsPhotograph", false);
begin
  if tg_op = 'UPDATE' then
    -- Becomes Prêt: finished today, unless an end date is written in the same update.
    if is_ready and not was_ready then
      if new.production_completed_on is null
         or new.production_completed_on is not distinct from old.production_completed_on then
        new.production_completed_on := today;
        new.production_completed_precision := null;
      end if;
    end if;

    -- Leaves Prêt (back to cataloguing or to a new photo): the end goes, a line says so.
    if was_ready and not is_ready and old.production_completed_on is not null then
      new.production_completed_on := null;
      new.production_completed_precision := null;
      new."Historique" := concat_ws(
        E'\n',
        nullif(new."Historique", ''),
        '[' || to_char(today, 'YYYY/MM/DD') || '] Reprise en production (fin précédente : '
          || to_char(old.production_completed_on, 'YYYY/MM/DD') || ')'
      );
    end if;
  end if;

  if new."Année" is null and new.production_completed_on is not null then
    new."Année" := make_date(extract(year from new.production_completed_on)::int, 1, 1);
  end if;

  if new.production_started_on is not null
     and new.production_completed_on is not null
     and new.production_completed_on < new.production_started_on then
    raise exception 'production_completed_on (%) is before production_started_on (%)',
      new.production_completed_on, new.production_started_on;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_oeuvre_production_span on public."Oeuvres";
create trigger trg_oeuvre_production_span
  before insert or update of "Catalogué", "NeedsPhotograph", "statusId", "Année",
    production_started_on, production_completed_on,
    production_started_precision, production_completed_precision on public."Oeuvres"
  for each row execute function public.oeuvre_production_span();

-- ── Rules 6 / 7: tasks follow the stage ──────────────────────────────────────────────────────
-- 9 = Cataloguer, 6 = Photographier (work_action_type). One row per work and type (unique key).

create or replace function public.oeuvre_tasks_follow_stage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cat boolean := coalesce(new."Catalogué", false);
  photo boolean := coalesce(new."NeedsPhotograph", false);
begin
  if tg_op = 'UPDATE'
     and cat = coalesce(old."Catalogué", false)
     and photo = coalesce(old."NeedsPhotograph", false) then
    return null;
  end if;

  if not cat then
    -- Atelier: catalogue to do; no photo task yet.
    insert into work_action (oeuvre_id, action_type_id, done)
    values (new."OeuvreID", 9, false)
    on conflict (oeuvre_id, action_type_id) do update set done = false where work_action.done;
    delete from work_action where oeuvre_id = new."OeuvreID" and action_type_id = 6 and not done;
  elsif photo then
    -- Catalogued, photo to take.
    update work_action set done = true
     where oeuvre_id = new."OeuvreID" and action_type_id = 9 and not done;
    insert into work_action (oeuvre_id, action_type_id, done)
    values (new."OeuvreID", 6, false)
    on conflict (oeuvre_id, action_type_id) do update set done = false where work_action.done;
  else
    -- Prêt: both steps done.
    update work_action set done = true
     where oeuvre_id = new."OeuvreID" and action_type_id in (9, 6) and not done;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_oeuvre_tasks_follow_stage on public."Oeuvres";
create trigger trg_oeuvre_tasks_follow_stage
  after insert or update of "Catalogué", "NeedsPhotograph" on public."Oeuvres"
  for each row execute function public.oeuvre_tasks_follow_stage();

-- ── Rule 12 (+ archive): set-aside statuses pause / close tasks, coming back brings them back ──

create or replace function public.oeuvre_archive_tasks()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 3 Archive, 9 Détruite, 10 Perdue: open tasks leave every list.
  if new."statusId" in (3, 9, 10) and old."statusId" is distinct from new."statusId" then
    update work_action
       set paused_at = now()
     where oeuvre_id = new."OeuvreID" and not done and paused_at is null;
  elsif old."statusId" in (3, 9, 10) and new."statusId" not in (3, 9, 10) then
    update work_action
       set paused_at = null
     where oeuvre_id = new."OeuvreID" and paused_at is not null;
  end if;
  return null;
end;
$$;

-- One BEFORE trigger on tasks: set aside while the work is, and stamp the day a task is ticked.
create or replace function public.work_action_before_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.done then
    new.paused_at := null;
    if tg_op = 'INSERT' or not old.done then
      new.done_at := coalesce(new.done_at, now());
    end if;
  else
    new.done_at := null;
    if new.paused_at is null
       and exists (select 1 from "Oeuvres" where "OeuvreID" = new.oeuvre_id and "statusId" in (3, 9, 10)) then
      new.paused_at := now();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_work_action_archive_pause on public.work_action;
drop function if exists public.work_action_archive_pause();
drop trigger if exists trg_work_action_before_write on public.work_action;
create trigger trg_work_action_before_write
  before insert or update on public.work_action
  for each row execute function public.work_action_before_write();

-- ── Rule 14: history and status event written by the database ───────────────────────────────

create or replace function public.oeuvre_contact_label(p_id integer, p_with_place boolean default false)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when c."ContactID" is null then '—'
    else coalesce(nullif(trim(c."NomInstitution"), ''),
                  nullif(trim(concat_ws(' ', c."Prénom", c."Nom")), ''), '—')
         || case when p_with_place
                 then ' - ' || coalesce(nullif(concat_ws(', ', nullif(trim(c."Ville"), ''), nullif(trim(c."Pays"), '')), ''), '?')
                 else '' end
  end
  from (select 1) one
  left join "Contact" c on c."ContactID" = p_id
$$;

create or replace function public.oeuvre_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  d text := to_char((now() at time zone 'Europe/Paris')::date, 'YYYY/MM/DD');
  lines text[] := '{}';
  ln text;
  hist text;
  v_exam date;
  v_found date;
  old_loc integer := coalesce(old."LocalisationID", old."ContactID");
  new_loc integer := coalesce(new."LocalisationID", new."ContactID");
  st_fr text[] := array['En production', 'Disponible', 'Archive artiste', 'Réservé', 'statut 5',
                        'Vendu', 'Consigné', 'Prêt', 'Détruite', 'Perdue', 'Don'];
begin
  if new.fate is distinct from old.fate then
    if new.fate is not null then
      -- Destroyed / lost: dated at the event; the report day follows when it differs.
      select r.examined_on into v_exam
        from condition_report r
       where r.oeuvre_id = new."OeuvreID" and r.kind = new.fate and r.resolved_on is null
       order by coalesce(r.event_on, r.examined_on) desc, r.id desc
       limit 1;
      ln := '[' || case coalesce(new.fate_precision, 'day')
                     when 'year'  then to_char(coalesce(new.fate_on, v_exam), 'YYYY')
                     when 'month' then to_char(coalesce(new.fate_on, v_exam), 'YYYY/MM')
                     else to_char(coalesce(new.fate_on, v_exam), 'YYYY/MM/DD') end
            || '] ' || case new.fate when 'destroyed' then 'Détruite' else 'Perdue' end
            || case when v_exam is not null and new.fate_on is not null and new.fate_on <> v_exam
                    then ' — constat du ' || to_char(v_exam, 'YYYY/MM/DD') else '' end;
      lines := lines || ln;
    else
      -- Fate gone: a lost work found (its report closed just now), or the report removed.
      select r.resolved_on into v_found
        from condition_report r
       where r.oeuvre_id = new."OeuvreID" and r.kind = 'lost' and r.resolved_on is not null
         and old.fate = 'lost' and r.updated_at >= now() - interval '1 minute'
       order by r.updated_at desc, r.id desc
       limit 1;
      if v_found is not null then
        lines := lines || ('[' || to_char(v_found, 'YYYY/MM/DD') || '] Retrouvée');
      else
        lines := lines || ('[' || d || '] Constat de '
                           || case old.fate when 'destroyed' then 'destruction' else 'perte' end || ' supprimé');
      end if;
    end if;
  elsif new."statusId" is distinct from old."statusId" and new."statusId" is not null then
    ln := '[' || d || '] ' || case new."statusId"
      when 11 then 'Don à ' || oeuvre_contact_label(new."ContactID")
      when 6  then 'Vendu à ' || oeuvre_contact_label(new."ContactID")
      when 4  then 'Réservé — ' || oeuvre_contact_label(coalesce(new."AcheteurID", new."ContactID"))
      when 7  then 'Consigné — ' || oeuvre_contact_label(new."LocalisationID")
      when 8  then 'Prêt — ' || oeuvre_contact_label(new."LocalisationID")
      else case
        when new."statusId" = 2 and old."statusId" in (7, 8) then 'Retour atelier'
        else coalesce(st_fr[old."statusId"], '?') || ' → ' || coalesce(st_fr[new."statusId"], 'statut ' || new."statusId")
      end
    end;
    lines := lines || ln;
  end if;

  if new_loc is not null and new_loc is distinct from old_loc then
    lines := lines || (d || ' - ' || oeuvre_contact_label(new_loc, true));
  end if;

  if cardinality(lines) = 0 then
    return new;
  end if;

  hist := nullif(new."Historique", '');
  foreach ln in array lines loop
    -- Skip a line already there (an older screen may have written it in the same save).
    if position(E'\n' || ln || E'\n' in E'\n' || replace(coalesce(hist, ''), E'\r', '') || E'\n') = 0 then
      hist := concat_ws(E'\n', hist, ln);
    end if;
  end loop;
  new."Historique" := hist;
  return new;
end;
$$;

drop trigger if exists trg_zz_oeuvre_history on public."Oeuvres";
create trigger trg_zz_oeuvre_history
  before update on public."Oeuvres"
  for each row execute function public.oeuvre_history();

create or replace function public.oeuvre_status_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into system_log (action, event_type, table_name, row_id, old_value, new_value, user_id, metadata)
  values ('STATUS_CHANGE Oeuvres#' || new."OeuvreID", 'STATUS_CHANGE', 'Oeuvres', new."OeuvreID"::text,
          to_jsonb(old."statusId"), to_jsonb(new."statusId"), auth.uid(),
          jsonb_build_object('titre', new."Titre", 'source', 'db'));
  return null;
end;
$$;

drop trigger if exists trg_oeuvre_status_event on public."Oeuvres";
create trigger trg_oeuvre_status_event
  after update on public."Oeuvres"
  for each row when (old."statusId" is distinct from new."statusId")
  execute function public.oeuvre_status_event();

-- Trigger-only SECURITY DEFINER functions: not callable through the API.
revoke execute on function public.oeuvre_tasks_follow_stage() from public, anon, authenticated;
revoke execute on function public.oeuvre_archive_tasks() from public, anon, authenticated;
revoke execute on function public.work_action_before_write() from public, anon, authenticated;
revoke execute on function public.oeuvre_history() from public, anon, authenticated;
revoke execute on function public.oeuvre_status_event() from public, anon, authenticated;
revoke execute on function public.oeuvre_contact_label(integer, boolean) from public, anon, authenticated;
