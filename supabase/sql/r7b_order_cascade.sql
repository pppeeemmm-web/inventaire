-- R7b — the order drives the chain: prep demands, shipment checklist (or pick-up), COA on the line,
-- shipping charged as a line, invoices with a gap-free number, insurance claims.
-- Design: docs/design/2026-11-18/R7b_OrderCascade.notes.md (Pem's answers 2026-11-18: prep = framing, mounting,
-- dedication / signature; shipping + insurance paid by the buyer as a line; COA at « Paid »; pick-up at the studio
-- or at an event).
-- APPLIED LIVE 2026-11-18 (Pem: « ok »), migration r7b_order_cascade; RLS + grants + advisor checked after. Additive except on `shipment` / `shipment_work`, which held
-- 0 rows (checked live 2026-11-18), so they are reshaped in place.
-- After applying: `npm run gen:types`, `npm run typecheck`, flip R7B_SQL_LIVE in lib/orders/cascade.ts.

begin;

-- ── 1. Shipment = one trip of works to one place (or a pick-up), several orders allowed ───────────
-- The old link to ONE order goes: a shipment's orders are read through its works' order lines.
-- The trigger that set a sale « delivered » from a shipment goes too: it skipped the custody move
-- (works' location) done by the app's order step. The app's shipment « delivered » step now calls
-- the order step for every order whose works have all arrived.
drop trigger if exists trg_shipment_return_window on public.shipment;
drop function if exists public.sync_sale_order_return_window_from_shipment();

alter table public.shipment drop column if exists work_order_id;
alter table public.shipment alter column kind set default 'ship';
alter table public.shipment alter column status set default 'open';
alter table public.shipment
  alter column shipped_at   type timestamptz using shipped_at::timestamptz,
  alter column delivered_at type timestamptz using delivered_at::timestamptz;

alter table public.shipment
  add column if not exists created_by        uuid default auth.uid(),
  add column if not exists address_id        integer references public.contact_addresses(id) on delete set null,
  add column if not exists pickup_process_id uuid references public.suivi_process(id) on delete set null,
                                             -- pick-up at an event (R6); null + kind pickup = at the studio
  add column if not exists carrier           text,
  add column if not exists tracking_no       text,
  add column if not exists tracking_url      text,
  add column if not exists packed_dims       text,             -- « 120 × 90 × 12 cm »
  add column if not exists packed_weight_kg  numeric,
  add column if not exists packing_note      text,             -- materials used (environmental policy §2)
  add column if not exists insured_value     numeric,
  add column if not exists insurer           text,
  add column if not exists policy_ref        text,
  add column if not exists cost              numeric,          -- what the studio paid the carrier / insurer
  add column if not exists charged_to        text,
  add column if not exists handed_to         text,             -- pick-up: who collected
  add column if not exists photos_at         timestamptz,
  add column if not exists picked_at         timestamptz,
  add column if not exists packed_at         timestamptz,
  add column if not exists insured_at        timestamptz,
  add column if not exists labelled_at       timestamptz,
  add column if not exists cancelled_at      timestamptz;

alter table public.shipment drop constraint if exists shipment_kind_ck;
alter table public.shipment add constraint shipment_kind_ck check (kind in ('ship', 'pickup', 'return'));
alter table public.shipment drop constraint if exists shipment_status_ck;
alter table public.shipment add constraint shipment_status_ck check (status in
  ('open', 'photos', 'picked', 'packed', 'insured', 'labelled', 'shipped', 'delivered', 'cancelled'));
alter table public.shipment drop constraint if exists shipment_charged_to_ck;
alter table public.shipment add constraint shipment_charged_to_ck
  check (charged_to is null or charged_to in ('buyer', 'studio', 'other_party'));

-- Step dates stamped by the DB when the status reaches them (like work_order).
create or replace function public.shipment_before_write()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    case new.status
      when 'photos'    then new.photos_at    := coalesce(new.photos_at, now());
      when 'picked'    then new.picked_at    := coalesce(new.picked_at, now());
      when 'packed'    then new.packed_at    := coalesce(new.packed_at, now());
      when 'insured'   then new.insured_at   := coalesce(new.insured_at, now());
      when 'labelled'  then new.labelled_at  := coalesce(new.labelled_at, now());
      when 'shipped'   then new.shipped_at   := coalesce(new.shipped_at, now());
      when 'delivered' then new.delivered_at := coalesce(new.delivered_at, now());
      when 'cancelled' then new.cancelled_at := coalesce(new.cancelled_at, now());
      else null;
    end case;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_shipment_before_write on public.shipment;
create trigger trg_shipment_before_write before insert or update on public.shipment
  for each row execute function public.shipment_before_write();

create index if not exists shipment_open_idx on public.shipment (status) where status not in ('delivered', 'cancelled');

-- ── 2. Works on a shipment point to their order line ───────────────────────────────────────────
alter table public.shipment_work
  add column if not exists order_line_id uuid references public.work_order_work(id) on delete set null;
alter table public.shipment_work alter column shipment_id set not null;
alter table public.shipment_work alter column oeuvre_id set not null;
alter table public.shipment_work drop constraint if exists shipment_work_unique;
alter table public.shipment_work add constraint shipment_work_unique unique (shipment_id, oeuvre_id);
create index if not exists shipment_work_line_idx on public.shipment_work (order_line_id) where order_line_id is not null;
create index if not exists shipment_work_oeuvre_idx on public.shipment_work (oeuvre_id);

-- ── 3. Prep demands on an order line (blocks « packed » until done) ────────────────────────────
create table if not exists public.work_order_demand (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),
  created_by          uuid default auth.uid(),
  line_id             uuid not null references public.work_order_work(id) on delete cascade,
  kind                text not null check (kind in ('framing', 'mounting', 'dedication')),
  note                text,                                  -- moulding, glass, the dedication's words…
  price               numeric,                               -- charged to the buyer (line on the invoice), null = included
  entrusted_order_id  uuid references public.work_order(id) on delete set null,
                                                             -- the « Confié » to the framer, when it leaves the studio
  done_at             timestamptz
);
create index if not exists work_order_demand_line_idx on public.work_order_demand (line_id);
create index if not exists work_order_demand_open_idx on public.work_order_demand (line_id) where done_at is null;

-- ── 4. Order: shipping as a line; the line's COA ──────────────────────────────────────────────
alter table public.work_order
  add column if not exists shipping_charge numeric,          -- « Expédition et assurance », paid by the buyer
  add column if not exists delivery_mode  text;              -- ship / pickup — chosen on the order
alter table public.work_order drop constraint if exists work_order_delivery_mode_ck;
alter table public.work_order add constraint work_order_delivery_mode_ck
  check (delivery_mode is null or delivery_mode in ('ship', 'pickup'));

alter table public.work_order_work
  add column if not exists coa_document_id uuid references public.document(id) on delete set null;

-- ── 5. Invoices: gap-free numbers, one buyer, one or more sale orders, frozen once issued ─────────
create table if not exists public.invoice (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),
  created_by          uuid default auth.uid(),
  kind                text not null default 'invoice' check (kind in ('invoice', 'credit_note')),
  number              text unique,                           -- F-2026-0001 / AV-2026-0001, set by the trigger
  series_year         integer,
  series_seq          integer,
  party_id            integer not null references public."Contact"("ContactID") on delete restrict,
  issued_on           date not null default ((now() at time zone 'Europe/Paris')::date),
  credits_invoice_id  uuid references public.invoice(id) on delete restrict,
  currency            text not null default 'EUR',
  lines               jsonb not null default '[]'::jsonb,    -- frozen copy: works, demands, shipping
  total               numeric not null,
  vat_mention         text,                                  -- the accountant's wording (LEGAL_POLICY §4)
  paper_path          text,
  notes               text,
  constraint invoice_credit_note_ck check ((kind = 'credit_note') = (credits_invoice_id is not null)),
  constraint invoice_party_not_pem check (party_id <> 13)
);

create table if not exists public.invoice_order (
  invoice_id  uuid not null references public.invoice(id) on delete restrict,
  order_id    uuid not null references public.work_order(id) on delete restrict,
  primary key (invoice_id, order_id)
);
create index if not exists invoice_order_order_idx on public.invoice_order (order_id);

create or replace function public.invoice_before_write()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_prefix text;
begin
  if tg_op = 'INSERT' then
    new.series_year := extract(year from new.issued_on)::int;
    v_prefix := case new.kind when 'credit_note' then 'AV' else 'F' end;
    perform pg_advisory_xact_lock(hashtext('invoice_number'), hashtext(new.kind || new.series_year::text));
    select coalesce(max(series_seq), 0) + 1 into new.series_seq
      from invoice where kind = new.kind and series_year = new.series_year;
    new.number := v_prefix || '-' || new.series_year || '-' || lpad(new.series_seq::text, 4, '0');
    return new;
  end if;
  -- Issued = frozen: only the paper path and the notes may change afterwards.
  if (new.kind, new.number, new.series_year, new.series_seq, new.party_id, new.issued_on, new.credits_invoice_id,
      new.currency, new.lines, new.total, new.vat_mention)
     is distinct from
     (old.kind, old.number, old.series_year, old.series_seq, old.party_id, old.issued_on, old.credits_invoice_id,
      old.currency, old.lines, old.total, old.vat_mention) then
    raise exception 'invoice_frozen' using errcode = '23514',
      detail = 'An issued invoice is never changed; issue a credit note and a new invoice.';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_invoice_before_write on public.invoice;
create trigger trg_invoice_before_write before insert or update on public.invoice
  for each row execute function public.invoice_before_write();

-- An order sits on one live invoice at most (a credited invoice frees it); only sale orders, same buyer.
create or replace function public.invoice_order_check()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_party integer;
  v_kind text;
begin
  select party_id, kind into v_party, v_kind from invoice where id = new.invoice_id;
  if v_kind <> 'invoice' then
    raise exception 'invoice_order_on_credit_note' using errcode = '23514';
  end if;
  if not exists (select 1 from work_order o where o.id = new.order_id and o.kind = 'sale' and o.party_id = v_party) then
    raise exception 'invoice_order_not_buyer_sale' using errcode = '23514',
      detail = 'Only sale orders of the invoice''s buyer.';
  end if;
  if exists (select 1 from invoice_order io join invoice i on i.id = io.invoice_id
              where io.order_id = new.order_id and io.invoice_id <> new.invoice_id and i.kind = 'invoice'
                and not exists (select 1 from invoice c where c.credits_invoice_id = i.id)) then
    raise exception 'invoice_order_already_invoiced' using errcode = '23514';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_invoice_order_check on public.invoice_order;
create trigger trg_invoice_order_check before insert or update on public.invoice_order
  for each row execute function public.invoice_order_check();

-- ── 6. Insurance claims ───────────────────────────────────────────────────────────────────────
create table if not exists public.insurance_claim (
  id                   uuid primary key default gen_random_uuid(),
  created_at           timestamptz not null default now(),
  created_by           uuid default auth.uid(),
  oeuvre_id            integer not null references public."Oeuvres"("OeuvreID") on delete restrict,
  condition_report_id  bigint references public.condition_report(id) on delete set null,
  shipment_id          uuid references public.shipment(id) on delete set null,
  work_order_id        uuid references public.work_order(id) on delete set null,
  insurer              text not null,                        -- insurer or carrier
  claim_ref            text,
  police_report_ref    text,                                 -- theft
  filed_on             date,
  amount_claimed       numeric,
  amount_paid          numeric,
  paid_on              date,
  status               text not null default 'open' check (status in ('open', 'paid', 'refused', 'withdrawn')),
  notes                text
);
create index if not exists insurance_claim_oeuvre_idx on public.insurance_claim (oeuvre_id);

-- ── 7. RLS + grants (team read / write; deletes admin only; invoices never deleted) ──────────────
alter table public.work_order_demand enable row level security;
alter table public.invoice           enable row level security;
alter table public.invoice_order     enable row level security;
alter table public.insurance_claim   enable row level security;

create policy work_order_demand_team_select on public.work_order_demand for select to authenticated using ((select is_team()));
create policy work_order_demand_team_insert on public.work_order_demand for insert to authenticated with check ((select is_team()));
create policy work_order_demand_team_update on public.work_order_demand for update to authenticated using ((select is_team())) with check ((select is_team()));
create policy work_order_demand_admin_delete on public.work_order_demand for delete to authenticated using ((select is_admin()));

create policy invoice_team_select on public.invoice for select to authenticated using ((select is_team()));
create policy invoice_admin_insert on public.invoice for insert to authenticated with check ((select is_admin()));
create policy invoice_admin_update on public.invoice for update to authenticated using ((select is_admin())) with check ((select is_admin()));
-- no delete policy: an invoice number is never freed

create policy invoice_order_team_select on public.invoice_order for select to authenticated using ((select is_team()));
create policy invoice_order_admin_insert on public.invoice_order for insert to authenticated with check ((select is_admin()));

create policy insurance_claim_team_select on public.insurance_claim for select to authenticated using ((select is_team()));
create policy insurance_claim_team_insert on public.insurance_claim for insert to authenticated with check ((select is_team()));
create policy insurance_claim_team_update on public.insurance_claim for update to authenticated using ((select is_team())) with check ((select is_team()));
create policy insurance_claim_admin_delete on public.insurance_claim for delete to authenticated using ((select is_admin()));

revoke all on public.work_order_demand, public.invoice, public.invoice_order, public.insurance_claim from anon;
revoke all on public.work_order_demand, public.invoice, public.invoice_order, public.insurance_claim from authenticated;
grant select, insert, update, delete on public.work_order_demand to authenticated;
grant select, insert, update         on public.invoice           to authenticated;
grant select, insert                 on public.invoice_order     to authenticated;
grant select, insert, update, delete on public.insurance_claim   to authenticated;

-- The two shipment tables: same narrowing as work_order (no anon, no TRUNCATE / REFERENCES / TRIGGER).
revoke all on public.shipment, public.shipment_work from anon;
revoke truncate, references, trigger on public.shipment, public.shipment_work from authenticated;

commit;
