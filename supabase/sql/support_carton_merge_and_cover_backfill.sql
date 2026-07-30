-- Two data repairs found during the 2026-07-30 session refactor.
--
-- APPLIED 2026-07-30, except the one DELETE below (blocked by tooling, still open):
--   * Oeuvres.Support 8 -> 1 repointed (2 works). Support 1 now carries 15 works.
--   * is_cover elected for the 24 works that had images but no cover. The trigger
--     populated Oeuvres.txtImageNameLink for all of them; 0 works ended up with two
--     covers. Verified: works_without_cover 24 -> 0.
--
-- STILL OPEN: delete the orphaned duplicate "Carton" row. Until this runs, the
-- session Support picker keeps showing Carton twice even though nothing references
-- SupportID 8 any more.

-- ---------------------------------------------------------------------------
-- Run this. Guarded: it refuses to fire if anything still references SupportID 8.
-- ---------------------------------------------------------------------------
delete from public."Support"
 where "SupportID" = 8
   and "Support" = 'Carton'
   and not exists (select 1 from public."Oeuvres" where "Support" = 8);

-- Expect carton_rows = 1, works_on_support_1 = 15, still_on_8 = 0
select (select count(*) from public."Support" where "Support" = 'Carton') as carton_rows,
       (select count(*) from public."Oeuvres" where "Support" = 1) as works_on_support_1,
       (select count(*) from public."Oeuvres" where "Support" = 8) as still_on_8;

-- ---------------------------------------------------------------------------
-- SUPERSEDED 2026-07-30 — DO NOT RE-RUN the block below. It elects the LOWEST SeqNo,
-- which sent several covers back to the first photo of the work (#2357 lost its 07-18
-- shot in the inventory list). Use cover_follows_newest_image.sql instead; the app now
-- sets is_cover on insert, so the gap this filled can no longer open.
--
-- Reference: the cover backfill that already ran, kept so it can be re-run if the
-- gap reappears. sync_cover_image_to_oeuvres() only fires when is_cover is set to
-- true — it never elects a cover on plain INSERT, which is how 24 works ended up
-- with images and no cover. Setting is_cover lets the trigger write
-- txtImageNameLink itself, so this never touches that column directly.
-- Idempotent: a second run matches nothing.
-- ---------------------------------------------------------------------------
-- with needs_cover as (
--   select "OeuvreID" from public."tblImage"
--    where "OeuvreID" is not null group by "OeuvreID"
--   having count(*) filter (where is_cover) = 0
-- ),
-- pick as (
--   select distinct on (t."OeuvreID") t."ImageID"
--     from public."tblImage" t
--     join needs_cover n on n."OeuvreID" = t."OeuvreID"
--    where t."txtImageNameLink" is not null
--    order by t."OeuvreID", t."SeqNo" nulls last, t."ImageID"
-- )
-- update public."tblImage" t set is_cover = true
--   from pick where t."ImageID" = pick."ImageID";
