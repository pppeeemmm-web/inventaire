-- TODO 1e (Pem OK 2026-11-16), applied 2026-11-16: `work_place` was replaced by `work_creation_step`
-- on 2026-11-14 (supabase/sql/work_creation_steps.sql); nothing read or wrote it any more.
-- Its 2 rows (oeuvre 1950 → place 2, oeuvre 2310 → place 9) already exist in work_creation_step.
-- Its trigger graph_work_place_text_dirty goes with the table; the shared function
-- graph_trg_oeuvre_child_dirty() stays (used by 8 other triggers).
drop table if exists public.work_place;
