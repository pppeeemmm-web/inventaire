-- Cover election: the last image on a work is its cover.
--
-- APPLIED 2026-07-30. 14 rows re-flagged. After the run:
--   works with exactly one cover ......... all (0 exceptions)
--   Oeuvres.txtImageNameLink vs flag ..... 0 disagreements
--   cover <> highest SeqNo ............... 4 (the legacy rows below, skipped on purpose)
--
-- WHY
-- commitWorkImage() used to write Oeuvres.txtImageNameLink directly and never set
-- tblImage.is_cover, so the flag and the column drifted apart. The 2026-07-30 cover
-- backfill (support_carton_merge_and_cover_backfill.sql) then elected the *lowest*
-- SeqNo for the 24 works that had no flag at all, and the trigger pushed that choice
-- into the column — sending several covers back to the first photo of the work
-- (#2357 went from its 07-18 shot back to the 07-13 one). The inventory list reads
-- the column while the drawer opens on the last image, so the two disagreed on screen.
--
-- commitWorkImage() now inserts with is_cover = true and syncCover() flags the
-- highest-SeqNo row after a delete/reorder; the trigger owns the Oeuvres column in
-- both cases. This file realigns the rows that predate that change.
--
-- GUARD
-- "Last" means highest SeqNo, which is what the app now enforces. Four legacy works
-- have a highest-SeqNo image that is *older* by DateAdded than their current cover —
-- rows imported from another work (filenames embed a foreign W_xxxx_01_ prefix) or
-- with SeqNo and filename swapped:
--   #272 (seq 4 embeds W_2075_01_), #1434 (W_1435_01_), #2103 (W_2094_01_),
--   #2339 (SeqNo 1 -> file _02, SeqNo 2 -> file _01)
-- Electing by SeqNo there would demote the good photo, so the join below only touches
-- works where highest SeqNo and newest DateAdded are the same row. Those four keep
-- their current cover and need an eyes-on decision.
--
-- Idempotent: `and t.is_cover = false` makes a second run match nothing.

with by_seq as (
  select distinct on ("OeuvreID") "OeuvreID", "ImageID"
    from public."tblImage" where "OeuvreID" is not null
   order by "OeuvreID", "SeqNo" desc nulls last, "ImageID" desc
),
by_date as (
  select distinct on ("OeuvreID") "OeuvreID", "ImageID"
    from public."tblImage" where "OeuvreID" is not null
   order by "OeuvreID", "DateAdded" desc nulls last, "ImageID" desc
),
target as (
  select s."OeuvreID", s."ImageID"
    from by_seq s join by_date d on d."OeuvreID" = s."OeuvreID" and d."ImageID" = s."ImageID"
)
update public."tblImage" t
   set is_cover = true
  from target
 where t."ImageID" = target."ImageID"
   and t.is_cover = false
returning t."OeuvreID", t."ImageID", t."SeqNo", t."txtImageNameLink";

-- Audit. Expect: not_one_cover 0, column_disagrees_with_flag 0, cover_not_last_seq 4.
select count(*) filter (where covers <> 1) as not_one_cover,
       count(*) filter (where cover_img is distinct from last_img) as cover_not_last_seq,
       (select count(*) from public."Oeuvres" o join per on per."OeuvreID" = o."OeuvreID"
         where o."txtImageNameLink" is distinct from per.cover_img) as column_disagrees_with_flag
  from (
    select "OeuvreID",
           count(*) filter (where is_cover) as covers,
           (array_agg("txtImageNameLink" order by "SeqNo" desc nulls last, "ImageID" desc))[1] as last_img,
           max(case when is_cover then "txtImageNameLink" end) as cover_img
      from public."tblImage" where "OeuvreID" is not null group by 1
  ) per;
