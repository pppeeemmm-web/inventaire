-- Prune empty painting slots from work_session.payload->'items'.
--
-- Applied 2026-07-30: 8 slots pruned across 6 days, 0 remaining. Kept for re-use —
-- it is idempotent, so a later run is a no-op unless new empties appear.
--
-- An "empty" slot has no linked work, no title, and no photos — it carries no data.
-- They accumulated because "Add painting" used to POST a new slot on every tap while
-- the UI hid any slot that wasn't the active tab. The client no longer creates them.
--
-- HOW TO RUN
--   1. Run this file as-is. The `rollback` at the end throws the changes away, so you
--      just get the report: one row per affected day.
--   2. If the report looks right, change `rollback` to `commit` and run it again.
--
-- Safe to re-run: once pruned, nothing matches and the report comes back empty.

begin;

with slots as (
  select ws.id,
         ws.payload->>'session_day' as day,
         slot,
         ord,
         -- Mirrors sessionItemHasContent() in lib/work-session-payload.ts, inverted.
         (slot->>'oeuvre_id') is null
           and coalesce(trim(slot->>'oeuvre_title'), '') = ''
           and coalesce(trim(slot->>'title_hint'), '') = ''
           and jsonb_array_length(coalesce(slot->'shots', '[]'::jsonb)) = 0
           and coalesce((slot->>'applied_shot_count')::int, 0) = 0
         as is_empty
    from public.work_session ws
    cross join lateral jsonb_array_elements(coalesce(ws.payload->'items', '[]'::jsonb))
               with ordinality as x(slot, ord)
),
kept as (
  select id,
         min(day) as day,
         count(*) as slots_before,
         count(*) filter (where is_empty) as pruned,
         coalesce(jsonb_agg(slot order by ord) filter (where not is_empty), '[]'::jsonb) as slots_after
    from slots
   group by id
  having count(*) filter (where is_empty) > 0
)
update public.work_session ws
   set payload = jsonb_set(ws.payload, '{items}', kept.slots_after)
  from kept
 where kept.id = ws.id
returning kept.day,
          kept.slots_before,
          kept.pruned,
          jsonb_array_length(kept.slots_after) as slots_after;

rollback;  -- change to `commit` once the report above looks right

-- Note: this only prunes slots inside a session. A day you opened but never filled
-- keeps its session row, and the journal still shows it as "day opened".
