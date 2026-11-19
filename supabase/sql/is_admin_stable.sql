-- is_admin() was VOLATILE live (is_team() is STABLE): Postgres re-ran it for every row an RLS policy checked.
-- Same body, same answer within one statement → STABLE, so a query evaluates it once. Applied live 2026-11-19
-- (Pem « yes, apply it »; migration is_admin_stable). Body, SECURITY DEFINER and search_path unchanged.
alter function public.is_admin() stable;

-- Check: select provolatile from pg_proc where proname = 'is_admin';  -- expect 's'
