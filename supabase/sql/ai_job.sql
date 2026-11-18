-- AI desk, phase 2 + 3 (docs/design/2026-11-18/AiDesk.notes.md). Applied live 2026-11-18 (Pem « Yes, apply SQL »).
--
-- ai_job: one row per piece of AI work waiting for the studio PC. The local agent (`npm run ai:agent`, on Pem's PC,
-- service role from .env.local) picks « waiting » rows, runs the local models (Ollama / Whisper), writes `result`.
-- An AI result never overwrites a field: card / web results are SUGGESTIONS, applied only when an admin accepts
-- them on the desk (the normal contact save path), rejected otherwise.
-- ai_agent: one row per PC agent, stamped every minute — the desk shows « agent seen n min ago » and its models,
-- which the live site's server can never check itself.
--
-- Writers: capture screen (kind 'card', team), desk (any kind, admin; decisions), agent (status / result, service role).
-- Readers: Bureau IA (admin), Overview « Local jobs » (counts, admin).

create table if not exists public.ai_job (
  id            bigint generated always as identity primary key,
  kind          text not null,
  -- What the job works on: a contact id (card / web), a voice note id, a work id; null for a whole queue (embed, describe).
  target_id     text,
  -- Input the agent needs (card: the Vault photo key + the Live Text typed on the phone). Never a secret.
  payload       jsonb not null default '{}'::jsonb,
  status        text not null default 'waiting',
  result        jsonb,
  error         text,
  decision      text,
  requested_by  uuid default auth.uid(),
  decided_by    uuid,
  created_at    timestamptz not null default now(),
  started_at    timestamptz,
  done_at       timestamptz,
  decided_at    timestamptz,
  constraint ai_job_kind_ck check (kind in ('embed', 'voice', 'describe', 'card', 'web')),
  constraint ai_job_status_ck check (status in ('waiting', 'running', 'done', 'failed')),
  constraint ai_job_decision_ck check (decision is null or decision in ('accepted', 'rejected'))
);
-- At most one open job per kind + target (a second Run, or a card captured twice, does not queue twice).
create unique index if not exists ai_job_one_open
  on public.ai_job (kind, coalesce(target_id, ''))
  where status in ('waiting', 'running');
create index if not exists ai_job_status_idx on public.ai_job (status, created_at);

alter table public.ai_job enable row level security;

drop policy if exists ai_job_admin_all on public.ai_job;
create policy ai_job_admin_all on public.ai_job
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Team members (the phone capture) may only queue a business-card job for themselves, waiting, with no result.
drop policy if exists ai_job_team_card_insert on public.ai_job;
create policy ai_job_team_card_insert on public.ai_job
  for insert to authenticated
  with check (
    public.is_team() and kind = 'card' and status = 'waiting'
    and requested_by = auth.uid() and result is null and decision is null
  );

revoke all on public.ai_job from anon, authenticated;
grant select, insert, update, delete on public.ai_job to authenticated;

create table if not exists public.ai_agent (
  id         text primary key,             -- e.g. 'studio-pc'
  seen_at    timestamptz not null default now(),
  models     jsonb not null default '[]'::jsonb,   -- Ollama models present + Whisper yes / no
  version    text
);
alter table public.ai_agent enable row level security;
drop policy if exists ai_agent_admin_select on public.ai_agent;
create policy ai_agent_admin_select on public.ai_agent
  for select to authenticated using (public.is_admin());
-- Written by the agent only (service role): no insert / update grant for app roles.
revoke all on public.ai_agent from anon, authenticated;
grant select on public.ai_agent to authenticated;
