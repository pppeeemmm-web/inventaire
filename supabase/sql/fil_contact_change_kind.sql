-- Fil: the per-user seen / discarded state accepts the two kinds the Fil lists but the check did not allow:
-- 'contact_change' (team changes to a person, People.md §3) and 'work_order' (listed by fil/actions.ts already;
-- without it a « vu » on an order card could not be stored). The spare door team_change_seen goes: the Fil keeps
-- its own state (feed_item_state), as for every other kind. Re-runnable.
alter table public.feed_item_state drop constraint if exists feed_item_state_kind_ck;
alter table public.feed_item_state add constraint feed_item_state_kind_ck
  check (item_kind in ('note_line', 'idea', 'kaizen_item', 'pending_change', 'work_order', 'contact_change'));
drop function if exists public.team_change_seen(bigint);
