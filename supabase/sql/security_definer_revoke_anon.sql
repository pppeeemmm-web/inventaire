-- Close signed-out access to SECURITY DEFINER functions (owner GO 2026-11-12, AUDIT_2026-11).
--
-- PostgREST exposes every public function to `anon` through the default PUBLIC execute grant.
-- Holes found:
--   replace_oeuvre_themes / replace_oeuvre_work_groups — their guard only runs when auth.uid()
--     is set, so an anon call could rewrite any work's themes / groups.
--   graph_upsert_relation_edge — anon could insert arbitrary graph relations.
--   node_search_text — anon could read any node's index text (contact names, notes, comments);
--     graph_node_id hands out the node ids.
-- Tightened: graph_node_id, oeuvre_order_exists (signed-in callers only).
-- Kept: is_admin(), is_team() — RLS policies call them for every role; they only reveal the
--   caller's own role.
--
-- Callers checked: Atelier server actions (authenticated) use replace_*, graph_node_id; the
-- holder-check trigger (invoker = authenticated) uses oeuvre_order_exists; the embed worker uses
-- the service role for node_search_text; graph_sync_* trigger functions are SECURITY DEFINER
-- (run as owner) for graph_upsert_relation_edge / graph_node_id.

revoke execute on function public.replace_oeuvre_themes(integer, integer[]) from public, anon;
grant  execute on function public.replace_oeuvre_themes(integer, integer[]) to authenticated, service_role;

revoke execute on function public.replace_oeuvre_work_groups(integer, text[]) from public, anon;
grant  execute on function public.replace_oeuvre_work_groups(integer, text[]) to authenticated, service_role;

revoke execute on function public.graph_node_id(text, text) from public, anon;
grant  execute on function public.graph_node_id(text, text) to authenticated, service_role;

revoke execute on function public.oeuvre_order_exists(integer, text, integer) from public, anon;
grant  execute on function public.oeuvre_order_exists(integer, text, integer) to authenticated, service_role;

revoke execute on function public.graph_upsert_relation_edge(uuid, uuid, text, integer) from public, anon, authenticated;
grant  execute on function public.graph_upsert_relation_edge(uuid, uuid, text, integer) to service_role;

revoke execute on function public.node_search_text(uuid) from public, anon, authenticated;
grant  execute on function public.node_search_text(uuid) to service_role;
