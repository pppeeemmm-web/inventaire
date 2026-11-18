-- A work in the bin has no tasks waiting (Pem 2026-11-18: « when this is put in the bin, the production tab
-- tasks should be removed »). Same pattern as the Archive (oeuvre_archive_tasks): open tasks are PAUSED, not
-- deleted, so a work taken back out of the bin picks them up again. APPLIED 2026-11-18 (Pem « Yes, apply »), migration bin_pauses_tasks.
--
-- 1. Trigger: deleted_at set → open tasks paused; deleted_at cleared (restore) → paused tasks resumed, unless
--    the work is archived (statusId 3 / 9 / 10), where the Archive keeps them paused.
-- 2. Today: the 4 works in the bin with an open « Cataloguer » task (#2342, #2343, #2344, #2398) get it paused.
-- The Production tab and the menu badge already leave binned works out; this makes the data say the same.

create or replace function public.oeuvre_bin_tasks()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.deleted_at is not null and old.deleted_at is null then
    update work_action
       set paused_at = now()
     where oeuvre_id = new."OeuvreID" and not done and paused_at is null;
  elsif new.deleted_at is null and old.deleted_at is not null
        and coalesce(new."statusId", 0) not in (3, 9, 10) then
    update work_action
       set paused_at = null
     where oeuvre_id = new."OeuvreID" and not done and paused_at is not null;
  end if;
  return null;
end;
$$;

revoke execute on function public.oeuvre_bin_tasks() from public, anon, authenticated;

drop trigger if exists trg_oeuvre_bin_tasks on public."Oeuvres";
create trigger trg_oeuvre_bin_tasks
  after update of deleted_at on public."Oeuvres"
  for each row execute function public.oeuvre_bin_tasks();

-- Today's binned works (expect 4 rows).
update public.work_action a
   set paused_at = now()
  from public."Oeuvres" o
 where o."OeuvreID" = a.oeuvre_id
   and o.deleted_at is not null
   and not a.done
   and a.paused_at is null;
