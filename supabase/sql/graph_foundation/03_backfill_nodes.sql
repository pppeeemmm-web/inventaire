-- Slice 5 — one-time node backfill (bypass register triggers).

SET session_replication_role = replica;

INSERT INTO public.nodes (node_type, source_pk)
SELECT 'oeuvre', "OeuvreID"::text FROM public."Oeuvres"
ON CONFLICT (node_type, source_pk) DO NOTHING;

INSERT INTO public.nodes (node_type, source_pk)
SELECT 'contact', "ContactID"::text FROM public."Contact"
ON CONFLICT (node_type, source_pk) DO NOTHING;

INSERT INTO public.nodes (node_type, source_pk)
SELECT 'theme', id::text FROM public.theme
ON CONFLICT (node_type, source_pk) DO NOTHING;

INSERT INTO public.nodes (node_type, source_pk)
SELECT 'concept', id::text FROM public.concept
ON CONFLICT (node_type, source_pk) DO NOTHING;

INSERT INTO public.nodes (node_type, source_pk)
SELECT 'working_group', id::text FROM public.working_group
ON CONFLICT (node_type, source_pk) DO NOTHING;

INSERT INTO public.nodes (node_type, source_pk)
SELECT 'exhibition', id::text FROM public.suivi_process
WHERE type = 'exposition'
ON CONFLICT (node_type, source_pk) DO NOTHING;

SET session_replication_role = DEFAULT;
