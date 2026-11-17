-- Orders (R7) step 3 of 3 — drop the old order tables and add the gift rule.
--
-- DRAFT — NOT APPLIED, and NOT READY until the code no longer reads the old tables. Own OK.
-- Before running, both must return nothing:
--   rg -n "sale_order|consignment_order|BATCH_IDS|sale_order_seq" app components lib scripts
--   select count(*) from sale_order union all select count(*) from consignment_order;  -- 0, 0
-- Then: npm run gen:types, npm run typecheck.
-- Apply work_order_r7_decisions.sql before this file (it adds the « entrusted » kind this file keeps
-- in its custody checks; the 'entrusted' cases are harmless if that kind never appears).
--
-- 1. Custody checks read work_order only.
-- 2. oeuvre_holder_check gains the gift rule: a work becomes « Gift » (or changes recipient) only
--    through a gift order HANDED OVER — ownership and custody move together at hand-over (« don
--    manuel », Pem 2026-11-17; was: at the deed's signature) — custody model « every movement is an
--    order ». Keeps « Confié » (work_order_r7_decisions.sql): in production / available / archive,
--    the holder may be a craftsperson through an entrusted order marked out.
--    The 7 existing gifts are covered by work_order_gift_backfill.sql (the rule only fires on change).
-- 3. Drop: payments.order_id, shipment.sale_order_id / order_id, inquiry.sale_order_id,
--    sale_order, consignment_order, set_sale_order_ref, sale_order_seq, oeuvre_batch_ids.

begin;

-- ── 1. Custody checks: new orders only ───────────────────────────────────────────────────────
create or replace function public.oeuvre_order_exists(p_oeuvre integer, p_kind text, p_contact integer)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from work_order o join work_order_work l on l.order_id = o.id
    where l.oeuvre_id = p_oeuvre and o.party_id = p_contact
      and case p_kind
        when 'custody'     then o.kind in ('consignment', 'loan') and o.status = 'out' and l.line_status = 'active'
        when 'paid'        then o.kind = 'sale' and o.status in ('paid', 'delivered')
        when 'delivered'   then o.kind = 'sale' and o.status = 'delivered'
        when 'gift'        then o.kind = 'gift' and o.status = 'handed_over'
        when 'gift_handed' then o.kind = 'gift' and o.status = 'handed_over'
        when 'entrusted'   then o.kind = 'entrusted' and o.status = 'out' and l.line_status = 'active'
        else false
      end)
$$;

revoke execute on function public.oeuvre_order_exists(integer, text, integer) from anon;

-- ── 2. Owner / custodian per status, with the gift rule (rest as work_custody_model.sql) ──────
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
        detail = 'A consignment / loan needs an order to the custodian, marked out.';
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
          detail = 'Sold: ownership moves on a paid sale order.';
      end if;
      if new."LocalisationID" <> 13
         and (was is distinct from 6 or old."LocalisationID" is distinct from new."LocalisationID")
         and new."LocalisationID" <> coalesce(old."LocalisationID", 13)
         and not oeuvre_order_exists(new."OeuvreID", 'delivered', new."ContactID") then
        raise exception 'sale_order_required' using errcode = '23514',
          detail = 'Sold: custody moves to the buyer on delivery.';
      end if;
    else
      -- s = 11, new: the gift rule — ownership (and custody) move on a gift order handed over.
      if (was is distinct from 11 or old."ContactID" is distinct from new."ContactID")
         and not oeuvre_order_exists(new."OeuvreID", 'gift_handed', new."ContactID") then
        raise exception 'gift_order_required' using errcode = '23514',
          detail = 'Gift: ownership moves when a gift order is handed over (don manuel).';
      end if;
    end if;
  end if;
  return new;
end;
$$;

-- ── 3. Destroyed / lost: new orders only ──────────────────────────────────────────────────────
create or replace function public.oeuvre_fate_close_orders(p_oeuvre integer, p_kind text, p_on date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_line text := '[' || to_char((now() at time zone 'Europe/Paris')::date, 'YYYY/MM/DD') || '] Œuvre #'
    || p_oeuvre || case p_kind when 'destroyed' then ' détruite' else ' perdue' end
    || ' (' || to_char(p_on, 'YYYY/MM/DD') || ')';
begin
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

-- ── 4. Shipment delivered → sale delivered: new orders only ──────────────────────────────────
create or replace function public.sync_sale_order_return_window_from_shipment()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'delivered' and new.work_order_id is not null then
    update work_order
       set status = 'delivered',
           delivered_at = coalesce(delivered_at, new.delivered_at, now()),
           return_window_starts_at = coalesce(return_window_starts_at, (coalesce(new.delivered_at, timezone('utc', now())))::date)
     where id = new.work_order_id and kind = 'sale' and status = 'paid';
  end if;
  return new;
end;
$$;

-- ── 5. Drop the old links and tables ──────────────────────────────────────────────────────────
alter table public.payments drop constraint if exists payments_one_order;
alter table public.payments drop column if exists order_id;
alter table public.payments alter column work_order_id set not null;

alter table public.shipment drop column if exists sale_order_id;
alter table public.shipment drop column if exists order_id;     -- uuid, no FK, never written by the app
alter table public.inquiry  drop column if exists sale_order_id;

drop table if exists public.sale_order;          -- trg_sale_order_ref goes with it
drop table if exists public.consignment_order;
drop function if exists public.set_sale_order_ref();
drop sequence if exists public.sale_order_seq;
drop function if exists public.oeuvre_batch_ids(text, integer);

commit;
