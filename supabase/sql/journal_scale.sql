-- Journal stream — day / month / year counts (design: docs/design/2026-11-22/JournalDesign.md §5, Step A).
-- One read, no data moved: for each day (or month, year) that holds anything, how many cards of each kind.
-- Serves the day dividers, the « Mois » and « Années » views and the paging of the stream (principle 7:
-- counts are asked of the database). Security invoker: RLS of each table applies, so a team member counts
-- only what they can read. Read only; callable by signed-in users only.
--
-- Counted, by Paris day:
--   entries   journal_entry not hidden, corrections never counted on their own (lib/journal-corrections.ts)
--   voices    voice_note not yet carried by an entry (the transcript entry counts as an entry)
--   photos    inspiration_photo (its own `day`)
--   remarks   note_line not discarded (a remark on a work, read on the day it was written)
--   creation  kaizen_item section 'creation' (old Création items, kept on their days)
--   proposals open AI link suggestions (✦) on counted entries
-- Works photographed in field sessions are counted in the app (their day lives in the session payload).

create or replace function public.journal_scale(
  p_before date default null,
  p_limit int default 14,
  p_grain text default 'day'
)
returns table (bucket date, entries int, voices int, photos int, remarks int, creation int, proposals int)
language sql
stable
security invoker
set search_path to 'public'
as $$
  with src as (
    select e.event_on as d, 1 as e, 0 as v, 0 as p, 0 as r, 0 as c,
      (select count(*) from journal_entry_link l
        where l.entry_id = e.id and l.proposed_by = 'ai' and l.validated_at is null and l.rejected_at is null)::int as s
    from journal_entry e
    where e.corrects_id is null and e.hidden_at is null
    union all
    select (v.created_at at time zone 'Europe/Paris')::date, 0, 1, 0, 0, 0, 0
    from voice_note v
    where not exists (select 1 from journal_entry e where e.voice_note_id = v.id)
    union all
    select p.day, 0, 0, 1, 0, 0, 0 from inspiration_photo p
    union all
    select (n.created_at at time zone 'Europe/Paris')::date, 0, 0, 0, 1, 0, 0 from note_line n where n.discarded_at is null
    union all
    select (k.created_at at time zone 'Europe/Paris')::date, 0, 0, 0, 0, 1, 0 from kaizen_item k where k.section = 'creation'
  ),
  b as (
    select (case p_grain
              when 'month' then date_trunc('month', d)
              when 'year' then date_trunc('year', d)
              else d end)::date as bucket,
           e, v, p, r, c, s
    from src
  )
  select bucket, sum(e)::int, sum(v)::int, sum(p)::int, sum(r)::int, sum(c)::int, sum(s)::int
  from b
  where p_before is null or bucket < p_before
  group by bucket
  order by bucket desc
  limit least(greatest(coalesce(p_limit, 14), 1), 400)
$$;

revoke execute on function public.journal_scale(date, int, text) from public, anon;
grant execute on function public.journal_scale(date, int, text) to authenticated;
