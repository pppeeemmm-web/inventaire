-- Orders (R7) — Pem's decisions of 2026-11-17 (docs/design/2026-11-17/R7_Open_Decisions.md).
--
-- DRAFT — NOT APPLIED. Own OK (CLAUDE.md: SQL needs its own GO). Additive: today's code keeps
-- working before and after it. After applying: npm run gen:types (no type change expected — kind and
-- status are text), flip ENTRUSTED_LIVE to true in lib/orders/kinds.ts, npm run typecheck.
--
-- A. Gift: ownership at hand-over (« don manuel »), not at the deed's signature.
--    The app already moves the works only at « Remise » (orders-actions.ts advanceWorkOrder).
--    In the DB, `work_order_after_step` still takes a given work off its open deposit / loan when the
--    gift is SIGNED — while the work is still at the gallery / borrower. Here: at hand-over only.
--    `oeuvre_fate_close_orders`: a signed (not yet handed-over) gift is cancelled like a draft.
--    `oeuvre_holder_check` needs no change for this today (status 11 only requires an owner other
--    than Pem); the gift rule itself comes with work_order_drop_legacy.sql (updated to « handed over »).
--
-- B. « Confié » (entrusted): a fifth kind — the work goes to a craftsperson (framer, restorer,
--    photographer) and KEEPS ITS STAGE (in production / available / archive); owner stays Pem.
--    Steps: draft → out (« Confié ») → closed (« Rentré »), or cancelled from draft. Ref letter C
--    (C-2026-001). Vault folder « Commandes/Confiés » (R2 commandes/confies/…).
--    - kind + status checks;
--    - ref letter in work_order_before_write;
--    - oeuvre_order_exists(…, 'entrusted', holder): an order out to that holder, line active;
--    - oeuvre_holder_check: in production / available / archive, Pem still owns the work; the
--      holder may be someone else only through such an order;
--    - oeuvre_fate_close_orders: a destroyed / lost work closes its « Confié » (out → closed,
--      draft → cancelled);
--    - the Vault folder marker.
--
-- Checks after applying (read-only):
--   select pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.work_order'::regclass and contype = 'c';
--   select count(*) from document where folder = 'Commandes/Confiés' and name = '.keep';          -- 1
--   select count(*) from "Oeuvres" where "statusId" in (1, 2, 3) and "LocalisationID" <> 13;       -- 0 (as today)

begin;

-- ── B1. Kind and status checks ────────────────────────────────────────────────────────────────
alter table public.work_order drop constraint if exists work_order_kind_check;
alter table public.work_order add constraint work_order_kind_check
  check (kind in ('sale', 'consignment', 'loan', 'gift', 'entrusted'));

alter table public.work_order drop constraint if exists work_order_status_by_kind;
alter table public.work_order add constraint work_order_status_by_kind check (
    (kind = 'sale'        and status in ('draft', 'signed', 'deposit_paid', 'paid', 'delivered', 'cancelled'))
 or (kind = 'consignment' and status in ('draft', 'signed', 'out', 'closed', 'cancelled'))
 or (kind = 'loan'        and status in ('draft', 'signed', 'out', 'closed', 'cancelled'))
 or (kind = 'gift'        and status in ('draft', 'signed', 'handed_over', 'cancelled'))
 or (kind = 'entrusted'   and status in ('draft', 'out', 'closed', 'cancelled'))
);

-- ── B2. Ref letter C ──────────────────────────────────────────────────────────────────────────
create or replace function public.work_order_before_write()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_prefix text;
begin
  if tg_op = 'INSERT' then
    if new.ref is null then
      new.ref_year := coalesce(new.ref_year, extract(year from (now() at time zone 'Europe/Paris'))::int);
      v_prefix := case new.kind when 'sale' then 'V' when 'consignment' then 'D' when 'loan' then 'P'
                                when 'entrusted' then 'C' else 'G' end;
      perform pg_advisory_xact_lock(hashtext('work_order_ref'), hashtext(new.kind || new.ref_year::text));
      select coalesce(max(ref_seq), 0) + 1 into new.ref_seq
        from work_order where kind = new.kind and ref_year = new.ref_year and not reconstituted;
      new.ref := v_prefix || '-' || new.ref_year || '-' || lpad(new.ref_seq::text, 3, '0');
    end if;
  else
    if new.kind is distinct from old.kind then
      raise exception 'work_order_kind_locked' using errcode = '23514',
        detail = 'An order keeps its kind; cancel it and start another.';
    end if;
    if new.ref is distinct from old.ref then
      raise exception 'work_order_ref_locked' using errcode = '23514';
    end if;
    new.updated_at := now();
  end if;

  if tg_op = 'INSERT' or new.status is distinct from old.status then
    case new.status
      when 'signed'       then new.signed_at    := coalesce(new.signed_at, now());
      when 'paid'         then new.paid_at      := coalesce(new.paid_at, now());
      when 'delivered'    then new.delivered_at := coalesce(new.delivered_at, now());
      when 'out'          then new.delivered_at := coalesce(new.delivered_at, now());
      when 'handed_over'  then new.delivered_at := coalesce(new.delivered_at, now());
      when 'closed'       then new.returned_at  := coalesce(new.returned_at, now());
      when 'cancelled'    then new.cancelled_at := coalesce(new.cancelled_at, now());
      else null;
    end case;
  end if;
  return new;
end;
$$;

-- ── A1. A gift takes its works off an open deposit / loan at hand-over (was: at signature) ────
create or replace function public.work_order_after_step()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_outcome text;
begin
  if new.status is not distinct from old.status then return new; end if;
  if new.kind = 'sale' and new.status in ('paid', 'delivered') and old.status not in ('paid', 'delivered') then
    v_outcome := 'sold';
  elsif new.kind = 'gift' and new.status = 'handed_over' and old.status is distinct from 'handed_over' then
    v_outcome := 'given';
  else
    return new;
  end if;

  update work_order_work l
     set line_status = v_outcome, closed_at = now(), closed_by_order_id = new.id
    from work_order o
   where l.order_id = o.id
     and o.id <> new.id
     and o.kind in ('consignment', 'loan')
     and o.status in ('signed', 'out')
     and l.line_status = 'active'
     and l.oeuvre_id in (select oeuvre_id from work_order_work where order_id = new.id);

  update work_order o
     set status = 'closed'
   where o.kind in ('consignment', 'loan')
     and o.status in ('signed', 'out')
     and exists (select 1 from work_order_work l where l.order_id = o.id and l.closed_by_order_id = new.id)
     and not exists (select 1 from work_order_work l where l.order_id = o.id and l.line_status = 'active');
  return new;
end;
$$;

-- ── B3. Custody: « entrusted » ────────────────────────────────────────────────────────────────
-- Same as live (old tables still read until work_order_drop_legacy.sql), plus 'entrusted'.
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
      or exists (
        select 1 from work_order o join work_order_work l on l.order_id = o.id
        where o.kind in ('consignment', 'loan') and o.status = 'out' and o.party_id = p_contact
          and l.oeuvre_id = p_oeuvre and l.line_status = 'active')
    when 'paid' then exists (
        select 1 from sale_order s
        where s.statut = 'completed' and s.buyer_id = p_contact
          and oeuvre_batch_ids(s.notes, s.oeuvre_id) @> to_jsonb(p_oeuvre))
      or exists (
        select 1 from work_order o join work_order_work l on l.order_id = o.id
        where o.kind = 'sale' and o.status in ('paid', 'delivered') and o.party_id = p_contact
          and l.oeuvre_id = p_oeuvre)
    when 'delivered' then exists (
        select 1 from sale_order s
        where s.statut = 'completed' and coalesce(s.delivered, false) and s.buyer_id = p_contact
          and oeuvre_batch_ids(s.notes, s.oeuvre_id) @> to_jsonb(p_oeuvre))
      or exists (
        select 1 from work_order o join work_order_work l on l.order_id = o.id
        where o.kind = 'sale' and o.status = 'delivered' and o.party_id = p_contact
          and l.oeuvre_id = p_oeuvre)
    -- A gift moves ownership at hand-over (Pem 2026-11-17); 'gift' kept as an alias of 'gift_handed'.
    when 'gift' then exists (
        select 1 from work_order o join work_order_work l on l.order_id = o.id
        where o.kind = 'gift' and o.status = 'handed_over' and o.party_id = p_contact
          and l.oeuvre_id = p_oeuvre)
    when 'gift_handed' then exists (
        select 1 from work_order o join work_order_work l on l.order_id = o.id
        where o.kind = 'gift' and o.status = 'handed_over' and o.party_id = p_contact
          and l.oeuvre_id = p_oeuvre)
    when 'entrusted' then exists (
        select 1 from work_order o join work_order_work l on l.order_id = o.id
        where o.kind = 'entrusted' and o.status = 'out' and o.party_id = p_contact
          and l.oeuvre_id = p_oeuvre and l.line_status = 'active')
    else false
  end
$$;

revoke execute on function public.oeuvre_order_exists(integer, text, integer) from anon;

-- Same as live except statuses 1 / 2 / 3: the holder may be a craftsperson with a « Confié » out.
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
    new."ContactID" := coalesce(new."ContactID", 13);
    new."LocalisationID" := coalesce(new."LocalisationID", 13);
    if new."ContactID" <> 13 then
      raise exception 'custody_order_required' using errcode = '23514',
        detail = 'In production / available / archive: Pem owns the work.';
    end if;
    if new."LocalisationID" <> 13 and not oeuvre_order_exists(new."OeuvreID", 'entrusted', new."LocalisationID") then
      raise exception 'custody_order_required' using errcode = '23514',
        detail = 'In production / available / archive: Pem holds the work, or a craftsperson through a « Confié » order marked out.';
    end if;
  elsif s = 4 then
    new."ContactID" := coalesce(new."ContactID", 13);
    if new."ContactID" <> 13 then
      raise exception 'custody_order_required' using errcode = '23514',
        detail = 'Reserved: ownership moves only when payment is cleared.';
    end if;
  elsif s in (7, 8) then
    new."ContactID" := 13;
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

-- ── A2 + B4. Destroyed / lost: a signed gift is cancelled; a « Confié » is closed ──────────────
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

  for r in
    select o.id, o.kind, o.status
      from work_order o join work_order_work l on l.order_id = o.id
     where l.oeuvre_id = p_oeuvre and l.line_status = 'active'
       and ((o.kind = 'sale' and o.status in ('draft', 'signed', 'deposit_paid'))
         or (o.kind = 'gift' and o.status in ('draft', 'signed'))
         or (o.kind in ('consignment', 'loan') and o.status in ('draft', 'signed', 'out'))
         or (o.kind = 'entrusted' and o.status in ('draft', 'out')))
  loop
    update work_order_work
       set line_status = 'removed', closed_at = now(), note = concat_ws(E'\n', nullif(note, ''), v_line)
     where order_id = r.id and oeuvre_id = p_oeuvre;
    if not exists (select 1 from work_order_work where order_id = r.id and line_status = 'active') then
      update work_order
         set status = case when r.kind in ('consignment', 'loan', 'entrusted') and r.status = 'out' then 'closed' else 'cancelled' end,
             notes  = concat_ws(E'\n', nullif(notes, ''), v_line)
       where id = r.id;
    else
      update work_order set notes = concat_ws(E'\n', nullif(notes, ''), v_line) where id = r.id;
    end if;
  end loop;
end;
$$;

revoke execute on function public.oeuvre_fate_close_orders(integer, text, date) from public, anon, authenticated;

-- ── B5. Vault folder « Commandes/Confiés » (shows even when empty, as createFolder) ────────────
insert into document (name, kind, folder, notes, mime_type)
select '.keep', 'system', 'Commandes/Confiés', 'Folder marker', 'application/x-directory'
where not exists (select 1 from document where folder = 'Commandes/Confiés' and name = '.keep');

commit;
