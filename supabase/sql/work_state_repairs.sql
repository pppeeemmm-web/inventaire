-- Work state repairs, build batch 1 (Pem's GO 2026-11-17). Run once, after work_state_rules.sql.
-- Counted before running (2026-11-17, works not deleted):
--   status not following the stage ........ 1   (#2381 Pot chinois → Disponible)
--   Cataloguer open on a catalogued work ... 21  (20 archived + #2264) → done, no date (day unknown)
--   Photographier missing (photo to take) .. 1   (#2264)
--   open task on a destroyed work .......... 1   (#2112) → closed
--   end of production on a work not Prêt ... 23  (22 catalogued with the photo still to take,
--                                                 dated the day they were catalogued; #2112) → cleared

-- 1. Status follows the stage (the rule's trigger does the work on any status write).
update public."Oeuvres"
   set "statusId" = "statusId"
 where deleted_at is null and fate is null and "statusId" in (1, 2)
   and "statusId" <> case when coalesce("Catalogué", false) and not coalesce("NeedsPhotograph", false) then 2 else 1 end;

-- 2. Tasks follow the stage. Closing old tasks: the day they were really done is unknown, so the
--    date stamp is switched off for these two statements only.
alter table public.work_action disable trigger trg_work_action_before_write;

update public.work_action a
   set done = true, paused_at = null
  from public."Oeuvres" o
 where o."OeuvreID" = a.oeuvre_id and o.deleted_at is null
   and a.action_type_id = 9 and not a.done and coalesce(o."Catalogué", false);

update public.work_action a
   set done = true, paused_at = null
  from public."Oeuvres" o
 where o."OeuvreID" = a.oeuvre_id and o.deleted_at is null
   and a.action_type_id = 6 and not a.done
   and coalesce(o."Catalogué", false) and not coalesce(o."NeedsPhotograph", false);

alter table public.work_action enable trigger trg_work_action_before_write;

insert into public.work_action (oeuvre_id, action_type_id, done)
select o."OeuvreID", 9, false
  from public."Oeuvres" o
 where o.deleted_at is null and not coalesce(o."Catalogué", false)
on conflict (oeuvre_id, action_type_id) do update set done = false where work_action.done;

insert into public.work_action (oeuvre_id, action_type_id, done)
select o."OeuvreID", 6, false
  from public."Oeuvres" o
 where o.deleted_at is null and coalesce(o."Catalogué", false) and coalesce(o."NeedsPhotograph", false)
on conflict (oeuvre_id, action_type_id) do update set done = false where work_action.done;

delete from public.work_action a
 using public."Oeuvres" o
 where o."OeuvreID" = a.oeuvre_id and a.action_type_id = 6 and not a.done
   and not coalesce(o."Catalogué", false);

-- 3. Set aside: open tasks of archived / destroyed / lost works.
update public.work_action a
   set paused_at = now()
  from public."Oeuvres" o
 where o."OeuvreID" = a.oeuvre_id and o."statusId" in (3, 9, 10)
   and not a.done and a.paused_at is null;

-- 4. Finished = Prêt: an end date on a work that is not Prêt goes (it was the cataloguing day).
update public."Oeuvres"
   set production_completed_on = null, production_completed_precision = null
 where deleted_at is null and production_completed_on is not null
   and not (coalesce("Catalogué", false) and not coalesce("NeedsPhotograph", false));
