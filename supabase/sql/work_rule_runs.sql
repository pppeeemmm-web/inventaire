-- Work rule checks: keep each run's result so the Overview can show it (Pem 2026-11-18: Overview signal strip GO).
-- NOT APPLIED — SQL needs its own OK (CLAUDE.md).
-- Written by: Audit → Règles « run » (admin, through RLS) and the nightly workflow (scripts/work-rules-checks.sh,
-- with the DB secret — it bypasses RLS). The nightly job stays read only on the works: this row is its only write.
-- After applying: `npm run gen:types`, flip RULE_RUNS_LIVE in lib/overview/signal-strip.ts.

begin;

create table if not exists public.work_rule_run (
  id        bigint generated always as identity primary key,
  ran_at    timestamptz not null default now(),
  source    text not null check (source in ('manual', 'nightly')),
  ran_by    uuid default auth.uid(),
  works     integer,                               -- works checked (manual run only)
  breaks    integer not null,
  by_rule   jsonb not null default '{}'::jsonb,    -- { "2": 3, "9": 1 }
  error     text                                   -- the run itself failed (no result)
);
create index if not exists work_rule_run_ran_at_idx on public.work_rule_run (ran_at desc);

alter table public.work_rule_run enable row level security;
create policy work_rule_run_team_select on public.work_rule_run for select to authenticated using ((select is_team()));
create policy work_rule_run_admin_insert on public.work_rule_run for insert to authenticated with check ((select is_admin()));

revoke all on public.work_rule_run from anon;
revoke all on public.work_rule_run from authenticated;
grant select, insert on public.work_rule_run to authenticated;

commit;
