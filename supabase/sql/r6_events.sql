-- R6 « Expositions & événements » — the tables the event screen needs
-- (docs/design/2026-11-17/R6_Events.notes.md: v2, Round 2, « Needs a GO before building »).
--
-- APPLIED 2026-11-17 (Pem: « Apply it »), migrations r6_events + r6_events_grants (section E below).
-- Additive only: nothing is dropped, renamed or rewritten; today's code works before and after it.
-- After applying: npm run gen:types, R6_EVENTS_SQL_LIVE = true in lib/events/event-model.ts (done 2026-11-17),
-- npm run typecheck.
--
-- An event stays a `suivi_process` row (types exposition / collaboration / edition). Its moves are R7
-- orders (`work_order.process_id`, live) — this file adds no second movement system.
--
-- What it adds:
--   A. working_group.process_id      — the event's selection IS a work group (Round 2: « Créer la
--                                      sélection » / « Lier un groupe existant »); one group per event.
--   B. event_work                    — per event, per work: the prep ticks (Q10, dated when ticked,
--                                      phone moments Arrivée / Accrochage / Décrochage) and the free
--                                      « relation » of a work to a collaboration (Q8). A row exists only
--                                      once something is ticked or typed for that work.
--   C. event_contact                 — the event's people with a role (Q4): lieu, commissaire,
--                                      organisateur, galerie, partenaire, imprimeur… (list or typed).
--   D. suivi_process.prep_columns,   — which prep columns this event shows (null = defaults by kind, Q10)
--      suivi_process.on_site           and the « sur le site » switch for the About « Expositions » list (Q9).
--
-- Not here (later, each its own OK): the edition entry + work_order_work.copy_no (first real edition,
-- Q7); a free authorship note on a work (Q8 — it shows on the work card, which another batch is
-- changing now); event status words need no SQL (`statut` is free text, 0 exhibition rows today).
--
-- Access: team only (is_team()), like suivi_process / working_group today. No anon grant on the new
-- tables. Checks after applying (read-only):
--   select column_name from information_schema.columns where table_name = 'working_group' and column_name = 'process_id';   -- 1 row
--   select tablename, policyname, roles from pg_policies where tablename in ('event_work', 'event_contact');               -- 2 rows, {authenticated}
--   select grantee, privilege_type from information_schema.role_table_grants
--    where table_name in ('event_work', 'event_contact') and grantee = 'anon';                                                -- 0 rows
--   select count(*) from working_group where process_id is not null;                                                         -- 0 (as today)

begin;

-- ── A. The selection: a work group linked to its event ─────────────────────────────────────────
-- Nullable link; a group without an event stays a plain group (Montrouge, Sète, Liquid…).
-- Deleting the event keeps the group and its works (set null). One selection per event.
alter table public.working_group
  add column if not exists process_id uuid references public.suivi_process(id) on delete set null;

comment on column public.working_group.process_id is
  'R6: the event (suivi_process) whose selection this group is. Null = a plain work group. One group per event.';

create unique index if not exists working_group_process_id_key
  on public.working_group (process_id)
  where process_id is not null;

-- ── B. Per event, per work: prep ticks + relation ──────────────────────────────────────────────
-- Each tick is a date (null = not done), so one tick = one column update. Columns follow Round 2 Q10/Q11:
-- before (presentation, cartel, constat_out, packing), at the venue (unpacked, hung, photo),
-- after (taken_down, constat_back). Insurance value stays on the order line (work_order_work),
-- the displayed price is the work's price (Oeuvres.Prix) — not copied here.
create table if not exists public.event_work (
  process_id      uuid        not null references public.suivi_process(id) on delete cascade,
  oeuvre_id       integer     not null references public."Oeuvres"("OeuvreID") on delete cascade,
  relation        text,                       -- Q8, free: « faite ensemble », « prêtée », « montrée », « en réponse à… »
  presentation_at timestamptz,                -- framed / mounted / hanging system ready
  cartel_at       timestamptz,                -- label checked + printed
  constat_out_at  timestamptz,                -- condition report at departure
  packing_at      timestamptz,                -- crate / packing (off by default)
  unpacked_at     timestamptz,                -- phone, Arrivée: unpacked at the venue
  hung_at         timestamptz,                -- phone, Accrochage
  photo_at        timestamptz,                -- installation photo taken
  taken_down_at   timestamptz,                -- phone, Décrochage
  constat_back_at timestamptz,                -- condition report on return
  updated_at      timestamptz not null default now(),
  updated_by      uuid references auth.users(id) on delete set null,
  primary key (process_id, oeuvre_id)
);

comment on table public.event_work is
  'R6: per event (suivi_process) and work — prep ticks (date when ticked) and free relation. Movements are R7 orders, never here.';

create index if not exists event_work_oeuvre_idx on public.event_work (oeuvre_id);

alter table public.event_work enable row level security;

drop policy if exists "event_work: team all" on public.event_work;
create policy "event_work: team all" on public.event_work
  for all to authenticated
  using (public.is_team())
  with check (public.is_team());

revoke all on public.event_work from anon;
grant select, insert, update, delete on public.event_work to authenticated;
grant all on public.event_work to service_role;

-- ── C. The event's people, with a role ─────────────────────────────────────────────────────────
-- Any contact, several per event; role from a list or typed (text, no check). « Créer la commande »
-- offers all of them as the order's other party, the place first.
create table if not exists public.event_contact (
  id          uuid        primary key default gen_random_uuid(),
  process_id  uuid        not null references public.suivi_process(id) on delete cascade,
  contact_id  integer     not null references public."Contact"("ContactID") on delete cascade,
  role        text        not null,
  position    integer     not null default 0,
  created_at  timestamptz not null default now(),
  unique (process_id, contact_id, role)
);

comment on table public.event_contact is
  'R6: people of an event (suivi_process) with a free role (lieu, commissaire, organisateur, galerie, partenaire, imprimeur…).';

create index if not exists event_contact_process_idx on public.event_contact (process_id, position);
create index if not exists event_contact_contact_idx on public.event_contact (contact_id);

alter table public.event_contact enable row level security;

drop policy if exists "event_contact: team all" on public.event_contact;
create policy "event_contact: team all" on public.event_contact
  for all to authenticated
  using (public.is_team())
  with check (public.is_team());

revoke all on public.event_contact from anon;
grant select, insert, update, delete on public.event_contact to authenticated;
grant all on public.event_contact to service_role;

-- ── D. Per-event settings on the event row ─────────────────────────────────────────────────────
-- prep_columns: the prep columns switched on for this event (keys of event_work ticks, e.g.
-- {presentation,cartel,constat_out,hung,photo,constat_back}); null = the defaults of its kind.
-- on_site: an ended event chosen for the public About « Expositions » list (off by default). The public
-- site reads it through the server (service role), so no anon grant changes.
alter table public.suivi_process
  add column if not exists prep_columns text[],
  add column if not exists on_site boolean not null default false;

comment on column public.suivi_process.prep_columns is
  'R6: prep columns shown for this event (event_work tick names). Null = defaults of its kind.';
comment on column public.suivi_process.on_site is
  'R6: an ended event listed in the public About « Expositions » block (Pem switches it on). Default off.';

commit;

-- ── E. Grants tidy-up (applied as its own migration r6_events_grants) ────────────────────────────
-- Supabase's default privileges also give `authenticated` TRUNCATE / REFERENCES / TRIGGER on new tables;
-- the screen needs none of them (TRUNCATE would also bypass RLS). Same tidy-up as R7's step1_grants.
-- Live after it: authenticated = SELECT, INSERT, UPDATE, DELETE on both tables; anon = none.
revoke truncate, references, trigger on public.event_work from authenticated;
revoke truncate, references, trigger on public.event_contact from authenticated;
