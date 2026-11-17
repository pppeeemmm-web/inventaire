-- Orders (TODO R7, Pem 2026-11-17) — one order for every work that leaves Pem's hands.
-- Brief: docs/design/2026-11-17/R7_Orders.notes.md. Custody rules: docs/WORK_CUSTODY_MODEL.md.
--
-- APPLIED 2026-11-17 (Pem: « Apply step 1 ») as migrations work_order_r7_step1 +
-- work_order_r7_step1_grants. Note: on insert, a status past « draft » stamps its date with now()
-- (reconstituted rows must clear it afterwards — see work_order_gift_backfill.sql).
--
-- Step 1 of 3, additive only: nothing is dropped, today's code keeps working.
--   1. work_order.sql                 (this file)  new tables + links, custody checks read both
--   2. work_order_gift_backfill.sql   (data, own OK) the 7 works in « Gift » get a reconstituted order
--   3. work_order_drop_legacy.sql     (later, own OK) after the code moved: drop sale_order /
--                                     consignment_order, gift rule in oeuvre_holder_check
--
-- Live 2026-11-17 (read-only): sale_order 0 rows, consignment_order 0, payments 0, shipment 0,
-- inquiry.sale_order_id 0 linked. So there is nothing to copy across.
--
-- Kinds and steps (each step stamps its date the first time it is reached):
--   sale         draft → signed → deposit_paid → paid (owner → buyer) → delivered (custodian → buyer) | cancelled
--   consignment  draft → signed → out (custodian → gallery) → closed (every work back, sold or given) | cancelled
--   loan         draft → signed → out (custodian → borrower) → closed (every work back) | cancelled
--   gift         draft → signed (deed: owner → recipient) → handed_over (custodian → recipient) | cancelled
-- Works move only from « signed » on (drafts move nothing). The app sets the order step first,
-- then updates the works; oeuvre_holder_check refuses a work move with no order behind it.
--
-- Refs: V / D / P / G-YYYY-NNN, counted per kind per year (Pem 2026-11-17). Reconstituted
-- orders keep the ref they are given (G-R-001…) and do not count.
--
-- RLS: team reads / writes, admin deletes (same as consignment_order / payments). No anon.
-- After applying: npm run gen:types, then npm run typecheck.

begin;

-- ── 1. The order ────────────────────────────────────────────────────────────────────────────
create table if not exists public.work_order (
  id                       uuid primary key default gen_random_uuid(),
  created_at               timestamptz not null default now(),
  created_by               uuid default auth.uid(),          -- a draft by a team member shows in Pem's feed (R1)
  updated_at               timestamptz not null default now(),

  kind                     text not null check (kind in ('sale', 'consignment', 'loan', 'gift')),
  status                   text not null default 'draft',
  ref                      text unique,
  ref_year                 integer,
  ref_seq                  integer,
  reconstituted            boolean not null default false,   -- rebuilt afterwards from the work's data

  party_id                 integer not null references public."Contact"("ContactID") on delete restrict,
                                                             -- buyer / gallery / borrower / recipient
  address_id               integer references public.contact_addresses(id) on delete set null,
                                                             -- where the works go (one of the party's addresses)
  process_id               uuid references public.suivi_process(id) on delete set null,
                                                             -- the Pipeline process or exhibition it came from
  parent_order_id          uuid references public.work_order(id) on delete set null,
                                                             -- a sale made by the gallery out of a consignment

  start_date               date,                             -- planned out date (consignment / loan / delivery)
  end_date                 date,                             -- back by (consignment / loan)

  currency                 text not null default 'EUR',
  price_catalogue          numeric,                          -- sale: total before discount
  discount_pct             numeric,
  price_final              numeric,                          -- sale: total agreed
  deposit_pct              numeric,
  deposit_due              date,
  balance_due              date,
  payment_method           text,
  commission_pct           numeric,                          -- consignment: the gallery's share
  commission_amount        numeric,                          -- sale out of a consignment: stamped when paid
  shipping_method          text,

  return_window_days       integer not null default 14,      -- sale: cooling-off after delivery
  return_window_starts_at  date,
  return_window_skipped    boolean not null default false,

  paper_path               text,                             -- the generated paper (vault bucket)
  notes                    text,

  signed_at                timestamptz,
  paid_at                  timestamptz,                      -- sale: payment cleared → ownership moves
  delivered_at             timestamptz,                      -- custodian changed: delivered / out / handed over
  returned_at              timestamptz,                      -- consignment / loan closed
  cancelled_at             timestamptz,

  constraint work_order_status_by_kind check (
    (kind = 'sale'        and status in ('draft', 'signed', 'deposit_paid', 'paid', 'delivered', 'cancelled'))
 or (kind = 'consignment' and status in ('draft', 'signed', 'out', 'closed', 'cancelled'))
 or (kind = 'loan'        and status in ('draft', 'signed', 'out', 'closed', 'cancelled'))
 or (kind = 'gift'        and status in ('draft', 'signed', 'handed_over', 'cancelled'))
  ),
  constraint work_order_party_not_pem check (party_id <> 13),
  constraint work_order_parent_is_sale check (parent_order_id is null or kind = 'sale'),
  constraint work_order_ref_seq_unique unique (kind, ref_year, ref_seq)
);

comment on table public.work_order is
  'R7 orders: sale / consignment / loan / gift. Every work leaving Pem''s hands goes through one (docs/WORK_CUSTODY_MODEL.md).';

create index if not exists work_order_party_idx   on public.work_order (party_id);
create index if not exists work_order_open_idx    on public.work_order (kind, status) where status not in ('closed', 'cancelled', 'delivered', 'handed_over');
create index if not exists work_order_process_idx on public.work_order (process_id) where process_id is not null;
create index if not exists work_order_parent_idx  on public.work_order (parent_order_id) where parent_order_id is not null;

-- ── 2. The works on an order (replaces the « BATCH_IDS: [...] » text in notes) ─────────────────
create table if not exists public.work_order_work (
  id                     uuid primary key default gen_random_uuid(),
  order_id               uuid not null references public.work_order(id) on delete cascade,
  oeuvre_id              integer not null references public."Oeuvres"("OeuvreID") on delete restrict,
  position               integer not null default 0,
  price                  numeric,                            -- agreed price for this work (sale / consignment)
  insurance_value        numeric,                            -- consignment / loan: « nail to nail »
  line_status            text not null default 'active'
                           check (line_status in ('active', 'returned', 'sold', 'given', 'removed')),
                         -- returned: back at Pem's · sold / given: left through another order ·
                         -- removed: taken off (destroyed / lost, or by hand)
  closed_at              timestamptz,
  closed_by_order_id     uuid references public.work_order(id) on delete set null,
                                                             -- the sale / gift that took it off a consignment / loan
  note                   text,
  unique (order_id, oeuvre_id)
);

create index if not exists work_order_work_oeuvre_idx on public.work_order_work (oeuvre_id);
create index if not exists work_order_work_active_idx on public.work_order_work (oeuvre_id) where line_status = 'active';

-- ── 3. Links from today's tables ──────────────────────────────────────────────────────────────
alter table public.document add column if not exists work_order_id uuid references public.work_order(id) on delete set null;
create index if not exists document_work_order_idx on public.document (work_order_id) where work_order_id is not null;

alter table public.payments add column if not exists work_order_id uuid references public.work_order(id) on delete cascade;
alter table public.payments alter column order_id drop not null;               -- 0 rows today
alter table public.payments drop constraint if exists payments_one_order;
alter table public.payments add constraint payments_one_order check (num_nonnulls(order_id, work_order_id) = 1);
create index if not exists payments_work_order_idx on public.payments (work_order_id) where work_order_id is not null;

alter table public.shipment add column if not exists work_order_id uuid references public.work_order(id) on delete set null;
alter table public.inquiry  add column if not exists work_order_id uuid references public.work_order(id) on delete set null;

-- ── 4. Ref, dates, kind locked ────────────────────────────────────────────────────────────────
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
      v_prefix := case new.kind when 'sale' then 'V' when 'consignment' then 'D' when 'loan' then 'P' else 'G' end;
      -- One number per kind per year, no gaps from parallel inserts.
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

  -- Each step stamps its date the first time it is reached (insert or update).
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

drop trigger if exists trg_work_order_before_write on public.work_order;
create trigger trg_work_order_before_write
  before insert or update on public.work_order
  for each row execute function public.work_order_before_write();

-- ── 5. A sale paid or a gift signed takes its works off any open consignment / loan ──────────
-- (found issue 6 in the brief: gifting a deposited work left its consignment open). When the
-- last work of a consignment / loan leaves it, the order closes.
create or replace function public.work_order_after_step()
returns trigger
language plpgsql
security definer           -- touches other orders, whatever the caller's RLS; runs only on a team write
set search_path = public
as $$
declare
  v_outcome text;
begin
  if new.status is not distinct from old.status then return new; end if;
  if new.kind = 'sale' and new.status in ('paid', 'delivered') and old.status not in ('paid', 'delivered') then
    v_outcome := 'sold';
  elsif new.kind = 'gift' and new.status in ('signed', 'handed_over') and old.status not in ('signed', 'handed_over') then
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

revoke execute on function public.work_order_after_step() from public, anon, authenticated;

drop trigger if exists trg_work_order_after_step on public.work_order;
create trigger trg_work_order_after_step
  after update of status on public.work_order
  for each row execute function public.work_order_after_step();

-- ── 6. Custody checks read the new orders too (legacy branches go in step 3) ─────────────────
-- Same signature as work_custody_model.sql; oeuvre_holder_check is unchanged.
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
    -- Used from step 3 on (gift rule in oeuvre_holder_check); harmless before.
    when 'gift' then exists (
        select 1 from work_order o join work_order_work l on l.order_id = o.id
        where o.kind = 'gift' and o.status in ('signed', 'handed_over') and o.party_id = p_contact
          and l.oeuvre_id = p_oeuvre)
    when 'gift_handed' then exists (
        select 1 from work_order o join work_order_work l on l.order_id = o.id
        where o.kind = 'gift' and o.status = 'handed_over' and o.party_id = p_contact
          and l.oeuvre_id = p_oeuvre)
    else false
  end
$$;

revoke execute on function public.oeuvre_order_exists(integer, text, integer) from anon;

-- ── 7. A destroyed / lost work leaves its open orders (work_lifetime_gates.sql) ──────────────
-- Legacy loops unchanged; new loop added at the end.
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

  -- New orders: only those that have not moved ownership yet (a paid sale / signed gift is the
  -- new owner's loss). The work's line is taken off; an order left with no work closes.
  for r in
    select o.id, o.kind, o.status
      from work_order o join work_order_work l on l.order_id = o.id
     where l.oeuvre_id = p_oeuvre and l.line_status = 'active'
       and ((o.kind = 'sale' and o.status in ('draft', 'signed', 'deposit_paid'))
         or (o.kind = 'gift' and o.status = 'draft')
         or (o.kind in ('consignment', 'loan') and o.status in ('draft', 'signed', 'out')))
  loop
    update work_order_work
       set line_status = 'removed', closed_at = now(), note = concat_ws(E'\n', nullif(note, ''), v_line)
     where order_id = r.id and oeuvre_id = p_oeuvre;
    if not exists (select 1 from work_order_work where order_id = r.id and line_status = 'active') then
      update work_order
         set status = case when r.kind in ('consignment', 'loan') and r.status = 'out' then 'closed' else 'cancelled' end,
             notes  = concat_ws(E'\n', nullif(notes, ''), v_line)
       where id = r.id;
    else
      update work_order set notes = concat_ws(E'\n', nullif(notes, ''), v_line) where id = r.id;
    end if;
  end loop;
end;
$$;

revoke execute on function public.oeuvre_fate_close_orders(integer, text, date) from public, anon, authenticated;

-- ── 8. Shipment delivered → sale delivered (legacy branch kept) ──────────────────────────────
-- Same as today: flags the order delivered and starts the cooling-off; the custodian move on the
-- works stays in the app (it writes the history lines).
create or replace function public.sync_sale_order_return_window_from_shipment()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'delivered' and new.sale_order_id is not null then
    update sale_order
       set return_window_starts_at = coalesce(return_window_starts_at, (coalesce(new.delivered_at, timezone('utc', now())))::date),
           delivered = true
     where id = new.sale_order_id and statut = 'completed';
  end if;
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

-- ── 9. RLS + grants ───────────────────────────────────────────────────────────────────────────
alter table public.work_order      enable row level security;
alter table public.work_order_work enable row level security;

drop policy if exists work_order_team_select on public.work_order;
drop policy if exists work_order_team_insert on public.work_order;
drop policy if exists work_order_team_update on public.work_order;
drop policy if exists work_order_admin_delete on public.work_order;
create policy work_order_team_select  on public.work_order for select to authenticated using ((select is_team()));
create policy work_order_team_insert  on public.work_order for insert to authenticated with check ((select is_team()));
create policy work_order_team_update  on public.work_order for update to authenticated using ((select is_team())) with check ((select is_team()));
create policy work_order_admin_delete on public.work_order for delete to authenticated using ((select is_admin()));

drop policy if exists work_order_work_team_select on public.work_order_work;
drop policy if exists work_order_work_team_insert on public.work_order_work;
drop policy if exists work_order_work_team_update on public.work_order_work;
drop policy if exists work_order_work_team_delete on public.work_order_work;
create policy work_order_work_team_select on public.work_order_work for select to authenticated using ((select is_team()));
create policy work_order_work_team_insert on public.work_order_work for insert to authenticated with check ((select is_team()));
create policy work_order_work_team_update on public.work_order_work for update to authenticated using ((select is_team())) with check ((select is_team()));
-- A team member may take a work off a draft (the app only allows it on drafts); admin anywhere.
create policy work_order_work_team_delete on public.work_order_work for delete to authenticated using (
  (select is_admin())
  or ((select is_team()) and exists (select 1 from public.work_order o where o.id = work_order_work.order_id and o.status = 'draft'))
);

revoke all on public.work_order, public.work_order_work from anon, public;
grant select, insert, update, delete on public.work_order, public.work_order_work to authenticated;
-- Supabase default privileges also give authenticated truncate / references / trigger (RLS does
-- not cover truncate). Applied as its own migration work_order_r7_step1_grants.
revoke truncate, references, trigger on public.work_order, public.work_order_work from authenticated;
grant all on public.work_order, public.work_order_work to service_role;

revoke execute on function public.work_order_before_write() from public, anon;

commit;

-- Check after applying (read-only):
--   select ref from work_order;                                         -- empty
--   select tablename, policyname, cmd from pg_policies where tablename like 'work_order%';
--   select grantee, privilege_type from information_schema.role_table_grants
--    where table_name in ('work_order', 'work_order_work') order by 1, 2;  -- no anon
--   supabase/sql/grant_audit_queries.sql
