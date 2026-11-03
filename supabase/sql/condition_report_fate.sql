-- Destroyed / Lost works, recorded through condition reports (owner 2026-11-03).
--
-- A constat now has a kind: 'examination' (every report until now), 'destroyed' or 'lost'.
-- A destroyed / lost constat carries the date of the event, which differs from the report date
-- (examined_on); empty = the report date. The event date may be partial: event_precision says
-- whether it is known to the year, the month or the day (stored as the first day of the period).
-- A lost constat is closed with resolved_on when the work is found again.
--
-- The work's current fate is mirrored on Oeuvres (fate, fate_on, fate_precision) by trigger, so
-- lists read it without a join. Never write these columns from the app.
--   * Pem still owns the work (En production, Disponible, Archive artiste, Réservé, Consigné,
--     Prêt): status becomes Destroyed (9) / Lost (10); the previous status is kept in
--     status_before_fate and restored when the lost constat is resolved or the constat removed.
--   * Sold / Gift: status stays (buyer, price, income, provenance kept); only the fate is set.
-- A work with a fate is never public.
-- Destroyed / lost constats are admin only (they take a work out of circulation).
--
-- No GRANT/RLS changes: new columns on existing tables (table-level grants cover them).
-- The sync function is SECURITY DEFINER (it updates Oeuvres from a constat write); it is a
-- trigger function, not callable through PostgREST; EXECUTE is revoked anyway.

-- ── Columns ─────────────────────────────────────────────────────────────────────────────────
alter table public.condition_report
  add column if not exists kind text not null default 'examination',
  add column if not exists event_on date,
  add column if not exists event_precision text,
  add column if not exists resolved_on date;

alter table public.condition_report drop constraint if exists condition_report_kind_ck;
alter table public.condition_report add constraint condition_report_kind_ck
  check (kind in ('examination', 'destroyed', 'lost'));

alter table public.condition_report drop constraint if exists condition_report_event_ck;
alter table public.condition_report add constraint condition_report_event_ck check (
  (event_precision is null or event_precision in ('year', 'month', 'day'))
  and ((event_on is null) = (event_precision is null))
  and (kind <> 'examination' or (event_on is null and resolved_on is null))
  and (kind <> 'destroyed' or resolved_on is null)
);

alter table public."Oeuvres"
  add column if not exists fate text,
  add column if not exists fate_on date,
  add column if not exists fate_precision text,
  add column if not exists status_before_fate integer references public."OeuvreStatus"(id);

alter table public."Oeuvres" drop constraint if exists oeuvres_fate_ck;
alter table public."Oeuvres" add constraint oeuvres_fate_ck check (
  (fate is null or fate in ('destroyed', 'lost'))
  and (fate_precision is null or fate_precision in ('year', 'month', 'day'))
);

create index if not exists condition_report_fate_idx
  on public.condition_report (oeuvre_id) where kind in ('destroyed', 'lost') and resolved_on is null;

-- ── Admin gate on destroyed / lost constats ─────────────────────────────────────────────────
create or replace function public.condition_report_fate_check()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Only end users are gated (SQL / service scripts have no auth.uid()).
  if auth.uid() is not null and not is_admin() then
    if (tg_op <> 'INSERT' and old.kind <> 'examination')
       or (tg_op <> 'DELETE' and new.kind <> 'examination') then
      raise exception 'fate_admin_only' using errcode = '42501';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists condition_report_fate_check on public.condition_report;
create trigger condition_report_fate_check
  before insert or update or delete on public.condition_report
  for each row execute function public.condition_report_fate_check();

-- ── Constat → Oeuvres fate + status ─────────────────────────────────────────────────────────
create or replace function public.condition_report_fate_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_oid integer := coalesce(new.oeuvre_id, old.oeuvre_id);
  v_kind text;
  v_on date;
  v_prec text;
  v_status integer;
  v_before integer;
  v_has_fate boolean;
  o record;
begin
  select "statusId", status_before_fate into o from "Oeuvres" where "OeuvreID" = v_oid;
  if not found then
    return null; -- work being deleted (cascade)
  end if;

  -- The open fate constat with the latest event wins.
  select r.kind,
         coalesce(r.event_on, r.examined_on),
         case when r.event_on is null then 'day' else r.event_precision end
    into v_kind, v_on, v_prec
    from condition_report r
   where r.oeuvre_id = v_oid and r.kind in ('destroyed', 'lost') and r.resolved_on is null
   order by coalesce(r.event_on, r.examined_on) desc, r.id desc
   limit 1;
  v_has_fate := found;

  if v_has_fate then
    if o."statusId" in (9, 10) then
      v_status := case v_kind when 'destroyed' then 9 else 10 end;
      v_before := o.status_before_fate;
    elsif o."statusId" is null or o."statusId" in (1, 2, 3, 4, 7, 8) then
      v_status := case v_kind when 'destroyed' then 9 else 10 end;
      v_before := o."statusId";
    else
      v_status := o."statusId"; -- sold / gift keep their status
      v_before := null;
    end if;
  else
    v_kind := null; v_on := null; v_prec := null; v_before := null;
    v_status := case when o."statusId" in (9, 10) then coalesce(o.status_before_fate, 2) else o."statusId" end;
  end if;

  -- "statusId" always in the SET list so the status triggers (public flag, production span) run.
  update "Oeuvres"
     set fate = v_kind, fate_on = v_on, fate_precision = v_prec,
         status_before_fate = v_before, "statusId" = v_status
   where "OeuvreID" = v_oid
     and (fate, fate_on, fate_precision, status_before_fate, "statusId")
         is distinct from (v_kind, v_on, v_prec, v_before, v_status);
  return null;
end;
$$;

revoke execute on function public.condition_report_fate_sync() from public, anon, authenticated;

drop trigger if exists condition_report_fate_sync on public.condition_report;
create trigger condition_report_fate_sync
  after insert or update or delete on public.condition_report
  for each row execute function public.condition_report_fate_sync();

-- ── Guard: a work saved while destroyed / lost keeps that status ────────────────────────────
-- The drawer locks the stages, but any write path sending an "owned by Pem" status for a work
-- with a fate is turned back into Destroyed / Lost. Fires before trg_sync_is_public (name order).
create or replace function public.oeuvre_fate_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.fate is not null and coalesce(new."statusId", 1) in (1, 2, 3, 4, 7, 8) then
    if tg_op = 'INSERT' or old."statusId" is null or old."statusId" not in (9, 10) then
      new.status_before_fate := new."statusId";
    end if;
    new."statusId" := case new.fate when 'destroyed' then 9 else 10 end;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_oeuvre_fate_guard on public."Oeuvres";
create trigger trg_oeuvre_fate_guard
  before insert or update of "statusId", fate on public."Oeuvres"
  for each row execute function public.oeuvre_fate_guard();

-- ── Public flag: never public with a fate ───────────────────────────────────────────────────
create or replace function public.sync_is_public_from_status()
returns trigger
language plpgsql
set search_path = public
as $$
BEGIN
  NEW.is_public := NEW."statusId" = ANY(ARRAY[2, 4, 6, 7, 8, 11]) AND NEW.fate IS NULL;
  RETURN NEW;
END;
$$;

drop trigger if exists trg_sync_is_public on public."Oeuvres";
create trigger trg_sync_is_public
  before insert or update of "statusId", fate on public."Oeuvres"
  for each row execute function public.sync_is_public_from_status();
