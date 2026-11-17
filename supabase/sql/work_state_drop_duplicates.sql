-- The same fact stored twice (docs/WORK_RULES.md §4, Pem 2026-11-17: « as you see fit »).
--   is_gift            — status 11 says « Don »; the flag disagreed once (#2339).
--   StageProduction    — old stage text, read by no screen; 305 works said « wip » while Disponible,
--   commercial_status  — Archive or Don, 63 said « available » while En production / destroyed / given.
-- Run ONLY after the code that stopped writing is_gift is live (deploy checked: x-build-sha), or
-- every work save fails. No view, function or policy reads them (checked 2026-11-17).
-- Version restore skips them in older snapshots (audit/version-actions.ts).
-- After applying: npm run gen:types

alter table public."Oeuvres" drop column if exists is_gift;
alter table public."Oeuvres" drop column if exists "StageProduction";
alter table public."Oeuvres" drop column if exists commercial_status;
