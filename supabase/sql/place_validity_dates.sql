-- R3 rule « place vs date » (docs/design/2026-11-16/WorkCard.notes.md, « Rules the build must enforce »):
-- a creation-history place is only offered for dates when it existed (« commencée 2014 · atelier rue
-- Mazenod » is refused if that atelier opened later).
--
-- NOT APPLIED — needs Pem's OK. Until it runs, the app reads no dates and the rule does nothing
-- (`placeValidity` in app/atelier/works/period-source-actions.ts returns null on the missing columns).
-- After applying: `npm run gen:types`, then fill the dates of each place (UI for that = later step).
--
-- Both columns nullable: null = open-ended (no start known / still there).

alter table public.place
  add column if not exists valid_from date,
  add column if not exists valid_to   date;

alter table public.place drop constraint if exists place_valid_range_ck;
alter table public.place
  add constraint place_valid_range_ck
  check (valid_from is null or valid_to is null or valid_from <= valid_to);

comment on column public.place.valid_from is 'First day the place existed / was used (null = unknown). R3 place-vs-date rule.';
comment on column public.place.valid_to   is 'Last day the place existed / was used (null = still in use). R3 place-vs-date rule.';

-- Grants: unchanged. `place` already has RLS (place_team_all, team only) and
-- `grant select, insert, update, delete on public.place to authenticated` (work_period_dates_places.sql);
-- table-level grants cover new columns. No anon access.
