-- ================================================================
-- PEM Art DB — Patch v2: idempotent (safe to re-run)
-- Uses DROP POLICY IF EXISTS before every CREATE POLICY
-- Run in: Supabase Dashboard → SQL Editor
-- ================================================================

-- ── 1. expense table ─────────────────────────────────────────────
create table if not exists expense (
  id           bigserial    primary key,
  date         date         not null,
  libelle      text,
  category     text,
  montant_ht   numeric(10,2),
  tva_rate     numeric(5,2)  not null default 0,
  montant_ttc  numeric(10,2) not null,
  notes        text,
  receipt_ref  text,
  fiscal_year  int           generated always as (extract(year from date)::int) stored,
  created_at   timestamptz   not null default now()
);

alter table expense enable row level security;

drop policy if exists "expense: team all" on expense;
create policy "expense: team all" on expense
  for all using (is_team());

create index if not exists expense_fiscal_year_idx on expense(fiscal_year);
create index if not exists expense_date_idx         on expense(date desc);


-- ── 2. document — fix kind CHECK + missing columns ───────────────
alter table document drop constraint if exists document_kind_check;

alter table document add constraint document_kind_check
  check (kind in ('certificate', 'invoice', 'contract', 'insurance', 'coa', 'other'));

alter table document
  add column if not exists notes       text,
  add column if not exists file_size   bigint,
  add column if not exists mime_type   text,
  add column if not exists doc_date    date,
  add column if not exists cert_id     text,
  add column if not exists cert_hash   text;


-- ── 3. work_action_type + work_action ────────────────────────────
create table if not exists work_action_type (
  id          bigserial   primary key,
  label       text        not null,
  color       text        not null default '#6e7a8a',
  sort_order  int         not null default 0,
  field_key   text
);

create table if not exists work_action (
  id              bigserial   primary key,
  oeuvre_id       int         not null references "Oeuvres"("OeuvreID") on delete cascade,
  action_type_id  int         not null references work_action_type(id) on delete cascade,
  done            boolean     not null default false,
  done_at         timestamptz,
  note            text,
  created_at      timestamptz not null default now(),
  unique (oeuvre_id, action_type_id)
);

create index if not exists work_action_type_idx    on work_action(action_type_id);
create index if not exists work_action_pending_idx on work_action(done) where done = false;

alter table work_action_type enable row level security;
alter table work_action       enable row level security;

drop policy if exists "work_action_type: team all" on work_action_type;
create policy "work_action_type: team all" on work_action_type
  for all using (is_team());

drop policy if exists "work_action: team all" on work_action;
create policy "work_action: team all" on work_action
  for all using (is_team());

-- Default kanban columns (idempotent)
insert into work_action_type (label, color, sort_order, field_key) values
  ('Photographier',  '#6e9fc2', 0, null),
  ('Encadrer',       '#c29a6e', 1, 'Encadree'),
  ('Retoucher',      '#9e6ec2', 2, null),
  ('Cataloguer',     '#6ec28a', 3, 'Catalogué'),
  ('Exposer',        '#c2c26e', 4, 'Exposable')
on conflict do nothing;

-- ================================================================
-- DONE. Verify:
--   select * from work_action_type;
--   select count(*) from expense;
-- ================================================================
