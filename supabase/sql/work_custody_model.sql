-- Work custody model (owner 2026-11-03) — see docs/WORK_CUSTODY_MODEL.md.
--
--   owner     = Oeuvres.ContactID
--   custodian = Oeuvres.LocalisationID   (whoever physically holds the work, always filled)
--   address   = Oeuvres.localisation_address_id (one of the custodian's addresses)
--
-- 1. oeuvre_holder_check (replaces work_lifetime_gates.sql §5): owner / custodian per status, and
--    a work leaves Pem's place only through an order (consignment / loan / sale delivery).
--    Ownership moves on a completed (paid) sale; custody moves on delivery. Gifts: owner decides.
-- 2. oeuvre_location_by_stage: Pem's address follows the stage (Atelier in production, Principal
--    from Available on); a hand-picked address is kept until the next stage change; an address
--    that is not the custodian's is cleared; a custodian with a single address fills it.
-- 3. Backfill: works Pem holds with no address get their stage address.
--
-- Trigger order (BEFORE, by name): … trg_oeuvre_fate_guard, trg_oeuvre_field_defaults,
-- trg_oeuvre_holder_check, trg_oeuvre_location_by_stage, trg_oeuvre_production_span …
-- No GRANT/RLS change: functions on existing tables. After applying: npm run gen:types.

-- ── Orders behind a work ────────────────────────────────────────────────────────────────────
-- security definer: the check must see orders whatever the caller's RLS. Read-only, boolean.
create or replace function public.oeuvre_order_exists(p_oeuvre integer, p_kind text, p_contact integer)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case p_kind
    when 'custody' then exists (
      select 1 from consignment_order c
      where c.status = 'active' and c.partner_id = p_contact
        and oeuvre_batch_ids(c.notes, c.oeuvre_id) @> to_jsonb(p_oeuvre))
    when 'paid' then exists (
      select 1 from sale_order s
      where s.statut = 'completed' and s.buyer_id = p_contact
        and oeuvre_batch_ids(s.notes, s.oeuvre_id) @> to_jsonb(p_oeuvre))
    when 'delivered' then exists (
      select 1 from sale_order s
      where s.statut = 'completed' and coalesce(s.delivered, false) and s.buyer_id = p_contact
        and oeuvre_batch_ids(s.notes, s.oeuvre_id) @> to_jsonb(p_oeuvre))
    else false
  end
$$;

revoke execute on function public.oeuvre_order_exists(integer, text, integer) from anon;

-- ── 1. Owner / custodian per status ─────────────────────────────────────────────────────────
create or replace function public.oeuvre_holder_check()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  s int := new."statusId";
  was int := case when tg_op = 'UPDATE' then old."statusId" end;
begin
  if s in (1, 2, 3) then
    -- In the studio: Pem owns and holds it. Bringing a work back goes through its order.
    new."ContactID" := coalesce(new."ContactID", 13);
    new."LocalisationID" := coalesce(new."LocalisationID", 13);
    if new."ContactID" <> 13 or new."LocalisationID" <> 13 then
      raise exception 'custody_order_required' using errcode = '23514',
        detail = 'In production / available / archive: Pem owns and holds the work.';
    end if;
  elsif s = 4 then
    -- Reserved: payment not cleared, Pem still owns it; kept at Pem or at the gallery.
    new."ContactID" := coalesce(new."ContactID", 13);
    if new."ContactID" <> 13 then
      raise exception 'custody_order_required' using errcode = '23514',
        detail = 'Reserved: ownership moves only when payment is cleared.';
    end if;
  elsif s in (7, 8) then
    new."ContactID" := 13; -- consigned / on loan: Pem keeps ownership
    if new."LocalisationID" is null or new."LocalisationID" = 13 then
      raise exception 'holder_required' using errcode = '23514',
        detail = 'Consigned / loan works need a custodian other than Pem.';
    end if;
    if (was is null or was not in (7, 8) or old."LocalisationID" is distinct from new."LocalisationID")
       and not oeuvre_order_exists(new."OeuvreID", 'custody', new."LocalisationID") then
      raise exception 'custody_order_required' using errcode = '23514',
        detail = 'A consignment / loan needs an active order to the custodian.';
    end if;
  elsif s in (6, 11) then
    if new."ContactID" is null or new."ContactID" = 13 then
      raise exception 'holder_required' using errcode = '23514',
        detail = 'Sold / given works need an owner other than Pem.';
    end if;
    new."LocalisationID" := coalesce(new."LocalisationID", 13);
    if s = 6 then
      if (was is distinct from 6 or old."ContactID" is distinct from new."ContactID")
         and not oeuvre_order_exists(new."OeuvreID", 'paid', new."ContactID") then
        raise exception 'sale_order_required' using errcode = '23514',
          detail = 'Sold: ownership moves on a completed (paid) sale order.';
      end if;
      if new."LocalisationID" <> 13
         and (was is distinct from 6 or old."LocalisationID" is distinct from new."LocalisationID")
         and new."LocalisationID" <> coalesce(old."LocalisationID", 13)
         and not oeuvre_order_exists(new."OeuvreID", 'delivered', new."ContactID") then
        raise exception 'sale_order_required' using errcode = '23514',
          detail = 'Sold: custody moves to the buyer on delivery.';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_oeuvre_holder_check on public."Oeuvres";
create trigger trg_oeuvre_holder_check
  before insert or update of "statusId", "ContactID", "LocalisationID" on public."Oeuvres"
  for each row execute function public.oeuvre_holder_check();

-- ── 2. Address ──────────────────────────────────────────────────────────────────────────────
-- Which Pem address a stage wants: 'atelier' (in production, incl. catalogued / photo pending)
-- or 'principal' (available, reserved, archive, sold / given but not handed over). Null = keep.
create or replace function public.oeuvre_stage_key(status int, catalogued boolean, needs_photo boolean)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when status = 1 then 'atelier'
    when status = 2 and (not coalesce(catalogued, false) or coalesce(needs_photo, false)) then 'atelier'
    when status in (2, 3, 4, 6, 11) then 'principal'
    else null
  end
$$;

create or replace function public.oeuvre_location_by_stage()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  stage_new text;
  stage_changed boolean;
  picked boolean;
  want int;
begin
  -- The address belongs to the custodian, or it is cleared.
  if new.localisation_address_id is not null and not exists (
    select 1 from contact_addresses a
    where a.id = new.localisation_address_id and a.contact_id = new."LocalisationID"
  ) then
    new.localisation_address_id := null;
  end if;

  if new."LocalisationID" is distinct from 13 then
    -- Someone else holds it: a single address is the obvious one.
    if new.localisation_address_id is null and new."LocalisationID" is not null then
      select min(a.id) into want from contact_addresses a
      where a.contact_id = new."LocalisationID"
      having count(*) = 1;
      new.localisation_address_id := want;
    end if;
    return new;
  end if;

  stage_new := oeuvre_stage_key(new."statusId", new."Catalogué", new."NeedsPhotograph");
  if stage_new is null then
    return new;  -- destroyed / lost: keep the last address
  end if;

  if tg_op = 'INSERT' then
    stage_changed := true;
    picked := false;
  else
    stage_changed := old."LocalisationID" is distinct from 13
      or stage_new is distinct from oeuvre_stage_key(old."statusId", old."Catalogué", old."NeedsPhotograph");
    -- An address chosen in this same write wins over the stage default.
    picked := new.localisation_address_id is not null
      and new.localisation_address_id is distinct from old.localisation_address_id;
  end if;

  if (stage_changed and not picked) or new.localisation_address_id is null then
    select a.id into want
    from contact_addresses a
    where a.contact_id = 13 and a.label ilike stage_new
    order by a.position nulls last, a.id
    limit 1;
    if want is not null then
      new.localisation_address_id := want;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_oeuvre_location_by_stage on public."Oeuvres";
create trigger trg_oeuvre_location_by_stage
  before insert or update of "statusId", "Catalogué", "NeedsPhotograph", "LocalisationID", localisation_address_id, fate
  on public."Oeuvres"
  for each row execute function public.oeuvre_location_by_stage();

-- ── 3. Backfill: works in Pem's possession ──────────────────────────────────────────────────
-- Setting the column fires trg_oeuvre_location_by_stage, which writes the stage address.
update public."Oeuvres"
set localisation_address_id = null
where "LocalisationID" = 13
  and localisation_address_id is null
  and deleted_at is null;
