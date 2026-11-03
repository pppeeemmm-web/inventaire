-- Work lifetime gates (owner audit 2026-11-03, docs/TODO.md "Work lifetime gaps").
--
-- 2. Permanent delete of a work: admin only (was team). The app's purge was already admin-gated;
--    this closes the direct API path. Soft delete (deleted_at) stays a team UPDATE.
-- 5/6. Holder rules, every write path:
--    * Sold (6) / Gift (11): owner (ContactID) and location are someone other than Pem (13).
--    * Consigned (7) / Loan (8): Pem stays the owner (ContactID forced to 13); the custodian is
--      the location (LocalisationID) and must be someone other than Pem.
--    Anything else is refused with `holder_required` (errcode 23514).
--    Fires after trg_oeuvre_field_defaults (name order), so an empty location is filled first.
--    Checked before applying: 0 sold / consigned / loan works; the 7 gifts have holders ≠ Pem.
-- 10. Moving a sold / given work to the bin (deleted_at): admin only (`sold_delete_admin_only`).
-- 9. A destroyed / lost constat closes the work's open orders: a consignment / loan holding only
--    that work is closed ('returned', the only closed state) with a note; an open sale order
--    (draft / confirmed / deposit_paid) for that work alone is cancelled with a note; orders with
--    other works get the note only (the work itself already left 4 / 7 / 8 by its fate).
--
-- No GRANT changes. RLS change: "oeuvres: delete" narrowed to is_admin().

-- ── 2. Delete: admin only ───────────────────────────────────────────────────────────────────
drop policy if exists "oeuvres: delete" on public."Oeuvres";
create policy "oeuvres: delete" on public."Oeuvres"
  for delete to authenticated using (is_admin());

-- ── 5/6. Holder rules ───────────────────────────────────────────────────────────────────────
create or replace function public.oeuvre_holder_check()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new."statusId" in (7, 8) then
    new."ContactID" := 13; -- consigned / on loan: Pem keeps ownership
    if new."LocalisationID" is null or new."LocalisationID" = 13 then
      raise exception 'holder_required' using errcode = '23514',
        detail = 'Consigned / loan works need a custodian other than Pem.';
    end if;
  elsif new."statusId" in (6, 11) then
    if new."ContactID" is null or new."ContactID" = 13
       or new."LocalisationID" is null or new."LocalisationID" = 13 then
      raise exception 'holder_required' using errcode = '23514',
        detail = 'Sold / given works need an owner and a location other than Pem.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_oeuvre_holder_check on public."Oeuvres";
create trigger trg_oeuvre_holder_check
  before insert or update of "statusId", "ContactID", "LocalisationID" on public."Oeuvres"
  for each row execute function public.oeuvre_holder_check();

-- ── 10. Bin: sold / given works, admin only ─────────────────────────────────────────────────
create or replace function public.oeuvre_soft_delete_gate()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.deleted_at is not null and old.deleted_at is null
     and old."statusId" in (6, 11)
     and auth.uid() is not null and not is_admin() then
    raise exception 'sold_delete_admin_only' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_oeuvre_soft_delete_gate on public."Oeuvres";
create trigger trg_oeuvre_soft_delete_gate
  before update of deleted_at on public."Oeuvres"
  for each row execute function public.oeuvre_soft_delete_gate();

-- ── 9. Fate closes open orders (extends condition_report_fate.sql) ──────────────────────────
create or replace function public.oeuvre_batch_ids(p_notes text, p_oeuvre integer)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare v jsonb;
begin
  -- Orders list their works as "BATCH_IDS: [1,2]" in notes (consignments / sales actions).
  v := substring(coalesce(p_notes, '') from 'BATCH_IDS: (\[[^\]]*\])')::jsonb;
  return coalesce(v, jsonb_build_array(p_oeuvre));
exception when others then
  return jsonb_build_array(p_oeuvre);
end;
$$;

create or replace function public.oeuvre_fate_close_orders(p_oeuvre integer, p_kind text, p_on date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_ids jsonb;
  v_line text := '[' || to_char((now() at time zone 'Europe/Paris')::date, 'YYYY/MM/DD') || '] Œuvre #'
    || p_oeuvre || case p_kind when 'destroyed' then ' détruite' else ' perdue' end
    || ' (' || to_char(p_on, 'YYYY/MM/DD') || ')';
begin
  for r in select id, oeuvre_id, notes from consignment_order where status = 'active' loop
    v_ids := oeuvre_batch_ids(r.notes, r.oeuvre_id);
    continue when not v_ids @> to_jsonb(p_oeuvre);
    if jsonb_array_length(v_ids) <= 1 then
      update consignment_order
         set status = 'returned',
             end_date = least(coalesce(end_date, (now() at time zone 'Europe/Paris')::date), (now() at time zone 'Europe/Paris')::date),
             notes = concat_ws(E'\n', nullif(notes, ''), v_line || ' — clôturée.')
       where id = r.id;
    else
      update consignment_order set notes = concat_ws(E'\n', nullif(notes, ''), v_line) where id = r.id;
    end if;
  end loop;

  for r in select id, oeuvre_id, notes from sale_order where statut in ('draft', 'confirmed', 'deposit_paid') loop
    v_ids := oeuvre_batch_ids(r.notes, r.oeuvre_id);
    continue when not v_ids @> to_jsonb(p_oeuvre);
    if jsonb_array_length(v_ids) <= 1 then
      update sale_order
         set statut = 'cancelled', notes = concat_ws(E'\n', nullif(notes, ''), v_line || ' — annulée.')
       where id = r.id;
    else
      update sale_order set notes = concat_ws(E'\n', nullif(notes, ''), v_line) where id = r.id;
    end if;
  end loop;
end;
$$;

revoke execute on function public.oeuvre_fate_close_orders(integer, text, date) from public, anon, authenticated;

-- Same as condition_report_fate.sql, plus: when a fate first appears, close the open orders.
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
  select "statusId", status_before_fate, fate into o from "Oeuvres" where "OeuvreID" = v_oid;
  if not found then
    return null; -- work being deleted (cascade)
  end if;

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

  update "Oeuvres"
     set fate = v_kind, fate_on = v_on, fate_precision = v_prec,
         status_before_fate = v_before, "statusId" = v_status
   where "OeuvreID" = v_oid
     and (fate, fate_on, fate_precision, status_before_fate, "statusId")
         is distinct from (v_kind, v_on, v_prec, v_before, v_status);

  if v_has_fate and o.fate is null then
    perform oeuvre_fate_close_orders(v_oid, v_kind, v_on);
  end if;
  return null;
end;
$$;

revoke execute on function public.condition_report_fate_sync() from public, anon, authenticated;
