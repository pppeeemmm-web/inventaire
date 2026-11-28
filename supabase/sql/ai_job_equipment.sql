-- Ollama for « Dire » (Stock › Équipement; TODO §2, Pem « GO Ollama » by choosing it 2026-11-28).
-- Applied on live 2026-11-28 on Pem's « Apply sql » (migration ai_job_equipment), after the throwaway test; verified by a live re-read.
-- « Envoyer au PC » queues the spoken list as an ai_job of kind 'equipment':
--   target_id = a walk id made on the device (a retry of the same walk does not queue twice — ai_job_one_open),
--   payload   = { text, place_id (null = « Sans lieu »), lang }.
-- The PC agent (scripts/ai-agent/equipment.mjs) names the lines with Ollama → result = { lines: [{ name, quantity }], model }.
-- The team sees its proposals in Équipement (« Proposé par le PC (n) »), ticks lines (each through save_stock_item, the
-- one Stock door) and closes the proposal through decide_equipment_job. Nothing leaves the studio PC.
-- Readers of ai_job unchanged: Bureau IA (admin, all kinds), the badge (card), getCardSuggestion (card only).

alter table public.ai_job drop constraint if exists ai_job_kind_ck;
alter table public.ai_job add constraint ai_job_kind_ck
  check (kind in ('embed', 'voice', 'describe', 'card', 'web', 'equipment'));

-- Team: queue a card or an equipment list for themselves, waiting, with no result.
drop policy if exists ai_job_team_card_insert on public.ai_job;
create policy ai_job_team_card_insert on public.ai_job
  for insert to authenticated
  with check (
    public.is_team() and kind in ('card', 'equipment') and status = 'waiting'
    and requested_by = auth.uid() and result is null and decision is null
  );

-- Team: read equipment lists (the proposals are shared studio work, like Stock).
drop policy if exists ai_job_team_equipment_select on public.ai_job;
create policy ai_job_team_equipment_select on public.ai_job
  for select to authenticated
  using (public.is_team() and kind = 'equipment');

-- The one door that closes a proposal: team, done or failed, not yet decided. Returns false when nothing changed.
-- « Ajouter » claims it first (accepted), so two taps or two phones never add the lines twice.
create or replace function public.decide_equipment_job(p_id bigint, p_decision text)
  returns boolean
  language plpgsql security definer set search_path to 'public' as $$
declare
  v_n int;
begin
  if not public.is_team() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_decision not in ('accepted', 'rejected') then
    raise exception 'decision' using errcode = '22023';
  end if;
  update public.ai_job
     set decision = p_decision, decided_by = auth.uid(), decided_at = now()
   where id = p_id and kind = 'equipment' and status in ('done', 'failed') and decision is null;
  get diagnostics v_n = row_count;
  return v_n = 1;
end;
$$;

revoke execute on function public.decide_equipment_job(bigint, text) from public, anon;
grant execute on function public.decide_equipment_job(bigint, text) to authenticated;
